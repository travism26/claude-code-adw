# Software factories: how autonomous development works, and what to build here

**Date:** 2026-10-24
**Goal:** Understand how Lauren Tan (poteto) and Matt Pocock develop without reviewing every PR. Learn the concepts first and the mechanisms second, then use them to improve this repo's `verify` / `validate-work` / `ship-gate` skills and design our own autonomous loop. The aim is to borrow parts of their workflows, not copy them wholesale.

**Scope: research only.** Nothing here is a plan to change this repo. The ADW harness is about six months old and serves as dated reference material. Wherever a doc has a "port to ADW" section, read it as a worked example of how a mechanism would land in a real harness, not as a backlog. Building a new harness (or upgrading this one) is tracked separately in [issue #4](https://github.com/travism26/claude-code-adw/issues/4). The end goal is a workflow you understand end to end and can stand up quickly in other repos (Spring Boot, Rust, Node/TS).

## Reading order

**Visual guide:** open [guide.html](guide.html) in a browser for the whole picture on one page. **Hands-on path:** [curriculum.md](curriculum.md). **Vocabulary:** [GLOSSARY.md](GLOSSARY.md).

**Level 0: the map** (start here)

| File | Read it for |
|---|---|
| [workflow-map.md](workflow-map.md) | Six workflows (Poteto, Pocock, StrongDM, Ralph, Anthropic harness, our ADW) compared stage by stage: where they conflict, where they agree, a borrow sheet for ADW, and the dissection backlog |
| [concepts/software-factory-concept.md](concepts/software-factory-concept.md) | What the hype term means, where it came from (StrongDM, Shapiro's levels, Ralph, OpenAI, Cursor), the common architecture, costs, evidence against it, and Spring / Rust / Node notes |

**Level 1: one workflow at a time**

| File | Read it for |
|---|---|
| [workflows/poteto/how-she-develops.md](workflows/poteto/how-she-develops.md) | **The reconstruction.** Three walkthroughs (an overnight Slack bug, "I'm going to bed, land this", daytime `/poteto-mode`), the learning loop, her day, and what to build first |
| [workflows/poteto/public-workflow.md](workflows/poteto/public-workflow.md) | What Lauren says she does, in her own words (video captions, X articles) |
| [workflows/poteto/repos-and-evolution.md](workflows/poteto/repos-and-evolution.md) | noodle → brainmaxxing → pstack → Automations: what each step solved, and what was kept or dropped and why |
| [workflows/poteto/pstack-mechanics.md](workflows/poteto/pstack-mechanics.md) | pstack internals: the overnight contract, playbooks, merge discipline, liveness rules |
| [workflows/poteto/cursor-native-pieces.md](workflows/poteto/cursor-native-pieces.md) | What lives outside the Claude Code build: benny automations, the orchestrate plugin, the cursor-team-kit control tools, advisor, thermos; with Claude Code equivalents |
| [workflows/matt-pocock/overview.md](workflows/matt-pocock/overview.md) | Matt's pipeline (grill, spec, tickets, implement, review, PR), his Ralph / `sandcastle` AFK loop, and his "day shift / night shift" human gates |
| [workflows/adw/overview.md](workflows/adw/overview.md) | Our own pipeline: what works, what's broken, and what's missing for an unattended night |

**Level 2: verification, decisions, dissections**

| File | Read it for |
|---|---|
| [verification/skills-comparison.md](verification/skills-comparison.md) | Our verification skills against theirs, with prioritized improvements |
| [decisions-to-grill.md](decisions-to-grill.md) | The decisions only you can make, in the order to make them |
| [dissections/industry/risk-tiered-merge.md](dissections/industry/risk-tiered-merge.md) | Which PRs can skip you: 10 sources compared, a T0–T3 tier table for ADW, Spring/Rust/Node high-risk paths |
| [dissections/poteto/verification-skill-generator.md](dissections/poteto/verification-skill-generator.md) | How pstack generates a per-app verification skill, and a `create-verify-recipe` design that keeps our guarded verifier |
| [dissections/poteto/shipping-merge-authority.md](dissections/poteto/shipping-merge-authority.md) | How a non-author verdict tied to the patch (`git patch-id --verbatim`) authorizes a merge; verdict format and `verdict_check.py` for ship-gate |
| [dissections/poteto/overnight-contract.md](dissections/poteto/overnight-contract.md) | The bedtime contract, iteration loop, decision log, hourly audit and morning brief; an `adw night` design with a Spring example |
| [dissections/poteto/orchestrate-reconcile-loop.md](dissections/poteto/orchestrate-reconcile-loop.md) | The orchestrate plugin's queue, exit codes, failure classes and stuck detection (and its defects); an ADW queue driver design |
| `dissections/TEMPLATE.md` | Outline for further dissections (backlog in `workflow-map.md` §6) |

Earlier, related notes: [../verification-loop-research.md](../verification-loop-research.md) and [../feedback-loop-practices-research.md](../feedback-loop-practices-research.md).

## The big picture in one page

**A software factory is a pipeline where agents write the code *and* decide whether it merges.** Humans own the intent (specs, scenarios), the harness, and the risk policy. The hard part is not generating code. It is trusting code nobody read. Every serious practitioner arrives at the same answer: **verification by something other than the author, against an oracle the author cannot edit, producing evidence instead of claims.**

**How Lauren "codes while sleeping"** (03, 02):

1. **Trust before parallelism.** She stays at 1–5 supervised agents until the agents can check their own work. "You can't spawn 100 agents when you don't even trust the output of one."
2. **A per-app verification ("control") skill is critical infrastructure.** It is a small CLI that boots and drives the real app over Chrome DevTools Protocol, plus a feature map of the main user flows. A daily automation keeps it current. pstack's `create-verification-skill` generates this per project.
3. **The codebase is the agents' memory.** It is restrictive by design: one blessed way to do each thing, and every repeated correction becomes a lint rule or architectural constraint. Her job becomes "gardener".
4. **The overnight run is a contract.** It has a done condition that can pass or fail, an isolated worktree or cloud VM, verifiers that did not write the code, and a decision log audited in the morning. "A duration is not a finish condition." Questions get answered by prototype or by a stated default, never by blocking. Irreversible actions still wait for a human.
5. **Merging is the most guarded step.** Only verified PRs from the bottom of a stack land. A verdict must still match the code (`git patch-id`). CI gets exactly one retry per flake.
6. **In the morning** she reviews main and the commit history, not every PR. She reverts or adds a lint rule.
7. **Caveats:** all numbers are self-reported, she has "unlimited tokens" at an AI lab, and she calls the first unattended night "very scary". The earlier verification-loop doc says she cut from ten verifiers to one; the transcript shows she only offered that as a cost knob.

**How Matt differs** (04): the same foundation (feedback loops, fresh-context review, TDD at agreed seams), but **a human always sits at planning approval, merge and QA**. His AFK loop (Ralph, packaged as `sandcastle`) runs sandboxed, can't push, and always ends in a PR. He treats a "dark factory" as a failure mode. His stack has no agent that runs the app, and our `verify` fills that gap.

**The spectrum, roughly:**

```
Matt Pocock ─────────── Lauren Tan (pstack) ─────────── StrongDM "dark factory"
human approves plan,    human sets contract + risk      no human code, no human review;
reviews PR + QA;        policy; verifiers authorize      holdout scenarios + digital twins
agents can't push       reversible merges; human         decide merges
                        audits main next morning
```

You don't pick a point on this line once. You pick it **per risk tier**. Everyone keeps humans on auth, billing, migrations and other one-way doors, and HumanLayer turned review back on after an outage in code nobody had read for three months (01).

## What this means for our skills (from 05)

Our `verify` already does the hardest part better than pstack: **the oracle is read-only by mechanism** (a fail-closed PreToolUse guard), not by instruction. The gaps are elsewhere:

1. **`ship-gate` never reads the verify verdict.** A branch can ship with no report or with a FAIL. Fix: require VERIFIED for HEAD (via `git patch-id`) and put a Verification section in the PR body.
2. **The author writes the claims.** The one real run passed "GET /health answers" while the body said `"status": "unhealthy"`. Fix: the verifier derives claims from the ticket and adds a regression claim of its own; vague expectations make the run INCONCLUSIVE.
3. **No project recipe.** Every run works out launch, port and seed data from scratch. Fix: a pstack-style generator that writes `verify-<app>` (launch / doctor / drive / evidence / cleanup / feature map) and executes it once before calling it done.
4. **Nothing proves the verifier can fail.** Fix: bug-fix claims must fail on the parent commit, and each recipe gets a planted-failure run.
5. **The running app must match the commit under test,** and degraded dependencies must make the run INCONCLUSIVE, not a pass.

Keep `verify` as the **protocol** (who grades, what is read-only, the verdict format) and generate **recipes** per stack. That split is how one skill can serve a Spring Boot service, a Rust CLI and a Node web app.

## Suggested learning path

1. Read 01 and 03 for concepts.
2. Read 02 sections 3–4 for the overnight mechanics. Its `07-overnight.md` source is the single best primary document.
3. Pick decisions in 06 (grilling session).
4. Ship improvements 1, 2 and 5 from 05 (small, high value).
5. Build the recipe generator on one real project (the Spring Boot service), run it supervised, and watch it fail.
6. Only then try one unattended run with a tight done condition, on reversible work, with a morning audit.
