import os from 'os';
import path from 'path';

export interface LoggingConfig {
  level: string;
  dir: string;
  fileEnabled: boolean;
  consoleEnabled: boolean;
  maxSize: string;
  maxFiles: string;
  service: string;
  environment: string;
  hostname: string;
  pid: number;
}

function getLogLevel(): string {
  return process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
}

function getLogDir(): string {
  return process.env.LOG_DIR || path.join(process.cwd(), 'logs');
}

function isFileEnabled(): boolean {
  return process.env.LOG_FILE_ENABLED !== 'false';
}

function isConsoleEnabled(): boolean {
  if (process.env.LOG_CONSOLE_ENABLED !== undefined) {
    return process.env.LOG_CONSOLE_ENABLED === 'true';
  }
  // Default: console enabled in development, disabled in production and test
  return process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';
}

function getMaxSize(): string {
  return process.env.LOG_FILE_MAX_SIZE || '20m';
}

function getMaxFiles(): string {
  return process.env.LOG_FILE_MAX_FILES || '14d';
}

function getService(): string {
  return process.env.LOG_SERVICE || 'api';
}

function getEnvironment(): string {
  return process.env.NODE_ENV || 'development';
}

export const loggingConfig: LoggingConfig = {
  level: getLogLevel(),
  dir: getLogDir(),
  fileEnabled: isFileEnabled(),
  consoleEnabled: isConsoleEnabled(),
  maxSize: getMaxSize(),
  maxFiles: getMaxFiles(),
  service: getService(),
  environment: getEnvironment(),
  hostname: os.hostname(),
  pid: process.pid,
};
