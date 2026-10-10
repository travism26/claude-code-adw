import { Router, Request, Response } from "express";
import { query, validationResult } from "express-validator";
import { authenticateJWT } from "../middleware";
import { RecommendationService } from "../services/RecommendationService";
import {
  generateRecommendationsForUser,
  generateRecommendationsForAllUsers,
} from "../services/recommendationGenerator";
import { logApi } from "../services/logging/logger";

const router: Router = Router();

// Get recommendations for current user
router.get(
  "/",
  authenticateJWT,
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("severity")
      .optional()
      .isIn(["low", "medium", "high"])
      .withMessage("Invalid severity"),
    query("type")
      .optional()
      .isIn(["water", "fertilize", "prune", "pest_check", "harvest", "general"])
      .withMessage("Invalid type"),
  ],
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const limit = parseInt(req.query.limit as string) || 20;

      const recommendations = await RecommendationService.findByUser({
        userId: req.user!.id,
        limit,
        severity: req.query.severity as string,
        type: req.query.type as string,
      });

      return res.status(200).json(recommendations);
    } catch (error) {
      logApi.error("Error fetching recommendations", {
        userId: req.user?.id,
        filters: {
          limit: req.query.limit,
          severity: req.query.severity,
          type: req.query.type,
        },
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  }
);

// Get recommendation counts by severity
router.get(
  "/summary",
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const summary = await RecommendationService.getSummary(req.user!.id);
      return res.status(200).json(summary);
    } catch (error) {
      logApi.error("Error fetching recommendation summary", {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res
        .status(500)
        .json({ error: "Failed to fetch recommendation summary" });
    }
  }
);

// Manually trigger recommendation generation for current user
router.post(
  "/generate",
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      // Delete existing recommendations for user
      await RecommendationService.deleteByUser(req.user!.id);

      // Generate new recommendations
      const recommendations = await generateRecommendationsForUser(
        req.user!.id
      );

      logApi.info("Recommendations generated for user", {
        userId: req.user!.id,
        recommendationCount: recommendations.length,
      });

      return res.status(200).json({
        message: "Recommendations generated successfully",
        count: recommendations.length,
        recommendations,
      });
    } catch (error) {
      logApi.error("Error generating recommendations", {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res
        .status(500)
        .json({ error: "Failed to generate recommendations" });
    }
  }
);

// Manually trigger recommendation generation for all users (admin/testing)
router.post(
  "/generate-all",
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      // In a production system, you'd want to check for admin role here
      const count = await generateRecommendationsForAllUsers();

      logApi.info("Recommendations generated for all users", {
        userId: req.user?.id,
        totalRecommendations: count,
      });

      return res.status(200).json({
        message: "Recommendations generated for all users",
        totalRecommendations: count,
      });
    } catch (error) {
      logApi.error("Error generating recommendations for all users", {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res
        .status(500)
        .json({ error: "Failed to generate recommendations" });
    }
  }
);

// Delete recommendation (mark as dismissed)
router.delete(
  "/:id",
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const recommendation = await RecommendationService.findByIdAndUser(
        req.params.id,
        req.user!.id
      );

      if (!recommendation) {
        return res.status(404).json({ error: "Recommendation not found" });
      }

      await RecommendationService.delete(recommendation);

      return res
        .status(200)
        .json({ message: "Recommendation dismissed successfully" });
    } catch (error) {
      logApi.error("Error deleting recommendation", {
        recommendationId: req.params.id,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({ error: "Failed to delete recommendation" });
    }
  }
);

export default router;
