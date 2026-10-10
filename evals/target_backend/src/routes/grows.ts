import { Router, Request, Response } from 'express';
import { body, param, validationResult, query } from 'express-validator';
import { authenticateJWT } from '../middleware';
import { GrowService } from '../services/GrowService';
import { GrowLogService } from '../services/GrowLogService';
import { GrowNutrientService } from '../services/GrowNutrientService';
import { GrowHarvestService } from '../services/GrowHarvestService';
import {
  FeedingScheduleService,
  FeedingScheduleConflictError,
} from '../services/FeedingScheduleService';
import { FeedEventService } from '../services/FeedEventService';
import { FeedingDigestService } from '../services/FeedingDigestService';
import { queueAITask } from '../services/queue';
import { analysisLimitService } from '../services/analysisLimitService';
import { logApi } from '../services/logging/logger';

const router: Router = Router();

// Validation middleware
const validateGrowCreate = [
  body('strain_name')
    .trim()
    .notEmpty()
    .withMessage('Strain name is required')
    .isLength({ max: 255 })
    .withMessage('Strain name must be 255 characters or less'),
  body('started_at').isISO8601().withMessage('Started at must be a valid date'),
  body('strain_type')
    .optional({ nullable: true })
    .isIn(['indica', 'sativa', 'hybrid', 'ruderalis'])
    .withMessage(
      'Strain type must be one of: indica, sativa, hybrid, ruderalis'
    ),
  body('grow_method')
    .optional({ nullable: true })
    .isIn(['soil', 'coco', 'hydro', 'dwc', 'aero', 'other'])
    .withMessage(
      'Grow method must be one of: soil, coco, hydro, dwc, aero, other'
    ),
  body('grow_medium')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Grow medium must be 100 characters or less'),
  body('light_type')
    .optional({ nullable: true })
    .isIn(['led', 'hps', 'mh', 'cfl', 'sun', 'other'])
    .withMessage('Light type must be one of: led, hps, mh, cfl, sun, other'),
  body('light_wattage')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Light wattage must be a positive integer'),
  body('grow_space_sqft')
    .optional({ nullable: true })
    .isFloat({ min: 0.1 })
    .withMessage('Grow space must be greater than 0'),
  body('pot_size_gallons')
    .optional({ nullable: true })
    .isFloat({ min: 0.1 })
    .withMessage('Pot size must be greater than 0'),
  body('plant_count')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Plant count must be at least 1'),
  body('notes').optional({ nullable: true }).trim(),
  body('is_public')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('is_public must be a boolean'),
];

const validateGrowUpdate = [
  param('id').isUUID().withMessage('Invalid grow ID'),
  body('strain_name')
    .optional({ nullable: true })
    .trim()
    .notEmpty()
    .withMessage('Strain name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Strain name must be 255 characters or less'),
  body('started_at')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('Started at must be a valid date'),
  body('strain_type')
    .optional({ nullable: true })
    .isIn(['indica', 'sativa', 'hybrid', 'ruderalis'])
    .withMessage(
      'Strain type must be one of: indica, sativa, hybrid, ruderalis'
    ),
  body('grow_method')
    .optional({ nullable: true })
    .isIn(['soil', 'coco', 'hydro', 'dwc', 'aero', 'other'])
    .withMessage(
      'Grow method must be one of: soil, coco, hydro, dwc, aero, other'
    ),
  body('grow_medium')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Grow medium must be 100 characters or less'),
  body('light_type')
    .optional({ nullable: true })
    .isIn(['led', 'hps', 'mh', 'cfl', 'sun', 'other'])
    .withMessage('Light type must be one of: led, hps, mh, cfl, sun, other'),
  body('light_wattage')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Light wattage must be a positive integer'),
  body('grow_space_sqft')
    .optional({ nullable: true })
    .isFloat({ min: 0.1 })
    .withMessage('Grow space must be greater than 0'),
  body('pot_size_gallons')
    .optional({ nullable: true })
    .isFloat({ min: 0.1 })
    .withMessage('Pot size must be greater than 0'),
  body('plant_count')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Plant count must be at least 1'),
  body('notes').optional({ nullable: true }).trim(),
  body('is_public')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('is_public must be a boolean'),
  body('harvested_at')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('Harvested at must be a valid date'),
];

