# Matt Pocock's agentic workflow: pipeline, feedback loops, and AFK coding

**Date:** 2026-10-24
**Question:** How does Matt Pocock run agentic development end to end, and in particular how does he handle verification, feedback loops and AFK (away-from-keyboard) autonomous coding? The goal is a comparison against Lauren Tan's (poteto) pstack and this repo's own skills, as input for building our own version.
**Method:** I read the installed skills under `~/.agents/skills/` (symlinked from `~/.claude/skills/`), and checked their provenance against `~/.agents/.skill-lock.json` and upstream `mattpocock/skills`. I read the `mattpocock/sandcastle` README, its templates, and the repo's own `.sandcastle/` workflows through `gh api`, plus `mattpocock/dictionary-of-ai-coding` entries. I also read the AI Hero Ralph article, the AI Engineer Europe 2026 talk page, and the Pragmatic Engineer episode page.
**Companion docs (not repeated here):** `docs/research/verification-loop-research.md` covers the poteto livestream, the verifier-design rules and the evidence ladder. `docs/research/seven-phase-workflow-research.md` covers how the seven-phase flow compares with Spec Kit, Kiro and Task Master, and Huntley's own warnings about Ralph.
**Dissections:** [../../dissections/matt-pocock/software-factory-skill.md](../../dissections/matt-pocock/software-factory-skill.md) covers his draft `software-factory` skill (mattpocock/skills#1316): the factory vocabulary, the brakes, the 5 questions per task and the slot surveys.

---

## Summary

Pocock's workflow is a **day shift / night shift** split. The human does the day shift: aligning on intent through grilling, then approving the spec's test seams and the ticket breakdown. Everything up to "tickets are labelled `ready-for-agent`" is human-reviewed. The night shift is AFK. A loop (Ralph, now packaged as `sandcastle`) picks one unblocked ticket per iteration inside a Docker sandbox, builds it test-first, runs typecheck and tests, and commits. A fresh-context reviewer, often a different model, then improves the branch. The human comes back for **QA and code review**. QA is where he "imposes taste", and its output is more tickets.

His stance on verification is **feedback loops first**: types, tests, browser access and pre-commit hooks. "The rate of feedback is your speed limit." Review comes in layers: deterministic checks, then automated review by a separate agent, then human review of the diff. He says outright that this does not replace human QA and code review. His own glossary calls a codebase that nobody reads a **dark factory** and treats it as a failure mode, not a goal. That is the main difference from poteto. pstack lets an independent verifier swarm authorise merges under a full-autonomy grant. Pocock keeps a human at the end of every AFK run, and his tooling stops at "reviewable branch/PR".

His skills have no dedicated "run the app and observe" verifier. The nearest things are the `/pr` evidence section, the `/diagnosing-bugs` feedback-loop phase, and his own conference demo, where green tests hid a missing database table. That gap is what this repo's `verify` skill fills.

---

## 1. Which locally installed skills are his

Provenance comes from `~/.agents/.skill-lock.json`. Every entry below with `source: mattpocock/skills` is his. I spot-checked `tdd` and `implement` and both are byte-identical to upstream `main`.

| Origin | Skills |
|---|---|
| **Matt Pocock** (`mattpocock/skills`) | ask-matt, code-review, codebase-design, diagnosing-bugs, domain-modeling, grill-me, grill-with-docs, grilling, handoff, implement, implement-spec, improve-codebase-architecture, pr, prototype, research, retro, setup-matt-pocock-skills, tdd, teach, to-questionnaire, to-spec, to-tickets, triage, wait-what, wayfinder, wizard, writing-for-agents |
| Matt's, but credited | `pr` credits Dex Horthy / HumanLayer's `show-me` skill (`~/.agents/skills/pr/SKILL.md` frontmatter `metadata.credits`) |
| Kun Chen (kunchenguid) | `lavish` (lock: `kunchenguid/lavish-axi`), `no-mistakes` (a plain dir in `~/.claude/skills/no-mistakes/`, links to `kunchenguid.github.io/no-mistakes`) |
| Vercel Labs | `find-skills` (lock: `vercel-labs/skills`) |
| Anthropic / Claude app sync | everything under `~/.claude/skills/synced/` (docx, pdf, pptx, xlsx, skill-creator, deep-research, morning, ...) |
| Likely the user's own | `tech-radar`, `worktree-setup` (plain dirs, no lock entry, no author metadata). In this repo: `.claude/skills/{verify, validate-work, ship-gate, task-brief, install-agentic-stack}` |
| Unclassified | `~/.agents/skills/caido-mode` (present in `.agents`, not symlinked, no lock entry) |

The router `ask-matt` (`~/.agents/skills/ask-matt/SKILL.md`) is his own map of the whole flow. It is the best single file to read.

---

## 2. The pipeline end to end

Source of truth: `~/.agents/skills/ask-matt/SKILL.md` ("The main flow: idea → ship"). The README's framing is that each skill fixes one named failure mode: misalignment, verbosity, code that doesn't work, and a ball of mud ([skills README](https://github.com/mattpocock/skills/blob/main/README.md)).

```
setup-matt-pocock-skills (once per repo: tracker, labels, GLOSSARY/ADR layout)
        │
idea ──► /grill-with-docs ──(runnable question?)──► /handoff → /prototype → /handoff back
        │  (one unbroken context window from here...)
        ▼
     /to-spec ──► /to-tickets ──(...to here, then clear)
        ▼
  per ticket: /implement (+ /clear between)   OR   /implement-spec (task-graph, parallel)
        │  each drives /tdd at pre-agreed seams, closes with /code-review
        ▼
      /pr (body shape)  ──►  human QA + review  ──►  /retro (fix the environment)
on-ramps: /triage (incoming issues) · /diagnosing-bugs (broken) · /wayfinder (huge, foggy)
upkeep:   /improve-codebase-architecture → feeds back into /grill-with-docs
```

### 2.1 `/setup-matt-pocock-skills`, the precondition
**Mechanism.** One interview, one section at a time. It writes `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md` and `docs/agents/domain.md`, and adds an `## Agent skills` pointer block to `CLAUDE.md`/`AGENTS.md` (`~/.agents/skills/setup-matt-pocock-skills/SKILL.md`). This repo's `CLAUDE.md` contains that block.
**Why it works.** Every downstream skill says "the issue tracker should have been provided to you. If not, tell the user to run `/setup-matt-pocock-skills`". Tracker operations live in one config doc instead of being hard-coded in each skill. The skills stay small and portable across GitHub, GitLab, local `.scratch/` files or Linear.

### 2.2 Grill: `/grilling`, `/grill-me`, `/grill-with-docs`
**Mechanism.** `grilling` maps the plan as a **design tree** and asks the whole **frontier**, meaning the decisions whose prerequisites are settled, in numbered rounds. Each question comes with a recommended answer worded so that "yes" accepts it. The two wrappers just call it: `grill-me` alone, and `grill-with-docs` together with `domain-modeling`, which writes `GLOSSARY.md` and ADRs inline. The rule: "Finding _facts_ is your job, never the user's", so facts go to sub-agents. "The _decisions_ are the user's." The session ends when the frontier is empty (`~/.agents/skills/grilling/SKILL.md`).
**Why it works.** It goes after the most common failure, an agent that "didn't do what I want". It does this before any code exists, which is the cheapest point to fix it. The glossary also gives the agent concise **ubiquitous language**, "materialization cascade" instead of a sentence. He calls this "might be the single coolest technique in this repo" ([README](https://github.com/mattpocock/skills/blob/main/README.md)). The idea credits Anthropic's Thariq Shihipar ([Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/ai-skills-with-matt-pocock)).

### 2.3 Optional detour: `/prototype` bridged by `/handoff`
**Mechanism.** If a question needs a runnable answer, such as a state model or a UI, he hands off to a fresh session in a separate directory. That session builds throwaway code on a `prototype/<name>` branch, then hands back what it learned (`ask-matt/SKILL.md` step 2).
**Why it works.** Taste questions get answered with concrete artifacts. The prototype becomes a primary source that the spec can quote: `to-spec` allows inlining prototype snippets that "encode a decision more precisely than prose".

### 2.4 `/to-spec`
**Mechanism.** No interview, just synthesis of the conversation. It has one human checkpoint: "Sketch out the seams at which you're going to test the feature... Use the highest seam possible... the ideal number is one. Check with the user that these seams match their expectations." The template covers Problem, Solution, a *long* User Stories list, Implementation Decisions (no file paths), Testing Decisions and Out of Scope. It publishes to the tracker labelled `ready-for-agent` (`~/.agents/skills/to-spec/SKILL.md`).
**Why it works.** Grilling, spec and tickets stay in **one unbroken context window**, so the spec is written from the primary source rather than a summary (`ask-matt`, "Context hygiene"). Agreeing the test seams *here* is what lets the later AFK TDD run without asking. In his talk he says he does not usually read the PRD closely, because he trusts it after a thorough grilling ([AI Engineer](https://ai.engineer/talks/ai-coding-workflow)).

### 2.5 `/to-tickets`
**Mechanism.** It splits the spec into **tracer-bullet vertical slices**. Each slice is a "narrow but COMPLETE path through every layer", "demoable or verifiable on its own" and "sized to fit in a single fresh context window", with explicit **blocking edges**. Prefactoring comes first ("make the change easy, then make the easy change"). Wide refactors are the exception and go through expand, migrate and contract batches. It quizzes the user on granularity and edges until they approve, then publishes with native blocking links (`~/.agents/skills/to-tickets/SKILL.md`).
**Why it works.** The blocking graph is what allows parallel AFK work: there is always a ready **frontier**. One-context-window sizing respects the smart zone. Vertical slices mean each ticket ends in something a check or a human can verify.

### 2.6 `/implement` and `/implement-spec`
**Mechanism.** `/implement` is seven lines. It fetches the ticket, drives `tdd` "at pre-agreed seams", runs typecheck and single test files regularly and the full suite once at the end, calls `code-review`, then commits (`~/.agents/skills/implement/SKILL.md`). `/implement-spec` orchestrates a whole spec. It treats tickets as a **task graph** and runs background **implementer subagents**, one worktree and branch per ticket, across the frontier. A **merger subagent** merges each finished ticket onto one **integration branch**. One `code-review` runs on the integration branch, and a single implementer fixes its findings. Communication goes "primarily through context pointers" (`~/.agents/skills/implement-spec/SKILL.md`).
**Why it works.** Each ticket starts in a fresh context, so the previous ticket's context can be thrown away. Implementation (high context pressure) is kept separate from review (low context pressure), as `retro` explains.

### 2.7 `/tdd`
**Mechanism.** Red before green, one seam, one test and one minimal implementation per cycle. Tests are only written at **confirmed seams**. Anti-patterns are named: implementation-coupled tests, **tautological** tests (`expect(add(a,b)).toBe(a+b)`), and horizontal slicing (all tests first). "Refactoring is not part of the loop", because it moves to review. Mock only at system boundaries (`~/.agents/skills/tdd/{SKILL.md,tests.md,mocking.md}`).
**Why it works.** A test written first, against a seam the human agreed, is a check the implementer did not shape to fit its own code. That is the same property verification-loop research asks of a verifier, enforced by ordering instead of permissions.

### 2.8 `/code-review`
**Mechanism.** It pins a fixed point and runs `git diff <fp>...HEAD`. Two **parallel, fresh-context sub-agents** review it. **Standards** checks repo docs plus a Fowler smell baseline, always as judgement calls, and the repo's documented standards win. **Spec** reports missing requirements, scope creep, and wrong implementations, quoting spec lines. The reports are presented side by side and "Do **not** merge or rerank findings" (`~/.agents/skills/code-review/SKILL.md`).
**Why it works.** Code can pass one axis and fail the other, and keeping them separate stops one from masking the other. A fresh context avoids the self-review trap. In his words, the authoring session "reads its own conclusions back as confirmation" ([dictionary: Automated review](https://github.com/mattpocock/dictionary-of-ai-coding/blob/main/dictionary/Automated%20review.md)).

### 2.9 `/pr`
**Mechanism.** The PR body has a Summary (the smallest visual: pseudocode, call tree, diff sketch or Mermaid), **Evidence** (before/after, where "Screenshots are S-tier", "Execution-based evidence is A-tier"), and **Merge Danger** (one-way vs two-way door, plus blast radius) (`~/.agents/skills/pr/SKILL.md`).
**Why it works.** It makes the end-of-run human review cheap. The reviewer gets proof and a risk call, not narration.

### 2.10 `/retro`
**Mechanism.** After a session, it proposes changes to the **environment**, not the code: navigation pointers, automated checks, coding standards, steering-file bloat, tool economy, and information access. "A **mechanical** one... gets a deterministic check, full stop". Only judgement calls go to `CODING_STANDARDS.md`. A repo with no pre-commit hook or CI guardrail "is itself a finding". Standards are enforced by the reviewer, not the implementer (`~/.agents/skills/retro/SKILL.md`).
**Why it works.** This is his learning loop. Each failure becomes a check the next AFK run can self-correct from.

### 2.11 On-ramps
- **`/triage`** runs a label state machine: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Before grilling it **verifies the claim** ("For a bug, reproduce it"). It writes an **agent brief**: behavioural, durable (no file paths), with complete testable acceptance criteria and explicit out-of-scope. Its header says it "is the authoritative specification that an AFK agent will work from" (`~/.agents/skills/triage/{SKILL.md,AGENT-BRIEF.md}`). **`ready-for-agent` vs `ready-for-human` is his HITL/AFK split, encoded as tracker labels.**
- **`/diagnosing-bugs`** says "Phase 1: Build a feedback loop. **This is the skill.**" There is no Phase 2 until a single command has been run that is **red-capable, deterministic, fast and agent-runnable**. Then it minimises the repro, writes 3 to 5 ranked falsifiable hypotheses (shown to the user, "Don't block on it... if the user is AFK"), instruments with tagged logs, and writes the regression test before the fix, only if a correct seam exists. "If no correct seam exists, that itself is the finding" (`~/.agents/skills/diagnosing-bugs/SKILL.md`).
- **`/wayfinder`** handles work bigger than a session. It builds a map issue plus child **decision tickets**, and produces "decisions, not deliverables". It hands off to `/to-spec` and does not build (`~/.agents/skills/wayfinder/SKILL.md`).

### 2.12 Context discipline across the pipeline
`ask-matt/PHASE-BOUNDARIES.md` is an ordered decision tree used only at phase boundaries: Continue, `/clear`, `/handoff`, subagent (the "AFK" option, "Automated review is the standard case"), and `/compact` last. Every move except Continue turns a **primary source** into a lossy **secondary source**. The smart zone is about 100K tokens in the talk and 125K to 150K in his dictionary ([dictionary: Smart zone](https://github.com/mattpocock/dictionary-of-ai-coding/blob/main/dictionary/Smart%20zone.md)). Sizing each ticket to one fresh session follows from that.

---

## 3. His stance on verification, TDD, feedback loops and review

**Feedback loops are the speed limit.** He quotes *The Pragmatic Programmer*: "The rate of feedback is your speed limit". The fix for code that doesn't work is "the usual tranche of feedback loops: static types, browser access, and automated tests" ([README](https://github.com/mattpocock/skills/blob/main/README.md)). In the Ralph article: "The best setup blocks commits unless everything passes" (pre-commit hooks), and "Never outrun your headlights" ([AI Hero, 11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)).

**He has precise vocabulary for the layers** ([dictionary-of-ai-coding](https://github.com/mattpocock/dictionary-of-ai-coding/tree/main/dictionary)):
- *Automated check*: deterministic pass/fail, which the agent self-corrects from. "A flaky test is a broken check". "Green checks mean the asserted properties hold, not that the code is right." He tells readers to avoid the words "feedback loop" and "backpressure" because they lump checks together with review.
- *Automated review*: non-deterministic, done by a separate agent, ideally with a different model or a scoped system prompt. It is "a filter that raises the floor before a human looks, not a gate that replaces one."
- *Human review*: reading the **diff**, not the agent's description of it ("narration is not the artifact"). It is reserved for "whether the change is the right change".

**Verification, as distinct from tests.** He asks agents to "produce proof that their code works", with or without TDD ([Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/ai-skills-with-matt-pocock)). In his AI Engineer demo, tests and typecheck passed but using the feature exposed a missing DB table ([AI Engineer](https://ai.engineer/talks/ai-coding-workflow)). His answer is **human QA**: "I need to actually look at the dashboard"; "QA is how I... impose my taste"; and QA's output is "creating more issues for that Kanban board". His answer is not an automated run-the-app verifier. (These quotes and timestamps come from the talk page's transcript text, read through a summarising fetch, so treat the wording as close but unverified.)

**TDD has an unresolved tension.** The skills enforce red-green at agreed seams: `/implement`, `/implement-spec`, and every Sandcastle implement prompt ("RGR... write a failing test first"). But on Pragmatic Engineer (Sep 17, 2026) he said he has moved away from *requiring* TDD for agents, because it mainly helps humans with "shorter working memories". The skills and the stated opinion differ. His own dogfood implement prompt adds: "Do not improvise new test seams... This creates spaghetti tests" ([sandcastle `.sandcastle/agent-workflows/implement/prompt.md`](https://github.com/mattpocock/sandcastle/blob/main/.sandcastle/agent-workflows/implement/prompt.md)).

**Code design is part of verification.** "Bad codebases make bad agents". "Agents amplify what they see". Deep modules with small interfaces stay human-owned. `/improve-codebase-architecture` runs "once every few days" ([README](https://github.com/mattpocock/skills/blob/main/README.md); [AI Hero](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum); [AI Engineer](https://ai.engineer/talks/ai-coding-workflow)). This also explains why the `diagnosing-bugs` "no correct seam" finding goes back to architecture work.

---

## 4. The AFK / autonomous loop

### 4.1 Lineage: Ralph, then Sandcastle
He credits Ralph to Geoffrey Huntley (see the seven-phase doc). His canonical form is a bash loop ([AI Hero, 11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)):

```bash
for ((i=1; i<=$1; i++)); do
  result=$(docker sandbox run claude -p "@some-plan-file.md @progress.txt \
  1. Decide which task to work on next... 2. Check any feedback loops, such as types and tests. \
  3. Append your progress to the progress.txt file. 4. Make a git commit of that feature. \
  ONLY WORK ON A SINGLE FEATURE. ... output <promise>COMPLETE</promise>.")
  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then exit 0; fi
done
```

Its key properties: the same prompt runs every iteration, "the agent chooses the task, not you", one feature per iteration, a commit per feature, and a `progress.txt` memory file deleted after the sprint. The task source can be swapped (`prd.json` with `passes` flags, GitHub Issues, Linear, Beads). "The loop is the same. Only the prompt changes."

**Sandcastle** ([repo](https://github.com/mattpocock/sandcastle), about 8.6k stars, `@ai-hero/sandcastle`) turns that loop into a TypeScript library. `run()` / `createSandbox()` runs an agent (Claude Code, Codex, Pi, Cursor, OpenCode, Copilot) in a Docker, Podman or Vercel-microVM sandbox, on a **branch strategy** (`head`, `merge-to-head`, or a named `branch` in a git worktree). Commits come back to the host. Prompts pull live context with `` !`gh issue list ...` `` expansions, run inside the sandbox, and fail fast on a non-zero exit ([README](https://github.com/mattpocock/sandcastle/blob/main/README.md)).

### 4.2 How a run is shaped (the five `sandcastle init` templates)
| Template | Shape |
|---|---|
| `simple-loop` | Ralph: one issue per iteration, `maxIterations: 3`, `merge-to-head` |
| `sequential-reviewer` | per issue: implementer (1 iteration) then reviewer on the same branch and sandbox; up to 10 cycles |
| `parallel-planner` | planner (Opus) emits a `<plan>` JSON of *unblocked* issues → parallel implementers, one sandbox and branch each → merger agent |
| `parallel-planner-with-review` | same, plus a per-branch reviewer before merge |
| `blank` | bring your own |

Sources: `src/templates/*/main.mts` and `*-prompt.md` in [sandcastle](https://github.com/mattpocock/sandcastle/tree/main/src/templates). The planner treats issues as blocked if they "modify overlapping files or modules, making concurrent work likely to produce merge conflicts". It assigns deterministic branch names, `sandcastle/issue-{id}`, so re-planning resumes accumulated progress. His own repo dogfoods `parallel-planner-with-review` with Opus for every role and `MAX_PARALLEL = 4` ([`.sandcastle/run.ts`](https://github.com/mattpocock/sandcastle/blob/main/.sandcastle/run.ts)). In the talk he describes Sonnet implementing and Opus reviewing ([AI Engineer](https://ai.engineer/talks/ai-coding-workflow)).

The RALPH implement prompt sets a priority order: bugs, then tracer bullets, then polish, then refactors. In the talk the order is "critical bug fixes, development infrastructure, then tracer bullets, then polish". The AI Hero article also says to prioritise risky, architectural work early and to do that part HITL. The prompt's workflow is Explore, Plan, Execute with RGR, Verify (`npm run typecheck` and `npm run test`), Commit with the `RALPH:` prefix plus decisions, files and blockers, then Close. If blocked, "leave a comment on the issue and move on — do not close it" (`src/templates/simple-loop/prompt.md`).

### 4.3 Sandboxing
- Docker sandbox, current directory mounted, "nothing else". Global `AGENTS.md` and user skills are *not* loaded inside it. "Sandboxes are optional for HITL but essential for overnight AFK runs" ([AI Hero](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)).
- Sandcastle's mounts can be read-only, and it has env injection, network attachment and resource limits. `merge-to-head` is "safe default for automation... if something goes wrong, HEAD is untouched" ([README](https://github.com/mattpocock/sandcastle/blob/main/README.md)).
- His threat model is in the [Sandbox entry](https://github.com/mattpocock/dictionary-of-ai-coding/blob/main/dictionary/Sandbox.md). Permissions and sandboxes solve the same problem from opposite ends: "Permissions need you running in the loop". Isolation comes in grades (restricted shell, container, VM). "What no sandbox contains: actions that leave it legitimately. An agent with your git credentials can push... Decide what crosses the boundary before deciding how thick to make it."

### 4.4 Stopping conditions
1. **Hard iteration cap**, always: "Infinite loops are dangerous with stochastic systems". He uses 5 to 10 for small tasks and 30 to 50 for larger ones ([AI Hero](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)). Sandcastle's `maxIterations` defaults to 1.
2. **Completion signal**: the agent prints `<promise>COMPLETE</promise>`, or a custom `completionSignal`. This is a prompt convention, "the engine never injects it".
3. **Empty work**: an empty filtered issue list, a planner `<plan>` with no issues, or an implement phase with zero commits ends the outer loop (`sequential-reviewer/main.mts`).
4. **Timeouts**: `idleTimeoutSeconds` fails a genuinely stuck agent. After the signal, `completionTimeoutSeconds` (60 s) resolves a hanging child process *successfully*, so commits aren't lost (sandcastle ADR 0019).
5. **Blocked**: the agent comments on the issue and moves on instead of closing it.

### 4.5 Human checkpoints
- **Before (day shift):** "all of those steps are human-reviewed". That covers the grilling, the spec seams, and approval of the ticket breakdown ([AI Engineer](https://ai.engineer/talks/ai-coding-workflow)). Only `ready-for-agent` / "AFK" issues enter the loop ("You're gonna work on the AFK issues only").
- **HITL first:** run `ralph-once.sh` and watch it before going AFK, then tune the prompt by running it "again and again" ([AI Hero](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum); [AI Engineer](https://ai.engineer/talks/ai-coding-workflow)).
- **During:** none by design. The [AFK entry](https://github.com/mattpocock/dictionary-of-ai-coding/blob/main/dictionary/AFK.md) puts it this way: "give it before and after instead". Automated checks and automated review "stand in for the attention you're not giving".
- **After:** "the run ends in something reviewable — a PR, not changes already merged. AFK doesn't remove human review; it defers all of it to the end." His dogfood prompts tell the agent "Do not push", "Do not close the issue", "Do not edit labels", "Do not mark review threads resolved" ([`.sandcastle/agent-workflows/`](https://github.com/mattpocock/sandcastle/tree/main/.sandcastle/agent-workflows)). He reviews the tests first, then the code, then QAs the feature. Merge happens after team review.
- **Scaling path:** a [software factory](https://github.com/mattpocock/dictionary-of-ai-coding/blob/main/dictionary/Software%20factory.md) removes the human from *starting* sessions (an issue labelled `ready-for-agent`, cron, a CI failure, another session finishing), "and not necessarily out of anything else". He recommends starting with "one cron job that runs one kind of session and opens one reviewable PR". A [dark factory](https://github.com/mattpocock/dictionary-of-ai-coding/blob/main/dictionary/Dark%20factory.md), where nobody reads the code, is described through its failure: "You must debug code that nobody on the team has read."

---

## 5. How he differs from poteto (pstack)

Local pstack source: `~/.claude/plugins/cache/cursor-plugins/pstack/0.15.28/skills/`. The poteto livestream analysis is in `verification-loop-research.md`.

| Axis | Pocock | poteto / pstack |
|---|---|---|
| Where the human sits | Front-loaded alignment (grill, approve seams and tickets), then **human QA + diff review before merge**, always | "**Never Block on the Human**. Proceed, present the result, let the human course-correct" (`poteto-mode/SKILL.md`). Questions are reserved for preference calls "no experiment can settle" |
| Who authorises merge | The human, after team review. AFK output stops at branch/PR | Under a full-autonomy grant, `autopilot-full` owners merge once an independent swarm "which never wrote the code, has proven the code that lands"; "Green CI alone never authorizes a merge" (`poteto-mode/playbooks/autopilot-full.md`) |
| Main verification mechanism | Deterministic checks + TDD at agreed seams + fresh-context two-axis review + **human QA** | A dedicated verification skill per repo (`create-verification-skill`) and a **swarm** of verifiers that re-run gates and "prove the load-bearing behavior live on the real surface" |
| Ambiguity handling | Resolve it *before* the run (grilling). The AFK failure mode is "coherent about the wrong thing" | Resolve empirical forks by prototyping instead of asking. Decide preference calls under the grant and report them |
| Hard stops | Iteration cap, completion signal, empty frontier. The human gate is structural (the agent can't push or merge) | "Always pause for irreversible writes: force-push to shared branches, deploys, data deletion, customer messages" plus operator-named gates |
| Unit of work | Tracker ticket (vertical slice, blocking edges) | PR / stacked PR, with Babysit / Shipping playbooks to merge |
| Tooling style | Small composable skills plus a separate orchestration library (Sandcastle) | One large mode skill routing to playbooks, with model-per-role config |

In short, both make verification the foundation of autonomy. Pocock uses verification to shrink what the human has to review. poteto uses it to remove the human from the merge decision, inside an explicit grant. They converge on fresh-context review by a non-author, behaviour-level tests, and turning lessons into structure (Pocock's `/retro` mechanical-to-check rule, poteto's "Encode Lessons in Structure").

---

## 6. What this means for our own version

- His pipeline already exists in this repo, because these skills are installed. What his stack **lacks** is the thing poteto and this repo's `.claude/skills/verify` add: a fresh agent that **runs the app** against claims fixed before the run. His own demo failure (green tests, missing table) shows why it matters. Slot `verify` in where he puts "human QA", ahead of it rather than replacing it.
- Adopt his **structural** human gate for AFK runs: implementers can't push, close or label, and the run ends in a PR. It is cheap, and it is what keeps a software factory from becoming a dark factory. `ship-gate` (deterministic gate, read-only review, PR for a human to merge) already matches this shape.
- Borrow Sandcastle's stopping semantics wholesale: cap, completion signal, empty-frontier exit, idle timeout versus post-signal grace. Borrow its deterministic branch names so re-planning resumes work.
- Make `ready-for-agent` vs `ready-for-human` the AFK eligibility switch, and require an agent brief with testable acceptance criteria (`triage/AGENT-BRIEF.md`). Those criteria are the natural input to `verify`'s fixed claims.

---

## Gaps and unverified claims

- **No first-hand transcript.** The AI Engineer quotes and timestamps come from the ai.engineer page text, read through a summarising fetch. The Pragmatic Engineer content is the episode summary page, not the audio. Treat both as close paraphrase.
- **TDD position is inconsistent** between his skills (TDD mandatory in `/implement`, `/implement-spec` and the Sandcastle prompts) and his Sep 2026 interview remark about moving away from requiring it. I found no source that reconciles the two.
- Numbers in the Ralph article (iteration caps, the £90/month plan) are his self-reported practice. The article's date and his current plan were not checked.
- I did not check whether he runs Sandcastle triggered from CI or cron (a factory) himself, or only by hand. The dictionary describes factories in general but not his own setup.
- I did not read the `sextant`, `slopwatch` or `ralph-workshop-repo-*` repos in depth. `slopwatch` has an essentially empty README, so its purpose is unknown.
- The provenance of `caido-mode`, `tech-radar` and `worktree-setup` is inferred from the absence of lock entries, not confirmed.
- The 36Kr report about a paid Ralph course (seats, price) is single-source and not used above.

## Sources

Local: `~/.agents/.skill-lock.json`; `~/.agents/skills/{ask-matt (+PHASE-BOUNDARIES.md), setup-matt-pocock-skills, grilling, grill-me, grill-with-docs, to-spec, to-tickets, implement, implement-spec, tdd (+tests.md, mocking.md), code-review, pr, retro, triage (+AGENT-BRIEF.md), diagnosing-bugs, wayfinder}/SKILL.md`; `~/.claude/skills/no-mistakes/SKILL.md`; `~/.claude/plugins/cache/cursor-plugins/pstack/0.15.28/skills/poteto-mode/{SKILL.md, playbooks/autopilot-full.md}`.

Web: [mattpocock/skills README](https://github.com/mattpocock/skills/blob/main/README.md) · [mattpocock/sandcastle README](https://github.com/mattpocock/sandcastle/blob/main/README.md) · [sandcastle templates](https://github.com/mattpocock/sandcastle/tree/main/src/templates) · [sandcastle `.sandcastle/run.ts`](https://github.com/mattpocock/sandcastle/blob/main/.sandcastle/run.ts) · [sandcastle agent-workflows](https://github.com/mattpocock/sandcastle/tree/main/.sandcastle/agent-workflows) · [dictionary-of-ai-coding](https://github.com/mattpocock/dictionary-of-ai-coding/tree/main/dictionary) (AFK, Human-in-the-loop, Sandbox, Automated check, Automated review, Human review, Software factory, Dark factory, Smart zone) · [AI Hero: 11 tips for AI coding with Ralph Wiggum](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum) · [AI Engineer Europe 2026: Full Walkthrough: Workflow for AI Coding](https://ai.engineer/talks/ai-coding-workflow) · [Pragmatic Engineer: AI Skills with Matt Pocock](https://newsletter.pragmaticengineer.com/p/ai-skills-with-matt-pocock) · [VentureBeat on Ralph's origin](https://venturebeat.com/ai/how-ralph-wiggum-went-from-the-simpsons-to-the-biggest-name-in-ai-right-now).
