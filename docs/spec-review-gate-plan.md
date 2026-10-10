# Implementation Plan — Human-in-the-loop Spec Review Gate

**Status:** shipped. PR1 (`human` mode) and PR2 (`auto` mode) are implemented in
`adws/adw_modules/spec_reviewer.py`; PR3 (the spec-defect eval tier) is in `evals/tasks/`.
**Decision (2026-06-27):** Ship **Option A** — an *opt-in* `--review-spec` flag built on the
existing `--resume` machinery. Headless stays the default; a blocking gate is never forced on
eval/cron/AFK runs. A pluggable reviewer abstraction leaves the door open to an `auto` (LLM
spec-critic) mode, which is also what makes the feature eval-able.

---

## 1. Goal & current state

The pipeline (`adws/travis/travis_sdlc.py`) runs
`PHASE_ORDER = ["research","plan","build","validate","test","review","document"]`
(`travis_sdlc.py:108`). The `plan` phase writes a spec to `specs/{plan_type}-{adw_id}-{name}.md`
and the `build` phase **immediately** consumes it (`travis_sdlc.py:734-765`). The only human
checkpoint today is `--draft-pr`, which reviews *code after it is written* — by then build tokens
are spent and a bad spec has already propagated through build → validate → test → review.

**Desired behavior:** with `--review-spec`, the pipeline stops after a successful `plan`, surfaces
the spec for a human to read/edit, and only proceeds to `build` once the human resumes. No change
to default (headless) behavior.

## 2. Why this design (recap)

- **Cheapest, highest-leverage checkpoint.** A wrong spec caught here saves a full build; with
  `--attempts N` it saves N builds.
- **Must not break headless.** `adw_modules/risk_gate.py` is explicit: "in a headless pipeline
  there is no human attached." So the gate is **opt-in and off by default**.
- **Reuse, don't reinvent.** Resume already restarts from the first incomplete phase
  (`get_resume_phase`, `travis_sdlc.py:158-178`). After a pause, `plan` is recorded complete and
  `build` is not — so `--resume <id>` naturally continues at `build` with **zero** new resume logic.

## 3. Reviewer abstraction

`--review-spec[=MODE]` where MODE ∈ `{human, auto}` (default `human`):

| Mode | Behavior | Ships | Purpose |
|------|----------|-------|---------|
| `human` | Pause after plan, write review pointer, exit 0. Human edits spec, then `--resume`. | **Now** | The headed safety gate this plan was written for. |
| `auto`  | Run an LLM spec-critic inline; on approve continue, on edit apply patch then continue, on reject fail-closed. **No pause.** | Fast-follow | Enables headless evals + a `warn`-style value-add with zero human latency. |

`human` is the deliverable; `auto` is specced here because the **eval** (§6) depends on it and it is
the natural Option-C `warn` fast-follow. Both share the same pause-point and pointer artifact.

## 4. Implementation — `human` mode (ship now)

All changes are in `adws/travis/`. No new files required beyond the review-pointer JSON.

### 4.1 Flag parsing — `travis_sdlc.py`
- Add a boolean `review_spec` initialized from env: `review_spec = os.environ.get("ADW_REVIEW_SPEC") == "1"`
  (mirrors how `--risk-gate` pairs with `ADW_RISK_GATE`).
- In the manual arg loop (`travis_sdlc.py:368-531`), add a branch next to `--risk-gate`
  (`:417-419`). Accept both bare `--review-spec` (→ `human`) and `--review-spec=auto`:
  parse the optional `=MODE`, validate `MODE ∈ {human, auto}`, store `review_spec_mode`.
- Add the flag to the two usage strings (`:9` and `:325`) and the docstring flag list (`:78`).

### 4.2 The pause point — between plan and build
Insert immediately **after** the planner loop (`travis_sdlc.py:732`) and **before** Phase 2 build
(`:734`):

