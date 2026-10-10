import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateJWT } from '../middleware';
import { notificationService } from '../services/notificationService';
import { logApi } from '../services/logging/logger';

const router: Router = Router();

/**
 * Validation middleware
 */
const validateNotificationId = [
  param('id').isUUID().withMessage('Invalid notification ID'),
];

const validateNotificationQuery = [
  query('unreadOnly')
    .optional()
    .isBoolean()
    .withMessage('unreadOnly must be a boolean'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

const validateTestNotification = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 5000 })
    .withMessage('Message must be 5000 characters or less'),
  body('link')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Link must be 500 characters or less'),
  body('type')
    .optional()
    .isIn(['info', 'success', 'warning', 'error'])
    .withMessage('Type must be one of: info, success, warning, error'),
];

/**
 * GET /api/notifications
 * Fetch all notifications for the authenticated user
 */
router.get(
  '/',
  authenticateJWT,
  validateNotificationQuery,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const unreadOnly = req.query.unreadOnly === 'true';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      const notifications = await notificationService.getNotifications(userId, {
        unreadOnly,
        limit,
      });

      return res.status(200).json({
        notifications,
        count: notifications.length,
      });
    } catch (error) {
      const unreadOnly = req.query.unreadOnly === 'true';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      logApi.error('Error fetching notifications', {
        userId: req.user!.id,
        unreadOnly,
        limit,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to fetch notifications',
      });
    }
  }
);

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications for the authenticated user
 */
router.get(
  '/unread-count',
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.id;
      const count = await notificationService.getUnreadCount(userId);

      return res.status(200).json({ count });
    } catch (error) {
      logApi.error('Error fetching unread count', {
        userId: req.user!.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to fetch unread count',
      });
    }
  }
);

/**
 * GET /api/notifications/:id
 * Fetch a single notification by ID
 */
router.get(
  '/:id',
  authenticateJWT,
  validateNotificationId,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const notificationId = req.params.id;

      const notification = await notificationService.getNotificationById(
        notificationId,
        userId
      );

      if (!notification) {
        return res.status(404).json({
          error: 'Notification not found',
        });
      }

      return res.status(200).json({ notification });
    } catch (error) {
      logApi.error('Error fetching notification', {
        userId: req.user!.id,
        notificationId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to fetch notification',
      });
    }
  }
);

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
router.patch(
  '/:id/read',
  authenticateJWT,
  validateNotificationId,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const notificationId = req.params.id;

      const success = await notificationService.markAsRead(notificationId, userId);

      if (!success) {
        return res.status(404).json({
          error: 'Notification not found',
        });
      }

      return res.status(200).json({
        message: 'Notification marked as read',
      });
    } catch (error) {
      logApi.error('Error marking notification as read', {
        userId: req.user!.id,
        notificationId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to mark notification as read',
      });
    }
  }
);

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications as read for the authenticated user
 */
router.patch(
  '/mark-all-read',
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.id;
      const count = await notificationService.markAllAsRead(userId);

      return res.status(200).json({
        message: 'All notifications marked as read',
        count,
      });
    } catch (error) {
      logApi.error('Error marking all notifications as read', {
        userId: req.user!.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to mark all notifications as read',
      });
    }
  }
);

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete(
  '/:id',
  authenticateJWT,
  validateNotificationId,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const notificationId = req.params.id;

      const success = await notificationService.deleteNotification(
        notificationId,
        userId
      );

      if (!success) {
        return res.status(404).json({
          error: 'Notification not found',
        });
      }

      return res.status(200).json({
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      logApi.error('Error deleting notification', {
        userId: req.user!.id,
        notificationId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to delete notification',
      });
    }
  }
);

/**
 * POST /api/notifications/test
 * Create a test notification for development purposes
 */
router.post(
  '/test',
  authenticateJWT,
  validateTestNotification,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const { message, link, type } = req.body;

      const notification = await notificationService.sendNotification(
        userId,
        message,
        link,
        type || 'info'
      );

      return res.status(201).json({
        message: 'Test notification created successfully',
        notification,
      });
    } catch (error) {
      logApi.error('Error creating test notification', {
        userId: req.user!.id,
        notificationType: req.body.type,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to create test notification',
      });
    }
  }
);

export default router;
