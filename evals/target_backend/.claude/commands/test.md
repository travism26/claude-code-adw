# TypeScript Test Suite (parallel)

Execute the backend test suite and return results in a standardized JSON format for automated processing.

## Purpose

Run the full API test suite FAST via parallel execution, plus a TypeScript compile check. The parallel runner (`npm run test:api:parallel`) drops/recreates/migrates 4 worker databases and runs all API suites across 4 mocha workers — full regression coverage in ~20-30 seconds.

**Note:** This command runs ONLY tests. For linting and static analysis, use `/validate`.

**NEVER run the serial full glob** (`mocha 'src/tests/api/**/*.test.ts'` without `--parallel`) — it takes 5-10+ minutes and some suites hold open handles so the process never exits.

## Variables

TEST_COMMAND_TIMEOUT: 5 minutes per command

## Test Execution Sequence

1. TypeScript compile check:
   - Command: `npx tsc --noEmit`
   - test_name: "typecheck"
2. Full API suite, parallel:
   - Command: `npm run test:api:parallel`
   - test_name: "api_parallel"
   - The summary line looks like `400 passing (18s)` with possible `N failing` / `N pending`.
   - If specific tests fail, capture their names/errors from the output into the error field.

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
    "test_name": "api_parallel",
    "passed": true,
    "execution_command": "npm run test:api:parallel",
    "test_purpose": "Full API suite across 4 parallel workers"
  }
]
```
