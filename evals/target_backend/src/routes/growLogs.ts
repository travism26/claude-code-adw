import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateJWT } from '../middleware';
import { upload } from '../middleware/upload';
import { GrowLogService } from '../services/GrowLogService';
import { GrowLogPhotoService } from '../services/GrowLogPhotoService';
import { logApi } from '../services/logging/logger';
import { queueAITask } from '../services/queue/queues/aiTasks.queue';
import { analysisLimitService } from '../services/analysisLimitService';

const router: Router = Router();

// Validation middleware
const validateLogUpdate = [
  param('id').isUUID().withMessage('Invalid log ID'),
  body('logged_at')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('Logged at must be a valid date'),
  body('day_number')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('Day number must be 0 or greater'),
  body('phase')
    .optional({ nullable: true })
    .isIn(['germination', 'vegetative', 'flowering', 'harvest'])
    .withMessage('Phase must be one of: germination, vegetative, flowering, harvest'),
  body('height_inches')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Height must be 0 or greater'),
  body('notes').optional({ nullable: true }).trim(),
];

const validateEnvironmentCreate = [
  param('id').isUUID().withMessage('Invalid log ID'),
  body('temperature_f')
    .optional({ nullable: true })
    .isFloat({ min: -50, max: 150 })
    .withMessage('Temperature must be between -50 and 150°F'),
  body('humidity_percent')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('Humidity must be between 0 and 100'),
  body('ph')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 14 })
    .withMessage('pH must be between 0 and 14'),
  body('ec')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('EC must be 0 or greater'),
  body('ppm')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('PPM must be 0 or greater'),
  body('co2_ppm')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('CO2 PPM must be 0 or greater'),
  body('light_hours')
    .optional({ nullable: true })
    .isInt({ min: 0, max: 24 })
    .withMessage('Light hours must be between 0 and 24'),
  body('light_distance_inches')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Light distance must be 0 or greater'),
  body('vpd')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('VPD must be 0 or greater'),
];

const validateEnvironmentUpdate = validateEnvironmentCreate;

// Get single log by ID
router.get(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid log ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const log = await GrowLogService.findById(req.params.id);

      if (!log) {
        return res.status(404).json({ error: 'Log not found' });
      }

      // Verify ownership through grow
      if ((log as any).grow?.user_id !== req.user!.id) {
        return res.status(404).json({ error: 'Log not found' });
      }

      return res.status(200).json(log.toJSON());
    } catch (error) {
      logApi.error('Error fetching grow log', {
        logId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch grow log' });
    }
  }
);

// Update log
router.put(
  '/:id',
  authenticateJWT,
  validateLogUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const log = await GrowLogService.findById(req.params.id);

      if (!log) {
        return res.status(404).json({ error: 'Log not found' });
      }

      // Verify ownership through grow
      if ((log as any).grow?.user_id !== req.user!.id) {
        return res.status(404).json({ error: 'Log not found' });
      }

      await GrowLogService.update(log, req.body);

      logApi.info('Grow log updated', {
        userId: req.user!.id,
        logId: log.id,
      });

      return res.status(200).json(log.toJSON());
    } catch (error) {
      logApi.error('Error updating grow log', {
        logId: req.params.id,
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to update grow log' });
    }
  }
);

// Delete log
router.delete(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid log ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const log = await GrowLogService.findById(req.params.id);

      if (!log) {
        return res.status(404).json({ error: 'Log not found' });
      }

      // Verify ownership through grow
      if ((log as any).grow?.user_id !== req.user!.id) {
        return res.status(404).json({ error: 'Log not found' });
      }

      await GrowLogService.delete(log);

      logApi.info('Grow log deleted', {
        userId: req.user!.id,
        logId: log.id,
      });

      return res.status(200).json({ message: 'Log deleted successfully' });
    } catch (error) {
      logApi.error('Error deleting grow log', {
        logId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to delete grow log' });
    }
  }
);

