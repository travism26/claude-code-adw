import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateJWT } from '../middleware';
import { GardenService, PlotData } from '../services/GardenService';
import {
  queueGardenAnalysisJob,
  queueLayoutGenerationJob,
} from '../services/queue';
import { analysisLimitService } from '../services/analysisLimitService';
import { logApi } from '../services/logging/logger';

// Local interface for plot overlap checking (avoids importing Plot model)
interface PlotBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const router: Router = Router();

// Validation middleware
const validateGardenCreate = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Garden name is required')
    .isLength({ max: 100 })
    .withMessage('Name must be 100 characters or less'),
  body('width')
    .isFloat({ min: 0.1, max: 10000 })
    .withMessage('Width must be between 0.1 and 10000 feet'),
  body('height')
    .isFloat({ min: 0.1, max: 10000 })
    .withMessage('Height must be between 0.1 and 10000 feet'),
  body('zone')
    .optional()
    .matches(/^([0-9]|1[0-3])[ab]?$/i)
    .withMessage('Zone must be a valid USDA hardiness zone (e.g., 5a, 10b)'),
  body('notes').optional().trim(),
];

const validateGardenUpdate = [
  param('id').isUUID().withMessage('Invalid garden ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Garden name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Name must be 100 characters or less'),
  body('width')
    .optional()
    .isFloat({ min: 0.1, max: 10000 })
    .withMessage('Width must be between 0.1 and 10000 feet'),
  body('height')
    .optional()
    .isFloat({ min: 0.1, max: 10000 })
    .withMessage('Height must be between 0.1 and 10000 feet'),
  body('zone')
    .optional()
    .matches(/^([0-9]|1[0-3])[ab]?$/i)
    .withMessage('Zone must be a valid USDA hardiness zone (e.g., 5a, 10b)'),
  body('notes').optional().trim(),
];

const validatePlotCreate = [
  param('id').isUUID().withMessage('Invalid garden ID'),
  body('x')
    .isFloat({ min: 0 })
    .withMessage('X coordinate must be 0 or greater'),
  body('y')
    .isFloat({ min: 0 })
    .withMessage('Y coordinate must be 0 or greater'),
  body('width')
    .isFloat({ min: 0.1, max: 1000 })
    .withMessage('Width must be between 0.1 and 1000 feet'),
  body('height')
    .isFloat({ min: 0.1, max: 1000 })
    .withMessage('Height must be between 0.1 and 1000 feet'),
  body('plant_profile_id')
    .optional()
    .isUUID()
    .withMessage('Invalid plant profile ID'),
  body('notes').optional().trim(),
  body('compass_direction')
    .optional()
    .isIn(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])
    .withMessage(
      'Compass direction must be one of: N, NE, E, SE, S, SW, W, NW'
    ),
];

const validatePlotUpdate = [
  param('id').isUUID().withMessage('Invalid garden ID'),
  param('plotId').isUUID().withMessage('Invalid plot ID'),
  body('x')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('X coordinate must be 0 or greater'),
  body('y')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Y coordinate must be 0 or greater'),
  body('width')
    .optional()
    .isFloat({ min: 0.1, max: 1000 })
    .withMessage('Width must be between 0.1 and 1000 feet'),
  body('height')
    .optional()
    .isFloat({ min: 0.1, max: 1000 })
    .withMessage('Height must be between 0.1 and 1000 feet'),
  body('plant_profile_id')
    .optional({ values: 'null' })
    .isUUID()
    .withMessage('Invalid plant profile ID'),
  body('notes').optional({ values: 'null' }).trim(),
  body('compass_direction')
    .optional({ values: 'null' })
    .isIn(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])
    .withMessage(
      'Compass direction must be one of: N, NE, E, SE, S, SW, W, NW'
    ),
  body('status')
    .optional({ values: 'null' })
    .isIn(['planned', 'planted', 'harvested', 'archived'])
    .withMessage(
      'Status must be one of: planned, planted, harvested, archived'
    ),
];

