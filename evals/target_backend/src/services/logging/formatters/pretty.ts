import winston from 'winston';
import chalk from 'chalk';

/**
 * Pretty formatter for development logs
 * Produces human-readable colored logs for local debugging
 */
export const prettyFormatter = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, correlationId, ...metadata } = info;

    // Colorize log level
    let coloredLevel: string;
    switch (level) {
      case 'error':
        coloredLevel = chalk.red.bold(level.toUpperCase());
        break;
      case 'warn':
        coloredLevel = chalk.yellow.bold(level.toUpperCase());
        break;
      case 'info':
        coloredLevel = chalk.blue.bold(level.toUpperCase());
        break;
      case 'debug':
        coloredLevel = chalk.gray.bold(level.toUpperCase());
        break;
      default:
        coloredLevel = level.toUpperCase();
    }

    // Build log line
    const timeStr = chalk.gray(timestamp);
    const serviceStr = service ? chalk.cyan(`[${service}]`) : '';
    const correlationStr = correlationId && typeof correlationId === 'string'
      ? chalk.magenta(`{${correlationId.substring(0, 8)}}`)
      : '';

    let logLine = `${timeStr} ${coloredLevel} ${serviceStr} ${correlationStr} ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      // Remove empty or undefined values
      const cleanedMetadata = Object.entries(metadata)
        .filter(([_, value]) => value !== undefined && value !== null && value !== '')
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

      if (Object.keys(cleanedMetadata).length > 0) {
        logLine += '\n' + chalk.gray(JSON.stringify(cleanedMetadata, null, 2));
      }
    }

    // Add stack trace if present
    if (info.stack) {
      logLine += '\n' + chalk.red(info.stack);
    }

    return logLine;
  })
);
