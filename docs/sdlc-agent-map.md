# SDLC Agent Map — a catalog of small, contracted, individually-eval'd agents

**Status:** proposed (2026-07-19)
**Companion to:** `docs/slim-pipelines-plan.md` (pipelines = the composition; this doc = the units)
**Basis:** two-track research 2026-07-19 — (a) full inventory of every agent touchpoint in this repo (all `template_claude/commands/*.md`, every `execute_template` call site, judges/gates, evals), (b) industry survey of stage-specialized SDLC agents and per-agent eval practice, 2025–2026. Top inventory findings were independently spot-verified against the code before being written here.

---

## 1. Verdict on the current design

Requested candor: the pipeline *shape* survives contact with the evidence. What's wrong is contract discipline, two agents that shouldn't be agents at all, and a large amount of dead weight creating the "brittle" feel.

### Keep (validated by industry evidence)
- **Deterministic state-file orchestration** (`travis_state.json` pattern) — independently converged on by other production pipelines; the orchestration layer staying deterministic while agents stay stateless is correct.
- **Human-gated ship** — nobody surveyed auto-merges; deploy decisioning is human everywhere.
- **Worktree sandboxing, draft-PR streaming, risk gate** — all match shipping practice. The risk gate's `--selftest` fixture table is the only isolated agent-adjacent test in the repo; it's the pattern to generalize, not an outlier.
- **`/validate`'s fail-closed parse** (`travis_validate.py:181-209` synthesizes a `validation.unparseable` violation instead of treating silence as success) — the best-designed seam in the codebase. It becomes the *standard*, below.
- **The eval harness** — a genuine asset; it just points at the wrong altitude (whole pipeline only, never one agent).

### Change (the brittleness has a single root cause)
- **Free-text handoffs parsed by regex are the load-bearing contract everywhere** — three independently-drifting copies of the "find the spec path in the prose" regex (`travis_plan.py:97`, `travis_research.py:39`, `adw_prompt_plan_build_test_review.py:83`), a last-match-wins heuristic in `travis_openspec.py:63`, a substring check in `workflow_ops.py:721`, and *no check at all* in `travis_patch.py:154`. Industry consensus is unambiguous: **structured artifacts for agent→agent handoffs; markdown only where a human is the consumer.** No surveyed source defends free-text machine interfaces.
- **Plan→build amnesia.** Every phase is a fresh subprocess that rediscovers the repo. The strongest quantitative result found (Google Research, 180 agent configurations, 2026) shows decomposition *helps* (~+81%) on parallelizable work and *hurts* (~−70%) on sequential work; Cognition and Anthropic say the same for coding specifically. Build + its fix-loop is sequential work → **one agent role, shared context** (the slim-pipelines `build_loop` already does this). Plan→build stays split only because the spec is an agent→**human** artifact (the spec-review gate) — that split earns its cost; further splitting sequential work doesn't.
- **Agents-as-prompt-templates with no tests.** Zero agents are tested in isolation today (the fixture-capture and eval-capture machinery exists but `tests/regression/` is empty). Each cataloged agent below gets a contract + a fixture eval.

### Discard
- **The test-runner-as-agent.** `/test` spends an agent run to execute `{{TEST_COMMAND}}`, silently ignores the `--diff-base`/`--run-all-tests` flags `travis_test.py` passes (the template never mentions them — intelligent selection is only wired in the orphaned `/test_e2e`), and its parse failure returns `([], 0, 0)` — indistinguishable from a clean run. Verdict: **running tests is not an agent job.** Deterministic gate runs the command; an agent exists only to *fix* a failure (slim-pipelines design). Same logic already applied: release is deterministic (`draft_pr.py` uses raw `gh`/`git`), and that's correct — the dead agent versions (`/commit`, `/pull_request`) should be deleted, not resurrected.
- **Dead code creating false surface area:** the entire `workflow_ops` classify/branch/commit/PR family invokes slash commands whose `.md` templates don't exist anywhere in the repo; both triggers dispatch to `adws/adw_*_iso.py` scripts that don't exist (webhook silently no-ops today); `data_types_validate.py` is an unreferenced, schema-drifted fork of `data_types.py`. Roughly a third of the perceived complexity is vestigial.

