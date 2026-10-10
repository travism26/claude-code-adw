# Feedback-loop practices for AI-assisted development: what the primary sources actually say

**Date:** 2026-08-17
**Question:** Beyond (1) structured, searchable logging and (2) Ousterhout-style deep modules, what practices measurably improve the *feedback loop* in AI-assisted software development — how quickly and reliably a coding agent goes from "change made" to "confidence it works or knows it's broken"?
**Method:** Every claim below was checked against the source that owns it (fetched 2026-08-17). Where a source was unreachable or a specific figure could not be verified on the fetched page, that is stated explicitly instead of paraphrasing from memory. No secondary write-ups were used as evidence.

---

## Executive summary

**Authoritatively backed, with the strongest evidence:**

- **Give the agent a check it can run** — this is the umbrella principle every vendor states outright. Anthropic: agents must "gain 'ground truth' from the environment at each step"; Claude Code docs: "Give Claude something that produces a pass or fail, and the loop closes on its own." Cognition ships an entire product around it ("Devin will spin up the app, click through it, and confirm its changes actually work"). OpenAI Codex's environment docs describe the agent's core loop as "edits code, runs checks, and tries to validate its work."
- **Fast (<10 min), deterministic, developer-owned test suites** (DORA, Fowler, Google) — the only area with quantitative cross-company research behind it.
- **Type systems as instant machine feedback** — one real controlled study (ICSE 2017: TypeScript/Flow detect 15% of public bugs) plus explicit vendor guidance ("generate TypeScript and lint it… multiple additional layers of feedback").
- **Small-diff discipline** (Google eng-practices; DORA calls small batches "a safety net for AI adoption" and says it "predicts software delivery performance").
- **Context files (CLAUDE.md / AGENTS.md / rules)** — backed by every vendor's own docs, including the instruction to put *test commands* in them so the agent runs checks before finishing; but backed by vendor guidance, not by any published controlled measurement.

**Folklore or unverified as stated:**

- "Sweep the logs for unexpected exceptions after exercising endpoints" as a named agent-verification step — no primary source describes this practice. The adjacent ideas (run the app end-to-end; check your instrumentation after shipping) are backed; the log-grep step itself is our own synthesis.
- Performance budgets and correlation IDs are well-specified practices (web.dev, W3C) but **nobody has published evidence tying them to agent feedback-loop speed** — they're infrastructure the loop *could* use, not measured accelerants.

**What our list missed (see final section):** reproducible pre-provisioned dev environments, deterministic gates vs. advisory instructions, fresh-context adversarial review (separating the doer from the grader), evidence-over-assertion reporting, flake management as a trust budget, observability-driven development as post-deploy verification, and Ousterhout's "define errors out of existence" as feedback-signal hygiene.

---

## 1. Type systems / typecheckers as instant machine feedback — **BACKED**

**What the sources say.**

- Gao, Bird & Barr, *To Type or Not to Type: Quantifying Detectable Bugs in JavaScript* (ICSE 2017). Abstract, verified directly from the paper PDF: "our central finding is that both static type systems find an important percentage of public bugs: both Flow 0.30 and TypeScript 2.0 successfully detect 15%!" Methodology: take fixed bugs from project histories, check out the code just prior to the fix, add annotations, see whether the checker flags the buggy code. The authors note this is *conservative* — public bugs already "survived testing and review," so it "understates their effectiveness at detecting bugs during private development."
  - Paper PDF: https://www.microsoft.com/en-us/research/wp-content/uploads/2017/09/gao2017javascript.pdf
  - DOI: https://dl.acm.org/doi/10.1109/ICSE.2017.75
- Anthropic, *Building agents with the Claude Agent SDK*: rules-based feedback is called the most effective verification approach, and the concrete example is typechecking — "it is usually better to generate TypeScript and lint it than it is to generate pure JavaScript because it provides you with multiple additional layers of feedback." https://claude.com/blog/building-agents-with-the-claude-agent-sdk
- Cursor, *Reviewing and Testing Code* (Cursor Learn): "Type checking catches structural errors," listed alongside "Tests catch behavioral regressions" and "Linting catches style and pattern violations" as the verifiable gates that let you "more confidently … delegate work to agents." https://cursor.com/learn/reviewing-testing
- Claude Code best practices recommends code-intelligence plugins for typed languages to give Claude "precise symbol navigation and automatic error detection after edits." https://code.claude.com/docs/en/best-practices

