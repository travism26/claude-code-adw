# Worker Process Model Initialization Fix

## Issue

The worker process was throwing errors when trying to use Sequelize models:

```
TypeError: Cannot read properties of undefined (reading 'id')
at Function.findOrCreate
```

```
TypeError: Cannot read properties of undefined (reading 'constructor')
at Function.findOne
```

## Root Cause

The worker process (`src/worker.ts`) wasn't initializing the Sequelize models before using them. When the `AITask` model was imported and used in the worker, it was `undefined` because `initSchema()` had never been called on it.

## The Fix

Added model initialization to the worker process startup sequence:

```typescript
// src/worker.ts
import { initializeModels } from './models';

async function main() {
  // ... database connection ...

  // Initialize models BEFORE creating the worker
  console.log('[Worker] Initializing database models...');
  await initializeModels(sequelize);
  console.log('[Worker] Database models initialized');

  // Create and start AI Tasks Worker
  const aiTasksWorker = createAITasksWorker();
  // ...
}
```

## Why This Was Needed

In a two-process architecture:
- **API Server Process** (`src/index.ts`): Already called `initializeModels()`
- **Worker Process** (`src/worker.ts`): Forgot to call `initializeModels()` ❌

Each process needs its own model initialization because they run in separate Node.js processes with separate memory spaces.

## Verification

After restarting the worker process, you should see:

```
[Worker] Connecting to database...
[Worker] Database connection established
[Worker] Initializing database models...
Initializing User model...
Initializing Plant model...
[... all models ...]
Initializing AITask model...
[Worker] Database models initialized
[Worker] Initializing AI Tasks Worker...
[Worker] AI Tasks Worker started successfully
```

## Related Files

- `src/worker.ts` - Worker process entry point (fixed)
- `src/models/index.ts` - Model initialization function
- `src/services/queue/workers/aiTasks.worker.ts` - Uses AITask model

## Testing

Restart your worker process to apply the fix:

```bash
# Stop the current worker (Ctrl+C)

# Start with the fix
npm run start:worker
```

The error should no longer appear when processing AI tasks.

---

**Fixed**: 2025-11-09
