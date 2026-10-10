import { Router, Request, Response } from 'express';
import { param, validationResult } from 'express-validator';
import { authenticateJWT } from '../middleware';
import { GrowHarvestService } from '../services/GrowHarvestService';
import { logApi } from '../services/logging/logger';

const router: Router = Router();

// Delete harvest
router.delete(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid harvest ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const harvest = await GrowHarvestService.findById(req.params.id);

      if (!harvest) {
        return res.status(404).json({ error: 'Harvest not found' });
      }

      // Verify ownership through grow
      if ((harvest as any).grow?.user_id !== req.user!.id) {
        return res.status(404).json({ error: 'Harvest not found' });
      }

      await GrowHarvestService.delete(harvest);

      logApi.info('Harvest deleted', {
        userId: req.user!.id,
        harvestId: harvest.id,
      });

      return res.status(200).json({ message: 'Harvest deleted successfully' });
    } catch (error) {
      logApi.error('Error deleting harvest', {
        harvestId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to delete harvest' });
    }
  }
);

export default router;