**Implication for the agent loop.** The typechecker is the fastest oracle available — sub-second, deterministic, zero-setup once the project compiles, and it localizes the error to a file:line the agent can act on. A 15% floor on real-bug detection *before any test runs* is the best-measured cheap win on this list. For harness work: prefer typed targets, surface typecheck output to the agent after every edit (not only at gate time), and treat "typecheck clean" as the first rung of any verification ladder.

---

## 2. Fast deterministic test suites; where to put test boundaries — **BACKED** (speed/determinism); **NUANCED** (boundary placement)

**Speed and determinism — backed with numbers.**

- Fowler, *SelfTestingCode*: "You have self-testing code when you can run a series of automated tests against the code base and be confident that, should the tests pass, your code is free of any substantial defects." And on speed of localization: "By running the test suite frequently … you're able to detect such bugs soon after they are introduced, so you can just look in the recent changes, which makes it *much* easier to find them." https://martinfowler.com/bliki/SelfTestingCode.html
- DORA, *Test automation* capability: "developers should be able to get feedback from automated tests in less than ten minutes both on local workstations and from the continuous integration system"; "Test failures should indicate a real defect" and "when the tests pass we should be confident the software is releasable." Their research links developer-owned test automation to "improved software stability, reduced team burnout, and lower deployment pain." https://dora.dev/capabilities/test-automation/
- *Software Engineering at Google*, ch. 11: small tests "must run in a single process" and cannot "sleep, perform I/O operations, or make any other blocking calls" — the point being that "small tests don't have access to the main sources of test slowness or nondeterminism." Suite shape: roughly "80% of our tests being narrow-scoped unit tests… 15% medium-scoped integration tests… and 5% end-to-end tests." On flakiness: if "each test has even a 0.1% of failing when it should not, and you run 10,000 tests per day, you will be investigating 10 flakes per day" (Google holds ~0.15%). https://abseil.io/resources/swe-book/html/ch11.html

**Boundary placement — nuanced, but the primary sources agree on direction.**

- Ham Vocke on martinfowler.com, *The Practical Test Pyramid*: the two rules are "Write tests with different granularity" and "the more high-level you get the fewer tests you should have." A unit "can range from a single method to an entire class" (solitary vs. sociable). The key boundary guidance: "Test for observable behaviour instead" and "Don't reflect your internal code structure within your unit tests" — i.e., ask "if I enter values `x` and `y`, will the result be `z`?" https://martinfowler.com/articles/practical-test-pyramid.html

**Implication for the agent loop.** For an agent, the test suite is the primary pass/fail oracle, so its properties become the loop's properties: a slow suite means slow iterations; a flaky suite means the agent chases ghosts or learns to distrust (and rationalize away) failures. Boundary placement matters more for agents than for humans because agents refactor aggressively: per-function, structure-mirroring tests break on every refactor and generate false "you broke it" signals, while module-interface/behavior tests only fail when behavior actually changed. Verdict on the specific question "module interface vs per-function": the sources back interface/behavior-level tests; no primary source advocates per-function structure-coupled tests.

---

## 3. Contract tests / behavioral oracles vs. mock-heavy unit tests — **CONTESTED** (as a general debate), but the documented failure mode of mocks is exactly the one that hurts agents

**What the sources say.**

- Fowler, *Mocks Aren't Stubs*, frames this as a genuine, unresolved split (classicist vs. mockist; state verification vs. behavior verification). But he is explicit about the cost of the mockist style: "Mockist tests are thus more coupled to the implementation of a method. Changing the nature of calls to collaborators usually cause a mockist test to break," and "Coupling to the implementation also interferes with refactoring, since implementation changes are much more likely to break tests than with classic testing." His own position: "Personally I've always been a old fashioned classic TDDer and thus far I don't see any reason to change." https://martinfowler.com/articles/mocksArentStubs.html
- *The Practical Test Pyramid* on consumer-driven contract tests: "The consumer drives the implementation of a contract," letting "the providing team to implement only what's really necessary" — contracts pin the *observable* interface between services, not internals. https://martinfowler.com/articles/practical-test-pyramid.html
- Anthropic's Claude Code best-practices guide, notably, bakes an anti-mock preference into its canonical example prompt: *"write a test for foo.py covering the edge case where the user is logged out. **avoid mocks.**"* https://code.claude.com/docs/en/best-practices