---

## 2. The decomposition rule

Not "one agent per stage." The evidence supports exactly three reasons to mint a separate agent:

1. **Independence** — the work is genuinely parallelizable or context-isolated (review dimensions, research, triage). Google: +81% here, −70% when decomposition is imposed on sequential work.
2. **Tool-scoping** — isolation is a safety property even without parallelism: a reviewer that structurally *cannot* `Edit`/`Write` (Claude Code `disallowedTools`), a judge that can only read.
3. **A human consumes the artifact** — spec writing splits from building because a person reviews the spec.

Everything else stays in one continuous-context role. Corollary from the review-bench data: don't make individual agents "more agentic" reflexively — adding self-critique loops to a reviewer raised recall but collapsed signal-to-noise 5.11→1.95 (CR-Bench 2026). Small and single-shot is often the better-*trusted* agent.

**The contract standard** (applies to every agent below; generalizes the `/validate` pattern):
- Inputs: numbered variables (`$1..$n`) or one JSON blob — never ambiguity like `review.md`'s three bare `$ARGUMENT`s.
- Output: a typed JSON envelope (Pydantic model in `data_types.py`) — even when the real artifact is a file, the envelope carries `{"artifact_path": ...}`.
- Fail closed: unparseable output = phase failure, never empty-success.
- Claimed artifacts verified: `os.path.exists()` on every returned path; judges that claim to have edited a file get diff-verified.
- Ships with a fixture eval or it doesn't ship.

---

## 3. The agent catalog

Priority: **P0** = needed by slim pipelines (M1–M4) · **P1** = needed by factory (M5) · **P2** = later · **✕** = deliberately not an agent.

