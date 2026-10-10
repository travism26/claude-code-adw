import { CareHistory, Plant } from '../models';
import { Op } from 'sequelize';

export interface CareHistoryFilters {
  userId: string;
  actionType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * CareHistoryService - Encapsulates all CareHistory model operations
 */
export const CareHistoryService = {
  /**
   * Create a new care history entry
   */
  async create(data: {
    plant_id: string;
    user_id: string;
    action_type: string;
    action_date: Date;
    notes?: string | null;
  }): Promise<CareHistory> {
    return CareHistory.create(data);
  },

  /**
   * Find care history for a specific plant
   */
  async findByPlantId(plantId: string, userId: string): Promise<CareHistory[]> {
    return CareHistory.findAll({
      where: {
        plant_id: plantId,
        user_id: userId,
      },
      order: [['action_date', 'DESC']],
      include: [
        {
          model: Plant,
          as: 'plant',
          attributes: ['id', 'name', 'species'],
        },
      ],
    });
  },

  /**
   * Find all care history for a user with optional filters
   */
  async findByUser(filters: CareHistoryFilters): Promise<CareHistory[]> {
    const { userId, actionType, startDate, endDate, limit = 50 } = filters;

    const whereClause: any = { user_id: userId };

    if (actionType) {
      whereClause.action_type = actionType;
    }

    if (startDate || endDate) {
      whereClause.action_date = {};
      if (startDate) {
        whereClause.action_date[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.action_date[Op.lte] = new Date(endDate);
      }
    }

    return CareHistory.findAll({
      where: whereClause,
      limit,
      order: [['action_date', 'DESC']],
      include: [
        {
          model: Plant,
          as: 'plant',
          attributes: ['id', 'name', 'species', 'type'],
        },
      ],
    });
  },

  /**
   * Find a care history entry by ID and user
   */
  async findByIdAndUser(id: string, userId: string): Promise<CareHistory | null> {
    try {
      return await CareHistory.findOne({
        where: {
          id,
          user_id: userId,
        },
      });
    } catch (dbError: any) {
      // If database query fails due to invalid UUID format, return null
      if (dbError.name === 'SequelizeDatabaseError' || dbError.message?.includes('invalid input syntax')) {
        return null;
      }
      throw dbError;
    }
  },

  /**
   * Delete a care history entry
   */
  async delete(careHistory: CareHistory): Promise<void> {
    await careHistory.destroy();
  },

  /**
   * Find plant by ID and user (for ownership verification)
   */
  async findPlantByIdAndUser(plantId: string, userId: string): Promise<Plant | null> {
    return Plant.findOne({
      where: {
        id: plantId,
        user_id: userId,
      },
    });
  },

  /**
   * Update plant care timestamps
   */
  async updatePlantCareTimestamp(
    plant: Plant,
    actionType: string,
    careDate: Date
  ): Promise<void> {
    if (actionType === 'water') {
      await plant.update({ last_watered: careDate });
    } else if (actionType === 'fertilize') {
      await plant.update({ last_fertilized: careDate });
    }
  },
};
