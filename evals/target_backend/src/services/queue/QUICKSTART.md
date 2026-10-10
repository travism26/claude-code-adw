# Queue Service - Quick Start Guide

A simple guide for developers to start using the queue system immediately.

## TL;DR - Common Patterns

### Pattern 1: Queue a Garden Analysis Job

```typescript
// In any route file
import { queueGardenAnalysisJob } from '../services/queue';

// Inside your route handler
const job = await queueGardenAnalysisJob({
  gardenId: gardenId,
  userId: userId,
  triggeredBy: 'manual_request',
  timestamp: new Date().toISOString()
});

// Return 202 Accepted
return res.status(202).json({
  message: "Garden analysis has been queued",
  jobId: job.id,
  status: "pending"
});
```

### Pattern 2: Queue a Generic AI Task

```typescript
// In any route file
import { queueAITask } from '../services/queue';

// Inside your route handler
const job = await queueAITask('care_recommendation', {
  userId: userId,
  plantId: plantId,
  // ... any other data your worker needs
});

// Optional: with priority and delay
const urgentJob = await queueAITask('pest_identification',
  { imageUrl: url, userId: userId },
  {
    priority: 1,      // Higher priority (lower number = higher priority)
    delay: 5000,      // Delay 5 seconds before processing
    attempts: 5       // Retry up to 5 times
  }
);
```

### Pattern 3: Check Job Status

```typescript
import { getAITasksQueue } from '../services/queue';

const queue = getAITasksQueue();
const job = await queue.getJob(jobId);

if (job) {
  const state = await job.getState();  // 'waiting', 'active', 'completed', 'failed'
  const progress = job.progress;        // Current progress (if set)
  const result = job.returnvalue;       // Result data (if completed)
  const error = job.failedReason;       // Error message (if failed)
}
```

## Step-by-Step: Adding a New Background Task

### Step 1: Import the Queue Function

```typescript
// At the top of your route file
import { queueAITask } from '../services/queue';
```

### Step 2: Enqueue the Job in Your Route

```typescript
router.post('/plants/:id/diagnose', authenticateJWT, async (req, res) => {
  const { symptoms, imageUrl } = req.body;

  // Enqueue the job
  const job = await queueAITask('plant_diagnosis', {
    plantId: req.params.id,
    userId: req.user!.id,
    symptoms,
    imageUrl
  });

  // Return immediately (don't wait for processing)
  return res.status(202).json({
    message: "Plant diagnosis has been queued",
    jobId: job.id,
    status: "pending"
  });
});
```

### Step 3: Handle the Job in the Worker

The worker (`src/services/queue/workers/aiTasks.worker.ts`) will automatically process it:

```typescript
// The worker already handles job routing based on job.name
// Add a new case to the switch statement:

switch (job.name) {
  case 'garden_analysis':
    // existing handler
    break;

  case 'plant_diagnosis':  // NEW
    result = await handlePlantDiagnosis(job.data);
    break;
}
```

### Step 4: Create the Handler Function

```typescript
// In the same worker file
async function handlePlantDiagnosis(data: any) {
  const { plantId, userId, symptoms, imageUrl } = data;

  // Your AI/business logic here
  const diagnosis = await PlantDiagnosisService.diagnose({
    symptoms,
    imageUrl
  });

  // Save to database
  await Diagnosis.create({
    plant_id: plantId,
    user_id: userId,
    diagnosis: diagnosis.result,
    confidence: diagnosis.confidence
  });

  // Publish event for WebSocket notification
  messageBus.publish('plant_diagnosis_completed', {
    plantId,
    userId,
    diagnosis
  });

  return { success: true, diagnosis };
}
```

## Available Queue Functions

| Function | Purpose | Example |
|----------|---------|---------|
| `queueGardenAnalysisJob(data)` | Queue garden analysis | See Pattern 1 above |
| `queueAITask(type, data, options?)` | Queue any AI task | See Pattern 2 above |
| `getAITasksQueue()` | Get queue instance | For advanced operations |

## Important Notes

### DO:
✅ Return `202 Accepted` immediately when enqueueing
✅ Include a `jobId` in the response
✅ Use WebSockets to notify users when jobs complete
✅ Handle errors in your worker functions
✅ Publish MessageBus events when jobs complete

### DON'T:
❌ Wait for job completion in the route (defeats the purpose)
❌ Create new Queue instances (use the singleton)
❌ Process jobs in the API server process
❌ Forget to start the worker process (`npm run start:worker`)

## Real-World Example

**See**: `src/routes/gardens.ts:627-674` for a complete example of:
- Request validation
- Authorization check
- Job enqueueing
- Proper response handling

## WebSocket Notifications

When your job completes, notify the user via WebSocket:

```typescript
// In your worker handler function
messageBus.publish('task_completed', {
  userId: data.userId,
  taskType: 'plant_diagnosis',
  result: diagnosis
});
```

The `GardenEventHandler` will automatically send WebSocket notifications to connected users.

## Debugging

### Check if queue is healthy:
```bash
curl http://localhost:3000/health
# Should show: "queue": "connected"
```

### View Redis queue contents:
```bash
redis-cli
> LLEN bull:ai_tasks:wait        # Number of waiting jobs
> LLEN bull:ai_tasks:active      # Number of active jobs
> LLEN bull:ai_tasks:completed   # Number of completed jobs
```

### Check worker logs:
The worker process logs all job processing. Look for:
- `[Worker] Processing job: <jobId>`
- `[Worker] Job completed: <jobId>`
- `[Worker] Job failed: <jobId>`

## Need More Details?

See the comprehensive documentation in `README.md` in this directory for:
- Architecture diagrams
- Configuration options
- Advanced patterns
- Troubleshooting guide
- Performance optimization
