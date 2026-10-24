# Merge authority: a non-author verdict, bound to the patch, lands the PR

**Source workflow:** Poteto (pstack 0.15.28)  **Stages:** Verify, Review, Merge (with the Queue/Program stage for the ledger)
**Primary sources:**
- `~/.claude/plugins/cache/cursor-plugins/pstack/0.15.28/skills/poteto-mode/SKILL.md` (Non-negotiables, Autonomy, Playbooks index)
- `.../poteto-mode/playbooks/shipping.md`, `autopilot-full.md`, `autopilot-stack.md`, `babysit.md`, `opening-a-pr.md`, `orchestrate.md` (plus `autonomous-run.md`, `pause-safely.md` for context)
- `.../poteto-mode/scripts/orch/store.ts`, `orch.ts` (ledger and frontier), `scripts/watch-pr/{types.ts,cli.ts,policy.ts,github.ts}` (merge-state watcher)
- `.../pstack/0.15.28/docs/guide/06-verify-and-ship.md`, `07-overnight.md`, `docs/harness/claude-code.md`
- `~/code/plugins/orchestrate/skills/orchestrate/references/handoffs.md`, `scripts/schemas.ts`, `scripts/core/handoff.ts` (verification-level vocabulary)
- `man git-patch-id` (git 2.50.1) and `gh pr merge --help` (local), plus a throwaway `git patch-id` experiment in `/tmp` (results in §3.3)
- Port targets: `/Users/rickjms/code/adw-public/.claude/skills/ship-gate/SKILL.md`, `adws/pipelines/ship_gate.py`, `.claude/skills/verify/SKILL.md`, `.claude/agents/verifier.md`, `adws/travis/travis_sdlc.py` (`pr_ready_after_run`, line 406), `adws/adw_modules/draft_pr.py` (`finish`, line 344)
- Prior notes (skimmed): `../../workflows/poteto/pstack-mechanics.md` §3.6, `how-she-develops.md`, `../../workflow-map.md`, `../../verification/skills-comparison.md`

Labels used below. **[S]** is stated in a pstack source. **[T]** I tested locally. **[I]** is my inference. **[E]** is outside knowledge I did not verify here.

## 1. What it is

Merge authority is the rule set that decides who may turn a green PR into merged code when no human reads the diff. pstack's answer has three parts. First, only a **verdict** from an agent that did not write the code counts, and green CI or an approving bot review is not a verdict. Second, the verdict is **bound to a patch**, not to a commit: it survives a rebase only if `git patch-id` says the change is the same. Third, **landing is mechanical and paranoid**: walk the stack from the bottom, land only the contiguous verified run, one PR at a time, and read each PR back after merging because a merge command can report success while it only queued the PR. The problem this removes is the gap between "the checks are green" and "someone proved this exact code works", which is the gap a human reviewer normally fills by eye. The responsibility split around it (Babysit gets to green and stops, Shipping lands, Autopilot-full owners merge only what the root verified, Autopilot-stack hands the landing to the human) keeps any one agent from both wanting a merge and granting it.

## 2. Where it lives

| File | Role |
|---|---|
| `poteto-mode/SKILL.md` | Router. Non-negotiable: "Asked to land or ship a green stack → the **Shipping** playbook... Green is not safe. Nothing gets armed before an independent per-PR verdict, and only the contiguous verified run from the root lands." Autonomy: "Always pause for irreversible writes: force-push to shared branches, deploys..." |
| `playbooks/shipping.md` (12 lines) | The landing algorithm: verdict per PR (step 1), contiguous run (2), patch-id rule (3), bottom-up merge with read-back and retarget (4), hands off during landing (5), stop at the ceiling (6). |
| `playbooks/babysit.md` | Gets the merge frontier to merge-ready and stops. Step 9: "Babysitting never authorizes merging." Step 4: never mutates stack topology. |
| `playbooks/autopilot-full.md` | Queue of independent PRs, landing authority granted. "You own the verdicts, never the PRs." Owners merge only after the root's swarm verdict (step 5) and pre-merge trunk check. Root countersigns any gate loosening (step 6). |
| `playbooks/autopilot-stack.md` | Same owners, no landing. "You own the stack, never the landing." The operator lands. Each link "carries its verdict in its PR". |
| `playbooks/opening-a-pr.md` | PR body contract, including `## Verification` (1 to 3 real run paths). Opening a PR "does not start a babysit". Stacks are base-branch chains. |
| `playbooks/orchestrate.md` | Program scale. The **ledger** (`ledger.tsv`, keyed by PR + head SHA), the computed **frontier** (`frontier.json`), "exactly one stacker per stack". Close step: "confirm every landed PR has a verdict for its current head SHA". |
| `scripts/orch/store.ts`, `orch.ts` | The only code that stores verdicts. `orch ledger record <pr> <sha> <verdict> --evidence <path> [--verifier <name>]`, `orch ledger check <pr> <sha>` (prints the verdict or fails with `NOT-VERIFIED`). `orch frontier set` resolves the base chain from the forge. |
| `scripts/watch-pr/` | Typed GitHub watcher. Emits `READY`, `WAITING`, `ADVANCE`, `COMPLETE`, `BLOCKER` (exit 2/3/4/6/7), `TIMEOUT` (5). `--queued-stack --stack-prs <bottom-to-top>` is the landing watcher Shipping step 5 names. |
| `~/code/plugins/orchestrate/.../handoffs.md`, `schemas.ts` | The verification-level vocabulary the ledger reuses: `live-ui-verified`, `unit-test-verified`, `type-check-only`, `verifier-blocked`, `verifier-failed`, with a policy per level. |
| `docs/guide/06-verify-and-ship.md`, `07-overnight.md` | Human-facing rationale: "Babysit stops at merge-ready. It never merges, even with everything green, because merging is a different decision." "Only a clean verdict on the patch that merges authorizes the merge." |