**Implication for the agent loop.** The human-world debate is contested; the agent-world reading is less so. A mock-heavy suite verifies "the code calls its collaborators the way the test author expected," which (a) breaks under agent refactors, producing false negatives, and (b) is trivially gameable — an agent can make behavior-verification tests pass by reproducing the expected call sequence without producing correct behavior. Behavioral oracles (state/output assertions, contract tests, held-out end-to-end checks) are harder to satisfy vacuously. This matches this repo's eval design (decoupled held-out oracles). Verdict: CONTESTED in general, but for agent verification the primary-source-documented brittleness of mockist tests argues for behavioral/contract oracles.

---

## 4. Running the app + sweeping logs as verification — **NUANCED**: "run the app" is BACKED; "grep the logs" as a named step is FOLKLORE (unsourced, though consistent with backed practice)

**Running the app — backed by two vendors' own engineering posts.**

- Cognition, *Verifying Agentic Development at Scale* (May 2026): "Devin will spin up the app, click through it, and confirm its changes actually work, the same way an engineer would." Devin "enters test mode" and "first write[s] out a test plan detailing a clear target about what to test"; output is "a test report with labeled screenshots" and "a test video." The motivating claim: "a clean review alone often isn't enough — engineers want to see the change tested end to end, the same way they would test it themselves." https://cognition.ai/blog/testing-development (redirects to https://cognition.com/blog/testing-development)
- Claude Code best practices: the check can be "a test suite, a build exit code, a linter, a script that diffs output against a fixture, or a browser screenshot compared against a design," and for UI work: "take a screenshot of the result and compare it to the original. list differences and fix them." https://code.claude.com/docs/en/best-practices

**Log-sweeping — no primary source.** None of the fetched vendor sources (Anthropic, Cognition, Cursor, OpenAI) describes "exercise endpoints, then grep the logs for unexpected exceptions" as a verification step. The nearest authoritative relative is Charity Majors' post-deploy instrumentation check (see the ODD entry in the final section): "you promptly pull up a window to watch your changes roll out, checking on your instrumentation to see if it's doing what you intended it to or if anything looks weird" (https://charity.wtf/2019/10/28/deploys-its-not-actually-about-fridays/) — same instinct, applied at deploy time rather than in the inner loop.

**Implication for the agent loop.** Exercising the running app is authoritative practice — it is literally what Cognition sells, and their stated reason (review alone misses what execution catches) is the strongest vendor claim on this list. The log-sweep refinement is *plausible and cheap* — structured logs make "unexpected ERROR/exception after my request" a greppable, machine-checkable oracle that catches failures the happy-path response hides — but call it what it is: our extension of backed practice, not itself a sourced practice. If we build it into the harness, we should measure it (eval-task capture exists for exactly this).

---

## 5. Correlation IDs across frontend/backend — **NUANCED**: the mechanism is a W3C standard; the agent-loop benefit is unmeasured

**What the sources say.**

- W3C *Trace Context* (Recommendation): the problem is that "Traces that are collected by different tracing vendors cannot be correlated as there is no shared unique identifier," and the spec "defines a universally agreed-upon format for the exchange of trace context propagation data" via the `traceparent` header ("an unique identifier for individual traces and requests, allowing trace data of multiple providers to be linked together") and `tracestate`. "The interoperability provided by trace context is a prerequisite to manage modern micro-service based applications." https://www.w3.org/TR/trace-context/

**What no source says:** that request-scoped IDs measurably speed up an *AI agent's* verification loop. No fetched vendor post mentions trace/correlation IDs in the context of agent feedback.

**Implication for the agent loop.** Correlation IDs convert "something somewhere logged an error" into "THIS request I just made produced THIS error in THAT service" — which is precisely the join an agent needs to attribute a failure to its own change in a multi-service system (e.g., the MR02 frontend+backend eval). Standardize on `traceparent` rather than a homegrown header since tooling already speaks it. But be honest in design docs: this is backed as *distributed-systems* practice; its contribution to agent loops is a hypothesis worth an eval, not a citation.

