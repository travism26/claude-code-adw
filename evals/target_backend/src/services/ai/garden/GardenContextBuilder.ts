/**
 * Garden Context Builder
 * Responsible for gathering all garden-related data for AI analysis
 */

import { Op } from 'sequelize';
import { Garden } from '../../../models/Garden';
import { Plot } from '../../../models/Plot';
import { PlantProfile } from '../../../models/PlantProfile';
import { PlantCompanion } from '../../../models/PlantCompanion';
import { SeasonalTip } from '../../../models/SeasonalTip';
import { User } from '../../../models/User';
import {
  GardenContext,
  PlotContext,
  PlantContext,
  CompanionRule,
  SeasonalTipInfo,
  GardenMetrics,
} from './types';

export class GardenContextBuilder {
  constructor() {
    // Models are initialized at app startup, no sequelize needed
  }

  /**
   * Build comprehensive garden context for AI analysis
   */
  async build(gardenId: string, userId: string): Promise<GardenContext> {
    // Fetch garden with all related data
    const garden = await this.fetchGarden(gardenId, userId);
    const user = await this.fetchUser(userId);
    const plots = this.buildPlotContext(garden);
    const plantProfileIds = this.extractPlantProfileIds(plots);

    // Fetch companion rules and seasonal tips
    const companionRules = await this.fetchCompanionRules(plantProfileIds);
    const seasonalTips = await this.fetchSeasonalTips(
      plantProfileIds,
      garden.zone || user.growing_zone
    );

    // Calculate metrics
    const metrics = this.calculateMetrics(plots, companionRules, garden, user);

    return {
      garden: {
        id: garden.id,
        name: garden.name,
        dimensions: { width: garden.width, height: garden.height },
        zone: garden.zone,
      },
      user: {
        zone: user.growing_zone,
        timezone: user.tz,
      },
      plots,
      companionRules,
      seasonalTips,
      metrics,
    };
  }

  /**
   * Fetch garden with plots and plant profiles
   */
  private async fetchGarden(gardenId: string, userId: string) {
    const garden = await Garden.findOne({
      where: { id: gardenId, user_id: userId },
      include: [
        {
          model: Plot,
          as: 'plots',
          include: [
            {
              model: PlantProfile,
              as: 'plantProfile',
            },
          ],
        },
      ],
    });

    if (!garden) {
      throw new Error('Garden not found or access denied');
    }

    return garden;
  }

  /**
   * Fetch user
   */
  private async fetchUser(userId: string) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Build plot context from garden data
   */
  private buildPlotContext(garden: any): PlotContext[] {
    return garden.plots.map((plot: any) => ({
      id: plot.id,
      position: { x: plot.x, y: plot.y },
      dimensions: { width: plot.width, height: plot.height },
      compassDirection: plot.compass_direction,
      status: plot.status || 'planned',
      notes: plot.notes,
      plant: plot.plantProfile ? this.buildPlantContext(plot.plantProfile) : null,
    }));
  }

  /**
   * Build plant context from plant profile
   */
  private buildPlantContext(plantProfile: any): PlantContext {
    return {
      profileId: plantProfile.id,
      name: plantProfile.name,
      species: plantProfile.species,
      type: plantProfile.type,
      sunlightRequirements: plantProfile.sunlight_requirements,
      spacingInches: plantProfile.spacing_inches,
      plantFamily: plantProfile.plant_family,
      zoneMin: plantProfile.zone_min,
      zoneMax: plantProfile.zone_max,
      difficulty: plantProfile.difficulty,
    };
  }

  /**
   * Extract plant profile IDs from plots
   */
  private extractPlantProfileIds(plots: PlotContext[]): string[] {
    return plots.filter((p) => p.plant !== null).map((p) => p.plant!.profileId);
  }

