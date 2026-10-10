/**
 * Manual Testing Script for Nutrient Recommendation Service
 *
 * This script allows manual testing of the nutrient recommendation service
 * without going through the API/worker layer. Useful for prompt review and
 * validation during development.
 *
 * Usage:
 * ```bash
 * # Test with mock AI (no API costs, shows prompts and mock response)
 * ENABLE_AI=false npx ts-node src/scripts/testNutrientRecommendation.ts [growId] [userId] [type]
 *
 * # Test with real AI (requires API key)
 * ENABLE_AI=true ANTHROPIC_API_KEY=your-key npx ts-node src/scripts/testNutrientRecommendation.ts [growId] [userId] [type]
 *
 * # If no args provided, uses first grow from database
 * ENABLE_AI=false npx ts-node src/scripts/testNutrientRecommendation.ts
 * ```
 *
 * Type options:
 * - full_schedule (default): Complete feeding schedule from current phase to harvest
 * - phase_adjustment: Adjust schedule for phase transition
 * - deficiency_fix: Remediation for nutrient deficiency
 * - optimization: Optimize for yield/quality goals
 */

import { GrowNutrientRecommendationService } from '../services/ai/grow/nutrient';
import { Grow } from '../models/Grow';
import { getSequelize } from '../config/sequelize';

// Get command line arguments
const growId = process.argv[2];
const userId = process.argv[3];
const recommendationType = (process.argv[4] as any) || 'full_schedule';
const goal = (process.argv[5] as 'yield' | 'quality' | 'balanced') || 'balanced';
const deficiency = process.argv[6]; // Optional, for deficiency_fix type

async function testNutrientRecommendation() {
  console.log('\n=== Nutrient Recommendation Service Test ===\n');
  console.log(`ENABLE_AI: ${process.env.ENABLE_AI || 'false'}`);
  console.log(`Recommendation Type: ${recommendationType}`);
  console.log(`Goal: ${goal}`);
  if (deficiency) {
    console.log(`Deficiency: ${deficiency}`);
  }
  console.log('\n');

  try {
    // Connect to database
    const sequelize = await getSequelize();
    await sequelize.authenticate();
    console.log('✓ Database connected\n');

    let targetGrowId = growId;
    let targetUserId = userId;

    // If no args provided, fetch first grow
    if (!targetGrowId || !targetUserId) {
      console.log('No growId/userId provided, fetching first grow from database...\n');

      const grow = await Grow.findOne({
        order: [['created_at', 'DESC']],
      });

      if (!grow) {
        console.error('❌ No grows found in database');
        process.exit(1);
      }

      targetGrowId = grow.id;
      targetUserId = grow.user_id;

      console.log(`Using grow: ${targetGrowId}`);
      console.log(`Using user: ${targetUserId}\n`);
    }

    // Instantiate service
    const service = new GrowNutrientRecommendationService();

    console.log('Generating nutrient recommendation...\n');

    // Generate recommendation
    const result = await service.generateRecommendation(
      targetGrowId,
      targetUserId,
      recommendationType,
      goal,
      deficiency
    );

    console.log('\n=== RECOMMENDATION RESULT ===\n');
    console.log('Summary:');
    console.log(result.summary);
    console.log('\n');

    console.log(`Schedule (${result.schedule.length} weeks):`);
    result.schedule.forEach((week, index) => {
      console.log(`\n${index + 1}. ${week.weekLabel} (${week.phase})`);
      console.log(`   pH: ${week.waterParameters.phMin}-${week.waterParameters.phMax}`);
      if (week.waterParameters.ecMin !== null) {
        console.log(`   EC: ${week.waterParameters.ecMin}-${week.waterParameters.ecMax} mS/cm`);
      }
      if (week.waterParameters.ppmMin !== null) {
        console.log(`   PPM: ${week.waterParameters.ppmMin}-${week.waterParameters.ppmMax}`);
      }

      console.log('   Nutrients:');
      if (week.nutrients.length === 0) {
        console.log('     - Plain water (flush)');
      } else {
        week.nutrients.forEach((nutrient) => {
          console.log(`     - ${nutrient.productName}${nutrient.brand ? ` (${nutrient.brand})` : ''}`);
          console.log(`       ${nutrient.dosageMlPerGallon} ml/gal | ${nutrient.frequency}`);
          if (nutrient.npkRatio) {
            console.log(`       NPK: ${nutrient.npkRatio}`);
          }
          if (nutrient.notes) {
            console.log(`       Note: ${nutrient.notes}`);
          }
        });
      }

      if (week.notes) {
        console.log(`   Note: ${week.notes}`);
      }
    });

    console.log('\n');
    console.log(`Additional Tips (${result.additionalTips.length}):`);
    result.additionalTips.forEach((tip, index) => {
      console.log(`  ${index + 1}. ${tip}`);
    });

    console.log('\n');
    console.log(`Warnings (${result.warnings.length}):`);
    result.warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ⚠️  ${warning}`);
    });

    console.log('\n');
    console.log('Metadata:');
    console.log(`  Recommendation Type: ${result.recommendationType}`);
    console.log(`  Optimization Goal: ${result.optimizationGoal || 'N/A'}`);
    console.log(`  Deficiency Type: ${result.deficiencyType || 'N/A'}`);
    console.log(`  Total Weeks: ${result.totalWeeks}`);
    console.log(`  Analyzed At: ${result.analyzedAt.toISOString()}`);

    console.log('\n✓ Recommendation generated successfully\n');

    // Display context summary
    console.log('=== CONTEXT SUMMARY ===\n');
    console.log(`Strain: ${result.context.grow.strainName} (${result.context.grow.strainType || 'unknown'})`);
    console.log(`Phase: ${result.context.grow.phase} (Day ${result.context.metrics.daysInPhase} in phase)`);
    console.log(`Grow Method: ${result.context.grow.growMethod || 'not specified'}`);
    console.log(`Nutrients Configured: ${result.context.nutrients.length}`);
    console.log(`Log Entries: ${result.context.logs.length}`);
    console.log(`Has Environment Data: ${result.context.environment.hasTrends}`);

    if (result.context.environment.hasTrends) {
      console.log('\nEnvironment Trends:');
      if (result.context.environment.ph.average !== null) {
        console.log(`  pH: ${result.context.environment.ph.average.toFixed(1)}`);
      }
      if (result.context.environment.ec.average !== null) {
        console.log(`  EC: ${result.context.environment.ec.average.toFixed(2)} mS/cm`);
      }
      if (result.context.environment.temperature.average !== null) {
        console.log(`  Temp: ${result.context.environment.temperature.average.toFixed(1)}°F`);
      }
      if (result.context.environment.humidity.average !== null) {
        console.log(`  Humidity: ${result.context.environment.humidity.average.toFixed(1)}%`);
      }
    }

    console.log('\n=== TEST COMPLETE ===\n');

  } catch (error) {
    console.error('\n❌ Error during test:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    const sequelize = await getSequelize();
    await sequelize.close();
  }
}

// Run test
testNutrientRecommendation()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