// Helper function to check plot overlap
function checkPlotOverlap(
  newPlot: { x: number; y: number; width: number; height: number },
  existingPlots: PlotBounds[],
  excludePlotId?: string
): boolean {
  for (const plot of existingPlots) {
    if (excludePlotId && plot.id === excludePlotId) continue;

    const newRight = newPlot.x + newPlot.width;
    const newBottom = newPlot.y + newPlot.height;
    const existingRight = Number(plot.x) + Number(plot.width);
    const existingBottom = Number(plot.y) + Number(plot.height);

    // Check for overlap
    if (
      newPlot.x < existingRight &&
      newRight > Number(plot.x) &&
      newPlot.y < existingBottom &&
      newBottom > Number(plot.y)
    ) {
      return true;
    }
  }
  return false;
}

// Get all gardens for user
router.get(
  '/',
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const gardens = await GardenService.findAllByUser(req.user!.id);
      return res.status(200).json(gardens);
    } catch (error) {
      logApi.error('Error fetching gardens', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch gardens' });
    }
  }
);

// Get single garden by ID
router.get(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid garden ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const garden = await GardenService.findByIdAndUser(
        req.params.id,
        req.user!.id
      );

      if (!garden) {
        return res.status(404).json({ error: 'Garden not found' });
      }

      // Explicitly call toJSON() to ensure DECIMAL fields are converted to numbers
      const gardenJson = garden.toJSON();
      if (gardenJson.plots) {
        gardenJson.plots = gardenJson.plots.map((plot: any) => {
          if (plot.toJSON) {
            return plot.toJSON();
          }
          // If toJSON not available, manually convert DECIMAL fields
          return {
            ...plot,
            x: typeof plot.x === 'string' ? parseFloat(plot.x) : plot.x,
            y: typeof plot.y === 'string' ? parseFloat(plot.y) : plot.y,
            width:
              typeof plot.width === 'string'
                ? parseFloat(plot.width)
                : plot.width,
            height:
              typeof plot.height === 'string'
                ? parseFloat(plot.height)
                : plot.height,
          };
        });
      }

      return res.status(200).json(gardenJson);
    } catch (error) {
      logApi.error('Error fetching garden', {
        gardenId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch garden' });
    }
  }
);

// Create garden
router.post(
  '/',
  authenticateJWT,
  validateGardenCreate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const garden = await GardenService.create({
        ...req.body,
        user_id: req.user!.id,
      });

      return res.status(201).json(garden);
    } catch (error) {
      logApi.error('Error creating garden', {
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to create garden' });
    }
  }
);

// Update garden
router.put(
  '/:id',
  authenticateJWT,
  validateGardenUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const garden = await GardenService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );

      if (!garden) {
        return res.status(404).json({ error: 'Garden not found' });
      }

      await GardenService.update(garden, req.body);

      return res.status(200).json(garden);
    } catch (error) {
      logApi.error('Error updating garden', {
        gardenId: req.params.id,
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to update garden' });
    }
  }
);

// Delete garden
router.delete(
  '/:id',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid garden ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const garden = await GardenService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );

      if (!garden) {
        return res.status(404).json({ error: 'Garden not found' });
      }

      await GardenService.delete(garden);

      return res.status(200).json({ message: 'Garden deleted successfully' });
    } catch (error) {
      logApi.error('Error deleting garden', {
        gardenId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to delete garden' });
    }
  }
);

