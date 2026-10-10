# Queue Service Architecture

## Overview

The GrowBuddy Queue Service provides asynchronous job processing for AI tasks using BullMQ and Redis. It follows BullMQ best practices with singleton queue instances and a dedicated worker process for optimal scalability, reliability, and performance.

## Architecture

### Design Principles

1. **Singleton Pattern**: Queue instances are initialized once at startup and reused across all requests (no per-request instantiation)
2. **Process Separation**: Workers run in a dedicated process separate from the API server
3. **Type Safety**: Strongly-typed job payload interfaces for each queue
4. **Clear Organization**: Dedicated files for each queue type (e.g., `aiTasks.queue.ts`, `aiTasks.worker.ts`)
5. **Reliability**: Jobs persist in Redis and survive server restarts

### Two-Process Model

GrowBuddy runs two separate Node.js processes:

1. **API Server Process** (`npm run dev`)
   - Handles HTTP requests
   - Enqueues jobs to Redis
   - Does NOT process jobs

2. **Worker Process** (`npm run start:worker`)
   - Processes background jobs from Redis
   - Runs AI tasks, garden analysis, etc.
   - Can be scaled horizontally (multiple instances)

### Components

```
┌─────────────┐                 ┌──────────────┐
│  API Route  │ POST /gardens   │ Worker.ts    │
│  gardens.ts │ /:id/analyze    │ (Dedicated   │
└──────┬──────┘                 │  Process)    │
       │                        └───────┬──────┘
       ▼                                │
┌──────────────────┐                    ▼
│ queueGardenAna-  │            ┌──────────────┐
│ lysisJob()       │            │ AI Worker    │
│ (Singleton)      │            │ (processes   │
└──────┬───────────┘            │  jobs)       │
       │                        └───────┬──────┘
       ▼                                │
┌──────────────────┐                    │
│  Redis Queue     │◄───────────────────┘
│  (ai_tasks)      │
└──────────────────┘
```

### Data Flow

1. **Job Creation**: API route → `queueGardenAnalysisJob()` → Job added to Redis (singleton queue)
2. **Job Processing**: Worker pulls job from Redis → Calls GardenAnalysisService → Updates database
3. **Event Publishing**: Worker publishes MessageBus events when jobs complete
4. **WebSocket Notification**: MessageBus event triggers WebSocket notification to user

## Usage

### Running the Application

You must start BOTH processes for full functionality:

```bash
# Terminal 1: Start API server
npm run dev

# Terminal 2: Start worker process
npm run start:worker
```

### Enqueueing Jobs

```typescript
import { queueGardenAnalysisJob, queueAITask } from './services/queue';

// Queue a garden analysis job (type-safe)
const job = await queueGardenAnalysisJob({
  gardenId: '123',
  userId: '456',
  triggeredBy: 'manual_request',
  timestamp: new Date().toISOString()
});

console.log(`Job enqueued with ID: ${job.id}`);

// Queue a generic AI task
const job2 = await queueAITask('care_recommendation', {
  plantType: 'tomato',
  userId: '456'
});
```

### Direct Queue Access

```typescript
import { getAITasksQueue } from './services/queue';

const queue = getAITasksQueue();

// Get job status
const job = await queue.getJob(jobId);
const state = await job?.getState();

// Get queue metrics
const waiting = await queue.getWaitingCount();
const active = await queue.getActiveCount();
const completed = await queue.getCompletedCount();
```

### Via API

```bash
# Queue garden analysis
curl -X POST http://localhost:3000/api/gardens/<gardenId>/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>"

# Response: { "message": "Garden analysis has been queued", "jobId": "...", "status": "pending" }
```

## Configuration

### Environment Variables

```bash
# Redis Connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Queue Settings
QUEUE_CONCURRENCY=5      # Number of concurrent jobs per worker
QUEUE_MAX_RETRIES=3      # Max retry attempts for failed jobs
QUEUE_RETRY_DELAY=1000   # Base delay for exponential backoff (ms)
```

### Queue Configuration

The queue configuration is managed in `src/config/queue.ts`:

```typescript
export const QUEUE_NAMES = {
  AI_TASKS: 'ai_tasks',
} as const;

export const queueConfig = {
  redis: { host, port, password, db },
  concurrency: 5,
  maxRetries: 3,
  retryDelay: 1000,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
};
```

## Directory Structure

```
src/services/queue/
├── README.md                    # This file
├── index.ts                     # Exports singleton functions and types
├── interfaces.ts                # Legacy interfaces (for backward compatibility)
├── connection.ts                # Shared Redis connection configuration
├── queues/
│   └── aiTasks.queue.ts        # AI tasks queue instance and enqueue functions
└── workers/
    └── aiTasks.worker.ts       # AI tasks worker implementation

src/
├── worker.ts                    # Dedicated worker process entry point
└── index.ts                     # API server entry point (initializes queues, no workers)
```

## Job Lifecycle

1. **Pending**: Job is waiting in queue
2. **Active**: Job is being processed by a worker
3. **Completed**: Job finished successfully (result available)
4. **Failed**: Job failed after all retry attempts (error available)
5. **Delayed**: Job is scheduled for future processing

## Retry Logic

Failed jobs are automatically retried with exponential backoff:

- **Attempt 1**: Immediate
- **Attempt 2**: After 1 second (QUEUE_RETRY_DELAY)
- **Attempt 3**: After 2 seconds (2 × QUEUE_RETRY_DELAY)
- **After 3 failures**: Job marked as permanently failed

## Adding New Queue Types

To add a new queue (e.g., `emailNotifications`):

### 1. Add Queue Name Constant

```typescript
// src/config/queue.ts
export const QUEUE_NAMES = {
  AI_TASKS: 'ai_tasks',
  EMAIL_NOTIFICATIONS: 'email_notifications', // New
} as const;
```

### 2. Create Queue File

```typescript
// src/services/queue/queues/emailNotifications.queue.ts
import { Queue } from 'bullmq';
import { QUEUE_NAMES, queueConfig } from '../../../config/queue';
import { getRedisConnection } from '../connection';

export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
}

let emailQueue: Queue | null = null;

export function initializeEmailQueue(): Queue {
  if (emailQueue) return emailQueue;

  emailQueue = new Queue(QUEUE_NAMES.EMAIL_NOTIFICATIONS, {
    connection: getRedisConnection(),
    defaultJobOptions: queueConfig.defaultJobOptions,
  });

  return emailQueue;
}

export function getEmailQueue(): Queue {
  if (!emailQueue) {
    throw new Error('Email queue not initialized');
  }
  return emailQueue;
}

export async function queueEmail(data: EmailJobData) {
  const queue = getEmailQueue();
  return await queue.add('send_email', data);
}
```

### 3. Create Worker File

```typescript
// src/services/queue/workers/emailNotifications.worker.ts
import { Worker as BullWorker, Job as BullJob } from 'bullmq';
import { QUEUE_NAMES, queueConfig } from '../../../config/queue';
import { getRedisConnection } from '../connection';

export function createEmailWorker(): BullWorker {
  const worker = new BullWorker(
    QUEUE_NAMES.EMAIL_NOTIFICATIONS,
    async (job: BullJob) => {
      // Process email job
      console.log(`Sending email to ${job.data.to}`);
      // ... email sending logic
    },
    {
      connection: getRedisConnection(),
      concurrency: queueConfig.concurrency,
      autorun: false,
    }
  );

  return worker;
}
```

### 4. Update Queue Index

```typescript
// src/services/queue/index.ts
export { queueEmail, initializeEmailQueue } from './queues/emailNotifications.queue';
export { createEmailWorker } from './workers/emailNotifications.worker';

export async function initializeQueues(): Promise<void> {
  const { initializeAITasksQueue } = await import('./queues/aiTasks.queue');
  const { initializeEmailQueue } = await import('./queues/emailNotifications.queue');

  initializeAITasksQueue();
  initializeEmailQueue(); // New
}
```

### 5. Update Worker Process

