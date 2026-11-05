# What ADW already does, and the experiments that would earn a change

**Date:** 2026-11-05.
**Method:** read the docs and the code paths named below. No pipeline was executed for this note. The stage-by-stage status of the harness is [workflows/adw/overview.md](../software-factory/workflows/adw/overview.md) (2026-10-24). This page only records the slots the leadership-session photos name, so it does not restate that overview.

Labels: **Repo** is implemented behavior. **Gap** is a missing property relative to the slides' own requirements (identity, entitlements, lineage, registry), not a promise to build the slide. **Experiment** is a measurement with a baseline. An experiment is the recommendation. A new model stage is not.

## 1. Slot by slot

| Slide slot | Repo today | Evidence |
|---|---|---|
| Agent = model + harness | The harness is the `adws/` scripts, templates, gates, and evals around Claude Code. The root README defines a harness change as a change to how the agent works, not a change to the target app. | [README.md](../../../README.md) "Concepts & glossary" |
| Harness: plans, loops, tools | `travis_sdlc.py` runs research → plan → optional spec review → build → validate → test → review → document. Slim pipelines loop a builder against deterministic gates. | [overview.md](../software-factory/workflows/adw/overview.md) §2–§3 |
| Tools and sandbox | Git worktrees and a branch per run. No container, no VM, no egress control. Agents run on the host. MCP is passed through, not mediated per call. | overview §3.10 |
| Context assembly | Research, plan, and build append one compiled memory file to the system prompt, capped at 6,000 characters. There is no retrieval step. | `adws/adw_modules/memory.py` (`MEMORY_INJECT_MAX_CHARS`), [MEMORY_CONTRACT.md](../../../adws/travis/MEMORY_CONTRACT.md) |
| Cache | None. No prompt-cache breakpoint management, no semantic cache. | No cache module under `adws/` |
| Model inference | Aliases `sonnet`, `opus`, `haiku` via `SLASH_COMMAND_MODEL_MAP` and per-phase defaults. Router and eval judge are fixed to `sonnet`. | `adws/pipelines/router.py` (`ROUTER_MODEL`), `evals/graders.py` (`JUDGE_MODEL`) |
| Enterprise data, entitlements, ontology, semantic layer, lineage | Not this harness. ADW does not answer over governed tables. Those boxes are empty, not partial. | No entitlement or lineage code in `adws/` |
| End-user and agent identity | The operator's GitHub credentials. A Ticket is an issue. There is no second identity on the call and no OAuth audience check. | `adws/adw_modules/ticket_resolver.py` |
| Per-call least privilege | `review_pr.py` disallows Bash, Edit, Write, NotebookEdit, and WebFetch and sets a dollar cap. The PR-description agent disallows Edit, Write, NotebookEdit, Bash, and Task. Other phases do not. | `adws/actions/review_pr.py`, `adws/adw_modules/draft_pr.py` |
| Policy, rate, cost | `AgentPromptRequest.max_budget_usd` exists. Only the PR-review action sets it. Travis and the factory pipelines do not. M4 hit a provider session limit mid-sweep; that is the provider's cap, not a policy object. | `adws/adw_modules/agent.py`, [m4-results.md](../../m4-results.md) §2 |
| Risk gate | A PreToolUse deny-list for a few destructive bash patterns and credential paths. High precision, low recall, by design. Opt-in (`--risk-gate` / `ADW_RISK_GATE`). `factory.py` does not set it. Triggers do. It binds under `--dangerously-skip-permissions`. | `adws/adw_modules/risk_gate.py` |
| Audit | `agents/<id>/` holds transcripts, state, and `risk.log` denials. There is no record of which source rows a tool returned, because no such tool exists. | overview §3.12 |
| Memory extract / forget / store | Dreaming asks one model for add/update/delete/keep. Entries the response omits are still deleted. Provenance is `source_adw_ids` in frontmatter. Injection is the whole store, not a search, and not scoped to a principal. | `adws/travis/travis_dream.py` around the "absent from consolidated store" delete; MEMORY_CONTRACT.md |
| Router | An LLM classifier to `chore`, `bug`, or `feature`, fail-closed, one retry, no default route. `--route` overrides it. The fixture set is 15/15 for sonnet and haiku, so it no longer discriminates. | `adws/pipelines/router.py`, overview §3.2, `evals/agents/router/` |
| Planner | A plan agent writes a disposable plan. Optional spec critic. The plan is not the review oracle (ADR-0001). | [CONTEXT.md](../../../CONTEXT.md), `docs/adr/0001-ticket-driven-runs.md` |
| Decision / release | Ticket intake, gate pass/fail, draft-versus-ready, and merge are deterministic or human. The harness never merges. | overview §3.9; `.claude/skills/ship-gate/SKILL.md` |
| Output judge | Eval judge scores spec quality and implementation fidelity, 0–5, model fixed, cost excluded from system-under-test cost. Code graders (tests, acceptance, cost, diff, wall time) decide pass^k. The judge sees a truncated spec (12,000 chars) and diff (24,000). No position swap. Same alias family as the builder. | `evals/graders.py` |
| Evals as a release gate for the harness | 14 frozen tasks, pass@k and pass^k, baselines, judge cost separated. M4 compared two engines at one commit. The suite is not CI: there is no `.github/` workflow. `ship_gate.py` runs the unit list in `adw_gates.json`, not the eval suite. | `evals/EVAL_PRACTICES.md`, `adw_gates.json`, overview §3.16 |
| Model registry, continual fine-tune | Not implemented. Model choice is a string alias in source. Learning that does exist is memory, `LESSONS.md`, fixture capture, and eval-task capture. | MEMORY_CONTRACT.md; `skills` validate-work LESSONS path cited in overview §3.11 |
| Online evals | Explicitly out of scope: no production traffic. | EVAL_PRACTICES.md "Ignored" |

