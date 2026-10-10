# AI Developer Workflows (ADWs)

## Overview

The `adws/` directory contains the **AI Developer Workflows** - the highest compositional level of the agentic layer. These are executable Python scripts that combine deterministic code with non-deterministic, compute-scalable agents to perform complex development tasks on your application layer.

The idea behind ADWs: instead of editing code by hand each time, capture recurring engineering patterns as reusable workflows that agents can run against a codebase.

## Core Philosophy

- **Template Engineering**: Capture and reuse engineering patterns
- **Agent Orchestration**: Combine multiple agents for complex workflows
- **Compute Scalability**: Scale development effort through parallel agent execution
- **Observability**: Track and debug agent actions through structured outputs

## Architecture Evolution

### Minimum Viable ADW Structure

```
adws/
   adw_modules/
       agent.py                # Core agent execution module
   adw_*.py                    # Single-file workflow scripts (uv astral)
```

The minimum viable structure focuses on:

- **Core execution** (`agent.py`): Essential agent interaction logic
- **Simple workflows** (`adw_*.py`): Standalone scripts using uv for dependency management

### Scaled ADW Structure

```
adws/
   adw_modules/                # Core reusable modules
       agent.py                # Agent execution
       agent_sdk.py            # SDK-based execution
       data_types.py           # Type definitions
       git_ops.py              # Git operations
       github.py               # GitHub integration
       state.py                # State management
       workflow_ops.py         # Workflow orchestration
       worktree_ops.py         # Worktree management

   adw_triggers/               # Invocation patterns
       trigger_webhook.py      # Webhook-based triggers
       trigger_cron.py         # Scheduled execution
       adw_trigger_*.py        # Custom triggers

   adw_tests/                  # Testing infrastructure
       test_agents.py          # Agent behavior tests
       test_*.py               # Component tests

   adw_data/                   # Persistent storage
       agents.db               # Agent database
       backups/                # Database backups

   # Individual workflows (This is the mostly used layer)
   travis/                     # Travis workflow (local SDLC)
       travis_sdlc.py          # Main orchestrator
       travis_*.py             # Phase scripts
```

## Key Components

### 1. Core Module: `agent.py`

The foundation module that provides:

- **AgentPromptRequest/Response**: Data models for prompt execution
- **AgentTemplateRequest**: Data model for slash command execution
- **prompt_claude_code()**: Direct Claude Code CLI execution
- **prompt_claude_code_with_retry()**: Execution with automatic retry logic
- **execute_template()**: Slash command template execution
- **Environment management**: Safe subprocess environment handling
- **Output parsing**: JSONL to JSON conversion and result extraction

### 2. Direct Prompt Execution: `adw_prompt.py`

Execute adhoc Claude Code prompts from the command line.

**Usage:**

```bash
# Direct execution (requires uv)
./adws/adw_prompt.py "Write a hello world Python script"

# With specific model
./adws/adw_prompt.py "Explain this code" --model opus

# From different directory
./adws/adw_prompt.py "List files here" --working-dir /path/to/project
```

**Features:**

- Direct prompt execution without templates
- Configurable models (sonnet/opus)
- Custom output paths
- Automatic retry on failure
- Rich console output with progress indicators

### 3. Slash Command Execution: `adw_slash_command.py`

Execute predefined slash commands from `.claude/commands/*.md` templates.

**Usage:**

```bash
# Run a slash command
./adws/adw_slash_command.py /chore "Add logging to agent.py"

# With arguments
./adws/adw_slash_command.py /implement specs/feature.md

# Start a new session
./adws/adw_slash_command.py /start
```

**Available Commands:**

- `/chore` - Create implementation plans
- `/implement` - Execute implementation plans
- `/prime` - Prime the agent with context
- `/start` - Start a new agent session

### 4. Compound Workflow: `adw_chore_implement.py`

Orchestrates a two-phase workflow: planning (/chore) followed by implementation (/implement).

**Usage:**

```bash
# Plan and implement a feature
./adws/adw_chore_implement.py "Add error handling to all API endpoints"

# With specific model
./adws/adw_chore_implement.py "Refactor database logic" --model opus
```

**Workflow Phases:**

1. **Planning Phase**: Executes `/chore` to create a detailed plan
2. **Implementation Phase**: Automatically executes `/implement` with the generated plan

## SDK-Based ADWs

In addition to subprocess-based execution, ADWs now support the Claude Code Python SDK for better type safety and native async/await patterns.

### SDK Module: `agent_sdk.py`

The SDK module provides idiomatic patterns for using the Claude Code Python SDK:

- **Simple queries** - `simple_query()` for basic text responses
- **Tool-enabled queries** - `query_with_tools()` for operations requiring tools
- **Interactive sessions** - `create_session()` context manager for conversations
- **Error handling** - `safe_query()` with SDK-specific exception handling

