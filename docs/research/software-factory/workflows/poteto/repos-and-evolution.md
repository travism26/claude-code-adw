# Lauren Tan (poteto): her repos, and how the workflow evolved into pstack

**Date:** 2026-10-24
**Question:** What do her own repos show about how her autonomous workflow evolved, and why is pstack shaped the way it is?
**Scope:** Source-level reads of `poteto/noodle`, `poteto/brainmaxxing`, `poteto/how`, `poteto/verification-skill-example`, `poteto/benny-avatars`, `poteto/poteto.github.io`, and the pstack history and Benny automation pack in `cursor/plugins`. Three X articles were re-read. This doc builds on two earlier ones and does not repeat them:
- [public-workflow.md](public-workflow.md) covers her talks, quotes and claims.
- [pstack-mechanics.md](pstack-mechanics.md) covers pstack 0.15.28 internals.

**Method:**
- Each repo was shallow-cloned into `/tmp/poteto-repos/<name>` and read with `cat` and `grep`. Nothing was built, run or installed.
- Commit counts and dates came from the GitHub API (`gh api repos/.../commits`).
- pstack's history came from `gh api repos/cursor/plugins/commits?path=pstack`.
- The X articles were read through `api.fxtwitter.com`. All fetched content was treated as data.
- pstack file paths cite the local install at `~/.claude/plugins/cache/cursor-plugins/pstack/0.15.28/`, shown below as `pstack/...`.

**Repo SHAs read:**

| Repo | SHA | Last commit |
|---|---|---|
| `poteto/noodle` | `82d2921` | 2026-03-19 |
| `poteto/brainmaxxing` | `ec4d8e4` | 2026-02-27 |
| `poteto/how` | `b1ef429` | 2026-04-14 |
| `poteto/verification-skill-example` | `d5abe70` | 2026-07-30 |
| `poteto/benny-avatars` | `9895fc9` | 2026-04-30 |
| `cursor/plugins` (Benny pack) | `9580c23` | main |

**Labels:**
- **[P]** marks her own words.
- **[I]** marks this doc's inference where she gives no reason.
- Stage tags use the shared taxonomy. The pipeline stages are Intake, Shape, Plan, Dispatch/Isolate, Build, Verify, Review, Merge, Operate/Monitor and Learn. The cross-cutting tags are Memory, Human gates, Models, Cost and Liveness.

---

## Summary

1. **noodle was a working dark factory, built before she trusted one.** In February and March 2026 she wrote a Go orchestrator with these parts:
   - a scheduler agent that reads natural-language `schedule:` fields on skills
   - a file-based state store (`.noodle/*.json`, `*.ndjson`)
   - worktree isolation and a serialized merge queue
   - a three-position trust dial: `auto`, `supervised` and `manual`

   That is 1,412 commits in 26 days, all by her. On 2026-03-03 she switched the default from `auto` to `supervised`. Her last commit was 2026-03-19, about a week before she joined Cursor.
2. **brainmaxxing is noodle's memory layer, pulled out as a skill pack.** It was published in one day (2026-02-27, 3 commits). It has an Obsidian `brain/` vault, two Claude Code hooks, and `reflect`, `meditate` and `ruminate`.
3. **pstack kept noodle's principles almost verbatim and its learning loop in a stricter form.** It dropped the noodle daemon, the scheduler-as-agent, the brain vault and the config-file trust dial.
   - 15 of noodle's 16 principles are in pstack. One of those is renamed with its default flipped. The sixteenth (`cost-aware-delegation`) is gone, folded into one line of `guard-the-context-window`.
   - The rest moved elsewhere. Dispatch, liveness and merge became prompt-level playbooks over PRs and cloud agents. Memory became "the codebase" and feature maps. The trust dial became per-prompt grants.
