# poteto's workflow: the Cursor-native pieces outside the Claude Code pstack build

Source: a local clone of `cursor/plugins` at commit `ddf824a`. Every path below is relative to that
clone (`~/code/plugins`). This note picks up where [`pstack-mechanics.md`](./pstack-mechanics.md)
stops. That note covers `harness/pstack/claude-code` (pstack 0.15.28). This one covers what the
Claude Code build leaves out, plus the sibling plugins that pstack's playbooks call by name. It
describes the files and does not recommend anything. I read the scripts but did not run them.

Stage tags use the shared taxonomy: Intake, Shape, Plan, Dispatch/Isolate, Build, Verify, Review,
Merge, Operate/Monitor, Learn. Cross-cutting tags: Memory, Human gates, Models, Cost, Liveness.

---

## 1. Summary

- **The Claude Code harness drops very little of pstack.** `diff -rq pstack harness/pstack/claude-code`
  shows the harness copy loses three things: `pstack/automations/` (the **benny** pack), `pstack/assets/`
  (a logo), and `.cursor-plugin/`. Every other difference is one added line per skill ("In Claude Code,
  read the Claude Code adapter…") or relative links rewritten to GitHub URLs (`README.md`,
  `docs/guide/07-overnight.md`). In this repo, the only Cursor-only pstack content that is new
  material is **benny**.
- **benny is authored by poteto.** She committed it as "pstack: add Benny issue automation pack (#137)".
  It is how she "lets loops start themselves" (`pstack/docs/guide/07-overnight.md`). It is two Cursor
  Automations triggered from Slack. The first triages each report and ends with a machine-readable
  verdict marker. The second waits for that marker, reproduces the bug twice through the real UI,
  and may open one draft PR after before-and-after proof. This answers open question 11 in
  `pstack-mechanics.md`.
- **The `orchestrate` plugin is a different system from pstack's Orchestrate playbook.** It fans work
  out to Cursor **cloud agents** through `@cursor/sdk`. A Bun reconcile loop drives
  `plan.json`/`state.json`/`handoffs/` in git. Its manifest author is "Cursor" and Sam Sokolin added
  it. poteto made 3 of its 7 commits, including the stuck-escalation watchdog and the Opus 4.8 catalog
  update. pstack never names the plugin. Its own playbook (`pstack/skills/poteto-mode/playbooks/orchestrate.md`)
  does reuse orchestrate's vocabulary word for word: the verification ladder, the retry-by-failure-mode
  table, and synthetic postmortems for silent deaths. Its "stop line" plays the same role as
  orchestrate's Andon.
- **`cursor-team-kit` (Eric Zakariasson) supplies the verification hands.** It provides `control-ui`
  (Playwright/CDP), `control-cli` (tmux/PTY), `verify-this`, and `deslop`, which pstack's Shipping,
  Autopilot, swarm, and multi-phase-plan steps call by name. These are short, portable recipes.
  Nothing in them is Cursor-only except the `ci-watcher` agent's `is_background`/`model: fast`
  frontmatter.
- **The other loop and memory plugins are not poteto's.** `ralph-loop` (Cursor) and
  `continual-learning` (Eric Zakariasson) are both stop-hook re-prompt loops. `advisor` (Cursor) is a
  hook-enforced "consult a stronger model before declaring done" mode. `thermos` (Cursor) is a pair of
  parallel review subagents. pstack names `thermos` only through `dyl-stack`. All four map cleanly
  onto Claude Code hooks and subagents.

---

## 2. Component index

| # | Component | Path | Author (manifest / commits) | poteto's? | Stages |
|---|---|---|---|---|---|
| 3 | benny automation pack | `pstack/automations/benny/` | Lauren Tan / lauren | **Yes** | Intake, Shape, Dispatch/Isolate, Build, Verify, Operate/Monitor; Human gates, Models, Cost, Liveness |
| 4 | orchestrate plugin | `orchestrate/` | Cursor / Sam Sokolin, lauren (3 of 7), Mubashir R | Co-maintained, not authored | Plan, Dispatch/Isolate, Build, Verify, Merge, Operate/Monitor; Liveness, Human gates, Models, Cost, Memory |
| 5 | cursor-team-kit | `cursor-team-kit/` | Eric Zakariasson | No (pstack depends on it) | Verify, Review, Merge, Operate/Monitor, Learn |
| 6 | ralph-loop | `ralph-loop/` | Cursor / Erik Nilsson, Eric Zakariasson | No | Build, Verify; Liveness, Cost |
| 7 | continual-learning | `continual-learning/` | Eric Zakariasson | No | Learn; Memory |
| 8 | advisor | `advisor/` | Cursor / Eric Zakariasson | No | Plan, Verify, Review; Models, Human gates, Cost |
| 9 | thermos | `thermos/` | Cursor / Eric Zakariasson | No | Review |
| 10 | dyl-stack (`dyl-ready-pr`) | `dyl-stack/` | Dylan Gattey | No (built on pstack) | Review, Merge; Human gates |
| 11 | others | see section 11 | | | |

---

## 3. benny: Slack issue report → triage → repro → draft fix (poteto)

