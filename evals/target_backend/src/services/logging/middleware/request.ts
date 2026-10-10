import { Request, Response, NextFunction } from 'express';
import { logApi } from '../logger';

/**
 * Request logging middleware
 * Logs incoming HTTP requests and their responses
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log incoming request
  logApi.info('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    userId: (req as any).user?.id,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  });

  // Capture response using 'finish' event
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;

    // Determine log level based on status code
    let logLevel: 'error' | 'warn' | 'info' = 'info';
    if (statusCode >= 500) {
      logLevel = 'error';
    } else if (statusCode >= 400) {
      logLevel = 'warn';
    }

    const message = 'Request completed';
    const metadata = {
      method: req.method,
      path: req.path,
      statusCode,
      duration,
      userId: (req as any).user?.id,
    };

    logApi[logLevel](message, metadata);
  });

  next();
}
