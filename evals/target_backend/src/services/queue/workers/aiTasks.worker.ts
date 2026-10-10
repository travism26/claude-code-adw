/**
 * AI Tasks Worker
 *
 * BullMQ worker that processes AI tasks from the ai_tasks queue.
 * This worker runs in a separate process from the API server for better scalability.
 *
 * Uses a service registry pattern to route job types to their corresponding AI services.
 *
 * Supported Job Types:
 * - garden_analysis: Analyzes garden layout and provides recommendations
 * - plant_update_suggestion: Provides personalized plant care recommendations
 * - weather_based_action: Analyzes weather forecast and suggests protective actions
 * - care_recommendation: Generates comprehensive care schedules for plants
 * - pest_diagnosis: Diagnoses plant health issues and provides treatment plans
 *
 * To add a new AI service: Register it in AI_SERVICE_REGISTRY below.
 */

import { Worker as BullWorker, Job as BullJob } from "bullmq";
import { QUEUE_NAMES, queueConfig } from "../../../config/queue";
import { getRedisConnection } from "../connection";
import { AITask } from "../../../models/AITask";
import { User } from "../../../models/User";
import { Plant } from "../../../models/Plant";
import { Garden } from "../../../models/Garden";
import { messageBus, MessageBusEvent } from "../../messageBus";
import { GardenAnalysisService } from "../../ai/garden";
import { LayoutGenerationService } from "../../ai/layout";
import { PlantCareService } from "../../ai/plant";
import { WeatherActionService } from "../../ai/weather";
import { CareRecommendationService } from "../../ai/care";
import { PestDiagnosisService } from "../../ai/pest";
import { GrowAnalysisService } from "../../ai/grow";
import { GrowPhotoAnalysisService } from "../../ai/photo";
import { GrowNutrientRecommendationService } from "../../ai/grow/nutrient";
import { decrementUsage } from "../../analysisLimitService";
import { runWithCorrelationId, generateCorrelationId } from "../../logging/correlation";
import { logWorker } from "../../logging/logger";

/**
 * Task types that charge usage and should be refunded on failure.
 * When adding a new task type with usage limits, add it here.
 */
const USAGE_TRACKED_TASK_TYPES = ["garden_analysis", "grow_analysis", "grow_photo_analysis", "grow_nutrient_recommendation"];

/**
 * AI Service Registry
 * Maps job types to their corresponding service classes
 * This allows easy addition of new AI services without modifying worker logic
 */
const AI_SERVICE_REGISTRY: Record<
  string,
  {
    serviceClass: any;
    analyze: (service: any, payload: any) => Promise<any>;
  }
