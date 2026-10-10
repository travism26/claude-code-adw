/**
 * Queue Service Module
 *
 * This module provides a singleton-based queue system for background job processing.
 * It follows BullMQ best practices with separate queue and worker processes.
 *
 * Architecture:
 * - Queue instances are initialized once at startup and reused across all requests
 * - Workers run in a separate process (src/worker.ts)
 * - API server only enqueues jobs, does not process them
 *
 * Usage:
 * ```typescript
 * import { queueGardenAnalysisJob, queueAITask } from './services/queue';
 *
 * // Enqueue a garden analysis job
 * const job = await queueGardenAnalysisJob({
 *   gardenId: '123',
 *   userId: '456',
 *   triggeredBy: 'manual_request',
 *   timestamp: new Date().toISOString()
 * });
 *
 * // Enqueue a generic AI task
 * const job2 = await queueAITask('care_recommendation', {
 *   plantType: 'tomato',
 *   userId: '456'
 * });
 * ```
 */

import { logQueue } from '../logging/logger';

// Re-export queue functions for easy access
export {
  initializeAITasksQueue,
  getAITasksQueue,
  queueGardenAnalysisJob,
  queueLayoutGenerationJob,
  queueAITask,
  closeAITasksQueue,
} from './queues/aiTasks.queue';

// Re-export types
export type {
  AITaskJobData,
  GardenAnalysisJobData,
  LayoutGenerationJobData,
} from './queues/aiTasks.queue';

// Re-export worker creation function (for worker process)
export { createAITasksWorker } from './workers/aiTasks.worker';

// Feeding digest (daily reminder) queue + worker
export {
  initializeFeedingDigestQueue,
  scheduleDailyDigest,
  triggerFeedingDigestNow,
  closeFeedingDigestQueue,
} from './queues/feedingDigest.queue';
export { createFeedingDigestWorker } from './workers/feedingDigest.worker';

// Re-export legacy interfaces for backward compatibility
export * from './interfaces';

/**
 * Initialize all queues
 * This should be called once during application startup (API server only)
 */
export async function initializeQueues(): Promise<void> {
  logQueue.info('Initializing queues', {});

  const { initializeAITasksQueue } = await import('./queues/aiTasks.queue');
  initializeAITasksQueue();

  // Feeding digest queue + its repeatable daily job (idempotent).
  const { initializeFeedingDigestQueue, scheduleDailyDigest } = await import(
    './queues/feedingDigest.queue'
  );
  initializeFeedingDigestQueue();
  await scheduleDailyDigest();

  logQueue.info('All queues initialized', {});
}

/**
 * Shutdown all queues gracefully
 * This should be called during application shutdown
 */
export async function shutdownQueues(): Promise<void> {
  logQueue.info('Shutting down queues', {});

  const { closeAITasksQueue } = await import('./queues/aiTasks.queue');
  await closeAITasksQueue();

  const { closeFeedingDigestQueue } = await import('./queues/feedingDigest.queue');
  await closeFeedingDigestQueue();

  logQueue.info('All queues shut down', {});
}

/**
 * Check if queues are healthy
 */
export async function areQueuesHealthy(): Promise<boolean> {
  try {
    const { getAITasksQueue } = await import('./queues/aiTasks.queue');
    const queue = getAITasksQueue();

    // Try to ping Redis connection
    const client = await queue.client;
    await client.ping();

    return true;
  } catch (error) {
    logQueue.error('Queue health check failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
}
