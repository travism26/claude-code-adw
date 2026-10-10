# M1 epic — slim-pipeline engine (tiered execution)

Source: `docs/slim-pipelines-plan.md` §5–§6 (layout, gate model, build loop, gate resolution).
Branch: `feat/m1-pipeline-engine`. Orchestrator reviews every diff before commit.
M1 acceptance (plan §11): unit tests green (incl. slow-runs-at-most-twice + timeout kill);
`--print-gates` resolves on evals/target_cli, a JS repo (evals/target_frontend), and a
fixture pom.xml.

## Standing orders

- Gate command: `uv run pytest adws/adw_tests/test_model_selection.py adws/adw_tests/test_webhook_simplified.py adws/adw_tests/test_travis_test_parsing.py -q` plus the new test file(s) your brief adds. Do NOT run pytest on the whole `adw_tests/` dir — some files there are manual live-LLM scripts.
- Python style: match `adws/` conventions — stdlib + pydantic/dotenv only, manual `sys.argv` parsing for CLIs (no argparse/click), `sys.path.insert` import pattern as in existing modules/tests. New engine modules use plain dataclasses (stdlib `dataclasses`), not pydantic, unless serializing.
- The INTERFACE CONTRACT between briefs is `docs/slim-pipelines-plan.md` §6.1's `Gate`/`GateResult` dataclasses — implement/import them EXACTLY as written there (field names, defaults, order).
- All new engine code lives in `adws/pipelines/` (new package). DON'T TOUCH: `adws/travis/`, `adws/adw_modules/` (import-only), `adws/adw_triggers/`, `template_claude/`, `evals/` targets' contents (reading them is fine), `agents/`, `trees/`, `logs/`.
- No LLM calls anywhere in unit tests — fake `execute_template` via monkeypatch/injection.
- Do NOT commit; leave changes in the working tree.
- Keep diffs minimal; comment only what code can't say (constraints), no narration.

---

## T1 — core.py + pipeline_state.py + tests [x]

```
GOAL
Build the slim-pipeline engine core: the Gate/GateResult model, run_gates(), the
two-stage build_loop() (fast loop + slow-once), and PipelineState — so pipelines (M2)
and the repo ship gate can compose it. Production.

SCOPE
- NEW files only: adws/pipelines/__init__.py (empty), adws/pipelines/core.py (~180
  lines), adws/pipelines/pipeline_state.py (~80 lines),
  adws/adw_tests/test_pipeline_core.py.
- REUSE: adws/adw_modules/agent.py execute_template + AgentTemplateRequest (import,
  never modify). Mirror adws/travis/travis_state.py's load/save/dir conventions for
  PipelineState but write agents/<adw_id>/pipeline_state.json with the §6.4 schema.
- DON'T REBUILD: no TUI, no memory injection, no worktrees, no resume, no retries of
  the agent transport (execute_template already retries).

WHAT TO BUILD
1. core.py: Gate + GateResult dataclasses EXACTLY per plan §6.1 (Gate: name, command,
   slow=False, timeout_s=300; GateResult: gate, passed, timed_out, output_tail).
   run_gates(gates, cwd, state=None) -> Optional[GateResult]: run each gate in order
   via subprocess.run(shell=True, cwd=cwd, capture_output, timeout=gate.timeout_s);
   slow gates default timeout 1800 when timeout_s not explicitly set by config (see
   gates.py note — implement as: resolution layer sets it; core just honors the field).
   On timeout: kill, GateResult(timed_out=True, passed=False). Return first failing
   GateResult (output_tail = last ~200 lines of combined stdout+stderr), None if all
   pass. Append every result to state when given.
2. core.py: build_loop(state, build_request, gates, max_iters=3, agent_runner=None)
   -> bool, EXACTLY the two-stage structure of plan §6.2: run build agent once; fast
   loop (fast gates only, /fix_gate agent per failure, max_iters bound); then slow
   gates ONCE with ONE fix-and-rerun. agent_runner defaults to execute_template —
   injectable for tests. Fixer requests: slash_command="/fix_gate",
   args=[failed.gate, failed.output_tail], agent_name=f"fixer-{i}" (and "fixer-slow"),
   same adw_id/working_dir as build_request. Record every phase + iteration in state.
3. pipeline_state.py: PipelineState with adw_id, pipeline, prompt, working_dir,
   plan_file, iterations[], phase_results{}, overall_success — load/save to
   agents/<adw_id>/pipeline_state.json (schema per plan §6.4; same directory
   convention as travis_state.py, DIFFERENT filename).
4. test_pipeline_core.py (no LLM, no real slow commands — use `true`/`false`/`sleep`
   shell commands and injected fake agent_runner):
   (a) run_gates ordering: first failing gate returned, later gates not run;
   (b) all-pass returns None;
   (c) timeout: gate with command "sleep 5", timeout_s=1 → timed_out=True within ~2s;
   (d) build_loop: failing fast gate → fixer invoked, gate re-run; converges when the
       fake runner "fixes" (test controls a flag/file the gate command checks);
   (e) max_iters exhaustion → False, loudly recorded in state;
   (f) SLOW ECONOMICS (the load-bearing test): a slow gate that always fails runs
       EXACTLY TWICE (count via a side-effect file its command appends to) and the
       fast loop never runs it;
   (g) slow gate absent → stage 2 skipped entirely;
   (h) state file written with iterations + phase_results + overall_success.

KNOWN GAPS — flag, don't fix
/fix_gate template doesn't exist yet (M2 ships it with pipe_chore) — engine references
it by name only; fake runner covers tests. gates.py resolution is the parallel brief
T2 — do NOT write gates.py; core.py must not import it.

VERIFICATION
uv run pytest adws/adw_tests/test_pipeline_core.py -q → all pass.
Standing-orders gate → green.

DECISION GATE
- Deliverable: diff + gate output + one-paragraph confirmation that build_loop
  structurally caps slow-gate executions at 2 (point to the code lines).
- STOP: do not write gates.py, pipe_*.py, or templates.
```

