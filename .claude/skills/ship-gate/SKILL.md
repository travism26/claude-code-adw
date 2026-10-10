---
name: ship-gate
description: Ship a branch of this repo — deterministic gate, independent read-only review, then push + PR for a human to merge. Use when the user says "ship this", "run the ship gate", "gate this branch", or asks to push/PR after finishing work in this repo.
---

# Ship gate

The procedure for shipping a change in this repo: a deterministic check, an
independent review, then a human-mergeable PR. The agent never merges.

## Privacy invariant

The **only** network traffic in this entire flow is `git push` and
`gh pr create` to this project's own origin, in step 3, and it is visible in
the terminal as it happens. Step 1 is local-only (git + gate commands). Step
2 is a read-only diff review with no tool access beyond reading — it makes
no network calls either.

## Procedure

1. **Run the gate.** `uv run adws/pipelines/ship_gate.py --json` from the
   repo root. It must exit 0. If it exits 2, fix the reported precondition
   (wrong branch, dirty tree) — do not reach for `--skip-precheck` as a
   default move; that flag is for a deliberate, audited exception, and every
   use is logged loudly to stderr and recorded as `"skip_precheck": true` in
   the JSON. If it exits 1, a gate failed — fix the underlying problem and
   re-run; do not edit `adw_gates.json` to make a failure disappear.

   The gate config is `adw_gates.json` at the repo root: currently one
   explicit-file `unit` gate listing the M0–M2 test files by name. When a
   task lands a new test file that should ship-block, add it to that
   command list — the list is deliberately explicit, not `-q adw_tests/`,
   so a new untested file can't silently start blocking (or silently not
   block) ships.

2. **Independent review.** Spawn a separate reviewer over the branch diff
   (`git diff <default-branch>...HEAD`) with **read-only** access — it must
   not be able to edit files, run gates, or take any action beyond reading
   and reporting. Ask it to check correctness, scope creep, and whether the
   diff matches what was actually asked for.

   **Relay-verbatim rule:** if the reviewer raises a finding that challenges
   something the user did deliberately — a choice that looks wrong in
   isolation but was an intentional call — do **not** silently agree with
   the user and drop the finding, and do not silently agree with the
   reviewer and "fix" it unasked. Relay the finding to the user verbatim and
   let them decide. Never self-approve past a challenged finding.

3. **Push + PR.** Once the gate is green and the review is resolved:
   - `git push origin <branch>` — visible, to this repo's own origin only.
   - `gh pr create` with a body written from **conversation context** (what
     was actually being solved and why) — never generated from a raw
     transcript or commit-message dump. State what changed and why it was
     needed; let `git diff` speak for the mechanical "what".

4. **Human merges.** The agent's job ends at opening the PR. Do not merge,
   do not enable auto-merge, do not approve your own PR. Report the PR URL
   and stop.

## Known gaps

No CI mirroring — `ship_gate.py` is local-only by design (see privacy
invariant above); CI is a separate, out-of-scope concern. No auto-fix: gate
failures are reported, never patched by the gate itself — that's a human or
a separate build/fix pipeline's job.
