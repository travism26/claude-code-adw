# M4 Results — Slim Pipelines vs. Travis SDLC (A/B Scorecard)

**Status:** M4 validation sweep, **complete** — 18/18 trials both variants.
**Harness commit:** `34ac5d8` — `feat(evals): --engine slim|travis A/B axis for the eval harness`
(both variants ran at this commit; no code changed between or during either sweep).
**Date:** 2026-07-19. **Branch:** `feat/m4-ab-eval`.
**Exit criteria under test:** `docs/slim-pipelines-plan.md` §8 (M4 Validation).

---

## 1. Methodology

- Fixed benchmark suite: tasks `01-feature-tags` … `06-bug-empty-title` (the standard 6-task
  eval set), each run **N=3** independent trials.
- Two variants, same tasks, same model, same harness commit:
  - `m4-travis` — `engine=travis` (`travis_sdlc.py`, the flagship 7-phase orchestrator).
  - `m4-slim` — `engine=slim` (the new `pipe_feature.py` / `pipe_bug.py` pipelines from
    `docs/slim-pipelines-plan.md`).
  - `model=sonnet` for both — no cross-model confound.
- Grading: `evals/graders.py` (code graders: `tests_pass`, `acceptance_checks`, `diff_size`;
  judge graders: `spec_quality`, `implementation_fidelity`, fixed judge model, judge cost tracked
  separately from system-under-test cost). Scorecard rendered with `uv run evals/compare.py`.
- Reliability metric: pass^k (every trial in a task fully solves it — `acceptance_checks==1.0`
  **and** `tests_pass==1.0`) vs. pass@k (at least one trial solves it). Infra-error trials carry no
  scores and are excluded from both, per the harness's audit rule — they are never averaged in as
  failures, only reported as a separate infra-error count.

## 2. What ran — two sweeps, one session-limit interruption in between

The `m4-slim` sweep hit a Claude Code session limit mid-run and had to be split across two
invocations:

- **First invocation** (started 18:23): `01-feature-tags` ran cleanly (3/3 ok). `02-feature-search`
  then took 2 consecutive `infra_error`s — the recorded cause in both trials' `error_tail` was
  `Error: planner agent failed: Claude Code error: You've hit your session limit · resets 7pm
  (UTC)`, a session/rate-limit, not a harness or pipeline bug. The runner's fail-fast
  guard (2 consecutive infra errors) stopped the sweep there, per its own log:
  `Aborting run: 2 consecutive infra errors (likely a session/rate limit). Re-run remaining tasks
  after the limit resets. Done. ok=3 task_fail=0 infra_error=2`. A stray `03-bug-duplicate-id`
  trial-1 result also existed on disk from an earlier, separate slim run (pre-dating this harness
  commit); it was **not** kept — see below.
- **Second invocation**, after the session limit reset (started 19:17, per background-process
  start time): `uv run evals/run_eval.py run --variant m4-slim --engine slim --tasks
  02,03,04,05,06 --trials 3 --model sonnet`. This re-ran `02-feature-search` (all 3 trials, since
  its prior 2 were infra_error and the 3rd never ran) and **all of `03`–`06` from trial 1**,
  including re-running `03-bug-duplicate-id` trial 1 so every `03` trial comes from this harness
  commit rather than the stale pre-commit leftover. Result-file mtimes: `01` trials at
  18:23–18:32 (from the first invocation, untouched by the second), `02`–`06` trials at
  19:20:23–20:03:13 (37 minutes, in line with the ~30–60 min estimate for 15 trials). Final line:
  `Done. ok=15 task_fail=0 infra_error=0` — every trial in the second invocation succeeded, no
  further infra errors.

**Net: both `m4-travis` and `m4-slim` are now complete 18/18-trial sweeps** (6 tasks × 3 trials
each), confirmed by `uv run evals/compare.py --baseline m4-travis`'s footer:

```
m4-travis: 18 trials — ok=18 task_fail=0 infra_error=0 | judge cost=$3.4809 (separate from SUT) | judge issues=0
m4-slim: 18 trials — ok=18 task_fail=0 infra_error=0 | judge cost=$2.9545 (separate from SUT) | judge issues=1
```

