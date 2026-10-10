import winston from 'winston';
import fs from 'fs';
import { loggingConfig } from './config/logging';
import { getCorrelationId } from './correlation';
import { consoleTransport } from './transports/console';
import {
  apiTransports,
  workerTransports,
  aiTransports,
  queueTransports,
  frontendTransports,
} from './transports/file';

// Ensure logs directory exists
if (loggingConfig.fileEnabled && !fs.existsSync(loggingConfig.dir)) {
  fs.mkdirSync(loggingConfig.dir, { recursive: true });
}

/**
 * Enrich log metadata with correlation ID and system information
 */
function enrichMetadata(service: string, metadata: any = {}): any {
  return {
    service,
    environment: loggingConfig.environment,
    hostname: loggingConfig.hostname,
    pid: loggingConfig.pid,
    correlationId: getCorrelationId(),
    ...metadata,
  };
}

/**
 * Create a Winston logger for a specific service
 */
function createLogger(service: string, transports: winston.transport[]): winston.Logger {
  const loggerTransports: winston.transport[] = [];

  // Add file transports if enabled
  if (loggingConfig.fileEnabled) {
    loggerTransports.push(...transports);
  }

  // Add console transport if enabled
  if (loggingConfig.consoleEnabled) {
    loggerTransports.push(consoleTransport);
  }

  return winston.createLogger({
    level: loggingConfig.level,
    transports: loggerTransports,
    defaultMeta: {
      service,
      environment: loggingConfig.environment,
      hostname: loggingConfig.hostname,
      pid: loggingConfig.pid,
    },
  });
}

// Create service-specific loggers
const apiLogger = createLogger('api', apiTransports);
const workerLogger = createLogger('worker', workerTransports);
const aiLogger = createLogger('ai', aiTransports);
const queueLogger = createLogger('queue', queueTransports);
const frontendLogger = createLogger('frontend', frontendTransports);

/**
 * API service logger with automatic correlation ID enrichment
 */
export const logApi = {
  error: (message: string, metadata?: any) =>
    apiLogger.error(message, enrichMetadata('api', metadata)),
  warn: (message: string, metadata?: any) =>
    apiLogger.warn(message, enrichMetadata('api', metadata)),
  info: (message: string, metadata?: any) =>
    apiLogger.info(message, enrichMetadata('api', metadata)),
  debug: (message: string, metadata?: any) =>
    apiLogger.debug(message, enrichMetadata('api', metadata)),
};

/**
 * Worker service logger with automatic correlation ID enrichment
 */
export const logWorker = {
  error: (message: string, metadata?: any) =>
    workerLogger.error(message, enrichMetadata('worker', metadata)),
  warn: (message: string, metadata?: any) =>
    workerLogger.warn(message, enrichMetadata('worker', metadata)),
  info: (message: string, metadata?: any) =>
    workerLogger.info(message, enrichMetadata('worker', metadata)),
  debug: (message: string, metadata?: any) =>
    workerLogger.debug(message, enrichMetadata('worker', metadata)),
};

/**
 * AI service logger with automatic correlation ID enrichment
 */
export const logAI = {
  error: (message: string, metadata?: any) =>
    aiLogger.error(message, enrichMetadata('ai', metadata)),
  warn: (message: string, metadata?: any) =>
    aiLogger.warn(message, enrichMetadata('ai', metadata)),
  info: (message: string, metadata?: any) =>
    aiLogger.info(message, enrichMetadata('ai', metadata)),
  debug: (message: string, metadata?: any) =>
    aiLogger.debug(message, enrichMetadata('ai', metadata)),
};

/**
 * Queue service logger with automatic correlation ID enrichment
 */
export const logQueue = {
  error: (message: string, metadata?: any) =>
    queueLogger.error(message, enrichMetadata('queue', metadata)),
  warn: (message: string, metadata?: any) =>
    queueLogger.warn(message, enrichMetadata('queue', metadata)),
  info: (message: string, metadata?: any) =>
    queueLogger.info(message, enrichMetadata('queue', metadata)),
  debug: (message: string, metadata?: any) =>
    queueLogger.debug(message, enrichMetadata('queue', metadata)),
};

/**
 * Frontend service logger (used by backend endpoint to log frontend events)
 */
export const logFrontend = {
  error: (message: string, metadata?: any) =>
    frontendLogger.error(message, enrichMetadata('frontend', metadata)),
  warn: (message: string, metadata?: any) =>
    frontendLogger.warn(message, enrichMetadata('frontend', metadata)),
  info: (message: string, metadata?: any) =>
    frontendLogger.info(message, enrichMetadata('frontend', metadata)),
  debug: (message: string, metadata?: any) =>
    frontendLogger.debug(message, enrichMetadata('frontend', metadata)),
};

// Export default logger (uses config service or defaults to 'api')
const defaultService = loggingConfig.service;
let defaultLogger: typeof logApi;

switch (defaultService) {
  case 'worker':
    defaultLogger = logWorker;
    break;
  case 'ai':
    defaultLogger = logAI;
    break;
  case 'queue':
    defaultLogger = logQueue;
    break;
  case 'frontend':
    defaultLogger = logFrontend;
    break;
  default:
    defaultLogger = logApi;
}

export default defaultLogger;