// Add plot to garden
router.post(
  '/:id/plots',
  authenticateJWT,
  validatePlotCreate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify garden exists and belongs to user
      const garden = await GardenService.findByIdAndUserWithPlots(
        req.params.id,
        req.user!.id
      );

      if (!garden) {
        return res.status(404).json({ error: 'Garden not found' });
      }

      // Verify plot is within garden bounds
      if (
        req.body.x < 0 ||
        req.body.y < 0 ||
        req.body.x + req.body.width > Number(garden.width) ||
        req.body.y + req.body.height > Number(garden.height)
      ) {
        return res.status(400).json({
          error: 'Plot extends beyond garden boundaries',
        });
      }

      // Check for plot overlap
      const plots = (garden as any).plots || [];
      if (checkPlotOverlap(req.body, plots)) {
        return res.status(400).json({
          error: 'Plot overlaps with existing plot',
        });
      }

      // Verify plant profile exists if provided
      if (req.body.plant_profile_id) {
        const profile = await GardenService.findPlantProfileById(
          req.body.plant_profile_id
        );
        if (!profile) {
          return res.status(404).json({ error: 'Plant profile not found' });
        }
      }

      const createdPlot = await GardenService.createPlot(
        req.params.id,
        req.body as PlotData
      );

      return res.status(201).json(createdPlot);
    } catch (error) {
      logApi.error('Error creating plot', {
        gardenId: req.params.id,
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to create plot' });
    }
  }
);

// Update plot
router.put(
  '/:id/plots/:plotId',
  authenticateJWT,
  validatePlotUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify garden exists and belongs to user
      const garden = await GardenService.findByIdAndUserWithPlots(
        req.params.id,
        req.user!.id
      );

      if (!garden) {
        return res.status(404).json({ error: 'Garden not found' });
      }

      // Find plot
      const plot = await GardenService.findPlotByIdAndGarden(
        req.params.plotId,
        req.params.id
      );

      if (!plot) {
        return res.status(404).json({ error: 'Plot not found' });
      }

      const updatedData = {
        x: req.body.x !== undefined ? req.body.x : Number(plot.x),
        y: req.body.y !== undefined ? req.body.y : Number(plot.y),
        width:
          req.body.width !== undefined ? req.body.width : Number(plot.width),
        height:
          req.body.height !== undefined ? req.body.height : Number(plot.height),
      };

      // Verify plot is within garden bounds
      const gardenWidth = parseFloat(String(garden.width));
      const gardenHeight = parseFloat(String(garden.height));

      if (
        updatedData.x < 0 ||
        updatedData.y < 0 ||
        updatedData.x + updatedData.width > gardenWidth ||
        updatedData.y + updatedData.height > gardenHeight
      ) {
        // Provide detailed error messages
        const errorMessages: string[] = [];
        if (updatedData.x < 0)
          errorMessages.push('X coordinate cannot be negative');
        if (updatedData.y < 0)
          errorMessages.push('Y coordinate cannot be negative');
        if (updatedData.x + updatedData.width > gardenWidth) {
          const overhang = (
            updatedData.x +
            updatedData.width -
            gardenWidth
          ).toFixed(1);
          errorMessages.push(
            `Plot extends ${overhang} ft beyond the eastern boundary (garden width: ${gardenWidth} ft)`
          );
        }
        if (updatedData.y + updatedData.height > gardenHeight) {
          const overhang = (
            updatedData.y +
            updatedData.height -
            gardenHeight
          ).toFixed(1);
          errorMessages.push(
            `Plot extends ${overhang} ft beyond the southern boundary (garden height: ${gardenHeight} ft)`
          );
        }

        return res.status(400).json({
          error:
            errorMessages.length > 0
              ? errorMessages.join('. ')
              : 'Plot extends beyond garden boundaries',
        });
      }

      // Check for plot overlap (excluding this plot)
      const plots = (garden as any).plots || [];
      if (checkPlotOverlap(updatedData, plots, plot.id)) {
        return res.status(400).json({
          error: 'Plot overlaps with existing plot',
        });
      }

      // Verify plant profile exists if provided
      if (req.body.plant_profile_id) {
        const profile = await GardenService.findPlantProfileById(
          req.body.plant_profile_id
        );
        if (!profile) {
          return res.status(404).json({ error: 'Plant profile not found' });
        }
      }

      const updatedPlot = await GardenService.updatePlot(plot, req.body);

      return res.status(200).json(updatedPlot);
    } catch (error) {
      logApi.error('Error updating plot', {
        gardenId: req.params.id,
        plotId: req.params.plotId,
        userId: req.user?.id,
        requestBody: req.body,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to update plot' });
    }
  }
);

