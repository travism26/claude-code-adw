# Python Test Suite

Execute unit tests for the Python application. Returns results in a standardized JSON format for automated processing.

## Purpose

Run the application's unit test suite to verify functionality and catch regressions:

- Execute all Python unit tests
- tmp_path fixtures for isolated JSON files (e.g., race detection, coverage reports)
- Verify application logic and behavior

**Note:** This command runs ONLY unit tests. For linting, static analysis, and code quality checks, use the `/validate` command instead.

## Variables

TEST_COMMAND_TIMEOUT: 5 minutes
RUN_VERBOSE: false (set to true for verbose test output)


## Instructions

### Test Execution Guidelines

- Run the unit test suite
- Capture the result (passed/failed) and any error messages
- IMPORTANT: Return ONLY the JSON array with test results
  - IMPORTANT: Do not include any additional text, explanations, or markdown formatting
  - We'll immediately run JSON.parse() on the output, so make sure it's valid JSON
- If a test passes, omit the error field
- If a test fails, include the error message in the error field
- Error Handling:
  - If a command returns non-zero exit code, mark as failed
  - Capture stderr output for error field
  - Timeout commands after `TEST_COMMAND_TIMEOUT`

## Test Execution Sequence

### Unit Tests

- Command: `uv run pytest -q`
- test_name: "test_notes"
- test_purpose: "store and CLI behavior"

## Report

- IMPORTANT: Return results exclusively as a JSON array based on the `Output Structure` section below.
- Sort the JSON array with failed tests (passed: false) at the top
- Include all tests in the output, both passed and failed
- The execution_command field should contain the exact command that can be run to reproduce the test
- This allows subsequent agents to quickly identify and resolve errors

### Output Structure

```json
[
  {
    "test_name": "string",
    "passed": boolean,
    "execution_command": "string",
    "test_purpose": "string",
    "error": "optional string"
  },
  ...
]
```

### Example Output - Tests Passed

```json
[
  {
    "test_name": "test_notes",
    "passed": true,
    "execution_command": "uv run pytest -q",
    "test_purpose": "store and CLI behavior"
  }
]
```

### Example Output - Tests Failed

```json
[
  {
    "test_name": "test_notes",
    "passed": false,
    "execution_command": "uv run pytest -q",
    "test_purpose": "store and CLI behavior",
    "error": "<failure output captured from the test runner>"
  }
]
```