> = {
  garden_analysis: {
    serviceClass: GardenAnalysisService,
    analyze: async (service, payload) => {
      const { gardenId, userId, aiTaskId } = payload;
      if (!gardenId || !userId) {
        throw new Error(
          "garden_analysis job requires gardenId and userId in payload"
        );
      }
      // Use new execute() interface - handles both analysis and persistence
      return await service.execute({ gardenId, userId, aiTaskId });
    },
  },
  plant_update_suggestion: {
    serviceClass: PlantCareService,
    analyze: async (service, payload) => {
      const { plantId, userId } = payload;
      if (!plantId || !userId) {
        throw new Error(
          "plant_update_suggestion job requires plantId and userId in payload"
        );
      }
      return await service.analyze(plantId, userId);
    },
  },
  weather_based_action: {
    serviceClass: WeatherActionService,
    analyze: async (service, payload) => {
      const { userId } = payload;
      if (!userId) {
        throw new Error("weather_based_action job requires userId in payload");
      }
      return await service.analyze(payload);
    },
  },
  care_recommendation: {
    serviceClass: CareRecommendationService,
    analyze: async (service, payload) => {
      const { plantId, userId } = payload;
      if (!plantId || !userId) {
        throw new Error(
          "care_recommendation job requires plantId and userId in payload"
        );
      }
      return await service.analyze(payload);
    },
  },
  pest_diagnosis: {
    serviceClass: PestDiagnosisService,
    analyze: async (service, payload) => {
      const { plantId, userId, symptoms } = payload;
      if (!plantId || !userId || !symptoms) {
        throw new Error(
          "pest_diagnosis job requires plantId, userId, and symptoms in payload"
        );
      }
      return await service.analyze(payload);
    },
  },
  layout_generation: {
    serviceClass: LayoutGenerationService,
    analyze: async (service, payload) => {
      const { gardenId, userId, plantProfileIds, sunZones, preferences } = payload;
      if (!gardenId || !userId || !plantProfileIds) {
        throw new Error(
          "layout_generation job requires gardenId, userId, and plantProfileIds in payload"
        );
      }
      // Use execute() interface
      return await service.execute({
        gardenId,
        userId,
        plantProfileIds,
        sunZones,
        preferences,
      });
    },
  },
  grow_analysis: {
    serviceClass: GrowAnalysisService,
    analyze: async (service, payload) => {
      const { growId, userId, type, aiTaskId } = payload;
      if (!growId || !userId) {
        throw new Error(
          "grow_analysis job requires growId and userId in payload"
        );
      }
      // Use execute() interface - handles both analysis and persistence
      return await service.execute({ growId, userId, type: type || 'general', aiTaskId });
    },
  },
  grow_photo_analysis: {
    serviceClass: GrowPhotoAnalysisService,
    analyze: async (service, payload) => {
      const { photoId, logId, userId, aiTaskId } = payload;
      if (!photoId || !logId || !userId) {
        throw new Error(
          "grow_photo_analysis job requires photoId, logId, and userId in payload"
        );
      }
      // Use execute() interface - handles analysis and completion event
      return await service.execute({ photoId, logId, userId, aiTaskId, triggeredBy: payload.triggeredBy });
    },
  },
  grow_nutrient_recommendation: {
    serviceClass: GrowNutrientRecommendationService,
    analyze: async (service, payload) => {
      const { growId, userId, type, goal, deficiency, aiTaskId } = payload;
      if (!growId || !userId) {
        throw new Error(
          "grow_nutrient_recommendation job requires growId and userId in payload"
        );
      }
      // Use execute() interface - handles recommendation generation and completion event
      return await service.execute({
        growId,
        userId,
        type: type || 'full_schedule',
        goal: goal || 'balanced',
        deficiency,
        aiTaskId,
      });
    },
  },
};

/**
 * Create and configure the AI Tasks Worker
 * This function should be called once during worker process startup
 *
 * @returns Configured BullMQ Worker instance
 */
export function createAITasksWorker(): BullWorker {
  logWorker.info("Creating AI tasks worker...");

  const worker = new BullWorker(
    QUEUE_NAMES.AI_TASKS,
    async (job: BullJob) => {
      // Extract correlation ID from job data or generate new one
      const correlationId = job.data.correlationId || generateCorrelationId();

      // Run job processing within correlation context
      return await runWithCorrelationId(correlationId, async () => {
        return await processJob(job);
      });
    },
    {
      connection: getRedisConnection(),
      concurrency: queueConfig.concurrency,
      autorun: false, // We'll start it manually
    }
  );

  // Set up event listeners for monitoring
  setupEventListeners(worker);

  logWorker.info("AI tasks worker created", {
    concurrency: queueConfig.concurrency,
  });

  return worker;
}

/**
 * Set up event listeners for worker monitoring
 */
function setupEventListeners(worker: BullWorker): void {
  worker.on("ready", () => {
    logWorker.info("Worker is ready");
  });

  worker.on("active", (job: BullJob) => {
    logWorker.info("Processing job", {
      jobId: job.id,
      jobType: job.name,
      correlationId: job.data.correlationId,
    });
  });

  worker.on("completed", (job: BullJob, _result: any) => {
    logWorker.info("Job completed successfully", {
      jobId: job.id,
      jobType: job.name,
      correlationId: job.data.correlationId,
    });
  });

  worker.on("failed", (job: BullJob | undefined, error: Error) => {
    logWorker.error("Job failed", {
      jobId: job?.id || "unknown",
      jobType: job?.name || "unknown",
      correlationId: job?.data?.correlationId,
      error: error.message,
      stack: error.stack,
    });
  });

  worker.on("error", (error: Error) => {
    logWorker.error("Worker error", {
      error: error.message,
      stack: error.stack,
    });
  });

  worker.on("stalled", (jobId: string) => {
    logWorker.warn("Job stalled", { jobId });
  });
}

