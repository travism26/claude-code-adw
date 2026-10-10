# claude-code-adw — Agentic Developer Workflow for Claude Code

A general-purpose agentic developer workflow harness for Claude Code, structured
as **templates + install command** so it can be dropped into any project.

Everything runs with `uv run` — no global Python environment required; each script
declares its dependencies inline (PEP 723).

## Concepts & glossary

This harness has its own vocabulary. If a term below is unfamiliar, this is the
canonical one-line definition.

**Workflow core**
- **ADW (Agentic Developer Workflow)** — this harness: the scripts under `adws/`
  that drive Claude Code through a software task end-to-end.
- **Harness** — the orchestration *around* the LLM (prompts, phases, parsing,
  retries, gates). A "harness change" changes *how the agent works*, not your app.
- **Phase / SDLC pipeline** — the ordered steps in a full run: research → plan →
  build → validate → test → review → document. Each is a separate agent call and
  can also run standalone.
- **adw_id** — the short id for one run; all of its artifacts live under
  `agents/{adw_id}/` (raw transcripts, parsed output, state, logs).
- **Planner** — the swappable component that turns a request into a spec/plan
  (`travis` | `openspec` | …). See `PLANNER_CONTRACT.md`.
- **Best-of-N** — run N build attempts in parallel, score each, apply the best
  (`--attempts N`).
- **Worktree isolation** — run the whole pipeline inside an isolated git worktree
  of the target (own branch/ports/tree) so parallel runs don't collide
  (`--worktree`). Foundation for fan-out and multi-repo.
- **Fan-out** — run N feature pipelines at once against one repo, each
  worktree-isolated (`travis_fanout.py`).
- **Multi-repo** — drive one ticket across many repos via a `repos.json` manifest,
  each repo running its own SDLC in its own worktree (`travis_multirepo.py`).
- **Risk gate** — a deny-list hook that blocks destructive commands on unattended
  runs (`--risk-gate`).
- **Spec-review gate** — an opt-in checkpoint between plan and build
  (`--review-spec`): `human` pauses so you review/edit the spec, then `--resume`
  continues into build; `auto` runs an inline LLM spec-critic (no pause). Off by
  default.
- **Draft-PR loop** — opens a draft PR, commits per phase, marks it ready only on
  success (`--draft-pr`). Never auto-merges.

**Memory** (see the dedicated section below)
- **Project memory** — durable, per-codebase knowledge (conventions, lessons,
  pitfalls) stored as markdown in the target's `ai_docs/memory/`.
- **Dreaming** — the consolidation step: one LLM call reads a run's artifacts and
  rewrites the memory store, folding in new lessons (`--dream`). Named for the
  "sleep and consolidate" metaphor.
- **Recall / injection** — at run time the memory store is compiled into one doc
  and appended to the agent's system prompt. No search/retrieval — the whole
  (size-budgeted) store goes in.

**Evals**
- **Eval / eval-driven development** — measuring whether a harness change is good
  or bad by scoring it against a fixed benchmark, instead of eyeballing. Open-ended
  coding can't be unit-tested, so we grade it on real tasks.
- **Target** — the codebase a task runs against, *vendored* (copied + frozen) into
  `evals/` so scores stay comparable over time: `target_app` (tier 1, tiny) and
  `target_backend` (tier 2, realistic).
- **Task** — one benchmark item (`evals/tasks/NN-*.yaml`): a prompt plus the oracle
  that grades the result.
- **Oracle / acceptance checks** — the deterministic "what correct looks like":
  shell commands that must exit 0.
- **Variant** — a labeled configuration under test (a planner, a flag, a branch);
  you A/B two variants on the same tasks.
- **Trial** — one run of a task. Agents are non-deterministic, so each task runs N
  times (default 3).
- **Grader** — scores a trial. **Code graders** are deterministic (tests pass,
  acceptance, cost, diff size); the **LLM judge** scores quality (spec /
  implementation, 0–5).
- **pass@k / pass^k** — reliability over k trials. **pass@k** = solved ≥1 of k
  (capability ceiling); **pass^k** = solved *all* k (reliability). A mean hides
  flakiness; these expose it.
- **Saturation** — when the suite is too easy and every variant scores about the
  same, so it can't tell a good change from a bad one. Fixed by adding harder tasks.
- **Baseline / snapshot** — a pinned set of scores you measure future changes
  against (`evals/baselines/`).
