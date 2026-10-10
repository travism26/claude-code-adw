import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateJWT } from '../middleware';
import { FeedingScheduleService } from '../services/FeedingScheduleService';
import { logApi } from '../services/logging/logger';

const router: Router = Router();

const validateTemplateBody = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 255 }),
  body('description').optional({ nullable: true }).trim(),
  body('week_counting_mode').optional().isIn(['continuous', 'flip-reset', 'stage-based']).withMessage('Invalid week_counting_mode'),
  body('flower_start_week').optional({ nullable: true }).isInt({ min: 1 }).withMessage('flower_start_week must be >= 1'),
  body('ppm_scale').optional().isInt().withMessage('ppm_scale must be a number'),
  body('display_unit').optional().isString(),
  body('weeks').optional({ nullable: true }).isArray().withMessage('weeks must be an array'),
  body('weeks.*.week_number').optional().isInt({ min: 1 }).withMessage('week_number must be >= 1'),
  body('weeks.*.ec_min').optional({ nullable: true }).isFloat({ min: 0 }),
  body('weeks.*.ec_max').optional({ nullable: true }).isFloat({ min: 0 }),
  body('weeks.*.ppm_min').optional({ nullable: true }).isInt({ min: 0 }),
  body('weeks.*.ppm_max').optional({ nullable: true }).isInt({ min: 0 }),
  body('weeks.*.ph_min').optional({ nullable: true }).isFloat({ min: 0, max: 14 }),
  body('weeks.*.ph_max').optional({ nullable: true }).isFloat({ min: 0, max: 14 }),
  body('weeks.*.is_flush').optional().isBoolean(),
  body('weeks.*.is_water_only').optional().isBoolean(),
  body('weeks.*.nutrients').optional({ nullable: true }).isArray(),
  body('weeks.*.nutrients.*.nutrient_id').optional().isUUID().withMessage('nutrient_id must be a UUID'),
  body('weeks.*.nutrients.*.dosage_ml_per_gallon')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Dosage must be >= 0'),
];

// List templates
router.get('/', authenticateJWT, async (req: Request, res: Response): Promise<Response> => {
  try {
    const templates = await FeedingScheduleService.listTemplates(req.user!.id);
    return res.json({ templates });
  } catch (error) {
    logApi.error('Error listing feeding templates', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to list feeding templates' });
  }
});

// Get one template
router.get(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid template ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const template = await FeedingScheduleService.getTemplate(req.user!.id, req.params.id);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      return res.json({ template });
    } catch (error) {
      logApi.error('Error fetching feeding template', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to fetch feeding template' });
    }
  }
);

// Create template
router.post(
  '/',
  authenticateJWT,
  validateTemplateBody,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const template = await FeedingScheduleService.createTemplate(req.user!.id, req.body);
      logApi.info('Feeding template created', { userId: req.user!.id, templateId: template.id });
      return res.status(201).json({ template });
    } catch (error) {
      logApi.error('Error creating feeding template', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to create feeding template' });
    }
  }
);

// Clone a template (system or owned) into a new owned copy
router.post(
  '/:id/clone',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid template ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const template = await FeedingScheduleService.cloneTemplate(req.user!.id, req.params.id);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      return res.status(201).json({ template });
    } catch (error) {
      logApi.error('Error cloning feeding template', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to clone feeding template' });
    }
  }
);

// Update template
router.put(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid template ID'), ...validateTemplateBody],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const template = await FeedingScheduleService.updateTemplate(
        req.user!.id,
        req.params.id,
        req.body
      );
      if (!template) return res.status(404).json({ error: 'Template not found' });
      return res.json({ template });
    } catch (error) {
      logApi.error('Error updating feeding template', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to update feeding template' });
    }
  }
);

// Delete template
router.delete(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid template ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const deleted = await FeedingScheduleService.deleteTemplate(req.user!.id, req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Template not found' });
      return res.status(204).send();
    } catch (error) {
      logApi.error('Error deleting feeding template', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: 'Failed to delete feeding template' });
    }
  }
);

export default router;