const validatePhaseUpdate = [
  param('id').isUUID().withMessage('Invalid grow ID'),
  body('phase')
    .isIn(['germination', 'vegetative', 'flowering', 'harvest', 'archived'])
    .withMessage(
      'Phase must be one of: germination, vegetative, flowering, harvest, archived'
    ),
];

const validateLogCreate = [
  param('id').isUUID().withMessage('Invalid grow ID'),
  body('logged_at').isISO8601().withMessage('Logged at must be a valid date'),
  body('day_number')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('Day number must be 0 or greater'),
  body('phase')
    .optional({ nullable: true })
    .isIn(['germination', 'vegetative', 'flowering', 'harvest'])
    .withMessage(
      'Phase must be one of: germination, vegetative, flowering, harvest'
    ),
  body('height_inches')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Height must be 0 or greater'),
  body('notes').optional({ nullable: true }).trim(),
  body('environment')
    .optional({ nullable: true })
    .isObject()
    .withMessage('Environment must be an object'),
  body('environment.temperature_f')
    .optional({ nullable: true })
    .isFloat({ min: -50, max: 150 })
    .withMessage('Temperature must be between -50 and 150°F'),
  body('environment.humidity_percent')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('Humidity must be between 0 and 100'),
  body('environment.ph')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 14 })
    .withMessage('pH must be between 0 and 14'),
  body('environment.ec')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('EC must be 0 or greater'),
  body('environment.ppm')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('PPM must be 0 or greater'),
  body('environment.co2_ppm')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('CO2 PPM must be 0 or greater'),
  body('environment.light_hours')
    .optional({ nullable: true })
    .isInt({ min: 0, max: 24 })
    .withMessage('Light hours must be between 0 and 24'),
  body('environment.light_distance_inches')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Light distance must be 0 or greater'),
  body('environment.vpd')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('VPD must be 0 or greater'),
];

const validateNutrientAdd = [
  param('id').isUUID().withMessage('Invalid grow ID'),
  body('nutrient_id')
    .isUUID()
    .withMessage('Nutrient ID is required and must be a valid UUID'),
  body('dosage_ml_per_gallon')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Dosage must be 0 or greater'),
  body('frequency')
    .optional({ nullable: true })
    .isIn(['every_watering', 'weekly', 'biweekly', 'as_needed'])
    .withMessage(
      'Frequency must be one of: every_watering, weekly, biweekly, as_needed'
    ),
  body('phase_used')
    .optional({ nullable: true })
    .isIn(['all', 'vegetative', 'flowering', 'late_flowering'])
    .withMessage(
      'Phase used must be one of: all, vegetative, flowering, late_flowering'
    ),
  body('notes').optional({ nullable: true }).trim(),
];

const validateHarvestCreate = [
  param('id').isUUID().withMessage('Invalid grow ID'),
  body('harvested_at')
    .isISO8601()
    .withMessage('Harvested at must be a valid date'),
  body('wet_weight_grams')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Wet weight must be 0 or greater'),
  body('dry_weight_grams')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Dry weight must be 0 or greater'),
  body('trim_weight_grams')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Trim weight must be 0 or greater'),
  body('thc_percent')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('THC percentage must be between 0 and 100'),
  body('cbd_percent')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('CBD percentage must be between 0 and 100'),
  body('terpene_profile')
    .optional({ nullable: true })
    .isObject()
    .withMessage('Terpene profile must be an object'),
  body('cure_days')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('Cure days must be 0 or greater'),
  body('quality_rating')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 10 })
    .withMessage('Quality rating must be between 1 and 10'),
  body('smoke_report').optional().trim(),
];

const validateHarvestUpdate = [
  param('id').isUUID().withMessage('Invalid grow ID'),
  body('harvested_at')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('Harvested at must be a valid date'),
  body('wet_weight_grams')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Wet weight must be 0 or greater'),
  body('dry_weight_grams')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Dry weight must be 0 or greater'),
  body('trim_weight_grams')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Trim weight must be 0 or greater'),
  body('thc_percent')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('THC percentage must be between 0 and 100'),
  body('cbd_percent')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('CBD percentage must be between 0 and 100'),
  body('terpene_profile')
    .optional({ nullable: true })
    .isObject()
    .withMessage('Terpene profile must be an object'),
  body('cure_days')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('Cure days must be 0 or greater'),
  body('quality_rating')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 10 })
    .withMessage('Quality rating must be between 1 and 10'),
  body('smoke_report').optional().trim(),
];

