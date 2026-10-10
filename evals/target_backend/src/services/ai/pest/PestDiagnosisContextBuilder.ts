/**
 * Pest Diagnosis Context Builder
 * Responsible for gathering plant and symptom data for AI pest diagnosis
 */

import { Plant } from '../../../models/Plant';
import { PlantProfile } from '../../../models/PlantProfile';
import { User } from '../../../models/User';
import { PestDiagnosisContext } from './types';

export class PestDiagnosisContextBuilder {
  constructor() {
    // Models are initialized at app startup, no sequelize needed
  }

  /**
   * Build comprehensive pest diagnosis context for AI analysis
   * @param payload - Contains plantId, userId, symptoms, and optional environmental data
   */
  async build(payload: {
    plantId: string;
    userId: string;
    symptoms: {
      description: string;
      affectedParts?: string[];
      severity?: 'mild' | 'moderate' | 'severe';
      photoUrls?: string[];
    };
    recentChanges?: {
      newLocation?: boolean;
      wateringChange?: boolean;
      fertilizingChange?: boolean;
      otherChanges?: string;
    };
    recentWeather?: string;
  }): Promise<PestDiagnosisContext> {
    // Fetch plant and user data
    const plant = await this.fetchPlant(payload.plantId, payload.userId);
    const user = await this.fetchUser(payload.userId);

    // Get plant profile for detailed info
    const plantProfile = plant.plant_profile_id
      ? await PlantProfile.findByPk(plant.plant_profile_id)
      : null;

    // Determine current season
    const currentSeason = this.getCurrentSeason();

    return {
      plant: {
        id: plant.id,
        name: plant.name,
        species: plant.species,
        type: plant.type,
        plantFamily: plantProfile?.plant_family || null,
        difficulty: plantProfile?.difficulty || 'unknown',
        sunlightRequirements: plantProfile?.sunlight_requirements || null,
        zoneMin: plantProfile?.zone_min || null,
        zoneMax: plantProfile?.zone_max || null,
      },
      user: {
        zone: user.growing_zone,
        timezone: user.tz,
      },
      symptoms: {
        description: payload.symptoms.description,
        affectedParts: payload.symptoms.affectedParts || ['leaves'],
        severity: payload.symptoms.severity || 'moderate',
        photoUrls: payload.symptoms.photoUrls,
      },
      environmental: {
        recentWeather: payload.recentWeather,
        currentSeason,
        indoorOrOutdoor: plant.type,
      },
      recentChanges: payload.recentChanges,
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
   * Get current season
   */
  private getCurrentSeason(): string {
    const month = new Date().getMonth(); // 0-11
    if (month >= 2 && month <= 4) return 'spring';
    else if (month >= 5 && month <= 7) return 'summer';
    else if (month >= 8 && month <= 10) return 'fall';
    else return 'winter';
  }
}
