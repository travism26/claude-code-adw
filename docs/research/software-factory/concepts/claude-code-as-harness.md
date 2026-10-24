# Claude Code as the harness

**Date:** 2026-10-24. **Method:** official docs at code.claude.com, fetched 2026-10-24; local build `claude` 2.1.310. **Question:** can Claude Code itself (skills, subagents, hooks, loops, headless, cloud) serve as the autonomous-dev harness, with no external orchestrator?

## Capability table

| Capability | Supported? | How | Limit | Source |
|---|---|---|---|---|
| Subagent nesting | Yes | Default 3 layers below main; `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` | At the limit the Agent tool is withheld (except forks) | [sub-agents](https://code.claude.com/docs/en/sub-agents.md) |
| Custom agent restrictions | Yes | `.claude/agents/*.md`: `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `isolation`, `background`, `hooks`, `effort` | `permissionMode` ignored for plugin agents; parent bypass/auto/acceptEdits overrides it | sub-agents |
| Background subagents | Yes | Concurrent; completion notification to parent; Ctrl+B | Smaller tool set; whether a parent waits for nested children depends on fork mode | sub-agents |
| Agent teams | Experimental | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; peers via SendMessage; shared task list | Interactive only (not `-p`/SDK); one team per session; no nesting; not restored on `/resume` | [agent-teams](https://code.claude.com/docs/en/agent-teams.md) |
| Workflow scripts | Yes | JS script: `agent()`, `parallel()`, `pipeline()`, `phase()`; saved under `.claude/workflows/` and run as `/<name>` | 16 concurrent (configurable to 256), 1,000 agents/run, no mid-run user input, no shell from the script; `-p` needs a Workflow allow rule; resume replays completed agents | [workflows](https://code.claude.com/docs/en/workflows.md) |
| Worktree sessions | Yes | `claude -w <name>`; EnterWorktree/ExitWorktree tools | Paths outside `.claude/worktrees/` prompt for approval | [worktrees](https://code.claude.com/docs/en/worktrees.md) |
| Subagent worktree isolation | Yes | `isolation: worktree`; edits into the main checkout are blocked | Auto-removed only if unchanged; worktree-root CLAUDE.md and rules not loaded in the default location; `-p` runs don't clean up | worktrees |
| Stop/SubagentStop forces continuation | Yes | Exit 2 or `decision: "block"` | Overridden after 8 consecutive blocks with no tool call (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`) | [hooks](https://code.claude.com/docs/en/hooks.md) |
| PreToolUse blocking | Yes | Exit 2 or `permissionDecision: deny` | PostToolUse can't undo a tool that already ran | hooks |
| Agent identity in hooks | Yes | `agent_id`, `agent_type` in hook input inside a subagent | Exact SubagentStop schema unverified | hooks |
| `/loop` | Yes | Fixed interval or self-paced, inside an open session | Session must be open and idle (a backgrounded session counts); 7-day expiry; 50 tasks; self-paced loops not restored on resume | [scheduled-tasks](https://code.claude.com/docs/en/scheduled-tasks.md) |
| `/schedule` cloud tasks | Research preview | Anthropic cloud; triggers: schedule (min 1 h), API `/fire`, GitHub PR/release events | claude.ai login (Pro/Max/Team/Ent); pushes to `claude/` branches; 100 runs/hour/account | [routines](https://code.claude.com/docs/en/routines.md) |
| `/goal` | Yes | Condition re-judged after each turn by a small model | Evaluator has **no tools** and reads only the transcript, so it can't be the gate | [goal](https://code.claude.com/docs/en/goal.md) |
| Headless budget cap | Yes | `--max-budget-usd` (confirmed in local `--help`) | Client-side estimate | [cli-reference](https://code.claude.com/docs/en/cli-reference.md) |
| Headless turn cap | Docs say yes | `--max-turns` | Missing from local `--help` 2.1.310; verify on your build. Agent `maxTurns` frontmatter is the alternative | cli-reference |
| Headless permissions and output | Yes | `--permission-mode`, `--allowedTools`, `--permission-prompts none`, `--output-format stream-json`, `--resume`, `--bare` | `--bare` needs an API key | [headless](https://code.claude.com/docs/en/headless.md) |
| Agent SDK | Yes | Python/TS library running the same harness | Self-hosted; API-key auth | [agent-sdk](https://code.claude.com/docs/en/agent-sdk/overview.md) |
| Personal plugin + marketplace | Yes | `.claude-plugin/marketplace.json` in a GitHub repo; `/plugin marketplace add owner/repo`; bundles skills, agents, hooks, MCP, workflows | Auto-update off for third-party marketplaces by default; cloud sessions don't load local plugins unless repo config enables them | [create-marketplace](https://code.claude.com/docs/en/plugins/create-marketplace.md) |
| Cloud sessions (laptop closed) | Yes | claude.ai/code or `claude --cloud "<task>"`; `--teleport` pulls back | Shared rate limits; on environment expiry background shells, subagents and loops are lost; wall-clock limit unverified | [claude-code-on-the-web](https://code.claude.com/docs/en/claude-code-on-the-web.md) |
| PR creation and auto-fix | Yes | Claude GitHub App; `/autofix-pr` reacts to CI failures and review comments | No reaction to base-branch conflicts | claude-code-on-the-web |
| GitHub Actions | Yes | `anthropics/claude-code-action@v1` on any event, including cron | CI minutes plus API key or OAuth token | [github-actions](https://code.claude.com/docs/en/github-actions.md) |
| Built-in `/verify` | Yes | Builds and runs the app "without falling back to tests or type checks" | Manual only; scheduled tasks don't run it | [skills](https://code.claude.com/docs/en/skills.md) |
| Built-in `/code-review` | Yes | Background subagent; `--fix`, `--comment`; `ultra` for cloud review | — | [code-review-local](https://code.claude.com/docs/en/code-review-local.md) |
| Managed Code Review | Team/Enterprise | GitHub integration, inline comments | Read-only; never approves or blocks | [code-review](https://code.claude.com/docs/en/code-review.md) |

## What this means for the research

- **Supervised daytime work fits entirely inside Claude Code.** You can build the multi-tier system you described: a coordinator session, nested subagents up to 3 deep, custom read-only verifier agents (tools restricted, `agent_type` visible to guard hooks), worktree isolation, and saved workflows for fan-out.
- **Overnight is where the gaps are.**
  - `/loop` needs a live session.
  - `/goal` can't run checks.
  - Stop-hook continuation caps at 8 consecutive blocks.
  - Agent teams don't run headless.
  - Unattended options: `/schedule` cloud tasks (hourly minimum, cloud clone, `claude/` branches), GitHub Actions on cron or events, or a thin local driver looping `claude -p` with a budget cap.
- **The verdict-outside-the-agent rule still needs one deterministic component** the agent can't influence. That could be a Stop/SubagentStop hook that runs the checks, a GitHub Action, or the thin driver. It doesn't have to be a whole harness.
- **Packaging as a personal plugin is fully supported,** including workflows and hooks, so a workflow can be set up in a new repo with one install.
