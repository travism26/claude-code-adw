# Frontend Test Suite

Execute the frontend checks and return results in a standardized JSON format for automated processing.

## Purpose

Verify the Next.js app type-checks and compiles. Playwright e2e specs (`e2e/`)
require a running dev server + backend and are run by the eval harness, not here
— this command covers the fast, hermetic gates an implementer can always run.

**Note:** This command runs ONLY tests/build. For linting and static analysis, use `/validate`.

## Variables

TEST_COMMAND_TIMEOUT: 20 minutes per command

## Test Execution Sequence

1. TypeScript compile check:
   - Command: `npx tsc --noEmit`
   - test_name: "typecheck"
2. Next.js production build (compiles every route/component):
   - Command: `npm run build`
   - test_name: "next_build"
   - A successful run ends with the route summary table; capture any compile/type
     errors into the error field on failure.

## Report

- IMPORTANT: Return ONLY the JSON array below — no extra text or markdown. We run JSON.parse() on it directly.
- One entry per executed command, failed entries first.
- `execution_command` must reproduce the run exactly.
- If a test passes, omit the error field.

### Output Structure

```json
[
  {
    "test_name": "string",
    "passed": boolean,
    "execution_command": "string",
    "test_purpose": "string",
    "error": "optional string"
  }
]
```

### Example Output

```json
[
  {
    "test_name": "typecheck",
    "passed": true,
    "execution_command": "npx tsc --noEmit",
    "test_purpose": "TypeScript compile check"
  },
  {
    "test_name": "next_build",
    "passed": true,
    "execution_command": "npm run build",
    "test_purpose": "Next.js production build compiles all routes"
  }
]
```