Nothing in pstack's code computes `git patch-id`, checks the contiguous run, or checks that a verifier is not the author **[T: grep over the plugin finds `patch-id` only in prose]**. Those three rules are prose that the agent executes with `git` and `gh`. The code enforces only the ledger key and the watcher verdicts.

## 3. How it works, step by step

### 3.1 Who does what (the responsibility split)

```mermaid
flowchart LR
  O[Owner / author agent<br/>builds, opens PR] -->|code-ready head| V[Verifier(s)<br/>never wrote the code<br/>PASS / PASS+NOTES / FAIL]
  O --> B[Babysit<br/>conflicts → threads → CI<br/>stops at merge-ready]
  V --> L[(Ledger / PR comment<br/>PR + head SHA)]
  B -->|merge-ready, never merges| S{Who lands?}
  L --> S
  S -->|Shipping or Autopilot-full owner| M[merge lowest verified PR<br/>read back, retarget child]
  S -->|Autopilot-stack| H[Human operator lands]
```

| Role | May merge? | May rebase / retarget? | Source |
|---|---|---|---|
| Babysit | Never. "Only an explicit request to merge, land, ship, or merge when ready does. Route that request to Shipping." | Never. "No base retarget, rebase, stack-wide submit, or force-push from inside a babysit." | `babysit.md` steps 4, 9 |
| Opening-a-PR subagent | No. Posts the URL and returns. | n/a | `opening-a-pr.md` last paragraph |
| Shipping (whoever was asked to land) | Yes, bottom-up, verified run only. | Only the post-merge retarget of the next PR. | `shipping.md` steps 4, 5 |
| Autopilot-full owner | Yes, "only what you verified, tested on the trunk it lands on". | Its own branch, `--force-with-lease` pinned to its last SHA. | `autopilot-full.md` steps 2, 5 |
| Autopilot-full root | Never pushes a fix ("each branch has one writer"). Countersigns gate loosening. | No. | `autopilot-full.md` steps 4, 6 |
| Autopilot-stack owner | Never. Reports STACK-READY. | Never rebases onto another branch, never retargets, never arms auto-merge. | `autopilot-stack.md` step 1 |
| Autopilot-stack root | Never lands. | The single topology writer until landing starts. | `autopilot-stack.md` steps 2, 4 |
| Orchestrate stacker | Yes (merges are "units with briefs like any other"). | Exactly one per stack. | `orchestrate.md` Stack safety |
| Worker | Never. | Never. Brief `FORBIDDEN` line: "no PR retargets or merges, no rebase, no force-push". | `orchestrate.md` The brief |

The pattern **[I]**: the agent that wants the PR merged (the owner) is never the one that decides it is correct (the verifier), and the agent that drives CI to green (babysit) is never the one that merges. Autopilot-full step 6 states the motive for the countersign rule outright: "because the owner is the one who wants green."

### 3.2 Shipping, in execution order

