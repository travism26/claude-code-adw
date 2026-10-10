# Eval health audit checklist

Adapted for this harness from Anthropic's cwc-workshops (https://github.com/anthropics/cwc-workshops, Apache-2.0) `rightmodel` skill
`eval-audit-and-sweep/references/audit.md` (Apache-2.0, © Anthropic PBC).

Run this audit **before trusting a sweep, pinning a baseline, or acting on an
A/B verdict**. A broken eval produces confident-looking numbers that point in
the wrong direction; the most surprising eval results are usually bugs in the
eval, not facts about the model. Findings go in `evals/audits/<date>-audit.md`,
split by severity: (a) things likely to make numbers actively misleading,
(b) things that add noise or limit generality.

Items marked **[auto]** are enforced by `uv run evals/grader_selftest.py`
(add `--judge` for the known-negative judge fixtures, ~2 sonnet calls).
Re-run the selftest whenever `graders.py` changes.

## 1. Task design (`evals/tasks/*.yaml`)

At 9 tasks the whole set is readable in one sitting — read all of them, no
sampling tiers needed. (If the set grows past ~50, adopt the original skill's
three-tier approach: programmatic checks → stratified close-read → per-task
LLM auditor.)

- [ ] **Unambiguous success criteria.** Would two experts agree on pass/fail
      from the `acceptance` checks + `test_command` alone? Flag tasks that are
      under-specified (no crisp target) or over-specified (a step-by-step
      recipe leaving nothing to decide).
- [ ] **Reference solution exists.** Every task should have at least one fully
      `ok` trial in a pinned baseline (`evals/baselines/`). A task at 0% across
      all variants is more often broken than hard.
- [ ] **Ground truth not reachable by the agent.** Task YAMLs (acceptance
      checks, judge_focus) live in the harness and must never be copied into
      the target by `prepare_target()`. Same for `evals/baselines/`.
- [ ] **Label leakage via memory.** `evals/seed_memory*/` deliberately contains
      task answers (e.g. the task-03 id fix) for memory A/B contrast. Confirm
      default runs pass `--no-memory` and seeded runs are labeled as such —
      never compare a `--memory` arm against a memory-off baseline and call it
      a planner difference.
- [ ] **Difficulty headroom.** Check the latest baseline snapshot: if quality
      cells (tests_pass, acceptance_checks) sit at ~1.0 ±0.0, the tier cannot
      discriminate and remaining variance is noise/cost only. Flag saturated
      tiers and propose harder items rather than reading the last few points
      as capability.
- [ ] **Both-directions coverage.** All current tasks are "make a change".
      Consider at least one negative-direction task (a change that should NOT
      touch certain files/tests) so "always edits more" can't score perfectly.
- [ ] **Symptom, not investigation.** Bug tasks should give what a user would
      report, not the failing file/line. (Task 03 walks the repro but not the
      cause — keep new bug tasks at that altitude or vaguer.)
- [ ] **Staleness.** Acceptance shell checks pin paths/strings; re-verify them
      after any target-app refactor (`grep -rq` checks rot silently).

## 2. Harness design (`evals/run_eval.py`, `adws/`)

- [ ] **Clean state per trial.** `prepare_target()` copies the target fresh,
      excludes dev artifacts, commits a git baseline; backend gets a cloned
      node_modules and a dropped/recreated DB. Verify any new target type does
      all three. Watch fixed `/tmp/*` paths in acceptance checks — fine while
      trials are sequential, a collision if they ever parallelize.
- [ ] **Infra failures never scored.** `classify_status()` must keep returning
      `ok | task_fail | infra_error`, with INFRA_ERROR_MARKERS covering any new
      limit/transport errors observed; runner aborts after 2 consecutive infra
      errors. "No answer" (nothing ran) is infra, not a 0.
- [ ] **Eval config matches production.** Trials run the real
      `travis_sdlc.py` with the same flags users run. Diff any divergence
      (currently: `--skip-document`, `--diff-base HEAD`) and keep it listed
      here. Knobs (model/effort/planner) are CLI args, not hard-coded.