## 2. Trust boundaries, in this repo's terms

**The author does not grade itself.** The glossary separates Author from Verifier, and the interactive `verify` skill enforces that with a PreToolUse guard: the verifier subagent cannot write outside `.verify/`. That guard is not on the `adws/` pipeline path. Ship-gate does not read the verify verdict. Both facts are already documented ([software-factory README](../software-factory/README.md), overview §3.17). They matter here because slide 26's judge box is the same hazard: a learned check that shares a family and a context with the author.

**The deny list is not least privilege.** `risk_gate.py` blocks a short list of bash patterns. Everything else is allowed when the flag is on, and the flag is off in the factory entrypoint. Slide 21's "least privilege for every tool call" would be an allow-list of tools per phase, which this repo does only for PR review and the PR blurb. Extending the deny list until it feels like a policy is the wrong shape. The experiment below tests an allow-list on one phase before any wider claim.

**Memory is a shared advisory prompt, not a governed store.** Every entry in the target's `ai_docs/memory/` is eligible for injection until the character budget drops the oldest. There is no principal, no expiry, and no separation between a lesson about a test command and a lesson that quotes a customer record. That is acceptable while the store holds coding conventions. It is a breach the day a dreaming run writes a secret or another tenant's fact into a file the next run will trust. The contract already says memory is advisory and that task text wins. Advisory is not enforcement.

**Deletion is real and only partly explicit.** A parsed dream response that omits an entry deletes it (`travis_dream.py`, "absent from consolidated store"), after the prompt also offers an explicit `delete` action. A JSON parse failure leaves the store alone. Git on the target is the review surface, which helps a person and does not help an unattended run. Slide 23's "extract and forget" needs the explicit action to be the only delete. The omission path makes a truncated response look like a policy.

**Provenance stops at the run id.** `source_adw_ids` records which runs informed an entry. It does not record the artifact span the lesson came from, and nothing invalidates the entry when that code changes. For a coding store this is a staleness bug. For a store that slide 23 would also use as memory of business facts, it is a lineage bug. This harness should not grow the second store. It should make the first store's deletes and sources checkable.

**Aliases are not versions.** M4 ran `model=sonnet` for both engines at commit `34ac5d8` and reported cost and wall time. The scorecard cannot be replayed against the same weights once the alias moves. A registry, even a one-line manifest of resolved model ids committed next to `evals/baselines/`, is the smallest object that makes rollback mean something.

## 3. A measured efficiency result this repo already has

M4 is the local counterexample to "efficiency means a smarter model." Both engines, same alias, same six tasks, three trials, same harness commit: 18/18 trials ok, acceptance and tests at 100% on both, so pass^k matched. Pooled mean cost went from $1.495 to $1.005 (−32.8%), mean wall time from 4.33 min to 3.06 min. The judge's own bill ($3.48 and $2.95) was kept out of that cost. One slim trial lost its judge scores to the session limit and was dropped only from the judge average. Per-task medians are in [m4-results.md](../../m4-results.md). Conditions that bound it: tasks 01–06 only, `sonnet` unresolved to a snapshot, N=3, no p95, and the suite was saturated at 100% pass, so the cost delta says nothing about a harder task. It does say a shorter deterministic pipeline can cut cost per successful trial without a model change. That is the kind of gain slide 26 draws as "a model in every box."

Cost per successful task on this sweep equals mean cost per trial, because every trial passed. The moment pass^k drops, the denominator must stay "trials that met the oracle" and the numerator must keep the spend of the failures. Averaging only the cheap successes will flatter a flaky router.

