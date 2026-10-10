import cron from 'node-cron';
import { generateRecommendationsForAllUsers } from '../services/recommendationGenerator';

/**
 * CRON job scheduler for background tasks
 * Schedules daily recommendation generation and other periodic tasks
 */

export function initializeCronJobs() {
  console.log('Initializing CRON job scheduler...');

  // Daily recommendation generation at 6 AM
  cron.schedule('0 6 * * *', async () => {
    console.log('\n[CRON] Daily recommendation generation started at', new Date().toISOString());
    try {
      const count = await generateRecommendationsForAllUsers();
      console.log(`[CRON] Generated ${count} recommendations`);
    } catch (error) {
      console.error('[CRON] Error generating recommendations:', error);
    }
  });

  console.log('✓ Scheduled: Daily recommendations (6:00 AM)');

  // Optional: Weekly cleanup of old data (Sundays at 2 AM)
  cron.schedule('0 2 * * 0', async () => {
    console.log('\n[CRON] Weekly cleanup started at', new Date().toISOString());
    try {
      // Add cleanup tasks here if needed
      // For example: delete old notifications, archive old data, etc.
      console.log('[CRON] Weekly cleanup completed');
    } catch (error) {
      console.error('[CRON] Error during weekly cleanup:', error);
    }
  });

  console.log('✓ Scheduled: Weekly cleanup (Sunday 2:00 AM)');

  console.log('CRON scheduler initialized successfully\n');
}

// Allow running cron jobs manually for testing
if (require.main === module) {
  console.log('Running CRON scheduler in standalone mode...');
  initializeCronJobs();
  console.log('CRON jobs are now running. Press Ctrl+C to exit.');
}
