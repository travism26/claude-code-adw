import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateJWT } from '../middleware';
import { JournalEntryService } from '../services/JournalEntryService';
import { logApi } from '../services/logging/logger';

const router: Router = Router();

// Validation middleware
const validateJournalCreate = [
  body('plant_id').isUUID().withMessage('Valid plant ID is required'),
  body('note')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Note must be less than 1000 characters'),
  body('photo_url')
    .optional()
    .isURL()
    .withMessage('Photo URL must be a valid URL'),
];

const validateJournalUpdate = [
  param('id').isUUID().withMessage('Invalid journal entry ID'),
  body('note')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Note must be less than 1000 characters'),
  body('photo_url')
    .optional()
    .isURL()
    .withMessage('Photo URL must be a valid URL'),
];

// Verify plant ownership middleware
const verifyPlantOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const plantId = req.body.plant_id || req.params.plantId;

    const plant = await JournalEntryService.verifyPlantOwnership(plantId, req.user!.id);

    if (!plant) {
      return res.status(404).json({
        error: 'Plant not found or access denied',
      });
    }

    next();
  } catch (error) {
    // Only return 500 for unexpected errors
    if (error instanceof Error && error.name === 'SequelizeDatabaseError') {
      return res.status(400).json({
        error: 'Invalid plant ID format',
      });
    }

    const plantIdForLog = req.body.plant_id || req.params.plantId;
    logApi.error('Plant ownership verification error', {
      userId: req.user!.id,
      plantId: plantIdForLog,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({
      error: 'Error verifying plant ownership',
    });
  }
};

// Create journal entry asdas
router.post(
  '/',
  authenticateJWT,
  validateJournalCreate,
  verifyPlantOwnership,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const entry = await JournalEntryService.create(req.body);

      return res.status(201).json({
        message: 'Journal entry created successfully',
        entry,
      });
    } catch (error) {
      logApi.error('Create journal entry error', {
        userId: req.user!.id,
        plantId: req.body.plant_id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Error creating journal entry',
      });
    }
  }
);

// Get all journal entries for a plant
router.get(
  '/plant/:plantId',
  authenticateJWT,
  param('plantId').isUUID().withMessage('Invalid plant ID'),
  verifyPlantOwnership,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const entries = await JournalEntryService.findByPlantId(req.params.plantId);

      return res.json({
        entries,
      });
    } catch (error) {
      logApi.error('Get journal entries error', {
        userId: req.user!.id,
        plantId: req.params.plantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Error retrieving journal entries',
      });
    }
  }
);

// Get single journal entry
router.get(
  '/:id',
  authenticateJWT,
  param('id').isUUID().withMessage('Invalid journal entry ID'),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const entry = await JournalEntryService.findByIdWithPlant(req.params.id, req.user!.id);

      if (!entry) {
        return res.status(404).json({
          error: 'Journal entry not found',
        });
      }

      return res.json({
        entry,
      });
    } catch (error) {
      logApi.error('Get journal entry error', {
        userId: req.user!.id,
        journalId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Error retrieving journal entry',
      });
    }
  }
);

// Update journal entry
router.put(
  '/:id',
  authenticateJWT,
  validateJournalUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const entry = await JournalEntryService.findByIdWithPlant(req.params.id, req.user!.id);

      if (!entry) {
        return res.status(404).json({
          error: 'Journal entry not found',
        });
      }

      await JournalEntryService.update(entry, req.body);

      return res.json({
        message: 'Journal entry updated successfully',
        entry,
      });
    } catch (error) {
      logApi.error('Update journal entry error', {
        userId: req.user!.id,
        journalId: req.params.id,
        updateFields: Object.keys(req.body),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Error updating journal entry',
      });
    }
  }
);

// Delete journal entry
router.delete(
  '/:id',
  authenticateJWT,
  param('id').isUUID().withMessage('Invalid journal entry ID'),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const entry = await JournalEntryService.findByIdWithPlant(req.params.id, req.user!.id);

      if (!entry) {
        return res.status(404).json({
          error: 'Journal entry not found',
        });
      }

      await JournalEntryService.delete(entry);

      return res.json({
        message: 'Journal entry deleted successfully',
      });
    } catch (error) {
      logApi.error('Delete journal entry error', {
        userId: req.user!.id,
        journalId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Error deleting journal entry',
      });
    }
  }
);

export default router;