- **Capture loops** — turning real failures into permanent guards. **Fixture
  capture** (`/capture_fixture`, `--auto-capture`) guards the *harness* itself
  (→ `tests/regression/`); **eval-task capture** (`/capture_eval_task`) grows the
  *benchmark* (→ `evals/tasks/`).

## Layout

```
adws/                       # The harness (copy this into target projects)
├── adw_modules/            # Core: agent execution, state, git/worktree ops, GitHub,
│                           #   intelligent test selection, fixture capture, data types
├── travis/                 # Local SDLC pipeline: research → plan → build → validate
│                           #   → test → review → document (each phase standalone too)
│   ├── planners.py         # Swappable planner registry (travis | openspec | ...)
│   ├── PLANNER_CONTRACT.md # How to add a planner (Spec Kit, BMAD, ...)
│   ├── travis_dream.py     # "Dreaming": consolidate run transcripts → memory
│   └── MEMORY_CONTRACT.md  # Memory store format, injection, dreaming rules
├── adw_*.py                # Single-shot entry points (prompt, slash command,
│                           #   chore/feature implement, plan-build-test-review)
├── adw_triggers/           # Webhook + cron invocation
└── adw_tests/              # Harness self-tests

template_claude/            # Slash-command templates with {{PLACEHOLDER}} tokens
└── commands/               # /implement /test /validate /review /document /research
    └── opsx/               #   ... plus OpenSpec planner commands (propose/apply/...)

evals/                      # Measure whether harness changes are good or bad
├── target_app/             # Tier-1 benchmark codebase (tiny notes CLI + pytest)
├── target_backend/         # Tier-2 benchmark codebase (frozen Express/TS backend)
├── tasks/                  # 14 benchmark tasks, 2 tiers (grows via /capture_eval_task)
├── capture_eval_task.py    # Mint a new task from a real failure
├── run_eval.py             # Run tasks N times per variant against clean copies
├── graders.py              # Code graders + memoized LLM judge (cost itemized)
├── compare.py              # A/B scorecard: mean±spread, pass@k/pass^k, deltas, heat-map
└── EVAL_PRACTICES.md       # Which industry eval practices we adopt / ignore, and why
```

## Install into a project

```bash
# 1. Copy the harness and command templates
cp -R /path/to/this/repo/adws            <your-project>/adws
mkdir -p <your-project>/.claude/commands
cp -R /path/to/this/repo/template_claude/commands/. <your-project>/.claude/commands/

# 2. Configure environment
cp .env.sample <your-project>/.env       # set CLAUDE_CODE_PATH at minimum

# 3. In Claude Code, run once — detects language/test/lint tooling and fills
#    every {{PLACEHOLDER}} in .claude/commands/
/install-adw
```

Also customize the per-project config block at the top of
`adws/adw_modules/test_selector.py` (full-suite command, core files, module → test
mappings).

## Usage

```bash
# Adhoc prompt
uv run adws/adw_prompt.py "Explain this codebase" --model sonnet

# Single slash command
uv run adws/adw_slash_command.py /chore "Rename config module"

# Full local SDLC (research → plan → build → validate → test → review → document)
uv run adws/travis/travis_sdlc.py "Add user export feature" --plan-type feature

# Swappable spec generator: use OpenSpec for the research+plan phases
uv run adws/travis/travis_sdlc.py "Add user export feature" --planner openspec

# Run against a different project than the harness repo
uv run adws/travis/travis_sdlc.py "Fix the login bug" --working-dir ~/code/other_project

# Memory: research/plan/build automatically consult <project>/ai_docs/memory/
# when it exists (--no-memory to suppress). Consolidate lessons after runs:
uv run adws/travis/travis_sdlc.py "Add export" --working-dir ~/code/proj --dream
uv run adws/travis/travis_dream.py --working-dir ~/code/proj --last 5
```

Every run writes auditable artifacts to `agents/{adw_id}/` — raw JSONL transcripts,
parsed responses, state, and per-phase logs.

**Follow a run live** (every agent tees human one-liners off its stream-json
output — tool calls, errors, cost — with a heartbeat when quiet >30s):

```bash
tail -F agents/latest-progress.log   # symlink to the current run's progress.log
```

Disable with `ADW_NO_PROGRESS_LOG=1`.

**Live TUI** (`--tui`, or `ADW_TUI=1`): a split-pane view that fuses both of the
above into one screen — a **Pipeline** column with per-phase `✓ / spinner / ○`
status and elapsed time, beside a **Log** pane tailing `progress.log` live:

```bash
uv run adws/travis/travis_sdlc.py "Add user export feature" --tui
```

It's a pure view over data the run already produces (phase state + `progress.log`),
so it adds no new sources. Auto-disables on a non-TTY (CI, webhook/cron triggers)
and falls back to the plain phase prints; `--no-tui` forces it off. While the TUI
is active, raw phase-subprocess output is captured to `agents/{adw_id}/sdlc_console.log`
so nothing is lost.

**Best-of-N build** (`--attempts N`): run N build trajectories from the shared
plan in isolated git worktrees, score each candidate with a hybrid verifier
(the project's tests as the execution signal + an LLM judge on the diff vs the
spec — complementary signals, per the R2E-Gym result), and apply the winner's
diff to the working tree. `--test-command "uv run pytest -q"` supplies the
execution signal; without it, selection is judge-only. Loser transcripts and
the full scorecard are kept at `agents/{adw_id}/bestof/`. Requires the target
to be a git repo with a commit; N=1 (default) keeps the normal single build.

**Spec-review gate** (`--review-spec[=human|auto]`, or `ADW_REVIEW_SPEC`): an
opt-in checkpoint between plan and build so a flawed spec is caught before build
spends tokens. Off by default. `human` (the default mode) pauses after a
successful plan — it writes an `agents/{adw_id}/spec_review.json` pointer with a
`--resume` command; you read (and if needed edit) the spec, then re-run with
`--resume` (re-passing the same flags) to continue into build. `auto` runs an
inline LLM spec-critic instead of pausing — `approve`/`revise` continue (revise
edits the spec in place), `reject` (or any reviewer/parse error) fails closed so
an unreviewed spec never reaches build. The verdict is recorded in
`travis_state.json`'s `spec_review` block. See `adws/adw_modules/spec_reviewer.py`
and `docs/spec-review-gate-plan.md`.