```
if review_spec and not resume_mode and all_success:
    # plan succeeded; travis_plan.py has already persisted phase_results["plan"]
    write_spec_review_pointer(adw_id, working_dir, ...)   # see 4.3
    print_spec_review_instructions(adw_id, spec_file)
    # draft-PR: plan commit is already pushed; surface the spec path on the PR
    return  # exit 0 — pipeline is paused, NOT failed
```

Key correctness points (verified against the code):
- **Guard on `not resume_mode`** so the gate fires only on the first pass. On `--resume`,
  `resume_mode` is `True`, the gate is skipped, and `should_skip_phase("build")` returns `False`
  (`get_resume_phase` returns `build` as the first incomplete phase), so build runs. **No resume
  changes needed.**
- **Guard on `all_success`** so we never pause after a failed/blocked plan.
- Exit must be **`return` with success exit code**, not an error — a paused run is not a failed run.
- The spec path is read from state: `TravisState.load(adw_id).get("plan_file")` (renamed from
  `spec_file` per ADR-0001).

### 4.3 State & the review pointer
- Add `"spec_review"` to the default state dict (`travis_state.py:48-54`) so `update()` will accept
  it (note: `update()` only writes keys already present — `travis_state.py:106-108`).
  Shape: `{"status": "awaiting_approval" | "approved", "plan_file": str}`.
- Write a **human-facing pointer** `agents/{adw_id}/spec_review.json`:
  ```json
  { "adw_id": "...", "spec_file": "specs/feature-...-name.md",
    "status": "awaiting_approval",
    "resume_command": "uv run adws/travis/travis_sdlc.py <prompt> <adw_id> --resume",
    "instructions": "Read/edit the spec file, then run resume_command to build it." }
  ```
- On resume, optionally flip `spec_review.status` to `approved` for auditability (cosmetic; resuming
  *is* the approval in this model).

### 4.4 Terminal output
Print a clear, copy-pasteable block: the spec path, "review/edit it", and the exact `--resume`
command. This is the entire UX of `human` mode.

### 4.5 What we explicitly do NOT build
- No interactive blocking prompt inside the subprocess phases (awkward under worktrees; that was the
  reason to reject Option B).
- No "reject" code path: rejecting = "don't resume" (or edit the spec, then resume). Re-planning =
  re-run with a sharper prompt.

## 5. Implementation — `auto` mode (fast-follow, enables evals)

- New module `adw_modules/spec_reviewer.py` exposing `review_spec(spec_path, prompt, model) ->
  {verdict: approve|edit|reject, edited_spec: str|None, notes: str}`. Implemented as a single
  agent call (reuse `adw_modules/agent.py`) with a critic prompt: "Given the original request and
  this spec, is the spec correct and complete? Approve, propose an edited spec, or reject with
  reasons."
- At the same pause point, when `review_spec_mode == "auto"`: call the critic inline instead of
  pausing. `approve` → continue; `edit` → overwrite the spec file, continue; `reject` →
  `all_success = False; failed_phase = "SpecReview"` (fail-closed, like plan).
- Record judge cost separately (the eval harness already isolates `judge_cost_usd`,
  `evals/graders.py`), so the gate's cost is attributable.

## 6. Eval design

The harness invokes `travis_sdlc.py` as a subprocess per trial (`evals/run_eval.py:303`), so a
*pausing* `human` gate cannot be exercised headlessly — the eval drives the `auto` reviewer instead.

### 6.1 New task tier — spec-defect tasks (`evals/tasks/`)
Mirror the existing "planted bug is load-bearing" pattern, **one phase earlier**: the prompt is
crafted so a naive plan yields a *spec-level* defect (wrong acceptance criterion, missing edge
case, off-by-one in the contract). Add a deterministic oracle: "does the reviewer surface/fix the
planted spec defect?" Keep these in a `spec-defect` tier separate from the saturated suite.

