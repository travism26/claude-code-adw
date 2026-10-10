import { Router, Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import { COOKIE_OPTIONS, ACCESS_TOKEN_COOKIE_OPTIONS } from "../config/cookies";
import { setSecureCookie, clearAuthCookies } from "../utils/cookies";
import { UserService } from "../services/UserService";
import { logApi } from "../services/logging/logger";

const router: Router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Validation middleware
const validateSignup = [
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 8 }).trim(),
  body("timezone")
    .optional()
    .custom((value: string) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
        return true;
      } catch (e) {
        throw new Error("Invalid timezone");
      }
    }),
];

const validateLogin = [
  body("email").isEmail().normalizeEmail(),
  body("password").exists().trim(),
];

// Signup route
router.post(
  "/signup",
  validateSignup,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, timezone = "UTC" } = req.body;

      // Check if user already exists
      const existingUser = await UserService.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: "Email already registered",
        });
      }

      // Create new user
      const user = await UserService.create({
        email,
        password_hash: password, // Will be hashed by model hook
        tz: timezone,
      });

      // Generate JWT
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "15m" } // Short-lived access token
      );

      const refreshToken = jwt.sign(
        { userId: user.id, type: "refresh" },
        JWT_SECRET,
        { expiresIn: "7d" } // Long-lived refresh token
      );

      // Store refresh token in database
      await UserService.updateRefreshToken(user.id, refreshToken);

      setSecureCookie(
        res,
        "accessToken",
        accessToken,
        ACCESS_TOKEN_COOKIE_OPTIONS
      );
      setSecureCookie(res, "refreshToken", refreshToken, COOKIE_OPTIONS);

      return res.status(201).json({
        message: "User created successfully",
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          timezone: user.tz,
        },
      });
    } catch (error) {
      logApi.error("Signup error", {
        email: req.body.email,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error creating user",
      });
    }
  }
);

// Login route
router.post(
  "/login",
  validateLogin,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const user = await UserService.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          error: "Invalid credentials",
        });
      }

      // Validate password
      const isValid = await UserService.validatePassword(user, password);
      if (!isValid) {
        return res.status(401).json({
          error: "Invalid credentials",
        });
      }

      // Generate JWT
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "15m" } // Short-lived access token
      );

      const refreshToken = jwt.sign(
        { userId: user.id, type: "refresh" },
        JWT_SECRET,
        { expiresIn: "7d" } // Long-lived refresh token
      );

      // Store refresh token in database
      await UserService.updateRefreshToken(user.id, refreshToken);

      setSecureCookie(
        res,
        "accessToken",
        accessToken,
        ACCESS_TOKEN_COOKIE_OPTIONS
      );
      setSecureCookie(res, "refreshToken", refreshToken, COOKIE_OPTIONS);

      return res.json({
        message: "Login successful",
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          timezone: user.tz,
        },
      });
    } catch (error) {
      logApi.error("Login error", {
        email: req.body.email,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).json({
        error: "Error during login",
      });
    }
  }
);

// Refresh token route
router.post("/refresh", async (req: Request, res: Response) => {
  // Try to get refresh token from cookie first, then from body
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: "No refresh token provided" });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
    const user = await UserService.findById(decoded.userId);

    if (!user || user.refresh_token !== refreshToken) {
      clearAuthCookies(res);
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Generate new tokens
    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    await UserService.updateRefreshToken(user.id, newRefreshToken);

    // Set cookies
    setSecureCookie(
      res,
      "accessToken",
      newAccessToken,
      ACCESS_TOKEN_COOKIE_OPTIONS
    );
    setSecureCookie(res, "refreshToken", newRefreshToken, COOKIE_OPTIONS);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    clearAuthCookies(res);
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

// Logout route
router.post("/logout", async (req: Request, res: Response) => {
  try {
    // Clear cookies
    clearAuthCookies(res);

    // If we have a refresh token, invalidate it in the database
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
        const user = await UserService.findById(decoded.userId);
        if (user && user.refresh_token === refreshToken) {
          await UserService.updateRefreshToken(user.id, null);
        }
      } catch (error) {
        // Token is invalid, which is fine for logout
      }
    }

    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    logApi.error("Logout error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({ error: "Error during logout" });
  }
});

export default router;