```typescript
// src/worker.ts
import { createAITasksWorker } from './services/queue/workers/aiTasks.worker';
import { createEmailWorker } from './services/queue/workers/emailNotifications.worker';

const aiTasksWorker = createAITasksWorker();
const emailWorker = createEmailWorker(); // New

aiTasksWorker.run();
emailWorker.run(); // New
```

## Monitoring

### Health Check

```bash
# Check health endpoint
curl http://localhost:3000/health

# Response: { "status": "healthy", "queue": "connected", ... }
```

### Logging

The queue service logs key events:

- Queue initialized
- Job enqueued
- Job processing started
- Job completed
- Job failed
- Worker started/stopped
- Queue errors

## Troubleshooting

### Redis Connection Issues

**Problem**: Queue service fails to connect to Redis

**Solutions**:
1. Verify Redis is running: `redis-cli PING`
2. Check Redis connection settings in `.env`
3. Check Redis logs: `tail -f /var/log/redis/redis.log`
4. Test connection: `redis-cli -h localhost -p 6379`

### Jobs Not Processing

**Problem**: Jobs stay in pending state

**Solutions**:
1. **Verify worker is running**: Check that `npm run start:worker` is active
2. Check worker logs for errors
3. Verify Redis connection in worker process
4. Check queue contents: `redis-cli LLEN bull:ai_tasks:wait`

### "Queue not initialized" Error

**Problem**: `Error: AI tasks queue not initialized`

**Solution**: Ensure `initializeQueues()` is called during API server startup (in `src/index.ts`)

### Worker Process Not Starting

**Problem**: Worker process crashes on startup

**Solutions**:
1. Check database connection (worker needs DB access)
2. Verify Redis connection
3. Check for TypeScript compilation errors
4. Review worker logs for detailed error messages

### Memory Issues

**Problem**: Redis memory usage growing

**Solutions**:
1. Jobs are auto-cleaned with `removeOnComplete: true`
2. Set Redis memory limits: `maxmemory 256mb` in redis.conf
3. Monitor queue size: `redis-cli LLEN bull:ai_tasks:wait`
4. Increase cleanup frequency

## Performance Optimization

### Horizontal Scaling

Run multiple worker processes across different servers:

```bash
# Server 1
npm run start:worker

# Server 2
npm run start:worker

# Both workers process from the same Redis queue
# Jobs are automatically distributed
```

### Concurrency Tuning

Adjust `QUEUE_CONCURRENCY` based on:
- CPU cores available
- AI API rate limits
- Memory constraints

**Guideline**: Start with concurrency = CPU cores, then tune based on monitoring

### Redis Optimization

1. Use Redis persistence (AOF or RDB) for durability
2. Configure appropriate eviction policy: `noeviction` for queue data
3. Use separate Redis DB for queue vs cache
4. Consider Redis Cluster for high availability

## Testing

### Unit Tests

```bash
npm run test:services:ai:unit
```

### Integration Tests

```bash
# Start Redis
redis-server

# Run integration tests
npm run test:services:ai:integration
```

### Flow Tests

```bash
npm run test:services:ai:flow
```

## Security Considerations

1. **Authentication**: All API endpoints require JWT authentication
2. **Authorization**: Users can only trigger analysis for their own gardens
3. **Input Validation**: All payloads validated before enqueueing
4. **Redis Access**: Use password authentication in production
5. **Network Security**: Redis should not be exposed to public internet

## Validation Commands

Execute these commands to verify the refactor is complete:

```bash
# Build check
npm run build

# Test queue/worker integration
npm run test:services:ai:integration

# Test garden analysis endpoint
npm run test:api:gardens

# Verify no per-request instantiation
grep -r "new BullMQService" backend/src --exclude-dir=node_modules

# Verify worker process can start
npm run start:worker

# Verify API server starts separately
npm run dev
```

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [BullMQ Best Practices](https://docs.bullmq.io/guide/best-practices)
- [Redis Documentation](https://redis.io/documentation)
- [Queue Pattern Best Practices](https://www.enterpriseintegrationpatterns.com/patterns/messaging/)
