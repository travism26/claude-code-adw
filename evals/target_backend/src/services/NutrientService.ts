import { Nutrient } from '../models';
import { Op } from 'sequelize';

export interface NutrientData {
  brand: string;
  product_name: string;
  type: 'base' | 'supplement' | 'additive' | 'ph_adjuster' | 'other';
  npk_ratio?: string | null;
  description?: string | null;
  is_organic?: boolean;
}

export interface NutrientFilters {
  brand?: string;
  type?: string;
  is_organic?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * NutrientService - Encapsulates all Nutrient model operations
 */
export const NutrientService = {
  /**
   * Find all nutrients (system + user's custom)
   */
  async findAll(userId: string, filters?: NutrientFilters): Promise<Nutrient[]> {
    const whereClause: any = {
      [Op.or]: [
        { user_id: null }, // System nutrients
        { user_id: userId }, // User's custom nutrients
      ],
    };

    if (filters?.brand) {
      whereClause.brand = {
        [Op.iLike]: `%${filters.brand}%`,
      };
    }

    if (filters?.type) {
      whereClause.type = filters.type;
    }

    if (filters?.is_organic !== undefined) {
      whereClause.is_organic = filters.is_organic;
    }

    return Nutrient.findAll({
      where: whereClause,
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
      order: [
        ['user_id', 'ASC NULLS FIRST'], // System nutrients first
        ['brand', 'ASC'],
        ['product_name', 'ASC'],
      ],
    });
  },

  /**
   * Find a nutrient by ID
   */
  async findById(nutrientId: string): Promise<Nutrient | null> {
    return Nutrient.findOne({
      where: { id: nutrientId },
    });
  },

  /**
   * Create a custom nutrient (user-owned)
   */
  async create(userId: string, data: NutrientData): Promise<Nutrient> {
    return Nutrient.create({
      ...data,
      user_id: userId,
    });
  },

  /**
   * Update a custom nutrient
   */
  async update(nutrient: Nutrient, data: Partial<NutrientData>): Promise<Nutrient> {
    await nutrient.update(data);
    return nutrient;
  },

  /**
   * Delete a custom nutrient
   */
  async delete(nutrient: Nutrient): Promise<void> {
    await nutrient.destroy();
  },

  /**
   * Check if nutrient is a system nutrient (user_id is null)
   */
  isSystemNutrient(nutrient: Nutrient): boolean {
    return nutrient.user_id === null;
  },

  /**
   * Verify user owns the nutrient (for update/delete operations)
   */
  canModify(nutrient: Nutrient, userId: string): boolean {
    return nutrient.user_id === userId;
  },
};
