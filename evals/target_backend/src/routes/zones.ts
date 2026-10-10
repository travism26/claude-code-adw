import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { authenticateJWT } from "../middleware";
import { detectZone, updateUserZone } from "../services/zoneDetection";
import { UserService } from "../services/UserService";
import { logApi } from "../services/logging/logger";

const router: Router = Router();

// Validation middleware for zone detection
const validatePostalCode = [
  body("postal_code")
    .trim()
    .notEmpty()
    .withMessage("Postal code is required")
    .isLength({ min: 3, max: 20 })
    .withMessage("Postal code must be between 3 and 20 characters"),
];

// Validation middleware for zone update
const validateZoneUpdate = [
  body("growing_zone")
    .trim()
    .notEmpty()
    .withMessage("Growing zone is required")
    .matches(/^([1-9]|1[0-3])[ab]?$/)
    .withMessage("Growing zone must be in format like '6a', '7b', or '10'"),
  body("postal_code")
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage("Postal code must be between 3 and 20 characters"),
  body("zone_override")
    .optional()
    .isBoolean()
    .withMessage("Zone override must be a boolean value"),
];

// Detect zone from postal code
router.post(
  "/detect",
  authenticateJWT,
  validatePostalCode,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { postal_code } = req.body;

      const result = await detectZone(postal_code);

      if (result.zone === null) {
        return res.status(400).json({
          message: "Could not detect zone for the provided postal code",
          postal_code,
        });
      }

      return res.json({
        zone: result.zone.toString(),
        postal_code,
      });
    } catch (error) {
      logApi.error("Detect zone error", {
        userId: req.user!.id,
        postalCode: req.body.postal_code,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error detecting zone",
      });
    }
  }
);

// Get current user's zone settings
router.get(
  "/user",
  authenticateJWT,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.id;

      // Get the user zone data via service
      const zoneData = await UserService.getUserZoneData(userId);

      return res.json({
        growing_zone: zoneData?.growing_zone || null,
        postal_code: zoneData?.postal_code || null,
        zone_override: zoneData?.zone_override || false,
      });
    } catch (error) {
      logApi.error("Get user zone error", {
        userId: req.user!.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error retrieving user zone",
      });
    }
  }
);

// Update user's zone
router.put(
  "/user",
  authenticateJWT,
  validateZoneUpdate,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { growing_zone, postal_code, zone_override } = req.body;

      const user = await updateUserZone(
        req.user!.id,
        growing_zone,
        postal_code,
        zone_override || false
      );

      return res.json({
        growing_zone: growing_zone,
        postal_code: user.postal_code,
        zone_override: user.zone_override,
      });
    } catch (error) {
      logApi.error("Update user zone error", {
        userId: req.user!.id,
        growingZone: req.body.growing_zone,
        postalCode: req.body.postal_code,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (error instanceof Error && error.message.includes("Invalid zone")) {
        return res.status(400).json({
          error: error.message,
        });
      }
      return res.status(500).json({
        error: "Error updating user zone",
      });
    }
  }
);

export default router;
