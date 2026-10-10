/**
 * Feeding Digest Worker
 *
 * Processes the recurring daily digest job: builds one consolidated "feeding
 * due" notification per user with planned feedings today. Runs in the worker
 * process (src/worker.ts).
 */

import { Worker as BullWorker, Job as BullJob } from 'bullmq';
import { QUEUE_NAMES } from '../../../config/queue';
import { getRedisConnection } from '../connection';
import { FeedingDigestService } from '../../FeedingDigestService';
import { runWithCorrelationId, generateCorrelationId } from '../../logging/correlation';
import { logWorker } from '../../logging/logger';

export function createFeedingDigestWorker(): BullWorker {
  logWorker.info('Creating feeding digest worker...');

  const worker = new BullWorker(
    QUEUE_NAMES.FEEDING_DIGEST,
    async (job: BullJob) => {
      const correlationId = job.data?.correlationId || generateCorrelationId();
      return runWithCorrelationId(correlationId, async () => {
        const result = await FeedingDigestService.runDailyDigest();
        logWorker.info('Feeding digest run complete', {
          jobId: job.id,
          users: result.users,
          sent: result.sent,
        });
        return result;
      });
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
      autorun: false,
    }
  );

  worker.on('failed', (job: BullJob | undefined, error: Error) => {
    logWorker.error('Feeding digest job failed', {
      jobId: job?.id || 'unknown',
      error: error.message,
    });
  });
  worker.on('error', (error: Error) => {
    logWorker.error('Feeding digest worker error', { error: error.message });
  });

  logWorker.info('Feeding digest worker created');
  return worker;
}