### SDK Execution: `adw_sdk_prompt.py`

Execute Claude Code using the Python SDK instead of subprocess.

**Usage:**

```bash
# One-shot query
./adws/adw_sdk_prompt.py "Write a hello world Python script"

# Interactive session
./adws/adw_sdk_prompt.py --interactive

# With tools
./adws/adw_sdk_prompt.py "Create hello.py" --tools Write,Read

# Interactive with context
./adws/adw_sdk_prompt.py --interactive --context "Debugging a memory leak"
```

### SDK vs Subprocess

| Feature              | Subprocess (agent.py) | SDK (agent_sdk.py)      |
| -------------------- | --------------------- | ----------------------- |
| Type Safety          | Basic dictionaries    | Typed message objects   |
| Error Handling       | Generic exceptions    | SDK-specific exceptions |
| Async Support        | Subprocess management | Native async/await      |
| Interactive Sessions | Not supported         | ClaudeSDKClient         |

## Intelligent Test Selection: `test_selector.py`

> The module mapping shown in this section is an example mapping for the vendored `evals/target_backend` app; adapt the patterns to your own project's modules.

The test selector module provides intelligent test selection based on changed files, significantly reducing test execution time while maintaining comprehensive coverage.

### Overview

Instead of running the entire test suite on every change, the test selector analyzes git changes and runs only tests affected by modified modules. This provides:

- **Performance**: Run only 20-40% of tests for typical feature changes
- **Safety**: Automatic full suite for core file changes
- **Flexibility**: Force full suite with `--run-all-tests` flag
- **Transparency**: Clear reasoning for test selection

### How It Works

**Module Mapping**:
The test selector maps source files to their corresponding tests using domain modules:

```python
# Example: Gardens module
"gardens": {
    "source_patterns": [
        r"backend/src/models/Garden\.ts",
        r"backend/src/routes/gardens\.ts",
        r"frontend/components/GardenCanvas\.tsx",
        # ... more patterns
    ],
    "backend_tests": ["npm run test:api:gardens", "npm run test:services:ai:garden"],
    "frontend_tests": ["e2e/garden-planner.spec.ts", "e2e/garden-suggestions.spec.ts"],
    "is_core": False,
}
```

**Selection Strategy**:
1. **no_changes**: No files changed → No tests run
2. **full_suite**: Core files or core modules changed → All tests run
3. **module_based**: Specific modules changed → Only related tests run

**Core Files** (always trigger full suite):
- Config files (`backend/src/config/*`)
- Middleware (`backend/src/middleware/*`)
- App entry points (`backend/src/index.ts`, `frontend/App.tsx`)
- Core components (`Layout.tsx`, `ProtectedRoute.tsx`)
- Package dependencies (`package.json`)

**Core Modules** (trigger full suite):
- `auth` - Authentication affects all protected routes
- `ai_services` - Base AI service affects all AI features
- `ai_tasks_queue` - Queue system affects all async operations

### Usage

**Standalone:**

```bash
# Analyze changes since HEAD
python3 adws/adw_modules/test_selector.py

# Compare against main branch
python3 adws/adw_modules/test_selector.py main

# Force full suite
python3 adws/adw_modules/test_selector.py HEAD --run-all-tests
```

**In Travis Test Script:**

`travis_test.py` drives `/test`, which has no test selection — it always runs
the full `{{TEST_COMMAND}}`. `--run-all-tests`/`--diff-base` are accepted for
CLI compatibility but ignored (a warning is logged). For real selection, see
`/test_e2e` below.

```bash
# Runs the full suite via /test (selection flags below have no effect)
uv run adws/travis/travis_test.py abc12345

# Accepted but ignored — /test always runs the full suite
uv run adws/travis/travis_test.py abc12345 --run-all-tests

# Accepted but ignored — /test always runs the full suite
uv run adws/travis/travis_test.py abc12345 --diff-base main
```

**In Slash Commands:**

Only `/test_e2e` uses the test selector. `/test` (unit tests) has no selection
logic — it always runs the full `{{TEST_COMMAND}}`, and `--run-all-tests`/
`--diff-base` have no effect on it:

```bash
# /test_e2e: intelligent selection (default)
/test_e2e

# /test_e2e: force all E2E tests
/test_e2e --run-all-e2e

# /test_e2e: compare against specific ref
/test_e2e --diff-base main
```

### Module Definitions

The test selector includes mappings for all major modules:

- **auth** - User authentication and authorization
- **plants** - Plant tracking and profiles
- **gardens** - Garden planning and analysis
- **care_history** - Care action logging
- **journal** - Plant journaling
- **questions_answers** - Community Q&A
- **notifications** - Real-time notifications
- **recommendations** - Plant recommendations
- **companions** - Companion planting
- **ai_services** - AI service infrastructure
- **ai_tasks_queue** - Background job processing
- **admin** - Admin panel
- **zones** - Hardiness zone detection
- **dashboard** - Dashboard page

### Adding New Modules

To add a new module to the test selector:

1. Open `adws/adw_modules/test_selector.py`
2. Add entry to `MODULE_MAPPINGS`:

```python
"your_module": {
    "source_patterns": [
        r"backend/src/models/YourModel\.ts",
        r"backend/src/routes/yourRoute\.ts",
        r"frontend/components/YourComponent\.tsx",
    ],
    "backend_tests": ["npm run test:api:yourmodule"],
    "frontend_tests": ["e2e/your-feature.spec.ts"],
    "is_core": False,  # Set to True if affects everything
}
```

3. Test the mapping:

```bash
# Make a test change to your source file
touch backend/src/models/YourModel.ts

# Run test selector
python3 adws/adw_modules/test_selector.py

# Verify your module appears in affected modules
```

**Example Scenarios:**

| Change                              | Tests Run            | Time Savings |
| ----------------------------------- | -------------------- | ------------ |
| Fix button in GardenCanvas.tsx      | 4 garden E2E tests   | ~80% faster  |
| Update Plant model                  | Plant API + E2E      | ~70% faster  |
| Refactor auth middleware            | Full suite           | 0% (safety)  |
| Add feature to notification service | Notification tests   | ~75% faster  |


## Best Practices

1. **Use the Right Tool**:

   - `adw_prompt.py` for one-off tasks
   - `adw_slash_command.py` for templated operations
   - `adw_chore_implement.py` for complex features
   - `adw_sdk_prompt.py` for type-safe SDK operations or interactive sessions

2. **Model Selection**:

   - Use `sonnet` (default) for most tasks
   - Use `opus` for complex reasoning or large codebases

3. **Working Directory**:

   - Always specify `--working-dir` when operating on different projects
   - ADWs respect `.mcp.json` configuration in working directories

4. **Output Analysis**:
   - Check `custom_summary_output.json` for high-level results
   - Use `cc_final_object.json` for the final agent response
   - Review `cc_raw_output.jsonl` for debugging

## Travis Workflow: Local SDLC Execution

The Travis workflow provides a simplified, local-only SDLC pipeline without GitHub integration or git worktree isolation. It's designed for rapid development iteration and local testing.

### Overview

Travis executes a complete SDLC pipeline locally:

1. **Plan** - Create implementation plan from prompt or use existing spec
2. **Build** - Implement the plan
3. **Test** - Run tests with automatic retry (up to 3 times by default)
4. **Review** - Review implementation against spec (optional)
5. **Document** - Generate documentation (optional)

### Usage

#### Full SDLC Workflow

```bash
# Run complete workflow from prompt (defaults to feature plan)
uv run adws/travis/travis_sdlc.py "Add a hello world function"

# Explicitly specify plan type
uv run adws/travis/travis_sdlc.py "Add logging" --plan-type chore
uv run adws/travis/travis_sdlc.py "Fix login error" --plan-type bug
uv run adws/travis/travis_sdlc.py "New user auth" --plan-type feature

# Run with existing spec file
uv run adws/travis/travis_sdlc.py specs/feature-abc123-my-feature.md

# Skip review and documentation
uv run adws/travis/travis_sdlc.py "Refactor logging" --skip-review --skip-document

# Custom test retry count
uv run adws/travis/travis_sdlc.py "Fix bug" --max-test-retries 5

# Combined options
uv run adws/travis/travis_sdlc.py "Fix memory leak" --plan-type bug --max-test-retries 5

# With specific ADW ID
uv run adws/travis/travis_sdlc.py "New feature" abc12345
```

#### Individual Phase Scripts

Each phase can be run independently for debugging or custom workflows:

```bash
# Planning phase
uv run adws/travis/travis_plan.py "Add user authentication" [adw-id]
uv run adws/travis/travis_plan.py "Fix login bug" [adw-id] --plan-type bug
uv run adws/travis/travis_plan.py "Refactor database" [adw-id] --plan-type chore
uv run adws/travis/travis_plan.py specs/existing-spec.md [adw-id]

# Build phase (requires plan to exist)
uv run adws/travis/travis_build.py <adw-id>

# Test phase (requires build to exist)
uv run adws/travis/travis_test.py <adw-id>
uv run adws/travis/travis_test.py <adw-id> --max-retries 5

# Review phase (requires test to exist)
uv run adws/travis/travis_review.py <adw-id>

# Documentation phase (requires build to exist)
uv run adws/travis/travis_document.py <adw-id>
```

