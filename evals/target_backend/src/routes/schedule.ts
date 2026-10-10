import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateJWT } from '../middleware';
import { ScheduleService } from '../services/ScheduleService';
import { logApi } from '../services/logging/logger';

const router: Router = Router();

// Validation middleware
const validateCreateEvent = [
  body('entity_type')
    .isIn(['grow', 'garden', 'plant'])
    .withMessage('Entity type must be one of: grow, garden, plant'),
  body('entity_id')
    .isUUID()
    .withMessage('Entity ID must be a valid UUID'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title must be 200 characters or less'),
  body('description')
    .optional()
    .trim(),
  body('event_type')
    .isIn(['feeding', 'watering', 'phase_change', 'harvest', 'custom'])
    .withMessage('Event type must be one of: feeding, watering, phase_change, harvest, custom'),
  body('start_date')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  body('all_day')
    .optional()
    .isBoolean()
    .withMessage('All day must be a boolean'),
  body('is_recurring')
    .optional()
    .isBoolean()
    .withMessage('Is recurring must be a boolean'),
  body('recurrence_rule')
    .optional()
    .trim(),
  body('recurrence_end_date')
    .optional()
    .isISO8601()
    .withMessage('Recurrence end date must be a valid date'),
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color must be a valid hex color code'),
  body('environment_id')
    .optional()
    .isUUID()
    .withMessage('Environment ID must be a valid UUID'),
];

const validateUpdateEvent = [
  param('id').isUUID().withMessage('Invalid event ID'),
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Title must be 200 characters or less'),
  body('description')
    .optional()
    .trim(),
  body('event_type')
    .optional()
    .isIn(['feeding', 'watering', 'phase_change', 'harvest', 'custom'])
    .withMessage('Event type must be one of: feeding, watering, phase_change, harvest, custom'),
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  body('all_day')
    .optional()
    .isBoolean()
    .withMessage('All day must be a boolean'),
  body('is_recurring')
    .optional()
    .isBoolean()
    .withMessage('Is recurring must be a boolean'),
  body('recurrence_rule')
    .optional()
    .trim(),
  body('recurrence_end_date')
    .optional()
    .isISO8601()
    .withMessage('Recurrence end date must be a valid date'),
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color must be a valid hex color code'),
  body('environment_id')
    .optional()
    .isUUID()
    .withMessage('Environment ID must be a valid UUID'),
  body('status')
    .optional()
    .isIn(['pending', 'completed', 'skipped', 'cancelled'])
    .withMessage('Status must be one of: pending, completed, skipped, cancelled'),
];

const validateEventFilters = [
  query('entity_type')
    .optional()
    .isIn(['grow', 'garden', 'plant'])
    .withMessage('Entity type must be one of: grow, garden, plant'),
  query('entity_id')
    .optional()
    .isUUID()
    .withMessage('Entity ID must be a valid UUID'),
  query('environment_id')
    .optional()
    .isUUID()
    .withMessage('Environment ID must be a valid UUID'),
  query('status')
    .optional()
    .isIn(['pending', 'completed', 'skipped', 'cancelled'])
    .withMessage('Status must be one of: pending, completed, skipped, cancelled'),
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Limit must be between 1 and 500'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be non-negative'),
];

const validateQuickCreate = [
  body('template')
    .isIn(['daily_watering', 'every_other_day', 'weekly_feeding', 'bi_weekly_feeding'])
    .withMessage('Template must be one of: daily_watering, every_other_day, weekly_feeding, bi_weekly_feeding'),
  body('entity_type')
    .isIn(['grow', 'garden', 'plant'])
    .withMessage('Entity type must be one of: grow, garden, plant'),
  body('entity_id')
    .isUUID()
    .withMessage('Entity ID must be a valid UUID'),
  body('start_date')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('environment_id')
    .optional()
    .isUUID()
    .withMessage('Environment ID must be a valid UUID'),
];

// GET /api/schedule/events - List events with filters
router.get(
  '/events',
  authenticateJWT,
  validateEventFilters,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logApi.warn('Validation failed for list events', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.id;
      const filters = {
        entity_type: req.query.entity_type as any,
        entity_id: req.query.entity_id as string,
        environment_id: req.query.environment_id as string,
        status: req.query.status as string,
        start_date: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
        end_date: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      };

      const result = await ScheduleService.getEvents(userId, filters);
      logApi.info('Listed scheduled events', { userId, count: result.events.length });
      res.json(result);
    } catch (error) {
      logApi.error('Error listing scheduled events', { error });
      res.status(500).json({ error: 'Failed to retrieve events' });
    }
  }
);

// POST /api/schedule/events - Create event
router.post(
  '/events',
  authenticateJWT,
  validateCreateEvent,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logApi.warn('Validation failed for create event', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.id;
      const event = await ScheduleService.create(userId, req.body);
      logApi.info('Created scheduled event', { userId, eventId: event.id });
      res.status(201).json(event);
    } catch (error: any) {
      logApi.error('Error creating scheduled event', { error });
      if (error.message?.includes('not found') || error.message?.includes('does not belong')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to create event' });
    }
  }
);