// Get all grows for user
router.get(
  '/',
  authenticateJWT,
  [
    query('phase')
      .optional({ nullable: true })
      .isIn(['germination', 'vegetative', 'flowering', 'harvest', 'archived'])
      .withMessage('Invalid phase'),
    query('strain_name').optional().trim(),
    query('limit')
      .optional({ nullable: true })
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional({ nullable: true })
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
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : 0;

      const filters = {
        phase: req.query.phase as string | undefined,
        strain_name: req.query.strain_name as string | undefined,
        limit,
        offset,
      };

      const { grows, total } = await GrowService.findAllByUser(
        req.user!.id,
        filters
      );
      return res.status(200).json({ grows, total, limit, offset });
    } catch (error) {
      logApi.error('Error fetching grows', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch grows' });
    }
  }
);

// Create grow
router.post(
  '/',
  authenticateJWT,
  validateGrowCreate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const grow = await GrowService.create(req.user!.id, req.body);

      logApi.info('Grow created', {
        userId: req.user!.id,
        growId: grow.id,
        strainName: grow.strain_name,
      });

      return res.status(201).json(grow);
    } catch (error) {
      logApi.error('Error creating grow', {
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to create grow' });
    }
  }
);

// Get single grow by ID
router.get(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid grow ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const grow = await GrowService.findByIdAndUser(
        req.params.id,
        req.user!.id
      );

      if (!grow) {
        return res.status(404).json({ error: 'Grow not found' });
      }

      return res.status(200).json(grow.toJSON());
    } catch (error) {
      logApi.error('Error fetching grow', {
        growId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch grow' });
    }
  }
);

// Update grow
router.put(
  '/:id',
  authenticateJWT,
  validateGrowUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const grow = await GrowService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );

      if (!grow) {
        return res.status(404).json({ error: 'Grow not found' });
      }

      await GrowService.update(grow, req.body);

      logApi.info('Grow updated', {
        userId: req.user!.id,
        growId: grow.id,
      });

      return res.status(200).json(grow.toJSON());
    } catch (error) {
      logApi.error('Error updating grow', {
        growId: req.params.id,
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to update grow' });
    }
  }
);

// Delete grow
router.delete(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid grow ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const grow = await GrowService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );

      if (!grow) {
        return res.status(404).json({ error: 'Grow not found' });
      }

      await GrowService.delete(grow);

      logApi.info('Grow deleted', {
        userId: req.user!.id,
        growId: grow.id,
      });

      return res.status(200).json({ message: 'Grow deleted successfully' });
    } catch (error) {
      logApi.error('Error deleting grow', {
        growId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to delete grow' });
    }
  }
);

// Update grow phase
router.put(
  '/:id/phase',
  authenticateJWT,
  validatePhaseUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const grow = await GrowService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );

      if (!grow) {
        return res.status(404).json({ error: 'Grow not found' });
      }

      await GrowService.updatePhase(grow, req.body.phase);

      logApi.info('Grow phase updated', {
        userId: req.user!.id,
        growId: grow.id,
        phase: req.body.phase,
      });

      return res.status(200).json(grow.toJSON());
    } catch (error) {
      logApi.error('Error updating grow phase', {
        growId: req.params.id,
        userId: req.user?.id,
        phase: req.body.phase,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to update grow phase' });
    }
  }
);

