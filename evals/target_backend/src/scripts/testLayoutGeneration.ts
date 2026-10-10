/**
 * Test Script for Layout Generation Service
 *
 * This script demonstrates the layout generation service and shows the prompts
 * that would be sent to the AI. Run this to review the prompt engineering
 * before enabling AI API calls.
 *
 * Usage:
 * npx ts-node src/scripts/testLayoutGeneration.ts [garden-id] [user-id] [plant-ids]
 *
 * Example:
 * npx ts-node src/scripts/testLayoutGeneration.ts
 * npx ts-node src/scripts/testLayoutGeneration.ts <garden-id> <user-id> <plant-id-1>,<plant-id-2>,<plant-id-3>
 *
 * If no IDs provided, it will use the first garden and 3 random plants.
 */

import { LayoutGenerationService } from '../services/ai/layout';
import { Garden } from '../models/Garden';
import { User } from '../models/User';
import { PlantProfile } from '../models/PlantProfile';
import { initializeModels } from '../models';
import { getSequelize } from '../config/sequelize';

async function testLayoutGeneration() {
  try {
    // Initialize database models
    await initializeModels();

    console.log('🌱 Layout Generation Service Test\n');

    // Get command line arguments
    const gardenId = process.argv[2];
    const userId = process.argv[3];
    const plantIds = process.argv[4]?.split(',');

    let testGardenId: string;
    let testUserId: string;
    let testPlantIds: string[];

    if (gardenId && userId && plantIds) {
      // Use provided IDs
      testGardenId = gardenId;
      testUserId = userId;
      testPlantIds = plantIds;
      console.log(`Using provided IDs:`);
      console.log(`  Garden ID: ${testGardenId}`);
      console.log(`  User ID: ${testUserId}`);
      console.log(`  Plant IDs: ${testPlantIds.join(', ')}\n`);
    } else {
      // Find first available garden and plants
      console.log('No IDs provided, finding first available garden and plants...\n');

      const firstGarden = await Garden.findOne();

      if (!firstGarden) {
        console.error('❌ No gardens found in database. Create a garden first.');
        process.exit(1);
      }

      testGardenId = firstGarden.id;
      testUserId = firstGarden.user_id;

      // Get 3-5 random plant profiles
      const plants = await PlantProfile.findAll({ limit: 5 });

      if (plants.length === 0) {
        console.error('❌ No plant profiles found in database.');
        process.exit(1);
      }

      testPlantIds = plants.map((p) => p.id);

      console.log(`Found garden:`);
      console.log(`  Garden ID: ${testGardenId}`);
      console.log(`  Garden Name: ${firstGarden.name}`);
      console.log(`  Dimensions: ${firstGarden.width}ft × ${firstGarden.height}ft`);
      console.log(`  User ID: ${testUserId}`);
      console.log(`\nSelected ${plants.length} plants:`);
      plants.forEach((plant, i) => {
        console.log(`  ${i + 1}. ${plant.name} (${plant.type})`);
      });
      console.log('');
    }

    // Verify user exists
    const user = await User.findByPk(testUserId);
    if (!user) {
      console.error(`❌ User not found: ${testUserId}`);
      process.exit(1);
    }

    // Prepare test payload
    const payload = {
      gardenId: testGardenId,
      userId: testUserId,
      plantProfileIds: testPlantIds,
      sunZones: [],
      preferences: {
        optimizationGoal: 'max_yield' as const,
        spacingMethod: 'intensive' as const,
      },
    };

    // Run layout generation
    console.log('Generating layouts...\n');
    console.log('='.repeat(80));

    const layoutService = new LayoutGenerationService();
    const result = await layoutService.execute(payload);

    console.log('='.repeat(80));
    console.log('\n✅ Layout generation completed!\n');

    // Display results summary
    console.log('📊 LAYOUT GENERATION RESULTS');
    console.log('='.repeat(80));
    console.log(`Garden: ${result.context.garden.name}`);
    console.log(`Dimensions: ${result.context.garden.dimensions.width}ft × ${result.context.garden.dimensions.height}ft`);
    console.log(`Plants Requested: ${result.context.selectedPlants.length}`);
    console.log(`Layouts Generated: ${result.layouts.length}`);
    console.log(`Overall Score: ${result.overallScore}/100`);
    console.log(`Generated At: ${result.analyzedAt.toISOString()}`);
    console.log(`\nSummary: ${result.summary}`);

    // Display each layout
    result.layouts.forEach((layout, index) => {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`LAYOUT ${index + 1}: ${layout.optimizationGoal.replace('_', ' ').toUpperCase()}`);
      console.log('='.repeat(80));
      console.log(`Overall Score: ${layout.score}/100`);
      console.log(`Companion Score: ${layout.companionScore}/100`);
      console.log(`Spacing Score: ${layout.spacingScore}/100`);
      console.log(`Accessibility Score: ${layout.accessibilityScore}/100`);
      console.log(`Placements: ${layout.placements.length}`);

      if (layout.warnings.length > 0) {
        console.log(`\n⚠️  Warnings:`);
        layout.warnings.forEach((warning, i) => {
          console.log(`   ${i + 1}. ${warning}`);
        });
      }

      console.log(`\nPlant Placements:`);
      layout.placements.forEach((placement, i) => {
        console.log(`\n  ${i + 1}. ${placement.plantName} (×${placement.quantity})`);
        console.log(`     Position: (${placement.x}, ${placement.y})`);
        console.log(`     Size: ${placement.width}ft × ${placement.height}ft`);
        console.log(`     Reasoning: ${placement.reasoning}`);
      });
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 TIP: Review the prompts above to see what context is sent to the AI.');
    console.log('   To enable actual AI calls, set ENABLE_AI=true in .env\n');

    const sequelize = await getSequelize();
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during layout generation:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    const sequelize = await getSequelize();
    await sequelize.close();
    process.exit(1);
  }
}

// Run the test
testLayoutGeneration();
