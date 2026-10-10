import { Router, Request, Response } from 'express';
import { param, body, validationResult } from 'express-validator';
import { authenticateJWT } from '../middleware';
import { PlantCompanionService } from '../services/PlantCompanionService';
import { logApi } from '../services/logging/logger';

const router: Router = Router();

// Validation middleware
const validateCompanionCreate = [
  body('plant_a_id').isUUID().withMessage('Invalid plant A ID'),
  body('plant_b_id').isUUID().withMessage('Invalid plant B ID'),
  body('relationship')
    .isIn(['beneficial', 'harmful'])
    .withMessage('Relationship must be either beneficial or harmful'),
  body('notes').optional().trim(),
];

// Get companions for a specific plant profile
router.get(
  '/:plantProfileId',
  [param('plantProfileId').isUUID().withMessage('Invalid plant profile ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await PlantCompanionService.getCompanionsForPlant(req.params.plantProfileId);

      if (!result) {
        return res.status(404).json({ error: 'Plant profile not found' });
      }

      return res.status(200).json(result);
    } catch (error) {
      logApi.error('Error fetching companions', {
        plantProfileId: req.params.plantProfileId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch companions' });
    }
  }
);

// Get all companion relationships
router.get(
  '/',
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const companions = await PlantCompanionService.findAll();
      return res.status(200).json(companions);
    } catch (error) {
      logApi.error('Error fetching all companions', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch companions' });
    }
  }
);

// Create companion relationship (admin only - for now, any authenticated user)
router.post(
  '/',
  authenticateJWT,
  validateCompanionCreate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify both plant profiles exist
      const [plantA, plantB] = await Promise.all([
        PlantCompanionService.findPlantProfileById(req.body.plant_a_id),
        PlantCompanionService.findPlantProfileById(req.body.plant_b_id),
      ]);

      if (!plantA || !plantB) {
        return res.status(404).json({ error: 'One or both plant profiles not found' });
      }

      // Check if relationship already exists
      const exists = await PlantCompanionService.exists(
        req.body.plant_a_id,
        req.body.plant_b_id,
        req.body.relationship
      );

      if (exists) {
        return res.status(400).json({ error: 'This companion relationship already exists' });
      }

      const createdCompanion = await PlantCompanionService.create(req.body);

      return res.status(201).json(createdCompanion);
    } catch (error) {
      logApi.error('Error creating companion', {
        userId: req.user!.id,
        plantAId: req.body.plant_a_id,
        plantBId: req.body.plant_b_id,
        relationship: req.body.relationship,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to create companion relationship' });
    }
  }
);

// Delete companion relationship (admin only - for now, any authenticated user)
router.delete(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid companion ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const companion = await PlantCompanionService.findById(req.params.id);

      if (!companion) {
        return res.status(404).json({ error: 'Companion relationship not found' });
      }

      await PlantCompanionService.delete(companion);

      return res.status(200).json({ message: 'Companion relationship deleted successfully' });
    } catch (error) {
      logApi.error('Error deleting companion', {
        userId: req.user!.id,
        companionId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to delete companion relationship' });
    }
  }
);

export default router;