// Get logs for grow
router.get(
  '/:id/logs',
  authenticateJWT,
  [
    param('id').isUUID().withMessage('Invalid grow ID'),
    query('phase')
      .optional({ nullable: true })
      .isIn(['germination', 'vegetative', 'flowering', 'harvest'])
      .withMessage('Invalid phase'),
    query('limit')
      .optional({ nullable: true })
      .isInt({ min: 1, max: 200 })
      .withMessage('Limit must be between 1 and 200'),
    query('offset')
      .optional({ nullable: true })
      .isInt({ min: 0 })
      .withMessage('Offset must be 0 or greater'),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify grow ownership
      const grow = await GrowService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );
      if (!grow) {
        return res.status(404).json({ error: 'Grow not found' });
      }

      const filters = {
        phase: req.query.phase as string | undefined,
        limit: req.query.limit
          ? parseInt(req.query.limit as string)
          : undefined,
        offset: req.query.offset
          ? parseInt(req.query.offset as string)
          : undefined,
      };

      const logs = await GrowLogService.findByGrow(req.params.id, filters);
      // Wrap to match the frontend `GrowLogsResponse` contract ({ logs, total,
      // limit, offset }); returning a bare array left the timeline always empty.
      return res.status(200).json({
        logs,
        total: logs.length,
        limit: filters.limit ?? logs.length,
        offset: filters.offset ?? 0,
      });
    } catch (error) {
      logApi.error('Error fetching grow logs', {
        growId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch grow logs' });
    }
  }
);

// Create log for grow
router.post(
  '/:id/logs',
  authenticateJWT,
  validateLogCreate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify grow ownership
      const grow = await GrowService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );
      if (!grow) {
        return res.status(404).json({ error: 'Grow not found' });
      }

      const log = await GrowLogService.create(req.params.id, req.body);

      logApi.info('Grow log created', {
        userId: req.user!.id,
        growId: req.params.id,
        logId: log.id,
      });

      return res.status(201).json(log.toJSON());
    } catch (error) {
      logApi.error('Error creating grow log', {
        growId: req.params.id,
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to create grow log' });
    }
  }
);

// Get a grow's weekly feeding schedule (weeks annotated with calendar dates)
router.get(
  '/:id/feeding-schedule',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid grow ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const grow = await GrowService.findByIdAndUserSimple(req.params.id, req.user!.id);
      if (!grow) return res.status(404).json({ error: 'Grow not found' });

      const schedule = await FeedingScheduleService.getGrowFeedingSchedule(grow.id);
      if (!schedule) return res.json({ feedingSchedule: null });

      const json: any = schedule.toJSON();
      json.weeks = FeedingScheduleService.deriveWeekDates(
        (grow as any).started_at,
        json.weeks || [],
        {
          countingMode: json.week_counting_mode,
          flowerStartWeek: json.flower_start_week,
          flipDate:
            (grow as any).phase === 'flowering' ? (grow as any).phase_started_at : null,
        }
      );
      return res.json({ feedingSchedule: json });
    } catch (error) {
      logApi.error('Error fetching grow feeding schedule', {
        growId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to fetch feeding schedule' });
    }
  }
);

