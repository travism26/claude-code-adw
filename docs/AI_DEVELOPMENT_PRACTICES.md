# AI Development Best Practices — a living document

> **Status: superseded in part.** This document predates
> [`docs/claude-code-playbook/`](claude-code-playbook/README.md), which is now the current
> statement of how we work with coding agents. The playbook covers context economics, session
> management, delegation, and the five plays (feature delivery, product intake, incident
> response, debugging, CI feedback), and is written to be shared outside this repo.
>
> This file remains useful for what the playbook does not cover: the verification ladder,
> observability design, deep modules, and testing at boundaries — i.e. *shaping a codebase* so
> agents can work in it, as opposed to *shaping a session*. Where the two disagree, the playbook
> is current.
>
> Note that the playbook deliberately does not link back here: it is a standalone artifact and
> must not depend on anything else in this repository.

**Organizing principle: the feedback loop.** Every practice in this document earns its place by
answering one question: *how quickly and reliably can we go from "the AI made a change" to
"we know it works — or know exactly how it's broken"?* That speed-and-trustworthiness of
verification is the feedback loop. A tight loop lets the agent catch its own mistakes before a
human ever sees them; a loose loop is where slop accumulates.

> **This document grows.** It is not finished and never will be. See [§8 Maintaining this
> document](#8-maintaining-this-document) for the admission test a new practice must pass and the
> format an entry takes. Companion docs: [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md)
> covers *process* (spec → branch → gate → PR); this one covers *practices* — what the codebase
> and the verification ritual should look like so that process has teeth.

**How to read this: guidelines, not law.** Everything below is a default, not a mandate — we
code how we want to code, and a practice that fights the work at hand should lose. The
imperative voice ("do", "never") describes what a tight loop looks like, not a rule you owe
anyone; deviating is fine when it's *deliberate* — you know which rung you're skipping and why.
The exceptions are a small set of load-bearing rules where deviation predictably produces slop
rather than style. If you keep only five things from this document, keep these:

1. **Report honestly, with evidence.** Never claim a check ran when it didn't (§5). A false
   "verified" poisons every downstream decision.
2. **Never build on a red baseline** (§4). Verdicts stop being attributable the moment you do.
3. **Never retry a flaky check into submission** (§3). It teaches the agent — and you — that
   failures are sometimes noise.
4. **Run the thing before calling it done** (§5). Diff-looks-right is not a rung.
5. **Don't let the agent invent architecture unaided** (§2). Shallow sprawl is its default, and
   it compounds.

Everything else — the ladder's exact rungs, PRDs, tickets, log sweeps, budgets — is technique:
adopt what pays in your context, skip what doesn't, and say so.

---

## 0. The verification ladder

When the agent finishes a change, it should climb this ladder — cheapest, fastest, most
deterministic rungs first. Each rung catches a class of mistake the previous rung can't see.

| Rung | Check | Feedback speed | What it catches |
| --- | --- | --- | --- |
| 1 | Typecheck / compile | seconds | wrong shapes, broken references, misuse of interfaces |
| 2 | Lint + format | seconds | convention drift, suspicious patterns, dead code |
| 3 | Fast deterministic tests (at module interfaces) | seconds–minutes | broken behavior behind the interfaces you touched |
| 4 | Run the app for real — exercise endpoints and UI | minutes | integration breaks, wiring mistakes, "works in tests, dead in the app" |
| 5 | Sweep the logs for unexpected exceptions | minutes | failures the frontend swallowed; errors on paths you didn't think you touched |
| 6 | Metrics / performance budgets | minutes | regressions that are invisible to correctness checks |
| 7 | Independent review (fresh agent, then human) | slow, judgment | spec drift, design mistakes, everything machines miss |

Two rules fall out of the ladder:

- **Never skip to a higher rung to "save time."** Rung 4 evidence is worthless if rung 1 is red —
  and rung 7 (human attention) is the most expensive resource in the loop; spend the cheap rungs
  first so review reads a change that already survived the machines.
- **A change isn't "done" until it has climbed as high as its risk warrants.** A doc typo stops at
  rung 2. A change to a request path climbs through 5. Anything touching performance-sensitive
  code climbs through 6.

**The ten-minute bound.** Three independent sources (Fowler's CI writing, DORA's CI and
test-automation research) converge on the same number: feedback slower than ~10 minutes degrades
the loop. That bound bites agents harder than humans — an agent iterates dozens of times per
task, so a slow rung multiplies. Rungs 1–3 should run in seconds-to-minutes locally, every time.

In this repo, rungs 4–5 are operationalized as the `verify` skill (frontend/backend changes: run
the app, observe real behavior in the browser) and `validate-work` (scripts/evals/graders: execute
the real thing, never declare done from reading code).

---

## 1. Observability built for the loop

Logging is not an afterthought for production debugging — it is a **verification instrument the
agent uses on every change**. Design it so that "exercise the app, then sweep the logs" is a
five-minute ritual with a trustworthy verdict.

**Do:**

- **Structured, leveled, searchable.** Every log line carries a level (`debug`/`info`/`warn`/
  `error`), a consistent machine-parseable shape, and enough context (module, operation,
  identifiers) to be greppable. If the agent can't filter logs with one command, the logs don't
  participate in the loop.
- **Correlate across the seam.** A request that crosses frontend → backend carries a correlation
  ID on both sides, so one grep reconstructs the whole journey. Most integration bugs live at
  exactly this seam; make the seam observable. Use the W3C Trace Context `traceparent` header
  rather than a homegrown ID — existing tooling already speaks it. (Honesty note: correlation IDs
  are backed as *distributed-systems* practice; their payoff for agent loops specifically is our
  hypothesis, worth an eval, not a citation.)
- **Ask "how will I know if this is broken?" before merging.** Charity Majors' observability-
  driven development question, asked of every change in review. The answer — a metric, a log
  line, a trace — is a concrete check, and requiring the agent to answer it in its plan forces
  instrumentation to exist *before* it's needed.
- **Log exceptions once, at the seam, with context.** An error caught and logged at the module
  interface — with the inputs that produced it — beats the same error logged four times at four
  depths with no context. Silent `catch` blocks are banned: an error the logs never saw is an
  error the loop can never catch.
- **Quiet by default.** At `info` level a healthy run should be near-silent, so that anything
  unexpected *stands out*. Log spam is worse than no logging: it trains both humans and agents to
  ignore the instrument. Signal-to-noise is the metric, not volume.
- **Document where the logs are.** In the agent context file (§6): where dev logs land, how to
  tail them, one example grep for "unexpected errors since I started the app." An instrument the
  agent can't find doesn't exist.

**The ritual (rungs 4–5):** run both ends of the app → exercise the changed paths (hit the
endpoints, click through the UI) → the surface *looks* fine → now sweep the logs for anything at
`warn`+ that you didn't expect → then check the metrics you have (request timings, memory, bundle
size) against their pre-change values.