(The one judge issue is `01-feature-tags` slim trial 3, unchanged from the first invocation: the
review-phase judge call also hit the session limit — `judge_status: judge_error` — so that
trial's `spec_quality` / `implementation_fidelity` are excluded from the judge averages below,
though its `tests_pass` / `acceptance_checks` / cost / wall-clock are intact and counted.)

## 3. Scorecard

Per-grader averages across all 18 trials per variant (from `compare.py`'s footer table, cross-checked
directly against `result.json`):

| Grader | m4-travis (n=18) | m4-slim (n=18, n=17 for judge graders) | Note |
|---|---|---|---|
| tests_pass | 100% | 100% | |
| acceptance_checks | 100% | 100% | |
| phases_completed | 6 | 0 | frozen travis-shaped field — see §7(a) |
| total_cost_usd | $1.495461 | $1.005260 | valid A/B column |
| wall_minutes | 4.334388 | 3.062128 | valid A/B column |
| diff_size | 208.944 | 215.333 | |
| spec_word_count | 1066 | 0 | frozen travis-shaped field — see §7(a) |
| spec_quality (judge) | 5.00/5 | 0/5 | frozen travis-shaped field — see §7(a) |
| implementation_fidelity (judge) | 4.94/5 (n=18) | 4.59/5 (n=17) | valid A/B column (behavioral judge grader) |

Per-task pass rate, cost, and wall-clock, computed directly from `result.json` (mean and median
over all 3 ok trials per task — every cell below is now a real n=3):

| Task | Engine | n (ok/total) | Pass rate | Avg cost | Median cost | Avg wall (min) | Median wall (min) |
|---|---|---|---|---|---|---|---|
| 01-feature-tags | travis | 3/3 | 100% | $1.793574 | $1.789239 | 5.210477 | 5.178904 |
| 01-feature-tags | slim | 3/3 | 100% | $1.200498 | $1.289340 | 4.279142 | 4.131437 |
| 02-feature-search | travis | 3/3 | 100% | $1.469717 | $1.432198 | 4.249733 | 4.340234 |
| 02-feature-search | slim | 3/3 | 100% | $0.957141 | $0.941067 | 2.840481 | 2.783092 |
| 03-bug-duplicate-id | travis | 3/3 | 100% | $1.191329 | $1.180346 | 3.213840 | 3.235745 |
| 03-bug-duplicate-id | slim | 3/3 | 100% | $0.789216 | $0.789577 | 1.992660 | 2.013451 |
| 04-chore-rename-field | travis | 3/3 | 100% | $1.582252 | $1.612713 | 4.553183 | 4.539671 |
| 04-chore-rename-field | slim | 3/3 | 100% | $0.930722 | $0.909178 | 2.661437 | 2.514414 |
| 05-feature-export-json | travis | 3/3 | 100% | $1.483437 | $1.550038 | 4.438563 | 4.672231 |
| 05-feature-export-json | slim | 3/3 | 100% | $1.180027 | $1.144710 | 3.433535 | 3.488579 |
| 06-bug-empty-title | travis | 3/3 | 100% | $1.452460 | $1.505795 | 4.340531 | 4.507837 |
| 06-bug-empty-title | slim | 3/3 | 100% | $0.973957 | $0.981223 | 3.165510 | 3.254067 |

Overall (all 18 ok trials per variant): travis avg cost **$1.495461** / median **$1.506089**;
avg wall **4.334388** min / median **4.424577** min. Slim avg cost **$1.005260** / median
**$0.961145**; avg wall **3.062128** min / median **3.234415** min.

## 4. Deltas (slim vs. travis)

Per-task deltas — every one of the 6 tasks now has a real 3-vs-3 comparison:

