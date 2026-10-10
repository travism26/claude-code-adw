/**
 * Test Script for Grow Analysis Service
 *
 * This script demonstrates the grow analysis service and shows the prompts
 * that would be sent to the AI. Run this to review the prompt engineering
 * before enabling AI API calls.
 *
 * Usage:
 * npx ts-node src/scripts/testGrowAnalysis.ts [grow-id] [user-id] [analysis-type]
 *
 * Example:
 * npx ts-node src/scripts/testGrowAnalysis.ts
 * npx ts-node src/scripts/testGrowAnalysis.ts abc-123 def-456 nutrients
 *
 * Analysis types:
 * - general (default): Overall health assessment
 * - nutrients: Feeding schedule recommendations
 * - diagnosis: Problem identification
 * - optimization: Yield improvement tips
 * - harvest_timing: Harvest window guidance
 *
 * If no IDs provided, it will use the first grow found in the database.
 */

import { GrowAnalysisService } from '../services/ai/grow';
import { Grow } from '../models/Grow';
import { User } from '../models/User';
import { AnalysisType } from '../services/ai/grow/types';

async function testGrowAnalysis() {
  try {
    console.log('🌿 Grow Analysis Service Test\n');

    // Get command line arguments
    const growId = process.argv[2];
    const userId = process.argv[3];
    const analysisType = (process.argv[4] as AnalysisType) || 'general';

    // Validate analysis type
    const validTypes: AnalysisType[] = ['general', 'nutrients', 'diagnosis', 'optimization', 'harvest_timing'];
    if (!validTypes.includes(analysisType)) {
      console.error(`❌ Invalid analysis type: ${analysisType}`);
      console.error(`   Valid types: ${validTypes.join(', ')}`);
      process.exit(1);
    }

    let testGrowId: string;
    let testUserId: string;

    if (growId && userId) {
      // Use provided IDs
      testGrowId = growId;
      testUserId = userId;
      console.log(`Using provided IDs:`);
      console.log(`  Grow ID: ${testGrowId}`);
      console.log(`  User ID: ${testUserId}`);
      console.log(`  Analysis Type: ${analysisType}\n`);
    } else {
      // Find first available grow
      console.log('No IDs provided, finding first available grow...\n');

      const firstGrow = await Grow.findOne({
        order: [['created_at', 'DESC']],
      });

      if (!firstGrow) {
        console.error('❌ No grows found in database. Create a grow first.');
        process.exit(1);
      }

      testGrowId = firstGrow.id;
      testUserId = firstGrow.user_id;

      console.log(`Found grow:`);
      console.log(`  Grow ID: ${testGrowId}`);
      console.log(`  Strain: ${firstGrow.strain_name}`);
      console.log(`  Phase: ${firstGrow.phase}`);
      console.log(`  User ID: ${testUserId}`);
      console.log(`  Analysis Type: ${analysisType}\n`);
    }

    // Verify user exists
    const user = await User.findByPk(testUserId);
    if (!user) {
      console.error(`❌ User not found: ${testUserId}`);
      process.exit(1);
    }

    // Run analysis
    console.log('Running grow analysis...\n');
    console.log('='.repeat(80));

    const analysisService = new GrowAnalysisService();
    const result = await analysisService.analyzeGrow(testGrowId, testUserId, analysisType);

    console.log('='.repeat(80));
    console.log('\n✅ Analysis completed!\n');

    // Display results summary
    console.log('📊 ANALYSIS RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log(`Strain: ${result.context.grow.strainName} (${result.context.grow.strainType || 'type not specified'})`);
    console.log(`Phase: ${result.context.grow.phase} (${result.context.metrics.daysInPhase} days)`);
    console.log(`Total Days: ${result.context.metrics.daysSinceStart}`);
    console.log(`Analysis Type: ${result.analysisType}`);
    console.log(`Overall Score: ${result.overallScore}/100`);
    console.log(`Analyzed At: ${result.analyzedAt.toISOString()}`);
    console.log(`\nSummary: ${result.summary}`);

    // Display context stats
    console.log(`\n📈 CONTEXT DATA:`);
    console.log(`  Log Entries: ${result.context.logs.length}`);
    console.log(`  Has Environment Data: ${result.context.environment.hasTrends ? 'Yes' : 'No'}`);
    console.log(`  Nutrients Configured: ${result.context.nutrients.length}`);
    console.log(`  Has Harvest Data: ${result.context.harvest ? 'Yes' : 'No'}`);
    console.log(`  Photos: ${result.context.metrics.photoCount}`);
    if (result.context.metrics.growthRate !== null) {
      console.log(`  Growth Rate: ${result.context.metrics.growthRate.toFixed(2)} inches/day`);
    }

    // Display environment trends
    if (result.context.environment.hasTrends) {
      console.log(`\n🌡️  ENVIRONMENT TRENDS:`);
      if (result.context.environment.temperature.average !== null) {
        console.log(`  Temperature: ${result.context.environment.temperature.average.toFixed(1)}°F (${result.context.environment.temperature.min?.toFixed(1)} - ${result.context.environment.temperature.max?.toFixed(1)})`);
      }
      if (result.context.environment.humidity.average !== null) {
        console.log(`  Humidity: ${result.context.environment.humidity.average.toFixed(1)}% (${result.context.environment.humidity.min?.toFixed(1)} - ${result.context.environment.humidity.max?.toFixed(1)})`);
      }
      if (result.context.environment.vpd.average !== null) {
        console.log(`  VPD: ${result.context.environment.vpd.average.toFixed(2)} kPa (${result.context.environment.vpd.min?.toFixed(2)} - ${result.context.environment.vpd.max?.toFixed(2)})`);
      }
      if (result.context.environment.ph.average !== null) {
        console.log(`  pH: ${result.context.environment.ph.average.toFixed(1)} (${result.context.environment.ph.min?.toFixed(1)} - ${result.context.environment.ph.max?.toFixed(1)})`);
      }
    }

    // Display suggestions
    console.log(`\n💡 SUGGESTIONS (${result.suggestions.length}):`);
    console.log('='.repeat(80));

    if (result.suggestions.length === 0) {
      console.log('No suggestions generated.');
    } else {
      result.suggestions.forEach((suggestion, index) => {
        const priorityEmoji =
          suggestion.priority === 'high' ? '🔴' : suggestion.priority === 'medium' ? '🟡' : '🟢';
        const typeEmoji =
          suggestion.type === 'warning' ? '⚠️ ' : suggestion.type === 'optimization' ? '🚀' : '✨';

        console.log(
          `\n${index + 1}. ${priorityEmoji} ${typeEmoji} [${suggestion.category}] ${suggestion.title}`
        );
        console.log(`   ${suggestion.description}`);
        console.log(`   Type: ${suggestion.type} | Priority: ${suggestion.priority} | Actionable: ${suggestion.actionable}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 TIP: Review the prompts above to see what context is sent to the AI.');
    console.log('   To enable actual AI calls, set ENABLE_AI=true in your .env file\n');
    console.log('📝 NOTE: This is using mock responses. Enable AI to get real analysis.');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during analysis:', error);
    process.exit(1);
  }
}

// Run the test
testGrowAnalysis();
