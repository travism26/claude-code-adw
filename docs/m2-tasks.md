# M2 epic — pipe_chore + templates + live smoke + repo ship gate (tiered execution)

Source: `docs/slim-pipelines-plan.md` §5, §7.1, §11 (M2 row) + the ship-gate decision
(see `docs/sdlc-agent-map.md` companion).
Branch: `feat/m2-pipe-chore`. Orchestrator reviews every diff before commit.
M2 acceptance: planted-failure smoke converges on a real target; pipe_chore ≤150 lines, ≤5 flags.

## Standing orders

- Gate command: `uv run pytest adws/adw_tests/test_model_selection.py adws/adw_tests/test_webhook_simplified.py adws/adw_tests/test_travis_test_parsing.py adws/adw_tests/test_pipeline_core.py adws/adw_tests/test_pipeline_gates.py -q` plus any new test file your brief adds. Do NOT run pytest on the whole `adw_tests/` dir.
- Python style: match `adws/pipelines/` conventions — stdlib dataclasses, manual `sys.argv` parsing, `#!/usr/bin/env -S uv run` + PEP 723 header, `sys.path.insert` anchored from the file's own location (see gates.py).
- Prompt templates: keep the `# Title / ## Variables / ## Instructions / ## Report` structure; numbered `$1`/`$2` variables; terse Report contracts ("Return ONLY …" where an artifact is expected).
- DON'T TOUCH (epic-wide): `adws/travis/`, `adws/adw_modules/` (import-only), `adws/adw_triggers/`, `evals/` targets' contents (copying them to scratch is fine), `agents/`, `trees/`, `logs/`.
- Engine files (`core.py`, `pipeline_state.py`) are FROZEN — extend `gates.py` only where a brief explicitly says so, backward-compatibly.
- Unit tests: no LLM calls (fake runner). The live smoke (T2) is the only task allowed real agent runs.
- Do NOT commit; leave changes in the working tree.

---

## T1 — /build + /fix_gate templates + pipe_chore.py + unit tests [x]

```
GOAL
Ship the Image-1 pipeline: a prompt goes to a build agent, deterministic gates check,
a fixer agent handles failures, slow gates once at the end — one small readable file.
Production.

SCOPE
- NEW: template_claude/commands/build.md, template_claude/commands/fix_gate.md,
  adws/pipelines/pipe_chore.py (≤150 lines), adws/adw_tests/test_pipe_chore.py.
- MAY EXTEND (backward-compatibly): adws/pipelines/gates.py — add an optional
  `config_file` parameter to resolve_gates(repo_dir, config_file=None): when given,
  parse THAT file (same schema/fail-closed) instead of <repo_dir>/adw_gates.json.
  Existing callers/tests must pass unchanged.
- REUSE: core.build_loop, gates.resolve_gates, PipelineState, adw_modules.agent
  (AgentTemplateRequest), adw_modules.utils (make_adw_id/setup_logger if useful).

WHAT TO BUILD
1. build.md: Variables `prompt: $1`. Instructions: implement the request directly in
   the current repo — small, surgical, minimal diff; no plan file; do NOT run test
   suites or linters (deterministic gates do the checking after you finish); follow
   existing code style. Report: one short paragraph of what changed (free text; no
   artifact contract — the working tree IS the artifact).
2. fix_gate.md: Variables `gate_name: $1`, `gate_output: $2`. Instructions: the named
   quality gate failed with the attached output — fix the underlying problem with the
   smallest change; you may re-run the failing command yourself if it's fast; never
   run Docker/integration suites (the pipeline re-runs those deterministically);
   don't fix unrelated issues. Report: one short paragraph.
3. pipe_chore.py CLI (≤150 lines, exactly these 5 flags):
     uv run adws/pipelines/pipe_chore.py "<prompt>" [--working-dir DIR] [--model M]
       [--max-iters N] [--gates FILE] [--adw-id ID]
   Flow: resolve working_dir (default cwd) → adw_id (given or generate via
   adw_modules make/generate helper) → PipelineState(pipeline="chore", prompt, …) →
   gates = resolve_gates(working_dir, config_file=--gates) → if 0 gates, print the
   loud warning and continue (build-only run) → build_request = AgentTemplateRequest(
   agent_name="builder", slash_command="/build", args=[prompt], adw_id, model,
   working_dir) → ok = build_loop(state, build_request, gates, max_iters) → print
   `git -C working_dir diff --stat` (best-effort; skip if not a git repo) + state file
   path + a one-line PASS/FAIL → exit 0/1.
4. test_pipe_chore.py (no LLM — monkeypatch core.execute_template or inject via
   build_loop's agent_runner seam by patching pipe_chore's imported symbols):
   (a) happy path: fake runner + `true` gates → exit 0, state file written,
       phase_results.build.success true;
   (b) gate failure exhausts iters → exit 1, overall_success false;
   (c) --gates FILE override is honored (points at a custom JSON in tmp_path);
   (d) 0 gates resolved → still runs build, exits per build result, warning printed;
   (e) flag parsing: unknown flag → usage + exit 1.

KNOWN GAPS — flag, don't fix
No worktree/sandbox (factory's job), no review agent (pipe_feature, M3), no draft-PR.
Templates land in template_claude/commands/ (the vendored source of truth); this
repo has no .claude/commands/, so live runs in THIS repo would need the target
project to have the templates installed — the T2 smoke handles that by copying
templates into the scratch target's .claude/commands/.

VERIFICATION
uv run pytest adws/adw_tests/test_pipe_chore.py -q → all pass.
Standing-orders gate (M1 files included) → green.
wc -l adws/pipelines/pipe_chore.py → ≤150.

DECISION GATE
- Deliverable: diff + gate output + wc -l proof.
- STOP: do not run live agents (T2's job); do not write ship-gate files (T3's).
```

