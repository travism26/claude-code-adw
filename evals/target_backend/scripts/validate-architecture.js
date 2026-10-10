#!/usr/bin/env node

/**
 * Architectural Validation Script
 *
 * Runs ESLint with custom architectural rules and outputs violations as JSON.
 */

const { Linter } = require('eslint');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Load custom rules
const noModelInRoutes = require('../eslint-rules/no-model-in-routes');
const noExpressInServices = require('../eslint-rules/no-express-in-services');
const requireWorkerErrorListener = require('../eslint-rules/require-worker-error-listener');

// Load TypeScript parser
const typescriptParser = require('@typescript-eslint/parser');

async function validateArchitecture() {
  try {
    // Check for --include-warnings flag
    const includeWarnings = process.argv.includes('--include-warnings');

    // Create Linter instance
    const linter = new Linter();

    // Define custom rules
    linter.defineRule('custom-rules/no-model-in-routes', noModelInRoutes);
    linter.defineRule('custom-rules/no-express-in-services', noExpressInServices);
    linter.defineRule('custom-rules/require-worker-error-listener', requireWorkerErrorListener);

    // Define TypeScript parser
    linter.defineParser('@typescript-eslint/parser', typescriptParser);

    // Minimal config focusing on custom rules only
    const config = {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      env: {
        node: true,
        es6: true,
      },
      rules: {
        'custom-rules/no-model-in-routes': 'error',
        'custom-rules/no-express-in-services': 'error',
        'custom-rules/require-worker-error-listener': 'error',
      },
    };

    // Get all TypeScript files in src directory
    const files = glob.sync('src/**/*.ts', {
      cwd: path.join(__dirname, '..'),
      ignore: ['**/node_modules/**', '**/dist/**'],
      absolute: true,
    });

    const violations = [];

    // Lint each file
    for (const filePath of files) {
      const relativePath = path.relative(process.cwd(), filePath);

      // Skip test and migration files for custom architectural rules
      const isTestFile = relativePath.includes('/tests/') || relativePath.includes('/migrations/');

      const fileContent = fs.readFileSync(filePath, 'utf8');

      try {
        // Adjust config for test files
        const fileConfig = isTestFile
          ? { ...config, rules: {} }  // Disable custom rules for tests
          : config;

        const messages = linter.verify(fileContent, fileConfig, {
          filename: relativePath,
        });

        for (const message of messages) {
          // Skip warnings unless explicitly requested
          if (message.severity === 1 && !includeWarnings) continue;

          violations.push({
            rule: message.ruleId || 'unknown',
            file: relativePath,
            line: message.line,
            column: message.column,
            severity: message.severity === 2 ? 'error' : 'warning',
            message: message.message,
            fix_suggestion: getFixSuggestion(message),
          });
        }
      } catch (lintError) {
        // If linting a specific file fails, report it but continue
        violations.push({
          rule: 'validation-error',
          file: relativePath,
          line: null,
          column: null,
          severity: 'error',
          message: `Failed to lint file: ${lintError.message}`,
          fix_suggestion: null,
        });
      }
    }

    // Output as JSON array
    console.log(JSON.stringify(violations, null, 2));

    // Exit with error code if there are any errors (severity 2)
    const hasErrors = violations.some(v => v.severity === 'error');
    process.exit(hasErrors ? 1 : 0);

  } catch (error) {
    console.error(JSON.stringify([{
      rule: 'validation-error',
      file: 'unknown',
      line: null,
      column: null,
      severity: 'error',
      message: `Validation script failed: ${error.message}`,
      fix_suggestion: null,
    }], null, 2));
    process.exit(1);
  }
}

/**
 * Generate a fix suggestion based on the ESLint message
 */
function getFixSuggestion(message) {
  if (!message.ruleId) {
    return null;
  }

  // Custom suggestions based on rule
  if (message.ruleId === 'custom-rules/no-model-in-routes') {
    return 'Replace model import with service import. Routes should only import from services to maintain architectural boundaries.';
  }

  if (message.ruleId === 'custom-rules/no-express-in-services') {
    return 'Remove Express type imports from services. Extract HTTP-specific logic to routes or middleware. Services should accept plain data types to remain framework-agnostic.';
  }

  if (message.ruleId === 'custom-rules/require-worker-error-listener') {
    return 'Add an error event listener to the worker: worker.on(\'error\', (error) => { logger.error(\'Worker error\', { error: error.message, stack: error.stack }); }). This prevents silent crashes and unhandled exceptions.';
  }

  // For other rules, use the message if available
  if (message.fix) {
    return 'ESLint has an automatic fix available.';
  }

  return null;
}

// Run validation
validateArchitecture();
