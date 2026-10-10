/**
 * Plant Care Context Builder
 * Responsible for gathering all plant-related data for AI analysis
 */

import { Plant } from '../../../models/Plant';
import { PlantProfile } from '../../../models/PlantProfile';
import { User } from '../../../models/User';
import { PlantCareContext } from './types';

export class PlantCareContextBuilder {
  constructor() {
    // Models are initialized at app startup, no sequelize needed
  }

  /**
   * Build comprehensive plant care context for AI analysis
   */
  async build(plantId: string, userId: string): Promise<PlantCareContext> {
    // Fetch plant with all related data
    const plant = await this.fetchPlant(plantId, userId);
    const user = await this.fetchUser(userId);

    // Get plot and garden if plant is in a garden
    let plotInfo = null;
    let gardenInfo = null;

    // Check if plant is in a plot
    // Note: Plot doesn't have plant_id - this check may need to be done via Plant->Plot relationship
    // For now, skipping plot/garden lookup since Plant model doesn't have plot_id either
    // This would need to be implemented if plots can be directly linked to plants
    const plot: any = null; // Placeholder for future implementation

    if (plot) {
      plotInfo = {
        id: plot.id,
        position: { x: plot.x, y: plot.y },
        dimensions: { width: plot.width, height: plot.height },
        compassDirection: plot.compass_direction,
        notes: plot.notes,
      };

      if (plot.garden) {
        gardenInfo = {
          id: plot.garden.id,
          name: plot.garden.name,
          zone: plot.garden.zone,
        };
      }
    }

    // Get plant profile for detailed info
    const plantProfile = plant.plant_profile_id
      ? await PlantProfile.findByPk(plant.plant_profile_id)
      : null;

    // Calculate care history metrics
    const careHistory = this.calculateCareHistory(plant);

    // Calculate environmental metrics
    const environmental = this.calculateEnvironmental(
      plantProfile,
      gardenInfo?.zone || user.growing_zone
    );

    return {
      plant: {
        id: plant.id,
        name: plant.name,
        species: plant.species,
        type: plant.type,
        plantFamily: plantProfile?.plant_family || null,
        difficulty: plantProfile?.difficulty || 'unknown',
        sunlightRequirements: plantProfile?.sunlight_requirements || null,
        spacingInches: plantProfile?.spacing_inches || null,
        zoneMin: plantProfile?.zone_min || null,
        zoneMax: plantProfile?.zone_max || null,
      },
      plot: plotInfo,
      garden: gardenInfo,
      user: {
        zone: user.growing_zone,
        timezone: user.tz,
      },
      careHistory,
      environmental,
    };
  }

  /**
   * Fetch plant with profile
   */
  private async fetchPlant(plantId: string, userId: string) {
    const plant = await Plant.findOne({
      where: { id: plantId, user_id: userId },
    });

    if (!plant) {
      throw new Error('Plant not found or access denied');
    }

    return plant;
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
   * Calculate care history metrics
   */
  private calculateCareHistory(plant: any) {
    const now = new Date();

    let daysSinceWatered: number | null = null;
    if (plant.last_watered) {
      const diff = now.getTime() - new Date(plant.last_watered).getTime();
      daysSinceWatered = Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    let daysSinceFertilized: number | null = null;
    if (plant.last_fertilized) {
      const diff = now.getTime() - new Date(plant.last_fertilized).getTime();
      daysSinceFertilized = Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    return {
      lastWatered: plant.last_watered,
      lastFertilized: plant.last_fertilized,
      daysSinceWatered,
      daysSinceFertilized,
    };
  }

  /**
   * Calculate environmental metrics
   */
  private calculateEnvironmental(
    plantProfile: any,
    userZone: string | null
  ): { currentSeason: string; zoneCompatible: boolean } {
    // Determine current season based on month
    const month = new Date().getMonth(); // 0-11
    let currentSeason = 'unknown';
    if (month >= 2 && month <= 4) currentSeason = 'spring';
    else if (month >= 5 && month <= 7) currentSeason = 'summer';
    else if (month >= 8 && month <= 10) currentSeason = 'fall';
    else currentSeason = 'winter';

    // Check zone compatibility
    let zoneCompatible = true;
    if (plantProfile && userZone) {
      const zoneNum = this.parseZone(userZone);
      if (zoneNum) {
        if (plantProfile.zone_min && zoneNum < plantProfile.zone_min) {
          zoneCompatible = false;
        }
        if (plantProfile.zone_max && zoneNum > plantProfile.zone_max) {
          zoneCompatible = false;
        }
      }
    }

    return {
      currentSeason,
      zoneCompatible,
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
