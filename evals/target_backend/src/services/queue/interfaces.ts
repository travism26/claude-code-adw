/**
 * Queue Service Abstraction Interfaces
 *
 * These interfaces provide an abstraction layer over the underlying queue implementation.
 * This allows the queue system (BullMQ/Redis) to be swapped out with alternative
 * implementations (e.g., Kafka, RabbitMQ, AWS SQS) without requiring changes to
 * the AIWrapper or consuming services.
 *
 * The abstraction follows the Dependency Inversion Principle:
 * - High-level modules (API routes, services) depend on abstractions (these interfaces)
 * - Low-level modules (BullMQ implementation) depend on abstractions
 * - Both are independent and can be modified separately
 */

/**
 * Job status enumeration
 * Represents the lifecycle states of a queued job
 */
export enum JobStatus {
  PENDING = 'pending',     // Job is waiting in queue
  ACTIVE = 'active',       // Job is currently being processed
  COMPLETED = 'completed', // Job completed successfully
  FAILED = 'failed',       // Job failed after all retry attempts
  DELAYED = 'delayed',     // Job is delayed (scheduled for future)
}

/**
 * Generic Job interface
 * Represents a unit of work in the queue system
 *
 * @template TPayload - The type of data required to process this job
 * @template TResult - The type of data returned when job completes
 */
export interface Job<TPayload = any, TResult = any> {
  /** Unique identifier for this job */
  id: string;

  /** Job type/category (e.g., 'ai_task', 'care_recommendation') */
  type: string;

  /** Input data needed to process the job */
  payload: TPayload;

  /** Current status of the job */
  status: JobStatus;

  /** Result data if job completed successfully */
  result?: TResult;

  /** Error information if job failed */
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };

  /** Number of times this job has been attempted */
  attemptsMade?: number;

  /** Timestamp when job was created */
  createdAt?: Date;

  /** Timestamp when job was last updated */
  updatedAt?: Date;

  /** Timestamp when job completed or failed */
  finishedAt?: Date;
}

/**
 * Options for enqueueing a new job
 */
export interface EnqueueOptions {
  /** Priority level (higher = more priority) */
  priority?: number;

  /** Delay before job should be processed (milliseconds) */
  delay?: number;

  /** Custom retry attempts (overrides default) */
  attempts?: number;

  /** Job timeout in milliseconds */
  timeout?: number;

  /** Remove job from queue after completion */
  removeOnComplete?: boolean;

  /** Remove job from queue after failure */
  removeOnFail?: boolean;
}

/**
 * QueueService interface
 * Defines the contract for queue operations
 *
 * Implementations must provide methods to enqueue jobs, query job status,
 * and manage the queue lifecycle.
 */
export interface QueueService {
  /**
   * Add a new job to the queue
   *
   * @param type - The type/category of job to enqueue
   * @param payload - The data required to process the job
   * @param options - Optional configuration for this job
   * @returns Promise resolving to the created Job
   */
  enqueue<TPayload = any>(
    type: string,
    payload: TPayload,
    options?: EnqueueOptions
  ): Promise<Job<TPayload>>;

  /**
   * Get the current status of a job
   *
   * @param jobId - The unique identifier of the job
   * @returns Promise resolving to the job status, or null if not found
   */
  getJobStatus(jobId: string): Promise<JobStatus | null>;

  /**
   * Get full details of a job
   *
   * @param jobId - The unique identifier of the job
   * @returns Promise resolving to the complete Job object, or null if not found
   */
  getJob<TPayload = any, TResult = any>(
    jobId: string
  ): Promise<Job<TPayload, TResult> | null>;

  /**
   * Check if the queue service is healthy and connected
   *
   * @returns Promise resolving to true if healthy, false otherwise
   */
  isHealthy(): Promise<boolean>;

  /**
   * Close all connections and clean up resources
   *
   * @returns Promise that resolves when cleanup is complete
   */
  close(): Promise<void>;
}

/**
 * Worker interface
 * Defines the contract for processing jobs from a queue
 *
 * Workers listen to a queue and execute a processor function for each job.
 */
export interface Worker {
  /**
   * Start the worker to begin processing jobs
   *
   * @returns Promise that resolves when worker is started
   */
  start(): Promise<void>;

  /**
   * Stop the worker and wait for current jobs to complete
   *
   * @param timeout - Maximum time to wait for jobs to complete (ms)
   * @returns Promise that resolves when worker is stopped
   */
  stop(timeout?: number): Promise<void>;

  /**
   * Check if the worker is currently running
   *
   * @returns true if worker is running, false otherwise
   */
  isRunning(): boolean;

  /**
   * Get the name/identifier of this worker
   *
   * @returns Worker name
   */
  getName(): string;
}

/**
 * Job processor function type
 * Function that processes a job and returns a result
 *
 * @template TPayload - Type of the job payload
 * @template TResult - Type of the result
 */
export type JobProcessor<TPayload = any, TResult = any> = (
  job: Job<TPayload>
) => Promise<TResult>;
