# ESLint 9 Upgrade - Quick Checklist

Use this checklist while executing the upgrade plan. Check off each step as you complete it.

## Pre-Upgrade

- [ ] Review full plan in `ESLINT9_UPGRADE_PLAN.md`
- [ ] Commit current working state: `git add -A && git commit -m "Pre-ESLint 9 upgrade checkpoint"`
- [ ] Note current branch: `git branch --show-current`
- [ ] Backup package.json: `cp package.json package.json.backup`

## Phase 1: Dependencies (15 min)

- [ ] Update package.json:
  ```
  "@typescript-eslint/parser": "^8.55.0"
  "eslint": "^9.37.0"
  ```
- [ ] Clean install:
  ```bash
  rm -rf node_modules package-lock.json
  npm install --legacy-peer-deps
  ```
- [ ] Verify installation:
  ```bash
  npm list eslint | grep 9.
  npm list @typescript-eslint/parser | grep 8.
  ```

## Phase 2: Update Validation Script (60 min)

- [ ] Open `scripts/validate-architecture.js`
- [ ] Replace entire contents with version from upgrade plan
- [ ] Save file
- [ ] Test basic run:
  ```bash
  node scripts/validate-architecture.js 2>&1 | head -20
  ```
- [ ] Verify no "Cannot find module" errors
- [ ] Verify no "defineParser" errors

## Phase 3: Testing (30 min)

- [ ] Run full validation:
  ```bash
  npm run validate:architecture:json
  ```
- [ ] Check output - should see violations, not parse errors
- [ ] Run analysis:
  ```bash
  node scripts/analyze-violations.js
  ```
- [ ] Verify stats:
  - [ ] Total violations > 0
  - [ ] Affected files > 50
  - [ ] Multiple rule types detected
- [ ] Test Next.js lint still works:
  ```bash
  npm run lint
  ```

## Phase 4: Verify Each Rule (15 min)

Test that each rule actually detects violations:

- [ ] **no-complex-jsx**: Should have ~1000 violations
- [ ] **no-console-in-components**: Should have ~10 violations
- [ ] **no-large-component-files**: Should have ~15 violations
- [ ] **prefer-custom-hooks**: Should have ~20 violations
- [ ] **require-loading-error-states**: Should have ~50 violations
- [ ] **no-direct-fetch-in-components**: Should have ~5 violations

If any rule shows 0 violations, check the rule file for path matching issues.

## Phase 5: Integration (15 min)

- [ ] Verify all package.json scripts work:
  ```bash
  npm run validate:architecture
  npm run validate:architecture:json
  npm run validate:report
  ```
- [ ] Add to .gitignore if needed:
  ```
  /frontend/validation-*.json
  ```
- [ ] Test in different terminals/shells
- [ ] Test with environment variables if used

## Success Criteria

All must pass:

- [ ] ✅ ESLint 9.x installed
- [ ] ✅ Parser 8.x installed
- [ ] ✅ 100+ files successfully scanned
- [ ] ✅ 500+ violations detected
- [ ] ✅ No parsing errors
- [ ] ✅ Analysis report generates
- [ ] ✅ Next.js lint unaffected
- [ ] ✅ Build process unaffected

## Troubleshooting Quick Reference

### Problem: "No matching configuration found"
**Fix:** Check flat config `files` array matches your glob patterns

### Problem: Parser errors persist
**Fix:** Verify `languageOptions.parser` uses `require()`, not string

### Problem: Rules not detecting
**Fix:** Check path matching in rule files (`includes('components/')` not `includes('/components/')`)

### Problem: Slow performance
**Fix:** Reduce files per batch (see troubleshooting section in main plan)

## Post-Upgrade

- [ ] Delete backup: `rm package.json.backup`
- [ ] Commit changes:
  ```bash
  git add package.json package-lock.json scripts/ eslint-rules/
  git commit -m "Upgrade to ESLint 9 for validation compatibility"
  ```
- [ ] Document violations baseline:
  ```bash
  node scripts/analyze-violations.js > docs/validation-baseline.txt
  ```
- [ ] Share results with team

## Rollback (if needed)

If anything goes wrong:

```bash
# Restore backup
cp package.json.backup package.json

# Or restore from git
git checkout package.json scripts/validate-architecture.js

# Clean reinstall
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

## Next Actions

After successful upgrade:

1. [ ] Review violation report with team
2. [ ] Plan violation cleanup strategy
3. [ ] Set rules to 'warn' mode initially
4. [ ] Schedule weekly cleanup sessions
5. [ ] Add to CI/CD pipeline (after cleanup)

---

**Estimated Time:** 2-4 hours total
**Start Time:** ___________
**End Time:** ___________
**Actual Duration:** ___________

**Notes:**
