import { Grow, GrowLog, GrowLogEnvironment, Nutrient, GrowHarvest, GrowEnvironment } from '../models';
import { Op } from 'sequelize';

export interface GrowData {
  strain_name: string;
  started_at: Date;
  harvested_at?: Date | null;
  strain_type?: 'indica' | 'sativa' | 'hybrid' | 'ruderalis' | null;
  grow_method?: 'soil' | 'coco' | 'hydro' | 'dwc' | 'aero' | 'other' | null;
  grow_medium?: string | null;
  light_type?: 'led' | 'hps' | 'mh' | 'cfl' | 'sun' | 'other' | null;
  light_wattage?: number | null;
  grow_space_sqft?: number | null;
  pot_size_gallons?: number | null;
  plant_count?: number;
  environment_id?: string | null;
  notes?: string | null;
  is_public?: boolean;
}

export interface GrowFilters {
  phase?: string;
  strain_name?: string;
  limit?: number;
  offset?: number;
}

/**
 * GrowService - Encapsulates all Grow model operations
 */
export const GrowService = {
  /**
   * Create a new grow
   */
  async create(userId: string, data: GrowData): Promise<Grow> {
    return Grow.create({
      ...data,
      user_id: userId,
      phase: 'germination',
      phase_started_at: new Date(),
    });
  },

  /**
   * Find all grows for a user with optional filters
   * Returns both grows array and total count for pagination
   */
  async findAllByUser(
    userId: string,
    filters?: GrowFilters
  ): Promise<{ grows: Grow[]; total: number }> {
    const whereClause: any = { user_id: userId };

    if (filters?.phase) {
      whereClause.phase = filters.phase;
    }

    if (filters?.strain_name) {
      whereClause.strain_name = {
        [Op.iLike]: `%${filters.strain_name}%`,
      };
    }

    const { count, rows } = await Grow.findAndCountAll({
      where: whereClause,
      limit: filters?.limit || 50,
      offset: filters?.offset || 0,
      order: [['started_at', 'DESC']],
    });

    return { grows: rows, total: count };
  },

  /**
   * Find a grow by ID and user with associations
   */
  async findByIdAndUser(growId: string, userId: string): Promise<Grow | null> {
    return Grow.findOne({
      where: {
        id: growId,
        user_id: userId,
      },
      include: [
        {
          model: GrowEnvironment,
          as: 'environment',
        },
        {
          model: GrowLog,
          as: 'logs',
          include: [
            {
              model: GrowLogEnvironment,
              as: 'environment',
            },
          ],
          order: [['logged_at', 'DESC']],
        },
        {
          model: Nutrient,
          as: 'nutrients',
          through: {
            attributes: ['id', 'dosage_ml_per_gallon', 'frequency', 'phase_used', 'notes'],
          },
        },
        {
          model: GrowHarvest,
          as: 'harvest',
        },
      ],
    });
  },

  /**
   * Find a grow by ID and user (simple, without includes)
   */
  async findByIdAndUserSimple(growId: string, userId: string): Promise<Grow | null> {
    return Grow.findOne({
      where: {
        id: growId,
        user_id: userId,
      },
    });
  },

  /**
   * Update a grow
   */
  async update(grow: Grow, data: Partial<GrowData>): Promise<Grow> {
    await grow.update(data);
    return grow;
  },

  /**
   * Delete a grow
   */
  async delete(grow: Grow): Promise<void> {
    await grow.destroy();
  },

  /**
   * Update grow phase with timestamp
   */
  async updatePhase(
    grow: Grow,
    phase: 'germination' | 'vegetative' | 'flowering' | 'harvest' | 'archived'
  ): Promise<Grow> {
    await grow.update({
      phase,
      phase_started_at: new Date(),
    });
    return grow;
  },
};