/**
 * Process a single job from the queue
 * This is the main worker function that processes AI tasks
 */
async function processJob(bullJob: BullJob): Promise<any> {
  const queueJobId = bullJob.id!;
  const jobType = bullJob.name;
  const payload = bullJob.data;
  const startTime = Date.now();

  logWorker.info("Starting job", {
    jobId: queueJobId,
    jobType,
    userId: payload.userId,
    gardenId: payload.gardenId,
    plantId: payload.plantId,
  });

  try {
    // Update job progress
    await bullJob.updateProgress(10);

    // Validate referenced data exists before processing
    const validationError = await validateJobReferences(queueJobId, payload);
    if (validationError) {
      // Job references data that no longer exists - fail gracefully
      logWorker.warn("Job validation failed", {
        jobId: queueJobId,
        error: validationError,
      });
      throw new Error(validationError);
    }

    // Create or get the database task record (with UUID primary key)
    const aiTask = await ensureTaskExists(queueJobId, jobType, payload);

    // Publish AI task started event if userId is available
    if (payload.userId) {
      messageBus.publish(MessageBusEvent.AI_TASK_STARTED, {
        taskId: aiTask.id,
        userId: payload.userId,
        timestamp: new Date(),
      });
    }

    await bullJob.updateProgress(20);

    // Check if job type is registered in service registry
    const serviceConfig = AI_SERVICE_REGISTRY[jobType];

    if (!serviceConfig) {
      // Unknown job type - this should never happen in production
      const error = `Unknown job type: ${jobType}. Job type must be registered in AI_SERVICE_REGISTRY.`;
      logWorker.error(error, { jobId: queueJobId, jobType });
      throw new Error(error);
    }

    // Use modular AI service pattern
    logWorker.info("Processing job with AI service", {
      jobId: queueJobId,
      jobType,
      serviceName: serviceConfig.serviceClass.name,
    });

    await bullJob.updateProgress(30);

    // Instantiate service and call analyze method
    // Pass aiTaskId in payload so service can persist results if needed
    const service = new serviceConfig.serviceClass();
    const result = await serviceConfig.analyze(service, {
      ...payload,
      aiTaskId: aiTask.id,
    });

    await bullJob.updateProgress(80);

    // Domain-specific persistence is now handled by each service's execute() method
    // No more worker-level persistence logic needed!

    // Let service publish its own completion event (if it has one)
    // Services override publishCompletionEvent() to publish domain-specific events
    await service.publishCompletionEvent(result, {
      ...payload,
      analysisId: aiTask.id,
    });

    await bullJob.updateProgress(90);

    // Update AI task status to completed
    await updateTaskSuccess(queueJobId, result);

    const duration = Date.now() - startTime;
    logWorker.info("Job processed successfully", {
      jobId: queueJobId,
      jobType,
      duration,
    });

    await bullJob.updateProgress(100);

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logWorker.error("Error processing job", {
      jobId: queueJobId,
      jobType,
      duration,
      error: error.message,
      stack: error.stack,
    });

    // Update AI task in database with error
    await updateTaskError(queueJobId, error.message);

    // Re-throw error so BullMQ marks job as failed
    throw error;
  }
}

/**
 * Validate that all referenced entities (user, plant, garden) exist before processing
 * This prevents foreign key constraint errors and provides clear error messages
 *
 * @param queueJobId - The BullMQ job ID (for logging)
 * @param payload - The job payload containing entity references
 * @returns Error message if validation fails, null if all references are valid
 */
