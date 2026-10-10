/**
 * Layout Context Builder
 * Responsible for gathering all data needed for layout generation
 */

import { Op } from 'sequelize';
import { Garden } from '../../../models/Garden';
import { PlantProfile } from '../../../models/PlantProfile';
import { PlantCompanion } from '../../../models/PlantCompanion';
import { User } from '../../../models/User';
import {
  LayoutContext,
  PlantMetadata,
  CompanionRelationship,
  LayoutGenerationPayload,
  PlantQuantity,
} from './types';
import { logAI } from '../../logging/logger';

export class LayoutContextBuilder {
  constructor() {
    // Models are initialized at app startup
  }

  /**
   * Build comprehensive layout context for AI generation
   */
  async build(payload: LayoutGenerationPayload): Promise<LayoutContext> {
    const { gardenId, userId, plantProfileIds, sunZones, preferences } =
      payload;

    // Fetch garden and user data
    const garden = await this.fetchGarden(gardenId, userId);
    const user = await this.fetchUser(userId);

    // Fetch selected plant profiles with full metadata
    const selectedPlants = await this.fetchPlantProfiles(plantProfileIds);

    // Fetch companion relationships for selected plants
    const companionRules = await this.fetchCompanionRules(plantProfileIds);

    // Calculate available space
    const availableSpace = garden.width * garden.height;

    // Calculate plant quantities if yield preferences are provided
    let plantQuantities: PlantQuantity[] | undefined;
    if (preferences.yieldGoal && preferences.householdSize) {
      logAI.info('Calculating plant quantities', {
        householdSize: preferences.householdSize,
        yieldGoal: preferences.yieldGoal,
        selectedPlantCount: selectedPlants.length,
      });

      plantQuantities = this.calculatePlantQuantities(
        selectedPlants,
        preferences.yieldGoal,
        preferences.householdSize
      );

      logAI.debug('Plant quantities calculated', {
        quantities: plantQuantities.map((q) => ({
          plant: q.plantName,
          quantity: q.calculatedQuantity,
        })),
      });
    }

    return {
      garden: {
        id: garden.id,
        name: garden.name,
        dimensions: { width: garden.width, height: garden.height },
        zone: garden.zone,
      },
      user: {
        zone: user.growing_zone,
      },
      selectedPlants,
      companionRules,
      sunZones: sunZones || [],
      preferences,
      availableSpace,
      plantQuantities,
      householdSize: preferences.householdSize,
    };
  }

  /**
   * Fetch garden and verify ownership
   */
  private async fetchGarden(gardenId: string, userId: string) {
    const garden = await Garden.findOne({
      where: { id: gardenId, user_id: userId },
    });

    if (!garden) {
      throw new Error('Garden not found or access denied');
    }

    return garden;
  }

  /**
   * Fetch user data
   */
  private async fetchUser(userId: string) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Fetch plant profiles with full metadata
   */
  private async fetchPlantProfiles(
    plantProfileIds: string[]
  ): Promise<PlantMetadata[]> {
    if (plantProfileIds.length === 0) {
      throw new Error('At least one plant must be selected');
    }

    const plants = await PlantProfile.findAll({
      where: { id: plantProfileIds },
    });

    if (plants.length === 0) {
      throw new Error('No valid plant profiles found');
    }

    return plants.map((plant: any) => ({
      id: plant.id,
      name: plant.name,
      scientificName: plant.species,
      type: plant.type,
      spacingInches: plant.spacing_inches,
      sunRequirement: plant.sunlight_requirements,
      height: plant.height,
      plantFamily: plant.plant_family,
      zonesMin: plant.zone_min,
      zonesMax: plant.zone_max,
      difficulty: plant.difficulty,
    }));
  }

  /**
   * Fetch companion planting relationships for selected plants
   */
  private async fetchCompanionRules(
    plantProfileIds: string[]
  ): Promise<CompanionRelationship[]> {
    if (plantProfileIds.length === 0) return [];

    const companions = await PlantCompanion.findAll({
      where: {
        [Op.or]: [
          { plant_a_id: plantProfileIds },
          { plant_b_id: plantProfileIds },
        ],
      },
      include: [
        { model: PlantProfile, as: 'plantA' },
        { model: PlantProfile, as: 'plantB' },
      ],
    });

    return companions.map((c: any) => ({
      plantAId: c.plant_a_id,
      plantAName: c.plantA.name,
      plantBId: c.plant_b_id,
      plantBName: c.plantB.name,
      relationship: c.relationship as 'beneficial' | 'harmful',
      notes: c.notes,
    }));
  }

  /**
   * Calculate plant quantities based on yield goal and household size
   */
  private calculatePlantQuantities(
    selectedPlants: PlantMetadata[],
    yieldGoal: 'fresh_eating' | 'light_preservation' | 'heavy_preservation',
    householdSize: number
  ): PlantQuantity[] {
    // Base quantities for common plants (per 2 people, fresh eating)
    const baseQuantities: Record<string, number> = {
      tomato: 3,
      pepper: 2,
      lettuce: 3,
      cucumber: 1,
      beans: 4,
      peas: 4,
      squash: 1,
      zucchini: 1,
      carrot: 10,
      radish: 15,
      onion: 10,
      garlic: 10,
      broccoli: 2,
      cauliflower: 2,
      cabbage: 2,
      kale: 2,
      spinach: 3,
      chard: 2,
      beet: 6,
      potato: 5,
      corn: 6,
      eggplant: 2,
      melon: 1,
      pumpkin: 1,
      herb: 1,
    };

    // Yield multipliers based on preservation goals
    const multipliers = {
      fresh_eating: 1,
      light_preservation: 2,
      heavy_preservation: 3,
    };

    const multiplier = multipliers[yieldGoal];
    const householdMultiplier = householdSize / 2; // Base is for 2 people

    return selectedPlants.map((plant) => {
      // Find base quantity by matching plant name or type
      const plantNameLower = plant.name.toLowerCase();
      let baseQty = 2; // Default

      // Check for exact match or partial match in base quantities
      for (const [key, value] of Object.entries(baseQuantities)) {
        if (
          plantNameLower.includes(key) ||
          plant.type.toLowerCase().includes(key)
        ) {
          baseQty = value;
          break;
        }
      }

      // Calculate quantity with multipliers
      let calculatedQty = Math.round(
        baseQty * householdMultiplier * multiplier
      );

      // Cap at 15 to avoid space issues
      calculatedQty = Math.min(calculatedQty, 15);

      // Ensure at least 1 plant
      calculatedQty = Math.max(calculatedQty, 1);

      // Generate reasoning
      const reasoning = `${yieldGoal.replace('_', ' ')} for ${householdSize} ${householdSize === 1 ? 'person' : 'people'}`;

      return {
        plantProfileId: plant.id,
        plantName: plant.name,
        calculatedQuantity: calculatedQty,
        reasoning,
      };
    });
  }
}
