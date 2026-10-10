import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware';
import { analysisLimitService } from '../services/analysisLimitService';
import { logApi } from '../services/logging/logger';

const router: Router = Router();

/**
 * GET /api/analysis-usage/today
 * Get usage statistics for today
 */
router.get(
  '/today',
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.id;
      const stats = await analysisLimitService.getUsageForToday(userId);

      return res.status(200).json(stats);
    } catch (error) {
      logApi.error('Error fetching usage stats', {
        userId: req.user!.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch usage statistics' });
    }
  }
);

/**
 * GET /api/analysis-usage/can-analyze
 * Check if user can perform an analysis
 *
 * Query params:
 * - gardenId: Optional garden ID for per-garden pending check
 */
router.get(
  '/can-analyze',
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.id;
      const analysisType = req.query.analysisType as import('../services/analysisLimitService').AnalysisType | undefined;
      const result = await analysisLimitService.checkCanAnalyze(userId, analysisType);

      return res.status(200).json(result);
    } catch (error) {
      logApi.error('Error checking can analyze', {
        userId: req.user!.id,
        gardenId: req.query.gardenId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to check analysis availability' });
    }
  }
);

export default router;
