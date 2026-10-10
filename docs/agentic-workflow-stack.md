# The Agentic Developer Workflow Stack

A reference for a terminal-native, voice-driven, multi-agent coding workflow assembled
from off-the-shelf tooling plus a suite of purpose-built CLIs. The big idea: you *talk*
to one agent, it dispatches a crew of autonomous agents that each work in an isolated git
worktree inside its own terminal pane, and nothing reaches your remote until local checks
pass and a PR is opened for human review.

This document explains each moving part, what problem it solves, and — more importantly —
how the parts fit together.

---

## TL;DR — the whole loop in one paragraph

You speak a task into **OpenSuperWhisper** (voice → text). It lands in an agent running
inside **WezTerm + tmux + Neovim** (your terminal foundation). That agent is the **firstmate**
"first mate" — it spawns a *crew* of autonomous agents, each in its own tmux window backed by
a clean git worktree handed out by **treehouse**. Long, unsupervised runs are driven by
**gnhf** ("good night, have fun") so agents iterate while you sleep. When an agent produces
an HTML artifact, you review and annotate it in the browser via **lavish**. Nothing reaches
`origin` until local checks pass and a PR is opened for human review.
All of these custom CLIs are built to the **AXI** ("Agent eXperience Interface") design
principles — token-efficient, non-interactive, agent-first — and are distributed/installed
through the **skills CLI** (`npx skills`).

---

## The layers

