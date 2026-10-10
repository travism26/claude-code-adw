import { Recommendation, Plant, PlantProfile } from '../models';

export interface RecommendationFilters {
  userId: string;
  limit?: number;
  severity?: string;
  type?: string;
}

export interface RecommendationSummary {
  total: number;
  by_severity: {
    high: number;
    medium: number;
    low: number;
  };
  by_type: {
    water: number;
    fertilize: number;
    prune: number;
    pest_check: number;
    harvest: number;
    general: number;
  };
}

/**
 * RecommendationService - Encapsulates all Recommendation model operations
 */
export const RecommendationService = {
  /**
   * Get recommendations for a user with optional filters
   */
  async findByUser(filters: RecommendationFilters): Promise<Recommendation[]> {
    const { userId, limit = 20, severity, type } = filters;

    const where: any = { user_id: userId };
    if (severity) where.severity = severity;
    if (type) where.type = type;

    return Recommendation.findAll({
      where,
      limit,
      order: [
        ['severity', 'DESC'],
        ['created_at', 'DESC'],
      ],
      include: [
        {
          model: Plant,
          as: 'plant',
          attributes: ['id', 'name', 'type'],
          include: [
            {
              model: PlantProfile,
              as: 'plantProfile',
              attributes: ['common_name', 'species'],
            },
          ],
        },
      ],
    });
  },

  /**
   * Get recommendation summary for a user
   */
  async getSummary(userId: string): Promise<RecommendationSummary> {
    const recommendations = await Recommendation.findAll({
      where: { user_id: userId },
      attributes: ['severity', 'type'],
    });

    return {
      total: recommendations.length,
      by_severity: {
        high: recommendations.filter((r) => r.severity === 'high').length,
        medium: recommendations.filter((r) => r.severity === 'medium').length,
        low: recommendations.filter((r) => r.severity === 'low').length,
      },
      by_type: {
        water: recommendations.filter((r) => r.type === 'water').length,
        fertilize: recommendations.filter((r) => r.type === 'fertilize').length,
        prune: recommendations.filter((r) => r.type === 'prune').length,
        pest_check: recommendations.filter((r) => r.type === 'pest_check').length,
        harvest: recommendations.filter((r) => r.type === 'harvest').length,
        general: recommendations.filter((r) => r.type === 'general').length,
      },
    };
  },

  /**
   * Delete all recommendations for a user
   */
  async deleteByUser(userId: string): Promise<number> {
    return Recommendation.destroy({
      where: { user_id: userId },
    });
  },

  /**
   * Find a recommendation by ID and user
   */
  async findByIdAndUser(id: string, userId: string): Promise<Recommendation | null> {
    return Recommendation.findOne({
      where: {
        id,
        user_id: userId,
      },
    });
  },

  /**
   * Delete a recommendation
   */
  async delete(recommendation: Recommendation): Promise<void> {
    await recommendation.destroy();
  },
};
