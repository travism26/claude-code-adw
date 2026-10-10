# Frontend Architectural Validation Setup

## Overview

The frontend validation infrastructure is now set up and ready for deploying custom architectural rules in stages. This mirrors the backend validation system but uses ESLint 9+ flat config format.

## Current Status

- **Infrastructure**: ✅ Complete
- **Custom Rules**: 📝 Ready to be added
- **Files Scanned**: 132 TypeScript/TSX files

## Directory Structure

```
frontend/
├── scripts/
│   └── validate-architecture.js     # Main validation script (ESLint 9+ flat config)
└── eslint-rules/
    └── README.md                    # Guide for adding custom rules
```

## Running Validation

```bash
# From frontend directory
npm run validate:architecture:json

# With warnings included
npm run validate:architecture:json --include-warnings
```

## Current Output

Since no custom rules are defined yet, the script outputs:

```json
[
  {
    "rule": "info",
    "file": "N/A",
    "line": null,
    "column": null,
    "severity": "info",
    "message": "No custom rules defined yet. Validation setup is ready for future rules. Scanned 132 files.",
    "fix_suggestion": null
  }
]
```

## Key Differences from Backend

| Feature | Backend | Frontend |
|---------|---------|----------|
| ESLint Version | 8.57.1 | 9.37.0 |
| Config Format | Legacy | Flat Config |
| Parser API | `defineParser()` | Flat config `languageOptions.parser` |
| Rule Registration | `defineRule()` | Flat config `plugins` object |

## Next Steps: Adding Rules

When you're ready to add custom rules, follow the staged deployment approach:

### Stage 1: Create Rule (Warning Mode)
1. Create rule file in `frontend/eslint-rules/your-rule-name.js`
2. Rule auto-loads (no need to modify validation script)
3. Test with: `npm run validate:architecture:json`
4. Fix violations while rule is in warning mode

### Stage 2: Promote to Error Mode
1. Update rule configuration to `error` severity
2. Re-run validation to ensure all violations are fixed
3. Merge to main branch

### Stage 3: Add to CI/CD
1. Add validation step to GitHub Actions / CI pipeline
2. Block PRs with architectural violations

## Example Rule Ideas

See `frontend/eslint-rules/README.md` for a comprehensive list of potential rules:

- `no-direct-api-calls-in-components` - Enforce API calls through hooks only
- `require-error-boundaries` - Ensure error handling
- `no-inline-styles` - Prefer Tailwind/CSS modules
- `require-loading-states` - Ensure async operations show loading
- `require-accessibility-attrs` - Enforce ARIA labels

## Technical Notes

- **Flat Config**: Uses ESLint 9's new flat config format
- **TypeScript Support**: `@typescript-eslint/parser` configured
- **File Scanning**: Scans `components/`, `api/`, `hooks/`, `routes/`, `types/`, `utils/`, `app/`
- **Test Exclusions**: Automatically skips `e2e/` and `.spec./.test.` files
- **JSON Output**: Structured output for easy integration with automation tools

## Dependencies

Added to `package.json`:
- `glob@^10.3.10` - For file pattern matching
- `@typescript-eslint/parser@^8.55.0` - For parsing TypeScript/TSX files

## Comparison with Backend

The frontend setup is architecturally identical to the backend but adapted for:
- ESLint 9+ flat config format (vs ESLint 8 legacy config)
- React/Next.js patterns (vs Express/Node patterns)
- Browser + Node globals (vs Node-only globals)
- TypeScript + JSX parsing (vs TypeScript only)
