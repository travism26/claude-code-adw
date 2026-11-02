# Game plan: adopting Matt Pocock's factory on top of ADW

**Date:** 2026-11-02
**Status:** a plan proposal, docs only. Nothing here has been built, and the settled decisions R1 to R15 in [../decisions-to-grill.md](../decisions-to-grill.md) still hold: interactive pilot first (R10), supervised exercises before anything unattended (R13), the retro before any overnight run (R15). This plan says what the unattended layer should look like when its turn comes, in his vocabulary, mapped onto what ADW already has.
**Inputs:** [course-prediction.md](course-prediction.md) (what the course will teach), [github-actions-orchestration.md](github-actions-orchestration.md) (what he actually runs), [chief-of-staff-and-companions.md](chief-of-staff-and-companions.md), [../dissections/matt-pocock/software-factory-skill.md](../dissections/matt-pocock/software-factory-skill.md) (the five questions and the slots), [../workflows/adw/overview.md](../workflows/adw/overview.md) §5 (what ADW is missing), [../workflow-map.md](../workflow-map.md) §7 (the borrow sheet). Terms are from [../GLOSSARY.md](../GLOSSARY.md) and the root `CONTEXT.md`.

---

## 1. The target, in one picture

His free lesson names five steps a factory may take over: **Explore, Approve, Implement, Review, Merge**. His own factories keep humans at Approve (a collaborator applies the label) and Merge (every run ends in a draft PR). His "Start slow" rule says every automated trigger is an accelerator, so add one at a time, throttled, with the three brakes in place first: automated checks, automated review, human review.

ADW already sits at this point on the spectrum: a human cuts Tickets, a run claims one, builds, reviews against the Ticket, and leaves a draft PR for a human to merge ([../workflows/adw/overview.md](../workflows/adw/overview.md) §1). What ADW lacks is exactly what Part One teaches: **a Trigger that starts a Run without a human typing a command**, an Orchestrator that records queued, in-flight and finished Runs, and a disposable Runner. Both of ADW's triggers dispatch to scripts that do not exist (ADW §3.14).

```
ticket opened ─► Explore ─► Approve ─► Implement ─► Review ─► [Verify] ─► Merge
                 agent      human      agent        agent      agent      human
                 /triage    label      factory.py   /code-     verify +   (T0 auto
                 labels     ready-     in worktree  review     guarded    later, per
                 only       for-agent  draft PR     two axes   verifier   risk tier)
```

The bracketed **Verify** step is ours, not his. His three brakes never run the application; the earlier research showed why that matters ([../workflows/matt-pocock/overview.md](../workflows/matt-pocock/overview.md) §3). Keep it between automated review and the human.

## 2. Fill every slot