### 6.2 Variants
- **A (control):** no gate — current pipeline.
- **B (treatment):** `--review-spec=auto` with the LLM critic.
Run N=3 trials each (existing convention), `compare.py` scorecard with `--baseline A`.

Wired into `evals/run_eval.py` via a `--review-spec` flag (appends `--review-spec=auto`
to the SDLC command). Concrete A/B on the spec-defect tier:

```
uv run evals/run_eval.py run --variant A_nogate    --tasks 14 --trials 3
uv run evals/run_eval.py run --variant B_specgate  --tasks 14 --trials 3 --review-spec
uv run evals/compare.py --baseline A_nogate
```

The `spec_review_flagged` grader (1=revise/reject, 0=approve, "-"=gate off) reports the
catch rate on variant B; `acceptance_checks` is the downstream-outcome metric to compare A vs B.

### 6.3 Metrics
1. **Gate catch rate** — on spec-defect tasks, fraction where the reviewer flags/fixes the planted
   defect (the core signal).
2. **Downstream task success (pass^k)** — does an approved/edited spec raise end-to-end success vs
   control, and at what added cost (judge cost tracked separately).
3. **False-alarm rate** — on *clean* tasks, how often the reviewer edits/rejects a good spec. This
   is the review-fatigue proxy; a high rate is a real cost.

### 6.4 Honest caveat
The existing suite is saturated and the memory A/B came out cost-neutral for lack of headroom. The
spec-defect **hard tier** is what gives this eval signal; without it, expect a no-op result.

## 7. Rollout / sequencing

1. **PR 1 — `human` mode:** ✅ done. `--review-spec[=human|auto]` flag (+ `ADW_REVIEW_SPEC`),
   the pause point between plan and build, `agents/<id>/spec_review.json` pointer, resume guard
   (`not resume_mode`), `spec_review` in state. Verified: helper writes pointer + sets
   `awaiting_approval`; bad mode rejected; 6/6 existing harness tests still pass.
2. **PR 2 — `auto` mode + reviewer module:** ✅ done. `adw_modules/spec_reviewer.py`
   (`review_spec` → `SpecVerdict{approve|revise|reject}`, mirrors `bestof.judge_candidate`), wired
   inline at the gate; `reject` and any read/parse error fail closed (verified). Live LLM path not
   yet exercised end-to-end.
3. **PR 3 — eval tier + variant B wiring:** ✅ scaffolding done. `--review-spec` flag in
   `run_eval.py` (variant B), `spec_review_flagged` grader (registered; grader self-test still
   passes), and `evals/tasks/14-specdefect-rename-guard.yaml` (first spec-defect task). **Live
   reviewer smoke (real sonnet calls):** defective spec → `revise` (caught the missing empty-title
   guard, edited the spec in place); genuinely complete spec → `approve`, zero concerns; a
   near-complete spec missing one test → `revise` (a legitimate catch). The reviewer discriminates —
   it is not a rubber stamp. **Still pending:** a full N=3 A/B run on task 14 to measure catch rate,
   downstream `acceptance_checks` lift, false-alarm rate, and added cost (the saturation caveat in
   §6.4 still applies — may need more spec-defect tasks for signal).

## 8. Risks & open questions

- **Resume ergonomics:** `human` mode is two invocations. Acceptable for an opt-in safety flag;
  revisit only if it becomes a common path.
- **Worktree interaction:** when `--worktree` is set, the spec lives in `trees/adw-<id>/specs/...`.
  The pointer must record the worktree-relative path and the resume command must target the same
  worktree. Verify against `--worktree` resume behavior before shipping.
- **Draft-PR surfacing:** the plan commit is already pushed when the gate fires; decide whether to
  post the spec as a PR comment/checklist item or leave it to the terminal pointer (cosmetic, can
  defer).
- **Open question:** should `human`-mode resume *require* an explicit approval token (stricter) or
  treat resuming as implicit approval (simpler)? Plan assumes implicit; flip only if audit needs it.
