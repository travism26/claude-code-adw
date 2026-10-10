# Development Workflow — spec → branch → verify → gate → PR

A portable, agent-friendly workflow for shipping changes with an AI coding assistant (e.g. Claude Code)
without letting speed turn into sprawl or unreviewed pushes. It pairs a **human sign-off loop** with
**local pre-push checks** and a **PR-based merge**.

> **Portable by design.** The workflow shape is project-agnostic. The parts that _are_ project-specific —
> this repo's test commands, its non-negotiables, its authorship rules — are called out as **plug-in
> points** and filled in for this repo in §5 and §8. Copy this file into another project and re-fill those
> two sections.
>
> **Adapted for this repo.** This is the claude-code-adw harness — a set of
> `uv run` scripts under `adws/` plus an `evals/` benchmark. It has no compiled build, no typecheck/lint
> tooling, and no CI workflow; its "local checks" are credential-free `uv run` self-tests (§5.1). Keep
> that in mind wherever this doc says "typecheck / lint" — here that maps onto the self-test suite.

---

## 1. Why this shape

AI assistants produce working code fast, but fast code accumulates duplication, dead paths, and
unreviewed decisions even faster. Two forces keep it healthy:

- **A human stays in the loop at decision points** — spec, plan, and the final merge — not on every line.
- **A machine gate runs before anything reaches the shared branch** — review, tests, lint, docs, CI — so
  "it runs on my laptop" is never the bar for shipping.

The result: the assistant does the mechanical work and self-verifies; the human approves direction and
owns the merge; a gate catches what both missed.

---

## 2. The loop

```
Specify ─▶ Plan ─▶ Tasks ─▶ Implement ─▶ Verify ─▶ Gate (local checks) ─▶ PR ─▶ Human merges
   │         │                              │            │                        │
 sign off  sign off                    commit-per-task   both rituals run      = ship sign-off
```

1. **Specify** — write down the goal, acceptance criteria, and the decisions of record (what you chose and
   what you ruled out). **Human signs off** before code.
2. **Plan** — the implementation approach: what changes, the task breakdown, the risks. **Human signs off.**
3. **Tasks** — the plan as a checklist, one commit per task.
4. **Implement** — on a **feature branch** (never `main`). Commit per task; keep the local checks green at
   each commit.
