/**
 * AI Task Service
 *
 * Centralized service for AI task job status lookups
 * Handles the dual-lookup pattern: Database (source of truth) → Queue (active jobs)
 */

import { AITask } from '../models/AITask';
import { getAITasksQueue } from './queue';
import { logApi } from './logging/logger';

/**
 * Job status response interface
 */
export interface JobStatusResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  type?: string;
  gardenId?: string;
  layouts?: any[];
  result?: any;
  error?: string;
  message?: string;
  createdAt?: Date;
  updatedAt?: Date;
  finishedAt?: Date;
}

/**
 * Get job status from database or queue
 *
 * Lookup strategy:
 * 1. Check database (AITask) - source of truth for completed/failed jobs
 * 2. Fall back to queue - for active jobs not yet persisted
 *
 * @param jobId - BullMQ job ID
 * @returns Job status response or null if not found
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse | null> {
  logApi.info("Getting job status", { jobId });

  // First, try to find the task in the database (source of truth)
  const aiTask = await AITask.findOne({
    where: { queue_job_id: jobId }
  });

  if (aiTask) {
    logApi.info("Task found in database", {
      jobId,
      taskId: aiTask.id,
      status: aiTask.status,
      taskType: aiTask.task_type,
      hasResponseData: !!aiTask.response_data,
    });

    return buildResponseFromDatabase(jobId, aiTask);
  }

  // If not in database, fall back to checking the queue (for active jobs)
  logApi.info("Task not found in database, checking queue", { jobId });

  const queue = getAITasksQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    logApi.warn("Job not found in database or queue", { jobId });
    return null;
  }

  logApi.info("Job found in queue (not yet in DB)", {
    jobId,
    jobName: job.name,
    timestamp: job.timestamp,
    attemptsMade: job.attemptsMade,
  });

  return buildResponseFromQueue(job);
}

/**
 * Build job status response from database record
 */
function buildResponseFromDatabase(jobId: string, aiTask: any): JobStatusResponse {
  // Map database status to frontend-expected status
  let status: 'queued' | 'processing' | 'completed' | 'failed';
  if (aiTask.status === 'pending') {
    status = 'queued';
  } else {
    status = aiTask.status as 'processing' | 'completed' | 'failed';
  }

  // For layout_generation jobs, return frontend-compatible format
  if (aiTask.task_type === 'layout_generation') {
    const response: JobStatusResponse = {
      jobId,
      status,
      gardenId: aiTask.request_payload?.gardenId,
    };

    // Add layouts if completed
    if (status === 'completed' && aiTask.response_data) {
      response.layouts = aiTask.response_data.layouts || [];
      logApi.info("Layout generation completed (from DB)", {
        jobId,
        gardenId: aiTask.request_payload?.gardenId,
        layoutCount: response.layouts?.length || 0,
      });
    }

    // Add error message if failed
    if (status === 'failed') {
      response.message = aiTask.error_message || 'Layout generation failed';
      logApi.error("Layout generation failed (from DB)", {
        jobId,
        gardenId: aiTask.request_payload?.gardenId,
        errorMessage: aiTask.error_message,
      });
    }

    logApi.info("Returning layout generation response from database", {
      jobId,
      status,
      gardenId: aiTask.request_payload?.gardenId,
      hasLayouts: !!response.layouts,
    });

    return response;
  }

  // For other job types, return generic format
  logApi.info("Returning generic job response from database", {
    jobId,
    type: aiTask.task_type,
    status,
  });

  return {
    jobId,
    type: aiTask.task_type,
    status,
    result: aiTask.response_data,
    error: aiTask.error_message,
    createdAt: aiTask.created_at,
    updatedAt: aiTask.updated_at,
    finishedAt: aiTask.completed_at,
  };
}

/**
 * Build job status response from BullMQ queue job
 */
async function buildResponseFromQueue(job: any): Promise<JobStatusResponse> {
  // Get BullMQ job state
  const bullState = await job.getState();

  logApi.info("Job state retrieved from queue", {
    jobId: job.id,
    bullState,
    jobName: job.name,
  });

  // Map BullMQ states to frontend-expected states
  let status: 'queued' | 'processing' | 'completed' | 'failed';
  if (bullState === 'completed') {
    status = 'completed';
  } else if (bullState === 'failed') {
    status = 'failed';
  } else if (bullState === 'active') {
    status = 'processing';
  } else {
    // 'waiting', 'delayed', 'waiting-children', etc.
    status = 'queued';
  }

  // For layout_generation jobs, return frontend-compatible format
  if (job.name === 'layout_generation') {
    const response: JobStatusResponse = {
      jobId: job.id!,
      status,
      gardenId: job.data.gardenId,
    };

    logApi.info("Returning layout generation response from queue", {
      jobId: job.id,
      status,
      gardenId: job.data.gardenId,
    });

    return response;
  }

  // For other job types, return generic format
  return {
    jobId: job.id!,
    type: job.name,
    status: bullState,
    createdAt: new Date(job.timestamp),
  };
}
