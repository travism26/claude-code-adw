# ADW System - Complete Setup Guide

> **Note:** Legacy reference guide from an earlier ADW iteration; file names may differ from this repo (e.g. the `adw_*_iso.py` entry points, `classify_issue.md`, `prepare_app.md`, `scripts/*.sh`, and the E2B sandbox are not part of this repo). See README.md for the current setup.

This guide explains everything needed to copy and set up the ADW (Agentic Development Workflow) system in a new project.

## Table of Contents

1. [What is ADW?](#what-is-adw)
2. [Architecture Overview](#architecture-overview)
3. [Required Files & Directory Structure](#required-files--directory-structure)
4. [Prerequisites & Dependencies](#prerequisites--dependencies)
5. [Setup Instructions](#setup-instructions)
6. [Workflow Execution Flow](#workflow-execution-flow)
7. [Testing the Setup](#testing-the-setup)
8. [Troubleshooting](#troubleshooting)

---

## What is ADW?

**ADW (Agentic Development Workflow)** is an automated software development system that:
- Processes GitHub issues autonomously
- Creates isolated git worktrees for parallel execution
- Runs complete SDLC workflows using Claude Code CLI
- Generates plans, implements code, runs tests, reviews, and creates PRs
- Supports up to 15 concurrent workflow instances

### Key Features

- **Isolated Execution**: Each workflow runs in its own git worktree with dedicated ports
- **Parallel Processing**: Run multiple workflows simultaneously without conflicts
- **Full SDLC**: Plan → Build → Test → Review → Document → Ship
- **Zero Touch Execution**: Optionally auto-merge approved code to main
- **Webhook & Cron Triggers**: Real-time or polling-based automation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Issue #123                         │
│                   "Add dark mode toggle"                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Trigger Mechanisms                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Manual     │  │  Cron Poll   │  │  Webhook (Real-time) │  │
│  │  uv run ...  │  │  (20 sec)    │  │   GitHub Events      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              ADW SDLC Pipeline (adw_sdlc_iso.py)                │
│                                                                  │
│  Phase 1: PLAN (adw_plan_iso.py)                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Creates worktree: trees/abc12345/                      │  │
│  │ • Allocates ports: Backend 9107, Frontend 9207           │  │
│  │ • Classifies issue: /feature, /bug, /chore              │  │
│  │ • Generates plan: agents/abc12345/abc12345_plan_spec.md │  │
│  │ • Creates state: agents/abc12345/adw_state.json         │  │
│  │ • Claude Code runs: /classify_issue, /feature           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  Phase 2: BUILD (adw_build_iso.py)                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Loads state from Phase 1                               │  │
│  │ • Switches to worktree branch                            │  │
│  │ • Claude Code runs: /implement <plan>                    │  │
│  │ • Commits changes in worktree                            │  │
│  │ • Pushes to origin                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  Phase 3: TEST (adw_test_iso.py)                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Runs in worktree context                               │  │
│  │ • Uses allocated ports (BACKEND_PORT/FRONTEND_PORT env)  │  │
│  │ • Claude Code runs: /test                                │  │
│  │ • Auto-resolves failures: /resolve_failed_test           │  │
│  │ • Optional E2E tests                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  Phase 4: REVIEW (adw_review_iso.py)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Starts app with worktree ports                         │  │
│  │ • Claude Code runs: /review                              │  │
│  │ • Captures screenshots via Playwright MCP                │  │
│  │ • Uploads images to Cloudflare R2 (optional)            │  │
│  │ • Posts review comments to GitHub                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  Phase 5: DOCUMENT (adw_document_iso.py)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Claude Code runs: /document                            │  │
│  │ • Generates comprehensive documentation                  │  │
│  │ • Commits to app_docs/feature-abc12345-*.md            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  Optional Phase 6: SHIP (adw_ship_iso.py)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Validates all state fields populated                   │  │
│  │ • Approves PR via GitHub CLI                             │  │
│  │ • Merges PR to main (squash merge)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Pull Request Created                        │
│              feat-123-abc12345-add-dark-mode-toggle             │
│                                                                  │
│  • Code changes committed                                       │
│  • Tests passing                                                │
│  • Review screenshots attached                                  │
│  • Documentation generated                                      │
│  • Ready for human review or auto-merge                         │
└─────────────────────────────────────────────────────────────────┘
```

### Worktree Isolation Architecture

```
Main Repo                          Isolated Worktrees (trees/)
┌─────────────────┐               ┌─────────────────────────────┐
│  /project/      │               │  trees/abc12345/            │
│  ├── .git/      │───creates────▶│  ├── .git/ (worktree link)  │
│  ├── adws/      │               │  ├── (ports via env vars)   │
│  ├── app/       │               │  │   BACKEND_PORT=9107      │
│  ├── .env       │───copied─────▶│  │   FRONTEND_PORT=9207     │
│  └── ...        │               │  ├── adws/                  │
│                 │               │  ├── app/                   │
│                 │               │  └── ...                    │
│                 │               └─────────────────────────────┘
│                 │
│                 │               ┌─────────────────────────────┐
│                 │               │  trees/def67890/            │
│                 │───creates────▶│  ├── .git/ (worktree link)  │
│                 │               │  ├── (ports via env vars)   │
│                 │               │  │   BACKEND_PORT=9103      │
│                 │               │  │   FRONTEND_PORT=9203     │
│                 │               │  └── ...                    │
│                 │               └─────────────────────────────┘
└─────────────────┘

Shared State (agents/)
┌─────────────────────────────────────────────┐
│  agents/abc12345/adw_state.json            │
│  {                                          │
│    "adw_id": "abc12345",                   │
│    "issue_number": "123",                  │
│    "branch_name": "feat-123-abc12345-...", │
│    "worktree_path": "/project/trees/...",  │
│    "backend_port": 9107,                   │
│    "frontend_port": 9207,                  │
│    "plan_file": "agents/abc12345/...",     │
│    "issue_class": "/feature"               │
│  }                                          │
└─────────────────────────────────────────────┘
```

### Claude Code Slash Command Flow

```
┌─────────────────────────────────────────────────────────────┐
│  ADW Python Script (e.g., adw_plan_iso.py)                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  adw_modules/agent.py - run_claude_code()                  │
│  • Builds command: claude --cwd <worktree> /classify_issue │
│  • Sets working directory to worktree                       │
│  • Passes arguments (issue content, plan, etc.)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Claude Code CLI Execution                                  │
│  • Reads .claude/commands/<command>.md                     │
│  • Executes prompts with tools (Read, Edit, Bash, etc.)   │
│  • Runs in isolated worktree context                       │
│  • Outputs to agents/<adw_id>/<agent_name>/raw_output.jsonl│
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  adw_modules/agent.py - Parses Output                      │
│  • Extracts results from raw_output.jsonl                  │
│  • Returns to Python script for next phase                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Required Files & Directory Structure

### Minimum Files to Copy to New Project

```
new-project/
├── .claude/                          # Claude Code configuration
│   ├── settings.json                 # Hooks and permissions
│   ├── commands/                     # Slash commands for agents
│   │   ├── classify_issue.md        # Issue classification
│   │   ├── feature.md               # Feature planning
│   │   ├── bug.md                   # Bug fix planning
│   │   ├── chore.md                 # Chore planning
│   │   ├── implement.md             # Code implementation
│   │   ├── test.md                  # Run tests
│   │   ├── review.md                # Code review
│   │   ├── document.md              # Documentation generation
│   │   ├── patch.md                 # Quick patches
│   │   ├── resolve_failed_test.md   # Test failure resolution
│   │   ├── resolve_failed_e2e_test.md
│   │   ├── install_worktree.md      # Worktree environment setup
│   │   ├── prepare_app.md           # App startup preparation
│   │   ├── generate_branch_name.md  # Branch naming
│   │   └── pull_request.md          # PR creation
│   └── hooks/                        # Event hooks (optional but recommended)
│       ├── pre_tool_use.py
│       ├── post_tool_use.py
│       ├── notification.py
│       ├── stop.py
│       ├── subagent_stop.py
│       ├── pre_compact.py
│       ├── user_prompt_submit.py
│       └── utils/
│           ├── constants.py
│           └── llm/
│               ├── anth.py
│               └── oai.py
│
├── adws/                             # ADW workflow scripts
│   ├── adw_modules/                  # Core modules
│   │   ├── __init__.py
│   │   ├── agent.py                 # Claude Code CLI integration
│   │   ├── data_types.py            # Pydantic models (ADWState, etc.)
│   │   ├── state.py                 # State management
│   │   ├── workflow_ops.py          # Core workflow operations
│   │   ├── worktree_ops.py          # Worktree management
│   │   ├── git_ops.py               # Git operations
│   │   ├── github.py                # GitHub API integration
│   │   ├── utils.py                 # Utilities
│   │   └── r2_uploader.py           # Cloudflare R2 uploader (optional)
│   │
│   ├── adw_triggers/                 # Automation triggers
│   │   ├── __init__.py
│   │   ├── trigger_cron.py          # Polling trigger (20 sec intervals)
│   │   └── trigger_webhook.py       # Webhook server
│   │
│   ├── adw_plan_iso.py              # Entry point: Planning phase
│   ├── adw_patch_iso.py             # Entry point: Quick patches
│   ├── adw_build_iso.py             # Dependent: Build phase
│   ├── adw_test_iso.py              # Dependent: Test phase
│   ├── adw_review_iso.py            # Dependent: Review phase
│   ├── adw_document_iso.py          # Dependent: Documentation phase
│   ├── adw_ship_iso.py              # Dependent: Shipping phase
│   │
│   ├── adw_plan_build_iso.py        # Orchestrator: Plan + Build
│   ├── adw_plan_build_test_iso.py   # Orchestrator: Plan + Build + Test
│   ├── adw_plan_build_review_iso.py # Orchestrator: Plan + Build + Review
│   ├── adw_plan_build_test_review_iso.py
│   ├── adw_plan_build_document_iso.py
│   ├── adw_sdlc_iso.py              # Orchestrator: Full SDLC
│   ├── adw_sdlc_zte_iso.py          # Orchestrator: Zero Touch Execution
│   └── README.md                     # ADW documentation
│
├── scripts/                          # Utility scripts
│   ├── start.sh                     # Start app (backend + frontend)
│   ├── stop_apps.sh                 # Stop running apps
│   ├── copy_dot_env.sh              # Copy .env to worktrees
│   ├── purge_tree.sh                # Remove worktrees
│   ├── check_ports.sh               # Check port availability
│   ├── reset_db.sh                  # Reset database (project-specific)
│   ├── expose_webhook.sh            # Cloudflare tunnel setup (optional)
│   └── kill_trigger_webhook.sh      # Stop webhook server
│
├── .env.sample                       # Environment template
├── .gitignore                        # Git ignore patterns
├── .mcp.json.sample                  # MCP server config (optional)
├── README.md                         # Project documentation
└── playwright-mcp-config.json        # Playwright MCP config (optional)

# Auto-generated directories (gitignored)
├── agents/                           # Agent outputs and state
│   └── <adw_id>/
│       ├── adw_state.json           # Persistent workflow state
│       ├── ports.json               # Port allocation (never in the worktree)
│       ├── <adw_id>_plan_spec.md    # Generated plan
│       └── <agent_name>/
│           └── raw_output.jsonl     # Claude Code session logs
│
├── trees/                            # Isolated worktrees
│   └── <adw_id>/                    # Complete repo copy per workflow
│       ├── .git/                    # Worktree git link
│       └── ...                      # Full repo structure (no harness files)
│
├── logs/                             # Hook logs (optional)
└── app_docs/                         # Generated documentation
    └── feature-<adw_id>-*.md
```

### Critical Files Explained

#### 1. `.env` (Root-level Configuration)

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# Optional - GitHub authentication
# If not set, uses 'gh auth login' credentials
GITHUB_PAT=ghp_xxxxxxxxxxxx

# Optional - Claude Code CLI path
# If 'claude' doesn't work, run 'which claude' and paste here
CLAUDE_CODE_PATH=claude

# Optional - Cloudflare R2 for screenshot uploads
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_DOMAIN=

# Optional - E2B sandbox (advanced)
E2B_API_KEY=

# Optional - Cloudflare tunnel for webhooks
CLOUDFLARED_TUNNEL_TOKEN=

# Optional - Maintain project root in bash commands
CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=true
```

#### 2. `.claude/settings.json` (Claude Code Configuration)

```json
{
  "permissions": {
    "allow": [
      "Bash(mkdir:*)",
      "Bash(uv:*)",
      "Bash(mv:*)",
      "Bash(cp:*)",
      "Write",
      "Bash(./scripts/copy_dot_env.sh:*)"
    ],
    "deny": [
      "Bash(git push --force:*)",
      "Bash(git push -f:*)",
      "Bash(rm -rf:*)"
    ]
  },
  "hooks": {
    "PreToolUse": [...],
    "PostToolUse": [...],
    "Notification": [...],
    "Stop": [...],
    "SubagentStop": [...],
    "PreCompact": [...],
    "UserPromptSubmit": [...]
  }
}
```

#### 3. `.gitignore` (Important Exclusions)

```gitignore
# Environment
.env
.ports.env   # legacy — current harness keeps ports out of the tree entirely

# Auto-generated ADW directories
agents/
trees/
logs/

# Database
*.db
*.sqlite

# Node/Python
node_modules/
__pycache__/
.venv/
```

#### 4. `adws/adw_modules/data_types.py` (State Schema)

```python
from pydantic import BaseModel
from typing import Optional

class ADWState(BaseModel):
    adw_id: str
    issue_number: str
    branch_name: Optional[str] = None
    plan_file: Optional[str] = None
    issue_class: Optional[str] = None
    worktree_path: Optional[str] = None
    backend_port: Optional[int] = None
    frontend_port: Optional[int] = None
    model_set: str = "base"  # "base" or "heavy"
```

---

## Prerequisites & Dependencies

### System Requirements

1. **Operating System**: macOS, Linux, or Windows (WSL recommended)
2. **Python**: 3.10+
3. **Node.js**: 18+
4. **Git**: 2.30+

### Required Tools

```bash
# 1. GitHub CLI
brew install gh              # macOS
# sudo apt install gh        # Ubuntu/Debian
# winget install --id GitHub.cli  # Windows

# Authenticate
gh auth login

# 2. Claude Code CLI
# Install from: https://docs.anthropic.com/en/docs/claude-code
npm install -g @anthropic-ai/claude-code
# or download binary

# 3. Python Package Manager (uv)
curl -LsSf https://astral.sh/uv/install.sh | sh  # macOS/Linux
# powershell -c "irm https://astral.sh/uv/install.ps1 | iex"  # Windows

# 4. Bun (or npm/yarn/pnpm) - for frontend builds
curl -fsSL https://bun.sh/install | bash
```

### Python Dependencies

The ADW system uses inline script dependencies via PEP 723 (`uv run`):

```python
# /// script
# dependencies = [
#   "python-dotenv",
#   "pydantic",
#   "requests",  # for GitHub API
# ]
# ///
```

No separate `requirements.txt` needed - `uv` manages dependencies automatically.

### Optional Dependencies

```bash
# Cloudflare Tunnel (for webhook exposure)
brew install cloudflared

# Playwright MCP Server (for review screenshots)
# Configured in .mcp.json
```

---

## Setup Instructions

### Step 1: Copy Files to New Project

```bash
# Create new project
mkdir my-new-project
cd my-new-project
git init

# Copy the ADW system from this repo (template_claude/ holds the Claude Code
# commands that go in your project's .claude/ directory)
cp -r /path/to/this/repo/template_claude ./.claude
cp -r /path/to/this/repo/adws ./
cp /path/to/this/repo/.env.sample ./
cp /path/to/this/repo/.gitignore ./
```

### Step 2: Configure Environment

```bash
# 1. Create .env from sample
cp .env.sample .env

# 2. Edit .env and add your API key
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env

# 3. Verify Claude Code path
which claude
# Add to .env if needed:
# CLAUDE_CODE_PATH=/path/to/claude

# 4. Set GitHub repository URL (for triggers)
# Optional - only needed for webhook/cron triggers
echo "GITHUB_REPO_URL=https://github.com/owner/repo" >> .env
```

### Step 3: Customize Slash Commands

Edit `.claude/commands/*.md` to match your project:

```bash
# Example: Customize test command for your test framework
vim .claude/commands/test.md

# Example: Customize prepare_app for your app startup
vim .claude/commands/prepare_app.md
```

**Key commands to customize:**
- `prepare_app.md` - How to start your application
- `test.md` - How to run your tests
- `install_worktree.md` - Dependencies to install in worktrees
- `review.md` - What to check during review

### Step 4: Customize Scripts

Edit `scripts/*.sh` to match your project:

```bash
# Example: Update start.sh for your tech stack
vim scripts/start.sh

# Example: Update reset_db.sh for your database
vim scripts/reset_db.sh
```

### Step 5: Create Initial Directories

```bash
# Create gitignored directories (optional - auto-created)
mkdir -p agents trees logs app_docs

# Create trees README to keep directory in git
echo "# Git worktrees created here" > trees/README.md
```

### Step 6: Verify Setup

```bash
# Check all prerequisites
gh --version
claude --version
uv --version

# Verify GitHub authentication
gh auth status

# Test Claude Code
echo "test" | claude --help
```

---

## Workflow Execution Flow

### Manual Execution (Recommended for Testing)

```bash
# 1. Create a GitHub issue in your repository
# Issue #123: "Add dark mode toggle"

# 2. Run ADW workflow
cd adws/

# Simple plan + build
uv run adw_plan_build_iso.py 123

# Full SDLC (plan → build → test → review → document)
uv run adw_sdlc_iso.py 123

# With flags
uv run adw_sdlc_iso.py 123 --skip-e2e --skip-resolution

# Zero Touch Execution (auto-merges!)
uv run adw_sdlc_zte_iso.py 123
```

### Individual Phase Execution

```bash
# Entry points (create worktrees)
uv run adw_plan_iso.py 123           # Creates worktree + plan
uv run adw_patch_iso.py 123          # Creates worktree + quick patch

# Dependent phases (require ADW ID from entry point)
uv run adw_build_iso.py 123 abc12345
uv run adw_test_iso.py 123 abc12345
uv run adw_review_iso.py 123 abc12345 --skip-resolution
uv run adw_document_iso.py 123 abc12345
uv run adw_ship_iso.py 123 abc12345
```

### Automated Triggers

#### Cron Polling (Every 20 seconds)

```bash
cd adws/
uv run adw_triggers/trigger_cron.py
```

**Triggers on:**
- New issues with no comments
- Any issue where latest comment is exactly "adw"

#### Webhook Server (Real-time)

```bash
cd adws/
uv run adw_triggers/trigger_webhook.py
```

**Configure in GitHub:**
1. Go to repo Settings → Webhooks → Add webhook
2. Payload URL: `https://your-domain.com/gh-webhook`
3. Content type: `application/json`
4. Events: Issues, Issue comments
5. Secret: Set `GITHUB_WEBHOOK_SECRET` in `.env`

**Expose local webhook (development):**
```bash
# Using Cloudflare Tunnel
./scripts/expose_webhook.sh

# Or using ngrok
ngrok http 8001
```

---

## Testing the Setup

### Test 1: Manual Workflow Execution

```bash
# 1. Create test issue on GitHub
gh issue create --title "Test ADW Setup" --body "This is a test issue to verify ADW setup"

# 2. Get issue number (e.g., #456)
gh issue list

# 3. Run simple workflow
cd adws/
uv run adw_plan_build_iso.py 456

# 4. Verify outputs
ls -la ../agents/*/  # Check state files
ls -la ../trees/     # Check worktrees
git worktree list    # Verify worktree registration
gh pr list           # Check PR created
```

### Test 2: State Persistence

```bash
# 1. Run plan phase
uv run adw_plan_iso.py 456

# 2. Check state
cat ../agents/*/adw_state.json | jq .

# Expected output:
# {
#   "adw_id": "abc12345",
#   "issue_number": "456",
#   "branch_name": "feat-456-abc12345-test-adw-setup",
#   "worktree_path": "/full/path/to/trees/abc12345",
#   "backend_port": 9107,
#   "frontend_port": 9207,
#   "plan_file": "agents/abc12345/abc12345_plan_spec.md",
#   "issue_class": "/feature"
# }

# 3. Run build phase with ADW ID
uv run adw_build_iso.py 456 abc12345

# 4. Verify it used same state
cat ../agents/abc12345/adw_state.json | jq .
```

### Test 3: Worktree Isolation

```bash
# 1. Run two workflows in parallel
cd adws/
uv run adw_plan_iso.py 456 &
uv run adw_plan_iso.py 457 &
wait

# 2. Verify separate worktrees
git worktree list
# Should show:
# trees/abc12345  [feat-456-...]
# trees/def67890  [feat-457-...]

# 3. Verify different ports (allocations live in the harness state dir)
cat agents/*/ports.json
# Should show different backend_port and frontend_port values
```

### Parallel & multi-repo runners

The local Travis SDLC exposes the same isolation as the trigger flow plus two
fan-out runners (see the "Parallel & multi-repo execution" section of the root
`README.md` for full detail):

```bash
# Isolate a single run in its own worktree (branch adw/<id> + isolated ports)
uv run adws/travis/travis_sdlc.py "Add feature X" --worktree --working-dir ~/code/app

# N features at once against one repo, each worktree-isolated
uv run adws/travis/travis_fanout.py "Feature A" "Feature B" --working-dir ~/code/app

# One ticket across many repos via a JSON manifest (see repos.json.sample)
uv run adws/travis/travis_multirepo.py "Cross-cutting ticket" --manifest repos.json
```

Targets must be standalone git repo roots (the bundled `evals/target_*` are harness
subdirs — copy out + `git init` first). Concurrency is capped at the 15-slot port
range.

### Test 4: Cleanup

```bash
# 1. Remove worktree
./scripts/purge_tree.sh abc12345

# 2. Verify removal
git worktree list
ls -la ../trees/

# 3. Optional: Clean state
rm -rf ../agents/abc12345/
```

---

## Troubleshooting

### Common Issues

#### 1. "No module named 'adw_modules'"

**Cause**: Running from wrong directory

**Solution**:
```bash
cd adws/
uv run adw_plan_iso.py 123
```

#### 2. "ANTHROPIC_API_KEY not set"

**Cause**: Missing or incorrect `.env` file

**Solution**:
```bash
# Check .env exists in project root
ls -la .env

# Verify key is set
cat .env | grep ANTHROPIC_API_KEY

# Add if missing
echo "ANTHROPIC_API_KEY=sk-ant-your-key" >> .env
```

#### 3. "gh: command not found"

**Cause**: GitHub CLI not installed

**Solution**:
```bash
# macOS
brew install gh

# Ubuntu/Debian
sudo apt install gh

# Authenticate
gh auth login
```

#### 4. "claude: command not found"

**Cause**: Claude Code CLI not installed or not in PATH

**Solution**:
```bash
# Find Claude Code
which claude

# If found, add to .env
echo "CLAUDE_CODE_PATH=/full/path/to/claude" >> .env

# If not found, install from:
# https://docs.anthropic.com/en/docs/claude-code
```

#### 5. "Worktree validation failed"

**Cause**: Worktree out of sync between git and filesystem

**Solution**:
```bash
# List worktrees
git worktree list

# Prune invalid worktrees
git worktree prune

# Manually remove directory if needed
rm -rf trees/<adw_id>
```

#### 6. "Port already in use"

**Cause**: Previous app instance still running

**Solution**:
```bash
# Check what's using the port
lsof -i :9107

# Kill process
kill -9 <PID>

# Or use stop script
./scripts/stop_apps.sh
```

#### 7. "Failed to create PR"

**Cause**: GitHub authentication issues

**Solution**:
```bash
# Check auth status
gh auth status

# Re-authenticate
gh auth login

# Check token scopes (needs 'repo' and 'workflow')
gh auth status | grep scopes
```

#### 8. Hook execution errors

**Cause**: Missing Python dependencies for hooks

**Solution**:
```bash
# Install hook dependencies
cd .claude/hooks
uv sync

# Or disable hooks temporarily
# Edit .claude/settings.json and remove hooks section
```

### Debug Mode

```bash
# Enable verbose logging
export ADW_DEBUG=true

# Run workflow
cd adws/
uv run adw_plan_iso.py 123

# Check agent output
cat ../agents/*/planner/raw_output.jsonl | jq .
```

### Validation Checklist

Before running ADW, verify:

- [ ] `.env` exists with `ANTHROPIC_API_KEY`
- [ ] `gh auth status` shows authenticated
- [ ] `claude --version` works
- [ ] `uv --version` works
- [ ] GitHub issue exists and is accessible
- [ ] Project is a git repository
- [ ] No uncommitted changes in main repo (optional but recommended)

### Getting Help

If issues persist:

1. Check agent logs: `cat agents/<adw_id>/<agent_name>/raw_output.jsonl | tail -20 | jq .`
2. Check state: `cat agents/<adw_id>/adw_state.json | jq .`
3. Verify worktree: `git worktree list`
4. Check ports: `./scripts/check_ports.sh`
5. Review GitHub API calls: `gh api rate-limit`

---

## Advanced Configuration

### Model Selection

Specify model set in issue body:

```
Title: Complex refactoring task
Body: Refactor authentication system
model_set heavy
```

**Model mapping** (in `adw_modules/agent.py`):
- `base`: Uses Sonnet (faster, cheaper)
- `heavy`: Uses Opus for complex commands (slower, more capable)

### Webhook Security

```bash
# Generate webhook secret
openssl rand -hex 32

# Add to .env
echo "GITHUB_WEBHOOK_SECRET=<generated_secret>" >> .env

# Configure in GitHub webhook settings
```

### Cloudflare R2 Screenshot Uploads

```bash
# Add to .env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET_NAME=adw-screenshots
CLOUDFLARE_R2_PUBLIC_DOMAIN=https://screenshots.example.com
```

---

## Summary

### Minimum Required Files

1. **`.env`** - API keys and configuration
2. **`.claude/settings.json`** - Claude Code configuration
3. **`.claude/commands/*.md`** - Slash command definitions (18+ files)
4. **`adws/adw_modules/*.py`** - Core modules (10 files)
5. **`adws/adw_*.py`** - Workflow scripts (14 files)
6. **`adws/adw_triggers/*.py`** - Trigger scripts (2 files)
7. **`scripts/*.sh`** - Utility scripts (8+ files)
8. **`.gitignore`** - Exclude generated files

### Quick Start Commands

```bash
# 1. Copy files
cp -r /path/to/this/repo/template_claude ./.claude
cp -r /path/to/this/repo/{adws,.env.sample,.gitignore} ./

# 2. Configure
cp .env.sample .env
vim .env  # Add ANTHROPIC_API_KEY

# 3. Test
cd adws/
uv run adw_plan_build_iso.py <issue-number>
```

### Next Steps

1. Customize slash commands for your project
2. Update `scripts/` for your tech stack
3. Create a test GitHub issue
4. Run your first workflow
5. Set up webhooks for automation

---

**Questions or Issues?** Check the troubleshooting section or review agent logs in `agents/<adw_id>/*/raw_output.jsonl`.