| Task | Cost Δ | Cost Δ% | Wall Δ | Wall Δ% |
|---|---|---|---|---|
| 01-feature-tags | −$0.593076 | **−33.07%** | −0.931335 min | **−17.87%** |
| 02-feature-search | −$0.512576 | **−34.88%** | −1.409252 min | **−33.16%** |
| 03-bug-duplicate-id | −$0.402113 | **−33.75%** | −1.221180 min | **−38.00%** |
| 04-chore-rename-field | −$0.651530 | **−41.18%** | −1.891746 min | **−41.55%** |
| 05-feature-export-json | −$0.303410 | **−20.45%** | −1.005028 min | **−22.64%** |
| 06-bug-empty-title | −$0.478503 | **−32.94%** | −1.175021 min | **−27.07%** |

Pooled (all 18 ok trials each engine): cost travis $1.495461 → slim $1.005260, Δ
**−$0.490201 (−32.78%)**; wall travis 4.334388 min → slim 3.062128 min, Δ
**−1.272260 min (−29.35%)**.

**5 of 6 tasks individually clear ≥30% cost reduction (range −32.94% to −41.18%); one task,
`05-feature-export-json`, does not (−20.45%).** The pooled/aggregate cost reduction
(**−32.78%**) clears the 30% bar comfortably — it is not an artifact of averaging a few big
wins over many small ones; five of the six per-task numbers individually clear it too. See §8 for
how this cuts against the plan's exact wording ("≥30% cost reduction on gate-heavy tasks").

## 5. pass^3 (reliability)

pass^3 requires **all 3 trials** of a task to fully solve it (`acceptance_checks==1.0` and
`tests_pass==1.0`). Every task, both engines, is now a genuine n=3 pass^3 result:

| Task | travis pass^3 | slim pass^3 |
|---|---|---|
| 01-feature-tags | **True** (3/3 solved) | **True** (3/3 solved) |
| 02-feature-search | **True** (3/3 solved) | **True** (3/3 solved) |
| 03-bug-duplicate-id | **True** (3/3 solved) | **True** (3/3 solved) |
| 04-chore-rename-field | **True** (3/3 solved) | **True** (3/3 solved) |
| 05-feature-export-json | **True** (3/3 solved) | **True** (3/3 solved) |
| 06-bug-empty-title | **True** (3/3 solved) | **True** (3/3 solved) |

**Travis: 6/6 tasks pass^3. Slim: 6/6 tasks pass^3.** `compare.py`'s reliability table reports
`pass@k / pass^k` totals of `6/6 / 6/6` for both variants — this is now a fully validated parity
claim at k=3, not a partial one.

## 6. Fix-loop activation (slim only)

Counted every slim `result.json`'s `slim_state.phase_results` for keys starting `fix-`/`fix_` (the
loop-back edge from `docs/slim-pipelines-plan.md` §6.2 — a failed fast gate routes back to a
fixer agent, recorded as `fix-{i}` in phase_results). All 18 slim trials:

```
phase_results = [plan, build, gates, review]  — every one of the 18 trials, no exceptions
iterations = [{gate: unit, passed: true, timed_out: false}]  — every one of the 18 trials
```

**Fix-loop activations: 0 / 18 trials.** Every trial reached the gate stage and passed its unit
gate on the first iteration (`iters: 1`, `passed: true`); no trial recorded a `fix-N` phase or a
`passed: false` iteration. The loop-back edge that is the load-bearing claim of the slim design
(§8.2 of the plan: "the load-bearing check that the diagram's ✗ edge works") **did not fire once**
across all 18 trials — not because it's broken, but because none of the ok trials produced a
gate-failing diff, even at the full 18-trial sample size. This sample still cannot speak to
loop-back correctness or its cost; that requires either the planted-failure smoke test called out
in the plan's §8 item 2 (a separate, deliberate-failure check) or a harder task suite that
actually provokes gate failures — an 18-trial A/B on tasks the model solves reliably will not
exercise the loop-back edge by chance regardless of sample size.

## 7. Honesty notes (required)

