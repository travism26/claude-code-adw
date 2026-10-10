import { getTestHelper, TestHelper } from './setup';
import { initializeAITasksQueue, closeAITasksQueue } from '../services/queue/queues/aiTasks.queue';

// Global testHelper instance for all tests
export let testHelper: TestHelper;

const quiet = !!process.env.TEST_QUIET;

export const mochaHooks = {
  async beforeAll() {
    const workerId = process.env.MOCHA_WORKER_ID || 'main';
    if (!quiet) console.log(`GLOBAL SETUP: Starting all tests (worker ${workerId})`);
    testHelper = await getTestHelper();

    // Initialize AI tasks queue for tests
    try {
      initializeAITasksQueue();
      if (!quiet) console.log('AI tasks queue initialized for tests');
    } catch (error) {
      console.warn('Failed to initialize AI tasks queue for tests:', error instanceof Error ? error.message : String(error));
    }
  },
  async afterAll() {
    const workerId = process.env.MOCHA_WORKER_ID || 'main';
    if (!quiet) console.log(`GLOBAL TEARDOWN: All tests completed (worker ${workerId})`);

    // Close AI tasks queue
    try {
      await closeAITasksQueue();
      if (!quiet) console.log('AI tasks queue closed');
    } catch (error) {
      console.warn('Failed to close AI tasks queue:', error instanceof Error ? error.message : String(error));
    }

    await testHelper.cleanup();
  },
};
