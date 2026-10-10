import { Plant, PlantProfile } from '../models';

/**
 * PlantService - Encapsulates all Plant model operations
 */
export const PlantService = {
  /**
   * Find plant by ID and user
   */
  async findByIdAndUser(id: string, userId: string): Promise<Plant | null> {
    return Plant.findOne({
      where: {
        id,
        user_id: userId,
      },
    });
  },

  /**
   * Find all plants for a user
   */
  async findAllByUser(userId: string): Promise<Plant[]> {
    return Plant.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
    });
  },

  /**
   * Create a new plant
   */
  async create(data: {
    name: string;
    type: string;
    user_id: string;
    water_interval_days?: number;
    fert_interval_days?: number;
    species?: string;
    photo_url?: string;
    plant_profile_id?: string;
  }): Promise<Plant> {
    return Plant.create(data);
  },

  /**
   * Update a plant
   */
  async update(plant: Plant, data: Partial<{
    name: string;
    type: string;
    water_interval_days: number;
    fert_interval_days: number;
    species: string;
    photo_url: string;
    plant_profile_id: string;
    last_watered: Date;
    last_fertilized: Date;
  }>): Promise<Plant> {
    await plant.update(data);
    return plant;
  },

  /**
   * Delete a plant
   */
  async delete(plant: Plant): Promise<void> {
    await plant.destroy();
  },
};

/**
 * PlantProfileService - Encapsulates all PlantProfile model operations
 */
export const PlantProfileService = {
  /**
   * Find plant profile by ID
   */
  async findById(id: string): Promise<PlantProfile | null> {
    return PlantProfile.findByPk(id);
  },
};
