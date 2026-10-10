import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { notificationService } from '../services/notificationService';
import { analysisLimitService } from '../services/analysisLimitService';
import { UserService } from '../services/UserService';
import { UniqueConstraintError } from 'sequelize';
import { logApi } from '../services/logging/logger';

const router: Router = Router();

/**
 * Admin Routes
 *
 * Provides administrative endpoints for user management, notification testing,
 * and system statistics. These endpoints are designed for development and testing
 * purposes and should be secured with authentication in production environments.
 *
 * @module routes/admin
 */

/**
 * Validation middleware
 */
const validateUserId = [
  param('id').isUUID().withMessage('Invalid user ID'),
];

const validateUserUpdate = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Must be a valid email address'),
  body('growing_zone')
    .optional()
    .matches(/^([1-9]|1[0-3])[ab]?$/)
    .withMessage('Growing zone must be in format like "6a", "7b", or "10"'),
  body('postal_code')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Postal code must be 20 characters or less'),
  body('tz')
    .optional()
    .isString()
    .withMessage('Timezone must be a valid string'),
];

const validateNotificationToUser = [
  body('userId').isUUID().withMessage('Invalid user ID'),
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

const validateNotificationToAll = [
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

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must be 100 characters or less'),
];

/**
 * GET /api/admin/users
 * Fetch all users with pagination support
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - search: Search by email (optional)
 */
router.get(
  '/users',
  validatePagination,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string || '';

      const { users, total } = await UserService.findAllPaginated({ page, limit, search });

      return res.status(200).json({
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.floor(total / limit),
        },
      });
    } catch (error) {
      logApi.error('Error fetching users', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit,
      });
      return res.status(500).json({
        error: 'Failed to fetch users',
      });
    }
  }
);

/**
 * GET /api/admin/users/:id
 * Fetch a single user's details
 */
router.get(
  '/users/:id',
  validateUserId,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.params.id;

      const user = await UserService.findByIdWithAttributes(userId);

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
        });
      }

      return res.status(200).json({ user });
    } catch (error) {
      logApi.error('Error fetching user', {
        userId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to fetch user',
      });
    }
  }
);

/**
 * PUT /api/admin/users/:id
 * Update user information
 *
 * Allowed updates: email, growing_zone, postal_code, tz
 */
router.put(
  '/users/:id',
  validateUserId,
  validateUserUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.params.id;
      const { email, growing_zone, postal_code, tz } = req.body;

      const user = await UserService.findById(userId);

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
        });
      }

      // Update only provided fields
      const updateData: any = {};
      if (email !== undefined) updateData.email = email;
      if (growing_zone !== undefined) updateData.growing_zone = growing_zone;
      if (postal_code !== undefined) updateData.postal_code = postal_code;
      if (tz !== undefined) updateData.tz = tz;

      const updatedUser = await UserService.update(userId, updateData);

      return res.status(200).json({
        message: 'User updated successfully',
        user: updatedUser,
      });
    } catch (error) {
      // Handle unique constraint violations (e.g., duplicate email)
      if (error instanceof UniqueConstraintError) {
        const fields = error.fields || {};
        const fieldNames = Object.keys(fields);
        const fieldName = fieldNames.length > 0 ? fieldNames[0] : 'field';

        return res.status(409).json({
          error: `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} already exists`,
        });
      }

      // Handle unexpected errors
      logApi.error('Error updating user', {
        userId: req.params.id,
        updateFields: Object.keys(req.body),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to update user',
      });
    }
  }
);

/**
 * POST /api/admin/notifications/send-to-user
 * Send a notification to a specific user
 *
 * Body:
 * - userId: UUID of the target user
 * - message: Notification message
 * - link: Optional link/route
 * - type: Optional type (info, success, warning, error)
 */
router.post(
  '/notifications/send-to-user',
  validateNotificationToUser,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, message, link, type } = req.body;

      // Check if user exists
      const user = await UserService.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
        });
      }

      // Send notification
      const notification = await notificationService.sendNotification(
        userId,
        message,
        link,
        type || 'info'
      );

      return res.status(201).json({
        message: 'Notification sent successfully',
        notification,
      });
    } catch (error) {
      logApi.error('Error sending notification to user', {
        targetUserId: req.body.userId,
        notificationType: req.body.type,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to send notification',
      });
    }
  }
);

