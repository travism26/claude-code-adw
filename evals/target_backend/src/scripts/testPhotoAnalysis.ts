/**
 * Photo Analysis Test Script
 *
 * Manual testing script for GrowPhotoAnalysisService
 * Tests prompt generation and mock responses without making real AI calls
 *
 * Usage:
 *   # Test with a specific photo
 *   npx ts-node src/scripts/testPhotoAnalysis.ts <photoId> <userId>
 *
 *   # Test with first photo in database (auto-selects user)
 *   npx ts-node src/scripts/testPhotoAnalysis.ts
 *
 * Environment Variables:
 *   ENABLE_AI=false  - Use mock responses (default, recommended for testing)
 *   ENABLE_AI=true   - Call real vision API (requires ANTHROPIC_API_KEY)
 */

import { GrowPhotoAnalysisService } from '../services/ai/photo';
import { GrowLogPhoto } from '../models/GrowLogPhoto';
import { GrowLog } from '../models/GrowLog';
import { Grow } from '../models/Grow';
import { User } from '../models/User';

async function testPhotoAnalysis() {
  try {
    console.log('===================================');
    console.log('Photo Analysis Service Test');
    console.log('===================================\n');

    // Get command line arguments
    const args = process.argv.slice(2);
    let photoId: string | undefined = args[0];
    let userId: string | undefined = args[1];

    // If no arguments, find first photo in database
    if (!photoId) {
      console.log('No photoId provided, searching for first photo in database...\n');

      const photo = await GrowLogPhoto.findOne({
        include: [
          {
            model: GrowLog,
            as: 'growLog',
            required: true,
            include: [
              {
                model: Grow,
                as: 'grow',
                required: true,
                include: [
                  {
                    model: User,
                    as: 'user',
                    required: true,
                  },
                ],
              },
            ],
          },
        ],
        order: [['created_at', 'DESC']],
      });

      if (!photo) {
        console.error('❌ No photos found in database.');
        console.error('Please upload a photo first or provide photoId and userId as arguments.');
        process.exit(1);
      }

      photoId = photo.id;
      userId = (photo as any).growLog?.grow?.user?.id;

      console.log(`✅ Found photo: ${photoId}`);
      console.log(`   User: ${userId}`);
      console.log(`   File: ${photo.file_path}`);
      console.log(`   Caption: ${photo.caption || '(none)'}\n`);
    }

    if (!userId) {
      console.error('❌ Error: userId is required when photoId is provided');
      console.error('Usage: npx ts-node src/scripts/testPhotoAnalysis.ts <photoId> <userId>');
      process.exit(1);
    }

    // Initialize service
    const service = new GrowPhotoAnalysisService();

    console.log('Configuration:');
    console.log(`  ENABLE_AI: ${process.env.ENABLE_AI || 'false'}`);
    console.log(`  Mode: ${process.env.ENABLE_AI === 'true' ? 'Real AI Vision API' : 'Mock Responses'}`);
    console.log('');

    // Run analysis
    console.log('Starting photo analysis...\n');
    console.log('─'.repeat(80));

    const startTime = Date.now();
    const result = await service.analyzePhoto(photoId, userId);
    const duration = Date.now() - startTime;

    console.log('─'.repeat(80));
    console.log('');

    // Display results
    console.log('✅ Analysis Complete!\n');
    console.log('═'.repeat(80));
    console.log('ANALYSIS RESULTS');
    console.log('═'.repeat(80));
    console.log('');

    console.log(`📊 Overall Health: ${result.overallHealth.toUpperCase()}`);
    console.log(`🎯 Confidence: ${result.confidence}%`);
    console.log(`📝 Summary: ${result.summary}`);
    console.log('');

    if (result.issues && result.issues.length > 0) {
      console.log('🚨 Issues Detected:');
      console.log('─'.repeat(80));
      result.issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.type.toUpperCase()}`);
        console.log(`   Severity: ${issue.severity} | Confidence: ${issue.confidence}%`);
        console.log(`   Affected Area: ${issue.affectedArea}`);
        console.log(`   Description: ${issue.description}`);
        if (issue.remediation && issue.remediation.length > 0) {
          console.log(`   Remediation Steps:`);
          issue.remediation.forEach((step, i) => {
            console.log(`     ${i + 1}. ${step}`);
          });
        }
      });
      console.log('');
    } else {
      console.log('✅ No issues detected - plant appears healthy!\n');
    }

    if (result.generalObservations && result.generalObservations.length > 0) {
      console.log('💡 General Observations:');
      console.log('─'.repeat(80));
      result.generalObservations.forEach((obs, index) => {
        console.log(`  ${index + 1}. ${obs}`);
      });
      console.log('');
    }

    console.log('═'.repeat(80));
    console.log(`⏱️  Analysis Duration: ${duration}ms`);
    console.log('═'.repeat(80));
    console.log('');

    // Show note about mock vs real
    if (process.env.ENABLE_AI !== 'true') {
      console.log('ℹ️  Note: This was a MOCK response for testing.');
      console.log('   Set ENABLE_AI=true to test with real vision API.');
      console.log('   Example: ENABLE_AI=true npx ts-node src/scripts/testPhotoAnalysis.ts');
    } else {
      console.log('ℹ️  Note: This used REAL AI vision API calls.');
      console.log('   Vision API calls consume more tokens than text-only calls.');
    }

    console.log('');
    console.log('Test completed successfully! ✅');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('═'.repeat(80));
    console.error('❌ ERROR');
    console.error('═'.repeat(80));
    console.error('');

    if (error instanceof Error) {
      console.error(`Message: ${error.message}`);
      console.error('');
      if (error.stack) {
        console.error('Stack Trace:');
        console.error(error.stack);
      }
    } else {
      console.error(String(error));
    }

    console.error('');
    console.error('═'.repeat(80));
    process.exit(1);
  }
}

// Run the test
testPhotoAnalysis();