// Add environment data to log
router.post(
  '/:id/environment',
  authenticateJWT,
  validateEnvironmentCreate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const log = await GrowLogService.findById(req.params.id);

      if (!log) {
        return res.status(404).json({ error: 'Log not found' });
      }

      // Verify ownership through grow
      if ((log as any).grow?.user_id !== req.user!.id) {
        return res.status(404).json({ error: 'Log not found' });
      }

      // Check if environment already exists
      const existingEnvironment = await GrowLogService.findEnvironmentByLogId(req.params.id);
      if (existingEnvironment) {
        return res.status(409).json({ error: 'Environment data already exists for this log' });
      }

      const environment = await GrowLogService.createEnvironment(req.params.id, req.body);

      logApi.info('Environment data added to log', {
        userId: req.user!.id,
        logId: req.params.id,
        environmentId: environment.id,
      });

      return res.status(201).json(environment.toJSON());
    } catch (error) {
      logApi.error('Error adding environment data', {
        logId: req.params.id,
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to add environment data' });
    }
  }
);

// Update environment data
router.put(
  '/:id/environment',
  authenticateJWT,
  validateEnvironmentUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const log = await GrowLogService.findById(req.params.id);

      if (!log) {
        return res.status(404).json({ error: 'Log not found' });
      }

      // Verify ownership through grow
      if ((log as any).grow?.user_id !== req.user!.id) {
        return res.status(404).json({ error: 'Log not found' });
      }

      const environment = await GrowLogService.findEnvironmentByLogId(req.params.id);
      if (!environment) {
        return res.status(404).json({ error: 'Environment data not found for this log' });
      }

      await GrowLogService.updateEnvironment(environment, req.body);

      logApi.info('Environment data updated', {
        userId: req.user!.id,
        logId: req.params.id,
        environmentId: environment.id,
      });

      return res.status(200).json(environment.toJSON());
    } catch (error) {
      logApi.error('Error updating environment data', {
        logId: req.params.id,
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to update environment data' });
    }
  }
);

// Photo routes

