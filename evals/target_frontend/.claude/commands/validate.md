# TypeScript Code Validation

Run comprehensive TypeScript code validation including compilation/type-checking, linting, static analysis, and formatting checks. Returns violations in a standardized JSON format.

## Purpose

Enforce code quality, security, and TypeScript best practices by:

- Verifying code compiles / type-checks successfully (`npx tsc --noEmit`)
- Running static analysis (`npx tsc --noEmit`)
- Checking code formatting (`npm run lint`)
- Running linter (`npm run lint`)
- Identifying potential bugs, security issues, and code quality problems
- Returning actionable violation reports with file:line references

**Note:** This command runs all static analysis and linting checks. For running unit tests, use the `/test` command instead.

## Variables

VALIDATION_TIMEOUT: 5 minutes

## Code Quality & Linting Standards

The project enforces comprehensive code quality standards using `eslint`.

### Enabled Linters / Checks

eslint with project TypeScript rules

<!--
Replace with the linters and checks specific to this project.
Categorize where helpful (security, error handling, complexity,
bug detection, style, best practices).
-->

## Instructions

Execute TypeScript validation and return results as a JSON array of violations.

### Execution Steps

1. **Verify compilation / type-check**
   ```bash
   npx tsc --noEmit
   ```
   This ensures all TypeScript code compiles or type-checks successfully before running further checks.

2. **Run static analysis**
   ```bash
   npx tsc --noEmit
   ```

3. **Check formatting**
   ```bash
   npm run lint
   ```

4. **Run linter**
   ```bash
   npm run lint
   ```

5. **Parse the output**
   - Parse each tool's output
   - Categorize by severity (error vs warning)
   - Compilation / type errors are always errors
   - Static analysis issues are typically errors (potential bugs)
   - Formatting issues are typically warnings (style)
   - Linter categorizes based on the specific rule
   - Exit code 0 = no critical violations

6. **Return results**
   - IMPORTANT: Return ONLY the JSON array with violations
   - Do not include any additional text, explanations, or markdown formatting
   - We'll immediately run JSON.parse() on the output
   - If validation fails to run, return error as JSON

## Common Validation Issues & Fixes

Business logic in route handlers instead of services; missing express-validator on new inputs; schema changes without a migration; tests that don't cover auth/404 paths.

<!--
Replace with language-specific examples of common violations and how to fix them.
-->

## Error Handling

If the validation fails to execute:
- Capture the error message
- Return as a single-item JSON array with a validation-error violation
- Example:
  ```json
  [
    {
      "rule": "validation-error",
      "file": "unknown",
      "line": null,
      "column": null,
      "severity": "error",
      "message": "Failed to run validation: <error message>",
      "fix_suggestion": null
    }
  ]
  ```

## Report

Return results exclusively as a JSON array matching the ValidationViolation schema:

### Output Structure

```json
[
  {
    "rule": "string",
    "file": "string",
    "line": number | null,
    "column": number | null,
    "severity": "error" | "warning",
    "message": "string",
    "fix_suggestion": "string" | null
  },
  ...
]
```

### Example Output - No Violations

```json
[]
```

### Example Output - With Violations

```json
[
  {
    "rule": "routes-delegate-to-services",
    "file": "src/routes/companions.ts",
    "line": 45,
    "column": 12,
    "severity": "error",
    "message": "<short description of the violation>",
    "fix_suggestion": "<short description of how to fix>"
  }
]
```

## Notes

- Only critical violations (severity: "error") should fail the validation phase
- Warnings (severity: "warning") are informational and don't fail validation
