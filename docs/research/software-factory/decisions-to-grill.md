# Decisions to grill

## Settled (grilling session 2026-10-24, round 1)

| # | Decision |
|---|---|
| R1 | Next phase is **learn by using**: run existing workflows supervised on real work before designing our own. |
| R2 | Pilot on a **personal repo**, not the work Spring Boot service. |
| R3 | Destination: **Tan-style for low-risk tiers** (verifiers merge, human audits main), Pocock-style (human merges) for everything else. Never a dark factory. |
| R4 | Budget: **Claude Max 5x, moderate use.** Delegation is fine; no swarms or unlimited fan-out. Model-tiering by task is a later concern. |
| R5 | **Claude Code only** for now; a second model family is a later experiment. |
| R6 | Terms: Check, Verification, Verdict, Claim, Review, Author, Verifier (see [GLOSSARY.md](GLOSSARY.md)). "Validation" is retired. |
| R7 | The next phase is a **curriculum**: one lesson per stage, each with reading, a pilot exercise and a notes entry. Verify first. |
| R8 | The eventual workflow is a **personal Claude Code plugin** in its own repo, with per-repo recipes generated on demand. This repo is reference only. |
| R9 | During the pilot, **mix pstack and Pocock's skills** and log where they conflict and which side won. |
| R10 | Wiring: **interactive Claude Code** (coordinator, nested subagents, read-only verifier, hooks) for the pilot; add an unattended layer (`/schedule`, an Action, or a thin `claude -p` loop) later. No external orchestrator. |
| R11 | Pilot repos: **two personal repos** (named only in the uncommitted `pilot-log/`). The user runs setup in them personally. |
| R12 | pstack model config stays as already set up (`~/.claude/rules/pstack-models.md`). |
| R13 | First exercises, in order: create-verification-skill → bug fix via `/poteto-mode` → feature via Pocock's grill/spec/tickets/implement → feature via `/poteto-mode`. |
| R14 | Pilot notes go in `pilot-log/`, which is **never committed** (excluded via `.git/info/exclude`) because the pilot repos are private. |
| R15 | Retro after the four exercises, not on a date. |

The open questions below predate these answers. Many are now deferred until after the pilot.

These are the decisions the research can't make for you, ordered so each one unblocks the next. Each states the question, the options seen in the wild, and where the evidence is. Use it as the agenda for a `/grilling` session.

Shorthand: 01 = `concepts/software-factory-concept.md`, 02 = `workflows/poteto/pstack-mechanics.md`, 03 = `workflows/poteto/public-workflow.md`, 04 = `workflows/matt-pocock/overview.md`, 05 = `verification/skills-comparison.md`.

## Tier 1: autonomy policy (decide first; everything else follows)

1. **Where on the spectrum, per risk tier?** For each class of change (docs/tests, internal refactors, features behind flags, public API, auth/billing, migrations), pick one: human reviews the PR (Pocock), verifiers merge and you audit main next morning (Tan), or there is no human review at all (StrongDM). Evidence: 01 §risk tiering, 04 §human checkpoints, 02 §merge.
2. **What is a one-way door in *your* projects, and what's its verification contract?** Options: a permanent human floor, rehearsal on a prod snapshot, or both. Tan calls this an unsolved industry problem. Evidence: 05 Q12, 03.
3. **Which project goes first?** The Spring Boot service at work, a personal Node app, or this repo? Pick by verification cost: boot time, how easy it is to seed data, whether it has side-effecting integrations. Evidence: 01 §stack notes, 05 §4.

## Tier 2: verification protocol

4. **Who owns the oracle?** Options: ticket acceptance criteria, the feature map, the author, or you. When the ticket is thin, the verifier either refuses or derives claims from the diff. (05 Q1)
5. **What blocks a ship?** Is INCONCLUSIVE a block? Is FLAG? Who can override, and how is the override logged? (05 Q3)
6. **Should a verdict bind to the commit SHA or to `git patch-id`?** (05 Q4)
7. **Protocol plus recipe, or one generated skill?** And should `verify` and `validate-work` merge into one protocol with surface-specific recipes? (05 Q2, Q10)
8. **Side-effecting paths:** a dry-run mode, fakes or digital twins (StrongDM-style), or skip them? How would you prove the dry-run really never touches the network? (05 Q5, 01)
9. **Grader diversity:** is a Sonnet verifier grading Opus output a real gain, or should a non-Anthropic model verify? (05 Q6, 02 §models)
10. **Author-side protection:** keep the hook only on the verifier, or also protect `tests/` and the feature map from the implementing agent? (05 Q7, Q8)

## Tier 3: the loop itself

11. **Which loop shape?** A Ralph-style single-prompt loop (Pocock/`sandcastle`), the pstack playbook-driven run with a decision log, or ADW's existing ticket-driven phases ([ADR 0001](../../adr/0001-ticket-driven-runs.md))? Evidence: 02 §3, 04 §AFK.
12. **What runs the loop, and where?** Local worktrees (Tan says they top out around 10 agents per machine), Docker sandboxes, or cloud agents? (03, 04)
13. **What are the liveness and stop rules?** Iteration caps, a token budget per run, an hourly audit, and what counts as stuck. (02 §8, 04 §stopping)
14. **What do you see in the morning?** A decision log, a gates file of parked questions, a list of reverts? Decide what you will actually read. (02 §3)
15. **What is the lesson pipeline?** When the same mistake recurs, does it become a lint rule, an ArchUnit test, or a skill edit, and who approves skill edits? (02 §6, 04 retro)
16. **What are the cost ceilings?** Per run and per day. Practitioners' figures range from $9 to $1,000+ per engineer-day. (01 §costs)

## Added by the dissections

Each dissection's §9 lists the decisions that component forces, linked back to the numbers above, and proposes new ones. Grill these alongside the tier they belong to. Two dissections both number their proposals 17–21, so refer to them by dissection, not number:

| Dissection | New decisions it proposes | Tier |
|---|---|---|
| [risk-tiered-merge](dissections/industry/risk-tiered-merge.md) §9 | Human per PR or per release; may an LLM ever lower a tier; shadow-period length and promotion/demotion; separate bot identity for approvals; who edits the policy; auto-revert authority; size thresholds; do P2 findings block | 1 |
| [shipping-merge-authority](dissections/poteto/shipping-merge-authority.md) §9 | Exempt paths per project (6a); where verify sits in the travis phases (6b); whether to use stacked PRs at all; a test/docs carve-out from re-verification | 2 |
| [verification-skill-generator](dissections/poteto/verification-skill-generator.md) §9 | Who proves the recipe; when a control CLI is worth building; backend feature granularity; maintenance cadence and window; where the Spring recipe lives (17–21) | 2 |
| [overnight-contract](dissections/poteto/overnight-contract.md) §9 | Which calls may take a default overnight (14a); does the decision log go into the PR (14b) | 3 |
| [orchestrate-reconcile-loop](dissections/poteto/orchestrate-reconcile-loop.md) §9 | Who reacts to a failed task (deterministic table, planner limited to `plan.json`, or full LLM planner); does `dependsOn` mean upstream merged or handed off; kill or flag stuck agents; Andon surface (STOP file, GitHub label); do measurement mismatches change state | 3 |
| [dune-contract-agent-friendly-codebase](dissections/poteto/dune-contract-agent-friendly-codebase.md) §9 | Which invariant gets the first mechanical boundary in each pilot repo; are boundary-config changes T2/T3 (never auto-merged) | 1 |
