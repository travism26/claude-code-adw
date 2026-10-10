# Memory Contract

Project memory gives the harness durable, per-codebase knowledge — lessons,
conventions, and pitfalls accumulated across runs and consulted by future
runs. Implementation: `adws/adw_modules/memory.py` (store + injection) and
`adws/travis/travis_dream.py` (consolidation). Pattern adapted from Anthropic's
cwc-workshops agents-that-remember (https://github.com/anthropics/cwc-workshops, Apache-2.0).

## Store layout

Memory lives **in the target project** (the `--working-dir`):

```
ai_docs/memory/
  MEMORY.md                  # regenerated index — one line per entry
  entries/<type>-<slug>.md   # one durable fact per file
```

Entry format — minimal frontmatter + markdown body:

```markdown
---
name: prefer-uv-run-for-scripts        # kebab-case stable key (= identity)
description: One line, <=100 chars     # shown in index + injection header
type: convention                       # convention | lesson | pitfall
source_adw_ids: [a1b2c3d4]             # provenance
date: 2026-06-04                       # bumped on add/update
---

The lesson itself. Keep under ~1500 characters. Don't start a body line
with `---` (the frontmatter parser splits on the first two fences).
```

Types:
- **convention** — how this project does things (tooling, layout, naming)
- **lesson** — an insight that made a run go better/worse
- **pitfall** — a concrete trap that cost retries/review issues + avoidance

Budgets: ~25 entries per store (dream prunes), ~1500 chars per body,
**6000 chars** for the compiled injection doc (oldest entries dropped first,
with an explicit omission note).

## Recall (injection)

The **research, plan, and build** phases compile the store into one markdown
doc (steering preamble + entries) and pass it via the existing
`--append-system-prompt-file` path — appended to Claude Code's system prompt,
never replacing it. The compiled doc is written to harness
`agents/{adw_id}/memory_inject.md` (auditable per run; never pollutes the
target's git).

- Default **ON** whenever `ai_docs/memory/entries/` has entries.
- Graceful no-op when absent — the log says which happened
  (`Memory injected: ...` vs `No project memory found`).
- Suppress with `--no-memory` (per phase, or on `travis_sdlc.py` which
  forwards it to all three phases).
- Memory is advisory: the steering preamble tells the agent the task's
  explicit instructions always win, and to call out contradictions.

## Dreaming (consolidation)

```bash
# Standalone — consolidate specific runs or the N most recent
uv run adws/travis/travis_dream.py [adw-id ...] --working-dir <target> [--last N] [--model sonnet]

# Or opt-in after a workflow run (only fires when the build phase succeeded)
uv run adws/travis/travis_sdlc.py "..." --working-dir <target> --dream
```

How it works:
1. Gathers small artifacts per run (state, per-agent final outputs, spec,
   research file, review issues — never raw JSONL).
2. ONE consolidation LLM call: existing entries (verbatim) + run summaries +
   rules → the **complete regenerated store** (workshop "dream" style).
   Runs as agent `dreamer`, so its cost is tracked like any other agent.
3. Rules enforced by the prompt: durable knowledge only (no one-off task
   facts, no metrics), update-don't-duplicate on `name`, delete-when-wrong,
   merge-and-prune over 25 entries.
4. Writes entries + regenerates `MEMORY.md`; prints a per-entry change
   summary (`+ add / ~ update / - delete / = keep`).

Safety:
- **Build-success gate**: `--dream` skips when the build failed (failed runs
  teach noise).
- **Git is the review surface**: memory changes land in the target's git —
  review the diff, revert anything unwanted.
- A consolidation response that fails JSON parsing (after one retry) leaves
  the store untouched.

## Seeding by hand

Drop a file in `ai_docs/memory/entries/` following the format above — it is
picked up on the next run, no registration needed. Optionally run
`travis_dream.py` afterwards to fold it into the index, or regenerate the
index from Python: `regenerate_index(working_dir)`.

## A/B testing memory (evals)

```bash
uv run evals/run_eval.py run --variant mem-off --tasks 01,03 --trials 3
uv run evals/run_eval.py run --variant mem-on --memory --tasks 01,03 --trials 3
uv run evals/compare.py --baseline mem-off
```

- Default (no `--memory`): the eval passes `--no-memory` to the SDLC —
  baselines never depend on stray memory state.
- `--memory`: copies the checked-in `evals/seed_memory/` into the target
  **before the baseline commit** (so it never counts as implementation
  churn; `ai_docs` is also in the diff-grader excludes).
- `evals/seed_memory/` was dreamed from a real run — refresh it with
  `travis_dream.py` against new run artifacts when it goes stale.

## Flags summary

| Surface | Flag | Default |
|---|---|---|
| `travis_research/plan/build.py` | `--no-memory` | inject when entries exist |
| `travis_sdlc.py` | `--no-memory` (forwards to the 3 phases) | inject when entries exist |
| `travis_sdlc.py` | `--dream` (build-success gated) | off |
| `evals/run_eval.py run` | `--memory` (seed + enable) | off |
