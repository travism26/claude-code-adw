import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware';
import { GrowAnalysisQueryService } from '../services/GrowAnalysisQueryService';
import { GrowService } from '../services/GrowService';
import { logApi } from '../services/logging/logger';
import { query, validationResult } from 'express-validator';

const router: Router = Router();

/**
 * GET /api/grow-analyses
 * Fetch analysis history for a specific grow
 *
 * Query params:
 * - growId: UUID (required) - Grow to fetch analyses for
 * - analysisType: string (optional) - Filter by analysis type
 * - limit: number (optional, default: 50) - Max results to return
 * - offset: number (optional, default: 0) - Pagination offset
 *
 * Responses:
 * - 200: Analysis history fetched successfully
 * - 400: Invalid request (bad UUID or validation error)
 * - 401: Not authenticated
 * - 403: User does not own this grow
 * - 404: Grow not found
 * - 500: Server error
 */
router.get(
  '/',
  authenticateJWT,
  [
    query('growId').isUUID().withMessage('Invalid grow ID'),
    query('analysisType')
      .optional()
      .isIn(['general', 'nutrients', 'diagnosis', 'optimization', 'harvest_timing'])
      .withMessage('Invalid analysis type'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be >= 0'),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logApi.warn('Validation errors in grow analyses fetch', {
        userId: req.user?.id,
        errors: errors.array(),
      });
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user!.id;
    const growId = req.query.growId as string;
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const offset = parseInt((req.query.offset as string) || '0', 10);

    try {
      // Verify grow exists and user owns it
      const grow = await GrowService.findByIdAndUserSimple(growId, userId);

      if (!grow) {
        logApi.warn('Grow not found or access denied for analysis history', {
          userId,
          growId,
        });
        return res.status(404).json({ error: 'Grow not found' });
      }

      // Fetch analyses
      const analysisType = req.query.analysisType as string | undefined;
      const { analyses, total } = await GrowAnalysisQueryService.findByGrow(
        growId,
        userId,
        { analysisType, limit, offset }
      );

      logApi.info('Fetched grow analysis history', {
        userId,
        growId,
        count: analyses.length,
        total,
      });

      return res.status(200).json({
        analyses,
        total,
        limit,
        offset,
      });
    } catch (error) {
      logApi.error('Error fetching grow analysis history', {
        userId,
        growId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch analysis history' });
    }
  }
);

export default router;
