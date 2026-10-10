import winston from 'winston';

/**
 * JSON formatter for production logs
 * Produces machine-readable JSON logs that can be easily parsed and indexed
 */
export const jsonFormatter = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);
