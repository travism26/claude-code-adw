# Verification-skill generator and maintainer (`create-` / `maintain-verification-skill`)

**Source workflow:** Poteto (pstack 0.15.28, plus `cursor-team-kit` drivers)  **Stages:** Verify, Learn (also Liveness via Doctor, Isolate via per-checkout instances, Memory via the feature map)
**Primary sources:** read in full, nothing executed.
- `PS` = `~/.claude/plugins/cache/cursor-plugins/pstack/0.15.28/`
  - `PS/skills/create-verification-skill/SKILL.md` (**CVS**), plus `references/feature-map-example/{README,create-note,search}.md` (**FME**)
  - `PS/skills/maintain-verification-skill/SKILL.md` (**MVS**)
  - `PS/skills/create-formal-verification-skill/SKILL.md` (**CFV**) and `PS/skills/maintain-formal-verification-skill/SKILL.md` (**MFV**). Used only where they clarify the design.
  - `PS/skills/principle-prove-it-works/SKILL.md` (**PIW**) and `PS/skills/principle-build-the-lever/SKILL.md` (**PBL**)
  - `PS/docs/guide/06-verify-and-ship.md` (**G06**) and `PS/docs/harness/claude-code.md` (**ADAPT**)
  - Consumers: `PS/skills/setup-pstack/SKILL.md` §7, `PS/skills/poteto-help/SKILL.md`, `PS/skills/poteto-mode/playbooks/{shipping,autopilot-full,multi-phase-plan}.md`
- `~/code/plugins/cursor-team-kit/skills/{control-ui,control-cli,verify-this}/SKILL.md` (**CUI**, **CCLI**, **VT**)
- `poteto/verification-skill-example@d5abe70` (2026-07-30), cloned to `/tmp/dissect-vs/repo` (**VSE**). Files read: `README.md`, `.cursor/skills/verify-atlas/SKILL.md`, `references/features/{README,prompt-box,multi-surface-journeys}.md`.
- Port targets in this repo: `.claude/skills/verify/{SKILL,PROBES}.md`, `.claude/agents/verifier.md`, `.claude/hooks/verify_guard.py`, `.claude/skills/validate-work/SKILL.md`, `adws/pipelines/{gates,ship_gate}.py`.

