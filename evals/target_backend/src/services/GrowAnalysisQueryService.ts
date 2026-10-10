import { GrowAnalysis } from '../models/GrowAnalysis';

export interface AnalysisFilters {
  analysisType?: string;
  limit?: number;
  offset?: number;
}

/**
 * GrowAnalysisQueryService - Encapsulates GrowAnalysis query operations
 *
 * Note: This service handles querying existing analyses.
 * For creating new analyses via AI, see services/ai/grow/GrowAnalysisService
 */
export const GrowAnalysisQueryService = {
  /**
   * Find all analyses for a specific grow with pagination
   */
  async findByGrow(
    growId: string,
    userId: string,
    filters?: AnalysisFilters
  ): Promise<{ analyses: GrowAnalysis[]; total: number }> {
    const whereClause: any = {
      grow_id: growId,
      user_id: userId,
    };

    if (filters?.analysisType) {
      whereClause.analysis_type = filters.analysisType;
    }

    const { rows, count } = await GrowAnalysis.findAndCountAll({
      where: whereClause,
      order: [['analyzed_at', 'DESC']],
      limit: filters?.limit || 50,
      offset: filters?.offset || 0,
    });

    return { analyses: rows, total: count };
  },
};