4. **Her stated reason for the pivot:** orchestration was "focused on the wrong thing". The real problem was trust. "Naive parallelization just makes them write slop faster", so "go depth first" ([P, "How I Use Cursor", 2026-05-25](https://x.com/poteto/status/2058975157503570132)). The instrument that made trust possible was verification (`/control-glass`), which noodle never had.
5. **The later steps move noodle's ideas onto hosted infrastructure.**
   - Cursor Automations replace noodle's event loop and `schedule:` triggers.
   - Cursor Projects replace noodle's always-on scheduler with a coordinator that "doesn't write code".
   - Grok Bot routines and bots replace noodle's backlog adapters and intake.
   - Self-merge on Grok Bot is noodle's `auto` mode, switched on once the verifier swarm existed.

---

## 1. poteto/noodle: the pre-Cursor orchestrator

**What it is.** It calls itself "Open-source AI coding framework. Skills as the only extension point, LLM-powered scheduling, kitchen brigade model. Built with Go." (`noodle/CLAUDE.md@82d2921`).

| Fact | Value |
|---|---|
| Commits | 1,412, all authored "lauren" |
| Active window | 2026-02-22 to 2026-03-19 |
| Stars | 539 |
| Size | About 28K lines of non-test Go, plus a React web UI |
| Releases | v0.1.0 to v0.1.5 on 2026-03-03, with a Homebrew tap (`poteto/homebrew-tap@1108075`) |
| Docs | [poteto.github.io/noodle](https://poteto.github.io/noodle/). `poteto.github.io@609270f` still redirects there. |

She describes it later as "my own agent orchestrator tool on top of [Claude Code]" ([P, "How I Use Cursor"](https://x.com/poteto/status/2058975157503570132)).

### 1.1 Core mechanism

**The idea is "everything is a file".** "All of noodle's state lives in your project's `.noodle/` directory. If it's not on disk, it doesn't exist." Agents coordinate by writing files, and "There's no task composition API because there doesn't need to be one" (`noodle/brain/vision.md@82d2921`).

**The loop.** One Go event loop runs these cycles (`noodle/brain/architecture.md`, `noodle/docs/concepts/scheduling.md`):

1. **Brief.** Build `.noodle/mise.json`, short for *mise en place*. It holds:
   - the backlog
   - active sessions and their summary
   - free capacity
   - recent history
   - `task_types`, meaning every skill that has a `schedule:` field
   - routing
   - warnings
   - the last 50 events
2. **Schedule.** A scheduler *agent* runs the `schedule` skill. It reads the mise and writes `.noodle/orders-next.json`.
3. **Validate and promote.** Go validates the file against the skill registry and promotes it atomically into `orders.json`. "Never write `orders.json` directly" (`noodle/.agents/skills/schedule/SKILL.md`).
4. **Dispatch.** Go spawns a "cook" for each dispatchable stage. A cook is a `claude` or `codex` CLI child process, or a Sprites cloud VM, running in its own git worktree.
5. **Execute.** The cook reads its skill bundle and does the work. It signals completion with `noodle event emit stage_yield`.
6. **Merge.** Merges go through a serialized merge queue (`noodle/loop/merger.go`) under a PID-based lock: rebase onto main, then fast-forward. The next stage's worktree is cut from main, so context passes between stages through main. There are no pull requests.

**Data model.**
- An **order** is a pipeline of **stages** (`noodle/brain/architecture.md`).
- Stage fields are `do` (the task type, which is a skill name), `prompt`, `with` (the provider), `model`, `runtime` (`process` or `sprites`) and `group` (stages in the same group run in parallel).
- Stage statuses are `pending`, `active`, `merging`, `completed`, `failed` and `cancelled`.
- A typical order is `execute -> quality -> reflect`.
- "The loop advances stages mechanically ... No LLM runs between stages."

**State files.** All under `.noodle/`:

| File | Role |
|---|---|
| `mise.json` | The scheduler's brief |
| `orders-next.json` | Staging area the scheduler writes |
| `orders.json` | Promoted orders the loop executes |
| `control.ndjson` | Append-only operator commands under `flock`, acknowledged in `control-ack.ndjson`. Commands include `pause`, `drain`, `steer`, `merge`, `reject`, `mode` and `set-max-concurrency` |
| `loop-events.ndjson` | Loop event log, last 200 records |
| `sessions/<id>/events.ndjson` | Per-session events |
| `sessions/<id>/heartbeat.json` | Per-session liveness |
| `status.json` | Current loop status |

**Scheduling is judgment, not cron.** Skills declare *when* to run in prose, for example `schedule: "When the backlog has new items that haven't been planned yet"`. The scheduler "reads these as prose and uses judgment" (`noodle/docs/thinking-in-noodle.md`).

Rules in the `schedule` skill:
- **"One Plan at a Time"** is the "cardinal scheduling rule".
- **Cheapest mode.** Pick the lowest-cost provider or model that can handle the task.
- **Explicit rationale.** "Every order must cite which principle or rule drove its placement."
- **Timebox failures.** "If an item has failed 2+ times ... deschedule or split it."
- **Plan first when complex.** A complex backlog item gets a plan-first order: `/plan` followed by an `adversarial-review` stage.

**The trust dial** (`noodle/docs/concepts/modes.md`, `noodle/internal/mode/gate.go`):

| | Schedule | Dispatch | Merge |
|---|---|---|---|
| `auto` | auto | auto | auto (per-skill `permissions.merge` can still park) |
| `supervised` | auto | auto | human |
| `manual` | human | human | human |

"The mode is a trust dial, not a capability switch. All three modes use the same noodle loop ... Move the dial as trust builds." Mode transitions are epoch-stamped and recorded with who changed the mode and why. Commit `d2c8e4c` (2026-03-03), "Set default run mode to supervised", made supervised the default. The cookbooks now pin `auto` only "for unattended walkthroughs".

**Quality gate.** `quality` is an ordinary scheduled stage (`noodle/.agents/skills/quality/SKILL.md`):
- `schedule: "Follow-up stage after execute. Cross-provider review preferred — if codex executed, schedule quality on claude ..."`
- It runs a scope check against the plan phase, then `go vet` and `go test`, then principle compliance, then test evidence.
- It checks only whether runtime checks "were performed". "'It compiles' is not verification."
- It emits a `stage_message` with `blocking: true|false`. The scheduler, not Go, decides how to recover.

Plan 42 deliberately removed a hard-coded quality gate from Go. "Verdicts are entirely implementable in userland (skills write state files ...)" (`noodle/brain/archive/plans/42-requires-approval-gate/overview.md`).

**Liveness and crash safety** (`noodle/brain/architecture.md`, `noodle/monitor/`):
- Each session writes a heartbeat with a TTL. A session is "alive" if its heartbeat is newer than twice the TTL (`monitor/observer.go`).
- A session idle for more than 120 s counts as stuck.
- The monitor warns at 80% of a 200K-token context.
- On startup, noodle checks each session's PID and adopts the ones still running, so "Loop crash loses zero work."
- Stage status is set to `active` *before* the spawn.
- Plan 113 replaced post-hoc log scanning with an incremental completion state machine. The plan's own words: zombie sessions and "completed work misclassified as failed" (`noodle/brain/archive/plans/113-deterministic-completion-detection/overview.md`).

**Cost controls.** The scheduler spawns only when there are no orders and no sessions. Failed orders stay in `orders.json` as context. There is "No automatic retry — the LLM decides recovery." `max_concurrency` is set per runtime.

**Memory.** `noodle/brain/` is an Obsidian vault containing:
- 16 principles
- 34 `codebase/` gotcha notes, for example `worktree-gotchas.md` and `claude-print-flag-gotchas.md`
- 37 archived plans and 8 active plans
- `todos.md` with stable numeric IDs and a `<!-- next-id -->` marker

The project `CLAUDE.md` says: "Read first ... Write after mistakes."

**Its own skills** (`noodle/.agents/skills/`): `schedule`, `execute`, `quality`, `reflect`, `meditate`, `ruminate`, `plan`, `review`, `adversarial-review`, `oops`, `refine`, `todo`, `worktree`, `commit`, `brain`, `debugging`, `unslop` and others.

### 1.2 Stage tags

| Mechanism | Stage |
|---|---|
| Backlog adapters (`sync/add/done/edit` shell commands for GitHub Issues, Linear, `todos.md`); `noodle event emit ci.failed` | Intake |
| `refine` (turn vague todos into "self-contained prompts" through one round of questions) | Shape |
| `plan` (phases sized "1 function/type + tests", max 2–3 files) followed by an `adversarial-review` stage | Plan |
| Scheduler agent with `orders-next.json`, worktrees, `max_concurrency`, `runtime: process\|sprites` | Dispatch/Isolate |
| `execute` (decompose, worktree-first, commit, `stage_yield`) | Build |
| `quality` stage (tests and vet, scope, principles; "runtime checks were performed") | Verify / Review |
| `adversarial-review` (run on the *opposite CLI*: `codex exec` or `claude -p`) | Review, Models |
| Serialized merge queue; `supervised` parks the work in `pendingReview` | Merge, Human gates |
| `monitor/` heartbeats, stuck detection, PID adoption, web UI | Operate/Monitor, Liveness |
| `reflect` stage after every order; `meditate` periodically | Learn, Memory |
| Per-stage `with`/`model`; "Cheapest mode" | Models, Cost |

### 1.3 What survived into pstack, and what was dropped

| noodle idea | In pstack today | Survived or dropped |
|---|---|---|
| 16 `brain/principles/*.md` | `pstack/skills/principle-*/SKILL.md`: 15 of 16 present (one renamed), rewritten 20–75% shorter (never-block-on-the-human goes from 369 to 136 words, encode-lessons-in-structure from 321 to 83). pstack adds 9 new ones, such as build-the-lever, attack-the-premise and sequence-verifiable-units | **Survived.** The "Principles index" in `poteto-mode` is the descendant of `brain/principles.md` with wikilinks. |
| `serialize-shared-state-mutations` | `principle-separate-before-serializing-shared-state`. The default flips to "eliminate the shared write target" first and treats "'we need a lock' as a design smell" | **Survived and inverted.** [I] More parallel agents made it more important to avoid sharing than to lock. |
| `cost-aware-delegation` (turn budgets: "Commit passing work at budget - 7") | No principle. One line, "Size phases and cap scope ... set turn budgets", lives in `principle-guard-the-context-window` | **Dropped.** [I] Its numbers assumed CLI turn caps. She now has "unlimited tokens" ([public-workflow.md](public-workflow.md)), and pstack spends tokens on verifiers. |
| Scheduler "never touches code. It only decides what to work on and who does it" (`noodle/docs/reference/glossary.md`) | Orchestrate: "You own the program, never the code"; Cursor Projects coordinator "doesn't write code itself but directs other agents" | **Survived as a role contract** (see the ownership lines in [pstack-mechanics.md](pstack-mechanics.md) §2.3). |
| Everything is a file; single-writer staging file (`orders-next.json` -> `orders.json`) | Orchestrate store `orchestrate/<slug>/` (`units.tsv`, `frontier.json`, `ledger.tsv`, `inbox/`, `gates.md`), driven by `scripts/orch/orch.ts` with a pid lock that is replaced when its holder is dead | **Survived.** Same design: plain files, single writer, stale-lock recovery. |
| `control.ndjson` (append-only, acknowledged) | Orchestrate `inbox/`: "Completions are queue events, not interrupts" | **Survived.** |
| Heartbeats, 120 s stuck detection, PID adoption on restart | Autopilot-full hourly audit ("Probes every agent by side effects"); "Never resume an agent to check on it"; "Transcript mtime is not liveness"; reattach cloud work "by PR and branch rather than agent id" | **Survived as prose rules.** The daemon that enforced them is gone. |
| "Timebox failures: 2+ failures, deschedule or split" | `principle-attack-the-premise` (after two failed fixes on one premise); Orchestrate's "after two retries abandon and replan" | **Survived.** |
| "One Plan at a Time" | Babysit: "The lowest unmerged PR is the only one that matters until it merges" | **Survived** (the same focus rule, applied to the merge frontier). |
| Serialized local merge queue (rebase and fast-forward, no PRs) | Shipping playbook: PRs, a contiguous verified run, patch-id rule, land bottom-up | **Replaced.** [I] At Cursor the forge, CI, Bugbot and merge queue are real, so the merge moved to PRs. |
| `quality` stage: tests plus principle compliance, cross-provider | `swarm` verifiers with a mandatory live lane; "Only a verdict from an agent that did not write the code counts"; "Green CI ... are not verdicts" | **Survived and made much stricter.** Noodle verified with tests and a reviewer's reading. pstack verifies by driving the real app. |
| `adversarial-review` with persona lenses (Skeptic, Architect, Minimalist) on the opposite CLI | `interrogate`: one reviewer per configured model; "The adversarial signal comes from model diversity, not assigned personas" | **Survived, personas dropped.** [I] The pstack line reads as a direct correction of the noodle design. |
| `review` "Lead Judgment" and noodle's verdict format (PASS / CONTESTED / REJECT) | `how` critique, then `interrogate`'s "Act on / Consider / Noted / Dismissed" with an Agreement Map | **Survived.** |
| `auto`/`supervised`/`manual` config dial | Per-prompt grants ("don't ask me before committing"); Autopilot-full ("You own the verdicts") vs Autopilot-stack ("You own the stack, never the landing"); "Babysitting never authorizes merging" | **Survived as a concept, not as config.** The dial moved from `.noodle.toml` into the prompt and the choice of playbook. |
| Natural-language `schedule:` on skills, read by a scheduler agent | Gone from pstack. Event triggers now live in Cursor Automations and Grok Bot routines ("watch for issues ... send it to my cursor project") | **Moved to the platform.** |
| `with`/`model` per stage, chosen by the scheduler | `setup-pstack` role lines in `pstack-models.mdc`; per-spawn effort tiering in `poteto-mode` | **Survived.** The scheduler's per-order choice became a static role map plus per-spawn effort. |
| Sprites cloud VMs; plan 69 "Cursor dispatcher" (push branch, launch Cursor Cloud Agent, poll, pull back) | Cursor cloud agents are the default parallelism ("I would recommend against [worktrees]") | **Survived.** Plan 69 shows she wanted cloud agents in noodle before joining Cursor. |
| Go daemon, web UI, TUI, provider NDJSON parsing, session adoption | None | **Dropped.** See 1.4. |
| Kitchen vocabulary (mise, cooks, orders, sous-chef) | "Michelin kitchen", "head chef", "inspect dishes at the pass" ([P, Loops](https://x.com/poteto/status/2069824386283319343)) | **Survived as a metaphor.** |

### 1.4 Why noodle was dropped

- **Her stated reason [P].** "every agent workflow I had used was focused on the wrong thing. Running multiple CLIs in a GUI was missing the point entirely. The approach I was interested in was building trust in agents." Also: "Naive parallelization just makes them write slop faster ... I do think that agent orchestration can be done productively. But we need to go depth first." And: "using a cli just makes you, the human, the orchestrator" ([P, "How I Use Cursor"](https://x.com/poteto/status/2058975157503570132)).
- **The same lesson, in the Cursor-era story [P].** After she added worktrees, "Parallelization just gave me more to review and discard. Throughput had increased, but at the cost of more rework" ([P, Loops](https://x.com/poteto/status/2069824386283319343)).
- **What noodle lacked [I].**
  - Noodle's `prove-it-works` principle already says "check the real thing". But the loop had no instrument to see a running app. `quality` could only check that runtime checks "were performed".
  - The missing piece was `/control-glass`, a CDP harness she built in her first weeks at Cursor. It turned "prove it works" from an instruction into a tool.
  - This matches her own rule order: verification first, autonomy last.
- **Platform overlap [I].** Noodle's own backlog shows where it was heading: plan 69 (a Cursor dispatcher), plans 96 and 101 (runtime plugins), plan 84 (sub-agent tracking), plan 90 (interactive sessions). The next 9 months of Cursor and Grok Bot work cover all of these: cloud agents, Automations, Projects, and the bot hierarchy. Keeping a separate Go runtime would have duplicated her employer's product.
- **Timing [I].** The last commit (2026-03-19) folds an "optimize" skill into `meditate` and adds plan 119. Both point at learning-loop quality, not more orchestration. She was already moving toward the "depth" side.

---

## 2. poteto/brainmaxxing: persistent memory and skill improvement

**What it is.** "Stupid simple persistent memory for Claude Code. A markdown vault that your agent reads at session start and writes to when it learns something." (`brainmaxxing/README.md@ec4d8e4`).

- **Size and history.** 3 commits, all on 2026-02-27. 343 stars. 36 files.
- **Origin.** It is noodle's `brain/` and learning skills, pulled out and generalized. Its `reflect` is noodle's with the `schedule:` field and the noodle-specific routing removed (diffed). Noodle's docs list it as an optional add-on (`noodle/docs/cookbook/self-learning.md`).
- **Contents.** Six skills: `brain`, `reflect`, `meditate`, `ruminate`, `plan` and `review`. The same 16 principles as starter content. Two hooks.

### 2.1 Core mechanism

**Memory format** (`brainmaxxing/.agents/skills/brain/SKILL.md`):
- The vault is `brain/` with `index.md`, `principles.md`, `principles/`, `codebase/` and `plans/`.
- One topic per file. Index files hold `[[wikilinks]]` only. Notes stay under about 50 lines, as bullets, with no frontmatter.
- **Durability test.** "Would I include this in a prompt for a *different* task?" If not:
  - plan-specific knowledge goes into the plan
  - a skill issue goes into the skill
  - follow-up work goes into a todo

**Plumbing.** Two hooks in `brainmaxxing/.claude/settings.json`:
- `SessionStart` (startup or resume) runs `inject-brain.sh`, which prints `brain/index.md` into context.
- `PostToolUse` on `brain/` runs `auto-index-brain.sh`. It rebuilds the index from the files on disk when they drift. It is deterministic, with "no LLM-generated descriptions".

**The learning loop runs at three timescales** (`noodle/docs/cookbook/self-learning.md`). "Reflect captures. Meditate distills. Ruminate fills gaps."

- **`reflect`** runs after each session or correction. It scans the conversation for mistakes, preferences, gotchas, decisions and friction, then routes each learning:
  - **Structural enforcement check first.** "can this be a lint rule, script, metadata flag, or runtime check? If yes, encode it structurally and skip the brain note."
  - Otherwise the learning goes to a brain file (the default), a skill file, or a todo.
- **`meditate`** runs periodically:
  - It snapshots `brain/` and `.agents/skills/` into one file each (`scripts/snapshot.sh`).
  - An **Auditor** subagent flags notes as outdated, redundant, low-value, verbose or orphaned. It audits `CLAUDE.md` and auto-memory as well.
  - A **Reviewer** subagent synthesizes links, distills new principles ("evidenced by 2+ separate notes"), and reviews each skill against the principles.
  - It then **applies all changes directly**: "The user reviews the diff."
  - Its quality bar: a note must be "high-signal ... high-frequency ... or high-impact".
- **`ruminate`** runs ad hoc:
  - `scripts/extract-conversations.py` parses `~/.claude/projects/<proj>/*.jsonl` into batches.
  - N parallel Opus agents, one per batch, mine user corrections, repeated preferences, frustrations and "skills wished for".
  - The orchestrator filters by frequency and impact ("Discard aggressively"), presents a table, and applies "only the changes the user approves".

**Planned next step: plan 119, "brainmaxxing autoresearch"** (`noodle/brain/plans/119-brainmaxxing-autoresearch/overview.md`, dated 2026-03-19, never shipped to brainmaxxing):
- **Motivation:** brainmaxxing "never measures whether its edits actually improved outcomes. Meditate can silently degrade the brain."
- **Fix:** add a **curator gate** (accept or reject high-risk edits), typed edit proposals with a `base_hash`, structured findings, and a GEPA-style **skill hill-climbing** loop ("mutate the skill, test it, keep only improvements").

### 2.2 Stage tags

| Mechanism | Stage |
|---|---|
| `SessionStart` index injection; "read first" | Memory |
| `reflect` routing (structural, then brain, then skill, then todo) | Learn |
| `meditate` audit, distill, skill review | Learn, Memory |
| `ruminate` transcript mining with parallel agents | Learn, Models (Opus per batch), Cost |
| `meditate` auto-applies; `ruminate` waits for user approval | Human gates |
| `plan` (phases written to `brain/plans/`) | Plan |
| `review` (Architecture, Code Quality, Tests, Performance; numbered issues with lettered options) | Review |

### 2.3 What survived into pstack, and what was dropped

| brainmaxxing idea | In pstack today | Survived or dropped |
|---|---|---|
| `reflect` | `pstack/skills/reflect/SKILL.md`: three reviewers (Judgment, Tooling, Divergent) on different models, a synthesizer with fixed criteria, and Accepted / Rejected / Backlog output | **Survived and hardened.** The *target* changed: pstack's reflect routes "into skill edits" on existing skills. There is no brain note destination. |
| Structural enforcement check in `reflect` | Kept word for word in pstack reflect step 4 ("a lint rule, script, metadata flag, or runtime check") and expanded into `/correct` (architecture, then types or lint, then tests, then docs last) | **Survived.** This is the most persistent idea across all her repos. |
| `meditate` "Apply all changes directly. The user reviews the diff." | pstack reflect: "wait for explicit approval ... Skill changes affect every future agent in the org. Do not auto-apply." | **Reversed.** Her stated reason is the org-wide blast radius, given in the pstack file itself [P]. |
| `meditate` distillation: new principle needs "2+ separate notes" | pstack reflect synthesizer convergence ("2+ reviewers"); `/correct` "a mistake class counts once it has happened twice"; `/automate-me` "Patterns seen in 2+ slices are high-confidence" | **Survived** (the twice-seen threshold). |
| `ruminate` (parallel transcript miners, filter by frequency, quote the user) | `/recall` (parallel cheap-model miners over transcripts) and `/automate-me` (mines transcripts and drafts a personal `<name>-mode` skill via PR) | **Survived and split** into context recovery and persona capture. |
| Plan 119 curator gate and skill hill-climbing | `playbooks/eval.md` (blinded candidates, a judge from a different family, grading from transcripts) and `playbooks/hillclimb.md` | **Survived.** The "measure whether the edit helped" gap from plan 119 became pstack's eval playbook. |
| Obsidian `brain/` vault, wikilink indexes, `codebase/` gotcha notes | None. A grep of pstack 0.15.28 finds no "brain", "meditate" or "ruminate" | **Dropped.** Reason below. |
| `SessionStart` and `PostToolUse` hooks | pstack ships no hooks. Its Cursor features are Custom Mode pinning and rules files | **Dropped.** [I] They are Claude-Code-specific, and pstack targets Cursor first. |
| `plan` (phase sizing, plans in `brain/plans/`) | `playbooks/multi-phase-plan.md` with a fixed per-PR skeleton, linted by `scripts/check-plan.mjs` | **Survived.** Plans moved out of a memory vault into a linted checklist. |
| `review` (A/B/C options per issue) | `interrogate` and the Review steps in playbooks | Partly. The interactive option menu is gone, because pstack decides and reports under a grant. |

### 2.4 Why the brain vault was dropped

- **Her stated reason [P]:** "You can think of the Feature Map as a form of 'materialized memory'. If you've been using agents for a while you're probably familiar with the concept of memory - typically these might be stored as simple markdown files (eg an Obsidian vault) ... Personally, I think your codebase is the ultimate form of memory. Code is a projection of the decision making you and your team have made ... A Feature Map is just a more compact form of that, designed to save tokens. And because it's just markdown inside of a skill, everyone contributing to your codebase benefits from this shared memory" ([P, pstack guide Pt. 1](https://x.com/poteto/status/2094457600259842065)). The Obsidian vault mention is a direct reference to brainmaxxing.
- **The same idea in her talks [P]:** "the code base is really like the best form of memory because agents love to extend existing patterns" (Compile talk, quoted in [public-workflow.md](public-workflow.md)). The "company brain" idea is "unnecessarily complex: agents are really good at using tools."
- **[I] A team problem.** A per-repo vault written by one person's agents does not scale to "hundreds of PRs a day" from many contributors. Skills, lint rules and feature maps are shared through the repo and plugin, and are reviewed like code. Brain notes were reviewed only as a `meditate` diff.

---

## 3. poteto/how: the first Cursor-native skill

**What it is.** A Cursor plugin (`how/.cursor-plugin/plugin.json@b1ef429`). It is one commit, dated 2026-04-14, about three weeks after she joined Cursor. It adds `/how`: "Explain how something works in this codebase ... Optionally critique the architecture" (`how/skills/how/SKILL.md`).

### 3.1 Core mechanism

- **Complexity triage.**
  - *Simple* questions go to one readonly explainer, which explores and explains in one pass.
  - *Complex* questions are split into "2-4 parallel exploration angles". Explorers run with `model: gpt-5.4`, `readonly: true`, and return Components, Flow, Files Read, Boundaries, Non-Obvious Things and Open Questions. Then one synthesizer (`claude-opus-4.6`) reconciles them.
- **Output contract.** Overview, Key Concepts, How It Works, Where Things Live, Gotchas.
- **Critique mode.**
  - It explains first, then spawns three critics on *three model families*: `claude-opus-4.6`, `composer-2` and `gpt-5.4`.
  - The critics use a rubric covering Abstraction Fit, Data Model, Boundary Discipline, Evolution Readiness, Complexity vs Value and Consistency (`how/skills/how/references/critique-rubric.md`).
  - Severity levels are `structural`, `concern` and `observation`. "An empty critique is a valid outcome."
  - Lead judgment sorts findings into **Act on / Consider / Noted / Dismissed**.

Stage tags:
- Explore and explain: Shape, Plan
- Critique: Review
- Model per role: Models
- Simple path skips fan-out: Cost

### 3.2 What survived into pstack

| how (April) | pstack `how` today |
|---|---|
| Hard-coded `gpt-5.4` explorers and an `claude-opus-4.6` explainer | Role lines `how explorer` (default `grok-4.7-xhigh-fast`) and `how explainer` (default `claude-opus-5-5-xhigh`), set by `/setup-pstack` |
| Critique mode with three critics | **Removed from `how`.** pstack `how/references/` has only explorer and explainer prompts. Critique moved to `interrogate` (model-diverse review) and `architect` (design-twice arena) |
| Act on / Consider / Noted / Dismissed | Kept in `interrogate` |

**Why [I]:**
- The split follows "one skill, one job", which comes from noodle's own `thinking-in-noodle.md`: "If you need 'and' more than once, it's probably two skills."
- Moving model slugs into a config file lets one skill outlive model churn. pstack commit `df58112` (2026-10-06) is "drop Sol, default to Opus xhigh and Grok".

Lineage: noodle `adversarial-review` (opposite CLI) leads to `how` critique (three families through Cursor subagents), which leads to pstack `interrogate`. This is where her "multi-model adversarial review" theme first appears in Cursor form. She links the noodle skill directly when she writes "I was already raving about multi-model adversarial review" ([P, "How I Use Cursor"](https://x.com/poteto/status/2058975157503570132), linking `skills.sh/poteto/noodle/adversarial-review`).

---

## 4. poteto/verification-skill-example: the Verify layer, made concrete

**What it is.** A "heavily fictionalized example of a project-local verification skill + behavior-level feature map for a large desktop app". The app ("Atlas" by "Harbor Labs") is made up. It is one commit, dated 2026-07-30 (`verification-skill-example/README.md@d5abe70`). The pstack guide Pt. 1 links it as the reference output of `/create-verification-skill`.

### 4.1 Core mechanism

**`SKILL.md` covers four things:** launch, doctor, drive and prove (`.cursor/skills/verify-atlas/SKILL.md`).

- **The CLI.** A `control-atlas.mjs` CLI (omitted on purpose) drives the Electron build over CDP. Its commands fall into these groups:
  - Inspection: `snapshot`, `screenshot`
  - Interaction: `click`, `aria-click`, `press`, `send`, `eval`, `feature-flag`
  - Performance: `trace`, `profile`, `record`, `perf-metrics`, `wait-settle`
  - Streaming: `console`, `network-log`
  - Health: `doctor`, `cleanup`, `watch --restart`
- **Isolation.** It checks whether `.git` is a file (an isolated checkout) or a directory (the main workspace).
  - In a checkout, every command takes `--checkout`, so the port and user-data-dir are derived for that tree.
  - A launch from a checkout without `--checkout` "is refused". The isolation rule is enforced by the tool, not by an instruction.
- **`doctor` first.** "A video against a stale bundle is not evidence."
- **Proof bar.**
  - "Do not submit 'look, it opens' captures."
  - Drive the production user path.
  - Use `eval` only to *inspect* state after the user path ran.
  - Cover every entry point plus the success, cancel, error, empty and persistence paths.
  - Verify side effects, not just pixels (DOM, clipboard, network, a reload round trip).
- **Feature map** (`references/features/README.md` plus about 30 files):
  - Every file has the same four H2s: Sub-features, How to get to it (user POV), Driving it with control-atlas, Gotchas.
  - The README doubles as a top-to-bottom regression sweep order, ending with `multi-surface-journeys.md`.
  - Mocks count "only behind the same production boundary an unavailable external dependency would use".
  - An unreachable path must be named, along with what blocks it.
- **"Why not a wiki?"** "Agents pay for every token they reread." The feature map is scoped, actionable and sweepable, and "Maintained as code."

Stage tags:
- Whole skill: Verify
- `--checkout` derivation: Dispatch/Isolate
- `doctor` and stale-build checks: Liveness
- Feature map: Memory ("materialized memory")
- Daily `/maintain-verification-skill`: Operate/Monitor, Learn

### 4.2 Lineage

- **Origin.** `/control-glass`, built in her first days at Cursor in March–April 2026 ([P, Loops](https://x.com/poteto/status/2069824386283319343)).
- **Generalized into pstack** by commit `e42d29f` (2026-07-12), "add create-verification-skill and maintain-verification-skill". The commit message reads: "Generalizes the control-glass approach (feature map, doctor, proof standards, harness-first) for any language or platform ... must prove its own output by running it once ... Validated by 4 cloud agents generating against real repos." The feature map reference was added in `4483dcd` (2026-07-30), the same day this example repo was published.
- **In the Benny pack** it reappears as the "control adapter" contract plus `feature-map.example.md` (`cursor/plugins/pstack/automations/benny/skills/reproduce-and-fix-issues/references/`).
- **Relation to noodle.** This is the layer noodle never had. Noodle's `prove-it-works` already said to "Check the real thing, not a proxy", but noodle could not *see* the real thing. The feature map also replaces brainmaxxing's `codebase/` gotcha notes, organized by user-visible feature instead of by incident.

---

## 5. Other repos with 2025–2026 agent activity

| Repo | What it is | Relevance |
|---|---|---|
| `poteto/benny-avatars@9895fc9` (2026-04-30) | A public mirror of 5 PNGs for the internal `orchestrate` Slack bot. The source of truth is `.cursor/skills/workflow/orchestrate/assets/avatars/` in the private `anysphere/everysphere` repo | Shows the internal role tree: `kickoff` ("orchestrator-parent, 'Lauren's guy'"), `planner`, `subplanner`, `worker`, `verifier`. This is the April–May shape of the coordinator idea. It became the public `cursor/plugins/orchestrate` plugin (added 2026-05-06 by Sam Sokolin, with her commits on 2026-06-06) and later pstack's Orchestrate playbook (`99559f2`, 2026-08-02, "catch-up ports"). |
| `poteto/poteto.github.io@609270f` | One file: "Are you looking for noodle?" | Noodle's docs site. |
| `poteto/homebrew-tap@1108075` (2026-03-03) | The Homebrew formula for noodle | Confirms noodle was packaged for outside users. |
| `poteto/plugins` (fork of `cursor/plugins`) | A mirror of upstream branches | No work unique to the fork. |
| `poteto/stylex` (fork, 2026-06-08) | A StyleX fork | Tied to the StyleX migration automation in Loops. No agent tooling. |
| `poteto/react` fork, `react-compiler-styled-jsx`, `repro-32440` | React Compiler work | Not agent tooling. The April 2025 compiler MCP lives upstream (`react/react#32859`, per Loops). |
| `cursor/plugins/pstack/automations/benny@9580c23` (added `0452e08`, 2026-06-24) | The open-sourced Benny pack promised in Loops: `triage-issue-reports`, `reproduce-and-fix-issues`, `setup-benny`, templates | See §6.2. The earlier doc's open gap about where these "example automation skills" live is now closed. |

---

## 6. Evolution timeline: which problem each step solved

### 6.1 Timeline

| When | Step | Problem it solved | Problem it left open | Main stages |
|---|---|---|---|---|
| Apr 2025 | React Compiler toy MCP | Agents should "get the same signals human engineers use" | "MCP ended up being the wrong medium" [P, Loops] | Verify |
| Feb 22 – Mar 19, 2026 | **noodle** (1,412 commits) | *The human is the orchestrator.* Noodle mechanized intake, scheduling, isolation, merge and liveness, and added a trust dial | *Trust.* There was no instrument to see the running app, and parallel output still needed review. She set the default to `supervised` (Mar 3) | Intake, Plan, Dispatch/Isolate, Merge, Operate/Monitor, Liveness, Human gates |
| Feb 27, 2026 | **brainmaxxing** | *Amnesia across sessions.* A vault plus reflect, meditate and ruminate | Unmeasured edits ("Meditate can silently degrade the brain", plan 119); one person's vault is not shared team memory | Learn, Memory |
| Late Mar – Apr 2026 | Joins Cursor; `/control-glass` with worktree isolation; `poteto/how` (Apr 14); internal `orchestrate` bot (avatars Apr 30) | *Agents can't see the app.* "the meat proxy between my agent and Chrome DevTools." CDP gives agents her own instruments | "Parallelization just gave me more to review and discard" | Verify, Dispatch/Isolate, Review, Models |
| Mar 2026 (launch) and Jun 24 (Benny pack) | **Cursor Automations** | "even with pstack, agents still do nothing unless I kick them off myself." Event triggers start the loop; triage, repro and fix run as separate stages that can each stop the line | Each automation is still one agent per report, so related bugs are not seen together | Intake, Verify, Build, Human gates |
| May 23, 2026 → | **pstack** (first public commit `24bd6eb`) | *Trust in one agent.* "go depth first": playbooks, principles, multi-model review, decision logs | Overnight queues, merging, and how verification is maintained | Plan, Build, Verify, Review, Learn, Models |
| Jul 12 – Aug 2, 2026 | pstack adds `create-/maintain-verification-skill`, `swarm`, Autopilot-full/stack, Babysit, Shipping, Orchestrate | *Verification as maintained infrastructure*, and *landing a queue without a human per PR* | Self-merge policy for a whole team | Verify, Merge, Operate/Monitor, Liveness |
| Aug 11, 2026 | **Grok Bot launch; agents merge their own PRs** | Noodle's `auto` mode, now with a verifier swarm behind it | Review load, handled by "sampling" and morning review on main | Merge, Human gates |
| Sep 10, 2026 | **Cursor Projects** (her "inner loop") | One coordinator per *area*, so "when I see the other multitude of bugs it's actually up here" | Fan-in from many sources | Plan, Dispatch/Isolate, Operate/Monitor |
| Aug – Oct 2026 | **Grok Bot routines and bots** (her "outer loop"): chiefs of staff, then engineering lead, then engineer bots, then cloud agents; Dr Eggbot audits; `/make-bot-ui` (Aug 27) | Intake from Slack, X, email, Linear, Sentry and so on; more than 10 coordinators at once; bots that design and audit bots | No public defect or revert data | Intake, Operate/Monitor, Learn |
| Oct 2026 | `/correct` (Oct 3), `/ketchup` (Oct 10), `/sharpen`, `/in-your-own-words`, formal verification (Oct 18) | Turning repeated corrections into enforcers; a decision-only morning brief; TLA+ for parts that are hard to test live | Not covered by these repos | Learn, Review, Verify |

### 6.2 How noodle's parts map onto today's stack

```text
noodle (Feb 2026, one Go process)          today (Oct 2026, hosted pieces)
-----------------------------------        ------------------------------------------------
backlog adapters + `noodle event emit`  -> Grok Bot routines / Cursor Automations triggers
`schedule:` prose + scheduler agent     -> automation/routine instructions ("watch for ... send to my project")
scheduler "never touches code"          -> Cursor Project coordinator; pstack Orchestrate "never the code"
mise.json / orders.json                 -> orch store (units.tsv, frontier.json, ledger.tsv), Slack thread state
cook in worktree / Sprites VM           -> Cursor cloud agent ("a real computer", snapshot after first build)
quality stage (tests + principles)      -> swarm verifiers on the real app + feature map + control CLI
stage_message {blocking}                -> Benny `[benny:bug]` / `[benny:other]` thread markers; PASS/FAIL verdicts
supervised merge parking                -> per-prompt grants; Autopilot-stack; human veto window in the Slack thread
auto mode                               -> self-merge on Grok Bot (Aug 11)
serialized merge queue                  -> Shipping: contiguous verified run, patch-id, bottom-up, forge merge queue
heartbeat / stuck / PID adoption        -> hourly audit tick, side-effect probes, reattach by PR and branch
reflect stage after every order         -> /reflect (human-approved), /correct, Dr Eggbot audit routine
brain/ vault                            -> codebase + lint rules + feature maps + skills
```

The Benny pack is the clearest bridge between noodle's file events and today's Slack-based loop. Its two automations talk only through trusted thread markers:
- They accept a marker only from `slack.triage_identity_user_id`, with "exactly one configured marker".
- They "Freeze source coordinates" before any work.
- "The coordinator is the only Slack poster", and children get "an explicit ban on every Slack write action".
- "No confirmed repro means no authored fix", and fixes are draft-only PRs (`cursor/plugins/pstack/automations/benny/skills/*/SKILL.md@9580c23`).

This is noodle's `stage_message {blocking}` and single-writer rule, carried by Slack threads instead of `.noodle/`.

### 6.3 What stayed constant

Three ideas appear in every repo, from noodle in February to pstack in October:

1. **Encode lessons in structure.** "The instruction IS the symptom" is in `noodle/brain/principles/encode-lessons-in-structure.md`. The same check appears in brainmaxxing `reflect`, pstack `reflect` step 4, `/correct`, `check-plan.mjs`, and the verify CLI refusing a launch without `--checkout`.
2. **Never block on the human, but irreversible actions still pause.** The boundary list (force-push, production data, external messages) is the same in noodle and in pstack's Autonomy section.
3. **Separate the writer from the judge, and prefer judges from other model families.** Noodle's cross-provider `quality` and opposite-CLI `adversarial-review` lead to `how` critics on three families, then `interrogate`, swarm verifiers ("never the author"), and cross-family trail review.

What changed is *where trust comes from*:
- **In noodle**, trust was a config value (`mode`) that a human set.
- **In pstack and the hosted loops**, trust is earned for each change through verification evidence: live lanes, videos, a double repro, patch-id verdicts. Autonomy is then granted for each prompt or loop.

Her Loops article rule 5, "Make loops autonomous only after it earns your trust", is the lesson of switching noodle to `supervised` on 2026-03-03 [I].

---

## 7. Implications for building your own version

These are inferences [I] for this repo's software-factory work. They are not her recommendations.

- **Build in her order, not noodle's.** Noodle built the orchestrator first and found it lacked trust. Her later order was:
  1. a verification instrument and a feature map
  2. depth-first playbooks and principles
  3. event triggers
  4. coordinators
  5. self-merge
- **A trust dial is still useful, but tie each position to evidence.** Noodle's dial was global and configured by hand. pstack's "dial" is the choice of playbook plus grants in the prompt, and every step to more autonomy needs a verdict from an agent that did not write the code.
- **Prefer team-shared, reviewed memory over a private vault.** That means skills, lint rules, feature maps and the codebase. Keep a brainmaxxing-style reflect loop, but route its output to skill and lint changes under human approval, as pstack reflect and `/correct` do.
- **Keep the deterministic and judgment split that noodle got right.** Go handled "everything deterministic" and LLMs handled "everything that requires judgment" (`noodle/brain/architecture.md`). pstack keeps this through `watch-pr`, `orch` and `check-plan.mjs`, and through "Build the Lever".

---

## 8. Gaps

- **pstack guide Part 2 was not found.** Neither fxtwitter nor two web searches turned it up, and Part 1 ends "stay tuned for Part 2". It may not be published yet.
- **The earlier verification post is now found:** "How I Use Cursor" (2026-05-25), [x.com/poteto/status/2058975157503570132](https://x.com/poteto/status/2058975157503570132), linked from Loops as "my previous post". It is the main primary source for why she pivoted from noodle.
- **Noodle's README gives no reason for stopping.** The reasons above come from her later articles plus inference.
- **Plan 119 was never applied to brainmaxxing.** brainmaxxing's last commit (2026-02-27) is earlier than the plan (2026-03-19).
- **Internal repos are private.** `/control-glass`, the internal `orchestrate` skill and Dune are in `anysphere/everysphere` or xAI repos. Only fictionalized or ported copies are public. pstack commits such as `b047069` mention restoring files "from the real tip/main sources with only public-path edits", which means the public pstack is a port of an internal tip.
- **Dates for Cursor Automations.** Loops says "Cursor launched automations in March". The Benny pack was published June 24. The exact date her first Slack chain went live is not public.
- **Noodle's real-world use is unknown.** There is no evidence of how much she ran noodle unattended. The repo shows the design, its docs and fixtures, and that the default moved to `supervised`.

## Sources

**Repositories** (read at the SHAs listed at the top):
- [github.com/poteto/noodle](https://github.com/poteto/noodle)
- [github.com/poteto/brainmaxxing](https://github.com/poteto/brainmaxxing)
- [github.com/poteto/how](https://github.com/poteto/how)
- [github.com/poteto/verification-skill-example](https://github.com/poteto/verification-skill-example)
- [github.com/poteto/benny-avatars](https://github.com/poteto/benny-avatars)
- [github.com/cursor/plugins/tree/main/pstack/automations/benny](https://github.com/cursor/plugins/tree/main/pstack/automations/benny)
- pstack commit history via `gh api repos/cursor/plugins/commits?path=pstack`

**X articles** (read via `api.fxtwitter.com`):
- "How I Use Cursor", 2026-05-25: [x.com/poteto/status/2058975157503570132](https://x.com/poteto/status/2058975157503570132)
- "Loops You Can Trust", 2026-06-24: [x.com/poteto/status/2069824386283319343](https://x.com/poteto/status/2069824386283319343)
- "The Complete Guide to pstack Pt. 1", 2026-08-31: [x.com/poteto/status/2094457600259842065](https://x.com/poteto/status/2094457600259842065)

**Searches for Part 2** found only secondary write-ups:
- [youmind.com Pt. 1 mirror](https://youmind.com/landing/x-viral-articles/pstack-guide-ai-verification-skills)
- [flaviocopes.com/pstack](https://flaviocopes.com/pstack)
- [redreamality.com pstack guide](https://redreamality.com/garden/notes/pstack-skills-guide/)
