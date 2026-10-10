# M3 epic — pipe_feature + pipe_bug (tiered execution)

Source: `docs/slim-pipelines-plan.md` §7.2–§7.3, §11 (M3 row).
Branch: `feat/m3-feature-bug-pipelines`. Orchestrator reviews every diff before commit.
M3 acceptance: live smoke each on a scratch target; spec lands in `specs/` of the target.

## Standing orders

- Gate command: the repo ship gate's unit list — `uv run adws/pipelines/ship_gate.py --json --skip-precheck` must show the unit gate passing — plus `uv run pytest <your new test file> -q`. When your brief adds a test file, ALSO add it to the root `adw_gates.json` unit command (that's the ship-block list rule from the ship-gate skill).
- Python style: match `adws/pipelines/pipe_chore.py` exactly (header, sys.path, manual argv, ≤150 lines per pipeline, usage-on-ValueError).
- Agent arg contracts are FIXED (M0): /feature and /bug take `[adw_id, prompt]` and return ONLY a spec path; /implement takes `[spec_path]`; /review takes `[adw_id, spec_file, agent_name?]` numbered `$1..$3`.
- DON'T TOUCH: `adws/travis/`, `adws/adw_modules/`, `adws/adw_triggers/`, `template_claude/` (no template changes needed — reuse /feature, /bug, /implement, /review), `evals/` contents, engine files (`core.py`, `pipeline_state.py`, `gates.py` are FROZEN this epic).
- Unit tests: no LLM (fake runner). Live smokes are T2 only.
- Do NOT commit.

---

## T1 — pipe_feature.py + pipe_bug.py + unit tests [x]

```
GOAL
The two remaining slim pipelines: feature (plan → implement → gate loop → one
advisory review) and bug (same, plan-type bug, fast test gate MANDATORY at startup).
Production.

SCOPE
- NEW: adws/pipelines/pipe_feature.py (≤150 lines), adws/pipelines/pipe_bug.py
  (thin — imports shared flow from pipe_feature, ≤80 lines), adws/adw_tests/
  test_pipe_feature_bug.py. Root adw_gates.json: append the new test file to the
  unit command.
- REUSE: core.build_loop, gates.resolve_gates, PipelineState, AgentTemplateRequest.
  pipe_chore.py is a style/structure reference — do not modify it.

WHAT TO BUILD
1. pipe_feature.py CLI:
     uv run adws/pipelines/pipe_feature.py "<prompt>" [--working-dir DIR]
       [--model M] [--max-iters N] [--gates FILE] [--plan-type feature|chore|bug]
   Flow: resolve dir/gates (same as pipe_chore; 0 gates = loud warning) → adw_id →
   PipelineState(pipeline="feature"|plan-type…) →
   PLAN: planner agent (agent_name="planner", slash_command=f"/{plan_type}",
   args=[adw_id, prompt]) → spec path extraction: strip the output; if that exact
   path doesn't exist under working_dir, regex-fallback search the output for
   r"specs/[^\s]+\.md"; verify existence on disk (fail the pipeline with a clear
   error if missing — no hallucinated specs downstream); record plan_file in state →
   BUILD+GATES: build_request = (agent_name="builder", "/implement",
   args=[spec_path]) through core.build_loop (fixers included) →
   REVIEW (advisory, only when build_loop succeeded): reviewer agent
   (agent_name="reviewer", "/review", args=[adw_id, spec_path, "reviewer"]) — record
   {"success": resp.success} plus the output tail in phase_results["review"];
   ADVISORY means: review NEVER changes the exit code (plan §7.2) — a failed review
   run is recorded and printed as a warning, not a pipeline failure →
   print diff-stat + state path + PASS/FAIL, exit 0/1 per build_loop only.
2. pipe_bug.py: wraps the same flow (import the shared run function from
   pipe_feature — do not duplicate it) with plan_type forced to "bug", plus a
   STARTUP guard: after resolving gates, require at least one FAST gate whose name
   contains "test" or "unit" — else exit 1 immediately with "bug pipeline requires
   a fast test gate" (plan §7.3: a bug run with no test gate must not 'pass'
   untested). Same flags minus --plan-type.
3. test_pipe_feature_bug.py (fake runner; fake planner WRITES a spec file into
   tmp working dir and returns its path):
   (a) feature happy path: plan→implement→gates pass→review recorded, exit 0,
       state has plan_file + phase_results.review;
   (b) planner returns a path that doesn't exist → pipeline fails with clear error,
       no /implement call made (assert via captured requests);
   (c) planner output has prose around the path → regex fallback finds it;
   (d) advisory review: reviewer response success=False → exit code still 0,
       warning recorded;
   (e) bug: gates config with only a lint gate → startup failure, no agents called;
   (f) bug: with a unit gate → runs, plan_type "bug" sent to /bug (assert
       slash_command);
   (g) --plan-type chore accepted on pipe_feature.

KNOWN GAPS — flag, don't fix
No spec-review gate (travis keeps that), no best-of-N, no worktree. Planner output
is still a bare path (JSON envelopes for planners are a later catalog milestone).

VERIFICATION
uv run pytest adws/adw_tests/test_pipe_feature_bug.py -q → all pass.
Ship gate unit command (with your file appended) → green.
wc -l both files → within limits.

DECISION GATE
- Deliverable: diff + gate output + wc -l.
- STOP: no live agents (T2's job).
```

## T2 — live smokes: pipe_feature + pipe_bug on scratch target_cli [x]

```
GOAL
M3 acceptance: both pipelines converge with real agents on a scratch copy of
evals/target_cli. Live LLM runs allowed (sonnet, tiny prompts).

SCOPE
- Runs AFTER T1 commit. Report-only; scratch under the session scratchpad
  (fresh copy, never touch the vendored target). Setup identical to the M2 smoke
  (git init baseline, copy template_claude/commands into .claude/commands).

WHAT TO BUILD (execute)
1. FEATURE smoke: uv run adws/pipelines/pipe_feature.py "Add a --version flag to
   the CLI that prints 1.0.0 and exits" --working-dir <scratch> --model sonnet
   → assert: a specs/feature-*.md file EXISTS in the scratch repo; implement ran;
   unit gate passed (fix loop allowed if needed); review phase recorded in state;
   exit 0. Paste state JSON + `ls specs/` + diff --stat.
2. BUG smoke: plant the M2-style bug (sorted reverse=True in KVStore.list) in a
   FRESH scratch copy; run: uv run adws/pipelines/pipe_bug.py "kv list returns keys
   in reverse order instead of sorted order" --working-dir <scratch2> --model sonnet
   → assert: specs/bug-*.md exists; the fix landed (gate passed, tests green);
   exit 0. Note whether the /bug plan included reproduction per its template.
3. Confirm harness repo tree stays clean; only agents/<id>/ appears.

VERIFICATION
The pasted state JSONs + specs listings ARE the verification.

DECISION GATE
- Deliverable: both state JSONs, specs listings, diffs, wall-clock + cost.
- STOP: nothing else.
```

---
**Smoke results (2026-07-19):** feature converged plan→implement→gate→review, `--version` verified by hand ($0.88, 2m43s); bug converged from a plain-English report to a byte-perfect fix, 10/10 green independently ($0.77, 2m04s). **Known gap carried forward:** the bug run's spec Metadata mis-bound `$1`/`$2` (`adw_id: kv`) and the filename dropped the adw_id segment — the multi-word arg-splitting class, now on planner templates. Harmless today (nothing parses spec metadata; path extraction checks the filesystem), fixed properly by the planner JSON-envelope milestone in docs/sdlc-agent-map.md.