**Candid limits:** a clean log sweep is a *backstop*, not a proof. It catches the failure class
the UI hides — the backend threw, the frontend shrugged — but absence of errors is not presence
of correctness. The sweep supplements rung 3's asserted behavior; it never replaces it. If a bug
class keeps surviving to the log sweep, that's a signal a test at rung 3 is missing — capture it
(see §3, regression capture). Evidence status: "run the app" is vendor-backed practice
(Cognition: "Devin will spin up the app, click through it, and confirm its changes actually
work"), but the log-grep step itself appears in **no primary source** — it's our extension, whose
nearest authoritative relative is Charity Majors' post-deploy instrumentation check. That means
it stays because it's cheap and plausible, and if we ever wire it into the harness as a gate, we
measure it (eval-task capture exists for exactly this) rather than assume it.

**Metrics as feedback, not dashboards:** the loop only needs a handful — request duration on hot
endpoints, bundle size, memory on long-running processes — with a *recorded baseline* to compare
against. "Did we degrade performance?" must be answerable in minutes or it won't be asked. A
performance *budget* (web.dev's framing, enforceable via Lighthouse CI / bundlesize) upgrades
this from a question to a pass/fail check an agent can run — the property every strong practice
in this doc shares.

---

## 2. Architecture: deep modules

*(Source: John Ousterhout, "A Philosophy of Software Design." Operational tooling available to
the agent, from Matt Pocock's public skills pack (https://github.com/mattpocock/skills): the
`/codebase-design` skill defines the shared vocabulary — module, interface, depth,
seam, adapter, leverage, locality — and `/improve-codebase-architecture` scans a codebase for
deepening opportunities.)*

A **deep module** hides a lot of behavior behind a small interface. A **shallow module** has an
interface nearly as complex as its implementation — it adds a name and a hop, but no leverage.

Depth is a feedback-loop property, twice over:

- **Navigability.** An agent reasoning about a change must hold the dependency graph in context.
  A thousand shallow files that each import each other force it to walk the whole graph
  ("this relies on this, which relies on this…") and it will get the graph wrong. A few deep
  modules mean the agent reads one small interface and trusts it.
- **Testability.** *The interface is the test surface.* A deep module gets one test boundary
  around its small interface, and those tests exercise a lot of real behavior per test. Shallow
  modules force the miserable choice Pocock describes: wrap every tiny function in its own test
  boundary (and then mock its neighbors — see §3), or test vague groups of modules together and
  hope.

**Do:**

- **Draw the test boundary at the module interface**, not around individual functions.
- **Apply the deletion test** to suspected shallow modules: would deleting this module and
  inlining it *concentrate* complexity, or just relocate it? "Concentrates" means it was shallow
  — fold it in.
- **Define errors out of existence** where possible: design interfaces so invalid states can't be
  expressed, rather than validating and throwing everywhere. Ousterhout names the anti-pattern
  directly — defensive programming that throws "for anything that looks a tiny bit suspicious."
  This is also *feedback-signal hygiene*: every spurious error path is noise in the exact channel
  §1's log sweep greps, so a codebase that only raises when something is genuinely wrong makes
  "any ERROR after my change" a high-precision oracle.
- **Run `/improve-codebase-architecture` periodically** — especially over the areas the git log
  shows are hot — and treat "deepening" refactors as first-class work, not gold-plating.

**AI failure mode — direct against it explicitly:** unaided, coding agents *default* to shallow
sprawl: many small files, a helper per thought, pure functions extracted "for testability" while
the real bugs hide in how they're called. This is the single most reliable way an AI degrades a
codebase while every individual diff looks reasonable. The countermeasure is direction, not
vigilance-after-the-fact: state the target module and its interface *in the task prompt*, and
reject diffs that add modules nobody asked for.

---

## 3. Testing where the boundaries are

Tests are the loop's core oracle — the only rung that *asserts* behavior rather than observing
it. Their value is set by two properties: **speed** (do they run on every change without anyone
deciding to run them?) and **boundary placement** (do they test promises, or wiring?).

**Do:**

- **Test through the module interface (§2).** Assert what the module promises its callers, not
  how it's built. These tests survive refactors — which means the agent can refactor and *trust
  the verdict*.
- **Prefer real collaborators over mocks inside a boundary.** A mock-heavy test asserts "the code
  calls the functions I expected in the order I expected" — that's testing the implementation,
  and it goes green while the app is broken (mis-ordered calls between modules, exactly Pocock's
  example, sail through). Fowler documents the cost plainly: mockist tests are "more coupled to
  the implementation" and "interfere with refactoring"; Anthropic's own canonical test-writing
  prompt ends "avoid mocks." Mock only at expensive seams: the network, the clock, paid APIs.
- **Keep a fast deterministic tier that always runs.** Seconds, no network, no credentials, no
  flakiness. A slow or flaky suite exits the loop de facto: it stops being run, then stops being
  trusted.
- **Quarantine flakes out of agent-facing gates — never retry-until-green.** Google's math: at
  even a 0.1% false-failure rate over 10,000 daily runs you investigate 10 ghosts a day. For an
  agent the damage is worse than the wasted time: a model that has seen flakes learns the fatal
  heuristic *"failures are sometimes noise"* — after which every real failure can be rationalized
  away. DORA states the bar positively: "test failures should indicate a real defect." A flaky
  check is a bug in the loop itself; pull it from the gate until it's fixed.
- **Capture regressions from real failures.** When a bug survives to rung 4/5 (or to production),
  the fix isn't complete until the failure exists as a fixture the fast tier replays. This is how
  the suite tracks the failure modes *this* codebase actually has, instead of the ones a
  test-writer imagined. (This repo's `--auto-capture` flag is the harness-level version of the
  same idea.)
- **Behavioral oracles over output-matching for AI-authored code.** Where feasible, assert
  properties and behaviors ("paginating past the end returns an empty page and a correct total")
  rather than golden outputs — golden-output tests are the ones agents most readily overfit to.

**AI failure modes:** (1) the mock maze — agent wraps every function in a test file that mocks
every import; hundreds of green tests, zero behavioral coverage; reject these in review. (2)
Testing to the implementation it just wrote — the agent authors code and tests from the same
misunderstanding, and they agree with each other. Countermeasures: state the expected behavior in
the task (or write the test first — the `tdd` skill), and have review compare tests to the
*spec*, not to the code. (3) The self-modifiable oracle — snapshot tests pin *current* output,
not *correct* output, and `jest -u` regenerates them wholesale, so an agent under pressure to go
green can "fix" a failure by updating the snapshot. Any diff to `.snap` files (or any golden
fixture) gets the same review scrutiny as a diff to test assertions.

---

## 4. Machine gates before judgment

Everything a machine can check deterministically should be checked by a machine, automatically,
before any human or review-agent judgment is spent.

- **Typecheck, lint, format, build — instant and strict.** For an AI-heavy workflow the type
  system is the highest-value gate per unit cost: it's the one oracle that reads *every line* of
  every diff in seconds — and the one practice here with a controlled study behind it (ICSE 2017:
  TypeScript/Flow annotations alone detect **15% of real shipped bugs**, a conservative floor
  since those bugs had already survived testing and review). Prefer typed languages/configs
  (`strict` on) for code agents will maintain; surface typechecker output to the agent after
  every edit, not only at gate time.
- **One command runs the whole deterministic gate.** `make check` / `npm run check` /
  `uv run check` — whatever it is, there is exactly one, it's documented in the agent context
  file, and it's what "green" means. If checking requires remembering four commands, the agent
  will run three.
- **Keep the gate fast enough to never skip.** The deterministic tier is the thing that runs
  after *every* change, not at the end of the day. Budget single-digit minutes, ideally seconds.
- **Encode review nits as lint rules.** The third time a reviewer (human or agent) flags the same
  pattern, it becomes a lint rule and exits the judgment budget forever.
- **Enforce; don't advise.** Anything that must *always* happen — typecheck after edit, the gate
  before "done", a commit guard — belongs in enforced machinery (hooks, fail-closed pipeline
  steps), not in prose instructions. Anthropic's docs draw the line explicitly: CLAUDE.md
  instructions are *advisory*; hooks are *deterministic* and "guarantee the action happens." A
  model under long context can deprioritize prose; it cannot deprioritize a blocking hook.
- **Never build on a red baseline.** Fowler's CI rule — nothing outranks fixing a broken build,
  and the default remedy is revert — maps directly onto agents: a check that was already failing
  before the change makes every subsequent verdict unattributable. Green baseline first, then
  work.

---

## 5. Run the thing

No change to running software is done because its diff looks right and its tests pass. Rung 4 is
mandatory for anything user-facing: **start the app and observe the real behavior.** This is the
strongest vendor-backed claim on the list — Cognition's stated reason for building verification
into Devin is that "a clean review alone often isn't enough."

- Frontend/backend changes: run both ends, exercise the changed flow in a real browser, watch the
  network tab, then do the §1 log sweep. (Skill: `verify`.)
- **For UI, close the loop with screenshots.** All three agent vendors independently converge on
  visual feedback — screenshot the result, compare against the design or the pre-change state,
  list differences, fix. Text oracles are weakest exactly where pixels are the product.
- Scripts, evals, graders, harness code: execute the real script on real input — including the
  *failure* path — and read its output. (Skill: `validate-work`.)
- **Make "run the thing" cheap or it won't happen.** One command to bring up the full dev stack,
  seeded with realistic data, ports and URLs documented. Every point of friction here is
  multiplied by every change ever made. A smoke script that hits the main endpoints and greps the
  logs turns rungs 4–5 into a single command — write one per project.
- **The dev environment is loop infrastructure, not a chore.** An agent can only run checks where
  checks run — OpenAI's Codex docs describe the agent's entire loop as "edits code, runs checks,
  and tries to validate its work," and their environment provisioning exists to make that
  possible. "The app comes up from a clean checkout with one documented command" is a
  verification *feature*; every undocumented setup quirk is a rung the agent can't climb.
- **Show evidence, don't assert success.** "Done" claims carry the check's actual output — the
  test run, the command and what it returned, the screenshot. A claim without attached evidence
  is unverified by construction, and reviewing evidence is faster than re-running the check.
  Conversely: "tests pass" when only typecheck ran poisons the loop worse than any bug — every
  downstream decision inherits the lie. If a rung was skipped, the report says so.

---

## 6. Make the codebase legible to agents

The agent's feedback loop starts before any check runs: it has to *find* the commands, the
conventions, and the instruments. Context files (`CLAUDE.md` / `AGENTS.md`) are the interface the
codebase exposes to the agent — keep them deep, like any interface (§2): small, dense,
load-bearing.

The context file must answer, in one screen:

1. How do I run the app? (one command, plus where it serves)
2. How do I run the deterministic gate? (§4's one command)
3. Where are the logs and how do I sweep them? (§1)
4. What are the non-negotiables? (the rules that are *this* project's — e.g. this repo's "don't
   fix the planted eval defects", "everything runs via `uv run`")
5. Where is the domain vocabulary? (`CONTEXT.md`, ADRs — names for the seams, decisions not to
   re-litigate)

**Do:**

- **List the checks, and the agent runs them.** This is the documented payoff of the whole
  section — AGENTS.md's own FAQ: "The agent will attempt to execute relevant programmatic checks
  and fix failures before finishing the task." The context file is the *routing layer* of the
  feedback loop: it's what turns "a test suite exists" into "the agent runs it before declaring
  done."
- **One obvious way to do each thing.** Two ways to run tests means the agent picks the wrong one
  half the time. Delete or document-as-deprecated every duplicate path.
- **Write error messages for the machine reader.** The agent pastes error output into its own
  context; an error that names the failing invariant and the likely fix ("port 5432 in use — is
  another dev DB running? see docs/dev-setup.md") closes the loop in one hop instead of a
  research detour. (No primary source names this practice — it's ours; the agent is simply a new
  primary consumer of error text.)
- **Keep context files curated, not accumulated.** Stale instructions are worse than missing ones
  — the agent follows them confidently — and every vendor documents the bloat anti-pattern
  (Anthropic: "Bloated CLAUDE.md files cause Claude to ignore your actual instructions!"; Cursor
  caps rules at 500 lines). The pruning test, from Anthropic's docs: for each line ask *"Would
  removing this cause the agent to make mistakes?"* If not, cut it.

---

## 7. Process: small diffs, fresh eyes, human at the decision points

Practices above make verification *possible*; process makes it *happen*. The full process lives
in [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md) — the practices that most protect the
feedback loop:

- **Small diffs.** Review quality degrades with diff size faster than anything else in the loop —
  for agent reviewers (context) and humans (attention) alike. Google's yardstick: ~100 lines is a
  reasonable CL, ~1000 is usually too large; "when in doubt, write CLs that are smaller than you
  think you need." DORA goes further for our exact situation, calling small batches "a safety net
  for AI adoption" — the counterweight to the delivery instability their research associates with
  AI-accelerated code production. Small diffs also shrink the *blame radius*: when a check fails,
  the cause lives inside the diff, and a 100-line diff is a searchable cause set. One task, one
  commit; one concern, one PR.
- **Spec before code.** The spec is the oracle for rung 7 — without it, review can only check
  that the code does *something* plausibly, not the *right* thing. Acceptance criteria written
  before implementation are the antidote to §3's "tests agree with the code's misunderstanding."
- **Separate the doer from the grader.** A fresh agent with no memory of writing the code reviews
  the diff against the spec, before the human ever looks — Anthropic's docs state the reason
  ("a fresh context improves code review since Claude won't be biased toward code it just
  wrote"), and Cursor ships it as product (Bugbot). One documented caution: a reviewer told to
  find gaps *will usually report some, even when the work is sound* — so review verdicts get
  verified against the spec too, not auto-applied.
- **The human owns direction, not lines.** Sign-off at spec, plan, and merge. The machines and
  the ladder handle the lines.

### Phase-based workflows (the seven-phase shape)

Matt Pocock's flow — Idea → Research* → Prototype* → PRD → Kanban → Implementation → QA plan
(*optional) — is the fullest articulation of phase-based agentic development, and its thinking
layer is available to the agent via his public skills pack (https://github.com/mattpocock/skills:
`/to-spec` = PRD, `/to-tickets` = Kanban, `prototype`, `research`). We researched it against the independent implementations
(GitHub Spec Kit, AWS Kiro, Task Master) *and* its published critics — full verdicts with
citations in [`docs/research/seven-phase-workflow-research.md`](research/seven-phase-workflow-research.md).
What survives scrutiny, as guidelines:

- **The core is PRD → tickets → implement, and it's already our loop.** All four independent
  implementations converged on exactly these three; they're the Specify → Plan/Tasks → Implement
  of `DEVELOPMENT_WORKFLOW.md` under other names. Nothing new to adopt — the phases are
  vocabulary, not process change.
- **Match artifact weight to change size.** The single best-documented failure mode of
  spec-driven work is ceremony below the threshold: Thoughtworks' hands-on trial watched a small
  bug become "4 user stories with 16 acceptance criteria," two practitioner trials measured ~10×
  slower for equivalent quality, and Kiro's own docs say a quick chat fix is fine for
  straightforward issues. A PRD is for work large or uncertain enough that the *destination*
  needs writing down. Below that, just fix the thing — the ladder (§0) still applies; the
  paperwork doesn't.
- **A spec is advisory; checks are binding.** The same trial found agents "not follow[ing] all
  the instructions" in the spec they were given — the documented "false sense of control." Write
  the PRD as the *review oracle* (spec-before-code, above), but let machine-verifiable checks
  (§4) carry the enforcement. A QA plan for the human reviewer is a good complement; it is never
  a substitute for checks that run.
- **Prototype before PRD when the design is uncertain.** The spike-solution tradition backs the
  ordering: throwaway code exists to buy the knowledge the spec needs ("concrete examples are
  more valuable than abstract descriptions"). Throwaway from day one — the prototype's output is
  a decision, not code. (Skill: `prototype`.)
- **Research is a cache with an expiry.** A `research.md` earns its keep when execution would
  need difficult explore phases — and goes stale: sprint-scoped by its own author, because
  outdated research "cause[s] agents to take wrong turns."
- **The unattended ticket loop needs guardrails its inventor states plainly.** Nondeterminism is
  its "Achilles' heel"; expect to "wake up to a broken codebase" sometimes; greenfield-only
  ("no way in heck would I use Ralph in an existing code base"); senior judgment stays in the
  loop. Attended ticket-by-ticket execution with gates between tickets (this repo's mode) keeps
  the convergent benefits without those risks.

---

## 8. Maintaining this document

This document is append-mostly and deliberately hard to get into:

**Admission test.** A new practice enters only if (a) it demonstrably tightens the feedback loop
— faster verdicts or more trustworthy verdicts — and (b) it earned its place *here*: it burned us
in a real session, or we proved it helped in a real run (an eval A/B, a caught-in-review class of
bug, a measurable loop speedup). No practices imported on vibes; "everyone says so" is what
[`docs/research/`](research/) is for — park it there with a citation until it graduates.

**Entry format.** Each practice states: *what to do*, *why it tightens the loop*, and where
relevant *the AI failure mode it counters*. If a skill or command available to the agent operationalizes
it, name the skill — a practice with a tool gets used; a practice that's only prose gets recited.

**Removal.** A practice that stops paying (tooling made it obsolete, or we routinely ignore it
without harm) gets removed, with a line in the changelog saying why. A best-practices doc that
only grows becomes §1's log spam: noise that trains readers to skim.

**Sources & research.** Primary-source verdicts — with exact citations — on which of these
practices have authoritative backing vs. folklore live in
[`docs/research/feedback-loop-practices-research.md`](research/feedback-loop-practices-research.md).
Every uncited quote in this document is sourced there.

**Parked candidates** (researched, not yet admitted — plausible but unproven for agent loops, and
not yet earned here): feature flags as small-batch enablers (real carrying cost — Ousterhout-style
conditional complexity); correlation IDs' *measured* effect on agent debugging (the mechanism is
in §1, the benefit claim awaits an eval — MR02's two-repo setup is the natural testbed);
performance budgets as agent gates for app code (we only budget our own eval cost/latency today).

## Changelog

- **2026-08-17** — Initial version. Seeded from Matt Pocock's feedback-loop talk (deep vs shallow
  modules, per Ousterhout's *A Philosophy of Software Design*) and the author's observability notes
  (log-sweep ritual, correlation across the frontend/backend seam, metrics as regression
  detection); generalized with the verification ladder, testing-boundary, machine-gate,
  run-the-thing, legibility, and process sections.
- **2026-08-17** — Integrated primary-source research (`docs/research/`): added the ten-minute
  bound (§0), the ODD "how will you know if this is broken?" question and the honesty note that
  the log-grep step is our own synthesis (§1), error-paths-as-signal-hygiene (§2), flake
  quarantine and the snapshot self-modifiable-oracle hazard (§3), the ICSE-2017 15% figure,
  enforce-don't-advise, and the red-baseline rule (§4), reproducible environments and
  evidence-over-assertion (§5), the context-file pruning test (§6), Google/DORA small-diff
  numbers and the grader-over-trigger caution (§7), and the parked-candidates list (§8).
- **2026-08-17** — Added the "guidelines, not law" reading note with the five load-bearing
  rules, and the phase-based-workflows subsection (§7): Pocock's seven phases researched against
  Spec Kit / Kiro / Task Master and their published critics
  (`docs/research/seven-phase-workflow-research.md`); verdict — PRD→tickets→implement is the
  convergent core we already run, artifact weight must match change size, specs are advisory
  while checks are binding, and unattended ticket loops carry inventor-stated guardrails.