  /**
   * Fetch companion planting rules
   */
  private async fetchCompanionRules(
    plantProfileIds: string[]
  ): Promise<CompanionRule[]> {
    if (plantProfileIds.length === 0) return [];

    const companions = await PlantCompanion.findAll({
      where: {
        [Op.or]: [{ plant_a_id: plantProfileIds }, { plant_b_id: plantProfileIds }],
      },
      include: [
        { model: PlantProfile, as: 'plantA' },
        { model: PlantProfile, as: 'plantB' },
      ],
    });

    return companions.map((c: any) => ({
      plantAName: c.plantA.name,
      plantBName: c.plantB.name,
      relationship: c.relationship as 'beneficial' | 'harmful',
      notes: c.notes,
    }));
  }

  /**
   * Fetch seasonal tips filtered by zone
   */
  private async fetchSeasonalTips(
    plantProfileIds: string[],
    gardenZone: string | null
  ): Promise<SeasonalTipInfo[]> {
    if (plantProfileIds.length === 0) return [];

    const tips = await SeasonalTip.findAll({
      where: {
        plant_profile_id: plantProfileIds,
        // Filter by zone if available
        ...(gardenZone && {
          [Op.or]: [
            { zone_min: null, zone_max: null },
            {
              zone_min: { [Op.lte]: this.parseZone(gardenZone) },
              zone_max: { [Op.gte]: this.parseZone(gardenZone) },
            },
          ],
        }),
      },
      include: [{ model: PlantProfile, as: 'plantProfile' }],
      order: [['priority', 'DESC']],
      limit: 20, // Limit to most relevant tips
    });

    return tips.map((t: any) => ({
      plantName: t.plantProfile.name,
      season: t.season,
      tip: t.tip_text,
      timing: t.timing_weeks,
    }));
  }

  /**
   * Calculate garden metrics
   */
  private calculateMetrics(
    plots: PlotContext[],
    companionRules: CompanionRule[],
    garden: any,
    user: any
  ): GardenMetrics {
    const occupiedPlots = plots.filter((p) => p.plant !== null).length;
    const uniquePlants = new Set(
      plots.filter((p) => p.plant !== null).map((p) => p.plant!.name)
    ).size;

    // Calculate average spacing between plots
    let totalSpacing = 0;
    let spacingCount = 0;
    for (let i = 0; i < plots.length; i++) {
      for (let j = i + 1; j < plots.length; j++) {
        const distance = Math.sqrt(
          Math.pow(plots[j].position.x - plots[i].position.x, 2) +
            Math.pow(plots[j].position.y - plots[i].position.y, 2)
        );
        totalSpacing += distance;
        spacingCount++;
      }
    }
    const averageSpacing = spacingCount > 0 ? totalSpacing / spacingCount : null;

    // Calculate zone compatibility issues
    const gardenZoneNum = this.parseZone(garden.zone || user.growing_zone || '');
    const zoneCompatibilityIssues = plots.filter((p) => {
      if (!p.plant || !gardenZoneNum) return false;
      if (p.plant.zoneMin && gardenZoneNum < p.plant.zoneMin) return true;
      if (p.plant.zoneMax && gardenZoneNum > p.plant.zoneMax) return true;
      return false;
    }).length;

    // Count harmful companion conflicts
    const companionConflicts = companionRules.filter(
      (rule) => rule.relationship === 'harmful'
    ).length;

    // Calculate status metrics
    const statusMetrics = this.calculateStatusMetrics(plots);

    return {
      totalPlots: plots.length,
      occupiedPlots,
      uniquePlants,
      averageSpacing,
      zoneCompatibilityIssues,
      companionConflicts,
      ...statusMetrics,
    };
  }

  /**
   * Calculate status-based metrics
   */
  private calculateStatusMetrics(plots: PlotContext[]): {
    plannedPlots: number;
    plantedPlots: number;
    harvestedPlots: number;
  } {
    const plannedPlots = plots.filter((p) => p.status === 'planned').length;
    const plantedPlots = plots.filter((p) => p.status === 'planted').length;
    const harvestedPlots = plots.filter((p) => p.status === 'harvested').length;

    return {
      plannedPlots,
      plantedPlots,
      harvestedPlots,
    };
  }

  /**
   * Parse zone string to numeric value
   */
  private parseZone(zone: string | null): number | null {
    if (!zone) return null;
    const match = zone.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }
}