**(a) Frozen travis-shaped grader fields read zero/absent for slim by design.**
`phases_completed`, `spec_word_count`, and the judge's `spec_quality` all come from parsing
travis-specific state (`travis_state.json` phase list, the `specs/*.md` word count via the travis
plan-phase contract). The slim engine writes a different state shape
(`pipeline_state.json` / `slim_state`) with no equivalent fields, so these graders correctly read
`0` (or, for `spec_quality`, `0/5` because the judge is fed an empty spec input) for every slim
trial. **This is not a slim regression** — it's an artifact of graders that were never updated to
also parse `slim_state`. Do not read the `phases_completed: 6 → 0` or `spec_quality: 5/5 → 0/5`
rows in the scorecard as "slim produces fewer phases" or "slim writes worse specs." The valid
apples-to-apples columns for this A/B are: `tests_pass`, `acceptance_checks`, `total_cost_usd`,
`wall_minutes`, `diff_size`, and `implementation_fidelity` (the judge grader that reads the git
diff directly, not engine-specific state).

**(b) Suite saturation was expected — parity-at-100% is not a finding.** Both engines land at
100% `tests_pass`/`acceptance_checks` on every task, every trial (18/18 each). This 6-task suite
has been saturated by sonnet since earlier milestones — a harder eval tier is needed to show
any upside; §8 of the slim-pipelines plan explicitly predicts this ("expect
parity on pass rate (suite is saturated — that's fine, parity is the bar)"). The differentiating
signal in this sweep is **cost and wall-clock**, not pass rate — which is exactly why §4 above is
the section that matters for the verdict, not §3's pass-rate row.

**(c) Travis `04-chore-rename-field` trial 1 was re-run after an interrupted sweep.** The
`m4-travis` sweep (run earlier, in a prior working session) was interrupted partway through and
resumed; `04-chore-rename-field` trial 1 is the re-run result, not the original attempt. Its
scores are unremarkable relative to its own task's other two trials (cost $1.612713 vs. task
median; no outlier), so it is kept in the dataset, but it is flagged here rather than silently
averaged in as if the sweep ran straight through.

**(d) `m4-slim` was itself assembled from two invocations either side of a session-limit reset**
(§2). `01-feature-tags` (3/3) is from the first invocation (18:23–18:32); `02`–`06` (15/15) are
from the second, run after the limit reset, and — per the task brief driving this update —
`03-bug-duplicate-id` was **fully re-run** in the second invocation (not just its missing trials)
so that no `03` result predates this harness commit. No task's trials are split across the two
invocations; the split is clean at task boundaries. The only cross-invocation risk this creates
is a wall-clock/cost confound if ambient conditions (API load, etc.) differed between 18:23 and
19:17–20:03 — there is no way to rule this out from the data alone, but the two invocations are
~1 hour apart, same day, same model, same harness commit, and the resulting numbers (e.g. task 01
at $1.200498 avg from the first invocation vs. task 02's $0.957141 from the second) do not show
an obvious systematic shift in either direction.

**(e) `m4-slim` trial `01-feature-tags`/3's advisory review agent hit the session limit mid-run —
folded into `ok` by design, cost effect is small and favors slim.** Per §2's parenthetical, this
trial's judge call hit the session limit too (`judge_status: judge_error`), so its `spec_quality`/
`implementation_fidelity` are already excluded from the judge averages. Separately — and this is
the disclosure required here — the **review agent itself** (not just the judge) hit the session
limit on its very first turn: `agents/<run-id>/reviewer/cc_raw_output.jsonl` shows
`total_cost_usd: 0`, zero input/output tokens, `api_error_status: 429`, and the agent never wrote a
`cc_final_object.json`. `evals/graders.py`'s `grade_total_cost_usd` only sums agents that have one,
so this trial's recorded `total_cost_usd` ($0.908823 = planner $0.330453 + builder $0.578370 only)
carries **zero dollars of review cost**, unlike every other slim trial. Because `pipe_feature.py`'s
review phase is non-blocking (`overall_success` stayed `true`), this trial is correctly scored
`ok` with legitimate `tests_pass`/`acceptance_checks`/cost/wall-clock — the fix-round update to
`classify_status_slim`/`slim_advisory_review_infra` (harness fix round after this doc was written)
confirms this classification and additionally records `advisory_review_infra: true` for trials
like this one going forward.

Magnitude and direction of the cost effect: the mean review-agent cost across the other 17
`m4-slim` trials (every trial whose reviewer did write a `cc_final_object.json`) is **$0.3179**.
Trial 3's `total_cost_usd` is missing that component entirely, so it is the one slim trial not
measuring a complete review pass — its cost is understated by roughly $0.3179 relative to a trial
where review ran to completion. Pooled across all 18 slim trials, this pulls the slim
`total_cost_usd` mean ($1.005260) down by approximately **$0.3179 / 18 ≈ $0.018** versus what it
would read with this trial's review cost fully measured — **slightly favoring slim**, since it
makes the reported travis→slim cost reduction (§4, pooled −32.78%) marginally larger than it would
be with a complete review cost included. The effect is small (≈1.8% of the slim mean, well within
the trial-to-trial noise visible in §3's per-task table) and does not change any of §8's
conclusions; it is disclosed here per the audit rule against silently averaging in a partial
measurement as if it were complete.

## 8. Verdict — M4 exit criteria (`docs/slim-pipelines-plan.md` §8)

The plan states three exit criteria: **(1) parity pass-rate, (2) ≥30% cost reduction on
gate-heavy tasks, (3) zero regressions in existing `adw_tests`.** This scorecard speaks to (1) and
(2) with a complete 18-vs-18 dataset; (3) is out of scope for this doc (no `adw_tests` run was
requested or captured here).

1. **Parity pass-rate: MET, fully.** Every task, every trial, both engines: 100%
   `acceptance_checks` and `tests_pass` (18/18 each variant). pass^3 is `True` for all 6 tasks on
   both engines (§5) — this is a genuine, complete N=3×6 parity result, not a provisional one.

2. **≥30% cost reduction: MET on the pooled/aggregate reading; one task falls short on the
   per-task reading.** The plan's wording ("≥30% cost reduction on gate-heavy tasks") doesn't
   unambiguously specify pooled-vs-per-task, so both are reported without rounding toward either
   answer:
   - **Pooled, all 18 ok trials each engine: −32.78%** (travis $1.495461 → slim $1.005260) —
     clears the bar with room to spare, and is corroborated by wall-clock (−29.35% pooled, a
     related but non-gating signal).
   - **Per-task: 5 of 6 tasks individually clear ≥30%** (`01`: −33.07%, `02`: −34.88%, `03`:
     −33.75%, `04`: −41.18%, `06`: −32.94%). **`05-feature-export-json` does not** (−20.45%) — it
     is the one task where slim's cost advantage, while still real and directionally consistent,
     falls meaningfully short of the 30% bar.
   - Taking the pooled aggregate as the operative reading (consistent with how §8 item 3 of the
     plan frames the expectation — "materially lower cost and wall-clock" as an overall
     characterization of the A/B, not a per-task minimum), **this criterion is MET**. Taking a
     strict every-task reading, it is **not met** on 1 of 6 tasks. Both readings and their exact
     numbers are given above so this can be re-judged either way.

3. **Zero regressions in `adw_tests`: NOT EVALUATED** by this scorecard.

**Overall: M4 exit criteria (1) and (2) are MET on the complete 18/18 dataset**, on the pooled
reading that the plan's own framing supports — parity pass-rate is unambiguous and complete, and
the aggregate cost reduction (−32.78%) clears the 30% bar with margin, backed by wall-clock
moving in the same direction (−29.35% pooled). The one caveat worth carrying forward: task
`05-feature-export-json` alone does not clear 30% cost reduction (−20.45%), so a strict
per-task reading of the exit criterion would call this a 5-of-6 result, not 6-of-6. Criterion (3)
(`adw_tests` regressions) remains **unevaluated** — recommended next step before treating M4 as
fully closed. The fix-loop loop-back edge (§6) still has zero activations across 18 trials, which
this A/B was never designed to exercise; that remains a separate, deliberate-failure validation
task (plan §8 item 2), not something this scorecard can speak to.
