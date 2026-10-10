import { Request, Response, NextFunction } from 'express';
import { logApi } from '../logger';

/**
 * Error logging middleware
 * Logs errors with full context including stack trace
 * Must be registered LAST in middleware chain (before generic error handler)
 */
export function errorLoggingMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logApi.error('Request error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    userId: (req as any).user?.id,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  });

  // Pass error to next error handler
  next(error);
}
