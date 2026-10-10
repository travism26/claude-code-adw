# ESLint 9 Upgrade Plan - Frontend Validation

## Executive Summary

**Goal:** Upgrade frontend from ESLint 8 to ESLint 9 to enable custom architectural validation rules with Chakra UI v3 compatibility.

**Timeline:** 2-4 hours

**Risk Level:** Low (isolated to linting infrastructure, doesn't affect runtime code)

**Rollback:** Simple - revert package.json and reinstall

---

## Current State vs Target State

### Current State (ESLint 8)
- ❌ Cannot parse Chakra UI v3 components
- ❌ 73/132 files fail to parse
- ❌ Validation rules cannot run
- ✅ Matches backend ESLint version (not required)

### Target State (ESLint 9)
- ✅ Parses all modern TypeScript/React/Chakra syntax
- ✅ All 132 files validate successfully
- ✅ 6 custom validation rules enforced
- ✅ Flat config format (modern standard)
- ⚠️ Different ESLint version than backend (acceptable)

---

## Phase 1: Dependency Updates (15 minutes)

### Step 1.1: Update package.json

**File:** `frontend/package.json`

**Changes:**
```json
{
  "devDependencies": {
    "@typescript-eslint/parser": "^8.55.0",  // Was: ^7.18.0
    "eslint": "^9.37.0",                      // Was: ^8.57.1
    "eslint-config-next": "^15.5.5",          // Keep current
    "glob": "^10.3.10"                         // Keep current
  }
}
```

**Why these versions:**
- `eslint@9.37.0` - Latest stable ESLint 9
- `@typescript-eslint/parser@8.55.0` - Compatible with ESLint 9 and handles modern TS/React

### Step 1.2: Clean Install

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

**Expected warnings:** You'll see deprecation warnings for `glob` - these are safe to ignore.

**Success criteria:** Installation completes without errors.

---

## Phase 2: Update Validation Script (30-60 minutes)

### Step 2.1: Understand ESLint 9 API Changes

**Key differences from ESLint 8:**

| Feature | ESLint 8 | ESLint 9 |
|---------|----------|----------|
| Config format | `.eslintrc.json` (legacy) | Flat config array |
| API class | `Linter` with `defineParser()` | `ESLint` with config object |
| Parser registration | `linter.defineParser()` | In config `languageOptions.parser` |
| Plugin registration | `linter.defineRule()` | In config `plugins` object |

### Step 2.2: Rewrite validate-architecture.js

**File:** `frontend/scripts/validate-architecture.js`

**Full working implementation:**

```javascript
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

// Load custom rules
const customRules = {};
const ruleFiles = fs.existsSync(path.join(__dirname, '../eslint-rules'))
  ? fs.readdirSync(path.join(__dirname, '../eslint-rules'))
      .filter(f => f.endsWith('.js') && !f.startsWith('ESLINT'))
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
```

**Key changes from ESLint 8 version:**
1. Use `ESLint` class instead of `Linter`
2. No `defineParser()` or `defineRule()` - everything in flat config
3. Use `eslint.lintFiles()` instead of manual `linter.verify()` per file
4. Config is an array with flat config objects
5. Parser is a require'd module in `languageOptions.parser`

### Step 2.3: Test the Script

```bash
cd frontend
node scripts/validate-architecture.js 2>&1 | head -50
```

**Expected output:** Should show violations from custom rules, not parsing errors.

**If you see errors:**
- Check `overrideConfig` matches flat config spec
- Ensure `languageOptions.parser` is the imported module, not a string
- Verify `files` array matches your glob patterns

---

## Phase 3: Verification & Testing (30 minutes)

### Step 3.1: Test Each Rule Independently

Create a test file to verify each rule works:

```bash
# Create test component
cat > components/TestComponent.tsx << 'EOF'
import React from 'react';

export const TestComponent = () => {
  console.log('test'); // Should trigger no-console-in-components

  return <div>Test</div>;
};
EOF

# Run validation
npm run validate:architecture:json

# Should show console violation
# Clean up
rm components/TestComponent.tsx
```

### Step 3.2: Run Analysis Report

```bash
node scripts/analyze-violations.js
```

**Expected output:**
```
================================================================================
FRONTEND VALIDATION SUMMARY
================================================================================

Total violations: ~1000-1500
Affected files: ~54-80

VIOLATIONS BY RULE                                           COUNT  FILES
--------------------------------------------------------------------------------
no-complex-jsx                                                ~1011     54
no-console-in-components                                         ~10      8
no-large-component-files                                         ~15     15
prefer-custom-hooks                                              ~20     20
require-loading-error-states                                     ~50     30
no-direct-fetch-in-components                                     ~5      5
```

**Success criteria:**
- No parsing errors
- Violations from actual code issues, not parser failures
- At least 100+ files successfully scanned

### Step 3.3: Verify Next.js Integration

ESLint 9 should NOT break Next.js's built-in linting:

```bash
npm run lint
```

**Expected:** Next.js lint should still work (it uses its own config).

**If broken:** Next.js might need config updates, but this is rare since we're using `overrideConfigFile: true`.

---

## Phase 4: Configuration Tuning (15 minutes)

### Step 4.1: Add package.json Script

Add helper scripts for common operations:

```json
{
  "scripts": {
    "validate:architecture": "node scripts/validate-architecture.js",
    "validate:architecture:json": "node scripts/validate-architecture.js",
    "validate:report": "node scripts/analyze-violations.js",
    "validate:warnings": "node scripts/validate-architecture.js --include-warnings"
  }
}
```

### Step 4.2: Create .eslintignore (Optional)

If you want ESLint to ignore certain patterns globally:

**File:** `frontend/.eslintignore`

```
# Build outputs
.next/
dist/
build/
out/

# Dependencies
node_modules/

# Test outputs
playwright-report/
test-results/

# Generated files
*.tsbuildinfo
```

---

## Phase 5: Rollback Plan

If something goes wrong, here's how to revert:

### Quick Rollback

```bash
cd frontend

# Restore old package.json versions
git checkout package.json

# Clean install
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Restore old validation script
git checkout scripts/validate-architecture.js
```

### Alternative: Keep Both Versions

If you want to test both:

```bash
# Rename current script
mv scripts/validate-architecture.js scripts/validate-architecture-eslint9.js

# Keep old script
git checkout scripts/validate-architecture.js
mv scripts/validate-architecture.js scripts/validate-architecture-eslint8.js

# Switch between them in package.json
```

---

## Troubleshooting Guide

### Issue 1: "No matching configuration found"

**Symptom:** Files show "No matching configuration found" warning.

**Cause:** Flat config `files` array doesn't match linted files.

**Fix:**
```javascript
// In flat config, make files pattern more permissive
files: ['**/*.{ts,tsx,js,jsx}']  // Instead of specific paths
```

### Issue 2: "Parser not found"

**Symptom:** `TypeError: Cannot read property 'parseForESLint' of undefined`

**Cause:** Parser not properly imported in config.

**Fix:**
```javascript
// Wrong
languageOptions: {
  parser: '@typescript-eslint/parser'  // String won't work
}

// Right
languageOptions: {
  parser: require('@typescript-eslint/parser')  // Imported module
}
```

### Issue 3: "Unknown rule: custom-rules/..."

**Symptom:** Rules not recognized.

**Cause:** Plugin object structure incorrect.

**Fix:**
```javascript
// Wrong
plugins: {
  'custom-rules': customRules  // Direct object
}

// Right
plugins: {
  'custom-rules': {
    rules: customRules  // Wrapped in 'rules' key
  }
}
```

### Issue 4: High memory usage / slow linting

**Symptom:** Validation takes >2 minutes or crashes.

**Cause:** Linting too many files at once.

**Fix:**
```javascript
// In validateArchitecture(), add:
const BATCH_SIZE = 50;
for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const batch = files.slice(i, i + BATCH_SIZE);
  const results = await eslint.lintFiles(batch);
  // Process results...
}
```

### Issue 5: Rules not detecting violations

**Symptom:** 0 violations when you expect many.

**Cause:** Rules not enabled or path matching broken.

**Debug:**
```javascript
// Add logging to script
console.error('Rules loaded:', Object.keys(customRules));
console.error('Files to scan:', files.length);
console.error('Config:', JSON.stringify(flatConfig, null, 2));
```

---

## Post-Upgrade Checklist

- [ ] ESLint 9 installed (`npm list eslint | grep 9.`)
- [ ] Parser v8.x installed (`npm list @typescript-eslint/parser`)
- [ ] Validation script runs without errors
- [ ] At least 100 files successfully scanned
- [ ] Violations detected (not just parse errors)
- [ ] `npm run validate:architecture:json` works
- [ ] `node scripts/analyze-violations.js` produces report
- [ ] Next.js `npm run lint` still works
- [ ] No breaking changes to build/dev process

---

## Success Metrics

**Before Upgrade (ESLint 8):**
- ❌ 0/132 files validating
- ❌ All files skip due to parse errors
- ❌ Cannot enforce architectural rules

**After Upgrade (ESLint 9):**
- ✅ 132/132 files validating
- ✅ ~1000+ violations detected
- ✅ Rules enforcing architectural patterns
- ✅ Ready for staged deployment

---

## Next Steps After Upgrade

Once ESLint 9 is working:

1. **Stage 1 - Baseline Report** (Day 1)
   - Run `node scripts/analyze-violations.js`
   - Document current violations
   - Share with team

2. **Stage 2 - Warning Mode** (Week 1)
   - Change rules from `'error'` to `'warn'`
   - Developers see warnings but builds don't fail
   - Start fixing violations

3. **Stage 3 - Error Mode** (Week 2-3)
   - Change rules back to `'error'`
   - Builds fail on new violations
   - Fix remaining violations

4. **Stage 4 - CI/CD** (Week 4)
   - Add `npm run validate:architecture:json` to GitHub Actions
   - Block PRs with violations
   - Continuous enforcement

---

## Estimated Time Breakdown

| Phase | Task | Time |
|-------|------|------|
| 1 | Update dependencies | 15 min |
| 2 | Rewrite validation script | 60 min |
| 3 | Testing & verification | 30 min |
| 4 | Configuration tuning | 15 min |
| 5 | Documentation | 30 min |
| **Total** | | **2.5 hours** |

Add 1-2 hours buffer for troubleshooting = **4 hours max**

---

## Reference Links

- [ESLint 9 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- [Flat Config Documentation](https://eslint.org/docs/latest/use/configure/configuration-files)
- [TypeScript ESLint Parser](https://typescript-eslint.io/packages/parser)
- [ESLint Node.js API](https://eslint.org/docs/latest/integrate/nodejs-api)

---

## Questions & Support

If you encounter issues during upgrade:

1. Check the troubleshooting section above
2. Enable debug mode: `DEBUG=1 node scripts/validate-architecture.js`
3. Test with a single file: `eslint components/TestComponent.tsx --config scripts/test-config.js`
4. Compare with backend's working ESLint 8 setup for reference

---

**Document Version:** 1.0
**Created:** 2026-02-15
**Status:** Ready for Review