**Input:** a stack of open PRs, bottom-to-top, already green (Babysit's output). A request to "land" or "ship".

1. **Resolve the forge, then get a verdict per PR** (`shipping.md` step 1). `gh` by default, `origin pr` if the Origin CLI resolves the repo, never Graphite. One verifier per PR, each a fresh cloud agent, "runs the change the way a user would with the matching control skill... parent against head, and posts `PASS`, `PASS+NOTES`, or `FAIL` on that PR." Two exclusions do the work: "Only a verdict from an agent that did not write the code counts, because an author checks what it meant to build. Green CI and an approving bot review are not verdicts, because neither runs the change as a user would." **State written:** a comment on the PR (Shipping) or a ledger row (Orchestrate).

2. **Compute the contiguous verified run** (step 2). Walk up from the lowest unmerged PR. Stop at the first PR without `PASS` or `PASS+NOTES`. Everything below is the run, and its top PR is the **ceiling**. "A verified PR above an unverified one waits, because it cannot land without the code below it." The one exception: a PR whose branch "neither holds nor needs that code can move onto trunk and land on its own", but "it needs a fresh verdict first, because its old one ran with that code beneath it and trunk does not have it."

   Example. Stack `#11 → #12 → #13 → #14` (bottom to top). Verdicts: `#11 PASS`, `#12 PASS+NOTES`, `#13 FAIL`, `#14 PASS`. The run is `#11, #12`. The ceiling is `#12`. `#14` waits even though it passed, because its branch contains `#13`'s commits.

3. **Re-check that each verdict still describes the code** (step 3). See §3.3. "A verdict covers a patch, and a chain rebase moves every PR above it to a new SHA without failing any check. Compare `git patch-id` at the verdict SHA with the current head before trusting an older verdict."

4. **Land bottom-up, one PR at a time, and read back** (step 4).
   - Merge the run's lowest unmerged PR: `gh pr merge <pr> --squash` (or `origin pr merge <pr>`). Two traps are named. On Origin, the plain command "also merges every PR below the one you name". On GitHub, "a PR whose base is still its parent's branch merges into that branch, not trunk."
   - **Read back:** `gh pr view <pr> --json state,mergedAt,baseRefName`. "A merge command can report success when a merge queue only queued the PR, and a requested auto-merge is not a merge. A landed PR reads merged with trunk as its base, not its parent's branch." **[T]** `gh pr merge --help` on this machine confirms the trap: "If required checks have not yet passed, auto-merge will be enabled. If required checks have passed, the pull request will be added to the merge queue." Both paths exit like a success.
   - **Arming auto-merge** is allowed "only on a PR whose verdict covers its current head, because it lands whatever head is ready."
   - **Retarget the next PR:** `gh pr edit <next> --base <trunk>`, "move its patch onto the merge result", push `--force-with-lease`. The verdict carries over only if step 3's patch-id rule holds. "Merge it once its checks pass and its verdict survives."

5. **Hands off while it lands** (step 5). The step-4 retarget is "the only change to a branch or base, because a merge lands whatever its branch and base hold at that moment, verdict or not." On GitHub, watch with `scripts/watch-pr/watch-pr --queued-stack --stack-prs <bottom-to-top>` under `/loop` until `COMPLETE`. The watcher emits `ADVANCE` each time the frontier merges and judges merged from `state === "MERGED" || mergedAt !== null` (`policy.ts:66`). "If a merge stalls, find out why before you change anything."

6. **Stop at the ceiling** (step 6). "Extending the run takes new verdicts, so it is a new pass through step 1."

**Reply contract:** "the verified run and its ceiling, each PR's verdict and who produced it, what landed and how you confirmed it, and what the next gap needs."

### 3.3 `git patch-id`, concretely

**What it computes [S: man page].** `git patch-id` reads a diff on stdin and prints "a sum of SHA-1 of the file diffs associated with a patch, with line numbers ignored". It hashes the `+`/`-`/context lines and file names. It ignores the hunk header line numbers (`@@ -12,7 +14,7 @@`) and everything outside the diff: commit SHA, author, date and message. Three modes:

| Mode | File order | Whitespace | Note |
|---|---|---|---|
| default (`--unstable`) | order matters | ignored | git ≤1.9 compatible |
| `--stable` | order ignored (sum of per-file hashes) | ignored | |
| `--verbatim` | order ignored **[T]** | **kept** | cannot be combined with `--stable` **[T]**; it already sums per file |

**What to feed it [I].** A PR is several commits, so hash the PR's whole diff against the base it lands on, not one commit:

```bash
base=$(git merge-base origin/main HEAD)        # for a stacked PR: the parent branch tip
git diff --binary "$base" HEAD | git patch-id --verbatim | cut -d' ' -f1
```

This makes the ID independent of how the work was split into commits, and squashing does not change it **[T]**. For a stacked PR the base is the parent's tip, so the ID covers only that PR's slice. After the parent squash-merges and the child is moved onto trunk, the child's diff against trunk should be the same slice, so the same ID **[I]**.

**Experiment [T].** A 10-line file `a.txt`, a feature branch that changes line 5 and adds `t.txt`, then a sequence of rebases. Patch IDs truncated to 12 characters (`--stable`):

| Event | Head SHA | Patch-id | Verdict |
|---|---|---|---|
| Verdict taken | `f1e3247` | `08e9863ea0d3` | baseline |
| Trunk changes an unrelated file `b.txt`; rebase | `750012c` | `08e9863ea0d3` | **kept**: new SHA, same patch |
| Trunk edits line 10 of the same file (outside the 3-line context); rebase | `5f5466b` | `08e9863ea0d3` | **kept** |
| Squash the two feature commits into one | `fa33feb` | `08e9863ea0d3` | **kept** |
| Trunk edits line 3 (inside the diff's context window); rebase | `86be942` | `cf8a6d072327` | **invalidated**, though the PR's own `+`/`-` lines did not change |
| Whitespace-only edit to the changed line, under `--stable` | | `cf8a6d072327` | **kept** (whitespace ignored) |
| One-character content change to the changed line | | `bb43fb201b79` | **invalidated** |

A second experiment shows the whitespace hazard. In Python, moving `return 3` from the function body into an `if` block changes behavior. Under `--stable` both versions hash to `f394418d5179`. Under `--verbatim` they hash to `e13887644a22` and `429fe5ef8033` **[T]**. **Use `--verbatim` for Python, YAML, Makefiles and any whitespace-significant file.** pstack does not name a mode **[S: shipping.md step 3 says only "`git patch-id`"]**.

Also tested: an empty diff gives empty output, so a binding check must fail closed on an empty ID. A binary file change and a mode-only change both produce a non-empty, distinct ID **[T]**.

**What keeps a verdict, summarized.** A rebase over unrelated trunk commits. A rebase where trunk touched the same files outside the patch's context lines. Re-splitting, squashing or rewording commits. Retargeting a stacked child to trunk after its parent squash-merged, when the move is clean.

**What invalidates a verdict.** Any change to an added or removed line. Any new file or deleted file in the PR. Trunk changing a line inside the patch's 3-line context (conservative: the patch did not change, but its surroundings did). A conflict resolution, since that rewrites hunks. A whitespace change under `--verbatim`.

**What patch-id cannot see [I].** Trunk changing code the patch *calls* in another file. The patch-id is identical, but the behavior that was verified may not be. Autopilot-full step 5 covers exactly this gap: "When trunk changed a caller of the patch or something the patch depends on, such as code it calls or a dependency version, run the patch's checks on the merge result and merge on a pass." So patch-id is a necessary condition for carrying a verdict, not a sufficient one.

**The test/docs carve-out [S].** Shipping step 3 allows one more case. "When the patches differ only in tests, docs, or lint config, a lane's result stands if what it ran builds the same at both SHAs apart from noise." Noise is "a difference that also shows up between two builds of the verdict SHA, or an embedded commit SHA", and each kind must be reported "with its files". The new test or doc change still "gets fresh checks and a review, because the old verdict never saw it." A lane with no build output (a dev server) "cannot show this, so rerun it." In practice this means comparing build artifacts byte for byte, which needs reproducible builds (§8).

### 3.4 Autopilot-full's extra pre-merge gates

Autopilot-full adds rules that Shipping does not need, because owners merge in parallel off trunk (`autopilot-full.md`):

- "A verdict covers one patch and green CI covers one head." A full swarm runs once at the **code-ready head** (after deslop and no-comments, rebased onto current trunk). A rebase, conflict resolution or minor fix gets a single verifier at the new head. Only new behavior, a redesign or a large new diff gets a new full swarm (step 4).
- "The verdict is not clean without the live lane", and the root audits the owner's merge-ready receipts because "no lane trusts a claim it has not checked" (step 4).
- "Green CI alone never authorizes a merge." After the swarm starts, merge prep rebases onto trunk and waits for green CI (step 5).
- Right before merging: fetch trunk and decide whether trunk's changes can affect the patch. Rebase only when "the code that would land was never tested" (a conflict, a file both sides changed, a change to which checks run). A lockfile both sides changed needs no rebase when a frozen install passes on the merge result. Trunk changing a caller or dependency means "run the patch's checks on the merge result". "If trunk would force a third rebase past merge prep, hold and report to the root" (step 5).
- Gate loosening ("a raised budget or an allowlist entry") needs "a verifier's proof and then your fresh countersign". "A disabled or soft-failed check always comes out." "Never give or bypass an approval the forge enforces, because no countersign covers it" (step 6).
- The operator's own gates win: "items the operator names as theirs and PRs outside the queue stop at merge-ready. A request to state the plan is not a go" (step 1).

### 3.5 The verification ledger

`orchestrate.md` Verification and `scripts/orch/store.ts`:

- File `ledger.tsv`, header `pr sha verdict evidence verifier ts` (`store.ts:18`).
- `orch ledger record <pr> <sha> <verdict> --evidence <path> [--verifier <name>]`. `evidence` is required. `verifier` is optional. A second record on the same `(pr, sha)` **replaces** the row (`store.ts:1415-1424`), which implements "A worker may self-report. A verifier overrides it on the same key."
- `orch ledger check <pr> <sha>` prints the verdict or fails with `NOT-VERIFIED` (`store.ts:1428-1441`). The key is the exact head SHA: "A new head SHA voids the row, so re-verify after restack."
- Levels, with policy from `handoffs.md`:

| Level | Meaning | Policy |
|---|---|---|
| `live-ui-verified` | Verifier reproduced the behavior live and confirmed the fix. | Trust as shipped. |
| `unit-test-verified` | A targeted test exercises the changed path and passes. | Fine for non-UI. UI needs a later live pass. |
| `type-check-only` | Only type-check or build passes. | "Behavioral work needs better than `type-check-only`." |
| `verifier-blocked` | Environment failure. | "not a pass. Respawn when the environment heals." |
| `verifier-failed` | Verifier found the change wrong. | "gets a fix unit, not a re-verify." |

- "CI green is an input to a verdict, not a verdict." "The ledger answers 'was this verified', not memory and not the transcript."
- A legacy `## Verdict pass | fail | inconclusive` handoff maps to the most conservative level: `pass → type-check-only` (`core/handoff.ts:54-56`). An unlabeled pass is never upgraded.
- Close step: "confirm every landed PR has a verdict for its current head SHA" (`orchestrate.md` step 7).

## 4. Why it works

The rules that carry the weight are marked **(load-bearing)**.

| Rule | Failure mode it prevents |
|---|---|
| **Only a non-author verdict counts (load-bearing)** | The author grades what it meant to build, not what it built. The author's context holds its own reasoning for why the code is right, so it reads the code through that reasoning. Anthropic's harness research says the same thing ("agents reliably skew positive when grading their own work", cited in `../../concepts/software-factory-concept.md`). |
| **Green CI and bot approval are not verdicts** | CI runs the tests the author wrote, and a bot review reads the diff. Neither runs the change "as a user would", so a PR can be green and still not do the thing. |
| **Verdict bound to patch-id, not to a branch name or "this PR" (load-bearing)** | A chain rebase gives every PR above it a new SHA "without failing any check". Without binding, an old PASS silently covers code the verifier never saw. Binding to the exact SHA (as the ledger does) is safe but forces a full re-verify after every restack, which in a 10-PR stack is a re-verify storm. Patch-id is the cheapest key that is still honest. |
| **Contiguous run from the bottom (load-bearing)** | A verified PR above an unverified one contains the unverified code in its branch. Merging it pulls the gap in underneath. |
| **Fresh verdict for a PR moved onto trunk on its own** | Its old verdict ran with the lower PRs' code beneath it. Trunk does not have that code, so the verified environment no longer exists. |
| **One PR at a time, lowest first** | Origin's merge command also merges everything below. GitHub merges a stacked PR into its parent branch, not trunk. Merging out of order lands code into the wrong base. |
| **Read back after merge (load-bearing)** | `gh pr merge` exits cleanly when it only armed auto-merge or queued the PR **[T]**. Believing a queued merge is a merge makes the next step (retarget and push the child) run against a trunk that does not have the parent yet. |
| **Arm `--auto` only when the verdict covers the current head** | Auto-merge "lands whatever head is ready", including a head pushed after the verdict. |
| **Hands off the stack while landing** | "A merge lands whatever its branch and base hold at that moment, verdict or not." A second writer mid-landing can put unverified code under a merge already in flight. |
| **Babysit never merges** | The loop that is rewarded for green would otherwise end by merging. Merging "is a different decision" (guide 06), so the green-chasing role is structurally unable to make it. |
| **One topology writer** | "Two writers on one chain undo each other" (`autopilot-stack.md` step 2). |
| **Owner never countersigns its own gate loosening** | "The owner is the one who wants green" (`autopilot-full.md` step 6). |
| **Conservative level mapping** | An unlabeled "pass" becomes `type-check-only`, so a vague report cannot authorize behavioral work. |
| **Pre-merge trunk check** | Patch-id cannot see changes to code the patch calls. Running the patch's checks on the merge result closes that hole without rebasing on every trunk move. |

## 5. Edge cases and failure handling

| Situation | What pstack does | Source |
|---|---|---|
| No verdict on a PR | It is the first gap. The run stops below it. Reply names "what the next gap needs". | `shipping.md` steps 2, 6 |
| Verdict `FAIL` | Same as no verdict for landing. Orchestrate: `verifier-failed` "gets a fix unit, not a re-verify". Autopilot-full: one fix-forward to the owner with "a red test across every site with the same defect". | `orchestrate.md`, `autopilot-full.md` step 4 |
| Verifier environment broke | `verifier-blocked` "is not a pass. Respawn when the environment heals." | `orchestrate.md` Verification |
| Rebase changed SHAs only | Patch-id equal: verdict stands. CI still has to pass on the new head ("every new head needs its own green CI"). | `shipping.md` 3, `autopilot-full.md` intro |
| Rebase changed tests/docs/lint only | Carve-out: the lane stands if the build output matches apart from reported noise. The new part gets fresh checks. Dev-server lanes rerun. | `shipping.md` step 3 |
| Patch drifted | Re-verify. For Autopilot-full, a single verifier unless the diff is large or new behavior. | `shipping.md` 3, `autopilot-full.md` 4 |
| Merge command "succeeded" but PR is only queued | Read-back shows not merged. Watch with `watch-pr --queued-stack`, which emits `WAITING` with reason `merge-queue` and later `ADVANCE`. | `shipping.md` 4, 5; `types.ts` |
| Merge stalls | "Find out why before you change anything." | `shipping.md` 5 |
| Trunk keeps moving | Rebase only if the landing code was never tested. Third forced rebase: hold and report. | `autopilot-full.md` 5 |
| A fix is needed after the owning PR merged | Babysit's one sanctioned creation: a new PR on top, "never a rewrite of merged history". | `babysit.md` 4 |
| Mid-landing problem in Autopilot-stack | Goes through the root to the operator. "Any fix waits for the operator's go." | `autopilot-stack.md` 4 |
| Agent claims a verdict it did not earn | The root audits "the merge-ready report's receipts". The ledger requires an `--evidence` path. A verifier row replaces a worker's self-report. Close step re-checks every landed PR against its head SHA. | `autopilot-full.md` 4, `store.ts`, `orchestrate.md` 7 |
| Agent lies about who verified | **Not enforced in code.** `--verifier` is optional in `orch ledger record`, and nothing compares it with the author. Independence comes from structure: the root spawns the verifier, and a different model family is preferred ("Run a unit's verifier on a different model family from its worker"). | `store.ts:1408-1411`, `orchestrate.md` Roles |
| Someone pushes to a PR after the verdict | Ledger: the new SHA has no row, so `check` returns `NOT-VERIFIED`. Shipping: patch-id comparison. Autopilot-full owner: "on any push you did not make, stop and report to the root". | `orchestrate.md`, `autopilot-full.md` 2 |
| Merge race between check and merge | Not addressed. **[T]** `gh pr merge` has `--match-head-commit SHA`, which refuses to merge if the head moved. pstack does not use it. | `gh pr merge --help` |
| Forge-enforced approval required | Never given or bypassed by an agent. | `autopilot-full.md` 6 |

**Internal tension [I].** The ledger keys on exact SHA ("A new head SHA voids the row"), while Shipping lets a verdict carry across a rebase by patch-id. Both can be true at once only if the agent that carries a verdict writes a new ledger row for the new SHA, citing the old one. The sources do not say who writes that row.

## 6. Conflicts with other workflows

| Workflow | Choice | When it wins |
|---|---|---|
| **pstack (Tan)** | A non-author verdict bound to the patch authorizes merge under an explicit grant (Autopilot-full). Human audits main in the morning. | Many independent PRs per night, a verifier that can drive the real surface, and a team that accepts reverts as the recovery path. |
| **pstack Autopilot-stack** | Verdict on every link, human lands. | Coupled work, low trust in the verifier, or merge authority withheld. This is the shape ADW and `ship-gate` already have, minus the verdict. |
| **Pocock** | Human QA and code review at the end of every AFK run. His tooling stops at "reviewable branch/PR". A fresh reviewer improves the branch first. A codebase nobody reads is a "dark factory", a failure mode (`../../workflows/matt-pocock/overview.md`). | Taste-heavy product work, public APIs, anything one-way. |
| **StrongDM** | No human review at all. Holdout scenarios outside the repo and a probabilistic satisfaction score (`../../concepts/software-factory-concept.md`). | A large scenario corpus plus digital twins. Without those, it has no oracle. |
| **Ralph (Huntley)** | Backpressure from tests and static checks inside a loop. No separate merge decision. | Greenfield, single-writer repos where a commit to the branch is the unit. |
| **Anthropic harness posts** | A separate evaluator with hard per-criterion thresholds, because self-grading skews positive. No merge policy stated. | Agrees with the non-author rule. Silent on merge authority. |
| **ADW today** | Human merges every PR. `pr_ready_after_run` flips draft → ready on `all_success` and no review blocker. No verdict, no patch binding, and failing tests can still produce a ready PR (`../../workflows/adw/overview.md` §3.6). `ship-gate` never reads the verify verdict. | Right for now, since no grant exists. Its gap is that "ready" does not mean "verified". |

**Where pstack is weaker [I].** Its verdicts are prose posted on a PR or a free-form ledger level. The repo's own `verify` skill has a per-claim `report.json` with `hack_flags` and `not_checked`, and a PreToolUse guard that makes the verifier read-only by mechanism. pstack has neither. Its non-author rule is enforced by who spawns whom, not by a check.

## 7. Porting to Claude Code and ADW

### 7.1 What maps directly

| pstack | Claude Code / ADW | Status |
|---|---|---|
| Non-author verifier | `verifier` subagent (`.claude/agents/verifier.md`) behind `verify_guard.py` | Exists. Same model family by default (no `model:` set). |
| Verdict content | `.verify/<short-sha>/report.json` (`VERIFIED / NOT VERIFIED / INCONCLUSIVE / FLAG`, per-claim evidence) | Exists. Keyed by short SHA. Not read by anything downstream. |
| `## Verification` in PR body | `ship-gate` step 3 writes the body "from conversation context". `draft_pr._render_body` writes Overview / Technical changes / Risk notes. | Missing the section. |
| "Babysit never merges", "human lands" | `ship-gate` step 4 ("Do not merge, do not enable auto-merge"), `draft_pr.finish` ("approval is the human's") | Exists, and should stay. |
| Contiguous run, retarget, `--queued-stack` | ADW has no stacks: a Blocker must be closed before a dependent starts (`overview.md` item 18). | The rule degenerates to "one PR". Not needed yet. |
| `/loop`, cloud agents | Claude Code `loop` skill; `isolation: "worktree"` per the adapter | Partial (`docs/harness/claude-code.md`). |
| Ledger | none | Missing. |
| Patch-id binding | none | Missing. |

### 7.2 What has no equivalent

- **Cross-family verifiers.** `pstack-models.md` resolves every panel to Opus or Sonnet. A different-family verifier needs a non-Anthropic runner. Model diversity within Claude is the available step.
- **Verdicts posted on the PR.** `ship-gate`'s privacy invariant allows exactly two network calls (`git push`, `gh pr create`). Posting a PR comment adds a third. Put the verdict in the PR body at create time instead, which keeps the invariant.
- **CI.** The repo has no `.github/`. "Every new head needs its own green CI" has no target here. `ship_gate.py`'s local gates stand in.

### 7.3 Design sketch

The merge itself **stays human** in every step below. Until the user decides risk tiers (`../../decisions-to-grill.md` item 1), a verdict decides only whether a PR may be *offered* for merge (ship-gate pushes it, ADW flips it from draft to ready). It never merges.

#### (a) Verdict file format (S)

Extend `.verify/<short-sha>/report.json` with a `binding` block and identities. The verifier writes it. The guard already confines it to `.verify/`.

```json
{
  "commit": "86be942c...full",
  "verdict": "VERIFIED",
  "level": "live-verified",
  "binding": {
    "base_ref": "origin/main",
    "merge_base": "3f1c0a9e...full",
    "patch_id": "e13887644a22...full",
    "patch_id_cmd": "git diff --binary <merge_base> <commit> | git patch-id --verbatim"
  },
  "author":   { "model": "claude-opus-5-5", "session": "<session id or adw_id>" },
  "verifier": { "agent": "verifier", "model": "claude-sonnet-...", "guarded": true },
  "verifier_model": "claude-sonnet-...",
  "claims": [ { "id": "C1", "status": "PASS", "evidence": ["evidence/c1-happy.http"] } ],
  "hack_flags": [],
  "not_checked": [],
  "environment": { "launch": "...", "port": 8080, "services": [] }
}
```

- `level` reuses the ledger vocabulary, renamed for non-UI work: `live-verified | test-verified | build-only | verifier-blocked | verifier-failed`. Map `VERIFIED` with a running app to `live-verified`. A legacy report without `level` maps to `build-only`, following orchestrate's conservative migration.
- Append one line per verdict to `.verify/ledger.tsv`: `ts branch head_sha patch_id verdict level verifier_model author_model report_path`. Append-only. The check reads it. A human can `column -t` it in the morning.
- Keep `.verify/` gitignored. The PR body carries the summary (c).

#### (b) The binding check (M)

New local-only script `adws/pipelines/verdict_check.py` (zero network, same rule as `ship_gate.py`), also callable as `ship_gate.py --require-verdict`.

```
uv run adws/pipelines/verdict_check.py [--working-dir DIR] [--base origin/main] [--json]
exit 0  BOUND     a VERIFIED report's patch_id equals HEAD's patch_id
exit 0  EXEMPT    every changed path matches verdict_exempt_paths
exit 3  MISSING   no report for this branch
exit 3  STALE     a report exists for an earlier head, patch_id differs (prints both, and the drifted files)
exit 4  NOT-PASS  bound report is NOT VERIFIED / INCONCLUSIVE / FLAG (route to user, never pass)
exit 4  SELF      verifier.agent != "verifier" or verifier.guarded is false (unguarded run)
exit 2  precondition (git unavailable, empty patch-id)
```

Algorithm:

1. `mb = git merge-base <base> HEAD`. `pid = git diff --binary mb HEAD | git patch-id --verbatim`. Empty `pid` fails closed (exit 2) **[T: empty diff gives empty output]**.
2. If `git diff --name-only mb HEAD` matches only `verdict_exempt_paths` (new key in `adw_gates.json`, e.g. `["docs/**", "*.md", "ai_docs/**"]`), return `EXEMPT`. Print it, so a reviewer sees it was exempt and not verified.
3. Scan `.verify/*/report.json` for `binding.patch_id == pid`. Take the newest by ledger `ts`.
4. None found: if any report's `commit` is an ancestor of HEAD on this branch, `STALE` (print `git diff --stat <report.commit> HEAD` so the human sees what drifted). Otherwise `MISSING`.
5. Found: require `verdict == "VERIFIED"`, `hack_flags == []`, `verifier.guarded == true`, `verifier.agent == "verifier"`. Optionally require `verifier.model != author.model` (policy flag, decision 9).
6. Report `same_sha` (report commit == HEAD) separately from `bound`, so the PR body says whether the verdict was carried across a rebase.

Not ported in v1: Shipping's test/docs build-equivalence carve-out. Any patch-id change means re-verify. Revisit when reproducible builds exist per stack (§8).

Known hole to close with it (S): the author session is unguarded, so it could write `.verify/*/report.json` itself. Add a PreToolUse hook on the main session that blocks writes to `.verify/**/report.json` and `.verify/ledger.tsv` from any agent other than `verifier`. Whether the hook input carries the agent type is an unknown (§10).

#### (c) PR body `## Verification` section (S)

Rendered by the check from the bound report, so the author never writes it by hand:

```markdown
## Verification

**Verdict:** VERIFIED (live-verified) by `verifier` (claude-sonnet-...), author claude-opus-5-5.
**Bound to:** patch-id `e1388764` over `origin/main...86be942`. Verdict taken at `86be942` (same as head).

| Claim | Status | Evidence |
|---|---|---|
| C1 POST /notes with empty title returns 400, count unchanged | PASS | `.verify/86be942/evidence/c1-empty-title.http` |
| C2 ... | PASS | ... |

Not checked: outbound email (side effect, brief disallowed).
Merge: **human**. This verdict does not authorize a merge. A push after this PR opened voids it unless
`uv run adws/pipelines/verdict_check.py` still reports BOUND.
```

When the verdict was carried across a rebase, the second line reads "Verdict taken at `<old>`, carried to `<head>` by matching patch-id". For `EXEMPT`, the section is one line naming the exemption rule.

#### (d) `ship-gate` changes (S)

- Step 1b (new): after `ship_gate.py` exits 0, run `verdict_check.py`. Exit 3 means run the `verify` skill (author dispatches `verifier`) and retry. Exit 4 means relay the report verbatim to the user, under the existing relay-verbatim rule. Never edit `report.json` or the exempt list to pass.
- Step 3: the PR body includes the rendered `## Verification` section from (c).
- Step 4: unchanged. "Do not merge, do not enable auto-merge, do not approve your own PR."
- Known gaps: add "a verdict carried by patch-id does not cover changes on trunk to code the patch calls" (the Autopilot-full step 5 hole).

#### (e) ADW pipeline changes (M)

- **Placement.** travis runs build → validate → test → review → document → dream → `draft_pr.finish` (`travis_sdlc.py:1395-1518`). Document and dream commit after review, so a verdict taken before them would go stale. Put a new `verify` phase **last, right before `finish`**, or exclude the doc paths from the patch-id with `verdict_exempt_paths`. Running it last is simpler.
- **Verify phase.** Claims derived from the Ticket's acceptance criteria (the review oracle in `CONTEXT.md`), not from the Plan. Dispatch the guarded `verifier` with the verify skill's brief. Write `report.json` with the binding block.
- **Readiness.** Change the signature to `pr_ready_after_run(all_success, review_result, test_result, verdict)`. Ready requires: `all_success`, review not failed, **test not failed** (fixes the current hole where failing tests still yield a ready PR), and `verdict.status in {BOUND, EXEMPT}`. Anything else leaves the PR draft with the reason in the summary line.
- **`draft_pr.finish`.** Re-run the binding check against the final pushed HEAD immediately before `gh pr ready`, since `finish` itself commits (`_commit_all(session, "... finalize")`). Render the `## Verification` section into the body next to the existing Overview.
- **`factory.py`.** Today it calls `draft_pr.finish(session, True, ...)` on gate success alone (`factory.py:220`). Route it through the same readiness function.

#### (f) Later, only after risk tiers are decided (L, do not build now)

A `adws/pipelines/land.py --pr N` that a human could choose to allow per tier:

1. Read a written grant (`adw_merge_policy.json`: tier → `human | verdict`), defaulting every tier to `human`.
2. `gh pr view N --json headRefOid,baseRefName,state` and run `verdict_check` against that head.
3. `gh pr merge N --squash --match-head-commit <headRefOid>`. The `--match-head-commit` flag closes the race between check and merge, which pstack's text does not address **[T: flag exists in local `gh`]**.
4. Read back `gh pr view N --json state,mergedAt,baseRefName`. Success only when `state == MERGED` and `baseRefName` is the default branch. Anything else (queued, auto-merge armed) is reported as not merged.
5. Append the result to the ledger.

Size summary: (a) S, (b) M, (c) S, (d) S, (e) M, (f) L.

## 8. Stack adaptation

The binding check is stack-neutral. What changes per stack is what can hide inside an unchanged patch-id and what "builds the same" means for the carve-out.

| | Java Spring Boot | Rust | Node/TS |
|---|---|---|---|
| Patch-id mode | `--stable` would be safe for `.java`, but `application.yml` is whitespace-significant. Use `--verbatim` everywhere for one rule. | `--verbatim` (rustfmt churn shows up as drift, which is the conservative side). | `--verbatim` (YAML CI files, `.prettierrc`). |
| Invisible dependency drift (patch-id same, behavior differs) | Trunk bumps a version in the parent `pom.xml` / BOM or a Gradle version catalog. Trunk changes a `@Bean` the patch autowires, or a Flyway migration the patch's queries assume. | Trunk changes `Cargo.lock` or a workspace member's public API, or a feature flag in a shared `Cargo.toml`. | Trunk changes the lockfile, `tsconfig` paths, or a shared barrel export. |
| Pre-merge "run the patch's checks on the merge result" (Autopilot-full 5) | `./mvnw -q verify -pl <touched modules> -am` on the merge result. Slow, so scope by module. | `cargo test -p <touched crates>` plus `cargo check --workspace`. | `pnpm -r --filter ...[origin/main] test` or the repo's affected-graph tool. |
| Lockfile both sides changed | Maven has no lockfile by default. Gradle `--write-locks` if used. | `cargo build --locked` on the merge result. | `npm ci` / `pnpm install --frozen-lockfile` on the merge result, as Autopilot-full step 5 describes. |
| Build-equivalence for the test/docs carve-out | Needs reproducible jars (`project.build.outputTimestamp` in Maven). Spring Boot's `build-info` and git-commit plugins embed the SHA, which is the "embedded commit SHA" noise Shipping names. | Reasonably reproducible with the same toolchain. Embedded paths (`--remap-path-prefix`) are noise. | Bundles usually embed hashes and timestamps. Treat as "no build output" and rerun the lane, as Shipping says for dev servers. |
| Verifier level reachable | `live-verified` via HTTP probes against the booted app (the verify skill's backend matrix). | `live-verified` for a service or CLI. `test-verified` is the realistic level for a library. | `live-verified` via HTTP or browser. |
| Exempt paths | `docs/**`, `*.md`, `src/test/resources/**` only if tests are separately gated. | `docs/**`, `*.md`, `benches/**`? (decide). | `docs/**`, `*.md`, `*.stories.tsx`? (decide). |

The verdict file and check stay in this repo's Python. Target repos only need `git` and the `.verify/` directory.

## 9. Decisions for you

1. **Risk tiers and the merge grant.** Which classes of change (if any) may a bound verdict merge without you? Until decided, every tier is `human`. [Decision 1](../../decisions-to-grill.md), and decision 2 for one-way doors.
2. **Exact SHA or patch-id.** Patch-id (`--verbatim`) is recommended here, with exact SHA as the fallback for any repo where the build is not trusted. [Decision 6](../../decisions-to-grill.md).
3. **What blocks.** Is `INCONCLUSIVE` or `FLAG` a hard block on the draft → ready flip, or a ready PR with a warning? This dissection assumes block. [Decision 5](../../decisions-to-grill.md).
4. **Grader diversity.** Require `verifier.model != author.model` in the check, or only record it? [Decision 9](../../decisions-to-grill.md).
5. **Exempt paths.** Which paths skip the verdict requirement per project, and does `EXEMPT` need `validate-work` evidence instead? **New**, propose as decision 6a.
6. **Verify placement in travis.** Last phase (simple, verifier sees the final diff) or before document with doc paths exempt (earlier signal)? **New**, propose as decision 6b.
7. **Do you want stacks at all?** Without them the contiguous-run and retarget rules are dead weight. With them, dependent Tickets can run in one night (`../../workflows/adw/overview.md` item 18). **New**, propose under Tier 3.
8. **Test/docs carve-out.** Port it later (needs reproducible builds per stack) or never (always re-verify)? **New**, low priority.

## 10. Unknowns

| Unknown | What would settle it |
|---|---|
| Which `git patch-id` mode Tan uses, and over what range (per commit or the PR's whole diff against its base). | Ask, or find a pstack transcript or decision trail where a Shipping run computes it. The Python indentation case (§3.3) makes the mode matter. |
| Where the Shipping verdict lives. Step 1 says "posts ... on that PR", the ledger keys by SHA. Who writes the new ledger row when a verdict is carried by patch-id? | A real Orchestrate store from one of her runs, or asking. |
| Whether "PASS+NOTES" maps to a ledger level. The two vocabularies (`PASS/PASS+NOTES/FAIL` vs five levels) are never joined in the sources. | Same. |
| How the non-author rule is checked when the root, not code, spawns verifiers. Nothing in `orch` compares verifier with author. | Read `swarm` and `show-me-your-work` for an audit step that checks it, or accept that it is structural. |
| Whether Claude Code's PreToolUse hook input identifies the subagent type, so a main-session hook can block non-verifier writes to `report.json`. | Read the current Claude Code hooks reference, or log the hook's stdin JSON from one verifier run and one main-session run. |
| How GitHub's automatic retarget of a child PR (when a parent's head branch is deleted after merge) interacts with "move its patch onto the merge result". **[E]** GitHub retargets children when the base branch is deleted. Shipping step 5 treats that as "expected, not damage to repair". | One test stack on a scratch GitHub repo: squash-merge the parent with branch deletion on, then compare the child's patch-id before and after `git rebase --onto origin/main <old-parent-tip>`. |
| Whether `gh pr merge` exits 0 when it only arms auto-merge or enqueues. The help text says it does those things. I did not observe the exit code. | Run it once on a scratch repo with a required check pending. |
| How often patch-id drift from trunk touching context lines (§3.3, row 5) forces re-verifies in practice. | Log STALE results with their drifted files for a few weeks of ADW runs once (b) exists. |