| Slot | His Part One answer | ADW today | This plan |
|---|---|---|---|
| Ticket tracker | GitHub Issues; labels are the router | GitHub Issues with `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, `in-progress` (`docs/agents/triage-labels.md`) | Same. Keep `ready-for-agent` as the Approve step. His factory repos use a separate `agent:*` vocabulary and `ready-for-agent` triggers nothing there; we use one vocabulary, ours. |
| Ticket source | A feedback button filing `agent:explore` issues; a cron | You | You, then a `workflow_run` failure filer (the Fix task) once Runs exist. Dedupe first. |
| Git host | GitHub | GitHub | GitHub. |
| Orchestrator | GitHub Actions: "the workflow file is the orchestrator and the run page is the observability platform" | None. A human launches `travis_sdlc.py` or `factory.py` by hand; `trigger_cron.py` and `trigger_webhook.py` are broken | GitHub Actions workflow files, one per Task. Run history is the record of queued, in flight and finished. |
| Runner | Hosted Actions runner (free minutes on a public repo) | The laptop | Hosted runner for review, verify, ratchet and fix Runs. For implement Runs on a private repo, a self-hosted runner or a Claude Code cloud session (see §6, decision 2). |
| Observability platform | None: Actions run pages | JSONL transcripts, `pipeline_state.json`, the progress log | None at first. Upload ADW's state file and `report.json` as run artifacts so the run page is enough. |
| Identity | A personal access token (`AGENT_PAT` or `FACTORY_PAT`) in every live repo, against his own skill's advice | None | **A GitHub App from day one.** His gotcha: events caused by `GITHUB_TOKEN` start no new workflows, so a chain stops silently. His repos fall back to the built-in token and go green while nothing fires. |

## 3. Question every task

Each row answers his five questions: trigger, what it does and which services it reads and writes, what it triggers next, where a human re-enters, what stops two Runs doing the same work. The last column is the throttle at introduction.

| Task | 1. Trigger | 2. Does (reads / writes) | 3. Triggers next | 4. Human re-enters | 5. Dedupe | Throttle at first |
|---|---|---|---|---|---|---|
| **Explore** | `issues: opened` (after `needs-triage` is auto-applied) or a human adds `needs-triage` | `/triage` in labels-only mode: reproduce the claim, check `.out-of-scope/`, write an agent brief as a comment; writes one of `needs-info`, `ready-for-human`, `wontfix`, or proposes `ready-for-agent` | Nothing. The human's label is the next trigger | **Approve:** a collaborator applies `ready-for-agent` | Concurrency group `explore-<issue>`; skip if the issue already has a triage label | One issue in ten, or his batch form: one run explores every open `needs-triage` issue together |
| **Implement** | `issues: labeled` with `ready-for-agent` by a collaborator | Claims with `in-progress` (first write, ADR 0001), runs `factory.py --issue N --worktree` through the Ticket resolver (Ready, not In progress, Blockers closed), deterministic gates from `adw_gates.json`, opens a **draft** PR on `adw/<issue>` | Review, by the PR opening | Nothing until Review ends | The `in-progress` claim plus concurrency group `implement-<issue>` with `cancel-in-progress: false`; a fresh run refuses an In progress Ticket | One Ticket at a time, serial, until the brakes are trusted |
| **Review** | `pull_request: opened, synchronize` on `adw/*` branches | `/code-review` two axes (Standards, Spec) in a fresh context with no write tools; posts the two reports; on a blocker adds `rework` and a counter label `rework:1`, `rework:2`, `rework:3` | Rework on a blocker; Verify on pass | After `rework:3`, label `ready-for-human` and stop | Concurrency group `review-<pr>` | Every PR |
| **Rework** | `pull_request: labeled` with `rework` | Fixes only what the review named (the slim fixer loop), pushes | Review | None | Same group as Implement for that issue | Cap of three, which he lacks ("The chain has no counter and no limit") |
| **Verify** | Review passed (a `verified-pending` label set by Review) | Our `verify` protocol: claims derived from the Ticket's acceptance criteria, the guarded read-only `verifier`, the app run for real, a verdict bound to `git patch-id`, evidence as a run artifact and a Verification section in the PR body | On VERIFIED, flip the draft PR to ready; on FAIL, `rework`; on INCONCLUSIVE, `ready-for-human` | Reads the evidence, not the narration | Verdict keyed by patch-id; a new push invalidates it | Every PR |
| **Merge** | Human | Reads the diff and the evidence | Retro (1 in 10) | **This is the human gate** | n/a | Human for all tiers until DG Tier 1 is decided; then T0 (docs, tests) by a Shipping-style step with read-back |
| **Ratchet** | `schedule: cron` daily | Takes one file off an exception list (an ESLint override, a Checkstyle suppression, a clippy allow), fixes it, opens a draft PR. His `lint-shrink.yml` does this with no agent at all | Review | Merge | One PR per day; skip if yesterday's is open | **The first automated trigger to turn on**, because it is cheap, reversible and easy to review |
| **Fix** | `workflow_run: completed` with `conclusion: failure` | Files the log as an issue labelled `needs-triage`; attempts nothing itself at first | Explore | Always | One issue per workflow name per day | Issue filing only; a fix PR comes later and never chains |
| **Retro** | `pull_request: closed` with `merged == true`, one in ten | `/retro`: proposes gate, lint or `CODING_STANDARDS.md` changes as a PR; a mechanical lesson becomes a gate in `adw_gates.json` | Review | Always, and never auto-applied (his rule and pstack's) | Group `retro` | 1 in 10 |

A design is done, in his words, when every slot names a product and every task has an answer to every question. The table above is complete for Explore, Implement, Review, Rework, Verify, Ratchet, Fix and Retro. Merge is human by decision, pending Tier 1 of [../decisions-to-grill.md](../decisions-to-grill.md).

## 4. The workflow skeleton

Docs only, so this is the shape, not a file to commit. It is the Implement task; the others differ in trigger and command.

```yaml
name: Implement
on:
  issues:
    types: [labeled]
permissions: {}
concurrency:
  # one running and at most one pending per issue; never cancel a run mid-build
  group: implement-${{ github.event.label.name == 'ready-for-agent' && github.event.issue.number || 'throwaway' }}
  cancel-in-progress: false
jobs:
  implement:
    if: github.event.label.name == 'ready-for-agent' && contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), github.event.issue.author_association)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/create-github-app-token@v1   # never GITHUB_TOKEN: its events start no workflows
        id: app
        with: { app-id: ${{ vars.FACTORY_APP_ID }}, private-key: ${{ secrets.FACTORY_APP_KEY }} }
      - uses: actions/checkout@v4
        with: { token: ${{ steps.app.outputs.token }} }
      - run: uv run adws/pipelines/factory.py --issue "$ISSUE" --worktree --max-budget-usd 10
        env:
          ISSUE: ${{ github.event.issue.number }}
          GH_TOKEN: ${{ steps.app.outputs.token }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: run-${{ github.run_id }}, path: adws/state/ }
```

Three of his patterns are in there: the throwaway concurrency group (unrelated label events land in a group that can never displace a pending run), `cancel-in-progress: false`, and the collaborator-only guard. Two of ours are added: the App token, and a budget cap on the run. One thing is deliberately missing: `|| true`. His course repo says "No `|| true` here, on purpose"; a failed step must fail the run so the Fix task sees it.

## 5. Order of adoption

Phases follow his rule: brakes first, one accelerator at a time, open the throttle as the brakes earn trust. Each item names the ADW gap it closes from [../workflows/adw/overview.md](../workflows/adw/overview.md) §5 so this plan adds to the borrow sheet instead of repeating it.

| Phase | When | What | ADW gap closed |
|---|---|---|---|
| **0. Plumbing** | Before 2026-11-09 | Register a GitHub App for the pilot repos. Point the two broken triggers at `factory.py --issue` through the Ticket resolver, or delete them. Create the label set including `rework:N`. Make worktree and the risk-gate hook the default for any run not started by hand. | 4, 13 |
| **1. Brakes** | Week 1 of the course (11-09 to 11-13), alongside the Review and Codebase Design workshops | Review as an Action on `adw/*` PRs with the two axes and no write tools. Test failure clears PR readiness in travis, or travis moves onto the slim gate engine. A first mechanical boundary per pilot repo (his `setup-ts-deep-modules` shape, or ArchUnit for Spring). | 7, 9 |
| **2. Verify in the loop** | Week 2 (11-16 to 11-20), alongside Feedback Loops and Part One | Wire `verify` as the step after Review: claims from the Ticket, guarded verifier, verdict bound to patch-id, PR ready only on VERIFIED. Planted-failure run to prove it can fail. | 8 |
| **3. First accelerator** | After the retro (R15) | Ratchet on a daily cron, one draft PR, human merge. Then Explore in labels-only mode on one issue in ten. | 1 (partial), 15 |
| **4. Implement on label** | After two weeks of clean ratchet PRs | Implement on `ready-for-agent`, serial, with the `in-progress` claim, a budget cap, a wall-clock cap and the stuck rule. Fix files issues from failed runs. | 1, 3, 14, 15, 11 (decisions file as artifact) |
| **5. Part Two for real** | When the course's Part Two is known | Re-answer the five questions for each task against what he taught. Decide whether the Orchestrator stays on Actions or moves to the "your own infra" path he is building (Inngest, Daytona, Langfuse, a factory App; see [github-actions-orchestration.md](github-actions-orchestration.md) §8). | 10, 12 |
| **6. Merge tiers** | After DG Tier 1 | T0 self-merge with read-back for docs and tests only, verdict-bound. Everything else stays human. | 17 |

Phases 0 to 2 are compatible with R10, because every Run they add is a brake and the human still starts every implement run. Phase 3 is the first accelerator and is post-retro by R13 and R15.

## 6. Decisions this plan forces

Add these to the grilling agenda in [../decisions-to-grill.md](../decisions-to-grill.md).

1. **Orchestrator product.** GitHub Actions is his Part One answer and the cheapest to stand up, but his own repos are already drifting off it toward a daemon and an Inngest design. Proposal: Actions for the brakes and the ratchet; revisit after Part Two.
2. **Where implement Runs execute.** A hosted runner is disposable and matches his Runner definition. It needs API billing, not the Max subscription: his course tells students to use their own Claude subscription in a public repo, which is a cost and terms question to check before copying. Alternatives: a self-hosted runner on the laptop (not disposable), or a Claude Code cloud session started by the Action.
3. **Identity.** A GitHub App for all Runs, or a PAT as he does. Proposal: App. The 5,000 versus 1,000 requests per hour and the chain-trigger rule both favour it.
4. **Is Verify mandatory before any throttle opens?** Proposal: yes, for Implement; no, for Ratchet, whose PRs are reviewable by eye.
5. **The first accelerator.** Ratchet (proposal) or Explore in labels-only mode.
6. **Label vocabulary.** Ours (`ready-for-agent` as Approve, `in-progress` as the claim, `rework:N` as the cap) rather than his `agent:*` set. The cost is that his course workflows will not drop in unchanged.
7. **Budget per Run and per day** on Actions, enforced by `--max-budget-usd` and a daily cap on how many Runs may start.

## 7. What to reconcile during the course

A checklist for the two course weeks, to update this plan rather than start over:

- Part One's exact workflow files: trigger events, identity, concurrency, retry handling, and whether a counter appears.
- Whether `ready-for-agent` or `agent:*` labels are taught, and whether Approve is a label or an assignment.
- Which five tasks Part Two sketches, and which design principle each one tests.
- Whether a Verify-like step appears under "frontend verification" or "browser checks".
- What the "infra recommendations" are per slot, and whether Sandcastle's Inngest and Trigger.dev templates are the recommended path off Actions.
- Any change to the three brakes, the throttle rule or the "a run never waits for a human" rule.

## 8. Risks and unknowns

- Costs: no public figures for his Actions minutes or model spend. Hosted runners on a private repo are billed per minute; implement Runs with a Spring Boot build will be long.
- His factories went dormant on Actions in October and his course fork plans to leave Actions. The Part One design may be a teaching device rather than his recommendation for production (inference).
- The `software-factory` skill's frontmatter bug (issue #1373) means `npx skills` skips it today; install from the repo path until it is fixed.
- This plan assumes the pilot repos are on GitHub with Issues enabled and a paid plan if rulesets are needed on a private repo (his survey note).
- Nothing here was run. Phase 0 is the first thing to execute, and only after the pilot's retro says the brakes hold.
