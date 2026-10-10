import { GrowHarvest, Grow } from '../models';

export interface GrowHarvestData {
  harvested_at: Date;
  wet_weight_grams?: number | null;
  dry_weight_grams?: number | null;
  trim_weight_grams?: number | null;
  thc_percent?: number | null;
  cbd_percent?: number | null;
  terpene_profile?: Record<string, number> | null;
  cure_days?: number | null;
  quality_rating?: number | null;
  smoke_report?: string | null;
}

/**
 * GrowHarvestService - Encapsulates all GrowHarvest model operations
 */
export const GrowHarvestService = {
  /**
   * Find harvest for a grow
   */
  async findByGrow(growId: string): Promise<GrowHarvest | null> {
    return GrowHarvest.findOne({
      where: { grow_id: growId },
    });
  },

  /**
   * Create harvest record (one per grow)
   */
  async create(growId: string, data: GrowHarvestData): Promise<GrowHarvest> {
    return GrowHarvest.create({
      ...data,
      grow_id: growId,
    });
  },

  /**
   * Find harvest by ID
   */
  async findById(id: string): Promise<GrowHarvest | null> {
    return GrowHarvest.findOne({
      where: { id },
      include: [
        {
          model: Grow,
          as: 'grow',
          attributes: ['id', 'user_id'],
        },
      ],
    });
  },

  /**
   * Update harvest data
   */
  async update(harvest: GrowHarvest, data: Partial<GrowHarvestData>): Promise<GrowHarvest> {
    await harvest.update(data);
    return harvest;
  },

  /**
   * Delete harvest record
   */
  async delete(harvest: GrowHarvest): Promise<void> {
    await harvest.destroy();
  },

  /**
   * Check if harvest already exists for grow
   */
  async exists(growId: string): Promise<boolean> {
    const harvest = await GrowHarvest.findOne({
      where: { grow_id: growId },
    });
    return !!harvest;
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