// Replace a grow's weekly feeding schedule (template-less editing)
router.put(
  '/:id/feeding-schedule',
  authenticateJWT,
  [
    param('id').isUUID().withMessage('Invalid grow ID'),
    body('weeks').isArray().withMessage('weeks must be an array'),
    body('weeks.*.week_number').optional().isInt({ min: 1 }),
    body('weeks.*.ec_min').optional({ nullable: true }).isFloat({ min: 0 }),
    body('weeks.*.ec_max').optional({ nullable: true }).isFloat({ min: 0 }),
    body('weeks.*.ppm_min').optional({ nullable: true }).isInt({ min: 0 }),
    body('weeks.*.ppm_max').optional({ nullable: true }).isInt({ min: 0 }),
    body('weeks.*.ph_min').optional({ nullable: true }).isFloat({ min: 0, max: 14 }),
    body('weeks.*.ph_max').optional({ nullable: true }).isFloat({ min: 0, max: 14 }),
    body('weeks.*.is_flush').optional().isBoolean(),
    body('weeks.*.is_water_only').optional().isBoolean(),
    body('weeks.*.nutrients').optional({ nullable: true }).isArray(),
    body('weeks.*.nutrients.*.nutrient_id').optional().isUUID(),
    body('weeks.*.nutrients.*.dosage_ml_per_gallon').optional({ nullable: true }).isFloat({ min: 0 }),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const grow = await GrowService.findByIdAndUserSimple(req.params.id, req.user!.id);
      if (!grow) return res.status(404).json({ error: 'Grow not found' });

      const schedule = await FeedingScheduleService.replaceGrowFeedingSchedule(
        grow.id,
        req.body.weeks
      );
      const json: any = schedule!.toJSON();
      json.weeks = FeedingScheduleService.deriveWeekDates(
        (grow as any).started_at,
        json.weeks || [],
        {
          countingMode: json.week_counting_mode,
          flowerStartWeek: json.flower_start_week,
          flipDate:
            (grow as any).phase === 'flowering' ? (grow as any).phase_started_at : null,
        }
      );
      return res.json({ feedingSchedule: json });
    } catch (error) {
      logApi.error('Error replacing grow feeding schedule', {
        growId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to update feeding schedule' });
    }
  }
);

// Apply a feeding-schedule template to a grow (snapshot copy)
router.post(
  '/:id/feeding-schedule/apply',
  authenticateJWT,
  [
    param('id').isUUID().withMessage('Invalid grow ID'),
    body('template_id').isUUID().withMessage('template_id must be a UUID'),
    body('overwrite').optional().isBoolean(),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const grow = await GrowService.findByIdAndUserSimple(req.params.id, req.user!.id);
      if (!grow) return res.status(404).json({ error: 'Grow not found' });

      const schedule = await FeedingScheduleService.applyTemplateToGrow(
        grow.id,
        req.user!.id,
        req.body.template_id,
        req.body.overwrite === true
      );
      if (!schedule) return res.status(404).json({ error: 'Template not found' });

      const json: any = schedule.toJSON();
      json.weeks = FeedingScheduleService.deriveWeekDates(
        (grow as any).started_at,
        json.weeks || [],
        {
          countingMode: json.week_counting_mode,
          flowerStartWeek: json.flower_start_week,
          flipDate:
            (grow as any).phase === 'flowering' ? (grow as any).phase_started_at : null,
        }
      );
      logApi.info('Feeding template applied to grow', {
        userId: req.user!.id,
        growId: grow.id,
        templateId: req.body.template_id,
      });
      return res.status(201).json({ feedingSchedule: json });
    } catch (error) {
      if (error instanceof FeedingScheduleConflictError) {
        return res
          .status(409)
          .json({ error: error.message, code: error.code });
      }
      logApi.error('Error applying feeding template to grow', {
        growId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to apply feeding template' });
    }
  }
);

// Update a grow feeding schedule's settings (strength multiplier, reservoir volume)
router.put(
  '/:id/feeding-schedule/settings',
  authenticateJWT,
  [
    param('id').isUUID().withMessage('Invalid grow ID'),
    body('strength_pct').optional({ nullable: true }).isInt({ min: 1, max: 100 }).withMessage('strength_pct must be 1-100'),
    body('reservoir_gallons').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('reservoir_gallons must be >= 0'),
    body('week_counting_mode').optional().isIn(['continuous', 'flip-reset', 'stage-based']).withMessage('Invalid week_counting_mode'),
    body('flower_start_week').optional({ nullable: true }).isInt({ min: 1 }).withMessage('flower_start_week must be >= 1'),
    body('ppm_scale').optional().isInt().withMessage('ppm_scale must be a number'),
    body('display_unit').optional().isString(),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const grow = await GrowService.findByIdAndUserSimple(req.params.id, req.user!.id);
      if (!grow) return res.status(404).json({ error: 'Grow not found' });

      const schedule = await FeedingScheduleService.updateGrowScheduleSettings(grow.id, {
        strength_pct: req.body.strength_pct,
        reservoir_gallons: req.body.reservoir_gallons,
        week_counting_mode: req.body.week_counting_mode,
        flower_start_week: req.body.flower_start_week,
        ppm_scale: req.body.ppm_scale,
        display_unit: req.body.display_unit,
      });
      if (!schedule) return res.status(404).json({ error: 'No feeding schedule for this grow' });

      const json: any = schedule.toJSON();
      json.weeks = FeedingScheduleService.deriveWeekDates(
        (grow as any).started_at,
        json.weeks || [],
        {
          countingMode: json.week_counting_mode,
          flowerStartWeek: json.flower_start_week,
          flipDate:
            (grow as any).phase === 'flowering' ? (grow as any).phase_started_at : null,
        }
      );
      return res.json({ feedingSchedule: json });
    } catch (error) {
      logApi.error('Error updating feeding schedule settings', {
        growId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to update feeding schedule settings' });
    }
  }
);

// "Feeding due today" across all of the user's active grows (for the agenda view)
router.get(
  '/feeding/today',
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const due = await FeedingDigestService.getFeedingDue(req.user!.id);
      return res.json({ due });
    } catch (error) {
      logApi.error('Error fetching feeding-due agenda', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to fetch feeding agenda' });
    }
  }
);

// List a grow's feed events (materializes one planned event per schedule week)
router.get(
  '/:id/feed-events',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid grow ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const grow = await GrowService.findByIdAndUserSimple(req.params.id, req.user!.id);
      if (!grow) return res.status(404).json({ error: 'Grow not found' });

      const events = await FeedEventService.listForGrow(grow.id);
      return res.json({ feedEvents: events.map((e) => e.toJSON()) });
    } catch (error) {
      logApi.error('Error listing grow feed events', {
        growId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to list feed events' });
    }
  }
);

// Mark a week's feed event done / skipped / planned (+ measured readings, back-date)
router.put(
  '/:id/feed-events/:weekNumber',
  authenticateJWT,
  [
    param('id').isUUID().withMessage('Invalid grow ID'),
    param('weekNumber').isInt({ min: 1 }).withMessage('weekNumber must be >= 1'),
    body('status').optional().isIn(['planned', 'done', 'skipped']).withMessage('Invalid status'),
    body('performed_at').optional({ nullable: true }).isISO8601().withMessage('performed_at must be a date'),
    body('measured_ec').optional({ nullable: true }).isFloat({ min: 0 }),
    body('measured_ppm').optional({ nullable: true }).isInt({ min: 0 }),
    body('measured_ph').optional({ nullable: true }).isFloat({ min: 0, max: 14 }),
    body('runoff_ec').optional({ nullable: true }).isFloat({ min: 0 }),
    body('runoff_ph').optional({ nullable: true }).isFloat({ min: 0, max: 14 }),
    body('notes').optional({ nullable: true }).isString(),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const grow = await GrowService.findByIdAndUserSimple(req.params.id, req.user!.id);
      if (!grow) return res.status(404).json({ error: 'Grow not found' });

      const event = await FeedEventService.markEvent(
        grow.id,
        parseInt(req.params.weekNumber, 10),
        {
          status: req.body.status,
          performed_at: req.body.performed_at,
          measured_ec: req.body.measured_ec,
          measured_ppm: req.body.measured_ppm,
          measured_ph: req.body.measured_ph,
          runoff_ec: req.body.runoff_ec,
          runoff_ph: req.body.runoff_ph,
          notes: req.body.notes,
        }
      );
      if (!event) {
        return res.status(404).json({ error: 'No feeding schedule or week for this grow' });
      }
      return res.json({ feedEvent: event.toJSON() });
    } catch (error) {
      logApi.error('Error marking feed event', {
        growId: req.params.id,
        weekNumber: req.params.weekNumber,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to update feed event' });
    }
  }
);

// Get nutrients for grow
router.get(
  '/:id/nutrients',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid grow ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify grow ownership
      const grow = await GrowService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );
      if (!grow) {
        return res.status(404).json({ error: 'Grow not found' });
      }

      const nutrients = await GrowNutrientService.findByGrow(req.params.id);
      return res.status(200).json(nutrients);
    } catch (error) {
      logApi.error('Error fetching grow nutrients', {
        growId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch grow nutrients' });
    }
  }
);

// Add nutrient to grow
router.post(
  '/:id/nutrients',
  authenticateJWT,
  validateNutrientAdd,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify grow ownership
      const grow = await GrowService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );
      if (!grow) {
        return res.status(404).json({ error: 'Grow not found' });
      }

      // Verify nutrient exists
      const nutrientExists = await GrowNutrientService.verifyNutrientExists(
        req.body.nutrient_id
      );
      if (!nutrientExists) {
        return res.status(404).json({ error: 'Nutrient not found' });
      }

      // Check if already added
      const alreadyAdded = await GrowNutrientService.exists(
        req.params.id,
        req.body.nutrient_id
      );
      if (alreadyAdded) {
        return res
          .status(409)
          .json({ error: 'Nutrient already added to this grow' });
      }

      const growNutrient = await GrowNutrientService.add(
        req.params.id,
        req.body
      );

      logApi.info('Nutrient added to grow', {
        userId: req.user!.id,
        growId: req.params.id,
        nutrientId: req.body.nutrient_id,
      });

      return res.status(201).json(growNutrient.toJSON());
    } catch (error) {
      logApi.error('Error adding nutrient to grow', {
        growId: req.params.id,
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to add nutrient to grow' });
    }
  }
);

// Get harvest for grow
router.get(
  '/:id/harvest',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid grow ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify grow ownership
      const grow = await GrowService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );
      if (!grow) {
        return res.status(404).json({ error: 'Grow not found' });
      }

      // No harvest yet is a normal state, not an error.
      const harvest = await GrowHarvestService.findByGrow(req.params.id);
      return res.status(200).json({ harvest: harvest ? harvest.toJSON() : null });
    } catch (error) {
      logApi.error('Error fetching grow harvest', {
        growId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch grow harvest' });
    }
  }
);

