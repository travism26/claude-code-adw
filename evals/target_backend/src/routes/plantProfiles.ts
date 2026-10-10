import { Router, Request, Response } from "express";
import { param, query, validationResult } from "express-validator";
import { authenticateJWT } from "../middleware";
import { PlantProfileService } from "../services/PlantProfileService";
import { logApi } from "../services/logging/logger";

const router: Router = Router();

// Validation middleware for search query
const validateSearch = [
  query("q")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Search query must be at least 1 character"),
];

// Validation middleware for list query parameters
const validateListQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("type")
    .optional()
    .isIn([
      "vegetable",
      "herb",
      "flower",
      "fruit",
      "houseplant",
      "tree",
      "shrub",
    ])
    .withMessage("Invalid plant type"),
  query("difficulty")
    .optional()
    .isIn(["easy", "moderate", "challenging"])
    .withMessage("Invalid difficulty level"),
  query("zone")
    .optional()
    .isInt({ min: 1, max: 13 })
    .withMessage("Zone must be between 1 and 13"),
  query("search")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Search must be at least 1 character"),
];

// Validation middleware for plant profile ID
const validateProfileId = [
  param("id").custom((_value) => {
    // Allow any value to pass validation, we'll check existence in the route handler
    return true;
  }),
];

// Get all plant profiles with pagination and filtering
router.get(
  "/",
  authenticateJWT,
  validateListQuery,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string;
      const difficulty = req.query.difficulty as string;
      const zone = req.query.zone ? parseInt(req.query.zone as string) : undefined;
      const search = req.query.search as string;

      logApi.debug("Plant profiles query", {
        userId: req.user?.id,
        filters: { type, difficulty, zone, search },
        page,
        limit,
      });

      const result = await PlantProfileService.findAll({
        page,
        limit,
        type,
        difficulty,
        zone,
        search,
      });

      logApi.debug("Plant profiles query results", {
        userId: req.user?.id,
        resultCount: result.total,
        returnedCount: result.plantProfiles.length,
        page,
        limit,
      });

      return res.json(result);
    } catch (error) {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string;
      const difficulty = req.query.difficulty as string;
      const zone = req.query.zone ? parseInt(req.query.zone as string) : null;
      const search = req.query.search as string;

      logApi.error("Get plant profiles error", {
        userId: req.user?.id,
        filters: { type, difficulty, zone, search },
        page,
        limit,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error retrieving plant profiles",
      });
    }
  }
);

// Search plant profiles by name/species
router.get(
  "/search",
  authenticateJWT,
  validateSearch,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const searchQuery = req.query.q as string;

      if (!searchQuery) {
        return res.status(400).json({
          error: "Search query parameter 'q' is required",
        });
      }

      const profiles = await PlantProfileService.search(searchQuery);

      return res.json(profiles);
    } catch (error) {
      const searchQuery = req.query.q as string;

      logApi.error("Search plant profiles error", {
        userId: req.user?.id,
        searchQuery,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error searching plant profiles",
      });
    }
  }
);

// Get single plant profile with seasonal tips
router.get(
  "/:id",
  authenticateJWT,
  validateProfileId,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await PlantProfileService.findByIdWithTips(req.params.id);

      if (!result) {
        return res.status(404).json({
          error: "Plant profile not found",
        });
      }

      return res.json({
        profile: result.profile,
        seasonalTips: result.tips,
      });
    } catch (error) {
      logApi.error("Get plant profile error", {
        userId: req.user?.id,
        profileId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error retrieving plant profile",
      });
    }
  }
);

export default router;
