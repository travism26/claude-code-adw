/**
 * Test Script for Weather Action Service
 *
 * This script demonstrates the weather action service and shows the prompts
 * that would be sent to the AI. Run this to review the prompt engineering
 * before enabling AI API calls.
 *
 * Usage:
 * npx ts-node src/scripts/testWeatherActionAnalysis.ts [garden-id] [user-id]
 *
 * Example:
 * npx ts-node src/scripts/testWeatherActionAnalysis.ts
 *
 * If no IDs provided, it will use the first garden found in the database.
 */

import { WeatherActionService } from '../services/ai/weather';
import { Garden } from '../models/Garden';
import { User } from '../models/User';

async function testWeatherActionAnalysis() {
  try {
    console.log('🌦️  Weather Action Service Test\n');

    // Get command line arguments
    const gardenId = process.argv[2];
    const userId = process.argv[3];

    let testGardenId: string | undefined;
    let testUserId: string;

    if (userId) {
      // Use provided user ID
      testUserId = userId;
      testGardenId = gardenId;
      console.log(`Using provided IDs:`);
      console.log(`  User ID: ${testUserId}`);
      if (testGardenId) {
        console.log(`  Garden ID: ${testGardenId}\n`);
      } else {
        console.log('  Garden ID: Not provided (will analyze all user plants)\n');
      }
    } else {
      // Find first available garden
      console.log('No IDs provided, finding first available garden...\n');

      const firstGarden = await Garden.findOne({
        include: ['plots'],
      });

      if (!firstGarden) {
        console.log('⚠️  No gardens found. Will test with user plants only.');
        const firstUser = await User.findOne();
        if (!firstUser) {
          console.error('❌ No users found in database.');
          process.exit(1);
        }
        testUserId = firstUser.id;
        testGardenId = undefined;
      } else {
        testGardenId = firstGarden.id;
        testUserId = firstGarden.user_id;

        console.log(`Found garden:`);
        console.log(`  Garden ID: ${testGardenId}`);
        console.log(`  Garden Name: ${firstGarden.name}`);
        console.log(`  User ID: ${testUserId}\n`);
      }
    }

    // Verify user exists
    const user = await User.findByPk(testUserId);
    if (!user) {
      console.error(`❌ User not found: ${testUserId}`);
      process.exit(1);
    }

    // Run analysis
    console.log('Running weather action analysis...\n');
    console.log('='.repeat(80));

    const analysisService = new WeatherActionService();
    const result = await analysisService.analyze({
      gardenId: testGardenId,
      userId: testUserId,
    });

    console.log('='.repeat(80));
    console.log('\n✅ Analysis completed!\n');

    // Display results summary
    console.log('📊 ANALYSIS RESULTS SUMMARY');
    console.log('='.repeat(80));
    if (result.context.garden) {
      console.log(`Garden: ${result.context.garden.name}`);
    }
    console.log(`Location: ${result.context.weather.location}`);
    console.log(`Overall Score: ${result.overallScore}/100`);
    console.log(`Analyzed At: ${result.analyzedAt.toISOString()}`);
    console.log(`\nSummary: ${result.summary}`);
    console.log(`\nSuggestions (${result.suggestions.length}):`);

    result.suggestions.forEach((suggestion, index) => {
      const priorityEmoji =
        suggestion.priority === 'high' ? '🔴' : suggestion.priority === 'medium' ? '🟡' : '🟢';
      console.log(
        `\n${index + 1}. ${priorityEmoji} [${suggestion.category}] ${suggestion.title}`
      );
      console.log(`   ${suggestion.description}`);
      console.log(`   Type: ${suggestion.type} | Priority: ${suggestion.priority}`);
      if (suggestion.affectedIds.length > 0) {
        console.log(`   Affected Items: ${suggestion.affectedIds.length}`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 TIP: Review the prompts above to see what context is sent to the AI.');
    console.log('   To enable actual AI calls, set ENABLE_AI_CALLS = true in');
    console.log('   backend/src/services/ai/weather/WeatherActionService.ts\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during analysis:', error);
    process.exit(1);
  }
}

// Run the test
testWeatherActionAnalysis();