5. **Verify** — the assistant self-verifies against the spec (this repo's **verify ritual** — §5).
6. **Gate** — run the local gates (§4): the credential-free checks must be green, then push the branch to
   `origin` and open a PR.
7. **PR / merge** — once CI (if configured) is green and the PR is open, **the human reviews and
   merges the PR**. The merge is the ship sign-off. `main` only ever changes via a merged PR.

Plug-in point (this repo): Specify/Plan/Tasks are captured as a markdown plan under `docs/` (see
`docs/spec-review-gate-plan.md` for the shape — goal, decisions of record, per-PR sequencing). The harness
itself also has `research` and `plan` phases; when you drive it end-to-end with `--review-spec`, the
spec-review gate (§ below) is the machine analogue of the human plan sign-off.

---

## 3. Branch discipline

- **Never work on `main`.** Create a feature branch first — `git checkout -b <type>/<slug>`
  (e.g. `feat/…`, `fix/…`, `chore/…`, `docs/…`).
- The gate **validates committed history on a non-default branch** and refuses to run on `main` — so the
  work must be committed on the branch before you gate.
- **Commit per task**, with a clear message. Preserve unrelated pre-existing uncommitted changes; commit
  only what belongs to the task. (This repo accumulates local run artifacts — `agents/`, `logs/`,
  `latest-progress.log`, `.lavish/` — that are gitignored; never sweep them into a task commit.)
- The human never has to `git merge` or `git push main` by hand — that happens by **merging the PR**.

---

## 4. The gate: local checks + PR

There is no automated pre-push pipeline in this repo. The gate is manual: run the local checks
(§5.1) until they're green, push the branch to `origin`, and open a PR. The PR — plus CI, once a
workflow exists on the remote — is the backstop before the shared branch.

### One-time setup (per repo)

```sh
gh auth login    # authenticate the GitHub CLI so you can open PRs
```

**This repo has no CI workflow yet** — until one is added on the remote, PR review is the only
automated backstop; the local checks (§5.1) and an independent subagent review (§5.3) still run
and gate normally.

### Running it

```sh
uv run adws/adw_tests/test_feature_worktree.py   # + the rest of §5.1's local checks
git push origin <branch>
gh pr create --fill     # or open the PR from GitHub's UI
```

There's no long-running pipeline to poll — the checks are synchronous and fast, and once the PR is
open, review happens on GitHub.

### Fixing findings

Whether findings come from the independent subagent review (§5.3), a human reviewer, or CI, the
assistant applies the fix directly (never leave a reviewer's finding unaddressed), re-runs the
local checks, commits on the **same** branch, and pushes again. Escalate anything that challenges a
deliberate decision or changes product behavior to the human — don't decide it yourself.

### Outcomes

- **PR open, checks green** — you're done driving. Hand the PR to the human to review and merge.
- **PR open, changes requested** — fix what the reviewer points at, commit on the **same** branch,
  and re-push. Never leave requested changes unaddressed.
- **CI red** (once a workflow exists) — treat it the same as a failed local check: fix, commit,
  re-push.

---

## 5. Verify ritual (plug-in point — filled in for this repo)

The gate is not a substitute for the assistant verifying its own work first. Before (or alongside) the
gate, run this repo's **verify ritual**.

### 5.1 Local checks (this repo)

There is no compiled build and no typecheck/lint tooling — everything is a `uv run` PEP 723 script. The
credential-free checks that must be green before you gate:

```sh
# Byte-compile every file you changed (fast syntax gate)
python3 -m py_compile <changed-file.py> …

# Harness self-tests (deterministic, no Claude calls, no network)
uv run adws/adw_tests/test_feature_worktree.py
uv run adws/adw_tests/test_fixture_autocapture.py
uv run adws/adw_tests/test_eval_task_capture.py

# Eval grader self-test (deterministic; add --judge to also exercise the LLM judge path)
uv run evals/grader_selftest.py

# Risk-gate deny rules, if you touched adw_modules/risk_gate.py
python3 adws/adw_modules/risk_gate.py --selftest
```

> **The full eval suite is NOT a break-detector.** `uv run evals/run_eval.py` is a paid, multi-hour
> benchmark that measures whether a harness change is *good or bad*, not whether it *runs*. Do not treat a
> green/absent eval run as a correctness gate — the checks above are the gate. Run the eval suite
> deliberately, when you want the A/B numbers (see `README.md` → Evals).

### 5.2 Non-negotiables (this repo)

State explicitly in your PR description when a change touches one of these:

- **No `Co-Authored-By: Claude` trailer** on commits in this repo.
- **Do not "fix" load-bearing planted eval defects** in vendored targets — the `totalPages` defect in
  `evals/target_backend/src/routes/admin.ts` and the task-13 latent `findAndCountAll` count bug are
  *supposed* to be broken; they are the benchmark. Touching them silently corrupts the eval.
- **Everything runs via `uv run`** — each script declares its deps inline (PEP 723); do not introduce a
  global Python environment or a `requirements.txt`.
- **Eval targets are vendored and frozen** for score comparability — don't regenerate or upgrade them as a
  side effect.
- **Headless must stay the default.** New gates/prompts must be opt-in (flag + env var, off by default), so
  eval/cron/webhook runs never block waiting on a human. (This is exactly why the spec-review gate is
  `--review-spec` off-by-default with a headless `auto` mode.)

### 5.3 Independent review

A **fresh** reviewer (a subagent with no memory of writing the code) checks the diff against the spec's
acceptance criteria. Never self-grade. Fix findings, then **re-review**. In this repo, run this subagent
review before opening the PR; treat it as required for larger or riskier changes.

### 5.4 Behavioral verification

Prove behavior, not just compilation:

- Harness/eval/grader changes — **run the thing**, don't read it. Exercise the changed path with a real
  invocation (a self-test, a `--dry-run`, a targeted script call) and read the output. See the
  `validate-work` skill.
- If the change has a live-LLM path that can't run headless in the eval harness (e.g. the spec-review
  `human` pause), smoke it manually once and say so.

### 5.5 Hand the human what can't be verified headless

Anything needing real credentials, a paid eval run, real I/O, or human judgment — state it plainly; don't
imply it passed. (The full A/B eval numbers for a new gate are the canonical example.)

Running the verify ritual **and** pushing for PR review is deliberate belt-and-suspenders: the ritual is
assistant-driven and catches domain issues before anything is pushed; the PR (and CI, once configured) is
the review that happens after. **This repo runs both** — PR/CI review does not replace the ritual's
independent review for non-trivial changes.

---

## 6. Two ways to invoke the gate

- **Validate-only** — the change is already committed on a branch; run the local checks (§5.1), push, and
  open the PR.
- **Task-first** — you're handed a task: (1) check `git status` and preserve unrelated changes; (2) do the
  work and **commit it on a feature branch** (branch first if you're on `main`); (3) run the local checks,
  push, and open the PR, describing the decisions you made in the PR description.

---

## 7. Roles at a glance

| Role          | Owns                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Assistant** | spec/plan drafts, implementation on a branch, the verify ritual, running the local checks, relaying reviewer findings, the PR |
| **Human**     | sign-off on spec & plan, decisions escalated by the assistant, **reviewing and merging the PR** (the ship sign-off)         |
| **Gate**      | local checks · independent subagent review · PR · CI — the backstop before the shared branch                                |

---

## 8. Adapting to your project (checklist)

The plug-in points, filled in for **this repo** (re-fill these if you copy this file elsewhere):

- [x] **Local check commands** — the credential-free `uv run` self-tests + `grader_selftest.py` +
      `py_compile` (§5.1). No typecheck/lint/compiled build exists.
- [x] **Non-negotiables** — no Claude co-author trailer; don't fix planted eval defects; `uv run`-only;
      frozen vendored eval targets; headless-stays-default (§5.2).
- [x] **Specify / Plan / Tasks capture** — a markdown plan under `docs/`; human signs off there
      (§2 plug-in note).
- [x] **Review: replaces or alongside?** — **alongside**: this repo runs an independent subagent review
      before every PR, required for non-trivial changes (§5.3).
- [ ] **`gh` + CI** — `gh` is authenticated; **no CI workflow exists on the remote yet** (add one to close
      the review loop — §4).
- [x] **Authorship conventions** — commits carry **no** `Co-Authored-By: Claude` trailer.

---

## 9. One-line summary

> Branch → implement (commit per task) → verify (§5 self-tests + non-negotiables) →
> run the local checks (§4) → push + open PR (escalate anything that needs a human decision) →
> **human merges the PR**. `main` only changes via a merged PR.
