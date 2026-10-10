import { Router, Request, Response } from 'express';
import { body, param, validationResult, query } from 'express-validator';
import { authenticateJWT } from '../middleware';
import { GrowEnvironmentService } from '../services/GrowEnvironmentService';
import { EnvironmentOverviewService } from '../services/EnvironmentOverviewService';
import { logApi } from '../services/logging/logger';

const router: Router = Router();

// Validation middleware
const validateEnvironmentCreate = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name must be 100 characters or less'),
  body('type')
    .isIn(['tent', 'room', 'closet', 'outdoor', 'greenhouse'])
    .withMessage('Type must be one of: tent, room, closet, outdoor, greenhouse'),
  body('width_inches')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Width must be at least 1 inch'),
  body('depth_inches')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Depth must be at least 1 inch'),
  body('height_inches')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Height must be at least 1 inch'),
  body('light_type')
    .optional()
    .isIn(['led', 'hps', 'mh', 'cfl', 'sun', 'other'])
    .withMessage('Light type must be one of: led, hps, mh, cfl, sun, other'),
  body('light_wattage')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Light wattage must be a positive integer'),
  body('ventilation_cfm')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Ventilation CFM must be a positive integer'),
  body('has_carbon_filter')
    .optional()
    .isBoolean()
    .withMessage('has_carbon_filter must be a boolean'),
  body('has_humidifier')
    .optional()
    .isBoolean()
    .withMessage('has_humidifier must be a boolean'),
  body('has_dehumidifier')
    .optional()
    .isBoolean()
    .withMessage('has_dehumidifier must be a boolean'),
  body('has_ac')
    .optional()
    .isBoolean()
    .withMessage('has_ac must be a boolean'),
  body('has_heater')
    .optional()
    .isBoolean()
    .withMessage('has_heater must be a boolean'),
  body('max_plants')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max plants must be at least 1'),
  body('notes').optional().trim(),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
];

const validateEnvironmentUpdate = [
  param('id').isUUID().withMessage('Invalid environment ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Name must be 100 characters or less'),
  body('type')
    .optional()
    .isIn(['tent', 'room', 'closet', 'outdoor', 'greenhouse'])
    .withMessage('Type must be one of: tent, room, closet, outdoor, greenhouse'),
  body('width_inches')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Width must be at least 1 inch'),
  body('depth_inches')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Depth must be at least 1 inch'),
  body('height_inches')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Height must be at least 1 inch'),
  body('light_type')
    .optional()
    .isIn(['led', 'hps', 'mh', 'cfl', 'sun', 'other'])
    .withMessage('Light type must be one of: led, hps, mh, cfl, sun, other'),
  body('light_wattage')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Light wattage must be a positive integer'),
  body('ventilation_cfm')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Ventilation CFM must be a positive integer'),
  body('has_carbon_filter')
    .optional()
    .isBoolean()
    .withMessage('has_carbon_filter must be a boolean'),
  body('has_humidifier')
    .optional()
    .isBoolean()
    .withMessage('has_humidifier must be a boolean'),
  body('has_dehumidifier')
    .optional()
    .isBoolean()
    .withMessage('has_dehumidifier must be a boolean'),
  body('has_ac')
    .optional()
    .isBoolean()
    .withMessage('has_ac must be a boolean'),
  body('has_heater')
    .optional()
    .isBoolean()
    .withMessage('has_heater must be a boolean'),
  body('max_plants')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max plants must be at least 1'),
  body('notes').optional().trim(),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
];

// GET /api/grow-environments - List user's environments
router.get(
  '/',
  authenticateJWT,
  [
    query('type')
      .optional()
      .isIn(['tent', 'room', 'closet', 'outdoor', 'greenhouse'])
      .withMessage('Invalid type'),
    query('is_active')
      .optional()
      .isBoolean()
      .withMessage('is_active must be a boolean'),
    query('name').optional().trim(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
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

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const filters = {
        type: req.query.type as string | undefined,
        is_active: req.query.is_active ? req.query.is_active === 'true' : undefined,
        name: req.query.name as string | undefined,
        limit,
        offset,
      };

      const { environments, total } = await GrowEnvironmentService.findAllByUser(
        req.user!.id,
        filters
      );
      return res.status(200).json({ environments, total, limit, offset });
    } catch (error) {
      logApi.error('Error fetching grow environments', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch grow environments' });
    }
  }
);

// POST /api/grow-environments - Create new environment
router.post(
  '/',
  authenticateJWT,
  validateEnvironmentCreate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const environment = await GrowEnvironmentService.create(req.user!.id, req.body);

      logApi.info('Grow environment created', {
        userId: req.user!.id,
        environmentId: environment.id,
        environmentName: environment.name,
      });

      return res.status(201).json({ data: environment });
    } catch (error) {
      logApi.error('Error creating grow environment', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to create grow environment' });
    }
  }
);

