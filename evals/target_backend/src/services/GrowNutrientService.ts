import { GrowNutrient, Nutrient, Grow } from '../models';

export interface GrowNutrientData {
  nutrient_id: string;
  dosage_ml_per_gallon?: number | null;
  frequency?: 'every_watering' | 'weekly' | 'biweekly' | 'as_needed' | null;
  phase_used?: 'all' | 'vegetative' | 'flowering' | 'late_flowering' | null;
  notes?: string | null;
}

/**
 * GrowNutrientService - Encapsulates all GrowNutrient model operations
 */
export const GrowNutrientService = {
  /**
   * Find all nutrients for a grow
   */
  async findByGrow(growId: string): Promise<GrowNutrient[]> {
    return GrowNutrient.findAll({
      where: { grow_id: growId },
      include: [
        {
          model: Nutrient,
          as: 'nutrient',
        },
      ],
      order: [['created_at', 'ASC']],
    });
  },

  /**
   * Add a nutrient to a grow
   */
  async add(growId: string, data: GrowNutrientData): Promise<GrowNutrient> {
    const growNutrient = await GrowNutrient.create({
      grow_id: growId,
      ...data,
    });

    // Reload with nutrient details
    return (await GrowNutrient.findByPk(growNutrient.id, {
      include: [
        {
          model: Nutrient,
          as: 'nutrient',
        },
      ],
    }))!;
  },

  /**
   * Find a specific grow-nutrient record by ID
   */
  async findById(id: string): Promise<GrowNutrient | null> {
    return GrowNutrient.findOne({
      where: { id },
      include: [
        {
          model: Nutrient,
          as: 'nutrient',
        },
        {
          model: Grow,
          as: 'grow',
          attributes: ['id', 'user_id'],
        },
      ],
    });
  },

  /**
   * Find a grow-nutrient record by ID and grow
   */
  async findByIdAndGrow(id: string, growId: string): Promise<GrowNutrient | null> {
    return GrowNutrient.findOne({
      where: {
        id,
        grow_id: growId,
      },
      include: [
        {
          model: Nutrient,
          as: 'nutrient',
        },
      ],
    });
  },

  /**
   * Check if nutrient already added to grow
   */
  async exists(growId: string, nutrientId: string): Promise<boolean> {
    const existing = await GrowNutrient.findOne({
      where: {
        grow_id: growId,
        nutrient_id: nutrientId,
      },
    });
    return !!existing;
  },

  /**
   * Update a grow-nutrient record
   */
  async update(
    growNutrient: GrowNutrient,
    data: Partial<Omit<GrowNutrientData, 'nutrient_id'>>
  ): Promise<GrowNutrient> {
    await growNutrient.update(data);
    return growNutrient;
  },

  /**
   * Remove a nutrient from a grow
   */
  async remove(growNutrient: GrowNutrient): Promise<void> {
    await growNutrient.destroy();
  },

  /**
   * Verify nutrient exists
   */
  async verifyNutrientExists(nutrientId: string): Promise<boolean> {
    const nutrient = await Nutrient.findByPk(nutrientId);
    return !!nutrient;
  },

  /**
   * Verify grow ownership
   */
  async verifyGrowOwnership(growId: string, userId: string): Promise<boolean> {
    const grow = await Grow.findOne({
      where: {
        id: growId,
        user_id: userId,
      },
    });
    return !!grow;
  },
};
