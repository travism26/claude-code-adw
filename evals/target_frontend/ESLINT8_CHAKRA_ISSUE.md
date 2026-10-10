# ESLint 8 + Chakra UI v3 Compatibility Issue

## Problem

After downgrading to ESLint 8, all component files fail to parse with error:
```
Unknown class name: exit
Occurred while linting components/ZoneSelector.tsx:36
```

This affects **all 73 component files** that use Chakra UI v3 components.

## Root Cause

Chakra UI v3 uses modern TypeScript/React syntax that `@typescript-eslint/parser` v5, v6, and v7 (compatible with ESLint 8) cannot parse correctly.

The error occurs specifically with Chakra UI's component syntax:
```typescript
import { Box, VStack, Text } from "@chakra-ui/react"
```

## Attempted Solutions

1. ✗ @typescript-eslint/parser v5.62.0 - Parse errors
2. ✗ @typescript-eslint/parser v6.21.0 - Parse errors
3. ✗ @typescript-eslint/parser v7.18.0 - Parse errors
4. ✗ Parser options (project: null, ecmaVersion: 'latest') - Parse errors

## Options Going Forward

### Option 1: Upgrade Back to ESLint 9 (Recommended)
**Pros:**
- Modern ESLint with flat config
- Better TypeScript/React support
- Fixes Chakra UI parsing issues
- Future-proof

**Cons:**
- Need to finish debugging ESLint 9 flat config API
- Different from backend (ESLint 8)

**Effort:** 2-4 hours to debug flat config API

### Option 2: Wait for Chakra UI Parsing Fix
**Pros:**
- Keep ESLint 8 to match backend
- No code changes needed

**Cons:**
- Unknown timeline for fix
- May never be fixed (ESLint 8 is deprecated)
- Can't use validation rules now

**Effort:** Indefinite wait

### Option 3: Remove Chakra UI Components from Validation
**Pros:**
- Works immediately with ESLint 8
- Validates non-Chakra files

**Cons:**
- Misses 73/132 files (55% of codebase)
- Most complex components use Chakra
- Defeats purpose of validation

**Effort:** 30 minutes

### Option 4: Use Babel Parser Instead
**Pros:**
- More permissive with JSX
- Might handle Chakra syntax

**Cons:**
- Less TypeScript-aware
- May miss TypeScript-specific issues
- Another dependency

**Effort:** 1-2 hours

## Recommendation

**Go with Option 1: Upgrade back to ESLint 9**

Reasoning:
1. ESLint 9 is the future - ESLint 8 is deprecated
2. Chakra UI v3 is modern and won't work with old parsers
3. Frontend can be on ESLint 9 while backend stays on ESLint 8 - they don't need to match
4. Only 2-4 hours of work to get it working vs indefinite wait or compromised solution

## Implementation for Option 1

1. Revert to ESLint 9 in package.json
2. Use the `ESLint` class API (not `Linter`)
3. Use flat config format properly
4. Test with Chakra UI components

This was attempted earlier but needs proper flat config setup with the ESLint class.

## Current Status

- ✅ Rules created (6 high-impact rules)
- ✅ Validation infrastructure set up
- ✅ ESLint 8 installed
- ⚠️  Parser cannot handle Chakra UI v3 syntax
- 📊 **0/132 files** currently validating (all skipped due to parse errors)

## Files Created

All validation infrastructure is in place:
- `scripts/validate-architecture.js`
- `scripts/analyze-violations.js`
- `eslint-rules/*.js` (6 rules)

Just need to resolve the parser compatibility issue.
