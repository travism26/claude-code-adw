/**
 * Feeding Digest Queue
 *
 * Drives the single daily "feeding due" reminder. A repeatable job fires once a
 * day; the worker (feedingDigest.worker.ts) consolidates each user's due
 * feedings into ONE notification. Producer side only — call
 * initializeFeedingDigestQueue() + scheduleDailyDigest() at API startup.
 */

import { Queue, Job as BullJob } from 'bullmq';
import { QUEUE_NAMES, queueConfig } from '../../../config/queue';
import { getRedisConnection } from '../connection';
import { logQueue } from '../../logging/logger';

/** Job name for the recurring daily digest. */
export const DAILY_DIGEST_JOB = 'daily_feeding_digest';

/** Cron for the daily run — 13:00 UTC (morning across North America). */
const DAILY_DIGEST_CRON = process.env.FEEDING_DIGEST_CRON || '0 13 * * *';

let feedingDigestQueue: Queue | null = null;

export function initializeFeedingDigestQueue(): Queue {
  if (feedingDigestQueue) return feedingDigestQueue;

  logQueue.info('Initializing feeding digest queue...');
  feedingDigestQueue = new Queue(QUEUE_NAMES.FEEDING_DIGEST, {
    connection: getRedisConnection(),
    defaultJobOptions: queueConfig.defaultJobOptions,
  });
  feedingDigestQueue.on('error', (error: Error) => {
    logQueue.error('Feeding digest queue error', { error: error.message });
  });
  logQueue.info('Feeding digest queue initialized');
  return feedingDigestQueue;
}

export function getFeedingDigestQueue(): Queue {
  if (!feedingDigestQueue) {
    throw new Error('Feeding digest queue not initialized. Call initializeFeedingDigestQueue() first.');
  }
  return feedingDigestQueue;
}

/**
 * Register (idempotently) the repeatable daily digest job. BullMQ dedupes
 * repeatable jobs by name + cron, so calling this on every startup is safe.
 */
export async function scheduleDailyDigest(): Promise<void> {
  const queue = getFeedingDigestQueue();
  await queue.add(
    DAILY_DIGEST_JOB,
    {},
    {
      repeat: { pattern: DAILY_DIGEST_CRON },
      removeOnComplete: true,
      removeOnFail: { age: 86400, count: 100 },
    }
  );
  logQueue.info('Daily feeding digest scheduled', { cron: DAILY_DIGEST_CRON });
}

/** Enqueue an immediate digest run (manual trigger / tests). */
export async function triggerFeedingDigestNow(): Promise<BullJob> {
  const queue = getFeedingDigestQueue();
  return queue.add(DAILY_DIGEST_JOB, { manual: true }, { removeOnComplete: true });
}

export async function closeFeedingDigestQueue(): Promise<void> {
  if (feedingDigestQueue) {
    await feedingDigestQueue.close();
    feedingDigestQueue = null;
    logQueue.info('Feeding digest queue closed');
  }
}