| # | Agent | Stage | Contract (in → out) | Exists today | Verdict / change | Isolated eval | Pri |
|---|---|---|---|---|---|---|---|
| 1 | **Router / triage** | Intake | ticket JSON → `{route: chore\|bug\|feature\|hotfix, confidence, reason}` | Dead — call sites live (`workflow_ops.py:126`), templates missing | Rebuild from scratch with JSON contract; current path can't be salvaged | Labeled corpus of past tickets/issues; **per-category** accuracy (aggregate hides a 60% category inside a 94% average) | P1 |
| 2 | **Researcher** | Research | `{adw_id, prompt}` → `{artifact_path}` (research md) | Works (`/research`), regex-extracted, non-blocking | Keep non-blocking; JSON envelope | Low value to eval in isolation; judged-usefulness only if it ever blocks | P2 |
| 3 | **Planner** | Spec/plan | `{adw_id, prompt \| issue_json}` → `{spec_path}` + file verified | Works for feature/chore; **`/bug` contract broken vs both live callers** (template wants `$1=issue#, $2=adw_id, $3=issue_json`; travis sends `[adw_id, prompt]`) | Fix `/bug` args; JSON envelope replaces 3 drifting regexes | **Industry gap — nobody has a good planner eval.** Ours: rubric-judged spec quality + downstream build pass^k on the eval suite; novel territory worth owning | P0 |
| 4 | **Spec judge** | Spec gate | spec file → `SpecVerdict{approve\|revise\|reject, concerns}` | Works (`spec_reviewer.py`), fail-closed on bad JSON | Add diff-verification that a claimed "revise" actually edited the file (currently trusted blind) | Seeded-flaw spec corpus; precision/recall per flaw class | P1 |
| 5 | **Builder** (+ gate-fixer) | Implement | spec/prompt → working-tree diff + `{summary, files_touched}` | `/implement` has zero output contract; fixers exist per-gate | **One role, continuous context** with its fix-loop (slim `build_loop`); fixer input = structured `GateResult`, not prose | End-to-end evals already cover it (this is the one agent where e2e IS the right eval); report **pass^k** not pass@k | P0 |
| 6 | **Test runner** | Test | — | `/test` agent (silent-success bug, ignored flags) | **✕ Not an agent.** Deterministic fast/slow gates run commands; delete the agent invocation | n/a — it's a subprocess | ✕ |
| 7 | **Test-gen** | Test | diff+spec → new test files | Partial (`/bug` repro-first covers a slice) | New, separate from builder (independent work, reviewable output) | **Mutation score, not coverage** (industry standard: 100% coverage / 4% mutation score suites exist) | P2 |
| 8 | **Code reviewer** | Review | `{spec_path, diff_base}` → `{findings[]: {file, line, severity, summary}}` | `/review` works but 3 unnumbered `$ARGUMENT`s and its two live callers pass args in **opposite order** | Numbered args + findings JSON; **read-only tool scope** (cannot Edit/Write); single-shot, no reflexion loop (SNR evidence) | Seeded-bug corpus (CR-Bench pattern): precision/recall **and SNR**; harvest seeds from real eval-task failures via existing `/capture_eval_task` | P0 |
| 9 | **Security reviewer** | Review | same contract as #8, security lens | **None — zero coverage today** | Add as a parallel review *dimension* (independent work → legitimate decomposition), same contract as #8 | Seeded-vuln corpus (known-pattern classes: injection, authz, secrets) | P1 |
| 10 | **Validator** | Review | repo → `ValidationViolation[]` | Works; best fail-closed pattern in repo | Mechanical rules move to the lint gate (deterministic); keep only rules a linter can't express, folded in as a review dimension | Seeded-violation fixtures (already closest to having them) | P1 |
| 11 | **Patcher** | Post-review fix | `{findings[]}` → diff + `{summary}` | `/patch` — weakest validation in repo (no existence check on the planned file) | Not a separate role: it's the **Builder** invoked with findings JSON. Delete the separate patch-plan-file indirection | Covered by builder evals | P0 |
| 12 | **Docs agent** | Docs | `{adw_id, spec_path}` → `DocumentationResult` JSON | Works, clean contract, non-blocking | Fix the side channel: `/document` **mutates** `conditional_docs.md`, which `/feature`/`/bug`/`/chore` *read* mid-run — an unversioned cross-agent channel outside state. Route doc-registry updates through the orchestrator instead | Doc-drift fixtures (change code, expect flagged docs) | P2 |
| 13 | **Release / changelog** | Release | commits+diffs → changelog draft | Deterministic (`draft_pr.py`) — correctly *not* an agent; dead agent versions exist | Delete dead `/commit`, `/pull_request` paths; optional changelog agent later | n/a for now | P2 |
| 14 | **Memory dreamer** | Continuous improvement | run artifacts → memory entries | Works (`travis_dream.py`), retry-on-bad-JSON | **Danger found:** full-regenerate semantics — a valid-JSON response that *omits* entries silently deletes them from `ai_docs/memory/`. Change to explicit per-entry ops (`add/update/delete`) so forgetting ≠ deleting | Replay corpus: same run artifacts in → judged entry quality; deletion requires explicit op | P1 |
| 15 | **Flaky-test manager, dependency bumps, migrations, incident response** | Maintenance/ops | — | None | Industry-mature niches (Atlassian flaky-fix, Renovate, AWS Transform, PagerDuty/Datadog); future factory routes, out of scope now | — | P2 |

Coverage summary: today's real, working agents are planner (feature/chore), builder, validator, reviewer, docs, spec-judge, dreamer, researcher. Triage is dead, security is absent, test-gen is absent, E2E testing is orphaned (`/test_e2e` has no caller), release is (correctly) deterministic.

---

## 4. Confirmed defects (fix now, independent of any new architecture)

Spot-verified against the code this session. These are bugs in the *current* product, not design debates:

1. `travis_test.py:parse_test_results` returns `([], 0, 0)` on unparseable output → test phase reports **passed**. Apply the `/validate` fail-closed pattern. (`adws/travis/travis_test.py:54-65`)
2. `/bug` template arg contract broken vs both live callers; `travis_plan.py:236`'s comment asserts the wrong contract; bug-spec filenames (`issue-…`) also miss the primary extraction regex. (`template_claude/commands/bug.md:6-9`, `adws/travis/travis_plan.py:238-245`)
3. `review.md` three unnumbered `$ARGUMENT`s; `travis_review.py:59` passes `[spec_file, adw_id]`, `adw_prompt_plan_build_test_review.py:600` passes `[adw_id, plan_path, reviewer_name]`. Number the variables, fix one caller. (`template_claude/commands/review.md:7-9`)
4. `travis_test.py` passes `--diff-base`/`--run-all-tests` to a template that defines neither; README claims `/test` uses the selector — false. Wire it or stop passing/claiming. (`adws/travis/travis_test.py:90-94`, `template_claude/commands/test.md`)
5. `travis_patch.py:154` never existence-checks the patch-plan path before `/implement` runs on it.
6. Dead code deletions: `workflow_ops` classify/branch/commit/PR family + missing-template references in `SLASH_COMMAND_MODEL_MAP` and `SlashCommand` Literal; `data_types_validate.py` (drifted fork); trigger dispatch to nonexistent `adw_*_iso.py` (both triggers currently non-functional — decide: fix to spawn `travis_sdlc.py`/pipelines, or remove until the factory lands).
7. `travis_dream.py` full-regenerate deletion semantics (see #14 above) — highest-consequence latent bug found.

---

## 5. Per-agent eval harness (extends `evals/`, doesn't replace it)

- **Fixture-first:** each agent gets `evals/agents/<agent>/` cases — recorded inputs (a ticket, a spec, a seeded diff) + expected structured output or grading rule. The unused `/capture_fixture` / `/capture_eval_task` machinery becomes the *supply line*: every real pipeline failure is minted into an agent-level fixture, not just a pipeline-level task.
- **Grade deterministically where possible** (schema-valid? path exists? finding matches seeded bug file:line?), LLM-judge only where unavoidable, with known-bias mitigations (fixed candidate order, no same-model self-judging, calibration set). Judge cost stays separated, as in the existing harness.
- **Metrics per agent type:** router = per-category accuracy; reviewer = precision/recall/SNR on seeded bugs; test-gen = mutation score; builder = pass^k end-to-end; planner = rubric + downstream pass^k (novel — nobody has this).
- **Cheap models run the evals**; the suite must be cheap enough to run on every agent-template change, or it won't be run.
- Saturation discipline from the existing eval design applies: an agent fixture the agent always passes gets retired to a regression smoke.

---

## 6. Sequencing (amends `docs/slim-pipelines-plan.md`)

- **M0 (new, before M1):** fix defects §4.1–5, delete dead code §4.6. Days, not weeks; de-risks the *current* product and shrinks the surface the new work builds on.
- **M1–M4** as planned in the slim-pipelines doc, with the §2 contract standard applied to every agent the pipelines touch (planner envelope, builder/fixer structured inputs, reviewer findings JSON). Each touched agent lands with its fixture eval (§5).
- **M5 factory:** the router agent is built fresh under this catalog's contract + eval (the old classify path is dead anyway).
- **P1/P2 agents** (security reviewer, spec judge hardening, dreamer op-semantics, test-gen) slot in after M5 by priority — each is an independent, small, individually-testable addition, which is the point of the catalog.

## Key sources

- Google Research, "Towards a science of scaling agent systems" (2026) — +81% parallelizable / −70% sequential; error amplification by topology.
- Cognition, "Don't Build Multi-Agents" — single-threaded continuous context for coding.
- Anthropic, multi-agent research system — multi-agent poor fit for shared-context coding; ~15× token cost.
- CR-Bench (2026) & Martian Code Review Bench — reviewer precision/recall/SNR; reflexion collapses SNR.
- Meta ACH (arXiv 2501.12862) — component-level *and* human-acceptance eval for one agent; mutation-guided test-gen.
- Factory droids, GitLab Duo agents, Kiro subagents, GitHub coding→review agent chaining — "one agent per concern" is shipping practice.
- Full citations: see `docs/research/`.