**Builds on, does not repeat:** [skills-comparison.md](../../verification/skills-comparison.md) §4–§6 (the protocol/recipe split, first-pass stack notes, improvements 1–14), [how-she-develops.md](../../workflows/poteto/how-she-develops.md), [repos-and-evolution.md §4](../../workflows/poteto/repos-and-evolution.md) (the example repo's surface and lineage), and [cursor-native-pieces.md](../../workflows/poteto/cursor-native-pieces.md) (the control-skill table).

**Labels:** **[F]** = stated in a file. **[I]** = this doc's inference.

---

## 1. What it is

`create-verification-skill` is a one-shot, user-invoked generator. It reads a repo and writes a project-local skill, `verify-<app>`, that tells a cold agent how to launch this app, check that the instance is worth driving, drive it the way a user would, capture proof, and tear it down. It also writes a **feature map**: one file per user-facing feature, each saying how a user reaches it, the exact harness commands, and the end state that proves it works. Before handing over, the generator must run its own output once end to end. `maintain-verification-skill` is the upkeep loop. Parallel source readers check each feature file against the code, then one live session drives every feature, and the pass ends `clean`, `changed` (one PR of proven corrections to the skill directory only), or `blocked`. The problem they remove is that **every verification run starts by rediscovering how to boot and drive the app**. Agents then guess, take cheap shortcuts ("it compiles", "the page opened"), or hand the check back to a human. This repo already shows that failure: the `verify` skill says to write `.claude/verify-recipe.md` when launch took real work, and no recipe was ever written ([skills-comparison §4](../../verification/skills-comparison.md)).

## 2. Where it lives

| File | Role |
|---|---|
| CVS | The generator. Five steps: interview the repo, generate the skill, seed the map, prove it once, offer maintenance. `disable-model-invocation: true`, so only the user starts it. |
| FME (`README.md`, `create-note.md`, `search.md`) | The output contract by example. The README holds baseline preconditions, driving conventions, proof and skip rules, and the "feature entry contract" (four H2s in a fixed order). The two feature files show labelled bullets that pair user action, exact command, and observable result. |
| MVS | The maintainer. Outcomes, edit scope, a 7-step pass (0–6) with three live-pass invariants. Also user-invoked. |
| CFV / MFV | The formal pair. They add two ideas the UI pair lacks: a **sync commit** per check and "**able to fail**" (show the check failing on a broken variant). |
| PIW | The principle behind it all: "Verify against the real artifact … not a proxy, self-report, or 'it compiles.'" Also: "The strongest proof is a deterministic script that re-runs the same comparison." |
| PBL | Why a control CLI exists: "Build the tool that does it or proves it … The tool is the artifact a reviewer can rerun." |
| G06 | The user-facing rationale. It adds the **control-CLI traits** list and the cadence ("at least once a day, ideally from a scheduled automation"). |
| VSE | A fictional, full-size output for "Atlas", an Electron app driven over CDP. One `SKILL.md`, a map README and 34 feature files (1,120 lines in the map). The driver `control-atlas.mjs` is omitted on purpose. It shows what a mature generated skill looks like after many maintain passes: per-checkout isolation enforced by the CLI, a proof bar, a sweep order. |
| CUI / CCLI / VT (cursor-team-kit) | The **generic** drivers. The generator's "generic recipe" fallback (browser/CDP, tmux/PTY, HTTP) is these skills. pstack's Shipping and autopilot live lanes name these, not `verify-<app>` (§10). |
| `setup-pstack` §7, `poteto-help` | Discovery. Setup offers the generator once if no `verify-*` skill exists. Help mentions it when a question is about proving a change works. |
| ADAPT | Maps Cursor paths to Claude Code: `.cursor/skills/verify-<app>/` becomes `.claude/skills/verify-<app>/`. |

## 3. How it works, step by step

### 3.1 `create-verification-skill`

**Input:** a checkout. No arguments. **Output:** `.cursor/skills/verify-<app>/SKILL.md`, `features/README.md`, 3–5 `features/<feature>.md`, plus any helper scripts. **Gate:** one end-to-end run of the generated skill.

1. **Interview the repo, not the user** (CVS §1). Five questions, answered from the code. "Only ask the user what you cannot observe."
   - *Surface*: web UI, CLI/TUI, desktop, API, mobile, library. "Pick the primary one and note the rest."
   - *Run*: "Prefer the repo's own documented dev command." Note ports, env vars, seed data, auth.
   - *Drive*: "Existing harnesses first — Playwright/Cypress specs, expect scripts, PTY helpers, curl-able endpoints, a debug port. Only then pick a generic recipe." The generic recipes are exactly CUI (browser/CDP), CCLI (tmux/PTY), and plain HTTP.
   - *Observe*: screenshots, transcripts, response bodies, logs, exit codes, DB state.
   - *Isolate*: "can two instances run side by side?" If not, the generated skill must say so: "refusing to double-drive a shared instance beats corrupting the user's session."
   - **Precondition gate:** "If the checkout doesn't build or start as-is, fix that first (or report it precisely)." A missing asset that blocks startup may be created "clearly marked as verification scaffolding, and remove[d] in cleanup."
2. **Generate the skill** (CVS §2). Frontmatter `name: verify-<app>` plus a description naming app, surface and trigger ("without frontmatter the skill never registers"). "No placeholders left." Six required sections:
   - **Launch.** The exact command, the readiness signal, and teardown. "Launch must reach a usable state from an empty data dir, including any migrations and seed data. Ready means usable, not just that a process answers. A database health check can pass while its init scripts are still running." For short-lived CLIs: build once, then "start each drive in its own isolated PTY or tmux session."
   - **Doctor.** "One read-only check that answers 'is this instance worth driving?' — process up, right version/build, port owned by us, auth valid. An agent runs this first whenever anything looks off."
   - **Drive.** "Real selectors/commands from this repo, not examples. Prefer stable handles (ARIA labels, data attributes, prompt strings, route paths) over coordinates and tab order."
   - **Evidence.** This section holds the **proof bar** (3.3).
   - **Cleanup.** "Never kill by process name; kill what you started. Cleanup removes instances and scratch state, never the evidence."
   - **Helpers.** "Any script the skill ships is executable and its invocation is shown in the skill body. A helper the reader has to reverse-engineer is not a helper."
3. **Seed the feature map** (CVS §3). `features/README.md` plus one file per feature, "the top 3-5 to start, from routes, commands, menus, or docs". Each file has an H1, a one-paragraph user-visible description, then exactly four H2s in this order (FME README "Feature entry contract"):
   1. `Sub-features`: short IDs, one line each (`create-save`, `search-empty`).
   2. `How to get to it (user POV)`: **every** user entry point (button, keyboard chord, CLI command).
   3. `Driving it with <harness>`: starts with `Preconditions:`, then labelled bullets. Each bullet pairs a user action with an exact command and an observable result. Example: "**Save note.** Choose `Save note`. Run `control-notes browser click --role button --name "Save note"`. A status named `Note saved` appears and the heading reads `Release checklist`." (FME `create-note.md`)
   4. `Gotchas`: traps that waste or invalidate a run ("A save status alone is insufficient proof. Reopen the note from the list.").

   Two rules make the map an oracle, not documentation. First: "If the seed data lacks a precondition that a journey needs, the journey reports a failure and the reason goes in that feature's `Gotchas`. **Never weaken the journey to make it pass.**" Second: "a proof that drives one convenient entry point is incomplete when the map lists others." The README adds "Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof."
4. **Prove the generated skill** (CVS §4). Run "its own instructions end to end once: launch, doctor, drive ONE mapped feature …, capture evidence, clean up. After cleanup, confirm the evidence still exists at the named location — a cleanup that eats the proof fails this step." Run the generated cleanup "after every failed iteration too". **"A generated skill that was never executed is a draft, not a deliverable."** Stand-in rule: if proved in a container instead of a fresh VM, "list every setup step the stand-in did that the target will not. Those steps stay unverified."
5. **Offer the maintenance loop** (CVS §5). Point at `/maintain-verification-skill`. "Suggest a cadence only if they ask." G06 itself says daily, scheduled.

### 3.2 The control CLI (the lever)

The generator does not require a CLI. It requires helpers that are executable and documented. The CLI is the next rung, from G06: "When agents keep writing throwaway scripts to click through the app, ask for a small control CLI that the skill calls instead. Agents spend fewer tokens, and every run becomes repeatable." Its six traits [F, G06]:

- a few composable commands that each do real work;
- `--dry-run` on anything destructive;
- subcommands that reveal features gradually;
- error messages that say what to do instead;
- rich `--help`;
- machine-readable output such as JSON.

VSE shows the mature form (`verify-atlas/SKILL.md`). These are design moves the generator text does not spell out:

- **`--help` is canonical.** The skill lists command *categories* (Inspection, Navigation, Interaction, Performance, Streaming, Health & cleanup) and a few examples. The CLI is the source of truth for flags, so the skill can't drift on flag names.
- **Isolation is enforced by the tool.** `test -f .git` tells a worktree from the main checkout. In a worktree, "every command takes `--checkout` so the port and user-data-dir are derived for this tree", and "a connect/launch command without `--checkout` (and without an explicit `--cdp`) is refused." The skill's "never double-drive" line becomes an exit code.
- **Doctor reports the four failure causes by name:** "checkout context, who owns the CDP port, watcher liveness, and build freshness." The map README turns that into a precondition: "clear `STALE BUILD` / wrong-instance warnings before driving."
- **Deterministic waits are a command.** `wait-settle`, "not fixed sleeps." This matches CCLI ("Prefer deterministic waits over sleeps").
- **The escape hatch is fenced.** `eval` exists, but "Use `eval` to inspect state after the user path ran, not to invoke internal handlers as the primary proof", and "The command service is not on `window`. Do not invoke `atlas.*` through `eval`."
- **Gated paths have a command.** `feature-flag rooms_v2 on`. Flipping flags is part of the driver, not a source edit.

FME shows the same idea at small scale. `control-notes` has `doctor`, `browser click|fill|press|snapshot --aria|screenshot`, and a `cli -- <command>` passthrough. Every command uses `--role`/`--name`, so no feature file needs CSS selectors.

### 3.3 The proof bar

The bar is spread across CVS §2 Evidence, the FME README, and VSE's "Proof bar". Merged and de-duplicated:

1. **Real user path.** "Exercise the real user path, not internal setters or test-only endpoints" (CVS). "Do not submit 'look, it opens' captures" (VSE).
2. **Action and resulting state.** "Capture the action and the resulting state, not just the final screen" (CVS). "Show the trigger and the stable end state in the same recording" (VSE).
3. **Side effects, read back.** "Verify side effects (files written, rows inserted, messages sent) alongside what's visible" (CVS). "Mutation proof includes a read-only second view of the stored value" (FME). VSE adds "DOM attributes, clipboard, network/RPC log, file contents, or a reload / switch-away round trip."
4. **Mocks only behind a production boundary.** "Mocks only where a production boundary already isolates the external system" (CVS). VSE sharpens it: mocks "do not count when they skip the renderer, a workbench service, an RPC, persistence, or the tool path under test."
5. **Dry-run is observed, not trusted.** "Verify what it actually skips by observing (files, network, git refs) rather than trusting its name: some dry-runs still touch the network or open a browser" (CVS).
6. **Fresh build.** "A video against a stale bundle is not evidence" (VSE). This is why Doctor checks version/build.
7. **Coverage set is the feature file.** "Exercise every reachable entry point, mode, enabled gated variant, and the success / cancel / error / empty / persistence paths the change can affect" (VSE, map README).
8. **Per-surface artifact minimums** (FME README): UI = ARIA snapshot plus screenshot "with the app identity visible". CLI = command, stdout, stderr and exit code. Each artifact records "the feature ID and entry point used".
9. **Honest skips.** "Report an unreachable path with the attempted command and the unmet precondition. Do not report a skipped entry point as verified through a different path" (FME). VSE: name the blocker class ("account, OS, entitlement, or native driver") "and cover the closest real path that remains."

### 3.4 `maintain-verification-skill`

**Input:** an existing verify skill with a feature map. **Output:** one of `clean` (no branch, no PR), `changed` (one PR), `blocked` (no PR, blocker named). **Edit scope:** the skill's own directory only. "Never edit product code during a run."

0. **Locate.** Find `.cursor/skills/verify-*/` with launch/drive sections and a map. Several → ask. None → "stop and point at `/create-verification-skill` instead of inventing a target."
1. **Index hygiene.** Read the README, glob siblings, and fix missing, extra, duplicate or dead entries. "No generated inventory."
2. **Source wave.** "One read-only subagent per feature file, launched concurrently." Each explains how the feature works from source, flags drift with citations, and returns one recipe. Return shape: "feature summary / source entry points / likely drift or none / one recipe." Children "never drive the app and never edit files."
3. **Reconcile.** Every feature file has a summary back. Merge recipes "into as few app states as practical." "Spot-check cited drift; don't re-prove clean claims." Sweep recent churn for unmapped surfaces, but "require a concrete source path before calling one missing."
4. **Live pass.** "Required even when source looks clean." Only the coordinator drives, following the skill's own launch model (one long-lived instance driven serially, or a fresh session per drive for short CLIs). "Exercise every feature at least once." Three invariants hold the whole pass:
   1. Never drive an unhealthy instance. Doctor runs before the first drive, on each fresh session, and after any failed drive. Where Doctor can't see the failure ("a wedged UI state on a healthy process"), reset or relaunch "rather than hoping".
   2. "Evidence captured so far survives every cleanup, checked at its named location, not assumed."
   3. "Nothing a drive started outlives that drive's usefulness". For a shared instance, "clean the residue, not the instance."

   A Doctor failure *caused by skill drift* is drift: fix it, then "retry once — restart whatever the fix invalidated, nothing more — before calling the pass `blocked`." `verified-unreachable` needs "the concrete prerequisite … and the route attempted". If the map omits that prerequisite, that is drift. "Any harness fix from triage gets re-driven live before it ships." Final teardown happens after the last re-proof.
5. **Triage** into three bins:
   - **Doc drift** (wrong or missing user-POV description): fix the map.
   - **Harness gap** (behavior works but the harness can't drive it): fix the harness, under the same Helpers rule.
   - **Product gap** (the app is actually broken): record it for the user, "keep it out of this PR."
6. **Ship or stop.** `changed` re-reads every changed file before the PR. Run notes stay in scratch, uncommitted.

### 3.5 What the formal pair adds

CFV/MFV are the same pattern with stronger bookkeeping. Two of their rules plug holes in the UI pair:

- **Sync commit.** "Record which files and functions each check covers, and the commit at which you last confirmed that the verification describes them" (CFV). Maintenance diffs covered files "from the sync commit to the current commit" and moves it "only after it confirms" (MFV step 3, step 6). The UI maintainer has no recorded baseline. It sweeps "recent churn" with no defined window.
- **Able to fail.** "A check that you have never seen fail proves nothing. Show each property failing on a broken variant" (CFV). After an update that passes, MFV step 5 breaks the new code again to confirm the check still catches it. The UI generator's proof only shows the skill can PASS. Nothing shows that Doctor or a feature recipe can FAIL.

MFV also separates a finding about the code from drift in the verification, the same split as MVS's product gap vs doc drift: "Say outright which failures were drift in the verification and which were bugs in the code."

## 4. Why it works

| Rule | Failure mode it prevents | Weight |
|---|---|---|
| **"Interview the repo, not the user"** plus existing harnesses first (CVS §1) | A generic recipe that ignores the repo's real Playwright config, seed scripts and auth fixtures. Also, the user as the bottleneck. | High |
| **"Never executed = draft"** with the evidence-survives-cleanup check (CVS §4) | Instructions that read right but don't run: wrong port, missing migration, cleanup that `rm -rf`s the artifacts dir. Plausible prose is exactly what an LLM generator produces. Running the output is the only filter. | **Load-bearing** |
| **Ready means usable** (CVS §2 Launch) | Driving an app whose DB init is half done. Every failure then looks like a product bug. | High |
| **Doctor checks version/build and port ownership** (CVS §2; VSE "stale bundle") | Verifying the wrong code: a server left over from another worktree or a stale bundle. This is the silent false PASS that is hardest to notice. | **Load-bearing** |
| **Stable handles, real selectors** (CVS §2 Drive; CUI) | Flaky drives from coordinates and tab order. Recipes copied from examples that don't exist in this repo. | High |
| **Proof bar: real path, action + state, side-effect read-back** (3.3) | "Look, it opens" proofs. Toast-only proofs where nothing persisted. Proofs through `eval` or test endpoints that skip the code under test. | **Load-bearing** |
| **Every entry point; skipped entry ≠ verified via another** (CVS §3; FME) | The agent proves the easiest route (CLI) and claims the feature (keyboard chord broken). | High |
| **"Never weaken the journey to make it pass"** (CVS §3) | The generator or maintainer edits the oracle to fit a broken app. Same instinct as weakening a test. | High |
| **Kill what you started, never by name** (CVS §2) | Killing the user's own dev server or IDE. Orphaned wrapper children (`npm` → `node`). | Medium |
| **Map is user-POV, no implementation detail** (FME README) | A map that rots with every refactor and that the agent can satisfy by reading code. It stays valid until *behavior* changes. | High |
| **Four fixed H2s** (FME) | Inconsistent files that a maintainer can't diff, and agents can't jump to the section they need. It also makes the map lintable [I]. | Medium |
| **Maintain: live pass required even when source looks clean** (MVS step 4) | Source readers agree with the map because both describe intent. Only driving shows the selector moved. | **Load-bearing** |
| **Maintain: edit scope = skill dir; product gaps reported, not papered over** (MVS) | A doc edit that hides a regression ("feature X no longer saves" turned into "X saves on reload"). | **Load-bearing** |
| **Doctor again after any failed drive** (MVS invariant 1) | One wedged state cascades into N false failures (or N false passes on a reset app). | High |
| **Control CLI with refusal defaults** (G06; VSE `--checkout`) | Instructions alone don't stop an agent from attaching to the user's main session. A refusing exit code does. This is pstack's "encode lessons in structure" applied to the driver. | High |
| **Parallel read-only source readers, one live driver** (MVS steps 2, 4) | Source reading is cheap and parallel. Driving shares one instance and must be serial. Splitting them keeps cost down without racing the app. | Medium |

The heavy lifters are four: **execute-before-handover**, **Doctor binds instance to build**, **the proof bar**, and **maintenance that must drive live and may not edit product code**. Everything else improves cost or flake rate.

## 5. Edge cases and failure handling

| Situation | What the sources say | Gap [I] |
|---|---|---|
| Checkout won't build or start | "Fix that first (or report it precisely)" before generating (CVS §1). | "Fix that first" lets the generator edit product code, which MVS forbids. For ADW: report, don't fix. |
| Irrelevant missing asset blocks startup | The skill may create it as marked scaffolding and remove it in cleanup (CVS §1). | None. |
| Two instances can't coexist | The skill must say so and refuse to double-drive (CVS §1). VSE refuses in the CLI. | Text-only refusal in CVS. Structure arrives only once there is a CLI. |
| Seed data lacks a journey's precondition | The journey reports failure, and the reason goes in `Gotchas`. Never weaken (CVS §3). | None. |
| Proof run fails | Fix, and run the generated cleanup after every failed iteration (CVS §4). | No iteration cap (cf. ADW's two-cycle cap). |
| Proved on a stand-in (container instead of VM) | List the steps the stand-in did that the target won't. They stay unverified (CVS §4). | None. Strong rule. |
| Cleanup deletes evidence | The proof step fails (CVS §4). MVS invariant 2. | None. |
| Only one feature proven at handover | Accepted: "one is enough; the map exists so later runs can cover the rest" (CVS §4). | The other 2–4 feature files are **unexecuted drafts** inside a "proven" skill. Nothing marks them until the first maintain pass. |
| No verify skill to maintain | Stop and point at the generator (MVS step 0). | None. |
| Several candidates | Ask (MVS step 0). | None. |
| Doctor fails because the skill drifted | Fix under edit scope, retry once, else `blocked` (MVS step 4). | None. |
| Wedged UI on a healthy process | Reset to known state or relaunch "rather than hoping" (MVS step 4). | None. |
| Feature unreachable (auth, OS, entitlement) | `verified-unreachable` with prerequisite and route; a missing prerequisite in the map is drift (MVS step 4). | None. |
| App behavior broken | Product gap, reported, kept out of the PR (MVS step 5). | No artifact format for the report (an issue? a line in run notes?). |
| Agent lies or overclaims | Guarded only by the proof bar's artifact requirements and the generator's own honesty. The **generator proves its own output** (CVS §4), and the coordinator in MVS both edits the map and grades the live pass. | No separation of author and grader. pstack's Shipping playbook demands that separation for PRs ("an author checks what it meant to build"), but the verification-skill pair doesn't apply it to itself. |
| Map drifts between maintain passes | Daily cadence (G06). VSE README: drift "gets fixed in the same PR as the UI change, or by a maintain-verification pass". | No sync commit, so a verifier can't tell a stale feature file from a current one. The formal pair has this; the UI pair doesn't. |
| Helper script can't fail | Not covered. | "Able to fail" exists only in the formal pair. A Doctor that always exits 0 passes the proof step. |

## 6. Conflicts with other workflows

| Workflow | Choice | vs pstack | When each wins |
|---|---|---|---|
| **ADW (this repo)** `verify` | Protocol first: author/verifier split, oracle fixed before boot, guard blocks oracle writes, `report.json` schema, four verdicts, two-cycle cap. Recipe = discovery every run. | pstack is recipe first, with no protocol: the generator self-proves, verdict words are loose, there's no schema. ADW is protocol first, with no recipe. | Combine them. Use ADW's protocol and pstack's recipe ([skills-comparison §4](../../verification/skills-comparison.md)). pstack's self-proof loses to ADW's separate verifier. pstack's Doctor beats ADW's "reuse a live server" (step 2), which directly contradicts FME's "Never drive an instance that was not started by this verification run". |
| **ADW** `validate-work` | Self-graded, with a LESSONS.md that grows. | pstack's equivalent of lessons is per-feature `Gotchas`, scoped and read only when that feature is driven. | Gotchas win for app-specific traps. LESSONS wins for protocol-level misses that span apps. |
| **Pocock** | No run-the-app verifier. Types, tests and pre-commit hooks, then human QA ([workflow-map](../../workflow-map.md) Verify row). | pstack makes "drive the app" an agent step. | Pocock wins on pure libraries and where tests already exercise the real boundary. pstack wins wherever a human would otherwise click through. |
| **StrongDM** | Holdout scenarios **outside** the repo, scored against digital twins. | pstack's map lives **in** the repo, visible to the author agent. | Holdout wins when the implementing agent could overfit to the oracle (fully autonomous loops). In-repo wins for shared, reviewable, maintainable recipes. A hybrid is possible: the recipe sits in the repo, but claims for a change come from the ticket, not the map ([decision 4](../../decisions-to-grill.md)). |
| **Ralph** | Backpressure from tests, types and scanners. No app driving. | Orthogonal. | Ralph's gates go in `adw_gates.json`. The recipe adds the live layer on top. |
| **Anthropic (harness article)** | Playwright e2e on the running app. A separate evaluator with hard per-criterion thresholds. | Closest relative. Anthropic separates the evaluator; pstack's generator doesn't. | Anthropic's separation plus pstack's maintained map is the target shape. |
| **cursor-team-kit `verify-this`** | Baseline-vs-treatment artifacts. Verdicts `VERIFIED / NOT VERIFIED / INCONCLUSIVE`. | pstack's verify skill has no baseline step. Shipping adds "parent against head". | Baseline wins for bug fixes and perf. ADW improvement 4 already proposes a parent-SHA must-fail. |
| **pstack internal** | Shipping, autopilot and multi-phase plans name `control-ui`/`control-cli` as live-lane drivers, not `verify-<app>`. | The generated skill and the lane drivers are never wired together in the files. | [I] In practice the lanes probably load the project skill when present (G06 suggests `use /verify-<app>`). ADW should wire it explicitly. |

## 7. Porting to Claude Code and ADW

### 7.1 What maps directly

- **Paths and names.** `.cursor/skills/verify-<app>/` becomes `.claude/skills/verify-<app>/` (ADAPT). Read-only source readers are `Explore` agents, with "do not edit files" in the brief and a `git status` check after.
- **Interview, sections, map contract, proof bar, maintain outcomes, triage bins.** These are pure prose and port verbatim.
- **Doctor → ADW step 3.** ADW already has a Doctor step and already maps Doctor failure to INCONCLUSIVE. Add the two missing checks: **build = SHA under test**, and **port owned by a PID this run started**.
- **Evidence survives cleanup → ADW step 8.** ADW already says ".verify/ survives cleanup". It needs a *check*, not a sentence.
- **Generic drivers.** CUI and CCLI port as-is. In Claude Code the built-in `run` skill already "looks for a project skill that already covers launching the app" first, so a `verify-<app>` skill is discovered by it too.

### 7.2 What has no direct equivalent

- **Cursor Automations for the daily maintain pass.** Use the `schedule` skill (cloud routine) or a local cron running `claude -p "/maintain-verify-recipe"`. A cloud routine can't reach local Docker or Testcontainers, so for the Spring service, run it locally [I].
- **Cloud VMs per live lane.** Use worktrees plus per-checkout ports, which VSE's `--checkout` pattern gives you.
- **The generator grading itself.** ADW already rejects this. Route the proof run through the guarded `verifier`.

### 7.3 Design sketch: `create-verify-recipe` (keeps `verify` protocol and guard unchanged)

**Principle.** `verify` stays the *protocol*: who grades, the oracle, the guard, the schema. The generated `verify-<app>` is the *recipe*: how to launch, check, drive and clean up *this* app. The generator is an **author**, and its proof run is a **verifier** dispatch. The read-only guard needs no change, because the verifier never writes the recipe: it only runs it and writes `.verify/`.

**Files (this repo, harness side):**

```
.claude/skills/create-verify-recipe/
  SKILL.md                      # user-invoked (disable-model-invocation: true)
  references/
    recipe-contract.md          # required sections + recipe.json schema + guard-clean rules
    feature-contract.md         # the four H2s, copied from pstack FME with ADW wording
    stacks/spring-boot.md       # §8 outlines, one per stack
    stacks/rust.md
    stacks/node-ts.md
  scripts/check_recipe.py       # deterministic linter (exit 0/1), see below
.claude/skills/maintain-verify-recipe/SKILL.md   # MVS port, §7.4
```

**Output (target repo, committed):**

```
.claude/skills/verify-<app>/
  SKILL.md         # frontmatter + Launch, Doctor, Drive, Evidence, Cleanup, Helpers, Feature map
  recipe.json      # machine-readable subset, read by verify step 2 and by ADW pipelines
  bin/             # helpers: launch, doctor, cleanup (+ optional ctl). chmod +x, invocations in SKILL.md
  probes/          # Hurl files / Playwright specs / CLI drive scripts per feature (oracle: read-only to authors)
  features/
    README.md      # baseline preconditions, driving conventions, proof+skip rules, sweep order, status table
    <feature>.md   # four H2s
```

`recipe.json` (the bridge to deterministic tooling):

```json
{
  "app": "orders-service",
  "surface": "http",
  "launch": "bin/launch --out .verify/{sha}",
  "ready": "bin/doctor --ready-only",
  "doctor": "bin/doctor --expect-sha {sha} --json",
  "cleanup": "bin/cleanup --run-file .verify/{sha}/run.json",
  "evidence_dir": ".verify/{sha}/evidence",
  "isolation": "per-worktree port + db name derived from worktree path",
  "status": "draft | proven",
  "proven": {"sha": "", "date": "", "feature": "", "report": ".verify/<sha>/report.json"},
  "sync_commit": "",
  "features": {"orders-create": {"last_driven_sha": "", "result": "PASS"}}
}
```

**Helper exit-code contract** (makes Doctor able to fail, and maps onto ADW verdicts):

| Helper | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| `bin/launch` | ready (usable); writes `run.json` with PIDs, port, container ids | failed to reach ready → **INCONCLUSIVE (environment)** | refused: an instance this run didn't start owns the port | — |
| `bin/doctor` | healthy, SHA matches, port owned by `run.json` PID | dependency unhealthy → INCONCLUSIVE | **wrong build** (SHA mismatch / dirty) → relaunch, never drive | not ours (port owner ≠ run PID) → refuse |
| `bin/cleanup` | everything in `run.json` stopped, evidence dir still present | residue left (names it) | evidence dir missing after cleanup → **proof fails** | — |

**`create-verify-recipe` procedure:**

1. **Interview** (CVS §1 verbatim, plus ADW additions). Read `adw_gates.json` and existing test harnesses (Testcontainers config, Playwright config, `assert_cmd` tests). Pick the stack file under `references/stacks/`. If the checkout doesn't boot, **report and stop**. Never fix product code (MVS edit scope applied to generation too).
2. **Generate** the files above. Every command must be **guard-clean** (rules in `recipe-contract.md`), because the guarded verifier will run them:
   - logs and evidence under `.verify/<sha>/`, scratch under `/tmp`;
   - no `$VAR` write targets across separate Bash calls (`verify_guard.is_allowed` blocks unresolved `$`). Compute paths inside helper scripts, which the guard does not inspect;
   - no `sed -i`, no `git` writes, no `curl -O`;
   - helpers take `--out <dir>` and write only there.
3. **Seed the map**: 3–5 features, four H2s each, plus a `features/README.md` status table (`feature | last_driven_sha | result | entry points covered`). Seed every feature `draft`.
4. **Lint**: `uv run .claude/skills/create-verify-recipe/scripts/check_recipe.py <repo>/.claude/skills/verify-<app>`. It exits 1 on any of:
   - missing frontmatter `name`/`description`;
   - a missing or misordered required H2 in SKILL.md or a feature file;
   - leftover `<placeholder>`, `TODO` or `example.com`;
   - a `bin/*` that is not executable, or whose name never appears in SKILL.md;
   - README links that don't match `features/*.md`;
   - a malformed `recipe.json`.
   This encodes CVS's "no placeholders" and "helpers rule" as structure.
5. **Prove (verifier, not author).** Commit the recipe on a scratch branch, then dispatch the guarded `verifier` with the standard brief. The claims:
   - R1: `bin/launch` from an empty data dir exits 0 and `bin/doctor` exits 0 with the SHA equal to HEAD.
   - R2 (**able to fail**): `bin/doctor --expect-sha 0000000` exits 2, and `bin/doctor` against a port with no listener exits non-zero.
   - R3: feature `<F>`'s Driving bullets reach the stated end state, with a side-effect read-back.
   - R4: one negative probe from `<F>` refuses as stated.
   - R5: `bin/cleanup` exits 0, `lsof -i :<port>` is empty, and no container with label `verify-run=<id>` is left.
   - R6: every evidence path cited in `report.json` exists after R5.

   `VERIFIED` → set `status: proven`, fill `proven`, set `sync_commit` = HEAD, and mark `<F>` driven. Anything else → fix the recipe as author and dispatch a **new** verifier. Same two-cycle cap as `verify`, then stop and report. "Never executed = draft" becomes **`status: draft` until a VERIFIED report exists**.
6. **Optional seeded-failure check (M).** On a scratch branch, break `<F>` (remove a validation, flip a status code), dispatch a verifier, and require NOT VERIFIED. Record `seeded_failure_verified: {sha, date}` in `recipe.json`. This is CFV's "able to fail", applied to the recipe (skills-comparison improvement 4b).

**Changes to `verify` (described here, not made):**

- Step 2: replace the `.claude/verify-recipe.md` lookup with "load `.claude/skills/verify-*/recipe.json` and SKILL.md". If `status: draft`, use it as a hint and add "recipe unproven" to `not_checked`. Replace "reuse a live server" with "reuse only if `bin/doctor` exits 0".
- Step 1: the verifier adds at least one regression claim from a mapped feature the diff touches (feature map as standing oracle; skills-comparison improvement 2).
- Step 8: run `bin/cleanup` and require exit 0. Exit 2 makes the overall verdict INCONCLUSIVE.
- The maintenance bullet points at `/create-verify-recipe` instead of "write a recipe".

**ADW pipeline hook (later).** A `verify` phase in `pipe_feature`/`pipe_bug`, after build, runs only when `recipe.json.status == proven`. It dispatches the verifier through the Agent SDK with claims taken from the ticket's acceptance criteria. `ship_gate.py` optionally requires a `VERIFIED` `report.json` bound to the patch-id (improvement 1).

**Sizes:**

| Piece | Size |
|---|---|
| `check_recipe.py` + contracts | S |
| `verify` wiring (step 1/2/8 edits) | S |
| `create-verify-recipe` SKILL + stack references, first real run on one repo | M |
| Seeded-failure step | S once the recipe exists |
| `maintain-verify-recipe` | M |
| Control CLI per app | M each, only when agents write throwaway drivers twice (PBL "do the first unit by hand") |
| Pipeline verify phase + ship-gate binding | L |

### 7.4 `maintain-verify-recipe` (M)

A port of MVS with three changes:

1. **Sync window.** Diff `sync_commit..HEAD` instead of "recent churn". The source wave only re-reads features whose entry points (routes, controllers, CLI subcommands, components) changed, plus a full live pass. `sync_commit` advances only on `clean`/`changed` (MFV step 6).
2. **Separate the live grader.** The coordinator fixes the map. The live pass is a verifier dispatch whose claims are "every feature's end state, as written". A product gap comes back as FAIL with evidence and becomes a GitHub issue (`needs-triage`), never a map edit.
3. **Oracle edits ship alone.** A `changed` PR touches only `.claude/skills/verify-<app>/`. ship-gate rejects a branch that mixes map/probe edits with product code unless the commit carries an `Oracle-Change:` trailer (improvement 6).

Cadence: weekly per active repo to start, daily for the work service once the cost per pass is known.

## 8. Stack adaptation

These outlines are what `references/stacks/*.md` would hold. They go one level deeper than [skills-comparison §4](../../verification/skills-comparison.md): exact signals, helper behavior, guard notes.

### 8.1 Java Spring Boot (HTTP service)

- **Launch** (`bin/launch`):
  - `./mvnw -q spring-boot:test-run -Dspring-boot.run.arguments="--server.port=0 --spring.profiles.active=verify"` (Gradle: `./gradlew bootTestRun`). Logs go to `.verify/<sha>/server.log`.
  - `src/test/java/.../TestApplication` runs `SpringApplication.from(Application::main).with(VerifyContainers.class)`. The `@ServiceConnection` Postgres/Kafka containers are labelled `verify-run=<id>`.
  - Port: parse `Tomcat started on port (\d+)` (or `Netty started on port`). Record the **listener** PID from `lsof -ti :<port>`, not the `mvnw` PID.
  - Usable: Flyway/Liquibase ran on the empty container DB, and the `verify` profile loaded seed data (`data-verify.sql` or a `CommandLineRunner` gated on the profile).
  - Ready = `/actuator/health/readiness` returns 200 (needs `management.endpoint.health.probes.enabled=true`) **and** one seeded GET returns the seed row. Readiness alone isn't enough, because it can pass while seeding still runs.
  - Disable devtools (`spring.devtools.restart.enabled=false`). A restart changes the PID and orphans the old one.
- **Doctor** (`bin/doctor`):
  - `/actuator/info` → `git.commit.id.full` equals `git rev-parse HEAD`, and `git.dirty == false` when verifying a commit. Needs `git-commit-id-maven-plugin` (or `com.gorylenko.gradle-git-properties`) plus `management.info.git.mode=full`.
  - `/actuator/flyway` shows no pending migrations.
  - `/actuator/health` components are all `UP`. A component that is `DOWN` means exit 1, INCONCLUSIVE.
  - The port owner PID equals `run.json`.
  - Auth: mint two tenant tokens from the seeded users, for the BOLA row in PROBES.md.
  - Expose these actuator endpoints in the `verify` profile only.
- **Drive.** `probes/<feature>.hurl`, run as `hurl --test --variable base=http://127.0.0.1:<port> --variables-file .verify/<sha>/tokens.env --report-json .verify/<sha>/evidence/hurl probes/orders-create.hurl`. Each entry has a create request, `[Captures] id: jsonpath "$.id"`, `[Asserts] status == 201`, then a GET read-back on `{{id}}`, then the negative rows (empty body → 400 with a problem-detail `type`; tenant B token → 404). The feature file's Driving bullets name the Hurl entry per sub-feature. For async consumers, publish through the app's own endpoint and read back with a GET or `/actuator/metrics`, never by putting directly on the topic (proof bar: real path).
- **Evidence.**
  - Hurl JSON report plus `--very-verbose` transcript per probe.
  - `/actuator/metrics/http.server.requests?tag=status:500` before and after. The count must not grow.
  - `grep -E '"level":"ERROR"'` over `server.log` in the run window.
  - Read-back responses.
- **Cleanup** (`bin/cleanup`): `kill <listener PID>`, wait for exit. Testcontainers' Ryuk reaps the labelled containers when the JVM dies. Confirm `docker ps --filter label=verify-run=<id>` is empty and `lsof -i :<port>` is empty. If compose is used instead: `docker compose -p verify-<id> down -v`. Check that `.verify/<sha>/evidence` still exists.
- **Feature granularity.** One file per bounded context or resource group (`orders.md`, `refunds.md`). "How to get to it" lists endpoints *and* async entry points (consumer topics, scheduled jobs).
- **Guard notes.** `mvnw` and `hurl` aren't in the guard's write list, so they run. Pass `--report-json` a literal `.verify/...` path. `docker` commands pass.

### 8.2 Rust (CLI first; axum service variant)

- **Launch** (`bin/launch`): `CARGO_TARGET_DIR=/tmp/verify-target-<worktree-hash> cargo build --release --locked`. Build once, then each drive gets a fresh `HOME`, `XDG_CONFIG_HOME` and `XDG_DATA_HOME` under `/tmp/verify-<id>/<drive>/`. A TUI gets a tmux session named `verify-<id>-<feature>` (CCLI: wait for a concrete screen pattern, one input at a time). Usable = the fixture workspace is copied from `tests/fixtures/<f>/` into the drive dir.
- **Doctor** (`bin/doctor`): `<bin> --version` prints `x.y.z (<sha>[-dirty])` from `build.rs` (`vergen-gitcl`, or `println!("cargo:rustc-env=GIT_SHA=…")` with clap's `version = concat!(…)`). The SHA must equal HEAD, and the binary path must be the release target dir. A debug binary, or a SHA mismatch, exits 2.
- **Drive.** `bin/drive <feature> -- <args>` runs `<bin> <args> --format json` in the drive dir and records `cmd`, `stdout`, `stderr`, `exit`, and a file tree diff of the drive dir before and after. Assertions use `jq` on stdout plus a read-back command (`<bin> list --format json`). Negative rows: a bad flag gives a non-zero exit with a usage hint, not a panic. A missing file gives an error naming the path. Existing `assert_cmd`/`insta` tests run first and stay oracle (`.snap` edits are a hack flag).
- **Evidence.** One JSON per drive: `{feature, entry, cmd, exit, stdout, stderr, fs_diff}`, plus `tmux capture-pane -p` dumps for TUIs. Proof bar: every command with stdout, stderr and exit code (FME).
- **Cleanup.** `tmux kill-session -t verify-<id>-<feature>` for each session this run named. Remove `/tmp/verify-<id>`. Keep the target dir for reuse.
- **Axum/actix variant.** Same as Spring: `--port 0` or a free-port helper, a `/healthz` that checks the DB pool, a `/version` route returning `GIT_SHA`, and Hurl probes.
- **Formal hand-off.** Rust is where CFV pays most (Kani, loom, proptest). Keep it a separate skill with a sync commit.

### 8.3 Node/TS web app (Playwright, role selectors)

- **Launch** (`bin/launch`):
  - Pick a free port in the helper.
  - Disposable DB `verify_<id>`: `DATABASE_URL=… pnpm prisma migrate reset --force --skip-generate && pnpm db:seed`.
  - Build with the SHA baked in: `GIT_SHA=$(git rev-parse HEAD) pnpm build`, then `pnpm start --port <p>`. A production build beats `pnpm dev`, because dev HMR serves stale modules.
  - Record the listener PID (`next-server` and Vite fork children).
  - Ready = `GET /api/health` returns 200 **and** the seeded user's page renders.
- **Doctor** (`bin/doctor`): `GET /api/version` (or `<meta name="build-sha">`) equals HEAD. The port owner is the run PID. A Playwright `storageState` login for the seeded user is still valid. The console is clean on `/` (no uncaught errors).
- **Drive.** Either a small `bin/ctl` modeled on FME's `control-notes` (`ctl browser click --role button --name "Save note"`, `fill --role textbox --name "Title" --value …`, `snapshot --aria --path …`, `screenshot --path …`), or committed `probes/<feature>.spec.ts` that use only `page.getByRole(...)`/`getByLabel`, run with `pnpm exec playwright test --config probes/verify.config.ts --output .verify/<sha>/pw`. Existing e2e specs are oracle. Each feature file covers every entry point (toolbar button, keyboard chord, deep link) and the success, cancel, empty, error and persistence paths. Persistence = reload or navigate away and back, then assert. Wait on locator state, never `waitForTimeout`.
- **Evidence.**
  - Per checkpoint: `locator.ariaSnapshot()` text plus a screenshot with the app header visible.
  - Trace on failure (`trace: 'retain-on-failure'`).
  - Console and network logs.
  - The side effect read back through the API or the reloaded UI.
  - Each artifact named `<feature>-<entry>-<step>`.
- **Cleanup.** Kill the listener PID and its children. `dropdb verify_<id>`. Close browser contexts. Keep `.verify/<sha>/`.
- **Guard notes.** Playwright writes to `--output`, so pass the literal `.verify` path. `prisma migrate reset` passes the guard but is destructive, so the helper must refuse when `DATABASE_URL` doesn't contain `verify_` (CVS "dry-run observed"; G06 "`--dry-run` on anything destructive").

## 9. Decisions for you

Existing items this component forces:

- [Decision 4, who owns the oracle](../../decisions-to-grill.md). The feature map is a standing oracle. Do change claims come from the ticket, the map, or both? Recommended: ticket for the change, plus at least one map regression claim.
- [Decision 7, protocol plus recipe or one generated skill](../../decisions-to-grill.md). This dissection recommends the split (§7.3).
- [Decision 8, side-effecting paths](../../decisions-to-grill.md). CVS's "verify what dry-run actually skips by observing" is the test for any dry-run you build.
- [Decision 10, author-side protection](../../decisions-to-grill.md). Is `probes/` and `features/` oracle for the implementing agent too?

Proposed new items (add to `decisions-to-grill.md`):

17. **Who proves a generated recipe?** The generator itself (pstack, cheaper) or the guarded verifier (§7.3 step 5, independent)? And does `status: draft` block `verify` from using the recipe, or only downgrade it to a hint?
18. **Build a control CLI per app, or stop at helper scripts?** Threshold proposal: build `bin/ctl` when two verify runs on the same app wrote throwaway drivers.
19. **Feature granularity for backends.** One file per resource group, per user journey (spanning endpoints and async consumers), or per bounded context? This decides what "every entry point" means for an API.
20. **Maintain cadence and window.** A sync-commit diff (proposed) or pstack's full source wave every time, and weekly or daily per repo?
21. **Where does the recipe live for the work Spring service?** Committed in that repo (shared with teammates, reviewable), or in your private harness only?

## 10. Unknowns

| Unknown | Why it matters | What would settle it |
|---|---|---|
| `control-atlas.mjs` and every real driver are omitted (VSE README). How `doctor` detects "build freshness" and "watcher liveness" is not public. | The version check is the load-bearing Doctor rule. | Read a real Cursor `control-*` skill, or build `bin/doctor` for one stack and observe it catching a stale build. |
| CVS writes `features/`, while VSE uses `references/features/`. | Path convention for the linter and maintainer. | Pick one in `recipe-contract.md`. `features/` matches the generator. |
| Whether generated skills should set `disable-model-invocation: true`. VSE does; CVS is silent. | Model-invoked means auto-use on every app edit. User-only means it's used only when named. | Decide per repo. In ADW the protocol `verify` is model-invoked and loads the recipe, so the recipe can stay user-only. |
| What "recent churn" means in MVS step 3. | Without a window, unmapped surfaces are found by chance. | Use a sync commit (§7.4). |
| How Shipping and autopilot live lanes pick `verify-<app>` over generic `control-ui`/`control-cli`. | Determines whether the map is actually consulted in poteto's loop. | Not in the files. Ask, or watch a run transcript. |
| How a product gap found by MVS is reported (issue, comment, run note). | Product gaps shouldn't die in scratch notes. | Not specified. ADW: open a `needs-triage` issue. |
| Cost of a maintain pass (34 parallel source readers plus a full live sweep for VSE-sized apps). | Decides daily vs weekly. | Measure on the first real repo. Add `cost` to `report.json` (improvement 12). |
| Whether the 4 cloud agents that validated the generator (commit `e42d29f`, per [repos-and-evolution §4.2](../../workflows/poteto/repos-and-evolution.md)) covered JVM or Rust stacks. | Every public example is web, Electron or CLI. No JVM service example exists. | Run `create-verify-recipe` on the Spring service first and record the misses in the stack reference. |
| Whether "never executed = draft" covers the 2–4 unproven seed features. | CVS treats the whole skill as proven after one feature. | Use the per-feature status table (§7.3), so the answer no longer depends on interpretation. |