**What it is.** A dormant pack of two Cursor Automations: `benny-triage` and `benny-reproduce`. The
files are not registered as slash skills. Each `SKILL.md` has `disable-model-invocation: true`, and the
plugin manifest only exposes `./skills/` (`pstack/automations/benny/README.md`,
`skills/setup-benny/SKILL.md`). It is pstack's concrete version of "let loops start themselves":
"Every stage can stop the line" and "Every stage hands over evidence"
(`pstack/docs/guide/07-overnight.md`).

**Files.**
- `FOR_AGENTS.md` states the user's intent in the first person (trigger, behavior, tools, outcome,
  and boundary for each automation), followed by setup steps for the agent.
- `skills/setup-benny/SKILL.md` covers installing, configuring, creating the automations, and testing
  thread safety.
- `skills/triage-issue-reports/SKILL.md` is the operational instructions for automation 1.
- `skills/reproduce-and-fix-issues/SKILL.md` is the operational instructions for automation 2.
- `.../references/control-adapter.md` is the capability contract every app driver must meet.
- `.../references/feature-map.example.md` is a user-POV map of every feature benny may reproduce.
- `.../references/verify-existing-fix.md` is the mode used when a PR or commit already exists.
- `skills/triage-issue-reports/references/routing.example.md` is the routing and owner-ping policy as
  data.
- `templates/configuration.example.yaml` and `templates/{triage,reproduce}-automation-prompt.md` are
  the config schema and the thin live-prompt shims.

### 3.1 Install mechanism

1. The human points Cursor at `FOR_AGENTS.md` and names a target repo.
2. The agent merges the whole pack into `<target>/.cursor/automations/benny/`. It preserves
   destination-only files and reviews diffs instead of overwriting.
3. It enables pstack in the target's committed `.cursor/settings.json` (`{"plugins":{"pstack":{"enabled":true}}}`)
   so the automations get the shared skills `how`, `why`, `tdd`, `unslop`, and six principles.
4. A fresh agent rooted in the target must prove those skills resolve **from project scope**. Skills
   from the current session or a user-scoped install do not count.
5. User config lives **outside** the pack, for example `.cursor/benny/configuration.yaml`,
   `feature-map.md`, and `routing.md`, so that pack refreshes cannot overwrite it. Secrets stay in a
   secret manager.
6. Each automation is created through Cursor's built-in `/automate` skill, one at a time, ending in
   the Automations editor. The live prompt is a shim that says "Read and follow
   `.cursor/automations/benny/skills/<x>/SKILL.md`". It never copies the file contents and never
   points at a plugin cache path, so the committed file stays the single source of truth.
7. Before enabling, run a seven-point thread-safety test on a harmless report
   (`setup-benny/SKILL.md` §8).

### 3.2 Automation 1: triage (`triage-issue-reports/SKILL.md`)

- **Trigger:** a new top-level message in the configured source Slack channel.
- **Steps:**
  1. Freeze `SOURCE_CHANNEL_ID` and `SOURCE_THREAD_TS` as immutable values.
  2. Read the whole thread and every attachment.
  3. Trace the cause with `how`/`why` before routing, because "A visible symptom alone is not
     enough".
  4. Classify the report as bug, performance, feature request, question/feedback, or reroute.
  5. Dedupe against the tracker. A confident duplicate gets a recurrence note. A possible match is
     linked as uncertain and creates nothing.
  6. Create a ticket only if seven conditions all hold.
  7. Post **exactly one** thread reply. It ends with one marker line: `[benny:bug]`,
     `[benny:performance]`, or `[benny:other]`, optionally followed by `tracker=<url>`.