// Create harvest for grow
router.post(
  '/:id/harvest',
  authenticateJWT,
  validateHarvestCreate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify grow ownership
      const grow = await GrowService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );
      if (!grow) {
        return res.status(404).json({ error: 'Grow not found' });
      }

      // Check if harvest already exists
      const harvestExists = await GrowHarvestService.exists(req.params.id);
      if (harvestExists) {
        return res
          .status(409)
          .json({ error: 'Harvest already recorded for this grow' });
      }

      const harvest = await GrowHarvestService.create(req.params.id, req.body);

      // Recording a harvest marks the grow harvested.
      if (req.body.harvested_at) {
        await GrowService.update(grow, { harvested_at: new Date(req.body.harvested_at) });
      }

      logApi.info('Harvest created', {
        userId: req.user!.id,
        growId: req.params.id,
        harvestId: harvest.id,
      });

      return res.status(201).json({ harvest: harvest.toJSON() });
    } catch (error) {
      logApi.error('Error creating harvest', {
        growId: req.params.id,
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to create harvest' });
    }
  }
);

// Update harvest for grow
router.put(
  '/:id/harvest',
  authenticateJWT,
  validateHarvestUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify grow ownership
      const grow = await GrowService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );
      if (!grow) {
        return res.status(404).json({ error: 'Grow not found' });
      }

      const harvest = await GrowHarvestService.findByGrow(req.params.id);
      if (!harvest) {
        return res
          .status(404)
          .json({ error: 'No harvest found for this grow' });
      }

      await GrowHarvestService.update(harvest, req.body);

      if (req.body.harvested_at) {
        await GrowService.update(grow, { harvested_at: new Date(req.body.harvested_at) });
      }

      logApi.info('Harvest updated', {
        userId: req.user!.id,
        growId: req.params.id,
        harvestId: harvest.id,
      });

      return res.status(200).json({ harvest: harvest.toJSON() });
    } catch (error) {
      logApi.error('Error updating harvest', {
        growId: req.params.id,
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to update harvest' });
    }
  }
);