// GET /api/grow-environments/:id - Get single environment
router.get(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid environment ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const environment = await GrowEnvironmentService.findByIdAndUser(
        req.params.id,
        req.user!.id
      );

      if (!environment) {
        return res.status(404).json({ error: 'Grow environment not found' });
      }

      return res.status(200).json({ data: environment });
    } catch (error) {
      logApi.error('Error fetching grow environment', {
        userId: req.user?.id,
        environmentId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch grow environment' });
    }
  }
);

// PUT /api/grow-environments/:id - Update environment
router.put(
  '/:id',
  authenticateJWT,
  validateEnvironmentUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const environment = await GrowEnvironmentService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );

      if (!environment) {
        return res.status(404).json({ error: 'Grow environment not found' });
      }

      const updated = await GrowEnvironmentService.update(environment, req.body);

      logApi.info('Grow environment updated', {
        userId: req.user!.id,
        environmentId: environment.id,
      });

      return res.status(200).json({ data: updated });
    } catch (error) {
      logApi.error('Error updating grow environment', {
        userId: req.user?.id,
        environmentId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to update grow environment' });
    }
  }
);

// DELETE /api/grow-environments/:id - Delete environment
router.delete(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid environment ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const environment = await GrowEnvironmentService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );

      if (!environment) {
        return res.status(404).json({ error: 'Grow environment not found' });
      }

      await GrowEnvironmentService.delete(environment);

      logApi.info('Grow environment deleted', {
        userId: req.user!.id,
        environmentId: environment.id,
      });

      return res.status(204).send();
    } catch (error) {
      logApi.error('Error deleting grow environment', {
        userId: req.user?.id,
        environmentId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to delete grow environment' });
    }
  }
);

// GET /api/grow-environments/:id/grows - Get grows in environment
router.get(
  '/:id/grows',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid environment ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const grows = await GrowEnvironmentService.getGrowsInEnvironment(
        req.params.id,
        req.user!.id
      );

      return res.status(200).json({ data: grows });
    } catch (error) {
      if (error instanceof Error && error.message === 'Environment not found') {
        return res.status(404).json({ error: 'Grow environment not found' });
      }

      logApi.error('Error fetching grows for environment', {
        userId: req.user?.id,
        environmentId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch grows for environment' });
    }
  }
);

// POST /api/grow-environments/check-capacity - Check projected capacity
router.post(
  '/check-capacity',
  authenticateJWT,
  [
    body('environmentId')
      .isUUID()
      .withMessage('Environment ID must be a valid UUID'),
    body('additionalPlants')
      .isInt({ min: 1 })
      .withMessage('Additional plants must be a positive integer'),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { environmentId, additionalPlants } = req.body;

      const result = await GrowEnvironmentService.checkCapacity(
        environmentId,
        additionalPlants,
        req.user!.id
      );

      logApi.info('Capacity check performed', {
        userId: req.user!.id,
        environmentId,
        additionalPlants,
        status: result.status,
      });

      return res.status(200).json({ data: result });
    } catch (error) {
      if (error instanceof Error && error.message === 'Environment not found') {
        return res.status(404).json({ error: 'Grow environment not found' });
      }

      logApi.error('Error checking capacity', {
        userId: req.user?.id,
        environmentId: req.body.environmentId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to check capacity' });
    }
  }
);

// GET /api/grow-environments/:id/capacity - Get current capacity for environment
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
        return res.status(404).json({ error: 'Grow environment not found' });
      }

      logApi.info('Environment capacity fetched', {
        userId: req.user!.id,
        environmentId: req.params.id,
        status: capacity.capacityStatus,
      });

      return res.status(200).json({ data: capacity });
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
