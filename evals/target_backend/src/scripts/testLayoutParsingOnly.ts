/**
 * Test Script for Layout Generation Response Parsing (No DB Required)
 *
 * This script tests ONLY the AI response parsing logic without requiring
 * a database connection. Perfect for testing parsing fixes quickly.
 *
 * Usage:
 * npx ts-node src/scripts/testLayoutParsingOnly.ts <path-to-response.json>
 *
 * Example:
 * npx ts-node src/scripts/testLayoutParsingOnly.ts src/mocks/layout-response-with-markdown.txt
 */

import * as fs from 'fs';
import * as path from 'path';

// Mock the BaseAIService parsing method directly
class ResponseParser {
  /**
   * This is copied from BaseAIService.parseAIResponseContent
   * We test it in isolation without any database dependencies
   */
  parseAIResponseContent(content: string): any {
    console.log('📥 Parsing AI response content...\n');
    console.log(`Response length: ${content.length} characters`);
    console.log(`First 200 chars: ${content.substring(0, 200)}...\n`);

    const trimmedContent = content.trim();

    // Strategy 1: Try direct JSON parse
    try {
      const parsed = JSON.parse(trimmedContent);
      console.log('✅ Strategy 1: Direct JSON parse succeeded\n');
      return this.validateAndNormalizeParsedResponse(parsed, 'direct_json');
    } catch (directParseError) {
      console.log('❌ Strategy 1: Direct JSON parse failed');
      console.log(`   Error: ${(directParseError as Error).message}\n`);
    }

    // Strategy 2: Extract from markdown code blocks
    const markdownJsonMatch = trimmedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownJsonMatch) {
      console.log('✅ Strategy 2: Found markdown code block\n');
      try {
        const parsed = JSON.parse(markdownJsonMatch[1].trim());
        console.log('✅ Strategy 2: Markdown block parse succeeded\n');
        return this.validateAndNormalizeParsedResponse(parsed, 'markdown_block');
      } catch (markdownParseError) {
        console.log('❌ Strategy 2: Markdown block parse failed');
        console.log(`   Error: ${(markdownParseError as Error).message}\n`);
      }
    } else {
      console.log('❌ Strategy 2: No markdown code block found\n');
    }

    // Strategy 3: Extract JSON object
    const jsonStartIndex = trimmedContent.indexOf('{');
    if (jsonStartIndex !== -1) {
      console.log('🔍 Strategy 3: Attempting JSON extraction...\n');
      let braceCount = 0;
      let jsonEndIndex = -1;
      for (let i = jsonStartIndex; i < trimmedContent.length; i++) {
        if (trimmedContent[i] === '{') braceCount++;
        if (trimmedContent[i] === '}') braceCount--;
        if (braceCount === 0) {
          jsonEndIndex = i;
          break;
        }
      }

      if (jsonEndIndex !== -1) {
        const jsonCandidate = trimmedContent.substring(jsonStartIndex, jsonEndIndex + 1);
        try {
          const parsed = JSON.parse(jsonCandidate);
          console.log('✅ Strategy 3: JSON extraction succeeded\n');
          return this.validateAndNormalizeParsedResponse(parsed, 'json_extraction');
        } catch (extractedParseError) {
          console.log('❌ Strategy 3: JSON extraction failed');
          console.log(`   Error: ${(extractedParseError as Error).message}\n`);
        }
      }
    }

