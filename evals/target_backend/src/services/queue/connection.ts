/**
 * Shared Redis Connection Configuration
 *
 * Provides standardized Redis connection configuration for all BullMQ
 * Queue and Worker instances. This ensures consistent connection settings
 * across the application.
 */

import { queueConfig } from '../../config/queue';
import { ConnectionOptions } from 'bullmq';

/**
 * Get standardized Redis connection configuration
 * All Queue and Worker instances should use this to ensure consistent connection settings
 *
 * @returns BullMQ ConnectionOptions for Redis
 */
export function getRedisConnection(): ConnectionOptions {
  return {
    host: queueConfig.redis.host,
    port: queueConfig.redis.port,
    password: queueConfig.redis.password,
    db: queueConfig.redis.db,
  };
}
