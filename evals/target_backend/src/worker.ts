/**
 * Worker Process Entry Point
 *
 * This is a dedicated process for running BullMQ workers.
 * It should be run separately from the Express API server for proper separation of concerns.
 *
 * Run with: npm run start:worker
 *
 * Architecture:
 * - API Server Process (src/index.ts): Handles HTTP requests, enqueues jobs
 * - Worker Process (src/worker.ts): Processes background jobs from queue
 * - Redis: Shared message queue between processes
 */

import "dotenv/config";
import { getSequelize } from './config/sequelize';
import { initializeModels } from './models';
import { createAITasksWorker } from './services/queue/workers/aiTasks.worker';
import { createFeedingDigestWorker } from './services/queue/workers/feedingDigest.worker';
import { aiConfig } from './config/ai';
import { aiProviderManager } from './services/ai/providers';

/**
 * Main worker process
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Worker Process Starting...');
  console.log('='.repeat(60));

  try {
    // Initialize database connection
    console.log('[Worker] Connecting to database...');
    const sequelize = await getSequelize();
    await sequelize.authenticate();
    console.log('[Worker] Database connection established');

    // Initialize models BEFORE creating the worker
    console.log('[Worker] Initializing database models...');
    await initializeModels(sequelize);
    console.log('[Worker] Database models initialized');

    // AI Provider Health Check (skip in mock mode)
    if (!aiConfig.mockMode) {
      console.log('[Worker] Performing AI provider health check...');
      const healthResult = await aiProviderManager.healthCheck();

      if (healthResult.success) {
        console.log(`[Worker] ✓ AI provider health check passed (${healthResult.provider})`);
      } else {
        console.error(`[Worker] ✗ AI provider health check FAILED`);
        console.error(`[Worker]   Provider: ${healthResult.provider || 'none'}`);
        console.error(`[Worker]   Error: ${healthResult.error}`);
        console.error('[Worker]   Worker will continue but AI tasks may fail.');
        console.error('[Worker]   Check your API key configuration in .env');
      }
    } else {
      console.log('[Worker] AI mock mode enabled - skipping health check');
    }

    // Create and start AI Tasks Worker
    console.log('[Worker] Initializing AI Tasks Worker...');
    const aiTasksWorker = createAITasksWorker();

    // Start the worker
    aiTasksWorker.run();
    console.log('[Worker] AI Tasks Worker started successfully');

    // Create and start Feeding Digest Worker (daily reminder)
    console.log('[Worker] Initializing Feeding Digest Worker...');
    const feedingDigestWorker = createFeedingDigestWorker();
    feedingDigestWorker.run();
    console.log('[Worker] Feeding Digest Worker started successfully');

    console.log('='.repeat(60));
    console.log('Worker Process Ready');
    console.log('Listening for jobs on queues: ai_tasks, feeding_digest');
    console.log('='.repeat(60));

    // Set up graceful shutdown handlers
    const shutdown = async (signal: string) => {
      console.log(`\n[Worker] ${signal} received, shutting down gracefully...`);

      try {
        // Stop workers (waits for current jobs to complete)
        console.log('[Worker] Stopping AI Tasks Worker...');
        await aiTasksWorker.close();
        console.log('[Worker] AI Tasks Worker stopped');

        console.log('[Worker] Stopping Feeding Digest Worker...');
        await feedingDigestWorker.close();
        console.log('[Worker] Feeding Digest Worker stopped');

        // Close database connection
        console.log('[Worker] Closing database connection...');
        const sequelize = await getSequelize();
        await sequelize.close();
        console.log('[Worker] Database connection closed');

        console.log('[Worker] Shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('[Worker] Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Worker] Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit on unhandled rejection, just log it
    });

    process.on('uncaughtException', (error) => {
      console.error('[Worker] Uncaught Exception:', error);
      // Exit on uncaught exception
      shutdown('UNCAUGHT_EXCEPTION');
    });
  } catch (error) {
    console.error('[Worker] Fatal error during startup:', error);
    process.exit(1);
  }
}

// Start the worker process
main();
