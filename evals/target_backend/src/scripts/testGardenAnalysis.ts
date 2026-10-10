/**
 * Test Script for Garden Analysis Service
 *
 * This script demonstrates the garden analysis service and shows the prompts
 * that would be sent to the AI. Run this to review the prompt engineering
 * before enabling AI API calls.
 *
 * Usage:
 * npx ts-node src/scripts/testGardenAnalysis.ts [garden-id] [user-id]
 *
 * Example:
 * npx ts-node src/scripts/testGardenAnalysis.ts
 *
 * If no IDs provided, it will use the first garden found in the database.
 */

import { GardenAnalysisService } from '../services/ai/garden';
import { Garden } from '../models/Garden';
import { User } from '../models/User';

async function testGardenAnalysis() {
  try {
    console.log('🌱 Garden Analysis Service Test\n');

    // Get command line arguments
    const gardenId = process.argv[2];
    const userId = process.argv[3];

    let testGardenId: string;
    let testUserId: string;

    if (gardenId && userId) {
      // Use provided IDs
      testGardenId = gardenId;
      testUserId = userId;
      console.log(`Using provided IDs:`);
      console.log(`  Garden ID: ${testGardenId}`);
      console.log(`  User ID: ${testUserId}\n`);
    } else {
      // Find first available garden
      console.log('No IDs provided, finding first available garden...\n');

      const firstGarden = await Garden.findOne({
        include: ['plots'],
      });

      if (!firstGarden) {
        console.error('❌ No gardens found in database. Create a garden first.');
        process.exit(1);
      }

      testGardenId = firstGarden.id;
      testUserId = firstGarden.user_id;

      console.log(`Found garden:`);
      console.log(`  Garden ID: ${testGardenId}`);
      console.log(`  Garden Name: ${firstGarden.name}`);
      console.log(`  User ID: ${testUserId}\n`);
    }

    // Verify user exists
    const user = await User.findByPk(testUserId);
    if (!user) {
      console.error(`❌ User not found: ${testUserId}`);
      process.exit(1);
    }

    // Run analysis
    console.log('Running garden analysis...\n');
    console.log('='.repeat(80));

    const analysisService = new GardenAnalysisService();
    const result = await analysisService.analyzeGarden(testGardenId, testUserId);

    console.log('='.repeat(80));
    console.log('\n✅ Analysis completed!\n');

    // Display results summary
    console.log('📊 ANALYSIS RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log(`Garden: ${result.context.garden.name}`);
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
    console.log('   backend/src/services/ai/garden/GardenAnalysisService.ts\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during analysis:', error);
    process.exit(1);
  }
}

// Run the test
testGardenAnalysis();