---

## 6. Performance budgets / metrics regression detection — **NUANCED**: real, well-documented practice; zero primary-source connection to agent loops

**What the sources say.**

- Google web.dev, *Performance budgets 101*: "A performance budget is a set of limits imposed on metrics that affect site performance." "Defining a budget helps get the web performance conversation started. It serves as a point of reference for making decisions about design, technology, and adding features." Enforcement is CI-able: "There are a few open-source tools that can help you add budgeting to your build process: Webpack performance features, bundlesize, Lighthouse CI." https://web.dev/articles/performance-budgets-101

**Implication for the agent loop.** A budget turns a vague quality ("don't make it slower") into a pass/fail check an agent can run — which is the one property every backed practice on this list shares. But no vendor or research source we fetched discusses performance budgets in an agent context; adopt it as "another deterministic gate" where perf matters, not as a proven loop accelerant. For the harness, the eval suite already measures cost/latency per run — a budget on those is the same idea applied to ourselves.

---

## 7. Snapshot / visual diff testing for UI — **NUANCED**: visual feedback for agents is BACKED; snapshot tests verify *consistency, not correctness*

**What the sources say.**

- Jest docs, *Snapshot Testing*: "Snapshot tests are a very useful tool whenever you want to make sure your UI does not change unexpectedly." Best practices: "Commit snapshots and review them as part of your regular code review process," "Your tests should be deterministic," and "The aim of snapshot testing is not to replace existing unit tests, but to provide additional value and make testing painless." Note what this implies: a snapshot pins the *current* output, whatever it is — it detects change, not correctness. https://jestjs.io/docs/snapshot-testing
- Anthropic, *Building agents with the Claude Agent SDK*: visual feedback is one of the three named verification approaches (check "Layout," "Styling," "Content hierarchy," "Responsiveness"), and "using an MCP server like Playwright, you can automate this visual feedback loop." https://claude.com/blog/building-agents-with-the-claude-agent-sdk
- Claude Code best practices: paste a design screenshot, then "take a screenshot of the result and compare it to the original. list differences and fix them." https://code.claude.com/docs/en/best-practices
- Cognition: Devin's verification artifacts are visual — "a test report with labeled screenshots" and "a test video with a rich player UI that has chapters." https://cognition.com/blog/testing-development

**Implication for the agent loop.** Screenshots close the loop for the one domain where text oracles are weakest (UI), and all three agent vendors independently converge on it. Snapshot *tests* have a specific agent hazard the Jest docs' framing exposes: because `jest -u` regenerates snapshots wholesale, an agent under pressure to go green can "fix" a failure by updating the snapshot — the oracle is self-modifiable. If snapshots gate agent work, updates to `.snap` files need the same scrutiny as updates to test assertions (this repo's git-reviewed-diff discipline already points the right way).

---

## 8. Seeding agent context (AGENTS.md / CLAUDE.md / rules files) — **BACKED** by vendor primary sources; no published controlled measurement

**What the sources say.**