```
┌─────────────────────────────────────────────────────────────────────┐
│  INPUT            OpenSuperWhisper  (voice → text, hold-to-record)    │
├─────────────────────────────────────────────────────────────────────┤
│  TERMINAL         WezTerm  +  tmux  +  Neovim                         │
│  FOUNDATION       (GPU terminal, multiplexer/panes, editor)          │
├─────────────────────────────────────────────────────────────────────┤
│  ORCHESTRATION    firstmate  (one liaison agent → a crew)            │
│                   gnhf       (overnight autonomous loops)            │
├─────────────────────────────────────────────────────────────────────┤
│  ISOLATION        treehouse  (pool of reusable git worktrees)        │
├─────────────────────────────────────────────────────────────────────┤
│  REVIEW           lavish     (annotate HTML artifacts in browser)    │
├─────────────────────────────────────────────────────────────────────┤
│  DESIGN PHILOSOPHY   AXI      (10 principles for agent-first CLIs)    │
│  DISTRIBUTION        skills   (npx skills — install/share skills)    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Input layer

### OpenSuperWhisper — voice to text
- **Link:** https://github.com/starmel/OpenSuperWhisper
- **What it is:** A macOS dictation app (Apple Silicon) for real-time audio transcription.
- **How it works:** Hold a global keyboard shortcut to record, release to transcribe. Picks
  between **Whisper** and **Parakeet** engines (downloadable models). Supports mic selection
  (built-in / external / Bluetooth / iPhone via Continuity), multi-language auto-detection,
  and drag-and-drop of audio files.
- **Role in the stack:** The fastest way to get a rich task description into an agent. Talking
  a paragraph of intent is far quicker than typing it, which matters when you're dispatching
  many tasks to a crew. Install via Homebrew or GitHub releases.

---

## 2. Terminal foundation

These are the well-established tools the custom suite assumes you're running inside.

### WezTerm — the terminal emulator
- **Link:** https://wezterm.org/index.html
- **What it is:** A fast, GPU-accelerated, cross-platform terminal emulator and multiplexer,
  configured in Lua.
- **Role in the stack:** The window everything else lives in. Its scriptable config and
  built-in pane/tab multiplexing make it a natural host for many simultaneous agent sessions.

### tmux — the terminal multiplexer
- **Link:** https://github.com/tmux/tmux/wiki
- **What it is:** A terminal multiplexer — multiple windows/panes inside one session, with
  detach/reattach so sessions survive disconnects.
- **Role in the stack:** The substrate firstmate uses to make parallel agents *visible*. Each
  crewmate runs in its own tmux window, so you can watch them work, and the session persists
  even if your terminal closes. This is what makes the multi-agent work observable rather than
  a black box.

### Neovim — the editor
- **Link:** https://neovim.io/
- **What it is:** A hyper-extensible, terminal-based Vim-derived editor.
- **Role in the stack:** The human's editor for inspecting diffs, tweaking code by hand, and
  reviewing what the agents produced — without leaving the terminal.

> **Why terminal-native?** Keeping input (voice), orchestration (agents), isolation
> (worktrees), and editing (Neovim) all inside WezTerm/tmux means the entire workflow is one
> keyboard-driven surface, scriptable end to end, with no context-switch to a GUI.

---

## 3. Orchestration layer

### firstmate — one agent commands a crew
- **Link:** https://github.com/kunchenguid/firstmate
- **Tagline:** *"Talk to one agent. Ship with a crew."*
- **What it is:** A directory-based orchestration system. You talk to a single "first mate"
  agent; it supervises and coordinates multiple autonomous agents working in parallel.
- **How it works:**
  - Spawns *crewmate* agents, each in an isolated **tmux window**.
  - Assigns each crewmate a clean **git worktree** (conflict-free parallel work).
  - Supervises completion through an **event-driven bash watcher** (described as
    "zero-token supervision" — the watcher is plain bash, so monitoring doesn't burn model
    tokens).
  - Delivers finished pull requests, approved merges, or investigation reports back to you.
- **Two task modes:**
  - **ship** — make and deliver changes.
  - **scout** — investigate / research without shipping.
- **Project modes:** integrates with direct-PR or local-only workflows.
- **Safety:** write-protected — crew changes require your approval; state persists across
  restarts.
- **Role in the stack:** The conductor. It is the single interface you interact with, and it
  ties together tmux (visibility) and treehouse-style worktrees (isolation) into one supervised
  flow, forwarding finished work as a PR for human review.

### gnhf — "good night, have fun" (overnight autonomy)
- **Link:** https://github.com/kunchenguid/gnhf
- **Tagline:** *"Before I go to bed, I tell my agents: good night, have fun."*
- **What it is:** An orchestrator for long, unsupervised autonomous loops — set objectives and
  caps, then let agents iterate until done or capped.
- **How it works (per iteration):** build a contextual prompt (including notes from prior
  iterations) → invoke the agent non-interactively → check success → commit on success / roll
  back on failure → repeat until iteration/token caps or a stop condition.
- **Key features:**
  - One command to start; configurable **iteration and token caps**.
  - Live terminal status (tokens spent, commit count); exit summary with stats + review
    commands.
  - **Agent-agnostic** (Claude Code, Copilot CLI, Rovo Dev, etc.).
  - **Worktree mode** to run multiple agents on the same repo simultaneously.
  - **Shared memory** via a `notes.md` file for cross-iteration communication.
  - Graceful failure handling with exponential backoff on retryable errors.
- **firstmate vs. gnhf:** firstmate is *interactive* fan-out — you dispatch and supervise a
  crew in real time. gnhf is *unattended* depth — one (or several) agents grinding on a goal
  over many iterations with rollback safety. They compose: dispatch with firstmate during the
  day, hand long jobs to gnhf overnight.

---

## 4. Isolation layer

### treehouse — a pool of reusable git worktrees
- **Link:** https://github.com/kunchenguid/treehouse
- **Tagline:** *"Manage worktrees without managing worktrees."*
- **What it is:** A Go CLI that manages a **pool** of reusable git worktrees (default root
  `~/.treehouse/`), so isolated environments are cheap and dependency/build caches survive
  between sessions.
- **How it works:**
  1. Find repo root, fetch from origin.
  2. Scan the pool for an available worktree (not leased / in-use / dirty).
  3. Reset an existing one to the latest default branch, or create a new detached-HEAD
     worktree.
  4. Spawn an interactive subshell there.
  5. On exit, kill lingering processes and return the worktree to the pool for reuse.
- **Key features:** instant isolation with zero setup; reused worktrees preserve deps/build
  cache; automatic in-use detection; durable **leases** for persistent homes; safe pruning
  (verifies merged + clean); setup/teardown **hooks**; cross-platform; no daemon (all inline
  CLI).
- **Role in the stack:** The reason parallel agents don't step on each other. Both firstmate
  crewmates and gnhf's worktree mode need clean, conflict-free checkouts — treehouse hands
  them out instantly and recycles them, instead of paying the cost of fresh clones each time.

> **Why worktrees, not branches/clones?** Git worktrees give each agent a *separate working
> directory* on the *same repo*, so N agents can edit code simultaneously with no collisions —
> while sharing object storage. A pool (treehouse) keeps node_modules / build artifacts warm
> across reuses, which a fresh clone or `git worktree add`/`remove` cycle would throw away.

---

## 5. Review layer

### lavish — review HTML artifacts by annotating them
- **Link:** https://github.com/kunchenguid/lavish (distributed as `kunchenguid/lavish-axi`)
- **Tagline:** *"HTML is the new markdown. Lavish is the new editor for your HTML artifacts."*
- **What it is:** A local CLI that opens AI-generated HTML in a browser so you can give
  *targeted* feedback by clicking and annotating elements, instead of screenshots + prose.
- **How it works:** agent writes an HTML artifact → CLI opens it locally in a browser UI (the
  artifact runs in an iframe with an injected SDK) → you annotate specific elements or text
  ranges and send messages → a long-poll mechanism returns your prompts back to the agent.
  Sessions are keyed by file path.
- **Key features:** local-only (no cloud); **layout auditing** that gates an artifact until it
  renders cleanly; live reload with scroll-position preservation; element- and text-range
  feedback; keyboard shortcuts; agent-presence detection that queues feedback across reloads.
- **Usage:** `npx skills add kunchenguid/lavish-axi --skill lavish`, then `/lavish` in a
  compatible agent, or run directly with `npx lavish-axi <file>`.
- **Role in the stack:** Tightens the human-in-the-loop review of visual/HTML output — the one
  place where "just read the diff" fails. Point-and-comment feedback flows straight back to the
  agent.

---

## 6. Cross-cutting: design philosophy & distribution

### AXI — Agent eXperience Interface
- **Link:** https://axi.md/
- **What it is:** A set of **10 design principles** for building CLIs optimized for AI agents,
  treating **token budget** as a first-class constraint while keeping reliability and
  discoverability. (The custom tools above — note `lavish-axi`, `chrome-devtools-axi`,
  `gh-axi` — are built to this spec.)
- **The problem it targets:** traditional CLIs need multiple round-trips (navigate, *then*
  snapshot), and MCP tool schemas inflate context (the page cites ~185K tokens for MCP vs ~79K
  for AXI). Neither guides the agent on what to do next.
- **Principle categories:**
  - **Efficiency:** token-optimized output (TOON format), minimal default field sets, content
    truncation with hints, pre-computed aggregates (e.g. totals), explicit empty states.
  - **Robustness:** idempotent mutations, structured errors, **no interactive prompts**.
  - **Discoverability:** session-level context install, live data by default, contextual
    "next step" help suggestions, consistent `--help`.
- **Hallmarks:** specialized commands that fuse multiple operations into one call
  (navigate + extract in a single invocation), query filtering that returns only relevant
  lines instead of full page dumps, and shell composability (pipe/filter to cut tokens).
- **Reported result:** 100% task success at $0.074/task vs $0.100 for MCP, in fewer turns.
- **Role in the stack:** The "why" behind the suite. Every custom tool here is non-interactive,
  token-frugal, and self-describing *because* an agent — not a human — is the primary caller.
  This is what lets firstmate/gnhf drive them unattended.

### skills CLI — distribute and install Agent Skills
- **Link:** https://github.com/vercel-labs/skills
- **Tagline:** *"The CLI for the open agent skills ecosystem."*
- **What it is:** `npx skills` — a tool to discover, install, and manage reusable instruction
  sets ("Agent Skills") across many AI coding agents.
- **How it works:** a skill is a directory with a `SKILL.md` (YAML frontmatter: name,
  description + instructions). `npx skills add [source]` installs from GitHub/GitLab/local
  path/git URL; the tool detects installed agents and symlinks/copies skills into each agent's
  skills directory.
- **Key features:** multi-agent support (Claude Code, OpenCode, Cursor, Cline, + many more);
  flexible sourcing; `npx skills find` to discover; project-scoped or global install; update /
  remove / list.
- **With Claude Code:** `npx skills add [repo] -a claude-code`, or pipe a skill in with
  `npx skills use [skill] | claude`.
- **Role in the stack:** The package manager / delivery mechanism. It's literally how you
  install several of these tools as agent skills (e.g. `npx skills add kunchenguid/lavish-axi`),
  and how custom commands (like `/lavish`) get wired into your agent.

---

## Getting started — install order

Install bottom-up: terminal foundation first, then the agent tooling, then the orchestration
suite. Each step is independently useful, so you can stop and actually *use* the stack at any
point. (Commands verified against each project's README, June 2026 — re-check before running.)

### Step 0 — prerequisites
```bash
# Homebrew (macOS) — if you don't already have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Toolchains the custom CLIs need
brew install git gh node go        # gh = GitHub CLI, node for npx, go for treehouse-from-source
gh auth login                      # firstmate raises PRs on your behalf
```

### Step 1 — terminal foundation
```bash
brew install --cask wezterm        # GPU terminal (cask = GUI app)
brew install tmux neovim           # multiplexer + editor
```
After this, see **`docs/terminal-foundation-tutorial.md`** to get productive in each.

### Step 2 — input (voice)
```bash
brew install opensuperwhisper      # Apple Silicon only; or grab a GitHub release
```
Then open the app, download a Whisper or Parakeet model, and set a global hold-to-record
shortcut.

### Step 3 — isolation (worktree pool)
```bash
curl -fsSL https://kunchenguid.github.io/treehouse/install.sh | sh   # or: go install github.com/kunchenguid/treehouse@latest
cd <your-repo> && treehouse init   # writes treehouse.toml with sensible defaults
```

### Step 4 — overnight autonomy
```bash
npm install -g gnhf
# usage: gnhf "reduce complexity without changing behavior" --max-iterations 10 --max-tokens 5000000
```

### Step 5 — artifact review (as a skill, zero install)
```bash
npx skills add kunchenguid/lavish-axi --skill lavish
# optional global hooks: npm install -g lavish-axi && lavish-axi setup hooks
```

### Step 6 — orchestration (the conductor, last)
```bash
gh auth login                      # if not already done
git clone https://github.com/kunchenguid/firstmate
cd firstmate && claude             # launch your agent FROM INSIDE tmux so crew windows land in your session
```
firstmate detects and offers to install anything else it needs, and ties together tmux
(visibility) and treehouse-style worktrees (isolation).

> **Why this order?** Each layer depends on the ones beneath it: orchestration (firstmate/gnhf)
> assumes worktrees (treehouse) exist, which assume a working terminal (WezTerm/tmux). Voice
> (OpenSuperWhisper) and review (lavish) slot in independently.

---

## How a single task flows through the stack

1. **Speak it.** Hold the OpenSuperWhisper shortcut, describe the task; text drops into your
   agent in WezTerm/tmux.
2. **Dispatch.** firstmate (the first mate) reads the intent and decides: one crewmate or
   several? ship or scout?
3. **Isolate.** Each crewmate gets a clean worktree from treehouse and its own tmux window —
   you can watch them all at once.
4. **Work.** Crewmates code. For long/unattended jobs, gnhf loops them with caps, rollback,
   and a shared `notes.md`.
5. **Review.** Visual/HTML output opens in lavish; you click-annotate and the feedback returns
   to the agent. Code you eyeball in Neovim.
6. **Gate.** Local checks (tests + lint) run before pushing to `origin`; the assistant fixes
   what it can and escalates the rest for human review.
7. **Ship.** Only validated work pushes to the remote and opens a PR for human review.

Underpinning all of it: every custom CLI follows **AXI** (so agents drive them cheaply and
reliably), and they're installed/shared through the **skills CLI**.

---

## Quick reference

| Tool | Layer | One-liner | Link |
|------|-------|-----------|------|
| OpenSuperWhisper | Input | Voice → text dictation (macOS, hold-to-record) | https://github.com/starmel/OpenSuperWhisper |
| WezTerm | Terminal | GPU terminal + multiplexer, Lua-configured | https://wezterm.org/index.html |
| tmux | Terminal | Multiplexer; windows/panes, detach/reattach | https://github.com/tmux/tmux/wiki |
| Neovim | Terminal | Extensible terminal editor | https://neovim.io/ |
| firstmate | Orchestration | One liaison agent supervises a parallel crew | https://github.com/kunchenguid/firstmate |
| gnhf | Orchestration | Overnight autonomous iteration loops | https://github.com/kunchenguid/gnhf |
| treehouse | Isolation | Reusable pool of git worktrees | https://github.com/kunchenguid/treehouse |
| lavish | Review | Annotate AI-generated HTML in the browser | https://github.com/kunchenguid/lavish |
| AXI | Philosophy | 10 principles for token-efficient agent CLIs | https://axi.md/ |
| skills CLI | Distribution | Install/share Agent Skills across agents | https://github.com/vercel-labs/skills |

---

## Notes & caveats

- **Source attribution:** treehouse, firstmate, gnhf, and lavish are all by the
  same author (`kunchenguid`) and form a deliberately cohesive suite built on the AXI spec —
  which is why they share conventions (worktree isolation, agent-agnostic, `/command` hooks,
  zero-token bash supervision).
- **macOS lean:** OpenSuperWhisper is Apple-Silicon-only; the rest are cross-platform
  (treehouse explicitly so).
- **Agent-agnostic by design:** firstmate and gnhf both claim support for multiple
  coding agents (Claude Code, Codex/Copilot CLI, Rovo Dev, etc.), so this stack isn't locked to
  one vendor.
- **Verify before adopting:** descriptions here were drawn from each project's README/landing
  page (June 2026). Pin versions and re-check the repos before wiring anything into your own
  workflow, since these are fast-moving solo projects.