// Upload photos to a grow log entry
router.post(
  '/:id/photos',
  authenticateJWT,
  upload.array('photos', 10),
  [param('id').isUUID().withMessage('Invalid log ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      // Extract captions from request body if provided
      let captions: (string | null)[] | undefined;
      if (req.body.captions) {
        try {
          captions = JSON.parse(req.body.captions);
        } catch {
          captions = undefined;
        }
      }

      const photos = await GrowLogPhotoService.uploadPhotos(
        req.user!.id,
        req.params.id,
        files,
        captions
      );

      logApi.info('Photos uploaded successfully', {
        userId: req.user!.id,
        logId: req.params.id,
        count: photos.length,
      });

      return res.status(201).json(photos);
    } catch (error) {
      logApi.error('Error uploading photos', {
        logId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (error instanceof Error) {
        if (error.message.includes('Unauthorized')) {
          return res.status(403).json({ error: error.message });
        }
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
        }
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Failed to upload photos' });
    }
  }
);

// Get all photos for a grow log entry
router.get(
  '/:id/photos',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid log ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const photos = await GrowLogPhotoService.getPhotos(req.user!.id, req.params.id);

      return res.status(200).json(photos);
    } catch (error) {
      logApi.error('Error fetching photos', {
        logId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (error instanceof Error) {
        if (error.message.includes('Unauthorized')) {
          return res.status(403).json({ error: error.message });
        }
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: 'Failed to fetch photos' });
    }
  }
);

// Delete a photo
router.delete(
  '/photos/:photoId',
  authenticateJWT,
  [param('photoId').isUUID().withMessage('Invalid photo ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      await GrowLogPhotoService.deletePhoto(req.user!.id, req.params.photoId);

      logApi.info('Photo deleted successfully', {
        userId: req.user!.id,
        photoId: req.params.photoId,
      });

      return res.status(200).json({ message: 'Photo deleted successfully' });
    } catch (error) {
      logApi.error('Error deleting photo', {
        photoId: req.params.photoId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (error instanceof Error) {
        if (error.message.includes('Unauthorized')) {
          return res.status(403).json({ error: error.message });
        }
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: 'Failed to delete photo' });
    }
  }
);

// Set cover photo for a grow log entry
router.put(
  '/photos/:photoId/cover',
  authenticateJWT,
  [
    param('photoId').isUUID().withMessage('Invalid photo ID'),
    body('grow_log_id').isUUID().withMessage('Invalid log ID'),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const photo = await GrowLogPhotoService.setCoverPhoto(
        req.user!.id,
        req.body.grow_log_id,
        req.params.photoId
      );

      logApi.info('Cover photo set successfully', {
        userId: req.user!.id,
        photoId: req.params.photoId,
        logId: req.body.grow_log_id,
      });

      return res.status(200).json(photo);
    } catch (error) {
      logApi.error('Error setting cover photo', {
        photoId: req.params.photoId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (error instanceof Error) {
        if (error.message.includes('Unauthorized')) {
          return res.status(403).json({ error: error.message });
        }
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: 'Failed to set cover photo' });
    }
  }
);

// Analyze photo with AI
router.post(
  '/:logId/analyze-photo',
  authenticateJWT,
  [
    param('logId').isUUID().withMessage('Invalid grow log ID'),
    body('photoId').isUUID().withMessage('Invalid photo ID'),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    const correlationId = req.headers['x-correlation-id'] as string || `photo-analysis-${Date.now()}`;

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { logId } = req.params;
      const { photoId } = req.body;
      const userId = req.user!.id;

      logApi.info('Photo analysis request received', {
        correlationId,
        userId,
        logId,
        photoId,
      });

      // Verify photo exists, belongs to the specified log, and user owns it
      let verificationResult;
      try {
        verificationResult = await GrowLogPhotoService.verifyPhotoOwnership(userId, photoId, logId);
      } catch (error) {
        if (error instanceof Error && error.message === 'Photo not found') {
          logApi.warn('Photo not found', {
            correlationId,
            photoId,
            userId,
          });
          return res.status(404).json({ error: 'Photo not found' });
        }
        throw error;
      }

      if (!verificationResult.belongsToLog) {
        logApi.warn('Photo does not belong to specified log', {
          correlationId,
          photoId,
          logId,
          actualLogId: verificationResult.photo.growLog?.id,
        });
        return res.status(403).json({ error: 'Photo does not belong to this log' });
      }

      if (!verificationResult.isOwner) {
        logApi.warn('Unauthorized photo analysis attempt', {
          correlationId,
          photoId,
          userId,
        });
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Check if AI is enabled (feature flag)
      const ENABLE_AI = process.env.ENABLE_AI === 'true';
      if (!ENABLE_AI) {
        logApi.warn('Photo analysis feature disabled', {
          correlationId,
          userId,
        });
        return res.status(403).json({
          error: 'Photo analysis feature is currently disabled',
          reason: 'feature_disabled'
        });
      }

      // Check analysis limits
      const limitCheck = await analysisLimitService.checkCanAnalyze(userId, 'grow_photo_analysis', photoId);

      if (limitCheck.hasPending) {
        logApi.warn('Photo analysis already pending', {
          correlationId,
          userId,
          photoId,
        });
        return res.status(409).json({
          error: 'Analysis already in progress for this photo',
          reason: 'analysis_pending',
        });
      }

      if (!limitCheck.canAnalyze) {
        logApi.warn('Photo analysis limit exceeded', {
          correlationId,
          userId,
          remaining: limitCheck.remaining,
          reason: limitCheck.reason,
        });
        return res.status(429).json({
          error: 'Daily photo analysis limit reached',
          reason: limitCheck.reason,
          remaining: limitCheck.remaining,
        });
      }

      // Queue photo analysis job
      const job = await queueAITask('grow_photo_analysis', {
        photoId,
        logId,
        userId,
        triggeredBy: 'manual_request',
      });

      // Increment usage count
      await analysisLimitService.incrementUsage(userId);

      logApi.info('Photo analysis queued successfully', {
        correlationId,
        userId,
        photoId,
        logId,
        jobId: job.id,
        remaining: limitCheck.remaining - 1,
      });

      return res.status(202).json({
        message: 'Photo analysis queued successfully',
        jobId: job.id,
        status: 'queued',
        photoId,
        logId,
        remainingAnalyses: limitCheck.remaining - 1,
      });
    } catch (error) {
      logApi.error('Photo analysis request failed', {
        correlationId,
        userId: req.user?.id,
        logId: req.params.logId,
        photoId: req.body.photoId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('Unauthorized')) {
          return res.status(403).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: 'Failed to queue photo analysis' });
    }
  }
);

export default router;
