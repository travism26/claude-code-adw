# Verification skills compared: yours, pstack (Lauren Tan), Matt Pocock

**Date:** 2026-10-24
**Question:** How do this repo's verification and validation skills (`verify`, `validate-work`, `ship-gate`) compare with pstack's verification skills and Matt Pocock's equivalents, and what concrete changes would make yours stronger?
**Method:** Read every skill file in full from the installed copies (paths below), plus the design intent in commits `d3677c2` and `56b4c35`, the research basis in [verification-loop-research.md](../../verification-loop-research.md) and [feedback-loop-practices-research.md](../../feedback-loop-practices-research.md), and the one real run on disk (`.verify/ad81b92/report.json`). No skill files were edited.

Paths used throughout:

- `$PSTACK` = `~/.claude/plugins/cache/cursor-plugins/pstack/0.15.28`
- `$MATT` = `~/.agents/skills` (symlinked into `~/.claude/skills/`)
- Yours: `.claude/skills/verify/{SKILL.md,PROBES.md}`, `.claude/agents/verifier.md`, `.claude/hooks/verify_guard.py`, `.claude/skills/validate-work/{SKILL.md,LESSONS.md}`, `.claude/skills/ship-gate/SKILL.md`, `adw_gates.json`

---

## Bottom line

Your `verify` is the strongest of the three on **grader independence and oracle protection**. It is the only one that enforces read-only by mechanism (a PreToolUse hook with `onFailure: block`, and its own unit tests in the ship gate), not by asking nicely. pstack enforces nothing mechanically. Pocock has no dedicated verification skill.

Your gaps are elsewhere, and they are structural:

1. **Verification doesn't feed shipping.** `ship-gate` never reads `.verify/<sha>/report.json`. A branch can be shipped with no verdict, a stale verdict, or a FAIL. pstack's Shipping playbook gates landing on an independent verdict and re-checks that the verdict still describes the patch (`git patch-id`).
2. **The author still holds the oracle.** The verifier brief has the *author* fill in the claims. The guard stops the verifier editing the oracle, but nothing stops the author writing a weak one. The one real run shows it happening (C3 "GET /health answers" graded PASS while the body said `unhealthy`).
3. **Nothing is project-specific or maintained.** Every run rediscovers launch, port, env and fixtures. The `verify-recipe.md` hook exists in the skill but no recipe was ever written. pstack solves this with a generator (`create-verification-skill`) that writes a project-local skill with a feature map, proves it once, and keeps it honest with a maintenance loop.
4. **No check that the verifier can fail.** Negative probes test the app, not the verifier. No seeded-failure run, no "run the parent SHA and see the bug" step for bug fixes.

