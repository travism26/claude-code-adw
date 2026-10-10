/**
 * Test Script for Plant Care Service
 *
 * This script demonstrates the plant care service and shows the prompts
 * that would be sent to the AI. Run this to review the prompt engineering
 * before enabling AI API calls.
 *
 * Usage:
 * npx ts-node src/scripts/testPlantCareAnalysis.ts [plant-id] [user-id]
 *
 * Example:
 * npx ts-node src/scripts/testPlantCareAnalysis.ts
 *
 * If no IDs provided, it will use the first plant found in the database.
 */

import { PlantCareService } from '../services/ai/plant';
import { Plant } from '../models/Plant';
import { User } from '../models/User';

async function testPlantCareAnalysis() {
  try {
    console.log('🌱 Plant Care Service Test\n');

    // Get command line arguments
    const plantId = process.argv[2];
    const userId = process.argv[3];

    let testPlantId: string;
    let testUserId: string;

    if (plantId && userId) {
      // Use provided IDs
      testPlantId = plantId;
      testUserId = userId;
      console.log(`Using provided IDs:`);
      console.log(`  Plant ID: ${testPlantId}`);
      console.log(`  User ID: ${testUserId}\n`);
    } else {
      // Find first available plant
      console.log('No IDs provided, finding first available plant...\n');

      const firstPlant = await Plant.findOne();

      if (!firstPlant) {
        console.error('❌ No plants found in database. Create a plant first.');
        process.exit(1);
      }

      testPlantId = firstPlant.id;
      testUserId = firstPlant.user_id;

      console.log(`Found plant:`);
      console.log(`  Plant ID: ${testPlantId}`);
      console.log(`  Plant Name: ${firstPlant.name}`);
      console.log(`  User ID: ${testUserId}\n`);
    }

    // Verify user exists
    const user = await User.findByPk(testUserId);
    if (!user) {
      console.error(`❌ User not found: ${testUserId}`);
      process.exit(1);
    }

    // Run analysis
    console.log('Running plant care analysis...\n');
    console.log('='.repeat(80));

    const analysisService = new PlantCareService();
    const result = await analysisService.analyze(testPlantId, testUserId);

    console.log('='.repeat(80));
    console.log('\n✅ Analysis completed!\n');

    // Display results summary
    console.log('📊 ANALYSIS RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log(`Plant: ${result.context.plant.name}`);
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
    console.log('   backend/src/services/ai/plant/PlantCareService.ts\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during analysis:', error);
    process.exit(1);
  }
}

// Run the test
testPlantCareAnalysis();
