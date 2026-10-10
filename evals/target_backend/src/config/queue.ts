/**
 * Queue Service Configuration
 *
 * Configuration for BullMQ and Redis-based job queue system
 * Provides settings for Redis connection, retry policies, and worker concurrency
 */

export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  concurrency: number; // Number of concurrent jobs per worker
  maxRetries: number; // Maximum retry attempts for failed jobs
  retryDelay: number; // Base delay in milliseconds for exponential backoff
  defaultJobOptions: {
    attempts: number;
    backoff: {
      type: 'exponential';
      delay: number;
    };
    removeOnComplete: boolean | number | { age?: number; count?: number };
    removeOnFail: boolean | number | { age?: number; count?: number };
  };
}

/**
 * Load queue configuration from environment variables
 * Uses sensible defaults for local development
 */
function loadQueueConfig(): QueueConfig {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisPassword = process.env.REDIS_PASSWORD;
  const redisDb = parseInt(process.env.REDIS_DB || '0', 10);

  const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '5', 10);
  const maxRetries = parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10);
  const retryDelay = parseInt(process.env.QUEUE_RETRY_DELAY || '1000', 10);

  const config: QueueConfig = {
    redis: {
      host: redisHost,
      port: redisPort,
      password: redisPassword || undefined,
      db: redisDb,
    },
    concurrency,
    maxRetries,
    retryDelay,
    defaultJobOptions: {
      attempts: maxRetries,
      backoff: {
        type: 'exponential',
        delay: retryDelay,
      },
      // Remove completed jobs immediately to save Redis memory
      // Job results are persisted in the database, so we don't need them in Redis
      removeOnComplete: true,
      // Keep failed jobs for debugging (still useful to see in Bull Board)
      removeOnFail: { age: 86400, count: 1000 },
    },
  };

  return config;
}

export const queueConfig = loadQueueConfig();

/**
 * Queue name constants
 * Centralized definition of all queue names in the system
 */
export const QUEUE_NAMES = {
  AI_TASKS: 'ai_tasks',
  FEEDING_DIGEST: 'feeding_digest',
} as const;

export default queueConfig;