**Draft-PR loop** (`--draft-pr`, auto-enabled by triggers): opens a branch
`adw/<id>` and a **draft** PR up front, pushes an incremental commit after
each phase with a live progress checklist in the PR body, and marks the PR
ready for review only on success (left draft on failure — **never
auto-merged**, approval is the human's). This is the human-gated, reviewable
surface for autonomous runs. With no GitHub remote it degrades to a local
branch with per-phase commits (reviewable via `git log`/`git diff`). See
`adws/adw_modules/draft_pr.py`.

**Risk gate for unattended runs**: webhook/cron-triggered workflows (and any
run with `--risk-gate` or `ADW_RISK_GATE=1`) inject a PreToolUse deny hook —
high-precision patterns for destructive git (force push, remote deletes),
system/home-path `rm`, sudo, credential stores, non-test DB drops, and
package publishing are blocked outright; denials bind even under
`--dangerously-skip-permissions`, land in `agents/{adw_id}/risk.log` and the
progress log, and the agent is told to route around them. Audit the rules:
`python3 adws/adw_modules/risk_gate.py --selftest`.

## Parallel & multi-repo execution

The pipeline normally runs **in place** in `--working-dir`. Three layered options
let you isolate a run and fan work out across many features or many repos. All
three share one worktree path (`adws/adw_modules/feature_worktree.py`) and one
child-spawn/collect path (`adws/adw_modules/child_run.py`); state and logs stay
under the harness `agents/<adw_id>/` keyed by `adw_id`, so concurrent runs never
collide.

**1. Worktree isolation** (`--worktree`): run the whole pipeline inside an isolated
git worktree of the target repo — its own branch `adw/<id>`, its own ports
(injected as env vars; the allocation is recorded in the harness
`agents/<id>/ports.json`, never as a file inside the worktree), its own tree
under `trees/<id>/`. This is what makes parallel runs
against the *same* repo safe. The branch holds the work; the tree is kept by
default (`--remove-worktree` to delete it). Base ref defaults to `origin/main` if it
resolves, else `HEAD` (so fresh/no-remote repos work). Composes with `--draft-pr`
(it reuses the same `adw/<id>` branch) and `--attempts` (best-of-N nests its
candidate sub-worktrees inside).

```bash
uv run adws/travis/travis_sdlc.py "Add a /health endpoint" \
    --worktree --working-dir ~/code/api
```

**2. Parallel multi-feature fan-out** (`adws/travis/travis_fanout.py`): run N
features concurrently against the *same* repo, each in its own worktree. Mirrors
best-of-N's bounded `ThreadPoolExecutor`; prints a scorecard and writes
`agents/<run_id>/fanout/summary.json`. Any `travis_sdlc` flag is forwarded to every
child.

```bash
uv run adws/travis/travis_fanout.py \
    "Add a /health endpoint" "Add a /version endpoint" \
    --working-dir ~/code/api --max-parallel 2 --draft-pr
# or one prompt/spec-path per line:
uv run adws/travis/travis_fanout.py --features-file features.txt --working-dir ~/code/api
```

**3. Multi-repo orchestration** (`adws/travis/travis_multirepo.py`): drive one
cross-cutting ticket across many repos (frontend/backend/infra). **Independent
per-repo plans** — the same ticket goes to each repo, and each runs its *own* full
SDLC using *its own* `.claude/` commands+skills+memory, isolated in its own
worktree. Repos are listed in a JSON manifest checked into your orchestrator repo
(see `repos.json.sample`). Parallel by default; `--serialize` runs them in
dependency order (manifest `order`, e.g. backend → frontend).

```bash
uv run adws/travis/travis_multirepo.py "Add request-id propagation end-to-end" \
    --manifest repos.json                 # all enabled repos, in parallel
uv run adws/travis/travis_multirepo.py "Add request-id propagation" \
    --manifest repos.json --repos backend,frontend --serialize
```

`repos.json`:
```json
{ "version": 1, "repos": [
  { "name": "backend",  "path": "../backend",  "base_branch": "origin/main", "order": 1 },
  { "name": "frontend", "path": "../frontend", "order": 2 }
]}
```
Per repo: `name` (unique), `path` (resolved relative to the manifest), optional
`base_branch` (→ worktree base), `enabled` (default true), `plan_type` (default
`feature`), `order` (used by `--serialize`).

**Measuring it** — `evals/run_multirepo_eval.py` is the multi-repo analogue of the
single-target `run_eval.py`: it prepares two hermetic targets (`evals/target_app`
+ `evals/target_cli`) into clean git-init'd dirs, generates a manifest, runs
`travis_multirepo.py`, then grades each repo against *its own* worktree (the run's
plan+build verdict plus the repo's `test_command` + acceptance). Task format:
`evals/multirepo_tasks/MR01-count-command.yaml`.

It feeds the **same scorecard** as the single-target eval: each trial writes
`results/{variant}/{task}/{trial}/result.json` in `compare.py`'s schema (the two
repos pooled into `acceptance_checks`/`tests_pass` — 1.0 only when *every* repo
fully passes, so pass^k means "all repos solved on every trial", plus per-repo
`<repo>_acceptance`/`<repo>_tests` columns). So you A/B multi-repo variants with
the existing tooling:

```bash
uv run evals/run_multirepo_eval.py MR01 --variant parallel  --trials 3
uv run evals/run_multirepo_eval.py MR01 --variant serial --serialize --trials 3
uv run evals/compare.py --variants parallel,serial
```

`--dry-run` validates target prep and manifest generation with no agent calls; a
real scoring run needs Claude credentials. The deterministic plumbing (worktree
create/remove, ports, the subdir-of-harness guard, manifest load/reject) is
guarded credential-free by `adws/adw_tests/test_feature_worktree.py`.

> **Note:** the target must be a real git repo *root*. `evals/target_app` /
> `evals/target_backend` are tracked subdirs of this harness, so `--worktree`
> refuses them with an actionable error — copy them out + `git init` first (the
> `evals/run_eval.py:prepare_target` pattern). Concurrency is capped at the
> 15-slot port range (`worktree_ops.find_next_available_ports`); runners refuse
> `--max-parallel > 15`.

## Memory & the knowledge base

**Do you get it automatically, or set it up?** The *mechanism* ships ready —
nothing to install, no database, no service to run. But the *knowledge base
starts empty*: a fresh project has no memory until you put something in it.
Recall switches on automatically the moment entries exist, and is a silent no-op
before that (the run log says which happened: `Memory injected: …` vs
`No project memory found`).

**How to get the knowledge base going** — three ways, smallest to largest:

```bash
# 1. Hand-seed: drop a markdown entry; picked up next run, no registration.
#    Format in adws/travis/MEMORY_CONTRACT.md.
$EDITOR <project>/ai_docs/memory/entries/convention-prefer-uv-run.md

# 2. Dream after a run: on a successful build, consolidate that run's lessons.
uv run adws/travis/travis_sdlc.py "Add export" --working-dir <project> --dream

# 3. Dream over history: fold the N most recent runs into the store in one pass.
uv run adws/travis/travis_dream.py --working-dir <project> --last 5
```

Over time, dreaming accumulates conventions/lessons/pitfalls; it updates entries
in place (keyed by `name`) instead of duplicating, and prunes to a ~25-entry
budget.

**The technology behind it** — deliberately simple and inspectable:

- **Plain markdown files**, one durable fact per file, in the target repo's
  `ai_docs/memory/` (`MEMORY.md` index + `entries/<type>-<slug>.md`). **Not** a
  vector database, **not** embeddings, **not** RAG, no external API —
  `adws/adw_modules/memory.py` imports only the Python standard library.
- **Recall = prompt injection.** At run time the whole store is compiled into one
  markdown doc (hard-capped at 6000 chars, oldest entries dropped first with an
  omission note) and appended to Claude Code's system prompt via
  `--append-system-prompt-file`. It never replaces the task instructions, and is
  advisory — explicit instructions always win.
- **Dreaming = one LLM call** that takes the existing entries (verbatim) plus the
  new run's summaries and returns the rewritten store. It runs as agent `dreamer`,
  so its cost is tracked like any other phase, and it only fires on a successful
  build (failed runs teach noise).
- **Git is the review surface.** Memory lives in *your project's* git; every dream
  lands as a reviewable diff — revert anything you don't want.
- **Per-project.** Each codebase has its own store; nothing is global or shared.

Why files instead of a database: the store is small (tens of facts),
human-readable, diff-reviewable, and travels with the repo. At this scale,
full-context injection beats retrieval — there's no embedding drift or
relevance-ranking to debug. Full spec: `adws/travis/MEMORY_CONTRACT.md`.

## Evals — is a harness change good or bad?

Open-ended feature work can't be graded like a unit test, so the harness ships a
benchmark: **fixed sample codebases** (`evals/target_app/` and
`evals/target_backend/`) plus **14 fixed tasks across two tiers** (features,
bugs, chores). Each trial copies the target to a clean temp dir, runs the full
SDLC against it, and grades the outcome. Run every task N times (default 3) per
**variant** and compare:

```bash
# A/B test two planners (same checked-out code, different flag)
uv run evals/run_eval.py run --variant travis   --planner travis   --all --trials 3
uv run evals/run_eval.py run --variant openspec --planner openspec --all --trials 3
uv run evals/compare.py --baseline travis

# A/B test a harness change (branch vs branch)
git checkout main        && uv run evals/run_eval.py run --variant main --all
git checkout my-change   && uv run evals/run_eval.py run --variant my-change --all
uv run evals/compare.py --baseline main

# Cheap smoke run first
uv run evals/run_eval.py run --variant smoke --tasks 03 --trials 1 --skip-review

# Pin an immutable baseline snapshot, compare against it forever
uv run evals/compare.py --snapshot baseline --out evals/baselines/tier1.json
uv run evals/compare.py --variants my-change --baseline-file evals/baselines/tier1.json

# Model×effort sweep: which cheapest cell still passes? (grid print without --yes)
uv run evals/sweep.py run --tasks 01,03 --trials 2 --yes
uv run evals/sweep.py report   # scorecard + Pareto plots + sweep_report.html
```

**Two tiers of benchmark targets**: tier 1 (`evals/target_app/`, hermetic
notes CLI — cheap regression gate, ~5 min/trial) and tier 2
(`evals/target_backend/`, a frozen ~69K-LOC Express/TS backend snapshot with
postgres+redis — realistic headroom, ~9 min/trial). Tier-2 tasks (07-13) need
`npm ci` once in `evals/target_backend/` and either local postgres:5432 +
redis:6379 (reused automatically; only `growbuddy_test_*` DBs are touched) or
Docker (compose fallback). Tests run via `npm run test:api:parallel` — the
full 400-test suite across 4 worker DBs in ~18s.

**Hard-mode tasks (10-13)** live on the tier-2 target and exist because the
tier-1 quality cells saturated (audit `evals/audits/2026-06-09-audit.md`):
a vague-symptom bug (the planted `totalPages` defect in
`src/routes/admin.ts` is load-bearing — don't fix it in the vendored
backend), a cross-module feature with migration/convention landmines, and a
surgical-restraint fix whose acceptance asserts nothing outside the allowed
files changed. **Task 13** is "hard-mode v2": a *real, unplanted* latent
defect (a Sequelize `findAndCountAll` + `hasMany` include that inflates
`count` by JOIN rows) where the cause has no greppable keyword — it grades
ORM-semantics investigation plus sweep thoroughness, since two instances
exist and the prompt only reports one. Eval health is guarded by
`evals/AUDIT.md` (checklist) and
`uv run evals/grader_selftest.py [--judge]` (known-good/known-bad fixtures —
rerun after any graders.py change).

**Graders** (patterns adapted from Anthropic's public cwc-workshops repo,
https://github.com/anthropics/cwc-workshops, Apache-2.0): deterministic code graders
(tests pass ratio, acceptance checks, phases completed, test retries, SUT cost
from API-recorded tokens, wall time, diff size) plus a memoized LLM judge
(spec quality 0-5, implementation fidelity 0-5 — one combined call, fixed judge
model, cost itemized separately). Infra failures are reported as their own
bucket, never as task failures. The scorecard shows mean ± spread across
trials — differences smaller than the spread are noise, not signal — plus a
**reliability** view: **pass@k** (solved ≥1 of k trials = capability ceiling)
and **pass^k** (solved *all* k = consistency). A healthy-looking mean can still
hide a task that only succeeds 2-of-3 runs; pass^k surfaces it.

**Growing the benchmark** (`/capture_eval_task`): when a real run produces a
buggy result on a vendored target, mint it into a new `evals/tasks/` task — the
behavioral acceptance oracle is harvested from the human's fix, an optional
`setup:` step plants the bug into the baseline, and a saturation check keeps the
task only if the current harness doesn't already ace it (pass^k < full). This is
how the suite stays hard as the agent improves. The methodology rationale —
which industry practices we adopt, already satisfy, or deliberately ignore —
lives in `evals/EVAL_PRACTICES.md`.

**Baseline snapshots** (`evals/baselines/`, committed): `--snapshot` pins a
variant's aggregates as an immutable reference; `--baseline-file` renders
deltas against it even after the underlying gitignored results are gone —
the gate the self-improvement loop measures every harness change against.

**Sweeps** (`evals/sweep.py`): a model×effort grid (haiku has no effort knob;
on 4.6+ models thinking is adaptive and `--effort` is the depth control) where
each cell is a normal eval variant. Resumable after usage-limit interrupts;
`report` emits a scorecard, the cheapest full-pass cell, and Pareto plots.

## Roadmap

- [x] **Swappable spec generators** — planner registry (`adws/travis/planners.py`)
      + contract (`PLANNER_CONTRACT.md`); travis + OpenSpec today, Spec Kit and
      BMAD adapters are "one script + one registry entry"
- [x] **Eval-driven hardening** — `evals/` benchmark with code graders + LLM
      judge; A/B variants measured on the same tasks with mean±spread
- [x] **Memory** — per-project store at `ai_docs/memory/` consulted by
      research/plan/build (`MEMORY_CONTRACT.md`); "dreaming" consolidation
      (`travis_dream.py`, `--dream`) distills run transcripts into durable
      conventions/lessons/pitfalls; A/B testable via `run_eval.py --memory`
- [x] **Parallel & multi-repo** — worktree isolation (`--worktree`), N-feature
      fan-out (`travis_fanout.py`), and cross-repo orchestration with a `repos.json`
      manifest (`travis_multirepo.py`); one shared worktree + child-spawn path
      (`feature_worktree.py`, `child_run.py`)
- [~] **Self-improvement** — closing the loop. Done: auto-capture of harness
      regressions (`--auto-capture` → `tests/regression/`); eval-task capture to
      de-saturate the benchmark (`/capture_eval_task` → `evals/tasks/`);
      reliability gating (pass@k / pass^k); every change validated against the
      eval suite before adopting. Remaining: schedule dreaming on a cadence, and
      feed review findings back into command templates.

The memory/dreaming design, the eval-driven development approach, and the agent
decomposition patterns are adapted from Anthropic's public cwc-workshops repo
(https://github.com/anthropics/cwc-workshops, Apache-2.0). Eval methodology rationale, distilled
from how leading coding-agent teams work, is in `evals/EVAL_PRACTICES.md`.

## Docs

- `adws/README.md` — harness architecture and philosophy
- `adws/ADW_SETUP_GUIDE.md` — detailed setup, phases, parallel worktree execution
- `adws/building-llm-powered-workflows.md` — workflow design patterns
