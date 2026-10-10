#!/usr/bin/env node

/**
 * Analyzes validation violations and creates a summary report
 */

const { execSync } = require('child_process');
const fs = require('fs');

try {
  // Run validation and save to temp file
  const tempFile = '/tmp/frontend-violations.json';
  execSync(`node scripts/validate-architecture.js > ${tempFile} 2>&1 || true`);

  const output = fs.readFileSync(tempFile, 'utf8');
  const violations = JSON.parse(output);

  // Group by rule
  const byRule = {};
  const byFile = {};

  for (const violation of violations) {
    // By rule
    if (!byRule[violation.rule]) {
      byRule[violation.rule] = {
        count: 0,
        files: new Set(),
      };
    }
    byRule[violation.rule].count++;
    byRule[violation.rule].files.add(violation.file);

    // By file
    if (!byFile[violation.file]) {
      byFile[violation.file] = {
        count: 0,
        rules: new Set(),
      };
    }
    byFile[violation.file].count++;
    byFile[violation.file].rules.add(violation.rule);
  }

  // Print summary
  console.log('='.repeat(80));
  console.log('FRONTEND VALIDATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nTotal violations: ${violations.length}`);
  console.log(`Affected files: ${Object.keys(byFile).length}`);
  console.log(`\n${'VIOLATIONS BY RULE'.padEnd(60)} ${'COUNT'.padStart(5)} ${'FILES'.padStart(6)}`);
  console.log('-'.repeat(80));

  // Sort by count descending
  const sortedRules = Object.entries(byRule).sort((a, b) => b[1].count - a[1].count);

  for (const [rule, data] of sortedRules) {
    const ruleName = rule.replace('custom-rules/', '');
    console.log(`${ruleName.padEnd(60)} ${String(data.count).padStart(5)} ${String(data.files.size).padStart(6)}`);
  }

  // Top 10 files with most violations
  console.log(`\n${'TOP 10 FILES WITH MOST VIOLATIONS'.padEnd(60)} ${'COUNT'.padStart(5)}`);
  console.log('-'.repeat(80));

  const sortedFiles = Object.entries(byFile)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  for (const [file, data] of sortedFiles) {
    const fileName = file.split('/').pop();
    console.log(`${fileName.padEnd(60)} ${String(data.count).padStart(5)}`);
  }

  console.log('\n' + '='.repeat(80));

} catch (error) {
  // Validation script exits with code 1 when violations found
  if (error.stdout) {
    try {
      const violations = JSON.parse(error.stdout);

      // Group by rule
      const byRule = {};
      const byFile = {};

      for (const violation of violations) {
        // By rule
        if (!byRule[violation.rule]) {
          byRule[violation.rule] = {
            count: 0,
            files: new Set(),
          };
        }
        byRule[violation.rule].count++;
        byRule[violation.rule].files.add(violation.file);

        // By file
        if (!byFile[violation.file]) {
          byFile[violation.file] = {
            count: 0,
            rules: new Set(),
          };
        }
        byFile[violation.file].count++;
        byFile[violation.file].rules.add(violation.rule);
      }

      // Print summary
      console.log('='.repeat(80));
      console.log('FRONTEND VALIDATION SUMMARY');
      console.log('='.repeat(80));
      console.log(`\nTotal violations: ${violations.length}`);
      console.log(`Affected files: ${Object.keys(byFile).length}`);
      console.log(`\n${'VIOLATIONS BY RULE'.padEnd(60)} ${'COUNT'.padStart(5)} ${'FILES'.padStart(6)}`);
      console.log('-'.repeat(80));

      // Sort by count descending
      const sortedRules = Object.entries(byRule).sort((a, b) => b[1].count - a[1].count);

      for (const [rule, data] of sortedRules) {
        const ruleName = rule.replace('custom-rules/', '');
        console.log(`${ruleName.padEnd(60)} ${String(data.count).padStart(5)} ${String(data.files.size).padStart(6)}`);
      }

      // Top 10 files with most violations
      console.log(`\n${'TOP 10 FILES WITH MOST VIOLATIONS'.padEnd(60)} ${'COUNT'.padStart(5)}`);
      console.log('-'.repeat(80));

      const sortedFiles = Object.entries(byFile)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);

      for (const [file, data] of sortedFiles) {
        const fileName = file.split('/').pop();
        console.log(`${fileName.padEnd(60)} ${String(data.count).padStart(5)}`);
      }

      console.log('\n' + '='.repeat(80));

    } catch (parseError) {
      console.error('Failed to parse validation output:', parseError.message);
      process.exit(1);
    }
  } else {
    console.error('Validation failed:', error.message);
    process.exit(1);
  }
}
