import { getSequelize } from '../config/sequelize';
import { initializeModels } from '../models';
import { generateRecommendationsForAllUsers } from '../services/recommendationGenerator';

/**
 * Daily CRON job to generate care recommendations for all users
 * Run with: npx ts-node src/scripts/generateDailyRecommendations.ts
 * Or schedule with cron: 0 6 * * * (6 AM daily)
 */

async function generateDailyRecommendations() {
  const startTime = Date.now();

  try {
    console.log('\n=== Daily Recommendation Generation Started ===');
    console.log(`Time: ${new Date().toISOString()}`);

    console.log('Connecting to database...');
    const sequelize = await getSequelize();
    await initializeModels(sequelize);

    console.log('Generating recommendations for all users...');
    const totalRecommendations = await generateRecommendationsForAllUsers();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n=== Daily Recommendation Generation Complete ===');
    console.log(`Total recommendations created: ${totalRecommendations}`);
    console.log(`Duration: ${duration} seconds`);
    console.log(`Completed at: ${new Date().toISOString()}`);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error generating daily recommendations:', error);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`Failed after ${duration} seconds`);
    process.exit(1);
  }
}

// Run the generation function
generateDailyRecommendations();