// GET /api/schedule/events/:id - Get single event
router.get(
  '/events/:id',
  authenticateJWT,
  param('id').isUUID().withMessage('Invalid event ID'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logApi.warn('Validation failed for get event', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.id;
      const event = await ScheduleService.getEventById(req.params.id, userId);

      if (!event) {
        logApi.warn('Event not found', { eventId: req.params.id, userId });
        return res.status(404).json({ error: 'Event not found' });
      }

      logApi.info('Retrieved scheduled event', { userId, eventId: event.id });
      res.json(event);
    } catch (error) {
      logApi.error('Error retrieving scheduled event', { error });
      res.status(500).json({ error: 'Failed to retrieve event' });
    }
  }
);

// PUT /api/schedule/events/:id - Update event
router.put(
  '/events/:id',
  authenticateJWT,
  validateUpdateEvent,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logApi.warn('Validation failed for update event', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.id;
      const event = await ScheduleService.update(req.params.id, userId, req.body);

      if (!event) {
        logApi.warn('Event not found for update', { eventId: req.params.id, userId });
        return res.status(404).json({ error: 'Event not found' });
      }

      logApi.info('Updated scheduled event', { userId, eventId: event.id });
      res.json(event);
    } catch (error: any) {
      logApi.error('Error updating scheduled event', { error });
      if (error.message?.includes('not found') || error.message?.includes('does not belong')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update event' });
    }
  }
);

// DELETE /api/schedule/events/:id - Delete event
router.delete(
  '/events/:id',
  authenticateJWT,
  param('id').isUUID().withMessage('Invalid event ID'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logApi.warn('Validation failed for delete event', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.id;
      const deleted = await ScheduleService.delete(req.params.id, userId);

      if (!deleted) {
        logApi.warn('Event not found for deletion', { eventId: req.params.id, userId });
        return res.status(404).json({ error: 'Event not found' });
      }

      logApi.info('Deleted scheduled event', { userId, eventId: req.params.id });
      res.status(204).send();
    } catch (error) {
      logApi.error('Error deleting scheduled event', { error });
      res.status(500).json({ error: 'Failed to delete event' });
    }
  }
);

// POST /api/schedule/events/:id/complete - Mark event as completed
router.post(
  '/events/:id/complete',
  authenticateJWT,
  param('id').isUUID().withMessage('Invalid event ID'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logApi.warn('Validation failed for complete event', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.id;
      const event = await ScheduleService.completeEvent(req.params.id, userId);

      if (!event) {
        logApi.warn('Event not found for completion', { eventId: req.params.id, userId });
        return res.status(404).json({ error: 'Event not found' });
      }

      logApi.info('Completed scheduled event', { userId, eventId: event.id });
      res.json(event);
    } catch (error) {
      logApi.error('Error completing scheduled event', { error });
      res.status(500).json({ error: 'Failed to complete event' });
    }
  }
);

// POST /api/schedule/events/:id/skip - Mark event as skipped
router.post(
  '/events/:id/skip',
  authenticateJWT,
  param('id').isUUID().withMessage('Invalid event ID'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logApi.warn('Validation failed for skip event', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.id;
      const event = await ScheduleService.skipEvent(req.params.id, userId);

      if (!event) {
        logApi.warn('Event not found for skipping', { eventId: req.params.id, userId });
        return res.status(404).json({ error: 'Event not found' });
      }

      logApi.info('Skipped scheduled event', { userId, eventId: event.id });
      res.json(event);
    } catch (error) {
      logApi.error('Error skipping scheduled event', { error });
      res.status(500).json({ error: 'Failed to skip event' });
    }
  }
);

// GET /api/schedule/agenda - Get agenda view (overdue, today, upcoming)
router.get(
  '/agenda',
  authenticateJWT,
  query('days')
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage('Days must be between 1 and 90'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logApi.warn('Validation failed for agenda view', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.id;
      const days = req.query.days ? parseInt(req.query.days as string) : 7;

      const agenda = await ScheduleService.getAgenda(userId, days);
      logApi.info('Retrieved agenda', { userId, days });
      res.json(agenda);
    } catch (error) {
      logApi.error('Error retrieving agenda', { error });
      res.status(500).json({ error: 'Failed to retrieve agenda' });
    }
  }
);

// POST /api/schedule/quick-create - Quick create from template
router.post(
  '/quick-create',
  authenticateJWT,
  validateQuickCreate,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logApi.warn('Validation failed for quick create', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.id;
      const event = await ScheduleService.quickCreate(userId, {
        ...req.body,
        start_date: new Date(req.body.start_date),
      });

      logApi.info('Quick created scheduled event', { userId, eventId: event.id, template: req.body.template });
      res.status(201).json(event);
    } catch (error: any) {
      logApi.error('Error quick creating scheduled event', { error });
      if (error.message?.includes('not found') || error.message?.includes('does not belong')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes('Unknown template')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to quick create event' });
    }
  }
);

export default router;
