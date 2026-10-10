import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateJWT } from '../middleware';
import { GrowNutrientService } from '../services/GrowNutrientService';
import { logApi } from '../services/logging/logger';

const router: Router = Router();

// Validation middleware
const validateGrowNutrientUpdate = [
  param('id').isUUID().withMessage('Invalid grow nutrient ID'),
  body('dosage_ml_per_gallon')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Dosage must be 0 or greater'),
  body('frequency')
    .optional()
    .isIn(['every_watering', 'weekly', 'biweekly', 'as_needed'])
    .withMessage('Frequency must be one of: every_watering, weekly, biweekly, as_needed'),
  body('phase_used')
    .optional()
    .isIn(['all', 'vegetative', 'flowering', 'late_flowering'])
    .withMessage('Phase used must be one of: all, vegetative, flowering, late_flowering'),
  body('notes').optional().trim(),
];

// Update grow nutrient
router.put(
  '/:id',
  authenticateJWT,
  validateGrowNutrientUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const growNutrient = await GrowNutrientService.findById(req.params.id);

      if (!growNutrient) {
        return res.status(404).json({ error: 'Grow nutrient not found' });
      }

      // Verify ownership through grow
      if ((growNutrient as any).grow?.user_id !== req.user!.id) {
        return res.status(404).json({ error: 'Grow nutrient not found' });
      }

      await GrowNutrientService.update(growNutrient, req.body);

      logApi.info('Grow nutrient updated', {
        userId: req.user!.id,
        growNutrientId: growNutrient.id,
      });

      return res.status(200).json(growNutrient.toJSON());
    } catch (error) {
      logApi.error('Error updating grow nutrient', {
        growNutrientId: req.params.id,
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to update grow nutrient' });
    }
  }
);

// Remove nutrient from grow
router.delete(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid grow nutrient ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const growNutrient = await GrowNutrientService.findById(req.params.id);

      if (!growNutrient) {
        return res.status(404).json({ error: 'Grow nutrient not found' });
      }

      // Verify ownership through grow
      if ((growNutrient as any).grow?.user_id !== req.user!.id) {
        return res.status(404).json({ error: 'Grow nutrient not found' });
      }

      await GrowNutrientService.remove(growNutrient);

      logApi.info('Nutrient removed from grow', {
        userId: req.user!.id,
        growNutrientId: growNutrient.id,
      });

      return res.status(200).json({ message: 'Nutrient removed from grow successfully' });
    } catch (error) {
      logApi.error('Error removing nutrient from grow', {
        growNutrientId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to remove nutrient from grow' });
    }
  }
);

export default router;