## 4. Experiments, in the order they pay for themselves

Each one uses the existing eval harness or a fixture replay. None of them adds a model stage. None of them is a ticket to build an intelligence plane.

### E1. Resolve the alias, then re-run one baseline

**Question.** How much of a published scorecard is the alias rather than the harness?
**Baseline.** A recorded `evals/baselines/` snapshot and the M4 tables.
**Change.** Log the provider's returned model id on every trial. Re-run tasks 01–06, N=3, both engines, when the id differs from the id stored with the baseline.
**Report.** pass^k, mean and p50/p95 wall time per phase, total dollars, dollars per trial that passed acceptance and tests. Include failed-trial spend in the numerator.
**Stop rule.** If the resolved id cannot be recorded, the scorecard is not a release artifact.

### E2. Cost of the router versus a fixed route

**Question.** On the saturated 15-case router file, does the LLM router change pipeline choice often enough to justify its calls?
**Baseline.** `--route` set to the labeled route, no router call.
**Change.** The current `router.py` path.
**Report.** Agreement with the label, dollars, and downstream pass^k on a handful of tasks from each class. The 15/15 file cannot be the only metric; it is already saturated (overview §3.2).
**Constraint.** A low-confidence route still must not default. That property stays. The experiment measures cost, not a new fallback.

### E3. Judge correlation and family

**Question.** Does `implementation_fidelity` move with the code graders, or with the builder's family?
**Baseline.** Current `JUDGE_MODEL = sonnet` on the last complete sweep.
**Change.** (a) The same judge on the diff reversed in order where the prompt has two artifacts. (b) A different family, if one is available in the CLI, on the same frozen diffs. No new trials of the builder, so the code graders stay put.
**Report.** Rank correlation of the judge score with `tests_pass` and `acceptance_checks`, and the fraction of verdicts that flip under (a) or (b).
**Stop rule.** A judge that flips under a swap, or that tracks family more than the code graders, does not gate a promotion. EVAL_PRACTICES already refuses single-grader trust. This experiment makes that refusal numeric.

### E4. Dream deletion is an explicit operation

**Question.** How often does a consolidated response drop an entry without an action of `delete`?
**Baseline.** A fixture store checked into a scratch copy, plus a saved dream response.
**Change.** Replay `travis_dream.py`'s apply step. Count deletes whose action was `delete` versus deletes caused by absence.
**Report.** The two counts, and whether `source_adw_ids` survived an update.
**Constraint.** Do not change the apply semantics in this research pass. If absence-deletes are common on real responses, the fix is a code change of its own: apply only named actions, and fail closed when the response names an unknown entry. That fix wants a regression fixture, not a new model.

### E5. Allow-list one phase

**Question.** Which tools does the plan phase actually use?
**Baseline.** A small set of recorded plan transcripts under `agents/`.
**Change.** None in production. Count tool names.
**Report.** The set, and the calls that would have been denied by an allow-list of that set plus the risk gate.
**Constraint.** This is a measurement before any hook change. Slide 21's per-call least privilege is an allow-list. The current risk gate is a deny-list with a stated low-recall goal (`risk_gate.py` docstring). Replacing it wholesale would stall runs; the docstring says why.

### E6. Do not run these until E1–E5 exist

- A semantic cache in front of memory or retrieval. Section 2 of the evidence note: false hits are measured, entitlement-keyed invalidation is not. There is no retrieval stage to cache.
- A fine-tune of a small model on dream entries or traces. Ovadia's current-events table shows unsupervised fine-tuning losing to RAG, and on Llama-2-7B losing to the base model. ADW's "online" half of slide 23 does not exist.
- A decision model for merge, spend, or the risk gate. The harness already refuses to merge. A learned replacement would remove the deterministic half of slide 20's product.
- In-database inference. This repo has no enterprise data plane. There is no workload on which to measure it.

## 5. What not to import

The photos are a bank-shaped question-answering agent. This repository is a coding harness that stops at a draft pull request. Importing the empty boxes (ontology, cell policies, in-database inference, continual fine-tuning) would duplicate a platform this repo does not operate, and it would bury the gaps that are real here: unresolved model aliases, judge correlation, dream deletes, a factory path without the risk gate, and a verify verdict ship-gate does not read.

The glossary collision stays. The Orchestrator is not "the control plane." Identity, spend, and audit are properties of a call. In this repo they are partial, phase-specific, and mostly the operator's GitHub login plus a transcript directory. Naming them honestly is the documentation change. Building a second control system inside the learning loop is the change the slides do not justify.
