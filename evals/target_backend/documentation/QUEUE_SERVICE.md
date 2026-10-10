# Queue Service Documentation

The GrowBuddy Queue Service provides asynchronous job processing for AI tasks using BullMQ and Redis. It decouples API requests from long-running AI operations, enabling better scalability, reliability, and user experience.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Programmatic Usage](#programmatic-usage)
- [API Usage](#api-usage)
- [Configuration](#configuration)
- [Job Lifecycle](#job-lifecycle)
- [Monitoring](#monitoring)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

## Overview

The Queue Service handles asynchronous processing of AI tasks, allowing the API to respond quickly while expensive operations run in the background. Jobs are persisted in Redis and processed by dedicated worker processes.

### Key Features

- **Asynchronous Processing**: Non-blocking job execution
- **Reliability**: Jobs persist in Redis and survive server restarts
- **Scalability**: Horizontal scaling with multiple workers
- **Retry Logic**: Automatic retries with exponential backoff
- **Monitoring**: Built-in metrics and health checks
- **Abstraction**: Swap queue implementation without changing consumers

### Use Cases

- AI-powered plant care recommendations
- Weather-based action suggestions
- Pest diagnosis and treatment recommendations
- Batch processing of multiple plants
- Scheduled periodic tasks (future enhancement)

## Architecture

### Design Principles

1. **Abstraction**: Queue implementation is hidden behind interfaces (`QueueService`, `Worker`)
2. **Decoupling**: AIWrapper has no knowledge of the queue system
3. **Reliability**: Jobs persist in Redis and survive crashes
4. **Scalability**: Multiple workers can process jobs concurrently

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       API Layer                             │
│          POST /api/ai-tasks (Express Route)                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ getQueueService().enqueue()
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    QueueService Interface                   │
│          enqueue() | getJob() | getJobStatus()              │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Implemented by
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      BullMQService                          │
│  - Manages BullMQ Queue instance                            │
│  - Enqueues jobs to Redis                                   │
│  - Retrieves job status from Redis                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Redis / BullMQ                         │
│  Queue: ai_tasks                                            │
│  - Stores pending jobs                                      │
│  - Tracks job state and results                             │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Worker polls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      AITaskWorker                           │
│  Implements Worker interface                                │
│  - Listens for jobs on queue                                │
│  - Processes jobs via processor function                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      AIWrapper                              │
│  Pure processing service (no queue knowledge)               │
│  - Receives job data                                        │
│  - Makes AI API request                                     │
│  - Returns result                                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

1. **QueueService Interface** (`interfaces.ts`)
   - Defines contract for queue operations
   - Allows swapping implementations (BullMQ → Kafka, RabbitMQ, etc.)

2. **BullMQService** (`bullmq/BullMQService.ts`)
   - Concrete implementation using BullMQ and Redis
   - Manages job enqueueing and status queries

3. **AITaskWorker** (`bullmq/AITaskWorker.ts`)
   - Background worker that processes jobs
   - Calls AIWrapper for actual AI processing
   - Updates job status and handles errors

4. **Queue Module** (`index.ts`)
   - Exports singleton instances
   - Provides initialization and shutdown functions

## Getting Started

### Prerequisites

- Redis 6+ running locally or remotely
- Environment variables configured (see [Configuration](#configuration))

### Installation

The Queue Service is included in the main GrowBuddy backend. No separate installation needed.

### Initialization

The Queue Service is automatically initialized when the server starts:

```typescript
// In src/index.ts (server startup)
import { initializeQueue } from './services/queue';
import sequelize from './database';

// Initialize queue service and worker
const { queueService, aiTaskWorker } = initializeQueue(sequelize);

// Start the worker
await aiTaskWorker.start();

console.log('Queue service and worker initialized');
```

### Shutdown

Gracefully shutdown the queue service:

```typescript
import { shutdownQueue } from './services/queue';

// During server shutdown
await shutdownQueue(30000); // Wait up to 30 seconds for jobs to complete
```

## Programmatic Usage

Use the Queue Service directly in your code without going through HTTP endpoints.

### Import the Service

```typescript
import { getQueueService } from './services/queue';

// Get the initialized queue service instance
const queueService = getQueueService();
```

### Enqueue a Job

```typescript
import { getQueueService } from './services/queue';
import { v4 as uuidv4 } from 'uuid';

async function requestPlantCareSuggestion(plantId: string, userId: string) {
  const queueService = getQueueService();

  // Enqueue a job
  const job = await queueService.enqueue(
    'plant_update_suggestion', // Job type
    {
      // Job payload
      plantId,
      userId,
      plantName: 'Tomato',
      currentConditions: {
        water_level: 'low',
        temperature: 75,
        humidity: 60
      },
      environment: {
        light: 'full sun',
        location: 'indoor'
      }
    },
    {
      // Optional: Job options
      priority: 5, // 1-10 (higher = more priority)
      delay: 0,    // Delay in milliseconds
      timeout: 60000 // Job timeout (60 seconds)
    }
  );

  console.log(`Job enqueued: ${job.id}`);
  return job.id;
}
```

### Check Job Status (Lightweight)

```typescript
import { getQueueService } from './services/queue';

async function checkJobStatus(jobId: string) {
  const queueService = getQueueService();

  // Get just the status (lightweight operation)
  const status = await queueService.getJobStatus(jobId);

  console.log(`Job ${jobId} status: ${status}`);
  // Possible values: 'pending', 'active', 'completed', 'failed', 'delayed'

  return status;
}
```

### Get Full Job Details

```typescript
import { getQueueService } from './services/queue';

async function getJobDetails(jobId: string) {
  const queueService = getQueueService();

  // Get complete job information
  const job = await queueService.getJob(jobId);

  if (!job) {
    console.log('Job not found');
    return null;
  }

  console.log('Job details:', {
    id: job.id,
    type: job.type,
    status: job.status,
    payload: job.payload,
    result: job.result,      // Available if completed
    error: job.error,        // Available if failed
    attemptsMade: job.attemptsMade,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt
  });

  return job;
}
```

### Monitor Queue Metrics

```typescript
import { getQueueService } from './services/queue';
import { BullMQService } from './services/queue/bullmq/BullMQService';

async function getQueueMetrics() {
  const queueService = getQueueService() as BullMQService;

  // Get queue metrics (BullMQ-specific)
  const metrics = await queueService.getMetrics();

  console.log('Queue metrics:', {
    waiting: metrics.waiting,     // Jobs waiting to be processed
    active: metrics.active,       // Jobs currently processing
    completed: metrics.completed, // Successfully completed jobs
    failed: metrics.failed,       // Failed jobs
    delayed: metrics.delayed      // Scheduled future jobs
  });

  return metrics;
}
```

### Check Queue Health

```typescript
import { isQueueHealthy } from './services/queue';

async function checkQueueHealth() {
  const healthy = await isQueueHealthy();

  if (healthy) {
    console.log('Queue service is healthy');
  } else {
    console.error('Queue service is unhealthy - check Redis connection');
  }

  return healthy;
}
```

### Complete Example: Request and Wait for Result

```typescript
import { getQueueService } from './services/queue';
import { JobStatus } from './services/queue/interfaces';

async function requestAndWaitForAISuggestion(
  plantId: string,
  userId: string
): Promise<any> {
  const queueService = getQueueService();

  // Enqueue the job
  const job = await queueService.enqueue('care_recommendation', {
    plantId,
    userId,
    plantType: 'tomato',
    growthStage: 'flowering'
  });

  console.log(`Job ${job.id} enqueued, waiting for completion...`);

  // Poll for completion (for demonstration - in production use WebSocket)
  while (true) {
    const status = await queueService.getJobStatus(job.id);

    if (status === JobStatus.COMPLETED) {
      const completedJob = await queueService.getJob(job.id);
      console.log('Job completed!', completedJob.result);
      return completedJob.result;
    }

    if (status === JobStatus.FAILED) {
      const failedJob = await queueService.getJob(job.id);
      console.error('Job failed:', failedJob.error);
      throw new Error(failedJob.error?.message || 'Job failed');
    }

    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// NOTE: In production, use WebSocket to receive real-time notifications
// instead of polling. See WEBSOCKET_SERVICE.md for details.
```

### Batch Enqueue Multiple Jobs

```typescript
import { getQueueService } from './services/queue';

async function batchEnqueuePlantCareJobs(plants: Array<{ id: string; type: string }>, userId: string) {
  const queueService = getQueueService();

  const jobPromises = plants.map(plant =>
    queueService.enqueue('care_recommendation', {
      plantId: plant.id,
      userId,
      plantType: plant.type,
      growthStage: 'unknown'
    })
  );

  // Enqueue all jobs in parallel
  const jobs = await Promise.all(jobPromises);

  console.log(`Enqueued ${jobs.length} jobs`);
  return jobs.map(job => job.id);
}
```

## API Usage

Use the Queue Service via HTTP endpoints for external access.

### Enqueue a Job

**Endpoint**: `POST /api/ai-tasks`

**Authentication**: Required (JWT token)

**Request**:
```http
POST /api/ai-tasks HTTP/1.1
Host: localhost:3001
Content-Type: application/json
Authorization: Bearer <your-jwt-token>

{
  "type": "care_recommendation",
  "payload": {
    "plantType": "tomato",
    "growthStage": "flowering",
    "location": "indoor"
  },
  "priority": 5
}
```

**Valid Task Types**:
- `plant_update_suggestion`
- `weather_based_action`
- `care_recommendation`
- `pest_diagnosis`
- `general`

**Response** (202 Accepted):
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "type": "care_recommendation",
  "message": "AI task enqueued successfully"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:3001/api/ai-tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "type": "care_recommendation",
    "payload": {
      "plantType": "tomato",
      "growthStage": "flowering"
    }
  }'
```

### Get Job Details

**Endpoint**: `GET /api/ai-tasks/:jobId`

**Request**:
```http
GET /api/ai-tasks/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Host: localhost:3001
Authorization: Bearer <your-jwt-token>
```

**Response** (200 OK):
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "care_recommendation",
  "status": "completed",
  "result": {
    "suggestion": {
      "action": "Water your tomato plant with 1-2 cups of water",
      "reason": "The water level is low and tomatoes need consistent moisture during flowering",
      "confidence": 0.92,
      "additionalInfo": {}
    }
  },
  "attemptsMade": 1,
  "createdAt": "2025-01-23T10:30:00.000Z",
  "updatedAt": "2025-01-23T10:30:05.000Z",
  "finishedAt": "2025-01-23T10:30:05.000Z"
}
```

**cURL Example**:
```bash
curl http://localhost:3001/api/ai-tasks/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Get Job Status (Lightweight)

**Endpoint**: `GET /api/ai-tasks/:jobId/status`

**Request**:
```http
GET /api/ai-tasks/550e8400-e29b-41d4-a716-446655440000/status HTTP/1.1
Host: localhost:3001
Authorization: Bearer <your-jwt-token>
```

**Response** (200 OK):
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed"
}
```

## Configuration

### Environment Variables

Configure the Queue Service via environment variables in `.env`:

```bash
# Redis Connection (Required)
REDIS_HOST=localhost           # Redis server hostname
REDIS_PORT=6379                # Redis server port
REDIS_PASSWORD=                # Redis password (leave empty if none)
REDIS_DB=0                     # Redis database number (0-15)

# Queue Behavior (Optional - defaults shown)
QUEUE_CONCURRENCY=5            # Number of concurrent jobs per worker
QUEUE_MAX_RETRIES=3            # Maximum retry attempts for failed jobs
QUEUE_RETRY_DELAY=1000         # Base delay for exponential backoff (ms)
```

### Queue Configuration Object

The queue configuration is managed in `src/config/queue.ts`:

```typescript
export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  concurrency: number;  // How many jobs to process simultaneously
  maxRetries: number;   // How many times to retry a failed job
  retryDelay: number;   // Base delay for exponential backoff (ms)
}

export const queueConfig: QueueConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
  concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
  maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.QUEUE_RETRY_DELAY || '1000'),
};
```

### Tuning Concurrency

The `QUEUE_CONCURRENCY` setting controls how many jobs a single worker processes simultaneously.

**Guidelines**:
- **Low concurrency (1-2)**: Good for CPU-intensive jobs or strict rate limits
- **Medium concurrency (3-5)**: Balanced approach, good default
- **High concurrency (10+)**: Good for I/O-bound jobs with lenient rate limits

**Example scenarios**:
```bash
# Conservative: AI provider has strict rate limits
QUEUE_CONCURRENCY=2

# Balanced: Default setting for most use cases
QUEUE_CONCURRENCY=5

# Aggressive: Fast processing with generous API limits
QUEUE_CONCURRENCY=10
```

**Note**: Total concurrency = `QUEUE_CONCURRENCY` × number of workers

## Job Lifecycle

Jobs progress through these states:

### State Diagram

```
┌─────────┐
│ PENDING │ ◄─── Job enqueued, waiting in queue
└────┬────┘
     │
     ▼
┌─────────┐
│  ACTIVE │ ◄─── Worker picked up job, processing
└────┬────┘
     │
     ├─────────► Success
     │              │
     │              ▼
     │         ┌───────────┐
     │         │ COMPLETED │ ◄─── Job finished successfully
     │         └───────────┘
     │
     └─────────► Failure
                    │
                    ▼
               ┌─────────┐
               │  FAILED │ ◄─── Job failed (retry if attempts remain)
               └────┬────┘
                    │
                    ├─────────► Retry
                    │              │
                    │              ▼
                    │         Back to PENDING
                    │
                    └─────────► No retries left
                                   │
                                   ▼
                              Permanently FAILED
```

### State Descriptions

1. **PENDING**: Job is waiting in the queue to be picked up by a worker
2. **ACTIVE**: Job is currently being processed by a worker
3. **COMPLETED**: Job finished successfully, result is available
4. **FAILED**: Job failed after all retry attempts, error is available
5. **DELAYED**: Job is scheduled for future processing (not yet supported)

### Retry Logic

Failed jobs are automatically retried with **exponential backoff**:

- **Attempt 1**: Immediate processing
- **Attempt 2**: Wait `QUEUE_RETRY_DELAY` ms (default: 1 second)
- **Attempt 3**: Wait `2 × QUEUE_RETRY_DELAY` ms (default: 2 seconds)
- **Attempt 4**: Wait `4 × QUEUE_RETRY_DELAY` ms (default: 4 seconds)

After `QUEUE_MAX_RETRIES` attempts (default: 3), the job is marked as permanently failed.

**Example**:
```
Job fails at 10:00:00
├─> Retry 1 at 10:00:01 (1s delay)
├─> Retry 2 at 10:00:03 (2s delay)
└─> Retry 3 at 10:00:07 (4s delay)
    └─> Still failed → Permanently FAILED
```

## Monitoring

### Queue Metrics

Get real-time metrics about queue state:

```typescript
import { getQueueService } from './services/queue';
import { BullMQService } from './services/queue/bullmq/BullMQService';

const queueService = getQueueService() as BullMQService;
const metrics = await queueService.getMetrics();

console.log({
  waiting: metrics.waiting,     // Jobs in queue
  active: metrics.active,       // Jobs processing
  completed: metrics.completed, // Successful jobs
  failed: metrics.failed,       // Failed jobs
  delayed: metrics.delayed      // Scheduled jobs
});
```

### Health Checks

**Programmatic**:
```typescript
import { isQueueHealthy } from './services/queue';

const healthy = await isQueueHealthy();
// Returns true if Redis is connected and queue is operational
```

**HTTP Endpoint**:
```bash
curl http://localhost:3001/health
# Response: { "status": "healthy", "queue": "connected" }
```

### Logging

The Queue Service logs important events:

```
[QueueModule] Initializing queue service: ai_tasks
[QueueModule] Queue service initialized successfully
[AITaskWorker] Worker started, processing jobs...
[AITaskWorker] Processing job: 550e8400-e29b-41d4-a716-446655440000
[AITaskWorker] Job 550e8400-e29b-41d4-a716-446655440000 completed successfully
[QueueModule] Shutting down queue service...
```

Enable debug logging (if implemented):
```bash
LOG_LEVEL=debug npm start
```

## Error Handling

### Common Errors

#### Redis Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Cause**: Redis is not running or not accessible

**Solution**:
```bash
# Start Redis
redis-server

# Or check Redis is running
redis-cli PING
# Should return: PONG
```

#### Queue Not Initialized Error

```
Error: Queue service not initialized. Call initializeQueue() first.
```

**Cause**: Attempting to use `getQueueService()` before initialization

**Solution**: Ensure `initializeQueue()` is called during server startup

#### Job Processing Timeout

**Cause**: Job takes longer than configured timeout

**Solution**: Increase timeout when enqueueing:
```typescript
await queueService.enqueue('task_type', payload, {
  timeout: 120000 // 2 minutes instead of default 60s
});
```

### Error Recovery

The Queue Service is designed to be fault-tolerant:

1. **Worker Crashes**: Jobs remain in Redis and are reprocessed when worker restarts
2. **Redis Crashes**: Jobs are lost (use Redis persistence to prevent this)
3. **API Failures**: Jobs are retried with exponential backoff
4. **Invalid Payloads**: Jobs fail immediately with validation error

## Testing

### Unit Tests

Test the queue service in isolation:

```bash
npm run test:services
```

### Integration Tests

Test the full workflow (API → Queue → Worker → AI):

```bash
npm run test:api
```

### Manual Testing

#### Test Enqueueing

```typescript
import { getQueueService } from './services/queue';

const queueService = getQueueService();

const job = await queueService.enqueue('care_recommendation', {
  plantType: 'tomato',
  growthStage: 'seedling'
});

console.log('Job ID:', job.id);
```

#### Test via API

```bash
# Enqueue a job
curl -X POST http://localhost:3001/api/ai-tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"type":"care_recommendation","payload":{"plantType":"tomato"}}'

# Check status
curl http://localhost:3001/api/ai-tasks/JOB_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Jobs Not Processing

**Symptoms**: Jobs stuck in `pending` state

**Diagnosis**:
```typescript
// 1. Check worker is running
const worker = getAITaskWorker();
console.log('Worker running:', worker.isRunning());

// 2. Check queue metrics
const metrics = await queueService.getMetrics();
console.log('Active jobs:', metrics.active);

// 3. Check Redis connection
const healthy = await isQueueHealthy();
console.log('Queue healthy:', healthy);
```

**Solutions**:
- Verify worker is started: `await aiTaskWorker.start()`
- Check worker logs for errors
- Verify AI API keys are configured
- Check Redis is running: `redis-cli PING`

### Jobs Failing Repeatedly

**Symptoms**: All jobs end up in `failed` state

**Diagnosis**:
```typescript
// Get failed job details
const job = await queueService.getJob(jobId);
console.log('Error:', job.error);
console.log('Attempts:', job.attemptsMade);
```

**Common Causes**:
- **Invalid AI API key**: Check `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
- **Rate limiting**: Reduce `QUEUE_CONCURRENCY` or add delays
- **Invalid payload**: Ensure payload matches expected format
- **Network issues**: Check internet connectivity

### High Memory Usage

**Symptoms**: Redis memory growing continuously

**Diagnosis**:
```bash
# Check Redis memory usage
redis-cli INFO memory
```

**Solutions**:
```typescript
// Enable automatic job cleanup
await queueService.enqueue('task_type', payload, {
  removeOnComplete: true,  // Remove job after completion
  removeOnFail: true       // Remove job after failure
});
```

Or configure Redis eviction policy:
```bash
# In redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### Slow Queue Processing

**Symptoms**: Jobs taking too long to complete

**Diagnosis**:
- Check `QUEUE_CONCURRENCY` setting
- Monitor AI API response times
- Check network latency to AI providers

**Solutions**:
- Increase worker concurrency: `QUEUE_CONCURRENCY=10`
- Run multiple workers across servers
- Use faster AI models (e.g., GPT-3.5 instead of GPT-4)

## Advanced Topics

### Horizontal Scaling

Run multiple workers across different servers, all connected to the same Redis instance:

**Server 1**:
```bash
REDIS_HOST=redis.example.com QUEUE_CONCURRENCY=5 npm start
```

**Server 2**:
```bash
REDIS_HOST=redis.example.com QUEUE_CONCURRENCY=5 npm start
```

Both workers will process jobs from the same queue. Total concurrency: 10.

### Swapping Queue Implementation

To replace BullMQ with another queue system (e.g., Kafka, RabbitMQ):

#### Step 1: Implement QueueService Interface

```typescript
// src/services/queue/kafka/KafkaQueueService.ts
import { QueueService, Job, JobStatus, EnqueueOptions } from '../interfaces';

export class KafkaQueueService implements QueueService {
  async enqueue<TPayload>(
    type: string,
    payload: TPayload,
    options?: EnqueueOptions
  ): Promise<Job<TPayload>> {
    // Kafka-specific implementation
    // Produce message to Kafka topic
  }

  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    // Query job status from database or Kafka
  }

  async getJob<TPayload, TResult>(jobId: string): Promise<Job<TPayload, TResult> | null> {
    // Retrieve full job details
  }

  async isHealthy(): Promise<boolean> {
    // Check Kafka broker connection
  }

  async close(): Promise<void> {
    // Disconnect from Kafka
  }
}
```

#### Step 2: Update Queue Initialization

```typescript
// src/services/queue/index.ts
import { KafkaQueueService } from './kafka/KafkaQueueService';
import { KafkaWorker } from './kafka/KafkaWorker';

export function initializeQueue(sequelize: Sequelize, queueName: string = 'ai_tasks') {
  // Switch to Kafka implementation
  queueServiceInstance = new KafkaQueueService(queueName);
  aiTaskWorkerInstance = new KafkaWorker(sequelize, queueName);

  return { queueService: queueServiceInstance, aiTaskWorker: aiTaskWorkerInstance };
}
```

**No changes needed** to:
- AIWrapper (doesn't know about queues)
- API routes (use `getQueueService()` abstraction)
- Frontend (uses HTTP API)

### Priority Queues

Prioritize important jobs:

```typescript
// High priority (processed first)
await queueService.enqueue('care_recommendation', payload, { priority: 10 });

// Normal priority
await queueService.enqueue('care_recommendation', payload, { priority: 5 });

// Low priority (processed last)
await queueService.enqueue('care_recommendation', payload, { priority: 1 });
```

### Delayed Jobs

Schedule jobs for future processing:

```typescript
// Process this job in 5 minutes
await queueService.enqueue('care_recommendation', payload, {
  delay: 5 * 60 * 1000 // 5 minutes in milliseconds
});
```

### Job Events (BullMQ-specific)

Listen to job events for custom logic:

```typescript
import { BullMQService } from './services/queue/bullmq/BullMQService';

const queueService = getQueueService() as BullMQService;
const queue = queueService.getQueue(); // Access underlying BullMQ queue

queue.on('completed', (job) => {
  console.log(`Job ${job.id} completed!`);
  // Custom logic: send email, update analytics, etc.
});

queue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
  // Custom logic: alert admins, log to external service, etc.
});
```

---

## See Also

- [Main Documentation](./README.md)
- [WebSocket Service](./WEBSOCKET_SERVICE.md) - Real-time notifications
- [AI Service](./AI_SERVICE.md) - AI processing details
- [BullMQ Documentation](https://docs.bullmq.io/)

---

**Last Updated**: 2025-01-23