## T2 — gates.py resolution + --print-gates + tests [x]

```
GOAL
Build gate resolution: adw_gates.json (explicit, wins) → fast-only auto-detect
profiles, plus a --print-gates dry-run CLI — so any repo's gate wiring is inspectable
in one second and the engine stays language-blind. Production.

SCOPE
- NEW files only: adws/pipelines/gates.py (~120 lines),
  adws/adw_tests/test_pipeline_gates.py, plus tiny fixture files UNDER
  adws/adw_tests/fixtures/gates/ (a pom.xml, a package.json, a pyproject.toml —
  minimal valid stubs for auto-detect tests).
- IMPORT the Gate dataclass from adws.pipelines.core (being written in a parallel
  brief to the EXACT §6.1 spec). If core.py doesn't exist yet when you test, define
  your tests to import Gate from gates.py's own re-export
  (`from pipelines.core import Gate` at top of gates.py) and note it — do NOT
  duplicate the dataclass.
- DON'T TOUCH: evals/ target contents (READ their adw_gates.json/package.json only),
  everything in the epic-wide list.

WHAT TO BUILD
1. resolve_gates(repo_dir) -> list[Gate]:
   a. If <repo_dir>/adw_gates.json exists: parse {"gates":[{name, command,
      slow?, timeout_s?}...]} → Gates in file order. slow defaults False; timeout_s
      defaults 300 fast / 1800 slow. Malformed file → raise GateConfigError with a
      clear message (fail closed, never silently fall through to auto-detect).
   b. Else AUTO-DETECT, fast gates only (NEVER slow — plan §6.3 rule):
      - package.json: for each of scripts lint, format (as check), test →
        Gate("lint","npm run --silent lint")... only scripts that exist; prepend
        typecheck if a tsconfig.json exists and a typecheck script exists.
      - pyproject.toml: Gate("lint","uv run ruff check .") if ruff configured or
        installed-agnostic default; Gate("unit","uv run pytest -q") if tests/ or
        pytest config detected.
      - pom.xml: Gate("compile","mvn -q -DskipTests compile"),
        Gate("unit","mvn -q test").
      - build.gradle/settings.gradle: Gate("compile","gradle -q compileJava"),
        Gate("unit","gradle -q test").
      - Cargo.toml: clippy + cargo test; go.mod: go vet + go test ./... .
      Keep each profile ~5 lines, data-driven (a PROFILES table, not if-trees).
   c. Nothing detected → return [] and the CALLER prints the loud "0 gates
      configured" warning; resolve_gates itself also logs it.
2. CLI: `uv run python adws/pipelines/gates.py --print-gates [--working-dir DIR]`
   prints one line per gate: name, fast|slow, timeout_s, command, plus the resolution
   source ("adw_gates.json" | "auto-detect:<profile>" | "none"). Exit 0 even for 0
   gates (it's a dry inspection), exit 1 on GateConfigError.
3. test_pipeline_gates.py (tmp_path-based, no network, no real npm/mvn runs):
   (a) adw_gates.json parsed: order, slow flag, timeout defaults (300/1800), explicit
       timeout honored;
   (b) malformed adw_gates.json → GateConfigError (NOT auto-detect fallback);
   (c) auto-detect per fixture: package.json (only existing scripts), pom.xml
       (compile+unit), pyproject.toml — and NO slow gates ever from auto-detect;
   (d) empty dir → [];
   (e) config wins over auto-detect when both present.
4. Live resolution proof for the report (run, paste output): --print-gates against
   evals/target_java (reads its adw_gates.json → 3 gates incl. slow integration),
   evals/target_cli, and evals/target_frontend (auto-detect or their configs —
   whatever they actually resolve to; report honestly, including "none" if a target
   has nothing detectable).

KNOWN GAPS — flag, don't fix
Auto-detect quality is best-effort by design (plan §12): wrong guesses fail loudly at
gate-run time and adw_gates.json is the override. No slow-gate auto-detection ever.

VERIFICATION
uv run pytest adws/adw_tests/test_pipeline_gates.py -q → all pass.
Standing-orders gate → green. Paste the three --print-gates outputs.

DECISION GATE
- Deliverable: diff + gate output + the three real --print-gates outputs.
- Question: what did target_cli and target_frontend actually resolve to? (informs M2
  smoke-target choice)
- STOP: do not write pipe_*.py or wire anything into evals runners.
```