/**
 * POST /api/grows/:id/analyze
 * Queue grow analysis or nutrient recommendation job
 *
 * Queues an AI-powered analysis job for the specified grow.
 * Returns 202 Accepted with job ID. User will be notified via WebSocket when complete.
 *
 * Optional request body:
 * - type: 'general' | 'nutrients' | 'diagnosis' | 'optimization' | 'harvest_timing' (default: 'general')
 *   - If type='nutrients', routes to nutrient recommendation service
 *   - All other types route to grow analysis service
 * - recommendationType: 'full_schedule' | 'phase_adjustment' | 'deficiency_fix' | 'optimization' (for nutrients only, default: 'full_schedule')
 * - goal: 'yield' | 'quality' | 'balanced' (for nutrients only, default: 'balanced')
 * - deficiency: string (for nutrients with recommendationType='deficiency_fix')
 *
 * Responses:
 * - 202: Analysis queued successfully
 * - 400: Invalid request (bad UUID or analysis type)
 * - 401: Not authenticated
 * - 403: Feature disabled
 * - 404: Grow not found
 * - 409: Analysis already pending
 * - 429: Daily limit exceeded
 * - 500: Server error
 */
router.post(
  '/:id/analyze',
  authenticateJWT,
  [
    param('id').isUUID().withMessage('Invalid grow ID'),
    body('type')
      .optional({ nullable: true })
      .isIn([
        'general',
        'nutrients',
        'diagnosis',
        'optimization',
        'harvest_timing',
      ])
      .withMessage(
        'Analysis type must be one of: general, nutrients, diagnosis, optimization, harvest_timing'
      ),
    body('recommendationType')
      .optional({ nullable: true })
      .isIn([
        'full_schedule',
        'phase_adjustment',
        'deficiency_fix',
        'optimization',
      ])
      .withMessage(
        'Recommendation type must be one of: full_schedule, phase_adjustment, deficiency_fix, optimization'
      ),
    body('goal')
      .optional({ nullable: true })
      .isIn(['yield', 'quality', 'balanced'])
      .withMessage('Goal must be one of: yield, quality, balanced'),
    body('deficiency')
      .optional({ nullable: true })
      .isString()
      .withMessage('Deficiency must be a string'),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logApi.warn('Validation errors in grow analyze request', {
        userId: req.user?.id,
        growId: req.params.id,
        errors: errors.array(),
      });
      return res.status(400).json({ errors: errors.array() });
    }

    const growId = req.params.id;
    const userId = req.user!.id;
    const analysisType = (req.body.type as string) || 'general';
    const recommendationType = req.body.recommendationType || 'full_schedule';
    const goal = req.body.goal || 'balanced';
    const deficiency = req.body.deficiency;

    try {
      // Verify grow exists and user owns it
      const grow = await GrowService.findByIdAndUser(growId, userId);
      if (!grow) {
        logApi.warn('Grow not found or access denied for analysis', {
          userId,
          growId,
        });
        return res.status(404).json({ error: 'Grow not found' });
      }

      // Check analysis limits
      const canAnalyze = await analysisLimitService.checkCanAnalyze(userId);
      if (!canAnalyze.canAnalyze) {
        logApi.info('Analysis limit check failed', {
          userId,
          growId,
          reason: canAnalyze.reason,
        });

        const statusCode =
          canAnalyze.reason === 'feature_disabled'
            ? 403
            : canAnalyze.reason === 'analysis_pending'
              ? 409
              : 429;

        const errorMessage =
          canAnalyze.reason === 'feature_disabled'
            ? 'AI analysis is not enabled for your account'
            : canAnalyze.reason === 'analysis_pending'
              ? 'An analysis is already in progress'
              : canAnalyze.reason === 'limit_reached'
                ? 'Daily analysis limit reached'
                : 'Cannot perform analysis at this time';

        return res.status(statusCode).json({
          error: errorMessage,
          reason: canAnalyze.reason,
          remainingAnalyses: canAnalyze.remaining,
        });
      }

      // Route to appropriate job type based on analysis type
      let job;
      let jobType: string;
      let payload: any;

      if (analysisType === 'nutrients') {
        // Route to nutrient recommendation service
        jobType = 'grow_nutrient_recommendation';
        payload = {
          growId,
          userId,
          type: recommendationType,
          goal,
          deficiency,
          triggeredBy: 'manual_request',
          timestamp: new Date().toISOString(),
        };
      } else {
        // Route to grow analysis service
        jobType = 'grow_analysis';
        payload = {
          growId,
          userId,
          type: analysisType,
          triggeredBy: 'manual_request',
          timestamp: new Date().toISOString(),
        };
      }

      job = await queueAITask(jobType, payload);

      // Increment usage
      await analysisLimitService.incrementUsage(userId);

      logApi.info(`${jobType} queued`, {
        userId,
        growId,
        jobId: job.id,
        jobType,
        analysisType,
        recommendationType:
          analysisType === 'nutrients' ? recommendationType : undefined,
        goal: analysisType === 'nutrients' ? goal : undefined,
        remainingAnalyses: canAnalyze.remaining - 1,
      });

      const responseMessage =
        analysisType === 'nutrients'
          ? 'Nutrient recommendation has been queued'
          : 'Grow analysis has been queued';

      return res.status(202).json({
        message: responseMessage,
        jobId: job.id,
        status: 'pending',
        growId,
        analysisType,
        recommendationType:
          analysisType === 'nutrients' ? recommendationType : undefined,
        goal: analysisType === 'nutrients' ? goal : undefined,
        remainingAnalyses: canAnalyze.remaining - 1,
      });
    } catch (error) {
      logApi.error('Error queueing analysis', {
        userId,
        growId,
        analysisType,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to queue analysis' });
    }
  }
);

export default router;
