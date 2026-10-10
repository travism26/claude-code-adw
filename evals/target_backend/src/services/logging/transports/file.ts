import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { loggingConfig } from '../config/logging';
import { jsonFormatter } from '../formatters/json';

/**
 * Create a file transport with daily rotation
 * @param filename Base filename (e.g., 'api', 'worker', 'ai')
 * @param level Optional log level (defaults to config level)
 * @returns Winston DailyRotateFile transport
 */
function createFileTransport(filename: string, level?: string): DailyRotateFile {
  return new DailyRotateFile({
    filename: path.join(loggingConfig.dir, `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    maxSize: loggingConfig.maxSize,
    maxFiles: loggingConfig.maxFiles,
    level: level || loggingConfig.level,
    format: jsonFormatter,
  });
}

/**
 * API service transports
 */
export const apiTransports: winston.transport[] = [
  createFileTransport('api'),
  createFileTransport('api-error', 'error'),
];

/**
 * Worker service transports
 */
export const workerTransports: winston.transport[] = [
  createFileTransport('worker'),
  createFileTransport('worker-error', 'error'),
];

/**
 * AI service transports
 */
export const aiTransports: winston.transport[] = [
  createFileTransport('ai'),
  createFileTransport('ai-error', 'error'),
];

/**
 * Queue service transports
 */
export const queueTransports: winston.transport[] = [
  createFileTransport('queue'),
  createFileTransport('queue-error', 'error'),
];

/**
 * Frontend service transports
 */
export const frontendTransports: winston.transport[] = [
  createFileTransport('frontend'),
  createFileTransport('frontend-error', 'error'),
];