async function validateJobReferences(
  queueJobId: string,
  payload: any
): Promise<string | null> {
  const { userId, plantId, gardenId } = payload;

  // Check if user exists (if userId is provided)
  if (userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      return `User ${userId} not found. User may have been deleted after job was enqueued.`;
    }
  }

  // Check if plant exists (if plantId is provided)
  if (plantId) {
    const plant = await Plant.findByPk(plantId);
    if (!plant) {
      return `Plant ${plantId} not found. Plant may have been deleted after job was enqueued.`;
    }
  }

  // Check if garden exists (if gardenId is provided)
  if (gardenId) {
    const garden = await Garden.findByPk(gardenId);
    if (!garden) {
      return `Garden ${gardenId} not found. Garden may have been deleted after job was enqueued.`;
    }
  }

  // All references are valid
  return null;
}

/**
 * Ensure the AI task exists in the database
 * Creates a pending task if it doesn't exist
 *
 * @param queueJobId - The BullMQ job ID
 * @param jobType - The type of AI task
 * @param payload - The job payload
 * @returns The AITask instance (with auto-generated UUID id)
 */
async function ensureTaskExists(
  queueJobId: string,
  jobType: string,
  payload: any
): Promise<AITask> {
  // Note: References are already validated by validateJobReferences()
  // so we shouldn't hit foreign key constraint errors here
  const [task, created] = await AITask.findOrCreate({
    where: { queue_job_id: queueJobId },
    defaults: {
      queue_job_id: queueJobId,
      user_id: payload.userId || null,
      plant_id: payload.plantId || null,
      task_type: jobType as any,
      status: "pending",
      request_payload: payload.payload || payload,
    },
  });

  if (created) {
    logWorker.info("Created AI task in database", {
      taskId: task.id,
      queueJobId,
      jobType,
    });
  } else {
    logWorker.info("Found existing AI task", {
      taskId: task.id,
      queueJobId,
    });
  }

  return task;
}

/**
 * Update AI task with success information
 *
 * @param queueJobId - The BullMQ job ID to find the task
 * @param result - The result of the AI task
 */
async function updateTaskSuccess(
  queueJobId: string,
  result: any
): Promise<void> {
  try {
    const task = await AITask.findOne({ where: { queue_job_id: queueJobId } });
    if (task) {
      await task.update({
        status: "completed",
        response_data: result,
        completed_at: new Date(),
      });

      // Publish AI task completed event if userId is available
      // Include all task data in payload to avoid DB lookups in event handlers
      if (task.user_id) {
        messageBus.publish(MessageBusEvent.AI_TASK_COMPLETED, {
          taskId: task.id,
          userId: task.user_id,
          taskType: task.task_type,
          plantId: task.plant_id || undefined,
          requestPayload: task.request_payload,
          timestamp: new Date(),
        });
      }
    }
  } catch (error: any) {
    logWorker.error("Failed to update task success", {
      queueJobId,
      error: error.message,
    });
    // Don't throw - this is a cleanup operation
  }
}

/**
 * Update AI task with error information
 *
 * @param queueJobId - The BullMQ job ID to find the task
 * @param errorMessage - Error message to store
 */
async function updateTaskError(
  queueJobId: string,
  errorMessage: string
): Promise<void> {
  try {
    const task = await AITask.findOne({ where: { queue_job_id: queueJobId } });
    if (task) {
      await task.update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date(),
      });

      // Refund usage for failed tasks that have usage tracking
      // Usage is charged upfront when enqueueing, so we refund on failure
      if (USAGE_TRACKED_TASK_TYPES.includes(task.task_type) && task.user_id) {
        logWorker.info("Refunding usage for failed task", {
          taskId: task.id,
          taskType: task.task_type,
          userId: task.user_id,
        });
        await decrementUsage(task.user_id);
      }

      // Publish AI task failed event if userId is available
      if (task.user_id) {
        messageBus.publish(MessageBusEvent.AI_TASK_FAILED, {
          taskId: task.id,
          userId: task.user_id,
          error: errorMessage,
          timestamp: new Date(),
        });
      }
    }
  } catch (error: any) {
    logWorker.error("Failed to update task error", {
      queueJobId,
      error: error.message,
    });
    // Don't throw - this is a cleanup operation
  }
}
