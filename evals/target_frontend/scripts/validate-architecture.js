#!/usr/bin/env node

/**
 * Frontend Architectural Validation Script
 *
 * ESLint 9 compatible version using flat config and ESLint class
 */

const { ESLint } = require('eslint');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Rules temporarily disabled (can be re-enabled by removing from this array)
// TODO: Re-enable no-complex-jsx after refactoring form components to reduce nesting
const disabledRules = [
  'no-complex-jsx',
];

// Load custom rules
const customRules = {};
const ruleFiles = fs.existsSync(path.join(__dirname, '../eslint-rules'))
  ? fs.readdirSync(path.join(__dirname, '../eslint-rules'))
      .filter(f => f.endsWith('.js') && !f.startsWith('ESLINT'))
      .filter(f => !disabledRules.includes(f.replace('.js', '')))
  : [];

for (const ruleFile of ruleFiles) {
  const ruleName = ruleFile.replace('.js', '');
  const rulePath = path.join(__dirname, '../eslint-rules', ruleFile);
  try {
    customRules[ruleName] = require(rulePath);
  } catch (error) {
    console.error(`Warning: Failed to load rule ${ruleName}: ${error.message}`);
  }
}

async function validateArchitecture() {
  try {
    const includeWarnings = process.argv.includes('--include-warnings');

    // Get all TypeScript and TSX files
    const files = glob.sync('{components,api,hooks,routes,types,utils,app}/**/*.{ts,tsx}', {
      cwd: path.join(__dirname, '..'),
      ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/test-results/**', '**/playwright-report/**'],
      absolute: true,
    });

    if (Object.keys(customRules).length === 0) {
      console.log(JSON.stringify([{
        rule: 'info',
        file: 'N/A',
        line: null,
        column: null,
        severity: 'info',
        message: `No custom rules defined yet. Validation setup is ready for future rules. Scanned ${files.length} files.`,
        fix_suggestion: null,
      }], null, 2));
      process.exit(0);
    }

    // Create flat config
    const flatConfig = [
      {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
          parser: require('@typescript-eslint/parser'),
          parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            ecmaFeatures: {
              jsx: true,
            },
          },
        },
        plugins: {
          'custom-rules': {
            rules: customRules,
          },
        },
        rules: Object.keys(customRules).reduce((acc, ruleName) => {
          acc[`custom-rules/${ruleName}`] = 'error';
          return acc;
        }, {}),
      },
    ];

    // Create ESLint instance
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: flatConfig,
      cwd: path.join(__dirname, '..'),
    });

    // Lint all files
    const results = await eslint.lintFiles(files.map(f => path.relative(path.join(__dirname, '..'), f)));

    const violations = [];

    for (const result of results) {
      const relativePath = path.relative(process.cwd(), result.filePath);

      // Skip test files
      const isTestFile = relativePath.includes('/e2e/') ||
                         relativePath.includes('.spec.') ||
                         relativePath.includes('.test.');

      if (isTestFile) continue;

      for (const message of result.messages) {
        if (message.severity === 1 && !includeWarnings) continue;
        if (!message.ruleId || !message.ruleId.startsWith('custom-rules/')) continue;

        violations.push({
          rule: message.ruleId,
          file: relativePath,
          line: message.line,
          column: message.column,
          severity: message.severity === 2 ? 'error' : 'warning',
          message: message.message,
          fix_suggestion: getFixSuggestion(message),
        });
      }
    }

    console.log(JSON.stringify(violations, null, 2));
    process.exit(violations.some(v => v.severity === 'error') ? 1 : 0);

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

function getFixSuggestion(message) {
  if (!message.ruleId) return null;

  const suggestions = {
    'custom-rules/no-direct-fetch-in-components': 'Move API calls to the api/ directory and use React Query hooks from hooks/ directory.',
    'custom-rules/no-large-component-files': 'Extract functionality into smaller components or move business logic to custom hooks.',
    'custom-rules/no-console-in-components': 'Remove console statements before production. Use error boundaries for error handling.',
    'custom-rules/require-loading-error-states': 'Add loading and error state checks: if (isLoading) return <Loading />; if (error) return <Error />;',
    'custom-rules/no-complex-jsx': 'Extract nested JSX into separate components to improve readability and reusability.',
    'custom-rules/prefer-custom-hooks': 'Extract complex state logic into a custom hook in the hooks/ directory.',
  };

  return suggestions[message.ruleId] || (message.fix ? 'ESLint has an automatic fix available.' : null);
}

validateArchitecture();
