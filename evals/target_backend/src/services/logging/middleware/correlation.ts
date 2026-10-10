import { Request, Response, NextFunction } from 'express';
import { generateCorrelationId, runWithCorrelationId } from '../correlation';

/**
 * Correlation ID middleware
 * Extracts correlation ID from request header or generates a new one
 * Sets up AsyncLocalStorage context for the entire request lifecycle
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Extract correlation ID from header (case-insensitive)
  const correlationId =
    req.headers['x-correlation-id'] ||
    req.headers['X-Correlation-ID'] ||
    generateCorrelationId();

  // Ensure correlationId is a string (headers can be string | string[] | undefined)
  const id = Array.isArray(correlationId) ? correlationId[0] : String(correlationId);

  // Add correlation ID to response header
  res.setHeader('X-Correlation-ID', id);

  // Run the rest of the request handling in the correlation context
  runWithCorrelationId(id, async () => {
    next();
  }).catch((error) => {
    // If there's an error in the async context setup, pass it to error handler
    next(error);
  });
}
