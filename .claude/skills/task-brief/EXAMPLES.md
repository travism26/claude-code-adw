# Worked Example

The brief below (a real prompt for adding an eval task to this harness) is
annotated with what each structural move buys. Section names can vary; the
five answers cannot.

```
GOAL
Add one new tier-1 eval task, 15-feature-pin-note, to evals/tasks/ so the
suite can tell whether the --review-spec gate catches a dropped "unpin must
be idempotent" requirement before I decide whether to make the gate the
default. Production: the task is a permanent benchmark fixture, not a spike.
```
→ WHAT + WHY in two clauses. "Production" calibrates effort; "so the suite
can tell... before I decide" tells the executor this task exists to
discriminate between two variants — the held-out acceptance check matters,
grader cosmetics don't.

```
SCOPE (keep it tight)
- One new YAML file under evals/tasks/. Don't touch tasks 01-14, evals/
  graders.py, evals/run_eval.py, or evals/target_app/ (the target is frozen;
  the task is graded against it as-is).
- REUSE the shape of evals/tasks/14-specdefect-rename-guard.yaml (tier:
  spec-defect, a held-out acceptance check with a comment saying so) IF it
  fits without inventing new YAML keys; otherwise match task 06 and drop
  the tier field. Do NOT add a new grader, a new tier name, or a baseline
  re-pin for this — that's not what we're testing.
```
→ Negative constraints ("don't touch", "do NOT add") prevent scope creep.
The reuse conditional carries its own decision rule: "if it fits without
new keys" — cheap yes, expensive no. No rigid order that forces a refactor.

```
- Target: evals/target_app (CLI is `uv run python -m app.notes --db <path>`
  with add / list / get / delete subcommands; tests in tests/test_notes.py,
  run with `uv run pytest -q`).

WHAT TO BUILD
1. evals/tasks/15-feature-pin-note.yaml with id, plan_type: feature,
   target: app, prompt, test_command: "uv run pytest -q", acceptance,
   judge_focus.
2. A prompt that bundles three requirements: `pin <id>` marks a note and
   `list` shows pinned notes first; `unpin <id>` clears it; unpin on an
   already-unpinned note exits 0 and leaves the store byte-identical.
3. Four acceptance checks, each a self-contained shell line using its own
   /tmp/sd15*.json db: pin reorders list; unpin restores order; unknown id
   exits 1; and the held-out one — unpin twice, then `cmp` the db file
   against a copy taken after the first unpin.
4. judge_focus naming the idempotent-unpin requirement.
```
→ Resources NAMED, not described: exact path, exact keys, exact CLI
invocation, a per-check /tmp filename pattern. Each numbered item is
independently checkable.

```
KNOWN GAP — flag, don't fix
evals/AUDIT.md still says "At 9 tasks the whole set is readable in one
sitting" and the pinned baselines in evals/baselines/ predate task 15, so
compare.py will show the new task with no baseline row. Leave both alone —
the audit text is updated in a separate pass and the baseline gets re-pinned
after the A/B run, not before. Expect a "no baseline" marker, not an error.
```
→ Does three jobs at once: stops the executor from burning time fixing it,
stops it from reporting the symptom as a bug, and stops the human reviewer
from reading the result as a failure. Symptom + workaround + real fix.

```
VERIFICATION
uv run evals/run_eval.py run --variant smoke --tasks 15 --trials 1
  --skip-review   → the run completes and the acceptance block executes
  (pass or fail is fine; a YAML or shell parse error is not).
Then hand-apply the feature to a scratch copy of evals/target_app and run
the four acceptance lines; all four must pass against a correct solution.

DECISION GATE
- Deliverable: the YAML file, the smoke-run output, and a short read on
  whether the held-out check can be passed by a solution that skipped
  idempotency (if it can, the check is too weak — say so, don't widen it).
- Questions the output must answer: Is the prompt wording natural enough
  that dropping the idempotency clause is a plausible planner mistake, not
  a trick? Does any existing task already cover this?
- STOP: do NOT run the --review-spec A/B (3 trials × 2 variants) or re-pin
  evals/baselines/ until the task has been reviewed.
```
→ Success criteria framed as questions the output must answer; a concrete
deliverable (file + run output + read); an explicit STOP that defines where
the human re-enters the loop.

# Before/after lint examples

| Fails lint | Passes |
|---|---|
| "add tests for foo.py" | "ADD a test to tests/test_foo.py covering the logged-out edge case. No mocks. Run `pytest tests/test_foo.py -v`; all pass." |
| "fix the login bug" | "Login fails after session timeout. Check src/auth/, especially token refresh. CREATE a failing test reproducing it, then fix. Root cause, don't suppress." |
| "make the dashboard look better" | "[screenshot] MIRROR this design. Screenshot the result, diff against the original, list and fix the differences." |
| "clean up the config handling" | "REPLACE the three ad-hoc env reads in src/config.ts with one loadConfig(). Don't touch the CLI flag parsing." |