- Claude Code docs: "CLAUDE.md is a special file that Claude reads at the start of every conversation. Include Bash commands, code style, and workflow rules. This gives Claude persistent context it can't infer from code alone." Crucially, the docs warn about the failure mode: "Bloated CLAUDE.md files cause Claude to ignore your actual instructions!" and give a pruning test — "For each line, ask: 'Would removing this cause Claude to make mistakes?' If not, cut it." The include-list is feedback-loop material: bash commands Claude can't guess, testing instructions and preferred test runners, environment quirks. https://code.claude.com/docs/en/best-practices
- Cursor docs, *Rules*: rules give "persistent, reusable context at the prompt level" because "Large language models don't retain memory between completions"; "rule contents are included at the start of the model context." Keep them "focused, actionable, and scoped," "under 500 lines." Cursor also supports AGENTS.md directly. https://cursor.com/docs/context/rules
- AGENTS.md (stewarded by the Agentic AI Foundation / Linux Foundation; contributors include OpenAI Codex, Amp, Google's Jules, Cursor, Factory): "a dedicated, predictable place to provide the context and instructions to help AI coding agents work on your project," covering "Build and test commands, Code style guidelines, Testing instructions, Security considerations." And the direct feedback-loop claim, on whether agents run tests listed in the file: "Yes—if you list them. The agent will attempt to execute relevant programmatic checks and fix failures before finishing the task." https://agents.md/

**Implication for the agent loop.** Context files are the *routing layer* of the feedback loop: they tell the agent which checks exist and how to invoke them, which is what turns "there is a test suite" into "the agent runs it before declaring done." Every vendor endorses this in their own docs — that's authoritative for "the people who build the agents believe it." What does not exist anywhere we found: a published controlled study quantifying the effect. Also note the backed *anti*-pattern: more context is not monotonically better (Anthropic's bloat warning, Cursor's 500-line cap) — a lesson this repo's memory A/B already ran into empirically.

---

## 9. Small-diff discipline (small CLs/PRs) — **BACKED**, including an AI-specific claim from DORA

**What the sources say.**

- Google eng-practices, *Small CLs*: small means "one self-contained change"; "100 lines is usually a reasonable size for a CL, and 1000 lines is usually too large." Benefits listed: reviewed faster, fewer bugs, less wasted work on rejection, easier merges and rollbacks. "When in doubt, write CLs that are smaller than you think you need to write." https://google.github.io/eng-practices/review/developer/small-cls.html
- DORA, *Working in small batches*: "Working in small batches predicts software delivery performance and organizational performance." "It reduces the time it takes to get feedback on changes, making it easier to triage and remediate problems." Work items should complete in "hours to a couple days"; more than a week is too large. And directly on point for this repo: DORA's updated capability page frames small batches as "a safety net for AI adoption" — counteracting the delivery instability their research associates with AI-accelerated code production. https://dora.dev/capabilities/working-in-small-batches/

**Implication for the agent loop.** Small diffs shrink the *blame radius*: when a check fails, the candidate cause set is the diff, and a 100-line diff is a searchable cause set for both the agent and its reviewer. They also make the adversarial-review step (see below) tractable — a fresh-context reviewer can actually hold a small diff. For the harness: per-task branches and one-concern PRs aren't just etiquette, they're what keeps every downstream verification signal attributable.

---

## 10. CI speed and pre-commit-fast checks — **BACKED**, with a consistent ~10-minute threshold across three sources

**What the sources say.**

- Fowler, *Continuous Integration*: "The whole point of Continuous Integration is to provide rapid feedback. Nothing sucks the blood of Continuous Integration more than a build that takes a long time." "The XP guideline of a ten minute build is perfectly within reason." On layering: "The idea behind a deployment pipeline is that there are in fact multiple builds done in sequence," where the commit build "has to be done quickly" and takes shortcuts. Prerequisite: "Self-testing code is so important to Continuous Integration that it is a necessary prerequisite." Broken builds: "nobody has a higher priority task than fixing the build," and the default remedy is to "revert the latest commit from the mainline." https://martinfowler.com/articles/continuousIntegration.html
- DORA, *Continuous integration*: every commit triggers a build and "a series of automated tests that provide feedback in a few minutes"; builds over ~10 minutes discourage frequent integration. CI correlates with higher deployment frequency, stability, and quality in their research. https://dora.dev/capabilities/continuous-integration/
- DORA, *Test automation*: the same <10-minute bound applies "both on local workstations and from the continuous integration system." https://dora.dev/capabilities/test-automation/

**Implication for the agent loop.** Three independent sources converge on the same number: if feedback takes more than ~10 minutes, the loop degrades — and an agent iterating dozens of times per task multiplies that cost far more than a human committing a few times a day. Fowler's *staged* pipeline maps directly onto agent verification ladders: fast deterministic checks (typecheck, lint, focused tests) inside the inner loop, the full suite at the gate, expensive end-to-end checks last. The "fix the build immediately / revert" rule maps to fail-closed gates: an agent must never build on top of a red baseline.

---

## Not on our list but should be

### A. Reproducible, pre-provisioned dev environments — **BACKED**

The agent can only run checks in an environment where checks run. OpenAI's Codex cloud-environment docs are built around this: "Codex can automatically install dependencies and tools" for common package managers, "If your development setup is more complex, you can also provide a custom setup script," "Internet access is available during the setup script phase to install dependencies" (off by default in the agent phase) — all in service of the loop the docs describe: "The agent runs terminal commands in a loop. It edits code, runs checks, and tries to validate its work." (https://developers.openai.com/codex/cloud/environments, served at https://learn.chatgpt.com/docs/environments/cloud-environment — note the marketing announcement https://openai.com/index/introducing-codex/ returned HTTP 403 and could not be used.) Cognition makes the same point from the scale angle: "Everything runs in the cloud and can scale out in parallel," with teams "running 10 to 20 Devins in parallel, each with its own dev server" (https://cognition.com/blog/testing-development). *Implication:* environment setup is not a chore before the real work — it IS feedback-loop infrastructure, and "npm ci works from a clean checkout" is a verification feature. This repo's local-services-else-docker rule and worktree isolation are this practice.

### B. Deterministic gates vs. advisory instructions — **BACKED**

Claude Code docs draw the distinction explicitly: "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens," with Stop hooks that "block the turn from ending until it passes" a scripted check (https://code.claude.com/docs/en/best-practices). *Implication:* anything that must ALWAYS run (typecheck after edit, test gate before done, .ports.env-style commit guards) belongs in enforced machinery, not in prose the model may deprioritize under long context. This is the vendor-documented version of this harness's fail-closed gates.

### C. Separate the doer from the grader (fresh-context adversarial review) — **BACKED** (vendor)

Claude Code docs: "A fresh context improves code review since Claude won't be biased toward code it just wrote," and the verification-subagent pattern exists "so the agent doing the work isn't the one grading it." The same docs warn about grader over-triggering: a reviewer told to find gaps "will usually report some, even when the work is sound." (https://code.claude.com/docs/en/best-practices.) Cursor ships this as product: "Bugbot Autofix spawns cloud agents that work independently in their own virtual machines to test your software," with "Over 35% of Bugbot Autofix changes … merged into the base PR" (https://cursor.com/blog/bugbot-autofix). *Implication:* self-verification by the implementing context is the weakest oracle; route review/verification through a context that didn't produce the change.

### D. Evidence over assertion — **BACKED** (vendor)

Claude Code docs: "Have Claude show evidence rather than asserting success: the test output, the command it ran and what it returned, or a screenshot of the result. Reviewing evidence is faster than re-running the verification yourself, and it works for sessions you weren't watching." (https://code.claude.com/docs/en/best-practices.) Cognition's whole verification product outputs evidence artifacts (labeled screenshots, chaptered video). *Implication:* "done" claims in pipeline output should carry the check's actual output; a claim without attached evidence is unverified by construction.

### E. Flake management as a trust budget — **BACKED**

*Software Engineering at Google* ch. 11 quantifies why: at "even a 0.1% of failing when it should not" across 10,000 daily test runs, "you will be investigating 10 flakes per day" (https://abseil.io/resources/swe-book/html/ch11.html). DORA states the requirement positively: "Test failures should indicate a real defect" (https://dora.dev/capabilities/test-automation/). (Google's testing-blog flaky-tests post, https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html, was fetched but the article body did not render — only comments — so its widely-cited specific flake percentages could not be verified here and are deliberately not quoted.) *Implication:* an agent that has seen flakes learns the fatal heuristic "failures are sometimes noise" — after which every real failure can be rationalized away. Flaky checks should be quarantined out of agent-facing gates entirely, not retried into submission.

### F. Observability-driven development: verify in production, not just in tests — **BACKED**

Charity Majors, *Deploys: It's Not Actually About Fridays*: ODD means "instrumenting a couple steps ahead of yourself as you are developing and shipping code" and "making a cultural practice of asking each other 'how will you know if this is broken?' during code review"; after merge, "you promptly pull up a window to watch your changes roll out, checking on your instrumentation to see if it's doing what you intended it to or if anything looks weird." (https://charity.wtf/2019/10/28/deploys-its-not-actually-about-fridays/ — note the two Honeycomb blog pages on ODD, https://www.honeycomb.io/blog/a-next-step-beyond-test-driven-development2 and https://www.honeycomb.io/blog/observability-driven-development-for-tackling-the-great-unknown, turned out to be link-out stubs with no substantive content; charity.wtf is the usable primary.) *Implication:* the feedback loop doesn't end at the test gate. "How will I know if this is broken?" is a question an agent can be required to answer in its plan — and the answer (a metric, a log line, a trace) becomes a post-merge check. This is also the closest authoritative backing for our area-4 log-sweeping idea.

### G. "Define errors out of existence" as feedback-signal hygiene — **BACKED** (principle), our application to agents is inference

Ousterhout's own CS 190 lecture notes: "Whenever possible, define errors out of existence," because "Errors and exceptions are a major source of complexity and bugs" — worsened by "defensive programming: throw exceptions for anything that looks a tiny bit suspicious." Before defining an error, "think about how the caller will handle it." (https://web.stanford.edu/~ouster/cgi-bin/cs190-spring15/lecture.php?topic=errorHandling; companion complexity lecture — deep "thick" classes with "lots of functionality, yet simple interface" — at https://web.stanford.edu/~ouster/cgi-bin/cs190-spring15/lecture.php?topic=complexity; book page: https://web.stanford.edu/~ouster/cgi-bin/book.php.) *Implication (ours, flagged as inference):* every spurious error path is noise in the very channel the agent greps for failure signal. A codebase that only raises when something is genuinely wrong makes "any ERROR in the log after my change" a high-precision oracle — connecting Ousterhout directly to areas 1 and 4. The complement also holds: errors that *do* exist should carry machine-actionable messages, since the agent is now a primary consumer of them (no primary source found for "error messages designed for machines" as a named practice — treat as open design ground).

### H. Feature flags — **NUANCED**

Pete Hodgson on martinfowler.com, *Feature Toggles*: toggles let teams "deliver new functionality to users rapidly but safely" and "modify system behavior without changing code"; release toggles allow "incomplete and un-tested codepaths to be shipped to production as latent code." But: "Toggles introduce complexity," are "inventory which comes with a carrying cost," and release toggles "should generally not stick around much longer than a week or two." (https://martinfowler.com/articles/feature-toggles.html.) *Implication:* flags enable the small-batch, always-releasable trunk that DORA's numbers reward, and let agent-authored changes ship dark for production verification (F) — but they add exactly the kind of conditional complexity Ousterhout warns about, so they're a loop *enabler* with a real carrying cost, not a free win.

---

## Source status appendix

| Source | Status |
|---|---|
| Anthropic *Claude Code best practices* | Fetched in full at https://code.claude.com/docs/en/best-practices (anthropic.com URL 308-redirects there) |
| Anthropic *Building effective agents* | Fetched at https://www.anthropic.com/research/building-effective-agents |
| Anthropic *Building agents with the Claude Agent SDK* | Fetched at https://claude.com/blog/building-agents-with-the-claude-agent-sdk |
| Cognition *Verifying Agentic Development at Scale* | Fetched at https://cognition.com/blog/testing-development |
| Cursor rules docs / Cursor Learn / Bugbot Autofix | Fetched at https://cursor.com/docs/context/rules, https://cursor.com/learn/reviewing-testing, https://cursor.com/blog/bugbot-autofix |
| AGENTS.md | Fetched at https://agents.md/ |
| OpenAI Codex environments doc | Fetched via redirect at https://learn.chatgpt.com/docs/environments/cloud-environment; **openai.com/index/introducing-codex/ returned HTTP 403 — not used** |
| Ousterhout CS 190 lectures + book page | Fetched (errorHandling, complexity topics; book.php) |
| charity.wtf *Deploys: It's Not Actually About Fridays* | Fetched; **both Honeycomb ODD blog URLs were content-free stubs — not used as evidence** |
| martinfowler.com (SelfTestingCode, CI, Practical Test Pyramid, Mocks Aren't Stubs, Feature Toggles) | All fetched |
| Google eng-practices small CLs; SWE-book ch. 11 | Fetched |
| Google testing blog flaky-tests post | Fetched but **article body did not render (comments only); its flake percentages are NOT cited** |
| DORA (CI, test automation, small batches) | All fetched |
| Gao/Bird/Barr ICSE 2017 | Abstract extracted directly from the paper PDF (microsoft.com mirror); UCL Discovery page returned 403 |
| Jest snapshot docs, W3C Trace Context, web.dev performance budgets | All fetched |
