# Curriculum: learn autonomous development by running two existing workflows

**Date:** 2026-10-24
**Status:** The next phase after the grilling session ([decisions-to-grill.md](decisions-to-grill.md), Settled R1–R15).
**Terms:** Check, Verification, Verdict, Claim, Review, Author and Verifier are used exactly as [GLOSSARY.md](GLOSSARY.md) defines them.

---

## Purpose and how to use it

You learn by using (R1). Before you design your own Claude Code plugin (R8), you run two existing workflows on real work and write down what fires, what breaks and what you would keep:

- **Lauren Tan's pstack**, installed as the `pstack` plugin. In Claude Code every pstack command takes the `/pstack:` prefix, for example `/pstack:poteto-mode`.
- **Matt Pocock's skills**, in `~/.claude/skills/`. These are plain slash commands, for example `/grill-with-docs`.

**Ground rules**

| Rule | Source |
|---|---|
| Work in **your pilot repo** only, one of the two personal pilot repos. Never the work Spring Boot service. | R2, R11 |
| **Supervised.** You stay at the keyboard for every exercise in Part 1. Unattended and overnight runs come after the retro. | R1, R10 |
| **Claude Code only**, interactive sessions. No external orchestrator, no second model family. | R5, R10 |
| **Moderate Max 5x budget.** Delegation is fine. No swarms, no unlimited fan-out. | R4 |
| **You merge every PR yourself** during the pilot, whichever workflow opened it. Self-merge by agents is a post-retro experiment, and only on low-risk tiers. | R3 |
| **Mix both workflows** and log every conflict and which side won. | R9 |
| Keep the pstack model config as it is (`~/.claude/rules/pstack-models.md`). Do not re-run `/pstack:setup-pstack`. | R12 |
| One `pilot-log/` entry per exercise, using the [notes template](#notes-template). `pilot-log/` is never committed. | R7, R14 |

**Privacy.** This file is public. The pilot repos are private. Their names and what they build go only in `pilot-log/`, never in this file, a commit message or a public issue.

**Order.** Do Part 1 in order (R13). Part 2 lessons can be done in any order, mostly alongside or after Part 1. Then hold the [retro](#the-retro-r15) (R15).

**Before each session**

1. Start from a clean `main` in your pilot repo, on a new branch or worktree (`claude -w <name>` starts a session in a worktree).
2. Run `/usage` and write down where you are in the current usage window.
3. Open a new `pilot-log/NN-<repo>-<exercise>.md` from the template.
4. After the session, run `/usage` again and finish the log entry while it's fresh.

**Name collisions to know about.** Both workflows ship a `tdd`, `teach` and `prototype` skill. A bare `/tdd` is Pocock's. pstack's is `/pstack:tdd`. Claude Code also has a built-in `/code-review` and `/verify`, and your user-level skills of the same name take their place. When a skill fires, check its description to see whose it is, and log it.

---

## Part 1: the four exercises (R13)

| # | Exercise | Workflow | Stages it covers | Relative cost |
|---|---|---|---|---|
| 1 | Generate a verification skill | pstack | Verify, Learn | Moderate |
| 2 | Bug fix | pstack `/pstack:poteto-mode` | Verify, Build, Review | Moderate to high |
| 3 | Feature | Pocock grill → spec → tickets → implement | Shape, Plan, Build, Review | Moderate |
| 4 | Comparable feature | pstack `/pstack:poteto-mode` | Plan, Build, Verify, Review | Highest |

The relative costs are guesses from the fan-out each playbook prescribes. Your `/usage` readings replace them.

---

### Exercise 1: generate a verification skill

**Goal.** Give your pilot repo a project-local skill that launches the real app, drives one feature the way a user would and captures evidence. Every later exercise uses it for Verification.

**Reading (before):**
- [dissections/poteto/verification-skill-generator.md](dissections/poteto/verification-skill-generator.md) §1–§5
- [workflows/poteto/how-she-develops.md](workflows/poteto/how-she-develops.md) §5, "Daily verification-skill maintenance"
- [README.md](README.md), "What this means for our skills"

**Prerequisites**
- The pilot repo builds and starts on `main` with its documented dev command. If it doesn't, the skill tells the agent to fix that first, and that costs extra.
- A branch: `git switch -c verify-skill`.
- Know which surface matters most (web UI, CLI, API). The skill picks one primary surface.

**Type this**

```
/pstack:create-verification-skill
```

If it asks, answer only what it can't observe from the repo, such as credentials or which surface is primary.

**What happens, step by step** (`pstack/skills/create-verification-skill/SKILL.md`)

1. It reads the Claude Code adapter (`pstack/docs/harness/claude-code.md`), which maps `.cursor/skills/` to `.claude/skills/`.
2. **Interview the repo, not the user.** It works out Surface, Run, Drive, Observe and Isolate from the code.
3. **Generate** `.claude/skills/verify-<app>/SKILL.md` with the sections Launch, Doctor, Drive, Evidence, Cleanup and Helpers.
4. **Seed the feature map** `verify-<app>/features/README.md`, plus one file per user-facing feature (the top 3–5).
5. **Prove the skill.** It runs launch, doctor, drives one mapped feature, captures evidence, cleans up, and confirms the evidence survived cleanup.
6. It points you at `/pstack:maintain-verification-skill`.

**What to watch for**
- Does it ask you anything it could have read from the repo?
- Does "ready" mean usable, or just that a port answers?
- Are the Drive steps real selectors and commands from your repo, or placeholders?
- Does it really run step 5, or only describe it? "A generated skill that was never executed is a draft, not a deliverable."
- **The oracle is protected by instruction only.** Nothing stops the Author from editing the feature map. This repo's `verify` skill uses a PreToolUse guard to make its Verifier read-only. Note where you'd want that guard.

**How to tell it worked**
1. The evidence from step 5 exists on disk after cleanup, at the path the skill names.
2. **Cold read.** Open a fresh session and type: `Use the verify-<app> skill to drive the <second feature> feature and save evidence. Do not edit any files.` Did a cold agent follow it without asking you?
3. **Planted failure.** On a throwaway branch, break the second feature with a one-line change, repeat step 2 and confirm the run fails. A Verifier that can't fail proves nothing. Delete the branch afterwards.
4. Open a PR for the skill and merge it yourself.

**Cost**
- One long session, mostly reading plus one live drive. Moderate.
- To keep it moderate, seed 3 features, not 5, and stop after the cold read if usage is high. Do the planted failure in the next window.

---

### Exercise 2: a bug fix with `/pstack:poteto-mode`

**Goal.** Watch pstack's Bug fix playbook drive a real defect from repro to a PR, with runtime evidence at every step.

**Reading (before):**
- [workflows/poteto/how-she-develops.md](workflows/poteto/how-she-develops.md) §4, "Walkthrough C"
- `pstack/skills/poteto-mode/playbooks/bug-fix.md` and `opening-a-pr.md` (short; read them in full)
- [workflow-map.md](workflow-map.md) §4.2 (TDD) and §4.5 (self-declared completion vs an independent Verifier)

**Prerequisites**
- Exercise 1 done and merged, so `verify-<app>` exists.
- A real, small, reproducible bug on a surface the verify skill can reach. Prefer a known issue over a planted one, because `why` reads the regression history.
- A clean branch or worktree.

**Type this**

```
/pstack:poteto-mode Bug: <symptom>. Steps to reproduce: <steps>. Expected: <x>. Actual: <y>.
Reproduce it with the verify-<app> skill before changing code.
Open a PR when done, but do not merge or babysit it. I land PRs myself during this pilot.
```

**What happens, step by step**

| Step (`bug-fix.md`) | What fires | Model (from your pstack-models rule) |
|---|---|---|
| 0 | It reads the adapter, routes to **Bug fix**, and copies the playbook steps verbatim into a todo list. A skipped step stays in the list as `skip: <reason>`. | Session model |
| 1. Reproduce on the matching surface | Your `verify-<app>` skill | Session model |
| 2. Binary-search the cause | `how` (explorers, then an explainer) and `why` (investigators, then a synthesizer). Instrumentation and logs. | how explorer, why investigators: inherit-parent. how explainer, why synthesizer: opus xhigh |
| 3. Plan the fix | `architect` if the fix crosses a function boundary, then a `pstack:poteto-agent` delegate writes the code | architect runners: opus and sonnet. bug-fix: inherit-parent |
| 4. Verify on the same surface | The lead re-runs the original repro. "Inconclusive" or the wrong surface is not a pass. | Session model |
| 5. Stage the commits | The failing repro lands before the fix. `/pstack:tdd` only if a cheap test target exists. | Delegate |
| 6. Opening a PR | `unslop` and `technical-writing` for prose. `no-comments` spawns `pstack:comment-sicko`. A ready (not draft) PR through `gh`. | judgment and prose: opus xhigh |

**What to watch for**
- **Repro first.** Does it drive the app itself, or ask you to reproduce? The playbook allows asking only with "a stated, specific reason".
- **No guessing.** Is every shipped line traced to runtime evidence? Does it revert changes that a disproved hypothesis motivated?
- **Who produces the Verdict?** The delegate is the Author. The lead re-runs the repro, so the lead acts as Verifier, but the lead also planned the fix. Log whether that felt independent enough.
- **Cursor-only steps.** `/deslop` comes from `cursor-team-kit`, which you don't have. Watch for a `Skipped in Claude Code: ...` line or a silent skip.
- **Conflicts with Pocock.**
  - pstack writes a test only when it's cheap. Pocock's `/tdd` always writes a test first.
  - pstack opens PRs ready. Pocock leaves the PR for human Review.
  - pstack's PR body (Why / What changed / Scope / Tradeoffs / Blast Radius / Verification) differs from Pocock's `/pr` (Summary / Evidence / Merge Danger).
- **The reply contract.** It must cover what was broken, the root cause, the fix and how it was verified, with failing-then-passing repro output pasted verbatim, and name each principle that changed a decision.

**How to tell it worked**
1. **The Verdict holds up.** The reply has the failing-then-passing output. Re-run the repro yourself with `verify-<app>` on the PR head.
2. **The commit order proves the Check can fail.** Run `git log --oneline main..HEAD`. Check out the repro or test commit alone, run it, and confirm it fails. Then confirm it passes on HEAD.
3. The PR body has a `## Verification` section with a real run path.
4. You read the diff, then merge.

**Cost**
- The `how` and `why` fan-outs plus a possible `architect` run make this moderate to high.
- To keep it moderate, pick a bug in one module, so `architect` usually doesn't trigger. If it starts a second round of hypotheses, ask for `/pstack:ketchup` and decide whether to continue in the next window.

---

### Exercise 3: a feature with Pocock's pipeline

**Goal.** Run the day-shift pipeline end to end: align through grilling, fix test seams in a spec, cut tickets, then implement each ticket in a fresh context.

**Reading (before):**
- [workflows/matt-pocock/overview.md](workflows/matt-pocock/overview.md) §2 (the pipeline), §3 (his stance on Verification and TDD), §4.5 (human checkpoints)
- [workflow-map.md](workflow-map.md) §4.1 (who merges) and §4.4 (Review styles)

**Prerequisites**
- Run `/setup-matt-pocock-skills` once in your pilot repo. It writes `docs/agents/*` and the `## Agent skills` block in `CLAUDE.md`. Per R11 you run this setup yourself.
- Pick a small feature, 2–4 tickets' worth. Write a one-paragraph description and keep it, because Exercise 4 needs a comparable feature.
- A feature branch: `git switch -c feat/<name>`. `/implement` commits to the current branch.

**Type this, in one session, from grill to tickets** (Pocock's rule: keep grill, spec and tickets in one unbroken context window)

```
/grill-with-docs <your one-paragraph feature description>
```

Answer the rounds. Accept a recommended answer with "yes". The session ends when the frontier of open decisions is empty. Then:

```
/to-spec
/to-tickets
```

Then, per ticket, in a fresh context:

```
/clear
/implement #<ticket-number>
```

When all tickets are done:

```
/code-review main
/pr
```

Open the PR with `gh pr create`, using the body `/pr` wrote.

**What happens, step by step**

| Command | What fires | Your checkpoint |
|---|---|---|
| `/grill-with-docs` | `grilling` asks the decision frontier in numbered rounds. Fact-finding goes to subagents. `domain-modeling` writes `GLOSSARY.md` and ADRs inline. | Every decision is yours |
| `/to-spec` | Synthesis, no new interview. A spec with user stories, implementation decisions, **test seams** ("the ideal number is one") and out-of-scope, published to the tracker as `ready-for-agent`. | **Approve the test seams** |
| `/to-tickets` | Tracer-bullet vertical slices, each sized to one context window, with blocking edges | **Approve granularity and edges** |
| `/implement` | Fetches the ticket, drives `/tdd` red-green at the agreed seams, runs typecheck and single test files, the full suite once, then `/code-review`, then commits | Watch the first ticket closely |
| `/code-review main` | Two parallel fresh-context subagents: **Standards** and **Spec**, shown side by side, never merged or reranked | You decide what to fix |
| `/pr` | PR body: Summary (smallest visual), Evidence (screenshots S-tier, execution evidence A-tier), Merge Danger (one-way vs two-way door, blast radius) | You read the diff, then merge |

**Mix in Verification (R9).** Pocock has no agent that runs the app. His answer is human QA. After the last ticket, add one step:

```
Spawn a fresh subagent that did not write this code. It uses the verify-<app> skill to check
these Claims from the spec's user stories: <list 2-4, each with its expected observation>.
It must not edit files. It reports PASS, FAIL or INCONCLUSIVE per Claim, with evidence paths.
```

Log whether that Verification found anything that the Checks and `/code-review` missed.

**What to watch for**
- **Grilling quality.** Did it ask about anything the code could have answered? Pocock's rule is "Finding facts is your job, never the user's".
- **Seams.** Does `/implement` stay at the agreed seams, or invent new ones? His own prompt warns this "creates spaghetti tests".
- **Tautological tests**, which assert the implementation against itself.
- **Context discipline.** Note how much context each `/implement` used. One ticket should fit one fresh context.
- **Double Review.** `/implement` already calls `/code-review` per ticket. Was the final branch-wide `/code-review` worth its cost?
- **Conflicts with pstack.**
  - TDD is required here and optional in pstack.
  - You answer every design question here. pstack would settle the empirical ones by prototype.
  - Review here is two rubric axes on one model. pstack's `interrogate` uses multiple models.

**How to tell it worked**
1. All Checks pass: typecheck and the full suite on the branch head.
2. Each ticket's tests exist at the agreed seams and fail on `main`. Spot-check one by running it against `main`.
3. The Verifier's Verdict is PASS for every Claim, with evidence on disk, or you know why not.
4. The PR body's Evidence section points at real runs. You read the diff, then merge.

**Cost**
- Mostly sequential, with one main context per phase. Fan-out is the two `/code-review` subagents per review. Moderate.
- To keep it moderate, limit the feature to 2–3 tickets and implement one ticket per session. Skip the final branch-wide `/code-review` if every per-ticket review was clean, and log that you skipped it.

---

### Exercise 4: a comparable feature with `/pstack:poteto-mode`

**Goal.** Build a feature of the same size and kind as Exercise 3 through pstack's Feature playbook, so you can compare the two workflows on like work.

**Reading (before):**
- `pstack/skills/poteto-mode/playbooks/feature.md` (short; read it in full)
- `pstack/skills/poteto-mode/SKILL.md`, the sections Non-negotiables and Autonomy
- [workflow-map.md](workflow-map.md) §4.4 (personas, rubric axes and model diversity)

**Prerequisites**
- Exercises 1–3 done.
- A feature comparable to Exercise 3: similar size, same surface, same or other pilot repo. Write the same kind of one-paragraph description.
- A clean branch or worktree.

**Type this**

```
/pstack:poteto-mode Feature: <one-paragraph description>.
Verify on the real surface with the verify-<app> skill.
Keep fan-out moderate: arena and architect with the configured runners only, no swarm.
Open the PR(s) ready, but do not merge or babysit. I land PRs myself during this pilot.
```

**What happens, step by step** (`feature.md`)

| Step | What fires | Model |
|---|---|---|
| 0 | Routes to **Feature** and copies the steps verbatim into a todo list | Session model |
| 1 | `how` over the affected subsystem | explorers: inherit-parent. explainer: opus xhigh |
| 2 | `architect`: parallel type and signature sketches before code | architect runners: opus xhigh, sonnet xhigh |
| 3 | A **throughput checkpoint** of four todo items: blocking first steps, independent workstreams, shared mutable state, smallest safe decomposition. An item that doesn't apply stays as `n/a: <reason>`. | Session model |
| 4 | Delegation through a `pstack:poteto-agent`, or through `arena` when several shapes are valid ("Mandatory: no skip-with-reason escape") | feature: inherit-parent. arena runners: opus, sonnet. cross-judge pool: opus, sonnet |
| 5 | Verify on the matching surface with `verify-<app>` | Session model |
| 6 | Rebase into small, ordered commits. Stack follow-ups. | Delegate |
| 7 | `interrogate` if the design is contested | interrogate reviewers: opus xhigh, sonnet xhigh |
| 8 | Opening a PR, as in Exercise 2 | judgment and prose: opus xhigh |

**What to watch for**
- **Questions.** Which questions came to you? pstack sends a "which approach" fork to the Prototype playbook when the answer is observable, and asks only about product or preference calls. Compare with how many you answered in `/grill-with-docs`.
- **Data shape first.** Did it name the data shape and its organizing structure before writing logic (`principle-model-the-domain`)?
- **Arena.** Did `arena` really surface different shapes, and did the cross-judge's pick look right to you?
- **Unit of work.** pstack ships small stacked PRs. Pocock ships tickets on one branch. Which was easier to review?
- **Review.** Compare `interrogate` (findings sorted into Act on / Consider / Noted / Dismissed, two model families here) with Pocock's Standards and Spec axes.
- **Verification.** Who ran `verify-<app>`, and did they write any of the code?

**How to tell it worked**
1. The reply has what was built, what was chosen and why, the throughput checkpoint and open decisions, with tables for design alternatives.
2. The `verify-<app>` run on the PR head gives a PASS with evidence. If it gives INCONCLUSIVE, the playbook says to flag it, not to call it a pass.
3. Each commit or PR in the stack is landable on its own. Spot-check one by building it alone.
4. You read the diffs, then merge bottom-up yourself.

**Cost**
- The highest of the four: `architect`, a mandatory `arena` and maybe `interrogate`, each with two runners at xhigh effort.
- To keep it moderate, start it at the beginning of a fresh usage window and keep the feature as small as Exercise 3's. If `/usage` passes your comfort line mid-run, ask for `/pstack:ketchup` and pause through the Pause safely playbook ("pause safely") instead of killing the session.

---

### After each exercise

Close the session with one Learn step, alternating between the two workflows so you see both:
- After Exercises 1 and 3, run `/retro`.
- After Exercises 2 and 4, run `/pstack:reflect` and approve or reject each proposed skill edit row by row. Do not let anything auto-apply.

Log what each proposed, and whether the proposal was a Check (a deterministic gate) or a prose rule.

---

## Part 2: one lesson per remaining stage

Each lesson is short: reading, an optional exercise and the key question to answer for your own plugin. Stage definitions are in [workflow-map.md](workflow-map.md) §1. Verify is not listed, because Part 1 covers it. **Post-retro** marks exercises that run unattended or overnight. Do not run those before the retro.

### Intake

- **Reading:** [workflow-map.md](workflow-map.md) §2a, Intake row. [how-she-develops.md](workflows/poteto/how-she-develops.md) §2, A1–A2. [matt-pocock/overview.md](workflows/matt-pocock/overview.md) §2.11.
- **Exercise:** Run `/triage` on 3 open issues in your pilot repo. Note which ones reach `ready-for-agent` and what the agent brief contains. pstack's intake is Cursor-only (benny, Automations), so there is nothing to compare it with in Claude Code.
- **Post-retro:** A `/schedule` routine that runs `/triage` on new issues and only labels them.
- **Key question:** What makes an issue eligible for an agent, and who or what applies that label?

### Shape

- **Reading:** [matt-pocock/overview.md](workflows/matt-pocock/overview.md) §2.2–§2.4. The Prototype playbook (`pstack/skills/poteto-mode/playbooks/prototype.md`) and `pstack/skills/figure-it-out/SKILL.md`.
- **Exercise:** Take one fuzzy idea. Run `/pstack:sharpen` on it, then `/grill-with-docs` in a separate session. For one runnable design question, try `/prototype` (Pocock, through `/handoff`), then the pstack Prototype playbook (`/pstack:poteto-mode prototype <question>`).
- **Key question:** Which artifact fixes the Claims before Build starts, and who owns it: you, the spec or the feature map?

### Plan

- **Reading:** [matt-pocock/overview.md](workflows/matt-pocock/overview.md) §2.5. `pstack/skills/poteto-mode/playbooks/multi-phase-plan.md` and `pstack/skills/architect/SKILL.md`. [workflow-map.md](workflow-map.md) §2a, Plan row.
- **Exercise:** Take the spec from Exercise 3 and ask `/pstack:poteto-mode` for a multi-phase plan of the same work, without building it. Compare its PR stack with your tickets.
- **Key question:** What is your unit of work, a ticket or a PR in a stack, and what must a unit carry (allowed paths, Claims, dependencies) before an agent may start it?

### Dispatch/Isolate

- **Reading:** [matt-pocock/overview.md](workflows/matt-pocock/overview.md) §2.6 (`/implement-spec`) and §4.3. [concepts/claude-code-as-harness.md](concepts/claude-code-as-harness.md), rows on worktrees and subagent isolation. [dissections/poteto/orchestrate-reconcile-loop.md](dissections/poteto/orchestrate-reconcile-loop.md) §1–§3.
- **Exercise:** Run `/implement-spec` on a spec with 2 independent tickets. Each implementer gets its own worktree and a merger subagent builds one integration branch. Run `/worktree-setup` if a worktree fails to build. Cap it at 2 parallel implementers.
- **Post-retro:** A thin `claude -p` driver with `--max-budget-usd` that dispatches one ticket per run.
- **Optional design exercise (paper only):** Read [dissections/matt-pocock/software-factory-skill.md](dissections/matt-pocock/software-factory-skill.md) §3 and §7.1. Pick one cheap, reversible Task for your pilot repo, such as Explore (labels only) or Ratchet (one PR a day), and answer Matt's five questions in your `pilot-log/` entry: (1) what triggers it, (2) what it does and which services it reads and writes, (3) what it triggers next, (4) where a human re-enters, (5) what stops two Runs doing the same work. Then name a product for every slot (Ticket tracker, Git host, Orchestrator, Runner, Observability platform or a deliberate none). The design is done when every question has an answer. Build nothing until the retro.
- **Key question:** How many agents in parallel does Max 5x support for you, and is a worktree enough isolation or do you need a container?

### Build

- **Reading:** [workflow-map.md](workflow-map.md) §4.2. [matt-pocock/overview.md](workflows/matt-pocock/overview.md) §2.7 and §3. `pstack/skills/tdd/SKILL.md`. `pstack/docs/guide/05-build-and-clean.md`.
- **Exercise:** None new. Reuse your Exercise 2 and 3 logs. List each test the Author wrote and mark it: written first at an agreed seam, written after the fix, or tautological.
- **Key question:** Where do you require test-first, and how do you protect tests and the feature map from the Author?

### Review

- **Reading:** [matt-pocock/overview.md](workflows/matt-pocock/overview.md) §2.8. `pstack/skills/interrogate/SKILL.md`. [workflow-map.md](workflow-map.md) §4.4.
- **Exercise:** On one merged PR from Part 1, run both `/code-review <base-sha>` and `/pstack:interrogate`. Compare the findings. Which were real, which were noise, and which did only one of them catch? Optionally add `/pstack:blast-radius`.
- **Key question:** Does a Review finding block a merge, and is model diversity (Opus vs Sonnet) worth its cost over rubric axes on one model?

### Merge

- **Reading:** [dissections/poteto/shipping-merge-authority.md](dissections/poteto/shipping-merge-authority.md) §1–§4. [dissections/industry/risk-tiered-merge.md](dissections/industry/risk-tiered-merge.md) §1–§4 and its tier table. `pstack/skills/poteto-mode/playbooks/shipping.md` and `autopilot-stack.md`.
- **Exercise:** Draft a risk-tier table for your pilot repo: which paths are T0 (docs, tests) and which are one-way doors. Then, on a scratch branch, run `git patch-id --verbatim` on a commit before and after a rebase and see that it stays the same.
- **Post-retro:** The Shipping playbook landing one verified T0 PR (`/pstack:poteto-mode ship #<pr>`), with you watching. Autopilot-full comes later still.
- **Key question:** Which tiers may an agent merge, and what binds a Verdict to the exact code that lands?

### Operate/Monitor

- **Reading:** [dissections/poteto/overnight-contract.md](dissections/poteto/overnight-contract.md) §1–§5. `pstack/skills/poteto-mode/playbooks/babysit.md` and `autonomous-run.md`. `pstack/skills/show-me-your-work/SKILL.md`. [concepts/claude-code-as-harness.md](concepts/claude-code-as-harness.md), "What this means for the research".
- **Exercise (daytime):** On an open PR, type `/pstack:poteto-mode check on PR #<n>` (Babysit in `check` mode: one status pass and a report). Then try `/pstack:show-me-your-work` on a long supervised session and read the decision log afterwards.
- **Post-retro:** One overnight Autonomous run on reversible work, with a done condition that can pass or fail, a decision trail, an hourly `/loop` audit and a morning `/pstack:ketchup`.
- **Key question:** What will you actually read in the morning, and what are the stop rules (iteration cap, budget, what counts as stuck)?

### Learn

- **Reading:** [how-she-develops.md](workflows/poteto/how-she-develops.md) §5. [matt-pocock/overview.md](workflows/matt-pocock/overview.md) §2.10. `pstack/skills/correct/SKILL.md`. The Eval playbook (`pstack/skills/poteto-mode/playbooks/eval.md`).
- **Exercise:** After Part 1, run `/pstack:correct` on your pilot repo. Keep only checks it proves fail on a real past mistake. Then run `/pstack:maintain-verification-skill` once and see whether the feature map drifted during the pilot.
- **Post-retro:** A scheduled `maintain-verification-skill` pass, and a `/pstack:automate-me` draft of your own mode skill as a seed for the plugin.
- **Key question:** When a mistake repeats, what does it become (lint, type, test, architecture constraint or skill edit), and who approves skill edits?

---

## The retro (R15)

Hold it after the four exercises, not on a date. Bring every `pilot-log/` entry. Run it as a `/grilling` session over this checklist, then record the outcomes in [decisions-to-grill.md](decisions-to-grill.md) as round 2.

**Review**
- [ ] For each exercise: did it produce a Verdict you trusted, and why or why not?
- [ ] Every conflict logged, and which side won each time: TDD, who asks the questions, unit of work, Review style, PR body, who merges.
- [ ] Every time a skill fired that you didn't expect, or failed to fire. Name collisions. Cursor-only steps that were skipped.
- [ ] `/usage` per exercise. Which fan-outs (architect, arena, interrogate, how, why, code-review) earned their cost?
- [ ] Where you stepped in, and whether a Check could have replaced you.
- [ ] Did the Exercise 3 Verification catch anything that the Checks and Review missed?
- [ ] Did the `verify-<app>` skill stay accurate? Did the planted failure fail?
- [ ] What `/retro` and `/pstack:reflect` proposed, and which proposals were Checks rather than prose.

**Decide** (most map to open questions in [decisions-to-grill.md](decisions-to-grill.md))
- [ ] Verification protocol: who owns the Claims, what blocks a ship (is INCONCLUSIVE a block?), and SHA vs `git patch-id` (Q4–Q6).
- [ ] Protocol plus per-repo recipe, or one generated skill (Q7). Keep the mechanical read-only guard for the Verifier?
- [ ] Author-side protection for tests and the feature map (Q10).
- [ ] TDD policy: required, optional, or per seam.
- [ ] Shape: grill first (Pocock) or prototype first (pstack), or each by task type.
- [ ] Unit of work: ticket or stacked PR.
- [ ] Review: rubric axes, model diversity, or both. Does Review block?
- [ ] Merge: a first risk-tier table for the pilot repo, and the first tier, if any, that agents may merge (R3).
- [ ] Loop shape and the unattended layer (`/schedule`, an Action or a `claude -p` driver) (Q11–Q13, R10).
- [ ] Cost ceilings per run and per day (Q16).
- [ ] Lesson pipeline: what becomes a Check, and who approves skill edits (Q15).
- [ ] Which post-retro exercises from Part 2 to run first.
- [ ] The first three components of your plugin, and which existing skill each one borrows from.

---

## Notes template

Copy this into `pilot-log/NN-<repo>-<exercise>.md`. Repo names are allowed there because `pilot-log/` is never committed.

```markdown
# NN: <exercise name>

- **Date:**
- **Repo:**
- **Exercise:** <Part 1 #, or Part 2 stage>
- **Branch / worktree:**
- **Usage at start (`/usage`):**

## Commands run
<!-- In order, verbatim, including prompts typed mid-run. -->
1.

## What fired
<!-- Skill, playbook, subagent type, model and effort, in order. Note unexpected or missing ones. -->
| Step | Skill / playbook / subagent | Model | Notes |
|---|---|---|---|

## Verdict and evidence
- **Claims checked:**
- **Verifier (who, and did it write any code?):**
- **Verdict:** PASS / FAIL / INCONCLUSIVE
- **Evidence paths:**
- **Checks (types, lint, tests):**
- **Did I merge? After reading what?**

## Surprises
-

## Conflicts and which side won
| Conflict | pstack did | Pocock did | Winner | Why |
|---|---|---|---|---|

## Where I stepped in
-

## Cost / usage observed
- **Usage at end (`/usage`):**
- **Wall-clock time:**
- **Most expensive step:**
- **Worth it?**

## For my plugin
- **Keep:**
- **Change:**
- **Drop:**
- **Open question for the retro:**
```
