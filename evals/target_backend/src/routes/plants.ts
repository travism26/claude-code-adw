import { Router, Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authenticateJWT } from "../middleware";
import { PlantService } from "../services/PlantService";
import { PlantProfileService } from "../services/PlantProfileService";
import { generateRemindersForPlant } from "../services/reminderGenerator";
import { logApi } from "../services/logging/logger";

const router: Router = Router();

// Validation middleware
const validatePlantCreate = [
  body("name").trim().notEmpty().withMessage("Plant name is required"),
  body("type")
    .isIn(["indoor", "outdoor"])
    .withMessage("Plant type must be indoor or outdoor"),
  body("water_interval_days")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Water interval must be between 1 and 365 days"),
  body("fert_interval_days")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Fertilizer interval must be between 1 and 365 days"),
  body("species").optional().trim(),
  body("photo_url")
    .optional()
    .isURL()
    .withMessage("Photo URL must be a valid URL"),
  body("plant_profile_id")
    .optional()
    .isUUID()
    .withMessage("Plant profile ID must be a valid UUID"),
];

const validatePlantUpdate = [
  param("id").isUUID().withMessage("Invalid plant ID"),
  ...validatePlantCreate.map((validation) => validation.optional()),
];

// Create plant
router.post(
  "/",
  authenticateJWT,
  validatePlantCreate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let plantData: any = {
        ...req.body,
        user_id: req.user!.id,
      };

      // If plant_profile_id is provided, auto-populate care intervals from profile
      if (req.body.plant_profile_id) {
        const profile = await PlantProfileService.findById(req.body.plant_profile_id);
        if (!profile) {
          return res.status(404).json({
            error: "Plant profile not found",
          });
        }

        // Use profile defaults unless overridden by user
        plantData = {
          ...plantData,
          water_interval_days:
            req.body.water_interval_days || profile.default_water_interval_days,
          fert_interval_days:
            req.body.fert_interval_days || profile.default_fert_interval_days,
          species: req.body.species || profile.species,
        };
      } else {
        // Manual entry - water_interval_days is required
        if (!req.body.water_interval_days) {
          return res.status(400).json({
            error: "Water interval is required when not using a plant profile",
          });
        }
      }

      const plant = await PlantService.create(plantData);

      // Generate reminders for the new plant
      try {
        await generateRemindersForPlant(plant.id);
      } catch (reminderError) {
        logApi.warn("Error generating reminders", {
          userId: req.user!.id,
          plantId: plant.id,
          error: reminderError instanceof Error ? reminderError.message : String(reminderError),
          stack: reminderError instanceof Error ? reminderError.stack : undefined,
        });
        // Don't fail plant creation if reminder generation fails
      }

      return res.status(201).json({
        message: "Plant created successfully",
        plant,
      });
    } catch (error) {
      logApi.error("Create plant error", {
        userId: req.user!.id,
        plantName: req.body.name,
        plantType: req.body.type,
        plantProfileId: req.body.plant_profile_id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error creating plant",
      });
    }
  }
);

// Get all plants for user
router.get(
  "/",
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const plants = await PlantService.findAllByUser(req.user!.id);

      return res.json({
        plants,
      });
    } catch (error) {
      logApi.error("Get plants error", {
        userId: req.user!.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error retrieving plants",
      });
    }
  }
);

// Get single plant
router.get(
  "/:id",
  authenticateJWT,
  param("id").isUUID().withMessage("Invalid plant ID"),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const plant = await PlantService.findByIdAndUser(req.params.id, req.user!.id);

      if (!plant) {
        return res.status(404).json({
          error: "Plant not found",
        });
      }

      return res.json({
        plant,
      });
    } catch (error) {
      logApi.error("Get plant error", {
        userId: req.user!.id,
        plantId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error retrieving plant",
      });
    }
  }
);

// Update plant
router.put(
  "/:id",
  authenticateJWT,
  validatePlantUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const plant = await PlantService.findByIdAndUser(req.params.id, req.user!.id);

      if (!plant) {
        return res.status(404).json({
          error: "Plant not found",
        });
      }

      await PlantService.update(plant, req.body);

      return res.json({
        message: "Plant updated successfully",
        plant,
      });
    } catch (error) {
      logApi.error("Update plant error", {
        userId: req.user!.id,
        plantId: req.params.id,
        updateFields: Object.keys(req.body),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error updating plant",
      });
    }
  }
);

// Delete plant
router.delete(
  "/:id",
  authenticateJWT,
  param("id").isUUID().withMessage("Invalid plant ID"),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const plant = await PlantService.findByIdAndUser(req.params.id, req.user!.id);

      if (!plant) {
        return res.status(404).json({
          error: "Plant not found",
        });
      }

      await PlantService.delete(plant);

      return res.json({
        message: "Plant deleted successfully",
      });
    } catch (error) {
      logApi.error("Delete plant error", {
        userId: req.user!.id,
        plantId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error deleting plant",
      });
    }
  }
);

export default router;
