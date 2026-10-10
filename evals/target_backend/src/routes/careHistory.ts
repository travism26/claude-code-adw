import { Router, Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { authenticateJWT } from "../middleware";
import { CareHistoryService } from "../services/CareHistoryService";
import { regenerateRemindersAfterCare } from "../services/reminderGenerator";
import { logApi } from "../services/logging/logger";

const router: Router = Router();

// Validation middleware for creating care history
const validateCareHistoryCreate = [
  body("plant_id")
    .isUUID()
    .withMessage("Valid plant ID is required"),
  body("action_type")
    .isIn(["water", "fertilize", "prune", "harvest", "transplant", "pest_control", "other"])
    .withMessage("Invalid action type"),
  body("action_date")
    .optional()
    .isISO8601()
    .withMessage("Action date must be a valid ISO 8601 date"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes must not exceed 1000 characters"),
];

// Validation middleware for plant ID parameter
const validatePlantId = [
  param("plantId").isUUID().withMessage("Invalid plant ID"),
];

// Validation middleware for care history ID parameter
const validateCareHistoryId = [
  param("id").custom((_value) => {
    // Allow any value to pass validation, we'll check existence in the route handler
    return true;
  }),
];

// Validation middleware for care history query parameters
const validateCareHistoryQuery = [
  query("action_type")
    .optional()
    .isIn(["water", "fertilize", "prune", "harvest", "transplant", "pest_control", "other"])
    .withMessage("Invalid action type"),
  query("start_date")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),
  query("end_date")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// Log a care action
router.post(
  "/",
  authenticateJWT,
  validateCareHistoryCreate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { plant_id, action_type, action_date, notes } = req.body;

      // Verify plant belongs to user
      const plant = await CareHistoryService.findPlantByIdAndUser(plant_id, req.user!.id);

      if (!plant) {
        return res.status(404).json({
          error: "Plant not found",
        });
      }

      // Create care history entry
      const careDate = action_date ? new Date(action_date) : new Date();

      const careHistory = await CareHistoryService.create({
        plant_id,
        user_id: req.user!.id,
        action_type,
        action_date: careDate,
        notes: notes || null,
      });

      // Update plant's last_watered or last_fertilized timestamp
      await CareHistoryService.updatePlantCareTimestamp(plant, action_type, careDate);

      // Regenerate reminders for water and fertilize actions
      if (action_type === "water" || action_type === "fertilize") {
        try {
          await regenerateRemindersAfterCare(plant_id, action_type, careDate);
        } catch (reminderError) {
          logApi.warn("Error regenerating reminders", {
            userId: req.user!.id,
            plantId: plant_id,
            actionType: action_type,
            error: reminderError instanceof Error ? reminderError.message : String(reminderError),
            stack: reminderError instanceof Error ? reminderError.stack : undefined,
          });
          // Don't fail the request if reminder generation fails
        }
      }

      return res.status(201).json(careHistory);
    } catch (error) {
      logApi.error("Create care history error", {
        userId: req.user!.id,
        plantId: req.body.plant_id,
        actionType: req.body.action_type,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error logging care action",
      });
    }
  }
);

// Get care history for a specific plant
router.get(
  "/plant/:plantId",
  authenticateJWT,
  validatePlantId,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { plantId } = req.params;

      // Verify plant belongs to user
      const plant = await CareHistoryService.findPlantByIdAndUser(plantId, req.user!.id);

      if (!plant) {
        return res.status(404).json({
          error: "Plant not found",
        });
      }

      const careHistory = await CareHistoryService.findByPlantId(plantId, req.user!.id);

      return res.json(careHistory);
    } catch (error) {
      logApi.error("Get plant care history error", {
        userId: req.user!.id,
        plantId: req.params.plantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error retrieving care history",
      });
    }
  }
);

// Get all care history for user with optional filters
router.get(
  "/",
  authenticateJWT,
  validateCareHistoryQuery,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const actionType = req.query.action_type as string;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;
      const limit = parseInt(req.query.limit as string) || 50;

      const careHistory = await CareHistoryService.findByUser({
        userId: req.user!.id,
        actionType,
        startDate,
        endDate,
        limit,
      });

      return res.json(careHistory);
    } catch (error) {
      const actionType = req.query.action_type as string;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;
      const limit = parseInt(req.query.limit as string) || 50;

      logApi.error("Get care history error", {
        userId: req.user!.id,
        filters: { action_type: actionType, start_date: startDate, end_date: endDate, limit },
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error retrieving care history",
      });
    }
  }
);

// Delete a care history entry
router.delete(
  "/:id",
  authenticateJWT,
  validateCareHistoryId,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const careHistory = await CareHistoryService.findByIdAndUser(req.params.id, req.user!.id);

      if (!careHistory) {
        return res.status(404).json({
          error: "Care history entry not found",
        });
      }

      await CareHistoryService.delete(careHistory);

      return res.json({
        message: "Care history entry deleted",
      });
    } catch (error) {
      logApi.error("Delete care history error", {
        userId: req.user!.id,
        careHistoryId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error deleting care history entry",
      });
    }
  }
);

export default router;
