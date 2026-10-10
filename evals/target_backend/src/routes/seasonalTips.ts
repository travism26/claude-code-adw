import { Router, Request, Response } from "express";
import { query, validationResult } from "express-validator";
import { authenticateJWT } from "../middleware";
import { PlantProfileService } from "../services/PlantProfileService";
import { logApi } from "../services/logging/logger";

const router: Router = Router();

// Validation middleware for seasonal tips query parameters
const validateTipsQuery = [
  query("zone")
    .optional()
    .isInt({ min: 1, max: 13 })
    .withMessage("Zone must be between 1 and 13"),
  query("season")
    .optional()
    .isIn(["spring", "summer", "fall", "winter", "year_round"])
    .withMessage("Invalid season"),
];

// Get seasonal tips filtered by zone and season
router.get(
  "/",
  authenticateJWT,
  validateTipsQuery,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const zone =
        req.query.zone !== undefined
          ? parseInt(req.query.zone as string, 10)
          : undefined;
      const season = (req.query.season as string) || undefined;

      const tips = await PlantProfileService.findSeasonalTips(zone, season);

      const mappedTips = tips.map((tip) => {
        const profile = (tip as any).plant_profile;
        return {
          id: tip.id,
          tip: tip.tip_text,
          season: tip.season,
          priority: tip.priority,
          zone: zone ?? null,
          applies_to_zones:
            tip.zone_min != null && tip.zone_max != null
              ? `${tip.zone_min}-${tip.zone_max}`
              : null,
          plant_profile: profile
            ? { id: profile.id, common_name: profile.common_name }
            : null,
          createdAt: tip.created_at,
          updatedAt: tip.updated_at,
        };
      });

      logApi.info("Fetched seasonal tips", {
        zone: zone ?? null,
        season: season ?? null,
        count: mappedTips.length,
      });

      return res.json({
        tips: mappedTips,
        zone: zone ?? null,
        season: season ?? null,
      });
    } catch (error: any) {
      logApi.error("Failed to fetch seasonal tips", {
        error: error?.message,
      });
      return res
        .status(500)
        .json({ error: "Failed to fetch seasonal tips" });
    }
  }
);

export default router;
