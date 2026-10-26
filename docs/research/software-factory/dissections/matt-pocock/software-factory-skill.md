# software-factory: Matt Pocock's glossary skill for designing a factory

**Source workflow:** Pocock  **Stages:** Intake, Dispatch/Isolate, Review, Merge, Operate/Monitor, Human gates, Liveness
**Primary sources:**
- [mattpocock/skills#1316](https://github.com/mattpocock/skills/pull/1316), "software-factory: glossary skill for designing a factory" (draft, unmerged, opened 2026-10-21, head `b59cab4`). Read with `gh pr view 1316 -R mattpocock/skills`, `gh pr diff 1316 -R mattpocock/skills`, and the PR's review comments through `gh api`.
- Files in the PR, all under `skills/in-progress/software-factory/`: `SKILL.md`, `EXAMPLE-TASKS.md`, `TICKET-TRACKERS.md`, `GIT-HOSTS.md`, `RUNNERS.md`, `OBSERVABILITY-PLATFORMS.md`.
- Comparison context: [../../workflows/matt-pocock/overview.md](../../workflows/matt-pocock/overview.md), [../../concepts/claude-code-as-harness.md](../../concepts/claude-code-as-harness.md), [../../decisions-to-grill.md](../../decisions-to-grill.md) (Settled R1–R15), [../../GLOSSARY.md](../../GLOSSARY.md), the root `CONTEXT.md`, and the poteto dissections in [../poteto/](../poteto/).

I read the PR only. I ran nothing. The PR is a draft, so any wording below may change before it merges.

---

## 1. What it is

A **reference skill with no steps**: a shared vocabulary for designing a software factory, meant to be called alongside a `/grilling` session. It is `disable-model-invocation: true`, so it loads only when the user types its name. The PR body says it is the language for "Software Factory Part Two", Matt's course module, which gives "students a generic language for designing their own factory, deployed on their own infrastructure". It came out of a grilling session on 2026-10-21.

Its opening definition: a software factory is "a system of agents that turns tickets, PRs and schedules into merged code, deployed on remote infrastructure the user chooses" (`SKILL.md`). The problem it removes is a design conversation with no fixed words. Without one, "job", "workflow", "action", "session", "sandbox" and "server" get mixed up, and nobody can tell whether a design is finished. The skill fixes ten terms, gives advice on how to design ("Start slow", "Fill every slot", "Question every task") and defines when a design is done.

## 2. Where it lives

| File | Role |
|---|---|
| `SKILL.md` (~98 lines) | The glossary (4 terms under "Tasks and runs", 5 under "Services"), then "Designing a factory": Start slow, Fill every slot (a three-design table), Question every task (5 questions plus 1 per ticket source), and the definition of a finished design. |
| `EXAMPLE-TASKS.md` (~80) | Problem → task, each with Trigger / Does / Triggers. Read only "when the user names a problem or doesn't know what to build". |
| `TICKET-TRACKERS.md` (~85) | Survey of 6 tracker types, questions that decide the slot, durable gotchas. |
| `GIT-HOSTS.md` (~84) | Survey of 6 git host types, questions, gotchas. |
| `RUNNERS.md` (~94) | Survey of 5 runner types with a "who owns the loop / the machine" table, questions, what goes stale. |
| `OBSERVABILITY-PLATFORMS.md` (~75) | 5 hooks by which runners export data, 4 platform types (including "none"), questions. |

Each survey opens with "Surveyed 2026-10, and not guaranteed to be up to date" and ends with "Researching further", so the agent checks current options itself instead of trusting the list.

## 3. How it works, step by step

### 3.1 The vocabulary

**Tasks and runs** (`SKILL.md`):

| Term | Definition (close paraphrase) | _Avoid_ |
|---|---|---|
| Task | "A kind of work the factory performs, defined once and run many times: review, explore, implement, ratchet." It works on a ticket, a PR or the whole codebase. | job, workflow, action |
| Trigger | "The event that starts a run": a ticket tracker or git host change, a clock in the orchestrator, or another run. | (none) |
| Run | "One execution of a task on one runner, from its trigger to its finish, treated as a black box." It triggers further runs directly, through orchestrator logic, or by changing the tracker or git host. "A run never waits for a human: it ends, and the human's later change ... triggers a new run." | session |
| Runner | "The disposable machine a run executes on. Nothing on it survives the run": a run's only memory is the ticket tracker, the git host and the orchestrator. | server, host, box, compute, sandbox |

**Services**, each a **slot** that a product fills:

| Slot | Definition | _Avoid_ |
|---|---|---|
| Ticket tracker | Where tickets live, and "the factory's human interface": humans file tickets, talk to agents in comments, and their changes trigger runs. | issue tracker, ticket manager, project board |
| Ticket source | Anything outside the factory that creates tickets: a feedback button, a monitor, an error tracker, an inbox. | data source, trigger source, intake |
| Git host | Where branches, PRs and reviews live. | code host, forge, repo |
| Orchestrator | "Receives triggers, starts runs on runners, and records which runs are queued, in flight or finished." | dispatcher, scheduler, control plane |
| Observability platform | Where runners send logs, traces and status for a human. Optional. "A run never decides on it until something writes it into the ticket tracker or git host." | observability, logs, monitoring, dashboard |

Two framing rules: **terms name roles, not machines** ("one product or server can fill several services"), and a Run is a black box "with any number of agent sessions inside" (PR body). Left out on purpose: state, workflow, action, job, sandbox, credential, run output, and a claim/dedupe term, which became question 5 instead. **Brake** and **accelerator** are advice words, not glossary terms.

### 3.2 Start slow: accelerators and brakes

"Every trigger is an accelerator. Accelerators without brakes make a slop cannon." There are three brakes:

1. **Automated checks:** deterministic gates (types, lint, tests) that every run must pass.
2. **Automated review:** "a separate run that reads the diff cold against the codebase's standards and the ticket".
3. **Human review:** a human reads the PR before it merges, and "what it catches becomes new automated checks and sharper automated review".

The rollout rule: "Add one automated trigger at a time, throttled at first (one bug report in ten, a clock once a day), with human review on every PR. Open the throttle as the brakes earn trust, and cap every loop of runs at a few tries before a human."

### 3.3 Fill every slot

A design has two halves: the services (slots filled with products) and the tasks. "Buy the services and build the tasks: the tasks carry the user's design, the services are generic." He favours an off-the-shelf ticket tracker. Three reference designs:

| Slot | All on GitHub | Linear tickets | Own tracker |
|---|---|---|---|
| Ticket tracker | GitHub Issues | Linear | own app |
| Ticket source | feedback button | feedback button, monitor | feedback button, monitor |
| Git host | GitHub | GitHub | GitHub |
| Orchestrator | GitHub Actions | own server + database | own app |
| Runner | Actions runner | Actions, E2B, Daytona or a VPS | own app, or sandboxes |
| Observability platform | none: Actions run pages suffice | an LLM tracing platform | own app |

### 3.4 Question every task: the five questions

For each task:

1. What triggers it?
2. What does it do, and which services does it read and write?
3. What does it trigger next?
4. Where does a human re-enter?
5. What stops two runs doing the same work?

For each ticket source: "what stops it filing the same ticket twice?" **Done condition for a design:** every slot names a product (or a deliberate none for observability), and every task and ticket source has an answer to every question. In the grilling, question 5 came from the one recurring design decision (duplicate work) that the glossary could not express.

### 3.5 Example tasks (`EXAMPLE-TASKS.md`)

| Problem | Task | Trigger | Does | Triggers next |
|---|---|---|---|---|
| Untriaged tickets pile up | Explore | ticket created, or human label | checks the ticket against the code, sorts it (easy call / needs a human / not a bug) | implementer on easy calls; otherwise labels it waiting for a human |
| Ready tickets wait | Implementer | ticket labelled ready (human or explore run) | builds until automated checks pass, opens a **draft** PR | automated review |
| PRs wait for review | Automated review | PR opens with no review yet, or a label | reviews the diff against standards and the ticket | rework on fail; on pass it ends and the PR waits for human review, then **a human merges** |
| Failed reviews sit unfixed | Rework | automated review fails | fixes only what the review named, pushes | automated review; after N fails, label for a human |
| Specs too big for one run | Decompose | spec ticket labelled | splits into tickets with dependencies | implementer, which picks the next unblocked ticket and re-triggers itself until none is left |
| Migrating to a stricter check | Ratchet | daily clock | takes one file off the exception list, fixes it, opens a PR | automated review; done when the list is empty |
| User bugs nobody reads | (ticket source) | feedback button | files a ticket already labelled explore | explore |
| Production problems found late | (ticket source) | a monitor | one ticket per problem, comments instead of duplicating, reopens if it persists after a fix | explore |
| The factory's own runs fail | Fix | orchestrator reports a failed run | files the log as a ticket, attempts a fix PR | automated review; fixes never chain, and a fix "always gets human review" |
| The codebase drifts | Architecture | nightly clock | files refactoring candidates as one ticket | nothing; a human labels a candidate |
| Same mistakes keep coming back | Retro | a merge, throttled to 1 in 10 | reads PR, ticket, reviews and logs, proposes instruction changes as a PR | automated review |

### 3.6 The slot surveys

**Ticket trackers (6 types):** git-host built-in (GitHub Issues, GitLab, Forgejo); agent-native dev trackers (Linear, Jira, Shortcut, YouTrack); open-source self-hosted (Plane, Huly, OpenProject); general work tools (Notion, Asana, ClickUp, Trello); repo-native files (Beads, Backlog.md); build-your-own. Deciding questions: triggers, routing, comment thread, bot identity, native agents, outside filing, hosting. Notes for GitHub: "Labels are the dependable router, because statuses live on a separate board", and Copilot's native agent reads the issue only at assignment.

**Git hosts (6 types):** all-in-one (GitHub, GitLab); suite (Bitbucket, Azure DevOps, CodeCommit); self-hosted (Forgejo, Gitea, GitLab self-managed, GHES); review-first or decentralised (Gerrit, Tangled); agent-native (Cursor Origin, GitLab next-gen SCM); git storage for runs (Cloudflare Artifacts, Pierre code.storage). Deciding questions: triggers, identity, gates, rate limits, slots filled. The most important durable gotcha for us: **events caused by `GITHUB_TOKEN` start no new workflow runs**, so a chain of Actions runs silently stops. "Give runs a GitHub App identity from day one." As of 2026-10, rulesets on private repos need a paid plan, and an App installation gets 5,000 requests/hour against 1,000 for `GITHUB_TOKEN`.

**Runners (5 types):**

| Type | Agent loop | Machine | Also fills | Claude Code / GitHub products named |
|---|---|---|---|---|
| CI runner | yours, in the job | CI vendor's or yours | orchestrator, observability | GitHub Actions, Claude Code GitHub Action, ARC |
| MicroVM API | yours | provider's | nothing | (E2B, Daytona, Modal, Vercel Sandbox) |
| Bundled agent platform | vendor's | vendor's | part of orchestrator, observability | Claude Code cloud with scheduled tasks (routines: cron, API, GitHub events); Claude Managed Agents; Copilot coding agent |
| Bring-your-own worker | vendor's | yours | part of orchestrator, observability | Claude Code self-hosted environments (beta as of 2026-10) |
| Own VPS or containers | yours | yours | nothing | (Fly, Hetzner + Docker, Kubernetes Jobs) |

"Runner choice is per run: a cheap CI runner for review runs and a microVM for implementer runs is a normal design." Deciding questions: how the orchestrator starts one, max run length and concurrency, cost shape, how disposability is achieved, what a run can reach, which other slots it fills.

**Observability platforms (4 types):** none (the runner's run page or transcript is enough, and "most factories start here"); LLM and agent tracing (Langfuse, Phoenix, LangSmith, Braintrust); general APM (Datadog, Grafana, Honeycomb, SigNoz); LLM gateway (LiteLLM, Portkey; sees model calls only). Five hooks feed them. For Claude Code the relevant ones are **harness OTel** (`CLAUDE_CODE_ENABLE_TELEMETRY=1` plus `OTEL_*`, with prompts and tool output opt-in), **platform push** (Managed Agents), and **hook plugin** (a Stop hook that ships the transcript, as in Langfuse's plugin).

### 3.7 His stated decisions (PR body)

- **Remote only, and runs are stateless:** "a run's only memory is the ticket tracker, the git host and the orchestrator."
- **A task is a kind of work; a run is one execution of it**, a black box with any number of agent sessions inside. **It never waits for a human.**
- **Terms name roles, not machines.**
- Brakes are advice, not terms; loop stop conditions are phrased as "a cap on tries".
- Aligning the course's Part Two scripts (which still say trigger / state / workflow / action) is parked.

## 4. Why it works

| Rule | Failure it prevents |
|---|---|
| **Every trigger is an accelerator; add one at a time, throttled** | The "slop cannon": many automated triggers firing before any brake is trusted, burying the human in PRs. This is the same lesson as Tan's "trust before parallelism" and the noodle switch to `supervised` (workflow-map §5 item 10), stated as a rollout rule. **Heavy lifter.** |
| **Human review feeds new automated checks** | Brakes that never improve. It is the `/retro` "mechanical lesson gets a deterministic check" rule (overview §2.10) placed inside the factory loop. |
| **Runs are stateless; memory lives only in tracker, git host and orchestrator** | Hidden state on a machine that the next run can't see, can't reproduce and can't audit. It also makes a crash cheap: rerun the trigger. **Heavy lifter.** |
| **A run never waits for a human** | Idle runners holding a lease, and runs that block forever on a question. The human's answer becomes a new trigger instead. pstack reaches the same rule from the other side ("Never Block on the Human"). |
| **Question 5 (what stops two runs doing the same work)** | Duplicate PRs from two triggers on the same ticket. It is the only question the grilling found missing from the glossary. |
| **Cap every loop at a few tries before a human** | The rework ⇄ review loop spinning forever. Rework "after a set number of fails" labels for a human. |
| **Fixes never chain; factory changes always get human review** | A factory that rewrites its own instructions or brakes unsupervised. This matches pstack `/reflect`'s "Do not auto-apply". |
| **Design is done when every question has an answer** | A design that looks complete but has a task with no stop, no dedupe or no human re-entry. It is a checklist with a pass/fail done condition, which is rare in design advice. |
| **Buy services, build tasks** | Spending effort on generic plumbing (a tracker, an orchestrator) instead of on the tasks, which carry the design. |
| **Name the roles, not the products** | Designs that can't be compared because one product fills four slots. The three-design table works because of this. |

## 5. Edge cases and failure handling

- **A run fails.** The orchestrator reports it, and a Fix task files the log as a ticket and attempts a fix. A failure inside a fix run triggers nothing, so failures can't cascade.
- **Automated review keeps failing.** Rework is capped "after a set number of fails", then the PR is labelled for a human.
- **Chains stop silently on GitHub.** Pushing or labelling with `GITHUB_TOKEN` starts no new workflow, so the next run never fires. The fix is a GitHub App identity. This is the most likely first bug in an all-GitHub factory.
- **Duplicate tickets from a ticket source.** The monitor comments on the open ticket instead of filing a new one, and reopens it if the problem persists after a fix.
- **Assignment-time context.** Some native agents (Copilot, as of 2026-10) read the ticket only when assigned, so later context goes on the PR.
- **Persistence features on runners.** Pause/resume and snapshots may be used only as a cache. Every cache path must be optional for the next run.
- **Agent lies about done.** The skill does not cover this. The brakes are checks, a cold review and a human. There is no brake that runs the application.
- **Packaging bug in the PR itself.** The reviewer notes that the extra `:` in the `description` frontmatter ("...a software factory: the tasks...") makes `npx skills install` fail. It is unfixed at `b59cab4`.

## 6. Conflicts with other workflows

### 6.1 With pstack (Tan)

| Axis | Pocock `software-factory` | pstack |
|---|---|---|
| Vocabulary | Roles and slots (Task, Run, Runner, Orchestrator...) | No service vocabulary. A mode skill routes to playbooks, and the Cursor `orchestrate` plugin has its own terms (planner, worker, handoff, `state.json`) |
| Run shape | Short, stateless, black box, ends instead of waiting | Long overnight Autonomous runs inside one session with a decision log, an hourly `/loop` audit and Babysit polling CI. State lives in the session and in files next to it |
| Brakes | Checks, automated review, human review | The same three plus **Verification**: a non-author swarm that runs the real app, whose Verdict can authorise merge under a full-autonomy grant |
| Merge | Always a human in his example tasks | Verifiers merge reversible work under a grant; the human audits main next morning |
| Rollout | One trigger at a time, throttled | "Trust before parallelism": 1–5 supervised agents until they can check their own work |
| Triggers | Tracker, git host, clock, another run | Cursor Automations and benny (Slack, Sentry, Linear). Cursor-only, with no Claude Code equivalent in pstack's own adapter |
| Self-modification | Fix and Retro tasks open PRs that always get human review | `/reflect` and `/correct` propose edits, and "Do not auto-apply" |
| Orchestrator memory | Tracker, git host, orchestrator | Orchestrate's `plan.json` / `state.json` / `handoffs/`: a stateful orchestrator over disposable cloud VMs, which fits his model well |

**Where they agree:** a non-author reviews, nothing blocks on a human, loops are capped, lessons become structure, and trust is earned before scaling. **Where pstack wins:** once a human stops reading every PR, his three brakes are not enough, because none of them runs the application. **Where his wins:** clarity about what a run may remember and a finish line for the design itself. pstack has no equivalent of the five questions.

### 6.2 With our settled decisions (R1–R15)

| Decision | Fit | Notes |
|---|---|---|
| **R10** interactive Claude Code, no external orchestrator | **Conflict** | His factory is "remote only" with disposable runners and stateless runs. An interactive local session is none of these: the laptop worktree persists, and the session's context window and plan files are memory outside the tracker, git host and orchestrator. **Reading:** the R10 pilot is not a factory in his sense. It is the day shift, where the brakes get built and trusted. His vocabulary applies when R10's "unattended layer later" arrives. |
| R10 "no external orchestrator" | Partial fit | He needs an orchestrator slot, but "buy the services" means it can be GitHub Actions or `/schedule` routines, products rather than something we build. A thin `claude -p` loop is a minimal, self-built local orchestrator, and it needs a local runner that isn't disposable unless each run gets a fresh worktree. |
| **Stateless runs** vs pstack overnight runs | **Conflict** | Exercises 2 and 4 (R13) run `/pstack:poteto-mode`, whose overnight shape is a long stateful session. In his terms that is one long Run with lots of hidden state, not many stateless Runs. Log it in the pilot as a pstack vs Pocock conflict (R9). |
| **R3** Tan-style for low-risk tiers | Tension | He keeps "human review on every PR" while throttled and says to open the throttle "as the brakes earn trust", but every example task ends with a human merge. He doesn't say whether merge ever leaves the human. R3 needs a fourth brake (Verification) before any tier skips human merge. |
| R4 moderate Max 5x | Fit | "One trigger at a time, throttled" matches R4. `/schedule` has a 1-hour minimum interval and 100 runs/hour/account, so throttling is built in. |
| R5 Claude Code only | Fit | All-GitHub plus Claude Code products fill every slot (§7.1). |
| R6 terms | Mostly fit | His "automated checks" = Check, "automated review" and "human review" = Review. He has no Verification, Verdict or Claim. See the glossary conflicts in §7.3. |
| R7 / R13 curriculum, supervised first | Fit | "Start slow" is the curriculum's rule restated. The five questions are a good post-retro design exercise (curriculum, Dispatch/Isolate). |
| R8 personal plugin, per-repo recipes | Fit | "Buy services, build tasks": the plugin carries the tasks (skills, agents, hooks), and the services are GitHub plus Claude Code. |
| R11 / R14 privacy | Fit | Nothing in a factory design needs to name the pilot repos in public files. |

### 6.3 With ADW

ADW's `trigger_cron.py` and `factory.py` act as a self-built orchestrator over a local runner, with an LLM router and no Ready checks (workflow-map Intake row). In his terms ADW fills the orchestrator and runner slots with "own app" and fails question 5 in factory mode. The travis pipeline's `in-progress` label (root `CONTEXT.md`, **In progress**: "A fresh run refuses an In progress Ticket") is a ready answer to question 5.

## 7. Porting to Claude Code and ADW

### 7.1 His slots on Claude Code + GitHub

| Slot | Pilot (R10, interactive) | Unattended layer (post-retro) |
|---|---|---|
| Ticket tracker | GitHub Issues with the triage labels (`needs-triage`, `ready-for-agent`, `ready-for-human`, `in-progress`) | Same. Labels are the router, as his survey recommends |
| Ticket source | You | A `/schedule` routine or an Action that files issues from CI failures or an error tracker, dedupe first |
| Git host | GitHub | GitHub, with a **GitHub App identity** for runs (the `GITHUB_TOKEN` trap) |
| Orchestrator | **None.** You plus the coordinator session start every run. That's acceptable because the pilot is not a factory yet | One of: **GitHub Actions** workflow files (`anthropics/claude-code-action@v1` on issue, PR, label or cron events; run history records queued/in flight/finished); **`/schedule` routines** (cloud; schedule ≥1 h, API `/fire`, GitHub PR/release events; the routine list is the record); or a **thin `claude -p` driver** (local; you build the record yourself, e.g. labels plus a log file) |
| Runner | Your laptop worktree (`claude -w`, `isolation: worktree`). **Not disposable**, so it breaks his Runner definition | **Claude Code cloud sessions** and `/schedule` routines (bundled agent platform: fresh clone, pushes to `claude/` branches); **Actions runners** (CI runner type); Claude Code self-hosted environments if a run must reach a private network |
| Observability platform | None: the session transcript, plus pstack `show-me-your-work` decision logs | None at first (Actions run pages, cloud session transcripts). Later, harness OTel or a Stop-hook transcript shipper if you need per-run cost or search across runs |

**The orchestrator slot is the open one.** R10 rules out building one. Actions is the closest fit to his "All on GitHub" design: one product fills orchestrator, runner and observability, and every label is a trigger. `/schedule` is simpler to set up but has fewer triggers (no issue-label event in the documented list) and a 1-hour minimum on clocks. The `claude -p` driver keeps runs local, which conflicts with "remote only". Decide this in the retro (Q12).

### 7.2 The example tasks as Claude Code pieces

| His task | Claude Code / our skills | Size |
|---|---|---|
| Explore | `/triage` in a `/schedule` routine or an Action on `issues: opened`, labelling only | S |
| Implementer | `/implement` on a `ready-for-agent` issue in a cloud session or Action. First write adds `in-progress` (answers Q5), ends in a draft PR | M |
| Automated review | `/code-review` (two axes) as an Action on `pull_request`, or built-in `/code-review --comment` | S |
| Rework | `/autofix-pr` (reacts to CI failures and review comments) or an Action on a failed review, capped by a label counter | M |
| Decompose | `/to-tickets` on a labelled spec issue | S |
| Ratchet | Daily `/schedule` routine: one file off the exception list, one PR | S |
| Fix | An Action on `workflow_run: failure` that files an issue. Always human-reviewed | S |
| Retro | `/retro` or `/pstack:reflect` on 1 merge in 10, proposing changes as a PR | M |
| (missing) **Verify** | Our `verify` skill with the read-only verifier agent, between automated review and human review. His factory has no task for it | M |

### 7.3 Glossary adoption

`GLOSSARY.md` now has a **Factory structure** section with Task, Trigger, Run, Runner, Ticket tracker, Ticket source, Git host, Orchestrator and Observability platform, plus a note mapping his brakes onto Check, Review and Verification. Conflicts left in place:

- **Implementer:** his "Implementer task" vs our Author's _Avoid_ "implementer". Keep Author for the agent role; "implementer" may name only the Task.
- **Task:** root `CONTEXT.md` lists "task" under Ticket's _Avoid_. His Task is a kind of work, not a unit of planned work, so the two don't collide in meaning, but the word does.
- **Session:** his Run _Avoids_ "session", while our docs and Claude Code say "session" everywhere. Read a Claude Code session as something inside a Run, never as the Run itself.

## 8. Stack adaptation

- **Java Spring Boot:** runs need a database and maybe a broker. Actions service containers or a cloud environment setup script provide them. Boot time makes runs long, which favours Actions over `/schedule` for review runs. Ratchet fits well: Checkstyle, Error Prone or SpotBugs suppressions as the exception list, one class per day.
- **Rust:** compile time dominates run cost. Use his rule that caches sit on paths "the next run treats as optional" (`Swatinem/rust-cache` on Actions). The ratchet's exception list is per-module `#![allow(clippy::...)]` attributes.
- **Node/TS:** the cheapest runs. Ratchet is the textbook case: `strict` or a new ESLint rule with a per-file override list. Gate Actions on `pnpm`/`npm` checks before the Claude step so automated checks run first.

## 9. Decisions for you

- **Which product fills the orchestrator slot first: Actions, `/schedule` or a `claude -p` driver?** This refines Q12 and the unattended half of R10. Proposed new decision.
- **Is the interactive pilot a factory?** Proposed reading: no. It is the day shift that builds the brakes. That keeps R10 and "remote only" from contradicting each other. Confirm in the retro.
- **Is Verification a required fourth brake before any trigger is unthrottled?** Ties to Q4–Q5 and R3.
- **Bot identity:** a GitHub App for runs from day one (his gotcha, and risk-tiered-merge §9 "separate bot identity for approvals").
- **Answer to question 5:** the `in-progress` label as the claim, plus a concurrency group per issue on Actions. Ties to Q13.
- **The first Task and its throttle.** Use the five questions (curriculum, Dispatch/Isolate lesson). Candidates: Explore (labels only) or Ratchet (one PR a day), because both are reversible and cheap to review.

## 10. Unknowns

- **Draft and unmerged.** Terms or decisions may change. The course's Part Two scripts still use trigger / state / workflow / action, and aligning them is parked.
- **Does merge ever leave the human?** Every example task ends in human merge, but "open the throttle as the brakes earn trust" is not explained further. The course material may answer it.
- **Interactive work.** The skill doesn't say where supervised local sessions sit. "Remote only" suggests they are outside the factory. I inferred that, and it isn't stated.
- **`/schedule` triggers.** Whether routines can fire on issue labels (not just PR and release events) decides whether `/schedule` alone can fill the orchestrator slot. Check the routines docs on your build.
- **Some survey facts are single-source.** The PR says some prices and beta statuses (Cursor Origin, some Codex triggers) rest partly on third-party sources. They were not rechecked here.
