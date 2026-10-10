import { Router, Request, Response } from 'express';
import { param, validationResult } from 'express-validator';
import { authenticateJWT } from '../middleware';
import { EnvironmentOverviewService } from '../services/EnvironmentOverviewService';
import { logApi } from '../services/logging/logger';

const router: Router = Router();

/**
 * GET /api/environment-overview
 * Get overview of all user's environments with capacity data
 */
router.get(
  '/',
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const overview = await EnvironmentOverviewService.getOverview(req.user!.id);

      logApi.info('Environment overview fetched', {
        userId: req.user!.id,
        totalEnvironments: overview.summary.totalEnvironments,
        totalPlants: overview.summary.totalPlants,
      });

      return res.status(200).json(overview);
    } catch (error) {
      logApi.error('Error fetching environment overview', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch environment overview' });
    }
  }
);

/**
 * GET /api/environment-overview/summary
 * Get just the summary statistics (lightweight endpoint)
 */
router.get(
  '/summary',
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const summary = await EnvironmentOverviewService.getCapacitySummary(
        req.user!.id
      );

      return res.status(200).json(summary);
    } catch (error) {
      logApi.error('Error fetching capacity summary', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch capacity summary' });
    }
  }
);

/**
 * GET /api/environment-overview/:id/capacity
 * Get capacity data for a single environment
 */
router.get(
  '/:id/capacity',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid environment ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const capacity = await EnvironmentOverviewService.getEnvironmentCapacity(
        req.params.id,
        req.user!.id
      );

      if (!capacity) {
        return res.status(404).json({ error: 'Environment not found' });
      }

      return res.status(200).json(capacity);
    } catch (error) {
      logApi.error('Error fetching environment capacity', {
        userId: req.user?.id,
        environmentId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch environment capacity' });
    }
  }
);

export default router;
