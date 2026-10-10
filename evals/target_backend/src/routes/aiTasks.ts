/**
 * AI Tasks API Routes
 *
 * HTTP endpoints for enqueueing AI tasks and checking job status
 * These routes provide a REST API over the queue service
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateJWT } from '../middleware';
import { queueAITask, getAITasksQueue } from '../services/queue';
import { logApi } from '../services/logging/logger';
import { getJobStatus } from '../services/aiTaskService';

const router: Router = Router();

// Validation middleware
const validateEnqueueTask = [
  body('type')
    .isIn([
      'plant_update_suggestion',
      'weather_based_action',
      'care_recommendation',
      'pest_diagnosis',
      'general',
    ])
    .withMessage(
      'Task type must be one of: plant_update_suggestion, weather_based_action, care_recommendation, pest_diagnosis, general'
    ),
  body('payload')
    .isObject()
    .withMessage('Payload must be an object')
    .notEmpty()
    .withMessage('Payload is required'),
  body('userId').optional().isUUID().withMessage('User ID must be a valid UUID'),
  body('plantId').optional().isUUID().withMessage('Plant ID must be a valid UUID'),
  body('priority')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Priority must be between 1 and 10'),
];

const validateJobId = [
  param('jobId')
    .trim()
    .notEmpty()
    .withMessage('Job ID is required'),
];

/**
 * POST /api/ai-tasks
 * Enqueue a new AI task for asynchronous processing
 *
 * Request body:
 * - type: AI task type (required)
 * - payload: Task-specific data (required)
 * - userId: User ID (optional)
 * - plantId: Plant ID (optional)
 * - priority: Priority 1-10 (optional)
 *
 * Response: 202 Accepted
 * - jobId: Unique job identifier
 * - status: Job status (pending)
 */
router.post(
  '/',
  authenticateJWT,
  validateEnqueueTask,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { type, payload, userId, plantId, priority } = req.body;

      // Create job data
      const jobData = {
        payload,
        userId: userId || req.user?.id, // Use authenticated user if not specified
        plantId,
      };

      // Enqueue the job
      const job = await queueAITask(type, jobData, {
        priority,
      });

      logApi.info("AI task enqueued successfully", {
        jobId: job.id,
        userId: req.user?.id,
        taskType: type,
        priority,
        plantId: jobData.plantId,
      });

      // Return 202 Accepted with job ID
      return res.status(202).json({
        jobId: job.id,
        status: await job.getState(),
        type: job.name,
        message: 'AI task enqueued successfully',
      });
    } catch (error: any) {
      logApi.error("Error enqueueing AI task", {
        userId: req.user?.id,
        taskType: req.body.type,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to enqueue AI task',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/ai-tasks/:jobId
 * Get the status and details of a specific AI task job
 *
 * Path parameters:
 * - jobId: Unique job identifier
 *
 * Response: 200 OK
 * For layout_generation jobs:
 * - jobId: Job identifier
 * - status: 'queued' | 'processing' | 'completed' | 'failed'
 * - layouts: Layout options (when completed)
 * - gardenId: Garden identifier
 * - message: Status message or error
 *
 * For other job types:
 * - jobId: Job identifier
 * - type: Job type
 * - status: Current job status
 * - result: Job result (if completed)
 * - error: Error information (if failed)
 * - attemptsMade: Number of retry attempts
 * - createdAt: Job creation timestamp
 * - finishedAt: Job completion timestamp (if completed/failed)
 */
router.get(
  '/:jobId',
  authenticateJWT,
  validateJobId,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { jobId } = req.params;

      logApi.info("GET job status request", {
        jobId,
        userId: req.user?.id,
        timestamp: new Date().toISOString(),
      });

      // Use centralized job status service
      const jobStatus = await getJobStatus(jobId);

      if (!jobStatus) {
        logApi.warn("Job not found", {
          jobId,
          userId: req.user?.id,
        });
        return res.status(404).json({
          error: 'Job not found',
          jobId,
        });
      }

      return res.status(200).json(jobStatus);
    } catch (error: any) {
      logApi.error("Error getting job status", {
        jobId: req.params.jobId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to get job status',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/ai-tasks/:jobId/status
 * Get just the status of a specific AI task job (lightweight endpoint)
 *
 * Path parameters:
 * - jobId: Unique job identifier
 *
 * Response: 200 OK
 * - jobId: Job identifier
 * - status: Current job status
 */
router.get(
  '/:jobId/status',
  authenticateJWT,
  validateJobId,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { jobId } = req.params;

      // Get queue instance
      const queue = getAITasksQueue();

      // Get job status (lightweight operation)
      const job = await queue.getJob(jobId);

      if (!job) {
        return res.status(404).json({
          error: 'Job not found',
          jobId,
        });
      }

      // Return status only
      return res.status(200).json({
        jobId,
        status: await job.getState(),
      });
    } catch (error: any) {
      logApi.error("Error getting job status (lightweight)", {
        jobId: req.params.jobId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: 'Failed to get job status',
        message: error.message,
      });
    }
  }
);

export default router;
