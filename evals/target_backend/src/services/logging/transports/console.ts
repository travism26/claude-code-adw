import winston from 'winston';
import { loggingConfig } from '../config/logging';
import { prettyFormatter } from '../formatters/pretty';
import { jsonFormatter } from '../formatters/json';

/**
 * Console transport for development
 * Uses pretty formatter in development, JSON in production
 */
export const consoleTransport = new winston.transports.Console({
  level: loggingConfig.level,
  format: loggingConfig.environment === 'production' ? jsonFormatter : prettyFormatter,
});
