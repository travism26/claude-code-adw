/**
 * Reset User Analysis Count Script
 *
 * Resets a user's daily AI analysis count to 0 by their email address.
 * This is useful when a user has been incorrectly charged for failed analyses.
 *
 * Usage:
 *   npx ts-node src/scripts/resetUserAnalysisCount.ts <email>
 *
 * Example:
 *   npx ts-node src/scripts/resetUserAnalysisCount.ts user@example.com
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { getSequelize } from '../config/sequelize';
import { initializeModels } from '../models';
import { User } from '../models/User';
import { AnalysisUsage } from '../models/AnalysisUsage';
import moment from 'moment-timezone';

async function resetUserAnalysisCount(email: string) {
  try {
    console.log('Connecting to database...');
    const sequelize = await getSequelize();
    await initializeModels(sequelize);

    // Find user by email
    const user = await User.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      console.error(`\n❌ User not found with email: ${email}`);
      process.exit(1);
    }

    console.log(`\nFound user: ${user.email} (ID: ${user.id})`);

    // Get today's date in user's timezone
    const userTimezone = user.tz || 'America/New_York';
    const today = moment.tz(userTimezone).format('YYYY-MM-DD');

    console.log(`User timezone: ${userTimezone}`);
    console.log(`Today's date (user's timezone): ${today}`);

    // Find today's usage record
    const usageRecord = await AnalysisUsage.findOne({
      where: {
        user_id: user.id,
        usage_date: today,
      },
    });

    if (!usageRecord) {
      console.log(`\n✅ No usage record found for today - user has not used any analyses.`);
      await sequelize.close();
      process.exit(0);
    }

    // Show current usage before reset
    console.log(`\nCurrent usage for today:`);
    console.log(`  Analyses used: ${usageRecord.analyses_used}`);
    console.log(`  Bonus analyses: ${usageRecord.bonus_analyses}`);

    // Reset the usage count to 0
    const previousCount = usageRecord.analyses_used;
    usageRecord.analyses_used = 0;
    await usageRecord.save();

    console.log(`\n✅ Reset complete!`);
    console.log(`  Previous count: ${previousCount}`);
    console.log(`  New count: 0`);
    console.log(`  Bonus analyses preserved: ${usageRecord.bonus_analyses}`);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error resetting usage count:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: npx ts-node src/scripts/resetUserAnalysisCount.ts <email>');
  console.error('Example: npx ts-node src/scripts/resetUserAnalysisCount.ts user@example.com');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error(`Invalid email format: ${email}`);
  process.exit(1);
}

resetUserAnalysisCount(email);