- **Tracker:** any adapter that satisfies a search/read/create/update/link/**compensate** contract.
  If the verdict post fails after a ticket was created, the run cancels that ticket.
- **Follow-up:** one follow-up window. It answers direct questions only and never emits a second
  marker.

### 3.3 Automation 2: repro and fix (`reproduce-and-fix-issues/SKILL.md`)

- **Trigger:** the same top-level report. It then **polls the thread** (`poll_seconds: 45`, up to
  `verdict_wait_minutes: 45`) for a marker from the configured triage identity. It proceeds only on
  `bug` or `performance`.
- **Ownership gates:** it stops if a person claims the fix. If an open PR or merged commit plausibly
  fixes the report, it switches to verify mode, where it measures baseline vs patched and never
  authors over the existing fix. A bot that only *diagnoses* the issue does not count as owning the
  fix.
- **Repro:** it loads the control adapter, which must provide all seven capabilities: bring up, drive
  UI, drive mapped states, read-only inspect, screenshot, record, and cleanup. It reads the matching
  feature-map section, then reproduces "the exact discriminating symptom twice through the real UI".
  Between attempts it resets state. State inspection may confirm the symptom, but "must not inject
  or force" it. A read-only media-reviewer subagent must confirm that the capture visibly shows the
  broken state.
- **Rejection window:** after one concise "reproduced" reply in the source thread, it waits
  `rejection_window_minutes: 10` for a human to say the interpretation is wrong.
- **Fix gate:** it attempts a fix only after all of these hold: a confirmed repro, media confirmation,
  no existing artifact, no human claim, a root cause backed by runtime evidence, a fix that fits the
  budget (`fix_minutes: 90`), and an adapter that can run both baseline and patched builds.
- **Fix:** it uses pstack `tdd` when the test target is cheap. The patched build must pass the same
  real-UI path twice, followed by a blast-radius smoke. The run then opens a **draft PR only** and
  never merges or deploys. Every outbound text goes through `unslop`.
- **Status:** an optional operations channel. That channel holds the only root post the workflow is
  allowed. Status emoji strings come from config.

### 3.4 Safety invariants shared by both automations

- **The coordinator is the only Slack poster.** Every child prompt must explicitly forbid
  `SendSlackMessage`, `PostToSlack`, `chat.postMessage`, and every other Slack write. A code-editing
  child is allowed only when tool isolation provably removes Slack credentials. Otherwise the
  coordinator edits. "If a child needs Slack write access to run, do not launch it."
- **No root posts in the source channel.** Before every post the run reads the thread, confirms the
  parent exists, posts with an explicit `thread_ts`, and re-reads to confirm the message landed as a
  reply. If any check fails, it posts nothing and never retries at the root.
- **Fail closed.** A missing config, adapter, feature map, coordinates, or tracker access means the
  run stops with no writes.
- **Explicit budgets** (`configuration.example.yaml`): poll 45 s, verdict wait 45 min, triage total
  30 min, repro 60 min, rejection window 10 min, fix 90 min, operations follow-up 45 min.
- **Per-role model slugs** for triage, reproduce, code, and media review. Setup forbids guessing a
  slug: use only slugs from the user's model picker.

### 3.5 Why it works

- **The marker contract decouples the two automations.** Repro trusts a fixed string from a fixed
  identity in a fixed thread instead of parsing free text, so a chatty human or another bot cannot
  trigger a fix run.
- **"Twice through the real UI, then media review" blocks the cheapest false positive**, where an
  agent declares the bug reproduced from reading code or from a single flaky observation.
- **Verify mode and the ownership gates prevent racing humans** and duplicate PRs.
- **The single-poster rule plus immutable coordinates prevent channel spam.** A subagent that is
  prompt-injected by report text cannot post either.
- **The feature map and control adapter keep app-specific knowledge in user-owned data.** The
  operational skill stays generic and refreshable.

### 3.6 Cursor-only dependencies

- **Cursor Automations:** the Slack-message trigger, the `/automate` built-in, the Automations
  editor, and an automation checkout of the committed repo.
- **Cursor Slack actions:** `prefer_cursor_actions: true`. An optional `BENNY_SLACK_BOT_TOKEN` fills
  narrow gaps.
- **Project-scoped plugin enablement** through `.cursor/settings.json`.
- The README says so outright: "benny runs on cursor automations, so it is cursor-only."

### 3.7 Closest Claude Code equivalent

There is no single equivalent. The pieces are:
- **Trigger:** a Slack app or webhook that starts a headless run (`claude -p` or Agent SDK), Claude in
  Slack, or a `/schedule` routine that polls the channel on a cron.
- **Gating:** a GitHub issue label in place of the thread marker, using the `gh` CLI. This repo
  already uses triage labels.
- **App driver:** Claude in Chrome or a Playwright/tmux harness, as in section 5.
- **Single-poster rule:** subagents without Slack tools, enforced with `PreToolUse` hooks that deny
  Slack MCP writes for subagents.
- **Isolation:** worktrees.

The design (marker contract, fail-closed preflight, twice-repro, verify mode, draft-only) is
harness-neutral and ports as text.

---

## 4. orchestrate plugin: cloud-agent tree with a script as the heartbeat

**What it is.** A skill plus a Bun/TypeScript CLI (`orchestrate/skills/orchestrate/scripts/cli.ts`,
about 14k lines including tests). It decomposes a large goal into a tree of cloud agents (planners,
subplanners, workers, verifiers) that communicate only through structured handoffs. The opening
thesis: "Long-running agent loops drift; a script with a JSON state file keeps its footing"
(`SKILL.md`). Invoked only by an explicit `/orchestrate <goal>` (`disable-model-invocation: true`).

**Authorship.** `orchestrate/.cursor-plugin/plugin.json` names the author as "Cursor". Sam Sokolin
added it (`03192a5`). poteto's commits are `e9f63ab` "stuck-escalation badge + per-viewer start time,
opus 4.8, @cursor/sdk 1.0.12", a lint fix, and the 1.1.0 version bump. pstack's playbook
reimplements the same ideas with Task-tool subagents and its own `orch` CLI
(`pstack/skills/poteto-mode/playbooks/orchestrate.md`). Compare the "Liveness and failure" section
there with `orchestrate/skills/orchestrate/references/handoffs.md`.

### 4.1 Roles (`SKILL.md`, `references/*.md`)

- **Dispatcher** (local IDE chat). One-shot. It runs
  `bun cli.ts kickoff "<goal>" [--repo] [--ref] [--model] [--slack-channel] [--dispatcher-name]`, which
  spawns a **cloud root planner** and prints `{agentId, runId, status, url}`. Then it stops.
  "Minimal-goal discipline": the dispatcher passes the goal through unexpanded so its own context
  does not leak into the planner (`references/dispatcher.md`).
- **Planner / subplanner.** Writes `plan.json`, runs the loop, reads handoffs, and publishes
  follow-ups. "Planners own scopes and publish tasks. They do no coding." Merges are published as
  worker tasks. Subplanners recurse with no depth limit.
- **Worker.** One task in its own cloud clone. It pushes its branch and ends with a structured
  handoff. It cannot ask questions mid-run: "Write each task as if you'll never get another chance to
  steer it" (`references/spawning.md`).
- **Verifier.** Defaults to its target's branch and depends on its target. "Run the code. Reading
  the diff is not verification." It must not modify target source and must not merge or open PRs
  (`prompts/verifier.md`).

### 4.2 State files (workspace `.orchestrate/<rootSlug>/`)

| File | Writer | Content |
|---|---|---|
| `plan.json` | planner | goal, summary, rootSlug, baseBranch/prBase, repoUrl, selfAgentId, slackChannel, `tasks[]` (name, type, scopedGoal, pathsAllowed/Forbidden, acceptance, verify recipe, dependsOn, startingRef, openPR, model, maxAttempts, measurements[]) |
| `state.json` | script | per-task status (`pending/running/handed-off/error/cancelled/pruned`), agentId, runId, parentAgentId, branch, verification, attempts, andon |
| `handoffs/<task>.md` | script (verbatim worker final message) | `## Status / Branch / What I did / Measurements / Verification / Notes / Suggested follow-ups` |
| `handoffs/<task>-failure.md` | script | synthetic postmortem for a silent death |
| `handoffs/<task>-finished-no-handoff.md` | script | the run ended but no `## Status` heading was found |
| `attention.log` | script | operator-visible failures, drift, unreachable tasks |
| `comment-retry-queue.json` | script | required Slack comments with backoff |

Schemas: `schemas/plan.schema.json`, `schemas/state.schema.json`, generated from `scripts/schemas.ts`.
`syncStateToGit` defaults to true, so remote observers and child agents can read state and handoffs
from git.

### 4.3 The reconcile loop (`scripts/core/loop.ts`)

- Each sweep, every 10 s, does the following in order: drain the comment retry queue, drain Andon
  events, stop spawning if Andon is active, spawn every `pending` task whose deps are `handed-off`,
  and print a one-line heartbeat (`sweep <slug>: pending=… running=…`).
- On start it calls `recoverRunning`, which reattaches to in-flight cloud runs by agentId/runId read
  from disk.
- **Exit codes:**
  - `0`: clean completion.
  - `100`: a planned checkpoint restart after `--max-runtime-sec` (default 3600). The script commits
    state to git and the caller "rerun[s] the same command immediately".
  - `1`: a new terminal error this run, which makes it "the planner's turn". In-flight workers keep
    running and reattach on the next `run`.
- Loop hygiene, which goes into every planner prompt (`prompts/loop-hygiene.md`):
  - Run `run` in the foreground, because a backgrounded loop "breaks the heartbeat when your turn
    ends".
  - After it exits, call `tree`.
  - "Don't end your turn while this workspace has non-terminal tasks."
- Downstream tasks with failed upstreams stay `pending`. They are never auto-pruned. The script logs
  each one as "unreachable".

### 4.4 Liveness and failure (`scripts/core/agent-manager.ts`, `references/handoffs.md`)

- **Spawn retries:** 3 attempts with 2 s backoff. Per-task `maxAttempts` caps automatic respawns.
- **Watchdog:** polls every 60 s and logs SSE or tool-call idleness after 5 min. At **30 min** it
  logs a `"; stuck"` attention entry and a Slack badge (`STUCK_ESCALATION_MS`, overridable via
  `ORCHESTRATE_TOOL_CALL_IDLE_MS`).
- **Failure classifier for silent deaths:**
  - `cap-hit` (70 to 80 min runtime, then terminal error) and `oom` → retry with smaller scope.
  - `network-drop` → retry as-is.
  - `tool-error` → retry on a different model.
  - `unknown` → retry once.
  - "After 2 retries on the same task, prefer abandon."
- **Verifier branch reconciliation:** after each handoff, the actual branch from the handoff's
  `## Branch` line replaces the placeholder `orch/<rootSlug>/<task>` on dependent verifiers.

### 4.5 Verification and measurement

- **Verification ladder**, persisted on the *target* task's state row:
  - `live-ui-verified`
  - `unit-test-verified`
  - `type-check-only`
  - `verifier-blocked`. The rule: "Don't report `type-check-only` for a check you didn't run
    end-to-end; that disguises an env failure."
  - `verifier-failed`

  Workers self-report. A verifier's verdict overrides the self-report. pstack's `ledger.tsv` uses
  exactly these values.
- **`measurements[]`:** after handoff, the script **re-runs each declared command on the worker's
  branch** in a temp clone (5 min timeout) and flags drift above 10% or unit mismatches in
  `attention.log` (`scripts/measurements.ts`). The worker's numbers are claims and the script checks
  them.

### 4.6 Human gates and visibility

- **Slack is visibility only:**
  - One kickoff root post, then per-task status messages mirrored in that thread.
  - Agents may leave notes with `cli.ts comment`, which validates the thread and redacts secrets,
    paths, and SHAs via `core/redact-body.ts`.
  - "If Slack is down, orchestration correctness does not change."
- **Andon:** a human adds `:rotating_light:` to the kickoff message, or someone runs
  `andon raise --reason`. Either pauses new spawns tree-wide. Children read the cached andon state
  through git. Raise it only when "continued spawning will produce garbage for the tree".
- **Operator boundary:** operator-only actions require a `~/.orchestrate/operator-mode` file that is
  owned by the user with mode `0600`. Workers can control env and argv, so environment variables are
  deliberately ignored for this check (`cli/util.ts`).
- **Steering:** `tools/nudge-root.ts` sends a follow-up message to a running cloud agent, retrying on
  `agent_busy`. `crawl` and `kill-tree` walk the lineage across subplanner branches.

### 4.7 Models (`scripts/models.ts`)

- The catalog defaults are: workers `gpt-5.5-high-fast`, verifiers `claude-opus-4-8`, subplanners
  `claude-opus-4-8-thinking-xhigh`.
- Other entries: `composer-2-fast` for bounded work, `gpt-5.3-codex-high-fast`, and `opus-max` and
  `gpt-xhigh` "reserved for exceptionally difficult tasks".
- `probe-models` checks the catalog against the backend.
- Worker and verifier defaults are different model families by design.

### 4.8 Why it works

The planner's context holds only handoffs. It never holds diffs. The loop lives in a deterministic
script, so it survives agent death and restarts from committed state. Silent deaths become readable
postmortems instead of hangs. The verification ladder stops "CI green" from being reported as
"verified". Prevented failure modes: coordinator context collapse, drift in long-running agents,
workers guessing upstream context (upstream handoffs are pasted into dependent prompts), zombie runs,
and runaway spawning on bad inputs (Andon).

### 4.9 Cursor-only dependencies

- `@cursor/sdk` `Agent.create({cloud:{repos}})` cloud VMs with roughly 70 to 80 min caps, plus
  `CURSOR_API_KEY`.
- The `ManagePullRequest` tool for `openPR` tasks.
- `cursor.com/agents` for agent links.

### 4.10 Closest Claude Code equivalent

- **Spawning:** the Claude Agent SDK, or `claude -p` headless runs, each in its own git worktree
  (`isolation: "worktree"` for in-session subagents).
- **Fully remote fan-out:** `/schedule` routines or GitHub Actions runs.
- **Reusable as-is:** the reconcile-loop pattern, the file layout, the handoff format, the failure
  classifier, and the measurement re-check are plain Bun and git. Only the spawn and wait adapter
  (`core/agent-manager.ts`) is Cursor-specific.
- **Not portable:** there is no Claude Code analogue of Cursor-hosted cloud VMs that keep running
  after the laptop closes, other than routines and Actions.

---

## 5. cursor-team-kit: the verification hands pstack calls by name

**What it is.** Eric Zakariasson's plugin (`cursor-team-kit/.cursor-plugin/plugin.json`) with 16
skills, 2 agents, and 2 rules. pstack declares the dependency: "`/deslop`, `control-cli`, and
`control-ui` ship in the `cursor-team-kit` plugin" (`pstack/README.md`,
`pstack/skills/poteto-help/SKILL.md`). The call sites are:
- `pstack/skills/poteto-mode/SKILL.md`: before commit → `deslop`. Shipping UI, IDE, or CLI → the
  matching control skill. Bug fixes reproduce first on the same surface.
- `playbooks/opening-a-pr.md` and `playbooks/autopilot-full.md`: `/deslop` before commit.
- `playbooks/multi-phase-plan.md`: "Each live lane runs on its own cloud VM at the PR head. Drive
  through `control-ui` or `control-cli`."
- `playbooks/orchestrate.md`: workers stay local, not cloud, when they need `control-ui`/`control-cli`.

The components that matter for autonomous work:

| Skill / agent | Mechanism | Prevents | Stages | Claude Code equivalent |
|---|---|---|---|---|
| `control-ui` (`skills/control-ui/SKILL.md`) | Reuse the repo's Playwright/Electron harness, otherwise a temp Playwright or `connectOverCDP` probe. Select the page by a **stable app marker**, not tab order. Loop: snapshot → one structural action → fresh snapshot → check state change. CDP for profiles, heap, network throttling. Clean up servers and profiles. | Claiming UI behavior from code reading. Clicking the wrong window. Stale element refs. | Verify | Claude in Chrome, Playwright MCP, or the same Playwright script. Fully portable. |
| `control-cli` (`skills/control-cli/SKILL.md`) | tmux session (`new-session -d`, `capture-pane`, `send-keys`) or a Python PTY probe. Wait for a concrete screen pattern, one input at a time. Node/Bun inspector for CPU and heap profiles. | Flaky sleeps. Unreproducible TUI bugs. | Verify | Same tmux/PTY recipe via Bash. Portable. |
| `verify-this` (`skills/verify-this/SKILL.md`) | Restate the claim as falsifiable (condition, metric, threshold). Capture baseline and treatment with the same command and env. Artifacts in `/tmp/verify-this/<slug>/{claim.md,baseline/,treatment/,diff/,verdict.md}`. Exactly one of `VERIFIED / NOT VERIFIED / INCONCLUSIVE`. | Recaps posing as verification. Softened negatives. | Verify | This repo's `verify` and `validate-work` skills cover the same ground. |
| `deslop` (`skills/deslop/SKILL.md`) | Diff vs main. Remove unneeded comments, abnormal defensive try/catch, `any` casts, deep nesting. Keep behavior unchanged. | AI-style noise reaching review. | Build, Review | A `/simplify`-style pass, or a copy of the prompt. |
| `loop-on-ci` / `fix-ci` / `ci-watcher` agent | `gh pr checks --json name,bucket,state,workflow,link` as the source of truth (it covers non-Actions checks too). `gh pr checks --watch --fail-fast`. `gh run view --log-failed`. One cause per fix. No `--no-verify`. Retry flakes once and report them. `ci-watcher` is `model: fast`, `is_background: true`. | Judging readiness from Actions alone. Bypassing hooks. | Verify, Merge, Operate/Monitor | Background Bash or the Monitor tool with `gh pr checks --watch`, or `/loop`. pstack's own `watch-pr` CLI supersedes these. |
| `review-and-ship`, `new-branch-and-pr`, `fix-merge-conflicts`, `make-pr-easy-to-review`, `get-pr-comments`, `check-compiler-errors`, `run-smoke-tests` | Short `gh`/git checklists. `make-pr-easy-to-review` checks that the tree hash is unchanged after a history rewrite (`ORIGINAL_TREE=$(git rev-parse origin/<head>^{tree})`). | Unreviewable PRs. History rewrites that silently change code. | Review, Merge | `gh` CLI. Portable. |
| `workflow-from-chats` | Mines 7 days of parent and subagent transcripts for "preference atoms" (trigger, step, rule, quality bar, stop condition, confidence) and picks an artifact: skill, rule, doc, or none. | Corrections that never become structure. | Learn; Memory | The same thing over `~/.claude/projects/*.jsonl`. Close to pstack `/reflect` and `/automate-me`. |
| `what-did-i-get-done`, `weekly-review` | Git-log summaries by author email. | none relevant | Operate/Monitor (reporting) | `git log`. |
| `thermo-nuclear-code-quality-review` (skill and agent) | Maintainability rubric: "code judo", the 1k-line file rule, no spaghetti conditionals. The parent collects the diff and file contents, then calls the agent. Moved to `thermos` (see section 9). | Merging working but messier code. | Review | Subagent with the rubric. |
| Rules `typescript-exhaustive-switch`, `no-inline-imports` | `.mdc` always-on rules. | Style drift. | Build | CLAUDE.md lines. |

**Cursor-only bits:** the `.mdc` rule format, and `ci-watcher`'s `model: fast` and `is_background`
frontmatter. Everything else is `gh`, git, Playwright, and tmux.

---

## 6. ralph-loop: stop-hook re-prompt until a promise appears

**What it is.** The Cursor port of Geoffrey Huntley's "Ralph Wiggum" technique
(`ralph-loop/README.md`). Manifest author "Cursor". Not poteto's. pstack never references it.

**Mechanism.**
- The `ralph-loop` skill writes `.cursor/ralph/scratchpad.md` with YAML frontmatter
  (`iteration`, `max_iterations`, `completion_promise`) followed by the prompt.
- `hooks/capture-response.sh` (`afterAgentResponse`) extracts `<promise>…</promise>` from the reply.
  If the text equals the configured phrase, it touches `.cursor/ralph/done`.
- `hooks/stop-hook.sh` (`stop`, `loop_limit: null`) decides what happens at the end of each turn:
  - It exits if there is no scratchpad, the done flag exists, or `iteration >= max_iterations`, and
    deletes the state when it stops.
  - It also stops on a corrupt state file.
  - Otherwise it increments `iteration` atomically (temp file plus `mv`) and emits
    `{"followup_message": "[Ralph loop iteration N. To complete: output <promise>X</promise> ONLY when genuinely true.]\n\n<prompt>"}`.
- `cancel-ralph` deletes `.cursor/ralph`.

**Why it works.** "The prompt never changes. The code does." Each iteration re-reads the working tree
and git history instead of a growing chat, so state lives on disk. The promise tag gives a checkable
exit, and `max_iterations` is the runaway guard. **Weakness:** the done signal is the model's own
claim. Nothing verifies the promise. pstack's done predicates and independent verifiers are stricter
on exactly this point.

**Stages:** Build, Verify. Liveness (keeps a session alive). Cost (iteration cap).
**Cursor-only:** the `followup_message` stop-hook output and the `afterAgentResponse` event.
**Claude Code equivalent:** a `Stop` hook that returns `{"decision":"block","reason":"<prompt>"}`
continues the session with the reason as the next instruction. The transcript is available to the
hook, so the promise check can happen there. `/loop` covers interval-driven re-runs. Anthropic's own
Claude Code plugin set includes a Ralph-style plugin built on the Stop hook.

---

## 7. continual-learning: hook-cadenced AGENTS.md memory

**What it is.** Eric Zakariasson's plugin (`continual-learning/.cursor-plugin/plugin.json`). It
consists of a stop hook, an orchestration-only skill, and an `agents-memory-updater` subagent.

**Mechanism** (`hooks/continual-learning-stop.ts`, run with Bun on every `stop`):
- **Counting:** it counts a turn only when `status == "completed"` and `loop_count == 0`, so its own
  follow-ups do not count. It dedupes by `generation_id`.
- **Trigger:** it fires when all three hold: at least **10 turns** since the last run, at least
  **120 min** since the last run, and the transcript mtime has advanced. Trial mode uses 3 turns and
  15 min for 24 h. Env overrides are `CONTINUAL_LEARNING_MIN_TURNS` and related variables.
- **Firing:** it emits a `followup_message` telling the agent to run the `continual-learning` skill
  via the subagent.
- **Cadence state:** `.cursor/hooks/state/continual-learning.json`.
- **Subagent** (`agents/agents-memory-updater.md`, `model: inherit`):
  - It reads `AGENTS.md`, then only the transcripts under
    `~/.cursor/projects/<slug>/agent-transcripts/` that are new or have a newer mtime than in the index
    `.cursor/hooks/state/continual-learning-index.json`.
  - It updates two sections, `## Learned User Preferences` and `## Learned Workspace Facts`, with at
    most 12 plain bullets each. It edits in place and dedupes semantically.
  - It never writes evidence or confidence tags, and it excludes secrets and one-offs.
  - If nothing changes, the reply is exactly `No high-signal memory updates.`

**Why it works.** The cadence and mtime gates keep the cost bounded and avoid churning on every turn.
The incremental index avoids re-mining old transcripts. The bullet cap and in-place edits stop the
memory file from growing without bound, which is the usual way auto-memory degrades.

**Stages:** Learn; Memory. **Cursor-only:** the `stop` hook's `followup_message`, the transcript
location, and `AGENTS.md` as the memory target.
**Claude Code equivalent:** a `Stop` hook that keeps the same cadence state and blocks with "run the
memory updater" when its thresholds are met. The updater is a subagent that reads
`~/.claude/projects/<slug>/*.jsonl` and writes CLAUDE.md. Claude Code's built-in memory covers part
of this. Compared with pstack's `/reflect` and `/correct`, this plugin is automatic and shallow,
while pstack's are on-demand and judgment-heavy.

---

## 8. advisor: hook-enforced "consult a stronger model before done"

**What it is.** A Cursor-authored plugin (`advisor/README.md`). Not poteto's, though it matches her
"verdicts from a different model" idea.

**Mechanism.**
- **Skill:** `/advisor [model|off|status|ask …|nudge on|off]`. It writes
  `.cursor/advisor/state.json` (`enabled`, `model`, `nudge`, `advisor_agent_id`, `conversation_id`,
  `transcript_path`, `consults`) and defines four checkpoints:
  - before a major decision (migrations, deletions, public API, auth or payments, dependency swaps)
  - when stuck (the same error after two genuine attempts, or about to add a retry, sleep, broad
    except, or skipped test)
  - before declaring done
  - on request

  It allows about 4 consults per task. More than that suggests the task should be split.
- **Agent** `advisor-subagent`: `readonly: true`, `model: grok-4.6[effort=xhigh]` by default.
  - It verifies the briefing against the repo, reads the transcript when given one, and does not
    spawn subagents.
  - It returns `Verdict: proceed | proceed with changes | stop`, followed by Why, Recommendations,
    Risks, Answers, and Confidence.
  - It is resumed via `advisor_agent_id`, so later briefings can be deltas.
- **Hooks** (`advisor/hooks/hooks.json`):
  - `afterFileEdit` → `mark-pending.sh` touches `pending`.
  - `afterAgentResponse` → `capture-response.sh` keeps the last 400 chars of the reply.
  - `subagentStop` (matcher `^advisor-subagent$`) → `record-consult.sh` increments `consults`,
    clears `pending`, and appends to `log.md`.
  - `stop` (`loop_limit: 3`) → `stop-hook.sh`. If edits are pending and the last reply did not end
    in `?`, it emits one `[Advisor] … run the pre-completion consult now` follow-up per batch of edits.
- **Conversation binding:** all hooks bind to the first conversation that touches the state, and
  ignore other chats.

**Why it works.** The stop hook makes "verify with a second model before done" structural instead of
relying on the agent remembering. The `?` check avoids nagging while the agent waits on the user.
Logging every consult to `log.md` leaves an audit trail.

**Stages:** Plan, Verify, Review; Models, Human gates (the `stop` verdict sends product questions back
to the user), Cost.
**Cursor-only:** the `afterFileEdit`/`afterAgentResponse`/`subagentStop` hook events, the stop
`followup_message`, cross-family models (Grok) for subagents, `readonly: true`, and `resume`.
**Claude Code equivalent:**
- `PostToolUse` (matcher `Edit|Write`) to mark pending.
- `SubagentStop` to log consults.
- `Stop` with `decision: block` to nudge.
- A read-only subagent with `model: opus` and an `effort` setting.

Cross-family consults need an MCP bridge or a CLI call out to another vendor. Otherwise the second
opinion is another Claude model.

---

## 9. thermos: parallel adversarial branch review

**What it is.** A Cursor-authored plugin. Eric Zakariasson's commits moved the code-quality rubric
here from `cursor-team-kit` (`thermos/README.md`, "Migration from cursor-team-kit").

**Mechanism.**
- `skills/thermos/SKILL.md` gathers the diff and file context once, then launches
  `thermo-nuclear-review-subagent` and `thermo-nuclear-code-quality-review-subagent` **in the same
  message with `run_in_background: true`**.
- It synthesizes the results deduplicated. It weights findings both reviewers raised more heavily
  and resolves disagreements with its own judgment.
- `thermo-nuclear-review` is a security and correctness audit of added or modified code only, with
  sections on devex breakage, feature-flag leaks, intended breakage, and over-reporting. It **checks
  Bugbot and other PR comments only after its own audit**, "so you have fresh eyes".
- The manifest description mentions "optional take-the-wheel and FSD merge-ready flows". No such
  files exist in this commit.

**Why it works.** Two rubrics running in parallel with separate contexts cover different failure
classes. Reading bot comments last avoids anchoring the review on them.

**Stages:** Review. **Cursor-only:** none of substance (subagent frontmatter and Bugbot comments).
**Claude Code equivalent:** two `Agent` calls in one message, which is what this repo's `code-review`
skill already does with its Standards and Spec reviewers.

---

## 10. dyl-stack `dyl-ready-pr` (context only)

Dylan Gattey's layer over pstack (`dyl-stack/README.md`). It requires pstack, cursor-team-kit, and
thermos, which is the clearest statement in the repo of how these plugins compose.
`skills/dyl-ready-pr/SKILL.md`:
- Phase 1 is "deep `/dyl-review` till green", capped at 4 passes.
- Phase 2 runs **pstack's Babysit playbook in `drive` mode**, plus mark-ready, resolve conflicts
  without force-push, and a wait for Bugbot. A missing Bugbot result 30 min after the later of push
  and ready is a stop.
- It "Never merges".

**Stages:** Review, Merge; Human gates. It shows Bugbot as the Cursor-only dependency in the merge
gate.

---

## 11. Other top-level plugins (one line each)

- **`cli-for-agent`** (Eric Zakariasson): guidance for designing agent-drivable CLIs (non-interactive
  flags, `--dry-run`, idempotency, actionable errors). Indirectly relevant, because pstack's
  `watch-pr` and `orch` CLIs follow the same pattern. It is a design reference, not a runtime piece.
- **`pr-review-canvas`** (Cursor; also a skill inside cursor-team-kit): renders a PR as an HTML or
  Canvas walkthrough with core, wiring, and boilerplate tiers. Useful for morning review of overnight
  PRs, but it is human-facing presentation and not part of the loop.
- **`agent-compatibility`** (Cursor): scores how well a repo supports agents (startup, validation
  loop, docs reliability) with a CLI and four review agents. Useful once before automating a repo.
  It is not a loop component.
- **`cursor-sdk`** (Cursor): reference for `@cursor/sdk` (local vs cloud runtime, `autoCreatePR`,
  `skipReviewerRequest`). It is required reading for `orchestrate`, and only matters through it.
- **`create-plugin`, `docs-canvas`, `origin-apps`, `teaching`, `grok-voice`**: plugin scaffolding,
  docs rendering, the Origin forge API (pstack's Shipping can use Origin instead of `gh`, already
  covered), learning plans, and voice features. None of them is part of the dev loop.
- **`third_party/*`** (about 90 SaaS connectors, including `github` and `playwright`): MCP connectors.
  The `playwright` connector is an alternative driver for `control-ui`. The rest are irrelevant here.
- **`harness/pstack`**: the generated Claude Code build that `pstack-mechanics.md` already analysed.

---

## 12. Mapping table: Cursor-only dependency → Claude Code stand-in

| Cursor feature | Used by | Claude Code stand-in | Gap |
|---|---|---|---|
| Automations (Slack or webhook trigger, `/automate`, editor) | benny, `make-bot-ui` | `/schedule` routines (cron), GitHub Actions, or an external webhook that launches `claude -p` or the Agent SDK | Event triggers need your own plumbing |
| Cloud agents via `@cursor/sdk` | orchestrate, pstack Orchestrate workers | Agent SDK or headless runs in worktrees, routines, Actions | Laptop-independent long VMs |
| Stop hook `followup_message` | ralph-loop, continual-learning, advisor | `Stop` hook `decision: block` + `reason` | None material |
| `afterFileEdit` / `afterAgentResponse` / `subagentStop` | advisor, ralph-loop | `PostToolUse`, `Stop`/transcript read, `SubagentStop` | None material |
| Cross-family subagent models (Grok, GPT) | advisor, orchestrate catalog, pstack panels | `model: opus/sonnet/haiku`, or an MCP bridge to another vendor | Same-family diversity only |
| Bugbot | thermos, dyl-ready-pr, pstack Babysit | Third-party review bots or a review subagent; their comments are ordinary threads to `gh` | No native PR bot |
| `readonly: true` subagents | advisor, benny workers | Agent tool allowlists plus `PreToolUse` deny hooks (this repo's `verifier` agent already does this) | None if hooks are used |
| Slack actions with single-poster rule | benny, orchestrate | Slack MCP in the coordinator only; deny hook for subagents | None if hooks are used |
| Transcripts `~/.cursor/projects/<slug>/agent-transcripts/` | continual-learning, workflow-from-chats, advisor | `~/.claude/projects/<slug>/*.jsonl` | Format differs |

---

## 13. Observations for a rebuild

- The pieces poteto authored or co-maintained (benny, orchestrate's watchdog, pstack's playbook)
  share one stance:
  - Loops are scripts with state files in git. The agent handles judgment and the script handles
    liveness.
  - Every stage ends in a machine-readable contract: a verdict marker, a `## Verification` value, or
    a ledger row.
  - Silence becomes a synthetic postmortem.
- The re-prompt plugins (`ralph-loop`, `continual-learning`, `advisor`) are all one primitive: a stop
  hook that refuses to let the turn end until a file-backed condition holds. In Claude Code that is
  one `Stop` hook per concern.
- Only two things here are hard to reproduce in Claude Code: **event-triggered automations**
  (benny's Slack trigger) and **cross-family verifiers**. Everything else is text, `gh`, git, Bun, and
  hooks.