- [ ] **Trajectories persisted.** Per-agent JSONL + final object + prompt files
      under `agents/<adw_id>/`; judge raw output and prompt land there too.
      Spot-check after any agent.py change.
- [ ] **Token/context caps won't clip silently.** Judge inputs truncate
      head+tail at MAX_SPEC_CHARS/MAX_DIFF_CHARS with an explicit omission
      marker, and `result.json` records `judge_inputs_truncated`. **[auto]**
      tail survival is a selftest fixture. Before trusting fidelity scores,
      check that truncation fired rarely (or raise the cap).
- [ ] **Transient errors retried.** agent.py retries timeouts/exec errors with
      backoff; retry counts surface via `test_retries_used` and phase results.
- [ ] **[auto] Known-good and known-bad.** `grader_selftest.py` feeds every
      grader correct and deliberately-wrong artifacts; a known-bad scoring
      well fails the selftest.
- [ ] **Reproducible over time.** Scripts pin deps (PEP 723); task set and
      graders are versioned in git. Record the harness git SHA in baseline
      snapshots so "what produced this number" stays answerable.

## 3. Metrics hygiene (`evals/graders.py`, `evals/compare.py`)

- [ ] **Cost from API-recorded tokens.** `total_cost_usd` sums per-agent
      `cc_final_object.json` values — never estimate from string length.
      **[auto]** Judge cost excluded from SUT cost.
- [ ] **Judge cost separate.** `judge_cost_usd` reported in the footer, never
      mixed into SUT cost or scored.
- [ ] **Wall-clock is rig+model.** `wall_minutes` includes agent retries,
      backoff and hang-recovery grace — fine for "what a user experiences",
      but don't read small deltas as model speed. If latency comparisons start
      to matter, split clean attempt time from retry overhead.
- [ ] **Variance reported.** compare.py shows mean ± stdev across trials;
      differences smaller than the spread are not findings. With 3 trials the
      noise floor is large — say so when reporting close calls.
- [ ] **Per-phase breakdown.** Cost/time per phase is derivable from per-agent
      artifacts; add it before attributing cost differences to a phase.

## 4. Grader design (`evals/graders.py`)

- [ ] **[auto] Not too lenient.** Deliberately wrong artifacts (all-fail run,
      deleted test suite, crash output, off-spec diff) must score badly.
- [ ] **[auto] Not overly rigid.** Real pytest and mocha summary shapes must
      parse; exit-code fallback only when no summary exists.
- [ ] **Cheat-resistance.** The agent controls the target's tests; tests_pass
      alone is gameable (weaken/delete asserts). Acceptance checks are the
      independent gate — every task must keep at least one acceptance check
      that exercises behavior, not file presence.
- [ ] **Grades outcomes, not paths.** Graders check results (tests, behavior,
      diff) — keep it that way; never grade tool sequences or phrasing.
- [ ] **Spot-check failures.** After any run with task_fails, read a couple of
      failing transcripts: if >~1 in 10 "failures" are grader misses, fix the
      grader before sweeping.
- [ ] **Grader versioned with results.** Note the graders.py/judge-prompt
      git SHA alongside snapshots; scores across grader versions are not
      comparable.

### Judge-specific (`_call_judge`)

- [ ] **Fixed judge model** (`JUDGE_MODEL`), constant across A/B arms.
- [ ] **Concrete rubric**, outcome-focused, anti-verbosity instruction present.
- [ ] **[auto] Tested on known negatives** (empty spec, empty diff, off-spec
      diff must score ≤1–2/5 via `--judge`).
- [ ] **Self-preference caveat.** Judge and SUT are the same model family;
      treat judge scores as relative signal between arms, not absolute quality.
- [ ] **Determinism unmeasured.** If a judge score drives a decision, re-run
      the judge on the same artifact 2–3× and check the spread first.
- [ ] **Single combined call** scores both dimensions; if dimensions start
      disagreeing with intuition, split into separate independent calls.

## 5. Reporting

Frame findings as observations with evidence (file, task id, snapshot cell),
lead with severity (a), say plainly when things are fine, and offer the small
fix alongside the flag. Treat the suite as living: production failure modes
become new tasks, saturated items get hardened or retired, grader changes
re-run the selftest and re-pin baselines.
