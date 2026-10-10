# ESLint 9 Upgrade - Quick Reference Card

Print this or keep it visible during the upgrade.

---

## 🚀 Quick Start Commands

```bash
# 1. Update package.json versions (manually edit)
#    eslint: ^9.37.0
#    @typescript-eslint/parser: ^8.55.0

# 2. Clean install
cd frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# 3. Test validation
npm run validate:architecture:json

# 4. Get report
node scripts/analyze-violations.js
```

---

## 📋 Validation Script Template

Copy this into `scripts/validate-architecture.js`:

```javascript
const { ESLint } = require('eslint');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Load custom rules
const customRules = {};
const ruleFiles = fs.readdirSync(path.join(__dirname, '../eslint-rules'))
  .filter(f => f.endsWith('.js') && !f.startsWith('ESLINT'));

for (const ruleFile of ruleFiles) {
  const ruleName = ruleFile.replace('.js', '');
  customRules[ruleName] = require(path.join(__dirname, '../eslint-rules', ruleFile));
}

async function validateArchitecture() {
  const files = glob.sync('{components,api,hooks,routes,types,utils,app}/**/*.{ts,tsx}', {
    cwd: path.join(__dirname, '..'),
    ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
    absolute: true,
  });

  const flatConfig = [{
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    plugins: { 'custom-rules': { rules: customRules } },
    rules: Object.keys(customRules).reduce((acc, name) => {
      acc[`custom-rules/${name}`] = 'error';
      return acc;
    }, {}),
  }];

  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: flatConfig,
    cwd: path.join(__dirname, '..'),
  });

  const results = await eslint.lintFiles(files.map(f => path.relative(path.join(__dirname, '..'), f)));

  const violations = [];
  for (const result of results) {
    for (const message of result.messages) {
      if (message.ruleId?.startsWith('custom-rules/')) {
        violations.push({
          rule: message.ruleId,
          file: path.relative(process.cwd(), result.filePath),
          line: message.line,
          column: message.column,
          severity: message.severity === 2 ? 'error' : 'warning',
          message: message.message,
        });
      }
    }
  }

  console.log(JSON.stringify(violations, null, 2));
  process.exit(violations.some(v => v.severity === 'error') ? 1 : 0);
}

validateArchitecture();
```

---

## 🔍 Debug Commands

```bash
# Check ESLint version
npm list eslint

# Check parser version
npm list @typescript-eslint/parser

# Test single file
node -e "
const { ESLint } = require('eslint');
const eslint = new ESLint();
eslint.lintFiles(['components/Dashboard.tsx']).then(r => console.log(r));
"

# Enable debug output
DEBUG=1 node scripts/validate-architecture.js

# Test rule loading
node -e "
const fs = require('fs');
const rules = fs.readdirSync('eslint-rules').filter(f => f.endsWith('.js'));
console.log('Rules:', rules);
"
```

---

## ⚠️ Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `No matching configuration` | Check `files` array in config |
| `Parser not found` | Use `require('@typescript-eslint/parser')` not string |
| `Unknown rule` | Check plugin structure: `{ rules: customRules }` |
| `Unknown class name: exit` | You're still on ESLint 8 or old parser |

---

## ✅ Success Checks

Run these to verify success:

```bash
# Should show violations (not parse errors)
npm run validate:architecture:json | head -20

# Should show stats
node scripts/analyze-violations.js

# Should see ESLint 9
npm list eslint | grep 9.

# Next.js should still work
npm run lint
```

---

## 🔄 Rollback

If you need to rollback:

```bash
git checkout package.json scripts/validate-architecture.js
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

---

## 📊 Expected Results

After upgrade:

- **Files scanned:** 132/132
- **Total violations:** ~1000-1500
- **Rules detecting:**
  - `no-complex-jsx`: ~1000
  - `no-console-in-components`: ~10
  - `no-large-component-files`: ~15
  - `prefer-custom-hooks`: ~20
  - `require-loading-error-states`: ~50
  - `no-direct-fetch-in-components`: ~5

---

## 📝 Key Config Differences

| ESLint 8 | ESLint 9 |
|----------|----------|
| `Linter` class | `ESLint` class |
| `defineParser()` | `languageOptions.parser` in config |
| `defineRule()` | `plugins` in config |
| `linter.verify()` | `eslint.lintFiles()` |
| Legacy config | Flat config array |

---

## 🎯 One-Liner Success Test

```bash
npm run validate:architecture:json 2>&1 | grep -c '"rule": "custom-rules' && echo "✅ Working!" || echo "❌ Failed"
```

Should output a number > 0 and "✅ Working!"

---

**Time Budget:** 2-4 hours
**Document:** See `ESLINT9_UPGRADE_PLAN.md` for full details