The highest-leverage move is a hybrid: keep your generic `verify` as the **protocol** (who grades, what's read-only, the report schema, verdict rules) and adopt pstack's generator for the **recipe** (how to launch, check, drive and clean up *this* app, plus its feature map). The two halves are independent and each is stronger than either source alone.

---

## 1. Inventory

| Skill | Author | Trigger | Who verifies | Oracle | Evidence | Enforcement | Maintenance / learning |
|---|---|---|---|---|---|---|---|
| `verify` (`.claude/skills/verify/SKILL.md`) | Travis | Model-invoked: "whenever you touch frontend or backend code" | Fresh `verifier` subagent; author must not grade | Claims written to `.verify/<sha>/claims.md` before boot, plus PROBES.md matrix as findings, plus committed E2E specs | `.verify/<sha>/{claims.md,server.log,evidence/*,report.json}`, one file per probe | Verifier role is instruction; read-only is a hook (below). Two fix cycles max, fresh verifier each cycle | "Maintaining this skill" section: author writes `.claude/verify-recipe.md`; fix the skill on unexpected blockers. No lessons file. No recipe written yet |
| `verifier` agent + `verify_guard.py` | Travis | Dispatched by `verify` | n/a (the grader) | n/a | n/a | PreToolUse on Write/Edit/NotebookEdit/Bash, fails closed; blocks writes outside `.verify/` or temp; parses redirects, `tee`, `sed -i`, mutating git, inline interpreter writes, heredocs. 9 tests in `adws/adw_tests/test_verify_guard.py`, in the `unit` gate | Known gaps documented: scripts/binaries, MCP tools, author writes |
| `validate-work` (`.claude/skills/validate-work/SKILL.md`) | Travis | Work declared complete; non-app claims (scripts, evals, graders, docs) | The author, self | Claims the author lists in step 2 | Command + observed output in the report (not on disk) | None; procedure only | `LESSONS.md` read first, appended on every miss (7 entries, 2026-06-09 to 2026-08-04). Best learning loop of the set |
| `ship-gate` (`.claude/skills/ship-gate/SKILL.md`) | Travis | "ship this", push/PR | `ship_gate.py` (deterministic) + read-only reviewer subagent | `adw_gates.json` (explicit test file list) + reviewer judgment | Gate JSON; PR body from conversation context | Deterministic gate exit codes; `--skip-precheck` logged loudly; agent never merges. Reviewer read-only by instruction only | None |
| `no-mistakes` (`~/.claude/skills/no-mistakes/SKILL.md`) | **Third-party** (kunchenguid/no-mistakes; CLI at `~/.local/bin/no-mistakes`) | "/no-mistakes", gate/ship/validate | Daemon pipeline agents (review, test, lint, docs, CI) | `--intent` (user's words) + repo config | TOON output; outcomes bound to `run.head_sha` (`passed-with-skips`, `passed-with-override`) | Strong: daemon owns fixes, `protected-path-refusal` gate cannot be auto-approved, nested-gate detection by process ancestry | Pipeline-level; no per-repo lessons |
| `create-verification-skill` (`$PSTACK/skills/create-verification-skill/`) | Lauren Tan | User-invoked only (`disable-model-invocation: true`) | Generator, then whoever runs the generated skill | Generated `features/` map: per-feature user entry points and observable end state | Generated skill names an evidence location; proof must survive cleanup | Prompt only. "A generated skill that was never executed is a draft" | Hands off to `maintain-verification-skill` |
| `maintain-verification-skill` | Lauren Tan | User-invoked; guide says daily, ideally scheduled | Coordinator drives live; per-feature read-only source subagents | The feature map, reconciled against source and a live drive | Scratch run notes (not committed); one PR of corrections | Edit scope limited to the skill's directory; never product code | This *is* the maintenance loop: outcomes `clean` / `changed` / `blocked` |
| `create-formal-verification-skill` | Lauren Tan | User-invoked | Generator, then the generated check | One stated property of the riskiest code | Counterexample in code terms | "Able to fail": each property must be shown failing on a broken variant | Records covered files + sync commit |
| `maintain-formal-verification-skill` | Lauren Tan | User-invoked, after merges that skipped the check | Maintainer agent | Property; changed only with cited evidence of intent | Report per check: in sync / updated / bug / blocked | Edit scope = verification only; re-break after every update | Moves the sync commit only after confirming |
| `principle-prove-it-works` | Lauren Tan | After a task, before done | Self | The real artifact, not a proxy | Script output kept as an artifact | None | None |
| `show-me-your-work` | Lauren Tan | Long or unattended runs | Self, then a different-model-family subagent audits the trail | Transcript | Append-only `decisions.tsv` via `scripts/log.sh` | Audit against transcript; "Attention" section mandatory | Supersede rows, never edit |
| `interrogate` | Lauren Tan | "adversarial review" | One reviewer per configured model, read-only | Stated intent paragraph + rubric | Synthesized verdict in Act on / Consider / Noted / Dismissed buckets | `readonly: true` per reviewer | None |
| `benchmark-checklist` | Lauren Tan | Any perf number | Self | Seven questions answered from a run | Number, run count, range, limiter | None | None |
| Shipping playbook (`$PSTACK/skills/poteto-mode/playbooks/shipping.md`) | Lauren Tan | "land the stack" | One fresh verifier per PR, parent against head | Live behavior on the real surface | `PASS` / `PASS+NOTES` / `FAIL` posted on the PR | Lands only the contiguous verified run; `git patch-id` check that the verdict still covers the head | n/a |
| Visual parity / Eval playbooks | Lauren Tan | Pixel migrations / skill experiments | Image diff / blinded judge on another model family | Frozen baseline / rubric hidden from candidates | Diffs / transcripts | "No baseline tampering"; blinding rules | n/a |
| `tdd` (`$MATT/tdd/`) | Matt Pocock | Test-first work | Self | Tests at seams agreed with the user; expected values from an independent source | Test runs | Red before green (instruction) | None |
| `diagnosing-bugs` | Matt Pocock | "debug this" | Self | A red-capable, deterministic, fast, agent-runnable command, run at least once before any hypothesis | The command and its output | Phase gate: "No red-capable command, no Phase 2" | Correct hypothesis goes in the commit/PR |
| `code-review` | Matt Pocock | "review since X" | Two parallel fresh sub-agents: Standards and Spec | Repo standards + Fowler smell baseline; the originating issue | Two reports, deliberately not merged | Separation of axes | None |
| `pr` | Matt Pocock (credits Dex Horthy) | Writing a PR body | n/a | n/a | Before/After evidence (screenshots S-tier, execution A-tier); one-way/two-way door; blast radius | None | None |
| `implement` | Matt Pocock | Spec/tickets | Self, then `code-review` | Tests + typecheck | Test runs | None. No "run the app" step | None |

Two things stand out. First, pstack's verification skills are all **user-invoked** (`disable-model-invocation: true`), while your `verify` is **model-invoked** and meant to fire "whenever you touch frontend or backend code." Yours will run far more often, so its per-run cost matters more. Second, Pocock has **no verification skill**: his verification lives inside the debug loop (`diagnosing-bugs` Phase 1), test discipline (`tdd`), the spec axis of `code-review`, and the evidence section of `pr`. His `implement` never boots the app.

---

## 2. Mechanism comparison

### Claim fixing (when is "correct" decided, and by whom?)

- **Yours.** Claims are written to `claims.md` before boot, each with an expected observation and a negative probe; a claim without an expected observation is INCONCLUSIVE. Claims are frozen after that (step 1). This is the most rigorous claim discipline in the set. The weakness is **who writes them**: the brief template has the author fill `C1: <observable claim> — expected: <...>`. Step 1 says to source claims "from the ticket/spec and the diff, not from the author's narration," but the brief hands over the author's claims as "the oracle; do not change them." The verifier is told both to derive claims independently and to treat the author's claims as fixed. In practice it takes the author's.
- **pstack.** Claims are not per change. The **feature map** is the standing oracle: each feature file lists every user entry point and "what observable end state proves it works," and "a proof that drives one convenient entry point is incomplete when the map lists others" (`create-verification-skill/SKILL.md` §3). The feature map exists before the change and is maintained separately, so the author of a change doesn't write it. For formal checks, the property is fixed and changes only with cited evidence of intent (`maintain-formal-verification-skill` step 3).
- **Pocock.** `diagnosing-bugs` fixes the oracle as "the user's exact symptom" before any hypothesis. `tdd` fixes seams with the user before any test. `code-review`'s Spec axis quotes the issue for each finding.
- **Why it matters.** ImpossibleBench (cited in your research) shows read-only tests block edits but not special-casing. An author who writes "GET /health answers" as the claim has special-cased the oracle before the verifier starts. `.verify/ad81b92/report.json` C3 passed on a body reporting `"status": "unhealthy"` because the claim only asked that it "answers."

### Grader independence

- **Yours.** Strong. Author vs. verifier roles, a separate agent file, no transcript in the brief, fresh verifier per fix cycle, and the report is relayed verbatim. Gap: `verifier.md` sets no `model`, so it inherits the author's model. Your research cites self-preference data (Wataoka) and recommends a different model.
- **pstack.** Strong on intent, weaker on mechanics. "Only a verdict from an agent that did not write the code counts" (Shipping step 1). It adds **model-family diversity**: `interrogate` spawns one reviewer per configured model, `show-me-your-work` requires a different-model-family audit of the trail, and the Eval playbook requires a judge from a different family who sees outputs by sanitized label only.
- **Pocock.** `code-review` uses two fresh sub-agents, one per axis, but nothing else is independent. `diagnosing-bugs` and `tdd` are self-graded.
- **validate-work** is self-graded. It's the author checking its own work with a good checklist.

### Oracle protection

- **Yours.** Best in class. `verify_guard.py` fails closed, covers the shell write paths that issue #29709 showed agents using to get around Edit-only hooks, and is tested in the ship gate. The documented gap is real: **the author's writes are not guarded**, so tests, probes and journey specs can be weakened in the change itself. The hack-flag scan in step 6 catches this only after the fact, and only if the verifier reads the diff carefully.
- **pstack.** Prompt-only: "Never weaken the journey to make it pass" (create §3), "no baseline tampering" (visual-parity), edit-scope rules for maintainers. No hooks.
- **no-mistakes.** Has `protected_paths` with a gate that `--yes` cannot auto-approve. That's the mechanism you lack on the author side.
- **Pocock.** None.

### Real-artifact execution

- **Yours.** Real HTTP against the booted server (in-process clients explicitly rejected in PROBES.md), real browser interaction, follow-up reads to prove state changes, `server.log` sweep for ERROR lines and unasserted 5xx. Strong. One hole: step 2 says "reuse a live server" if the port answers, without checking that the live server was built from the SHA under test. In a multi-worktree setup (`PROBES.md` already warns about port collisions) that can verify the wrong code.
- **pstack.** Same stance, with two additions you lack: Doctor checks the **right version/build** and that the **port is owned by us**, and Launch must reach a usable state "from an empty data dir, including migrations and seed data. Ready means usable, not just that a process answers." It also warns that dry-run modes must be checked by observation ("some dry-runs still touch the network").
- **Pocock.** `diagnosing-bugs` ranks real loops (curl against dev server, headless browser, replayed traces) but in service of debugging, not sign-off. `implement` doesn't run the app.

### Evidence format

- **Yours.** Machine-readable `report.json` with per-claim status, evidence paths, `hack_flags`, `not_checked`, `environment`. Better than pstack's for automation. But `.verify/` is gitignored and local, and nothing copies it into the PR, so a human reviewer never sees it.
- **pstack.** Human-facing: PR `## Verification` section with 1-3 real run paths (opening-a-pr), screenshots and videos attached, verdicts posted *on the PR*, `decisions.tsv` trail audited against the transcript.
- **Pocock.** `pr` template: Before/After evidence, screenshots S-tier and execution A-tier, plus a one-way/two-way door call and blast radius.

### Project-specificity

- **Yours.** Generic. Launch discovery runs every time unless `.claude/verify-recipe.md` exists, and none does.
- **pstack.** The generator writes `.claude/skills/verify-<app>/` (Cursor path `.cursor/skills/`, mapped by `$PSTACK/docs/harness/claude-code.md`) with Launch, Doctor, Drive (real selectors from this repo), Evidence (proof standards), Cleanup, Helpers (executable scripts with invocations shown), and `features/` (README index + one file per feature with four fixed H2s). The guide goes further: when agents keep writing throwaway click scripts, build a small **control CLI** the skill calls (`06-verify-and-ship.md`, "Treat the verification skill as infrastructure").

### Self-maintenance

- **Yours.** `validate-work/LESSONS.md` is a real, working learning loop: a miss gets recorded as Context / Miss / Rule, read before every run, and consolidated past ~30 rules. `verify` has no equivalent; its learning goes into editing the generic SKILL.md or the never-written recipe.
- **pstack.** `maintain-verification-skill`: parallel read-only source readers per feature, one live pass that drives every feature, triage into doc drift / harness gap / product gap, at most one PR of proven corrections, outcome `clean` / `changed` / `blocked`. Formal maintenance tracks a **sync commit** per check. `principle-encode-lessons-in-structure`: "If the fix is structural, only use the structural fix. The instruction is the symptom." That is the critique of a growing LESSONS.md.
- **Pocock.** None beyond the commit-message note in `diagnosing-bugs` Phase 6.

### Cost control

- **Yours.** Two fix cycles max, paid or side-effecting probes only when the brief allows, CLI over MCP recommended in PROBES.md. No budget fields in `report.json` (your own research proposed a `cost` block), and no rule for when to skip verify.
- **pstack.** Tan cut from ten verifiers to one (your research, via tenten.co). Autopilot-full: a full swarm once at the code-ready head; a rebase or minor fix gets a single verifier. `benchmark-checklist` keeps perf claims honest. User-invoked triggers keep verification from firing on every edit.

### Failure handling

- **Yours.** VERIFIED / NOT VERIFIED / INCONCLUSIVE / FLAG; never downgrade FAIL; Doctor failure is INCONCLUSIVE (environment); flaky result means INCONCLUSIVE with both runs; no-op change is a legitimate result; honest stop after two cycles. Very good.
- **pstack.** Adds the maintenance triage (doc drift vs. harness gap vs. product gap), `verified-unreachable` only with the concrete prerequisite and route attempted, formal drift vs. bug with the counterexample replayed against real code, and three live-pass invariants (doctor after anything surprising, evidence survives every cleanup, nothing outlives its drive).
- **no-mistakes.** Explicit `ask-user` class for findings that challenge deliberate intent. Your `ship-gate` relay-verbatim rule is the same idea, stated more loosely.

### Formal verification

- **Yours.** None.
- **pstack.** A full create + maintain pair. Pick the riskiest promise (not the easiest), let the question pick the tool (TLA+ for ordering, code-level verifiers for every-input properties, generated-input tests where no verifier exists), show every property failing on a broken variant, record coverage + sync commit, and report what the bound doesn't cover.
- **Pocock.** `diagnosing-bugs` step 7 (property/fuzz loop) is the nearest relative.

---

## 3. What each does better

**Yours, better than both:**

- Mechanical oracle protection with a tested, fail-closed hook. Nobody else has this.
- A per-claim, machine-readable verdict schema with `not_checked` and `hack_flags`. pstack's PASS/PASS+NOTES/FAIL is coarser.
- A negative probe required on every claim, and the "trace to look for" rule for claims that something did *not* happen (log line, child process, row). The ad81b92 run used this well: zero `Launching` lines and no child processes.
- The PROBES.md backend matrix (auth, BOLA, malformed bodies, 405, oversized, GET-after-DELETE, privileged fields, idempotency, error shape on every non-2xx). pstack has nothing this concrete for APIs.
- `validate-work/LESSONS.md`. pstack has the principle but no worked equivalent for verification misses.

**pstack, better than yours:**

- Project-local, proven-once verification skills with a feature map. These turn "verify it" from a discovery exercise into a recipe.
- A maintenance loop with defined outcomes and a strict edit scope.
- Binding verdicts to landing: the per-PR verdict gates the merge, the contiguous verified run, and the `patch-id` check that the verdict still covers the code.
- "Able to fail" as a hard rule for every check (formal skills), and "prove the generated skill end to end, then confirm evidence survived cleanup."
- Model-family diversity for review and trail audits.
- Doctor that checks version/build and port ownership; Launch from an empty data dir to *usable*.
- Formal verification for the bugs that driving the app never reaches.

**Pocock, better than yours:**

- `diagnosing-bugs` Phase 1 completion criteria (red-capable, deterministic, fast, agent-runnable, already run once). This is the right bar for the "what the bug looked like" half of your bug-fix claims, which today is just "record" it.
- `tdd`'s **tautological test** anti-pattern and "expected values from an independent source." That gives you a concrete hack-flag category you don't name.
- `code-review`'s strict **two-axis separation** (Standards vs. Spec, never merged or reranked). Your `ship-gate` reviewer gets one blended brief.
- `pr`'s Before/After evidence and one-way/two-way door call, which your `ship-gate` PR body lacks.

**no-mistakes, better than yours:** author-side protected paths, intent passed verbatim to the reviewer so deliberate choices aren't flagged, and a test-quality rule that bans tests which grep implementation source. That last one is a hack-flag category your verifier should look for.

---

## 4. The generator pattern: what you'd gain, and how it applies

### What changes

Today: generic `verify` + optional `.claude/verify-recipe.md` (never written). Every run, the verifier rediscovers launch, port, env, auth and seed data from `package.json` / `pyproject.toml` / `.env`. The ad81b92 environment block (`cd adws && uv run adw_triggers/trigger_webhook.py (PORT default 8001, no .env present)`) is exactly what a recipe would have captured. The maintenance rule said to write it, and it didn't happen. **Instructions to "write a recipe when it took real work" don't fire; a generator step does.**

Proposed split:

| Layer | Owns | Lives in | Changes when |
|---|---|---|---|
| Protocol (your `verify`) | Author/verifier roles, claim fixing, read-only guard, grading rules, `report.json` schema, verdicts, fix-loop cap | `.claude/skills/verify/` (this repo; later `~/.claude/skills/`) | Rarely; when the protocol is wrong |
| Recipe (generated `verify-<app>`) | Launch, Doctor, Drive, Evidence, Cleanup, Helpers, `features/`, Gotchas | Each target repo: `.claude/skills/verify-<app>/` | When the app changes; kept honest by a maintain pass |

The verifier reads the protocol, then loads the recipe skill if one exists. pstack has no protocol layer worth the name (no schema, no guard, coarse verdicts); you have no recipe layer. Combining them is strictly better than adopting pstack's wholesale.

### What you gain

1. **Lower cost per run.** Discovery is paid once by the generator, not on every verify.
2. **A regression oracle the author doesn't write.** The verifier drives the claims *plus* every mapped feature the diff touches. This is the structural fix for "author holds the oracle."
3. **Stable handles.** Real selectors, routes, and commands, so LLM-driven drives flake less (your research cites 25-40% browser-agent failure on unfamiliar surfaces).
4. **Per-project lessons in the right place.** Each feature's `Gotchas` section is a scoped LESSONS.md, read only when that feature is driven.
5. **Shareable.** Commit it and every agent and teammate drives the app the same way. That matters at work, where the Spring Boot service is shared.

### What it costs

- A stale map is worse than none: it produces confident PASSes on paths that moved. That's why the maintain loop isn't optional.
- The feature map is now an oracle, so the author must not be able to weaken it in the same change (see improvement 6).
- Generation is per repo, and it needs a checkout that actually boots.

### Java Spring Boot backend

- **Launch.** `./mvnw spring-boot:test-run` (or `./gradlew bootTestRun`) using a `TestApplication` with `@ServiceConnection` Testcontainers beans, `server.port=0`, port read from the `Tomcat started on port` log line. From an empty DB: Flyway/Liquibase migrations plus a seed profile. Record the listener PID from `lsof -ti`, not the `mvnw` wrapper PID (your step 2 already says this).
- **Doctor.** `/actuator/health/readiness` 200; `/actuator/info` `git.commit.id` equals the SHA under test (needs `git-commit-id-maven-plugin`; this is the version check pstack requires and your skill lacks); `/actuator/flyway` shows no pending migrations; `/v3/api-docs` fetched.
- **Drive.** Committed Hurl files per feature under `verify-<app>/probes/` covering the PROBES.md matrix rows; bounded Schemathesis (`--max-time`, `--seed`) as advisory. Two tenant tokens for the BOLA row.
- **Evidence.** `hurl --test --report-junit`, Schemathesis JSON, `GET /actuator/metrics/http.server.requests?tag=status:500` before/after (must not grow), JSON-log grep for `level=ERROR` in the run window.
- **Cleanup.** Kill the listener PID; Testcontainers stop with the context; `docker compose down --volumes` if compose is used.
- **Features.** One file per resource group or bounded context (e.g. `orders.md`, `auth.md`), entry points = endpoints + any async consumer.
- **Gotchas to seed.** `@Transactional` doesn't roll back under a real port; `@MockBean` breaks the context cache; `spring.mvc.problemdetails.enabled` must be on for RFC 9457 shapes.
- **Formal candidate.** Idempotency-key replay or a job lease ("a job never runs twice at once"): TLA+ model of the lease/retry protocol, with a JUnit concurrency test as the code-level check.

### Rust project

Surface decides the recipe; a Rust repo is often a CLI or library, not a server.

- **Launch.** `cargo build --release` once, with `CARGO_TARGET_DIR` per worktree to avoid lock contention. For a CLI, each drive runs in its own temp `HOME`/`XDG_*` dir (pstack: "start each drive in its own isolated PTY or tmux session"); TUIs get a tmux session per drive. For an axum/actix service, the same shape as Spring with `/health` and a port flag.
- **Doctor.** `<bin> --version` prints the SHA embedded by `build.rs` (`vergen` or `git rev-parse` at build time) and it matches HEAD; release, not debug.
- **Drive.** Real commands with fixtures from `tests/fixtures/`; prefer `--format json` outputs for assertions; existing `assert_cmd`/`insta` tests run as part of the oracle (editing a `.snap` is a hack flag, same as Jest snapshots in your feedback-loop research §7).
- **Evidence.** Command, stdout, stderr, exit code per drive (pstack's CLI proof standard); files written, read back.
- **Cleanup.** Remove temp dirs; kill tmux sessions you created, by name you assigned.
- **Formal candidate.** Rust has the best tool fit of the three: Kani for `unsafe` blocks, overflow and data-structure invariants; `loom` for lock-free or channel code; `proptest`/`cargo fuzz` where no verifier fits; `cargo miri test` for UB. This is where `create-formal-verification-skill` pays off most.

### Node/TS web app

- **Launch.** `pnpm dev --port <free>` (or `PORT=`), ready on Vite's `Local: http://` line *and* a 200 from a real route; DB reset + seed (`prisma migrate reset --force && pnpm seed`) into a disposable DB; auth via Playwright `storageState` from a setup step. Record the listener PID: Vite and Next spawn children.
- **Doctor.** App title and a build hash or `/api/version` matching HEAD; console clean on `/`; seeded user can log in.
- **Drive.** Existing Playwright specs first (they're oracle; editing is a hack flag); then `playwright-cli` or `agent-browser` with `getByRole` handles from the feature files. CLI over MCP, per PROBES.md.
- **Evidence.** Per checkpoint: screenshot + ARIA snapshot (pstack's UI proof standard), console dump, network log, Playwright trace on failure; side effect read back by reload or API GET.
- **Cleanup.** Kill listener PIDs, drop the disposable DB, keep `artifacts/`.
- **Formal candidate.** Usually a state machine on the client (optimistic updates, websocket reconnect, offline queue): TLA+ for ordering, or `fast-check` model-based tests against the real reducer.

---

## 5. Prioritized improvements

Effort: S = under a day, M = a few days, L = a week or more.

| # | Change | Why | Inspired by | Effort |
|---|---|---|---|---|
| 1 | **Make `ship-gate` require a verdict.** For diffs touching app code, step 1 fails unless `.verify/<sha>/report.json` exists with `VERIFIED`, and its commit's `git patch-id` equals HEAD's (so a rebase that only moved the patch keeps the verdict, but any code change needs a new one). `INCONCLUSIVE`/`FLAG` route to the user, never pass silently. The PR body gets a `## Verification` section rendered from `report.json` (claim, status, evidence path) plus Pocock's one-way/two-way door line. | Today verify and ship are disconnected: a branch can ship with no verdict or a FAIL. Evidence lives in a gitignored dir no reviewer sees. | pstack Shipping steps 1 and 3; opening-a-pr `## Verification`; Pocock `pr` Evidence + Merge Danger; no-mistakes outcomes bound to `head_sha` | M |
| 2 | **Take the oracle away from the author.** Change the brief: the author supplies the ticket/issue reference, SHA, and diff; the verifier writes claims from the ticket's acceptance criteria. Author claims can be added as `author-proposed`, and the verifier must add at least one claim the author didn't name (a mapped feature the diff touches, or an untouched neighbor as regression). Add a claim-quality rule: an expected observation must name a specific status, value, or trace; "answers" or "works" makes the claim INCONCLUSIVE. | The guard protects the oracle from the verifier, but the author writes it. ad81b92 C3 passed on `"status": "unhealthy"` because the claim was "answers." | pstack feature map as standing oracle (create §3); Pocock `code-review` Spec axis quotes the issue; your research "who holds the oracle" | S |
| 3 | **Adopt the generator: `create-verify-recipe`.** User-invoked skill that interviews the repo and writes `.claude/skills/verify-<app>/` with Launch, Doctor, Drive, Evidence, Cleanup, Helpers and `features/` (pstack's four-H2 shape), then runs it once end to end and confirms evidence survived cleanup. `verify` step 2 loads it when present. Replaces the never-written `verify-recipe.md`. | Every run pays discovery cost; the "write a recipe after" rule never fired. A feature map gives the regression oracle improvement 2 needs. | pstack `create-verification-skill` + feature-map-example | L |
| 4 | **Prove the verifier can fail.** (a) Bug fixes: the verifier runs the claims against the parent SHA first and must see the bug (FAIL), then against head (PASS); a bug claim that passes on the parent is INCONCLUSIVE. (b) Per recipe: one seeded-failure run on a scratch branch (remove a validation, flip a status) that must come back NOT VERIFIED; record `seeded_failure_verified` with date and SHA in the recipe. Re-run after model or skill changes. | Negative probes test the app, not the verifier. A verifier that never returned FAIL has an unknown catch rate. Your own LESSONS.md rule: "run the arm that is supposed to fail first." | pstack Shipping "parent against head"; formal "Able to fail"; Pocock `diagnosing-bugs` red-capable loop; research `seeded_failure_verified` | M |
| 5 | **Bind the running instance to the SHA.** Replace "reuse a live server" with: reuse only if Doctor proves it serves the SHA under test (version endpoint, `--version`, build hash) and the verifier's run owns the port; otherwise launch fresh on a free port. Doctor also requires required dependencies healthy: a degraded `/health` makes the run INCONCLUSIVE (environment), not PASS. | A live server from another worktree verifies the wrong code. ad81b92 graded around an unhealthy dependency. | pstack Doctor ("right version/build, port owned by us"); Launch "ready means usable" | S |
| 6 | **Protect the oracle from the author too.** A deterministic check in `ship_gate.py`: if the diff edits test files, `probes/`, `features/`, Playwright specs or `.snap` files *and* product code, the gate exits non-zero unless the commit carries an explicit `Oracle-Change:` trailer with a reason, which the PR body must surface. Keep feature-map changes in their own PR (pstack edit scope). | Your skill's Known gaps says it: "protecting tests from the author is a separate problem." ImpossibleBench: Claude models used test modification in >79% of cheats. A deterministic gate beats a hack-flag the verifier may miss. | no-mistakes `protected_paths`; pstack maintain edit scope; your research rung 4 "hard rules block" | M |
| 7 | **Add `maintain-verify-recipe`.** Outcomes `clean`/`changed`/`blocked`; one read-only source reader per feature in parallel, then one live pass over every feature; triage drift vs. harness gap vs. product gap; edits limited to the recipe directory; record a sync commit in the recipe README. Schedule it weekly per active repo (pstack says daily; start cheaper). | Without it, improvement 3 rots into false confidence. | pstack `maintain-verification-skill`; formal sync-commit idea | M |
| 8 | **Diversify the grader's model.** Set `model:` in `.claude/agents/verifier.md` to a different model than the typical author (e.g. `sonnet` when authoring on Opus), and record both models in `report.json`. Split the `ship-gate` reviewer into Pocock's two axes (Standards, Spec), reported separately. | Self-preference bias (research: GPT-4 recall 0.945 vs 0.425). Blended review lets one axis mask the other. | pstack `interrogate`, show-me-your-work cross-model audit; Pocock `code-review` | S |
| 9 | **Widen the hack-flag list.** Add: tests that grep or snapshot implementation source; tautological assertions (expected value recomputed the way the code does); snapshot regeneration; broadened catch-all error matching; "sudden pass after repeated failures" as a FLAG trigger. | The current list (edited/deleted tests, weakened assertions, skip/xfail, special-casing, broadened locators) misses the forms agents actually use. | no-mistakes Test-quality rule; Pocock `tdd` anti-patterns; research ImpossibleBench | S |
| 10 | **Give `verify` a LESSONS loop, and encode lessons as structure.** Add `.claude/skills/verify/LESSONS.md` in the validate-work format, for protocol-level misses (feature-level misses go in the recipe's Gotchas). When a rule can be a script, make it one: e.g. validate-work's "exit 0 is not proof" becomes a helper that parses pytest/JUnit counts and fails on zero tests. | validate-work's loop works; verify has none. pstack: "the instruction is the symptom." | Your `validate-work/LESSONS.md`; pstack `principle-encode-lessons-in-structure` | S |
| 11 | **Let `validate-work` use the independent verifier.** Add an author/verifier split mirroring `verify`: for harness, eval and grader changes, dispatch `verifier` with the claims; the guard already works for any target. Keep self-validation for docs and small scripts. | validate-work is self-graded, but its LESSONS show exactly the misses an independent grader catches (round-trip fixture, mocked cwd). | Your own `verify` design; pstack "author checks what it meant to build" | S |
| 12 | **Record cost and set a trigger policy.** Add `cost: {tokens, wall_clock_s, fix_cycles}` to `report.json`. Define when verify can be skipped (docs-only, test-only diffs) and when one verifier is enough vs. a second lane (new behavior or large diff, per pstack's swarm-once rule). | `verify` is model-invoked on every app edit; you can't tune cost you don't record. | pstack autopilot-full step 4; research `cost` field and "measure bug yield per rung" | S |
| 13 | **Decision trail for long verify/fix loops.** When a fix loop runs, or verify runs inside an ADW pipeline, append `decisions.tsv` rows (claim set fixed, cycle N result, stop reason) using pstack's columns. | Overnight and pipeline runs need an auditable trail; the report shows the final state, not the path. | pstack `show-me-your-work` + `scripts/log.sh` | S |
| 14 | **One formal check on the harness.** Pick the riskiest promise in ADW (candidate: resume after a paused run never loses `run_env` or re-runs a completed phase; the LESSONS entry of 2026-07-22 is a real miss here). Model it in TLA+ or as a property test over the real `TravisState` writer, show it failing on a broken variant, record a sync commit. | Your two hardest-won lessons (round-trip persistence, state lagging work) are state-machine bugs that driving the app rarely reaches. | pstack `create-formal-verification-skill` | L |

---

## 6. Open design questions (for a grilling session)

1. **Who owns the oracle?** Ticket acceptance criteria, the feature map, the author, or you? If the ticket is thin, does the verifier refuse (INCONCLUSIVE) or derive claims from the diff? What do you do when the ticket and the feature map disagree?
2. **Protocol + recipe, or one generated skill?** Is the split in §4 worth two skills, or should the generator emit a complete `verify-<app>` that embeds the protocol (pstack's shape)? Where does the protocol live once it leaves this repo: `~/.claude/skills/verify/`?
3. **What blocks a ship?** Should `ship-gate` hard-block on `INCONCLUSIVE` (environment broke) and on `FLAG` (proposed oracle change), or only on `NOT VERIFIED`? Who can override, and how is the override recorded (`--skip-precheck`-style loud log)?
4. **SHA or patch-id?** Is a verdict bound to a commit, or to a patch so it survives a clean rebase? If patch-id, what counts as noise (pstack's "tests, docs, lint config" rule)?
5. **Side-effecting paths.** ad81b92 couldn't verify the triggering path because it launches real workflows and posts to GitHub. Do you build a dry-run mode or a fake GitHub for verification, and how do you prove the dry-run really skips the network (pstack's warning)?
6. **Model diversity in practice.** Is Sonnet-verifying-Opus a real gain, or a weaker grader with a different bias? Is a non-Anthropic verifier (via CLI) worth the plumbing for the work Spring Boot service?
7. **Author-side protection.** Hard gate in `ship_gate.py` with a trailer escape hatch, a PreToolUse hook on the main session that protects `tests/`, or both? Does the ADW Execute agent get the same hook as the verifier?
8. **Feature-map governance.** Can a feature PR also update the feature map, or must map changes land separately and first? Who reviews a map change: you, or a verifier?
9. **Cadence and budget.** How often does `maintain-verify-recipe` run per repo, and what's the token ceiling per verify run before it stops INCONCLUSIVE?
10. **Merge `verify` and `validate-work`?** The app/non-app split means two procedures, two verdict vocabularies (VERIFIED vs. VALIDATED), one with a guard and one without. Is one protocol with surface-specific recipes cleaner?
11. **Evidence retention.** Local only, attached to the PR (screenshots, a rendered report), or committed for one-way-door changes? What survives `git worktree remove`?
12. **One-way doors.** Migrations, data backfills, public API changes can't be proven by booting locally. What's the verification contract for them: rehearsal on a prod snapshot, a human floor, or both? (Tan called this an open industry problem; your research lists it as a permanent human floor.)
13. **Formal target.** Is the ADW resume/state machine the right first property, or is the work service's idempotency/lease logic a better use of the effort?

---

## Gaps in this comparison

- Pocock's GitHub repo (`mattpocock/skills`) was not re-fetched; this compares the installed copies under `~/.agents/skills/`, which may lag upstream. No dedicated Pocock verification skill exists in the installed set.
- pstack's `control-ui` / `control-cli` skills (from `cursor-team-kit`, referenced by Shipping and poteto-mode) are not installed, so their drive mechanics weren't read.
- Only one real `verify` run exists on disk (`.verify/ad81b92`), and it ran on unchanged code (no diff), so the hack-flag scan and fix loop have never been exercised for real. Claims about how they behave come from the skill text, not observed runs.
- Effort estimates are judgment, not measured.
