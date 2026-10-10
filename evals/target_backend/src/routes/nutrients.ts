import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateJWT } from '../middleware';
import { NutrientService } from '../services/NutrientService';
import { logApi } from '../services/logging/logger';

const router: Router = Router();

// Validation middleware
const validateNutrientCreate = [
  body('brand')
    .trim()
    .notEmpty()
    .withMessage('Brand is required')
    .isLength({ max: 100 })
    .withMessage('Brand must be 100 characters or less'),
  body('product_name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ max: 255 })
    .withMessage('Product name must be 255 characters or less'),
  body('type')
    .isIn(['base', 'supplement', 'additive', 'ph_adjuster', 'other'])
    .withMessage('Type must be one of: base, supplement, additive, ph_adjuster, other'),
  body('npk_ratio')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('NPK ratio must be 20 characters or less'),
  body('description').optional().trim(),
  body('is_organic')
    .optional()
    .isBoolean()
    .withMessage('is_organic must be a boolean'),
];

const validateNutrientUpdate = [
  param('id').isUUID().withMessage('Invalid nutrient ID'),
  body('brand')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Brand cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Brand must be 100 characters or less'),
  body('product_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Product name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Product name must be 255 characters or less'),
  body('type')
    .optional()
    .isIn(['base', 'supplement', 'additive', 'ph_adjuster', 'other'])
    .withMessage('Type must be one of: base, supplement, additive, ph_adjuster, other'),
  body('npk_ratio')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('NPK ratio must be 20 characters or less'),
  body('description').optional().trim(),
  body('is_organic')
    .optional()
    .isBoolean()
    .withMessage('is_organic must be a boolean'),
];

// Get all nutrients (system + user's custom)
router.get(
  '/',
  authenticateJWT,
  [
    query('brand').optional().trim(),
    query('type')
      .optional()
      .isIn(['base', 'supplement', 'additive', 'ph_adjuster', 'other'])
      .withMessage('Invalid type'),
    query('is_organic')
      .optional()
      .isBoolean()
      .withMessage('is_organic must be a boolean'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('Limit must be between 1 and 200'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be 0 or greater'),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const filters = {
        brand: req.query.brand as string | undefined,
        type: req.query.type as string | undefined,
        is_organic: req.query.is_organic === 'true' ? true : req.query.is_organic === 'false' ? false : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      };

      const nutrients = await NutrientService.findAll(req.user!.id, filters);
      // Wrap in an object so the response matches the frontend `NutrientsResponse`
      // contract ({ nutrients: [...] }); returning a bare array left the picker empty.
      return res.status(200).json({ nutrients });
    } catch (error) {
      logApi.error('Error fetching nutrients', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch nutrients' });
    }
  }
);

// Create custom nutrient
router.post(
  '/',
  authenticateJWT,
  validateNutrientCreate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const nutrient = await NutrientService.create(req.user!.id, req.body);

      logApi.info('Nutrient created', {
        userId: req.user!.id,
        nutrientId: nutrient.id,
        productName: nutrient.product_name,
      });

      return res.status(201).json(nutrient);
    } catch (error) {
      logApi.error('Error creating nutrient', {
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to create nutrient' });
    }
  }
);

// Get single nutrient by ID
router.get(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid nutrient ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const nutrient = await NutrientService.findById(req.params.id);

      if (!nutrient) {
        return res.status(404).json({ error: 'Nutrient not found' });
      }

      // Check if user has access (system nutrient or their own custom nutrient)
      if (!NutrientService.isSystemNutrient(nutrient) && nutrient.user_id !== req.user!.id) {
        return res.status(404).json({ error: 'Nutrient not found' });
      }

      return res.status(200).json(nutrient);
    } catch (error) {
      logApi.error('Error fetching nutrient', {
        nutrientId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch nutrient' });
    }
  }
);

// Update custom nutrient
router.put(
  '/:id',
  authenticateJWT,
  validateNutrientUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const nutrient = await NutrientService.findById(req.params.id);

      if (!nutrient) {
        return res.status(404).json({ error: 'Nutrient not found' });
      }

      // Check if system nutrient
      if (NutrientService.isSystemNutrient(nutrient)) {
        return res.status(403).json({ error: 'Cannot modify system nutrients' });
      }

      // Check ownership
      if (!NutrientService.canModify(nutrient, req.user!.id)) {
        return res.status(404).json({ error: 'Nutrient not found' });
      }

      await NutrientService.update(nutrient, req.body);

      logApi.info('Nutrient updated', {
        userId: req.user!.id,
        nutrientId: nutrient.id,
      });

      return res.status(200).json(nutrient);
    } catch (error) {
      logApi.error('Error updating nutrient', {
        nutrientId: req.params.id,
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to update nutrient' });
    }
  }
);

// Delete custom nutrient
router.delete(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid nutrient ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const nutrient = await NutrientService.findById(req.params.id);

      if (!nutrient) {
        return res.status(404).json({ error: 'Nutrient not found' });
      }

      // Check if system nutrient
      if (NutrientService.isSystemNutrient(nutrient)) {
        return res.status(403).json({ error: 'Cannot delete system nutrients' });
      }

      // Check ownership
      if (!NutrientService.canModify(nutrient, req.user!.id)) {
        return res.status(404).json({ error: 'Nutrient not found' });
      }

      await NutrientService.delete(nutrient);

      logApi.info('Nutrient deleted', {
        userId: req.user!.id,
        nutrientId: nutrient.id,
      });

      return res.status(200).json({ message: 'Nutrient deleted successfully' });
    } catch (error) {
      logApi.error('Error deleting nutrient', {
        nutrientId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to delete nutrient' });
    }
  }
);

export default router;