## T2 — live planted-failure smoke on a scratch target [x]

```
GOAL
Prove the loop-back edge on real agents: a scratch copy of evals/target_cli with a
planted bug must converge through pipe_chore's build→gate-fail→fix loop. This is the
M2 acceptance test. Live LLM runs allowed (small model, small target).

SCOPE
- Runs AFTER T1 is committed. No repo files changed except a short results note
  appended to docs/m2-tasks.md is NOT needed — report only.
- Scratch dir: copy evals/target_cli to the session scratchpad (never modify the
  vendored original), `git init && git add -A && git commit` there so diffs work,
  copy template_claude/commands/*.md into <scratch>/.claude/commands/.
- Env: ensure `claude` CLI available (it is — same env the travis harness uses).

WHAT TO BUILD (execute, really)
1. Baseline: run target_cli's tests in the scratch copy (uv run pytest -q or its
   documented command) → must be green before planting.
2. Plant: introduce a small real bug in a source file that the existing test suite
   catches (pick one covered function; verify tests now FAIL deterministically).
3. Run: uv run adws/pipelines/pipe_chore.py "<a trivial, unrelated chore prompt —
   e.g. add a one-line docstring to <specific tiny function>>" --working-dir <scratch>
   --model sonnet --max-iters 3
4. Assert from pipeline_state.json + gate output: build ran; unit gate FAILED at
   least once (the planted bug); a fixer-i agent ran; the gate subsequently PASSED;
   overall_success true; exit code 0. Paste the state JSON and the relevant
   iterations.
5. Negative control: re-plant a DIFFERENT bug, run with --max-iters 1 and a
   deliberately unfixable twist? NO — keep it simple: instead run once with
   --max-iters 0 is invalid; use --max-iters 1 and if the fixer fixes it in one shot
   that's a pass too — the REQUIRED negative assertion is only: exit code 1 +
   overall_success false when gates cannot pass (simulate by planting a bug and
   pointing --gates at a config whose unit command is `false`). Cheap, deterministic,
   no extra LLM spend.

KNOWN GAPS — flag, don't fix
Smoke cost: ~2-4 live agent runs on sonnet — expected, this is the acceptance test.

VERIFICATION
The pasted pipeline_state.json showing the fail→fix→pass sequence IS the verification.
Also: vendored evals/target_cli untouched (git status clean for it).

DECISION GATE
- Deliverable: state JSON excerpts, the planted bug diff, the fixer's actual diff
  (git diff in scratch), wall-clock + rough cost note.
- Question for the human: none expected.
- STOP: do not mint an eval task from this (that's /capture_eval_task, later).
```