    console.log('❌ All parsing strategies failed!\n');
    return {
      suggestions: [],
      overallScore: 0,
      summary: 'Failed to parse AI response',
      parseError: true,
    };
  }

  /**
   * This is copied from BaseAIService.validateAndNormalizeParsedResponse
   * Testing the fixed version that preserves layouts
   */
  private validateAndNormalizeParsedResponse(parsed: any, strategy: string): any {
    console.log(`🔍 Validating parsed response (strategy: ${strategy})...\n`);

    if (!parsed || typeof parsed !== 'object') {
      console.log('❌ Validation failed: Not an object\n');
      return {
        suggestions: [],
        overallScore: 0,
        summary: 'Invalid response structure',
        rawContent: JSON.stringify(parsed),
      };
    }

    console.log('📋 Original response keys:', Object.keys(parsed).join(', '));

    // THE FIX: Preserve all original fields with spread operator
    const normalized = {
      ...parsed, // Preserve all original fields (including layouts!)
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : 0,
      summary: typeof parsed.summary === 'string' ? parsed.summary : "No summary provided",
    };

    console.log('📋 Normalized response keys:', Object.keys(normalized).join(', '));
    console.log('\n✅ Validation passed!\n');

    console.log('📊 Normalized structure:');
    console.log(`   - suggestions: ${normalized.suggestions.length} items`);
    console.log(`   - overallScore: ${normalized.overallScore}`);
    console.log(`   - summary: "${normalized.summary}"`);
    console.log(`   - hasLayouts: ${Array.isArray(normalized.layouts)}`);
    if (Array.isArray(normalized.layouts)) {
      console.log(`   - layouts: ${normalized.layouts.length} items`);
    }
    console.log('');

    return normalized;
  }
}

async function testParsing() {
  try {
    const responsePath = process.argv[2];

    if (!responsePath) {
      console.log(`
Usage: npx ts-node src/scripts/testLayoutParsingOnly.ts <path-to-response>

This script tests the layout response parsing logic without requiring a database.

Examples:
  npx ts-node src/scripts/testLayoutParsingOnly.ts src/mocks/layout-response.json
  npx ts-node src/scripts/testLayoutParsingOnly.ts src/mocks/layout-response-with-markdown.txt

The script will:
1. Load the saved response
2. Parse it using the same logic as BaseAIService
3. Validate and normalize it
4. Show you exactly what LayoutGenerationService will receive
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

    console.log('='.repeat(80));
    console.log('🧪 LAYOUT RESPONSE PARSING TEST (No Database Required)');
    console.log('='.repeat(80));
    console.log(`\n📂 Input file: ${absolutePath}\n`);

    // Parse the response
    const parser = new ResponseParser();
    const result = parser.parseAIResponseContent(savedResponse);

    console.log('='.repeat(80));
    console.log('📊 FINAL RESULT');
    console.log('='.repeat(80));
    console.log('');

    if (result.parseError) {
      console.log('❌ PARSING FAILED');
      console.log(`   Summary: ${result.summary}`);
      console.log('');
      process.exit(1);
    }

    console.log('✅ PARSING SUCCEEDED\n');

    // Check for layouts array (what LayoutGenerationService needs)
    if (Array.isArray(result.layouts) && result.layouts.length > 0) {
      console.log(`✅ Found layouts array with ${result.layouts.length} layouts\n`);

      result.layouts.forEach((layout: any, index: number) => {
        console.log(`Layout ${index + 1}:`);
        console.log(`  - ID: ${layout.id}`);
        console.log(`  - Optimization Goal: ${layout.optimizationGoal}`);
        console.log(`  - Placements: ${layout.placements?.length || 0}`);
        console.log(`  - Score: ${layout.score}/100`);
        console.log(`  - Warnings: ${layout.warnings?.length || 0}`);
        console.log('');
      });

      console.log('✅ SUCCESS: LayoutGenerationService will be able to parse this response!\n');
    } else {
      console.log('❌ ERROR: No layouts array found!');
      console.log('   LayoutGenerationService.parseLayoutsFromAI() will fail.\n');
      console.log('   Available keys:', Object.keys(result).join(', '));
      console.log('');
      process.exit(1);
    }

    console.log('='.repeat(80));
    console.log('');

    // Show what would be passed to parseLayoutsFromAI
    console.log('📤 What LayoutGenerationService.parseLayoutsFromAI() will receive:');
    console.log('');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during parsing test:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testParsing();
