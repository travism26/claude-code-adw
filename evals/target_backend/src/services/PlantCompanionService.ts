import { PlantCompanion, PlantProfile } from '../models';
import { Op } from 'sequelize';

export interface CompanionResult {
  plant: PlantProfile;
  beneficial: Array<{ id: string; plant: PlantProfile; notes: string | null }>;
  harmful: Array<{ id: string; plant: PlantProfile; notes: string | null }>;
}

/**
 * PlantCompanionService - Encapsulates all PlantCompanion model operations
 */
export const PlantCompanionService = {
  /**
   * Get companions for a specific plant profile
   */
  async getCompanionsForPlant(plantProfileId: string): Promise<CompanionResult | null> {
    // Verify plant profile exists
    const profile = await PlantProfile.findByPk(plantProfileId);
    if (!profile) {
      return null;
    }

    // Find all companion relationships for this plant
    const companions = await PlantCompanion.findAll({
      where: {
        [Op.or]: [
          { plant_a_id: plantProfileId },
          { plant_b_id: plantProfileId },
        ],
      },
      include: [
        {
          model: PlantProfile,
          as: 'plantA',
          attributes: ['id', 'common_name', 'species'],
        },
        {
          model: PlantProfile,
          as: 'plantB',
          attributes: ['id', 'common_name', 'species'],
        },
      ],
    });

    // Organize companions into beneficial and harmful
    const beneficial: Array<{ id: string; plant: PlantProfile; notes: string | null }> = [];
    const harmful: Array<{ id: string; plant: PlantProfile; notes: string | null }> = [];

    companions.forEach((comp: any) => {
      const isPlantA = comp.plant_a_id === plantProfileId;
      const companion = isPlantA ? comp.plantB : comp.plantA;

      const companionData = {
        id: comp.id,
        plant: companion,
        notes: comp.notes,
      };

      if (comp.relationship === 'beneficial') {
        beneficial.push(companionData);
      } else {
        harmful.push(companionData);
      }
    });

    return {
      plant: profile,
      beneficial,
      harmful,
    };
  },

  /**
   * Get all companion relationships
   */
  async findAll(): Promise<PlantCompanion[]> {
    return PlantCompanion.findAll({
      include: [
        {
          model: PlantProfile,
          as: 'plantA',
          attributes: ['id', 'common_name', 'species'],
        },
        {
          model: PlantProfile,
          as: 'plantB',
          attributes: ['id', 'common_name', 'species'],
        },
      ],
      order: [
        ['relationship', 'ASC'],
        ['created_at', 'DESC'],
      ],
    });
  },

  /**
   * Check if a companion relationship already exists
   */
  async exists(plantAId: string, plantBId: string, relationship: string): Promise<boolean> {
    const existing = await PlantCompanion.findOne({
      where: {
        [Op.or]: [
          {
            plant_a_id: plantAId,
            plant_b_id: plantBId,
            relationship,
          },
          {
            plant_a_id: plantBId,
            plant_b_id: plantAId,
            relationship,
          },
        ],
      },
    });
    return existing !== null;
  },

  /**
   * Create a new companion relationship
   */
  async create(data: {
    plant_a_id: string;
    plant_b_id: string;
    relationship: string;
    notes?: string;
  }): Promise<PlantCompanion> {
    const companion = await PlantCompanion.create(data);
    return (await PlantCompanion.findByPk(companion.id, {
      include: [
        {
          model: PlantProfile,
          as: 'plantA',
          attributes: ['id', 'common_name', 'species'],
        },
        {
          model: PlantProfile,
          as: 'plantB',
          attributes: ['id', 'common_name', 'species'],
        },
      ],
    }))!;
  },

  /**
   * Find companion by ID
   */
  async findById(id: string): Promise<PlantCompanion | null> {
    return PlantCompanion.findByPk(id);
  },

  /**
   * Delete a companion relationship
   */
  async delete(companion: PlantCompanion): Promise<void> {
    await companion.destroy();
  },

  /**
   * Find plant profile by ID
   */
  async findPlantProfileById(id: string): Promise<PlantProfile | null> {
    return PlantProfile.findByPk(id);
  },
};
