/**
 * AI Tasks Queue
 *
 * Singleton Queue instance for AI-related background tasks.
 * This queue handles garden analysis, plant recommendations, and other AI operations.
 *
 * Usage:
 * ```typescript
 * import { queueGardenAnalysisJob, queueAITask } from './services/queue/queues/aiTasks.queue';
 *
 * // Queue a garden analysis job
 * const job = await queueGardenAnalysisJob({
 *   gardenId: '123',
 *   userId: '456',
 *   triggeredBy: 'manual_request'
 * });
 *
 * // Queue a generic AI task
 * const job2 = await queueAITask('care_recommendation', {
 *   plantType: 'tomato',
 *   userId: '456'
 * });
 * ```
 */

import { Queue, Job as BullJob } from 'bullmq';
import { QUEUE_NAMES, queueConfig } from '../../../config/queue';
import { getRedisConnection } from '../connection';
import { User } from '../../../models/User';
import { getCorrelationId } from '../../logging/correlation';
import { logQueue } from '../../logging/logger';

/**
 * Type definitions for AI Task job payloads
 */
export interface AITaskJobData {
  userId?: string;
  plantId?: string;
  payload?: any;
  correlationId?: string;
  [key: string]: any;
}

export interface GardenAnalysisJobData extends AITaskJobData {
  gardenId: string;
  userId: string;
  triggeredBy: 'manual_request' | 'garden_plot_change';
  timestamp: string;
  correlationId?: string;
}

export interface LayoutGenerationJobData extends AITaskJobData {
  gardenId: string;
  userId: string;
  plantProfileIds: string[];
  sunZones: any[];
  preferences: {
    optimizationGoal: 'max_yield' | 'max_variety' | 'beginner_friendly';
    spacingMethod: 'intensive' | 'square_foot' | 'traditional';
  };
  correlationId?: string;
}

/**
 * Singleton Queue instance
 * Initialized once and reused across all requests
 */
let aiTasksQueue: Queue | null = null;

/**
 * Initialize the AI Tasks Queue
 * This should be called once during application startup
 *
 * @returns The initialized Queue instance
 */
export function initializeAITasksQueue(): Queue {
  if (aiTasksQueue) {
    logQueue.info('Queue already initialized');
    return aiTasksQueue;
  }

  logQueue.info('Initializing AI tasks queue...');

  aiTasksQueue = new Queue(QUEUE_NAMES.AI_TASKS, {
    connection: getRedisConnection(),
    defaultJobOptions: queueConfig.defaultJobOptions,
  });

  // Set up event listeners for monitoring
  aiTasksQueue.on('error', (error: Error) => {
    logQueue.error('Queue error', { error: error.message, stack: error.stack });
  });

  logQueue.info('AI tasks queue initialized successfully');

  return aiTasksQueue;
}

/**
 * Get the AI Tasks Queue instance
 * Throws error if not initialized
 *
 * @returns The Queue instance
 */
export function getAITasksQueue(): Queue {
  if (!aiTasksQueue) {
    throw new Error('AI tasks queue not initialized. Call initializeAITasksQueue() first.');
  }
  return aiTasksQueue;
}

/**
 * Queue a garden analysis job
 * Type-safe helper function for enqueueing garden analysis tasks
 *
 * @param data - Garden analysis job data
 * @returns The created BullMQ Job
 */
export async function queueGardenAnalysisJob(
  data: GardenAnalysisJobData
): Promise<BullJob<GardenAnalysisJobData>> {
  const queue = getAITasksQueue();

  // Check if user has AI analysis enabled
  const user = await User.findByPk(data.userId);
  if (!user) {
    throw new Error(`User not found: ${data.userId}`);
  }

  if (!user.ai_analysis_enabled) {
    logQueue.info('AI analysis disabled for user, skipping job', { userId: data.userId });
    throw new Error('AI analysis is disabled for this user');
  }

  // Inject correlation ID from current async context
  const correlationId = getCorrelationId();
  const jobData = {
    ...data,
    correlationId,
  };

  logQueue.info('Enqueueing garden_analysis job', {
    gardenId: data.gardenId,
    userId: data.userId,
    triggeredBy: data.triggeredBy,
    correlationId,
  });

  const job = await queue.add('garden_analysis', jobData, {
    attempts: queueConfig.defaultJobOptions.attempts,
    backoff: queueConfig.defaultJobOptions.backoff,
    removeOnComplete: queueConfig.defaultJobOptions.removeOnComplete,
    removeOnFail: queueConfig.defaultJobOptions.removeOnFail,
  });

  logQueue.info('Garden analysis job enqueued', {
    jobId: job.id,
    gardenId: data.gardenId,
    correlationId,
  });

  return job;
}

/**
 * Queue a layout generation job
 * Type-safe helper function for enqueueing layout generation tasks
 *
 * @param data - Layout generation job data
 * @returns The created BullMQ Job
 */
export async function queueLayoutGenerationJob(
  data: LayoutGenerationJobData
): Promise<BullJob<LayoutGenerationJobData>> {
  const queue = getAITasksQueue();

  // Inject correlation ID from current async context
  const correlationId = getCorrelationId();
  const jobData = {
    ...data,
    correlationId,
  };

  logQueue.info('Enqueueing layout_generation job', {
    gardenId: data.gardenId,
    userId: data.userId,
    plantCount: data.plantProfileIds.length,
    correlationId,
  });

  const job = await queue.add('layout_generation', jobData, {
    attempts: queueConfig.defaultJobOptions.attempts,
    backoff: queueConfig.defaultJobOptions.backoff,
    removeOnComplete: queueConfig.defaultJobOptions.removeOnComplete,
    removeOnFail: queueConfig.defaultJobOptions.removeOnFail,
  });

  logQueue.info('Layout generation job enqueued', {
    jobId: job.id,
    gardenId: data.gardenId,
    correlationId,
  });

  return job;
}

/**
 * Queue a generic AI task
 * Generic helper function for enqueueing any AI task type
 *
 * @param taskType - The type of AI task (e.g., 'care_recommendation', 'plant_identification')
 * @param data - The job payload data
 * @param options - Optional job options (priority, delay, etc.)
 * @returns The created BullMQ Job
 */
export async function queueAITask(
  taskType: string,
  data: AITaskJobData,
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
    removeOnComplete?: boolean;
    removeOnFail?: boolean;
  }
): Promise<BullJob<AITaskJobData>> {
  const queue = getAITasksQueue();

  // Inject correlation ID from current async context
  const correlationId = getCorrelationId();
  const jobData = {
    ...data,
    correlationId,
  };

  logQueue.info('Enqueueing AI task', {
    taskType,
    userId: data.userId,
    correlationId,
  });

  const job = await queue.add(taskType, jobData, {
    priority: options?.priority,
    delay: options?.delay,
    attempts: options?.attempts || queueConfig.defaultJobOptions.attempts,
    backoff: queueConfig.defaultJobOptions.backoff,
    removeOnComplete: options?.removeOnComplete ?? queueConfig.defaultJobOptions.removeOnComplete,
    removeOnFail: options?.removeOnFail ?? queueConfig.defaultJobOptions.removeOnFail,
  });

  logQueue.info('AI task enqueued', {
    taskType,
    jobId: job.id,
    correlationId,
  });

  return job;
}

/**
 * Close the AI Tasks Queue
 * Should be called during application shutdown
 */
export async function closeAITasksQueue(): Promise<void> {
  if (aiTasksQueue) {
    logQueue.info('Closing AI tasks queue...');
    await aiTasksQueue.close();
    aiTasksQueue = null;
    logQueue.info('AI tasks queue closed');
  }
}