/**
 * POST /api/admin/notifications/send-to-all
 * Send a notification to all users
 *
 * Body:
 * - message: Notification message
 * - link: Optional link/route
 * - type: Optional type (info, success, warning, error)
 */
router.post(
  '/notifications/send-to-all',
  validateNotificationToAll,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { message, link, type } = req.body;

      // Fetch all users
      const users = await UserService.findAll({ attributes: ['id'] });

      if (users.length === 0) {
        return res.status(200).json({
          message: 'No users found',
          count: 0,
          errors: [],
        });
      }

      // Send notification to each user
      const results: { userId: string; success: boolean; error?: string }[] = [];
      let successCount = 0;

      for (const user of users) {
        try {
          await notificationService.sendNotification(
            user.id,
            message,
            link,
            type || 'info'
          );
          results.push({ userId: user.id, success: true });
          successCount++;
        } catch (error) {
          results.push({
            userId: user.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return res.status(201).json({
        message: 'Bulk notification send completed',
        count: successCount,
        total: users.length,
        errors: results.filter(r => !r.success),
      });
    } catch (error) {
      logApi.error('Error sending notifications to all users', {
        notificationType: req.body.type,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to send notifications',
      });
    }
  }
);

/**
 * GET /api/admin/stats
 * Get user statistics
 *
 * Returns:
 * - totalUsers: Total number of users
 * - usersByZone: Count of users by growing zone
 * - recentSignups: Users created in last 7 and 30 days
 */
router.get(
  '/stats',
  async (req: Request, res: Response): Promise<Response> => {
    try {
      // Total users
      const totalUsers = await UserService.count();

      // Users by zone
      const usersByZone = await UserService.getUsersByZone();

      // Recent signups
      const recentSignups = await UserService.getRecentSignupCounts();

      // Users without zone set
      const usersWithoutZone = await UserService.count({ growing_zone: null });

      return res.status(200).json({
        totalUsers,
        usersByZone,
        recentSignups,
        usersWithoutZone,
      });
    } catch (error) {
      logApi.error('Error fetching stats', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to fetch statistics',
      });
    }
  }
);

/**
 * POST /api/admin/users/:id/grant-analyses
 * Grant bonus AI analyses to a specific user for today
 *
 * Body:
 * - count: Number of bonus analyses to grant (positive integer)
 */
router.post(
  '/users/:id/grant-analyses',
  [
    param('id').isUUID().withMessage('Invalid user ID'),
    body('count')
      .isInt({ min: 1 })
      .withMessage('Count must be a positive integer'),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.params.id;
      const { count } = req.body;

      // Check if user exists
      const user = await UserService.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
        });
      }

      // Grant bonus analyses
      // Note: In production, you would pass the actual admin user ID
      const usageRecord = await analysisLimitService.grantBonusAnalyses(
        userId,
        count,
        'admin' // TODO: Replace with actual admin user ID when auth is implemented
      );

      // Get updated usage stats
      const stats = await analysisLimitService.getUsageForToday(userId);

      return res.status(200).json({
        message: `Successfully granted ${count} bonus analyses to user`,
        userId,
        usageRecord: {
          analysesUsed: usageRecord.analyses_used,
          bonusAnalyses: usageRecord.bonus_analyses,
          usageDate: usageRecord.usage_date,
        },
        stats,
      });
    } catch (error) {
      logApi.error('Error granting bonus analyses', {
        targetUserId: req.params.id,
        bonusCount: req.body.count,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (error instanceof Error) {
        // Handle specific errors from the service
        if (error.message === 'Bonus count must be a positive integer') {
          return res.status(400).json({ error: error.message });
        }
        if (error.message === 'User not found') {
          return res.status(404).json({ error: error.message });
        }
      }

      return res.status(500).json({
        error: 'Failed to grant bonus analyses',
      });
    }
  }
);

export default router;
