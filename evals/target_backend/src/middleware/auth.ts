import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { User } from "../models";
import { logApi } from "../services/logging/logger";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      token?: string;
    }
  }
}

interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    // Try to get token from cookie first, then from Authorization header
    let token = req.cookies?.accessToken;
    const tokenSource = token ? 'cookie' : 'header';

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    logApi.debug('Token extraction attempt', {
      source: tokenSource,
      hasToken: !!token,
      hasCookie: !!req.cookies?.accessToken,
      hasAuthHeader: !!req.headers.authorization
    });

    if (!token) {
      logApi.warn('Authentication failed: missing token', {
        path: req.path,
        method: req.method
      });
      return res.status(401).json({
        error: "No token provided",
      });
    }

    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Find user and attach to request
    const user = await User.findByPk(payload.userId);
    if (!user) {
      logApi.warn('Authentication failed: user not found', {
        userId: payload.userId,
        path: req.path
      });
      return res.status(401).json({
        error: "User not found",
      });
    }

    // Attach user and token to request
    req.user = user;
    req.token = token;

    logApi.debug('Authentication successful', {
      userId: user.id,
      email: user.email,
      tokenSource,
      path: req.path
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logApi.warn('Authentication failed: invalid token', {
        errorType: 'JsonWebTokenError',
        message: error.message,
        path: req.path
      });
      return res.status(401).json({
        error: "Invalid token",
      });
    }
    if (error instanceof jwt.TokenExpiredError) {
      logApi.warn('Authentication failed: token expired', {
        errorType: 'TokenExpiredError',
        expiredAt: error.expiredAt,
        path: req.path
      });
      return res.status(401).json({
        error: "Token expired",
      });
    }
    logApi.error('Auth middleware error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path,
      method: req.method
    });
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

// Optional auth middleware that doesn't require a valid token
export const optionalAuthJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Try to get token from cookie first, then from Authorization header
    let token = req.cookies?.accessToken;
    const tokenSource = token ? 'cookie' : 'header';

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      logApi.debug('Optional auth: continuing without token', {
        path: req.path,
        method: req.method
      });
      return next();
    }

    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

    const user = await User.findByPk(payload.userId);
    if (user) {
      req.user = user;
      req.token = token;
      logApi.debug('Optional auth: authentication successful', {
        userId: user.id,
        tokenSource,
        path: req.path
      });
    } else {
      logApi.debug('Optional auth: user not found, continuing without auth', {
        userId: payload.userId,
        path: req.path
      });
    }

    next();
  } catch (error) {
    // Continue without authentication
    logApi.debug('Optional auth: token invalid, continuing without auth', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path
    });
    next();
  }
};