## T3 — repo ship gate (engine consumer) [x]

```
GOAL
A privacy-clean, auditable ship gate for THIS repo built on the M1 engine: one
deterministic CLI (preconditions + gates + JSON results, zero network) and one skill
documenting the human/agent ship procedure (review → push origin → PR → human
merges). Production.

SCOPE
- NEW: adw_gates.json (repo root), adws/pipelines/ship_gate.py (~120 lines),
  adws/adw_tests/test_ship_gate.py, .claude/skills/ship-gate/SKILL.md.
- REUSE: gates.resolve_gates + core.run_gates (import; run ALL gates incl. slow —
  a ship gate has no fix loop and no agents; it just checks).
- DON'T REBUILD: no daemon, no push hook, no telemetry, no auto-fix, no PR creation
  inside the CLI (the skill layer does push/PR with explicit user-visible commands).

WHAT TO BUILD
1. adw_gates.json at repo root: one fast gate
   {"name":"unit","command":"uv run pytest adws/adw_tests/test_model_selection.py adws/adw_tests/test_webhook_simplified.py adws/adw_tests/test_travis_test_parsing.py adws/adw_tests/test_pipeline_core.py adws/adw_tests/test_pipeline_gates.py -q"}
   (the explicit-file list IS the repo's unit gate; extend the list as new test files
   land — note this in the skill).
2. ship_gate.py CLI: `uv run adws/pipelines/ship_gate.py [--working-dir DIR] [--json]
   [--skip-precheck]`:
   - Preconditions (unless --skip-precheck): on a non-default git branch (detect via
     `git symbolic-ref refs/remotes/origin/HEAD`, fallback "main"); clean working
     tree (tracked files); warn-only on untracked. Failure → exit 2 with a clear
     message.
   - --skip-precheck: allowed but AUDITED — print a loud stderr line and include
     "skip_precheck": true in the JSON output, so the escape hatch is never
     silent.
   - Run resolve_gates(working_dir) and core.run_gates over ALL gates in order
     (fast then slow as configured). No agents, no fixing — report only.
   - Output: human lines per gate + summary; with --json, a machine block:
     {"gates":[{name,passed,timed_out,duration_s}...], "all_passed": bool,
      "skip_precheck": bool, "branch": "...", "dirty": bool}.
   - Exit codes: 0 all passed, 1 gate failed, 2 precondition failed.
   - ZERO network calls — assert this in the module docstring as a design invariant.
3. test_ship_gate.py (tmp_path git repos, `true`/`false` gate commands via a local
   adw_gates.json, no LLM, no network): preconditions (default branch → exit 2;
   dirty tree → exit 2; --skip-precheck bypasses + JSON flag set); gate pass/fail
   exit codes; --json shape.
4. .claude/skills/ship-gate/SKILL.md (user-invocable): the ship procedure —
   (1) run ship_gate.py, must exit 0; (2) an independent READ-ONLY review pass of
   the branch diff (spawn a reviewer that cannot edit; findings that challenge the
   user's deliberate intent are relayed VERBATIM and never self-approved — the
   relay-verbatim rule); (3) push to origin + `gh pr create` with an intent-rich
   body written from conversation context (never from transcripts); (4) the human
   merges — the agent never merges. Note the privacy invariant: the only network
   traffic in the whole flow is git/gh to the project's own origin, in step 3,
   visibly. Keep the skill ≤90 lines.

KNOWN GAPS — flag, don't fix
Root adw_gates.json changes what resolve_gates auto-finds for this repo — that's
intended (the repo now has an explicit gate config). CI mirroring is out of scope.

VERIFICATION
uv run pytest adws/adw_tests/test_ship_gate.py -q → all pass.
Standing-orders gate → green.
Live: uv run adws/pipelines/ship_gate.py --json on THIS repo (feature branch, clean
tree after your edits are the only dirt — note: run it with --skip-precheck since
your working tree will be dirty by design, and say so) → gates run for real, paste
the JSON.

DECISION GATE
- Deliverable: diff + test output + the live --json output.
- STOP: do not modify the M0/M1 docs, do not wire into CI, do not touch travis/.
```
