/**
 * Test Script for Layout Generation with Saved AI Response
 *
 * This script allows you to test the layout generation parsing logic
 * using a saved AI response, avoiding the cost of AI tokens.
 *
 * Usage:
 * 1. Save a raw AI response to a JSON file (e.g., saved-layout-response.json)
 * 2. Run: npx ts-node src/scripts/testLayoutWithSavedResponse.ts <path-to-response.json>
 *
 * The saved response should be the raw content returned by the AI (with or without markdown blocks).
 *
 * Example:
 * npx ts-node src/scripts/testLayoutWithSavedResponse.ts src/mocks/layout-response.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { LayoutGenerationService } from '../services/ai/layout';
import { Garden } from '../models/Garden';
import { PlantProfile } from '../models/PlantProfile';
import { initializeModels } from '../models';
import { getSequelize } from '../config/sequelize';

// Override the callAI method to return saved response
class TestableLayoutGenerationService extends LayoutGenerationService {
  private savedResponse: string;

  constructor(savedResponse: string) {
    super();
    this.savedResponse = savedResponse;
    // Force enable AI calls so it goes through the parsing logic
    (this as any).config.enableAICalls = true;
  }

  // Override callAI to return our saved response instead of calling the AI
  protected async callAI(
    _systemPrompt: string,
    _userPrompt: string,
    _userId?: string
  ): Promise<any> {
    console.log('\n📥 Using saved AI response instead of calling API...\n');

    // Use the parent's parseAIResponseContent to test the actual parsing logic
    return (this as any).parseAIResponseContent(this.savedResponse);
  }
}

async function testWithSavedResponse() {
  try {
    // Get command line arguments
    const responsePath = process.argv[2];

    if (!responsePath) {
      console.log(`
Usage: npx ts-node src/scripts/testLayoutWithSavedResponse.ts <path-to-response.json>

This script tests the layout generation parsing logic using a saved AI response.

Example:
  npx ts-node src/scripts/testLayoutWithSavedResponse.ts src/mocks/layout-response.json

The saved response file should contain the raw AI response content (with or without markdown blocks).

To save a response from the logs:
1. Find the response in your logs (look for "responsePreview" in DEBUG logs)
2. Copy the full response content
3. Save it to a JSON file
`);
      process.exit(1);
    }

    // Read the saved response
    const absolutePath = path.isAbsolute(responsePath)
      ? responsePath
      : path.join(process.cwd(), responsePath);

    if (!fs.existsSync(absolutePath)) {
      console.error(`❌ File not found: ${absolutePath}`);
      process.exit(1);
    }

    const savedResponse = fs.readFileSync(absolutePath, 'utf-8');
    console.log(`\n📂 Loaded saved response from: ${absolutePath}`);
    console.log(`   Response length: ${savedResponse.length} characters\n`);

    // Initialize database models
    await initializeModels();

    console.log('🌱 Layout Generation Test with Saved Response\n');

    // Find first available garden and plants for context
    const firstGarden = await Garden.findOne();
    if (!firstGarden) {
      console.error('❌ No gardens found in database. Create a garden first.');
      process.exit(1);
    }

    const plants = await PlantProfile.findAll({ limit: 5 });
    if (plants.length === 0) {
      console.error('❌ No plant profiles found in database.');
      process.exit(1);
    }

    console.log(`Using garden: ${firstGarden.name} (${firstGarden.width}ft × ${firstGarden.height}ft)`);
    console.log(`Using ${plants.length} plants for context\n`);

    // Prepare test payload
    const payload = {
      gardenId: firstGarden.id,
      userId: firstGarden.user_id,
      plantProfileIds: plants.map((p) => p.id),
      sunZones: [],
      preferences: {
        optimizationGoal: 'max_yield' as const,
        spacingMethod: 'intensive' as const,
      },
    };

    // Run layout generation with saved response
    console.log('🔄 Processing saved response...\n');
    console.log('='.repeat(80));

    const layoutService = new TestableLayoutGenerationService(savedResponse);
    const result = await layoutService.execute(payload);

    console.log('='.repeat(80));
    console.log('\n✅ Layout parsing completed!\n');

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
    console.log('\n✅ Parsing test completed successfully!');
    console.log('   The saved response was parsed correctly.\n');

    const sequelize = await getSequelize();
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during layout parsing:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    try {
      const sequelize = await getSequelize();
      await sequelize.close();
    } catch (e) {
      // Ignore close errors
    }
    process.exit(1);
  }
}

// Run the test
testWithSavedResponse();