// Delete plot
router.delete(
  '/:id/plots/:plotId',
  authenticateJWT,
  [
    param('id').isUUID().withMessage('Invalid garden ID'),
    param('plotId').isUUID().withMessage('Invalid plot ID'),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify garden exists and belongs to user
      const garden = await GardenService.findByIdAndUserSimple(
        req.params.id,
        req.user!.id
      );

      if (!garden) {
        return res.status(404).json({ error: 'Garden not found' });
      }

      // Find plot
      const plot = await GardenService.findPlotByIdAndGarden(
        req.params.plotId,
        req.params.id
      );

      if (!plot) {
        return res.status(404).json({ error: 'Plot not found' });
      }

      await GardenService.deletePlot(plot);

      return res.status(200).json({ message: 'Plot deleted successfully' });
    } catch (error) {
      logApi.error('Error deleting plot', {
        gardenId: req.params.id,
        plotId: req.params.plotId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to delete plot' });
    }
  }
);

// Analyze garden layout and get AI-powered recommendations (async via queue)
router.post(
  '/:id/analyze',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid garden ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const gardenId = req.params.id;
      const userId = req.user!.id;

      // Check if user can analyze (includes feature flag, pending check, and limit check)
      const limitCheck = await analysisLimitService.checkCanAnalyze(userId);

      if (!limitCheck.canAnalyze) {
        // Feature flag disabled
        if (limitCheck.reason === 'feature_disabled') {
          return res.status(403).json({
            error: 'AI analysis is disabled for your account',
            reason: limitCheck.reason,
          });
        }

        // Analysis already in progress
        if (limitCheck.hasPending) {
          return res.status(409).json({
            error:
              'An analysis is already in progress. Please wait for it to complete.',
            reason: limitCheck.reason,
          });
        }

        // Daily limit reached
        if (limitCheck.reason === 'limit_reached') {
          return res.status(429).json({
            error:
              'Daily analysis limit reached. Your limit will reset at midnight in your timezone.',
            remaining: limitCheck.remaining,
            reason: limitCheck.reason,
          });
        }

        // Generic error
        return res.status(403).json({
          error: 'Cannot perform analysis at this time',
          reason: limitCheck.reason,
        });
      }

      // Verify garden ownership
      const garden = await GardenService.findByIdAndUserSimple(
        gardenId,
        userId
      );

      if (!garden) {
        return res.status(404).json({ error: 'Garden not found' });
      }

      // Enqueue garden analysis job using singleton queue
      logApi.info('Enqueueing garden analysis job', {
        gardenId,
        userId,
        gardenName: garden.name,
        triggeredBy: 'manual_request',
      });

      const job = await queueGardenAnalysisJob({
        gardenId,
        userId,
        triggeredBy: 'manual_request',
        timestamp: new Date().toISOString(),
      });

      // Increment usage count after successfully enqueueing
      await analysisLimitService.incrementUsage(userId);

      // Get updated remaining count
      const updatedCheck = await analysisLimitService.checkCanAnalyze(userId);

      logApi.info('Garden analysis job enqueued successfully', {
        gardenId,
        userId,
        jobId: job.id,
        remainingAnalyses: updatedCheck.remaining,
      });

      // Return 202 Accepted with job ID and remaining analyses
      // User will receive results via WebSocket when analysis completes
      return res.status(202).json({
        message: 'Garden analysis has been queued',
        jobId: job.id,
        status: 'pending',
        gardenId,
        remainingAnalyses: updatedCheck.remaining,
      });
    } catch (error) {
      logApi.error('Error queueing garden analysis', {
        gardenId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to queue garden analysis' });
    }
  }
);

// Get current garden analysis results
router.get(
  '/:id/analysis',
  authenticateJWT,
  [param('id').isUUID().withMessage('Invalid garden ID')],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const gardenId = req.params.id;
      const userId = req.user!.id;

      // Verify garden ownership
      const garden = await GardenService.findByIdAndUserSimple(
        gardenId,
        userId
      );

      if (!garden) {
        return res.status(404).json({ error: 'Garden not found' });
      }

      // Fetch most recent analysis for this garden
      const analysis = await GardenService.getCurrentAnalysis(gardenId);

      if (!analysis) {
        return res.status(404).json({
          error: 'No analysis found for this garden',
          message: "Click 'Analyze Garden' to generate recommendations",
        });
      }

      // Return analysis data
      return res.status(200).json({
        suggestions: analysis.suggestions,
        overallScore: analysis.overall_score,
        summary: analysis.summary,
        analyzedAt: analysis.analyzed_at,
      });
    } catch (error) {
      logApi.error('Error fetching garden analysis', {
        gardenId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to fetch garden analysis' });
    }
  }
);

// Generate garden layout with AI-powered optimization (async via queue)
router.post(
  '/:id/generate-layout',
  authenticateJWT,
  [
    param('id').isUUID().withMessage('Invalid garden ID'),
    body('plantProfileIds')
      .isArray({ min: 1 })
      .withMessage('At least one plant must be selected'),
    body('plantProfileIds.*').isUUID().withMessage('Invalid plant profile ID'),
    body('sunZones')
      .optional()
      .isArray()
      .withMessage('Sun zones must be an array'),
    body('preferences')
      .optional()
      .isObject()
      .withMessage('Preferences must be an object'),
    body('preferences.optimizationGoal')
      .optional()
      .isIn(['max_yield', 'max_variety', 'beginner_friendly'])
      .withMessage('Invalid optimization goal'),
    body('preferences.spacingMethod')
      .optional()
      .isIn(['intensive', 'square_foot', 'traditional'])
      .withMessage('Invalid spacing method'),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const gardenId = req.params.id;
      const userId = req.user!.id;
      const { plantProfileIds, sunZones = [], preferences = {} } = req.body;

      // Verify garden ownership
      const garden = await GardenService.findByIdAndUserSimple(
        gardenId,
        userId
      );

      if (!garden) {
        return res.status(404).json({ error: 'Garden not found' });
      }

      // Validate plant profiles exist
      const plants =
        await GardenService.findPlantProfilesByIds(plantProfileIds);

      if (plants.length !== plantProfileIds.length) {
        return res.status(400).json({
          error: 'One or more plant profiles not found',
        });
      }

      // Set defaults for preferences
      const layoutPreferences = {
        optimizationGoal: preferences.optimizationGoal || 'max_yield',
        spacingMethod: preferences.spacingMethod || 'intensive',
      };

      // Enqueue layout generation job
      logApi.info('Enqueueing layout generation job', {
        gardenId,
        userId,
        plantCount: plantProfileIds.length,
        preferences: layoutPreferences,
      });

      const job = await queueLayoutGenerationJob({
        gardenId,
        userId,
        plantProfileIds,
        sunZones,
        preferences: layoutPreferences,
      });

      logApi.info('Layout generation job enqueued successfully', {
        gardenId,
        userId,
        jobId: job.id,
      });

      // Return 202 Accepted with job ID
      // User will receive results via WebSocket when generation completes
      return res.status(202).json({
        message: 'Layout generation has been queued',
        jobId: job.id,
        status: 'queued',
        gardenId,
      });
    } catch (error) {
      logApi.error('Error queueing layout generation', {
        gardenId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res
        .status(500)
        .json({ error: 'Failed to queue layout generation' });
    }
  }
);

// Apply a generated layout to a garden (create plots from layout)
router.post(
  '/:id/apply-layout',
  authenticateJWT,
  [
    param('id').isUUID().withMessage('Invalid garden ID'),
    body('layoutOption').isObject().withMessage('Layout option is required'),
    body('layoutOption.placements')
      .isArray({ min: 1 })
      .withMessage('At least one plant placement is required'),
    body('layoutOption.placements.*.plantProfileId')
      .isUUID()
      .withMessage('Invalid plant profile ID'),
    body('layoutOption.placements.*.x')
      .isFloat({ min: 0 })
      .withMessage('X coordinate must be 0 or greater'),
    body('layoutOption.placements.*.y')
      .isFloat({ min: 0 })
      .withMessage('Y coordinate must be 0 or greater'),
    body('layoutOption.placements.*.width')
      .isFloat({ min: 0.1, max: 1000 })
      .withMessage('Width must be between 0.1 and 1000 feet'),
    body('layoutOption.placements.*.height')
      .isFloat({ min: 0.1, max: 1000 })
      .withMessage('Height must be between 0.1 and 1000 feet'),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const gardenId = req.params.id;
      const userId = req.user!.id;
      const { layoutOption } = req.body;

      // Verify garden ownership
      const garden = await GardenService.findByIdAndUserWithPlots(
        gardenId,
        userId
      );

      if (!garden) {
        return res.status(404).json({ error: 'Garden not found' });
      }

      // Validate all plant profiles exist
      const plantProfileIds = [
        ...new Set(layoutOption.placements.map((p: any) => p.plantProfileId)),
      ];
      const plants = await GardenService.findPlantProfilesByIds(
        plantProfileIds as string[]
      );

      if (plants.length !== plantProfileIds.length) {
        return res.status(400).json({
          error: 'One or more plant profiles not found',
        });
      }

      // Validate all placements are within garden bounds
      const existingPlots = (garden as any).plots || [];
      const invalidPlacements = layoutOption.placements.filter((p: any) => {
        return (
          p.x < 0 ||
          p.y < 0 ||
          p.x + p.width > Number(garden.width) ||
          p.y + p.height > Number(garden.height)
        );
      });

      if (invalidPlacements.length > 0) {
        return res.status(400).json({
          error: `${invalidPlacements.length} placement(s) extend beyond garden boundaries`,
        });
      }

      // Check for overlaps with existing plots
      const overlappingPlacements = layoutOption.placements.filter((p: any) => {
        return checkPlotOverlap(p, existingPlots);
      });

      if (overlappingPlacements.length > 0) {
        return res.status(400).json({
          error: `${overlappingPlacements.length} placement(s) overlap with existing plots`,
          overlappingPlacements: overlappingPlacements.map((p: any) => ({
            plantProfileId: p.plantProfileId,
            plantName: p.plantName,
            x: p.x,
            y: p.y,
          })),
        });
      }

      logApi.info('Applying layout to garden', {
        gardenId,
        userId,
        placementCount: layoutOption.placements.length,
        optimizationGoal: layoutOption.optimizationGoal,
      });

      // Create plots from placements
      const plotsToCreate = layoutOption.placements.map((placement: any) => ({
        garden_id: gardenId,
        plant_profile_id: placement.plantProfileId,
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        status: 'planned',
        notes: placement.plantingInstructions || null,
      }));

      const plotsWithProfiles =
        await GardenService.bulkCreatePlots(plotsToCreate);

      logApi.info('Layout applied successfully', {
        gardenId,
        userId,
        plotsCreated: plotsWithProfiles.length,
      });

      return res.status(201).json({
        message: 'Layout applied successfully',
        plotsCreated: plotsWithProfiles.length,
        plots: plotsWithProfiles,
      });
    } catch (error) {
      logApi.error('Error applying layout', {
        gardenId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: 'Failed to apply layout' });
    }
  }
);

export default router;
