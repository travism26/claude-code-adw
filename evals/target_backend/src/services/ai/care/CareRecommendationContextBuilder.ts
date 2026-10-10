/**
 * Care Recommendation Context Builder
 * Responsible for gathering plant care data for AI recommendation analysis
 */

import { Plant } from '../../../models/Plant';
import { PlantProfile } from '../../../models/PlantProfile';
import { User } from '../../../models/User';
import { CareRecommendationContext } from './types';

export class CareRecommendationContextBuilder {
  constructor() {
    // Models are initialized at app startup, no sequelize needed
  }

  /**
   * Build comprehensive care recommendation context for AI analysis
   * @param payload - Contains plantId, userId, and optional recommendation type and growth stage
   */
  async build(payload: {
    plantId: string;
    userId: string;
    requestedType?: 'watering' | 'fertilizing' | 'pruning' | 'general';
    growthStage?: 'seedling' | 'vegetative' | 'flowering' | 'fruiting' | 'dormant';
  }): Promise<CareRecommendationContext> {
    // Fetch plant and user data
    const plant = await this.fetchPlant(payload.plantId, payload.userId);
    const user = await this.fetchUser(payload.userId);

    // Get plant profile for detailed info
    const plantProfile = plant.plant_profile_id
      ? await PlantProfile.findByPk(plant.plant_profile_id)
      : null;

    // Calculate care history metrics (including mock total counts for now)
    const careHistory = this.calculateCareHistory(plant);

    // Determine seasonal context
    const seasonalContext = this.getSeasonalContext();

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
        waterIntervalDays: plant.water_interval_days,
        fertIntervalDays: plant.fert_interval_days,
      },
      user: {
        zone: user.growing_zone,
        timezone: user.tz,
      },
      careHistory,
      seasonalContext,
      recommendations: {
        requestedType: payload.requestedType,
        growthStage: payload.growthStage,
      },
    };
  }

  /**
   * Fetch plant
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

    // Mock total counts (in real implementation, you'd query care logs)
    const totalWaterings = daysSinceWatered !== null ? Math.floor(Math.random() * 20) + 5 : 0;
    const totalFertilizations = daysSinceFertilized !== null ? Math.floor(Math.random() * 5) + 1 : 0;

    return {
      lastWatered: plant.last_watered,
      lastFertilized: plant.last_fertilized,
      daysSinceWatered,
      daysSinceFertilized,
      totalWaterings,
      totalFertilizations,
    };
  }

  /**
   * Get current seasonal context
   */
  private getSeasonalContext(): {
    currentSeason: string;
    month: string;
    isGrowingSeason: boolean;
  } {
    const now = new Date();
    const month = now.toLocaleDateString('en-US', { month: 'long' });
    const monthNum = now.getMonth(); // 0-11

    let currentSeason = 'unknown';
    let isGrowingSeason = false;

    if (monthNum >= 2 && monthNum <= 4) {
      currentSeason = 'spring';
      isGrowingSeason = true;
    } else if (monthNum >= 5 && monthNum <= 7) {
      currentSeason = 'summer';
      isGrowingSeason = true;
    } else if (monthNum >= 8 && monthNum <= 10) {
      currentSeason = 'fall';
      isGrowingSeason = true;
    } else {
      currentSeason = 'winter';
      isGrowingSeason = false;
    }

    return { currentSeason, month, isGrowingSeason };
  }
}
