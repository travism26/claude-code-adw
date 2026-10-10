---
name: delegate
description: Delegate work to background sub-agents with model tiering, self-verifying prompts, and results persisted to files. Use when launching sub-agents, splitting work into parallel research/build tasks, or when the user says "delegate", "use sub-agents", or "hand this off".
---

# Delegate

The main session stays orchestrator and reviewer. Sub-agents do the heavy work in their own
context windows and write durable output to files.

**Adapt this file to your project** before using it: fill in the tier table with your current
model names, replace the example paths with your own, and add a rules section for anything in
your environment that must never be touched.

## Why this exists

A sub-agent's exploration — every file read, every search, every dead end — stays in *its*
context window. Only the final report comes back. Ten thousand tokens of looking around return as
a paragraph.

**Protecting the orchestrator's context is the primary benefit.** Cost savings from cheaper
models are real and secondary. A sub-agent on the same model at the same price is still a large
win.

## Core rules

**1. Background by default, parallel when independent.**
Launch independent agents in one message. Don't poll — completion notifications arrive on their
own. Sequence only through real dependencies (contract → implementation, schema → API → UI).

**2. Tier the model to the task.**

| Tier | Use for | Examples |
|---|---|---|
| **Top** (omit `model`) | Judgment-heavy: synthesis, ambiguous research, adversarial review, user-facing content, anything where "correct" requires taste | Design synthesis, reviewing another agent's diff, choosing an approach |
| **Mid** (`model: "sonnet"`) | Well-specified implementation with a mechanical pass/fail check | Endpoints from an agreed contract, screens from a wireframe, migrations, smoke scripts |
| **Cheap** (`model: "haiku"`) | Trivial and fully specified | Version checks, file inventories, mechanical renames, config edits |

> **The rule that makes this safe: if you cannot write a check that proves the work is correct,
> do not send it below the top tier.**

This converts an unanswerable question ("is this hard enough to need the good model?") into an
answerable one ("can I state right now the command that tells me whether this came back
correct?"). If the answer is a typecheck plus a named test, delegate down. If the answer is "I'd
have to read it and judge," it stays at the top.

**3. Contract-first parallelism.**
Before two agents touch adjacent ground, pin the interface in a document they both read. Give
each an explicit file-ownership list: files it creates, and files it must not touch — naming the
other agent's territory directly.

Parallel agents rarely fail by writing bad code. They fail by writing plausible code against
incompatible assumptions, which surfaces at integration.

**4. Self-verifying prompts.**
Every implementation prompt ends with verification the agent must actually run — typecheck, lint,
build, a named test loop with specific assertions — and a required final-report format. **An
agent that didn't run its checks isn't done**, whatever its summary says.

**5. Persist everything.**
Research → a research file. Decisions → a decisions log. Contracts and designs → shared
documents. The agent's final chat report is a summary, never the only copy. A sub-agent's context
is discarded when it finishes; anything not written down went with it.

**6. Review before building on top.**
After a lower-tier agent lands code, the main session reviews the diff before anything is built
on it. Compounding on unreviewed work turns one bad assumption into five files.

Interrupted agent? **Verify what it actually wrote before relaunching.** Assume a partial
workspace, not a clean one.

**7. State the guardrails every time.**
Anything with real consequences — data that must not be modified, systems that must not be
touched, credentials that must not cross a boundary — goes in the prompt. A sub-agent has no
memory of your standing conventions and was not present for the conversation where you set them.

## Prompt skeleton

In order:

1. **Role and location** — what this agent is, which repo/directory
2. **Read first** — the specific files to read before doing anything
3. **Hard constraints** — file ownership, do-not-touch, invariants that must hold
4. **Numbered deliverables** — what must exist when it's done
5. **Verification steps that must actually run** — named commands, named assertions
6. **Required final-report shape**

Each part prevents a specific failure. No "read first" → an agent that reinvents what exists. No
ownership list → collisions. No verification → confident garbage. No report shape → a narrative
you have to re-read the diff to interpret.

## Worked example

```
You are implementing the export endpoint in <repo path>, working on branch <branch>.

READ FIRST
- docs/design/export-contract.md   — the agreed request/response shape. Do not change it.
- src/api/reports.ts               — the closest existing endpoint; match its structure.

CONSTRAINTS
- You own: src/api/export.ts, src/api/export.test.ts
- Do NOT touch: src/api/reports.ts, anything under src/ui/ (another agent owns the UI
  slice of this feature and is working in parallel).
- The response shape in export-contract.md is fixed. If it looks wrong, stop and report
  rather than changing it — the UI agent is building against it right now.
- Leave the workspace green. Do not commit.

DELIVERABLES
1. POST /api/export implementing §3 of export-contract.md
2. Tests at the route boundary covering: success, empty result set, and the
   unauthorized case
3. No changes to any file outside your ownership list

VERIFICATION — run these and report actual output
- `npm run typecheck` — must pass
- `npm run test src/api/export.test.ts` — must pass, and must include a test that
  fails if the response shape drifts from the contract
- `npm run lint src/api/export.ts` — must pass

FINAL REPORT
- Files created/modified
- Verification commands run, with their actual results (not "all passing")
- Anything in the contract that was ambiguous or that you had to interpret
- Anything you noticed but deliberately did not fix
```

## When not to delegate

**Judgment doesn't delegate.** If the task needs to know what the user actually meant, or to
weigh an ambiguous trade-off, a fresh-context sub-agent lacks what it needs and will return
something confident and plausibly wrong. Delegate execution, keep judgment.

**Small tasks don't pay.** A good prompt costs real effort. Below roughly "substantial
exploration, or several files, or work the main thread would otherwise wait on," just do it.

**Unattended loops are a different thing.** This skill assumes attended delegation with gates
between units and a human at the decision points. Fully autonomous ticket loops have documented
failure modes — nondeterminism, and their own authors advising against running them in existing
codebases.
