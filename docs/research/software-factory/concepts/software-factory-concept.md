# The "software factory" / "dark factory": concept, practitioners, architecture, limits

Research date: 2026-10-24. Every claim links to its source. **[secondary]** marks a source that reports on someone else's work rather than being the primary source. **[vendor]** marks a source that sells a product related to the claim. Downloaded pages were treated as untrusted data and summarised; figures are as the source states them, not independently reproduced.

---

## 1. Plain-language definition

A **software factory** is a development setup where coding agents, not people, write the code and also decide whether it is good enough to merge. People supply intent (specs, scenarios, priorities) and design the machinery: the work queue, sandboxes, verification and merge rules. They do not read every diff.

- StrongDM, who made the term popular, define it as "non-interactive development where specs + scenarios drive agents that write code, run harnesses, and converge without human review" ([StrongDM](https://factory.strongdm.ai/)).
- A **dark factory** is the extreme end, named after "lights-out" manufacturing. Dan Shapiro's Level 5: specs go into a black box and software comes out, with no human process in between ([Shapiro](https://www.danshapiro.com/blog/2026/01/the-five-levels-from-spicy-autocomplete-to-the-software-factory/)).
- Vendors use "software factory" more loosely, to mean any agent pipeline from ticket to PR. That can include human review. Factory.ai calls itself "a system for delivering production software with AI agents (Droids) that plan, build, review, and ship under human direction" ([Factory llms.txt](https://factory.com/llms.txt) [vendor]). Cursor talks about building "the factory that creates your software" with always-on agents ([Cursor Automations](https://cursor.com/blog/automations) [vendor]).

**The shift in one sentence:** the work moves from reviewing code to engineering how code gets verified. A factory is only as trustworthy as its verifier, so the hard problem is verification, not generation. Simon Willison calls proving that agent-written code works "the most consequential question in software development right now" ([Willison](https://simonwillison.net/2026/Feb/7/software-factory/)).

---

## 2. Origin and timeline

| Date | Event | Source |
|---|---|---|
| Oct 2024 | StrongDM says a Claude 3.5 revision was the point where long-horizon agentic coding began to "compound correctness rather than error" | [StrongDM](https://factory.strongdm.ai/) |
| Dec 2024 | StrongDM cites Cursor's YOLO mode as making that capability visible | [StrongDM](https://factory.strongdm.ai/) |
| 2025-07-14 | Geoffrey Huntley publishes the "Ralph Wiggum" loop (`while :; do cat PROMPT.md \| claude-code ; done`) | [Huntley](https://ghuntley.com/ralph/) |
| 2025-07-14 | StrongDM AI team founded (Justin McCarthy, Jay Taylor, Navan Chauhan) with a "no hand-coded software" rule | [StrongDM](https://factory.strongdm.ai/), [Willison](https://simonwillison.net/2026/Feb/7/software-factory/) |
| Jul 2025 | HumanLayer tries full "lights-off" development on its own product, then turns review back on (Dex Horthy, told later) | [AI Engineer talk](https://www.ai.engineer/talks/Ib5GBkD555M-harness-engineering-is-not-enough-why-software) |
| 2025-11-26 | Anthropic, "Effective harnesses for long-running agents" (initializer agent, coding agent, feature-list JSON) | [Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) |
| 2025-12-18 | Willison, "Your job is to deliver code you have proven to work" | [Willison](https://simonwillison.net/2025/Dec/18/code-proven-to-work/) |
| 2026-01-01 | Steve Yegge releases Gas Town, a multi-agent orchestrator | [GitHub](https://github.com/steveyegge/gastown); date per [ascii.co.uk](https://ascii.co.uk/news/article/news-20260102-190a5f9f/steve-yegge-releases-gas-town-multi-agent-orchestrator-for-c) [secondary] |
| Jan 2026 | Cursor's "scaling agents" browser experiment: hundreds of agents, more than 1M LOC in about a week | [Willison](https://simonwillison.net/2026/Jan/19/scaling-long-running-autonomous-coding/) [secondary], [Cursor](https://cursor.com/blog/scaling-agents) |
| 2026-01-23 | Dan Shapiro's "five levels", Level 5 = "Dark Factory" | [Shapiro](https://www.danshapiro.com/blog/2026/01/the-five-levels-from-spicy-autocomplete-to-the-software-factory/) |
| 2026-02-05 | Cursor, "Towards self-driving codebases" (Wilson Lin) | [Cursor](https://cursor.com/blog/self-driving-codebases) |
| 2026-02-06/07 | StrongDM publishes "Software Factory"; Willison writes it up the next day | [StrongDM](https://factory.strongdm.ai/), [Willison](https://simonwillison.net/2026/Feb/7/software-factory/) |
| 2026-02-08 | Stanford CodeX critique, "Built by agents, tested by agents, trusted by whom?" | [Stanford Law](https://law.stanford.edu/2026/02/08/built-by-agents-tested-by-agents-trusted-by-whom/) |
| 2026-02-11 | OpenAI, "Harness engineering" (Ryan Lopopolo): about 1M LOC with no human-written code | Search snippet of [OpenAI](https://openai.com/index/harness-engineering/) (page returned 403 to fetch; see Gaps) |
| 2026-03-05 | Cursor Automations: event- and schedule-triggered cloud agents, including agentic risk-tiered PR approval | [Cursor](https://cursor.com/blog/automations) [vendor] |
| 2026-03-10 | METR: about half of SWE-bench-passing agent PRs would not be merged by maintainers | [METR](https://metr.org/notes/2026-03-10-many-swe-bench-passing-prs-would-not-be-merged-into-main/) |
| 2026-03-24 | Anthropic, "Harness design for long-running apps" (planner / generator / evaluator) | [Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps) |
| 2026-04-07 | Latent Space interview with Lopopolo: most human review is now post-merge | [Latent Space](https://www.latent.space/p/harness-eng) [secondary] |
| Apr 2026 | Factory.ai Series C; "Missions" for long-horizon multi-agent work | [Factory](https://factory.ai/news/series-c) [vendor] |
| Jun 2026 | Dex Horthy (HumanLayer), "Why Software Factories Fail", AI Engineer World's Fair | [AI Engineer](https://www.ai.engineer/talks/Ib5GBkD555M-harness-engineering-is-not-enough-why-software) |
| 2026-09-14 | Anthropic: CI jobs up 25x in six months because of agentic coding | [Claude blog](https://claude.com/resources/articles/agentic-coding-is-straining-ci-heres-how-we-scaled-test-impact-analysis-at-anthropic) |
| 2026-09-24 | Factory.ai guidance on reviewing agent PRs with risk routing | [Factory](https://factory.com/articles/reviewing-agent-generated-pull-requests) [vendor] |

Where the name comes from: Shapiro takes "dark factory" from Fanuc's robot-built factory, where "humans are neither needed nor welcome" ([Shapiro](https://www.danshapiro.com/blog/2026/01/the-five-levels-from-spicy-autocomplete-to-the-software-factory/)). The "software factory" phrase itself is much older than 2026 (in the 1960s–80s it meant industrialised software production). The 2026 meaning is new.

---

## 3. Practitioners and implementations

| Who | What | Human role | Verification approach | Link |
|---|---|---|---|---|
| **StrongDM AI** (McCarthy, Taylor, Chauhan) | Software Factory. Rules: humans may not write code and may not review it. Benchmark: at least $1,000 of tokens per engineer per day. Open-sourced Attractor (a coding agent whose repo is 3 markdown specs and no code) and cxdb | Write the seed or spec and the scenarios. Build the harness and the twins | **Scenarios** (end-to-end user stories) kept *outside* the repo as a **holdout set** so agents can't game them. A probabilistic **satisfaction** score (the fraction of trajectories that likely satisfy the user) instead of "the suite is green". A **Digital Twin Universe**: behavioural clones of Okta, Jira, Slack and Google Docs/Drive/Sheets so thousands of scenarios can run per hour | [factory.strongdm.ai](https://factory.strongdm.ai/), [techniques](https://factory.strongdm.ai/techniques), [principles](https://factory.strongdm.ai/principles), [Willison](https://simonwillison.net/2026/Feb/7/software-factory/) |
| **OpenAI Frontier** (Ryan Lopopolo) | Internal beta product, about 1M LOC with zero human-written code, about 1,500 PRs, 3 engineers growing to 7, over about 5 months | Humans steer, cut release branches and approve a smoke test before distribution. A 45-minute daily standup keeps them up to date. "Most of the human review is post merge" | Agent reviewers rank findings P0–P2 and are told to bias toward merging. A "land" skill waits for green CI and the merge queue. Codex runs a local logs/metrics/traces stack and writes Grafana dashboards. Build time kept under 1 min | [OpenAI](https://openai.com/index/harness-engineering/) (403, figures via search snippet), [Latent Space](https://www.latent.space/p/harness-eng) [secondary] |
| **Cursor research** (Wilson Lin) | Browser built from scratch by hundreds of concurrent agents. More than 1M LOC, about 1,000 files, a week of running, peak about 1,000 commits/hr, about 10M tool calls | Wrote the spec and harness. Intervened on bad initial architecture and on dependency policy | A recursive planner → sub-planner → worker tree, each worker on its own repo copy. Tolerates a "small, steady error rate" plus a final green-branch fixup pass. WhatWG and CSS specs vendored as submodules. CI was broken at launch | [Cursor](https://cursor.com/blog/self-driving-codebases), [Willison](https://simonwillison.net/2026/Jan/19/scaling-long-running-autonomous-coding/) [secondary] |
| **Cursor Automations** | Product: agents triggered by schedules, Slack, Linear, GitHub merges, PagerDuty or webhooks, each in a cloud sandbox | Engineers audit the logs and tune instructions. Humans review high-risk PRs | **Agentic codeowners**: risk scored by blast radius, complexity and infra impact. Low-risk PRs are **auto-approved**; higher-risk PRs get up to 2 human reviewers. A security-review agent runs on each push to main | [Cursor](https://cursor.com/blog/automations) [vendor] |
| **Anthropic** (Justin Young; Prithvi Rajasekaran) | Harness research: an initializer plus a coding agent. Later a planner, generator and evaluator | Writes the prompt and calibrates the evaluator by reading its logs | Feature list in JSON (200+ features, all starting as failing; agents may only flip `passes`). Puppeteer or Playwright end-to-end testing of the running app. A separate evaluator with hard per-criterion thresholds, because "agents reliably skew positive when grading their own work" | [Nov 2025](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), [Mar 2026](https://www.anthropic.com/engineering/harness-design-long-running-apps) |
| **Geoffrey Huntley** | Ralph loop: the same prompt piped into an agent forever, one task per iteration. Used to build the CURSED language compiler | Writes specs through a long conversation and edits `fix_plan.md` and the stdlib to steer | "Backpressure": tests, type checker, static analysis and security scanners reject bad output. Fast feedback is stressed | [ghuntley.com/ralph](https://ghuntley.com/ralph/) |
| **Steve Yegge** | Gas Town: a Go orchestrator for 20–30 agents. Mayor (coordinator), Polecats (workers), Witness (stuck-agent monitor), Refinery (merge queue), Beads (git-backed issues) | Tells the Mayor what to build, watches convoys, handles escalations | The **Refinery** batches merge requests, runs verification and merges through a bisecting queue. Polecats never push to main | [GitHub](https://github.com/steveyegge/gastown) |
| **Factory.ai** | Droids (CLI, `droid exec` headless in CI, Slack/Jira/Linear), Missions, Automations | "Under human direction". Missions have human review points | AI review on every PR, STRIDE security review, least-privilege guidance. Its own guidance still routes auth, billing, deploy and migration code to humans via CODEOWNERS | [llms.txt](https://factory.com/llms.txt), [review article](https://factory.com/articles/reviewing-agent-generated-pull-requests) [vendor] |
| **Dan Shapiro** | Five-level taxonomy, not an implementation | Places himself at Level 4 | n/a | [Shapiro](https://www.danshapiro.com/blog/2026/01/the-five-levels-from-spicy-autocomplete-to-the-software-factory/) |

How the brief's list held up:
- **Confirmed:** StrongDM, Shapiro, Willison, OpenAI harness engineering, Ralph, Anthropic's two harness posts, Cursor's research and Automations, Gas Town, Factory.ai.
- **Corrections:**
  - "Cursor agent factory" is two separate things: a research harness that built a browser, and the Automations product.
  - Factory.ai is human-directed, not a dark factory.
  - The OpenAI *primary* post says no human-*written* code. The no-human-*review* detail comes from the Latent Space interview.

---

## 4. Common reference architecture

```
              ┌────────────────────── HUMANS ──────────────────────┐
              │ intent/specs · holdout scenarios · risk policy ·   │
              │ harness design · escalations · release approval    │
              └───────┬───────────────────────────────▲────────────┘
                      │ seed / spec                   │ escalate, metrics, digests
                      ▼                               │
 ┌──────────┐   ┌───────────────┐   ┌────────────────────────────────────┐
 │ Triggers │──▶│ Work queue    │──▶│ Planner (no code) → sub-tasks      │
 │ tickets, │   │ (issues/beads/│   └──────────────┬─────────────────────┘
 │ alerts,  │   │ feature JSON) │                  │ one task per worker
 │ cron     │   └───────────────┘                  ▼
 └──────────┘                     ┌──────────────────────────────────────┐
                                  │ Isolated sandbox / worktree per task │
                                  │  agent loop: read state → code →     │
                                  │  build/typecheck/test (backpressure) │
                                  │  → commit + progress notes           │
                                  └──────────────┬───────────────────────┘
                                                 ▼
             ┌───────────────────────── VERIFICATION ─────────────────────────┐
             │ L1 deterministic: compile, types, lint, arch rules, unit tests │
             │ L2 running system: boot app, e2e/browser, contract tests       │
             │ L3 holdout scenarios vs digital twins (agent can't see/edit)   │
             │ L4 independent evaluator/reviewer agents (P0–P2, thresholds)   │
             └──────────────┬─────────────────────────────────────────────────┘
                            ▼
             ┌───────────────────────────────┐   high-risk ──▶ human review
             │ Merge policy: risk tier,      │
             │ merge queue (bisecting), land │──▶ main ──▶ release gate / smoke
             └───────────────────────────────┘          ──▶ observability →
                                                             feeds new tickets
```

How each component shows up in the sources:

1. **Intent input.**
   - StrongDM's "seed" can be "a few sentences, a screenshot, or an existing codebase" ([principles](https://factory.strongdm.ai/principles)).
   - Huntley keeps one spec file per topic in `specs/` ([Ralph](https://ghuntley.com/ralph/)).
   - Anthropic's planner expands a short prompt into a full spec ([Anthropic Mar 2026](https://www.anthropic.com/engineering/harness-design-long-running-apps)).
2. **Work queue.** Beads ([Gas Town](https://github.com/steveyegge/gastown)), a feature list in JSON ([Anthropic Nov 2025](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)), `fix_plan.md` ([Ralph](https://ghuntley.com/ralph/)), or Linear/Slack/PagerDuty triggers ([Cursor Automations](https://cursor.com/blog/automations)).
3. **Isolation.**
   - Cursor gives each worker its own repo copy ([Cursor](https://cursor.com/blog/self-driving-codebases)).
   - Gas Town uses git-worktree "hooks" ([Gas Town](https://github.com/steveyegge/gastown)).
   - Cursor Automations and Factory run cloud sandboxes ([Cursor](https://cursor.com/blog/automations), [Factory](https://factory.com/llms.txt)).
4. **Agent loop with persistent state.**
   - Work one item per iteration ([Ralph](https://ghuntley.com/ralph/)).
   - Keep a progress file plus git log, and run a smoke test at session start ([Anthropic Nov 2025](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)).
   - Use the filesystem as memory ([StrongDM techniques](https://factory.strongdm.ai/techniques)).
5. **Verification.** This is the part that matters most.
   - *Holdouts kept outside the repo.* StrongDM found agents "could rewrite tests to match code" ([StrongDM](https://factory.strongdm.ai/)).
   - *Digital twins* of third-party services ([StrongDM techniques](https://factory.strongdm.ai/techniques)).
   - *E2E tests against the running app* ([Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)).
   - *A separate evaluator.* "Out of the box, Claude is a poor QA agent" ([Anthropic Mar 2026](https://www.anthropic.com/engineering/harness-design-long-running-apps)).
   - *Observability the agent can query itself* ([Latent Space](https://www.latent.space/p/harness-eng) [secondary]).
6. **Agent review.** Reviewers rank findings P0–P2. The authoring agent may push back on comments, because deferring to every comment converged badly ([Latent Space](https://www.latent.space/p/harness-eng) [secondary]).
7. **Merge policy.**
   - Risk-scored auto-approval ([Cursor](https://cursor.com/blog/automations)).
   - A bisecting merge queue ([Gas Town](https://github.com/steveyegge/gastown)).
   - A human-approved smoke test before release ([Latent Space](https://www.latent.space/p/harness-eng) [secondary]).
8. **Observability and feedback.** "A sample of the output is fed back into the inputs" ([StrongDM principles](https://factory.strongdm.ai/principles)). PagerDuty alerts can trigger fix agents ([Cursor](https://cursor.com/blog/automations)).
9. **Where humans still sit.** Spec and scenario authorship, harness and evaluator calibration, risk policy, release approval, escalations, and a daily sync on the state of the code. Lopopolo calls human synchronous attention "the scarce resource" ([Latent Space](https://www.latent.space/p/harness-eng) [secondary]).

---

## 5. Maturity levels

Shapiro's levels ([source](https://www.danshapiro.com/blog/2026/01/the-five-levels-from-spicy-autocomplete-to-the-software-factory/)), with what changes at each step:

| Level | Name | Human does | Shapiro's claim about who is here |
|---|---|---|---|
| 0 | Manual | Writes everything | n/a |
| 1 | Assisted | Hands off discrete tasks (tests, docstrings) | n/a |
| 2 | Pair | Works with the AI as a colleague | "90% of 'AI-native' developers" |
| 3 | Manager | Reviews diffs from several agent sessions | "almost everyone tops out here" |
| 4 | PM | Writes specs and plans, leaves agents running, checks tests | Shapiro himself |
| 5 | Dark Factory | Specs in, software out, no human process in the middle | "a handful of people", teams of fewer than 5 |

A practical reading for designing your own setup: the jump from Level 3 to Level 4 to Level 5 is not about better models. It is about **replacing human diff review with verification you trust more than you trust your own skim of the diff**. StrongDM's holdouts and twins, and OpenAI's merge-biased reviewers plus a release smoke gate, are both answers to that question. Yegge's own 8-stage scale, which press coverage reports, was not verified (see Gaps).

---

## 6. Hype vs substance

**Substance (supported by primary sources):**
- Long-running agent loops do produce large working systems when they get strong feedback signals:
  - Cursor's browser actually ran on Willison's Mac ([Willison](https://simonwillison.net/2026/Jan/19/scaling-long-running-autonomous-coding/) [secondary]).
  - Anthropic's harness built a working DAW in about 4 hours ([Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps)).
- Independent evaluators, holdouts and e2e-on-the-running-app measurably beat letting an agent grade itself. This is documented in [Anthropic Mar 2026](https://www.anthropic.com/engineering/harness-design-long-running-apps) and [StrongDM](https://factory.strongdm.ai/).
- Risk-tiered review is real and shipping: low-risk changes auto-approved, high-risk ones routed to humans ([Cursor](https://cursor.com/blog/automations), [Factory](https://factory.com/articles/reviewing-agent-generated-pull-requests)).

**Hype, or not demonstrated:**
- **Small samples.** Shapiro says Level 5 is "a handful of people" ([Shapiro](https://www.danshapiro.com/blog/2026/01/the-five-levels-from-spicy-autocomplete-to-the-software-factory/)). The flagship cases are 3–7-person teams.
- **Self-reported results.** StrongDM's scenarios and satisfaction scores are not published, a gap Willison is quoted as raising ([Medium](https://medium.com/@polyglot_factotum/slop-review-with-ai-the-dark-factory-ffca22406822) [secondary]). OpenAI's product is internal. Cursor's browser was "never meant for outside use" ([Cursor](https://cursor.com/blog/self-driving-codebases)).
- **Green tests are not the same as mergeable code.** METR estimates about half of test-passing SWE-bench PRs would be rejected by maintainers, about 24 points below benchmark scores ([METR](https://metr.org/notes/2026-03-10-many-swe-bench-passing-prs-would-not-be-merged-into-main/)). That is exactly the gap a factory without review has to close.
- **Circular verification.** When the same model writes, tests and judges the code, the useful mismatch that human testing provides disappears. StrongDM's satisfaction metric is itself an AI judge ([Stanford CodeX](https://law.stanford.edu/2026/02/08/built-by-agents-tested-by-agents-trusted-by-whom/)).
- **Organisation-wide numbers point the other way.** Faros telemetry (22K developers): epics +66%, but incidents per PR +242.7%, median review time 5x, deployments per week −11.7% ([Faros](https://www.faros.ai/research/ai-acceleration-whiplash) [vendor; correlational]).
- **Greenfield bias.** Huntley says he would not use Ralph on existing codebases ([Ralph](https://ghuntley.com/ralph/)). Lopopolo says zero-to-one prototyping and the hardest refactors still need heavy steering ([Latent Space](https://www.latent.space/p/harness-eng) [secondary]).

---

## 7. Failure modes and costs

### Reported failure modes

| Failure | Source |
|---|---|
| Agents rewrite tests to fit the code, or write code that passes only narrow tests | [StrongDM](https://factory.strongdm.ai/); reward hacking in [METR](https://metr.org/blog/2025-06-05-recent-reward-hacking/) |
| Declaring victory too early; trying to one-shot the task and running out of context | [Anthropic Nov 2025](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) |
| Self-evaluation bias; a lenient evaluator talks itself into approving; stubbed features | [Anthropic Mar 2026](https://www.anthropic.com/engineering/harness-design-long-running-apps) |
| "Context anxiety" (wrapping up early near the context limit) | [Anthropic Mar 2026](https://www.anthropic.com/engineering/harness-design-long-running-apps) |
| Duplicate implementations after a failed grep; placeholder code; builds broken overnight; drift | [Ralph](https://ghuntley.com/ralph/) |
| Lock contention on shared state; an executor refusing to plan; agents missing memory leaks and deadlocks; a bad initial spec causing an architecture dead end; unnecessary dependencies | [Cursor](https://cursor.com/blog/self-driving-codebases) |
| Unclear intent gets amplified at scale | [Cursor](https://cursor.com/blog/self-driving-codebases) |
| Humans lose track of the code's state; build times creep up; MCP tool output floods the context | [Latent Space](https://www.latent.space/p/harness-eng) [secondary] |
| **Maintenance cliff:** HumanLayer went lights-off in July 2025. When the site went down and the agent couldn't fix it, an engineer had to "dig into that codebase that you stopped reading three months ago". Review was turned back on | [AI Engineer talk](https://www.ai.engineer/talks/Ib5GBkD555M-harness-engineering-is-not-enough-why-software); paraphrase in [Signadot](https://www.signadot.com/software-factory/) [vendor] |
| CI load explosion (25x jobs in 6 months), forcing test-impact analysis | [Anthropic/Claude](https://claude.com/resources/articles/agentic-coding-is-straining-ci-heres-how-we-scaled-test-impact-analysis-at-anthropic) |
| Liability and audit: legal frameworks "assume someone, somewhere, looked at the work"; code-reading skill atrophies | [Stanford CodeX](https://law.stanford.edu/2026/02/08/built-by-agents-tested-by-agents-trusted-by-whom/) |

### Costs

| Figure | Source |
|---|---|
| At least $1,000 of tokens per engineer per day as a target (about $20K/month) | [StrongDM](https://factory.strongdm.ai/); arithmetic in [Willison](https://simonwillison.net/2026/Feb/7/software-factory/) |
| More than 1B tokens/day called "borderline negligent" not to use; about $2–3K/day *estimated by Latent Space* | [Latent Space](https://www.latent.space/p/harness-eng) [secondary] |
| "Trillions of tokens" for the Cursor browser | [Willison](https://simonwillison.net/2026/Jan/19/scaling-long-running-autonomous-coding/) [secondary] |
| Full harness: 6 hr / $200 vs solo agent 20 min / $9 (more than 20x); DAW about $124.70 / 3 hr 50 min | [Anthropic Mar 2026](https://www.anthropic.com/engineering/harness-design-long-running-apps) |
| $50K contract delivered for $297 of tool costs (anecdote, screenshot of a DM) | [Ralph](https://ghuntley.com/ralph/) |
| Gas Town users quickly need 2–3 Claude Max subscriptions | [heise](https://heise.de/-11178824) [secondary] |
| A $200/month plan is enough to experiment with the patterns | [Willison](https://simonwillison.net/2026/Feb/7/software-factory/) |

Willison's point: at StrongDM's spend the approach becomes "more of a business model exercise" ([Willison](https://simonwillison.net/2026/Feb/7/software-factory/)).

### What it suits

**Good fits:**
- Greenfield work ([Ralph](https://ghuntley.com/ralph/)).
- Work with an external oracle: specs, a reference implementation, or a port. Examples are StrongDM's "Shift Work" and "Semport" ([techniques](https://factory.strongdm.ai/techniques)) and the browser built against the WhatWG specs ([Willison](https://simonwillison.net/2026/Jan/19/scaling-long-running-autonomous-coding/)).
- Integration-heavy code where third parties can be twinned ([StrongDM](https://factory.strongdm.ai/)).
- Routine, well-defined maintenance ([Cursor Automations](https://cursor.com/blog/automations)).

**Poor fits:** novel product work, the hardest refactors ([Latent Space](https://www.latent.space/p/harness-eng) [secondary]), and existing codebases without strong tests ([Ralph](https://ghuntley.com/ralph/)).

### Risk tiering (what still gets human review)

- Factory.ai routes **authentication, billing, deployment and data migration** paths to humans via CODEOWNERS. For changes going to production it also checks for broadened permissions, migration compatibility and a rollback plan ([Factory](https://factory.com/articles/reviewing-agent-generated-pull-requests) [vendor]).
- Cursor scores **blast radius, complexity and infrastructure impact**, auto-approves low-risk PRs, and gives the rest up to 2 human reviewers ([Cursor](https://cursor.com/blog/automations) [vendor]).
- OpenAI keeps humans on **release cut plus smoke test** rather than on per-PR review ([Latent Space](https://www.latent.space/p/harness-eng) [secondary]).
- Suggested measurements: escaped defects, revert rate and change-request rate by task class, not PR volume ([Factory](https://factory.com/articles/reviewing-agent-generated-pull-requests)).

---

## 8. Stack-specific notes (Java Spring Boot, Rust, Node/TypeScript)

The factory loop is only as fast as its slowest backpressure signal. Huntley stresses balancing compile speed against correctness ([Ralph](https://ghuntley.com/ralph/)), and OpenAI kept builds under a minute ([Latent Space](https://www.latent.space/p/harness-eng) [secondary]). Parallel compilation also turns disk I/O into a bottleneck ([Cursor](https://cursor.com/blog/self-driving-codebases)). Plan for N worktrees building at the same time.

### Java / Spring Boot service

- **The costly signal is the Spring context, not javac.**
  - The TestContext framework caches `ApplicationContext`s per JVM, by default up to 32 (LRU).
  - Any difference in `@MockitoBean`, `@TestPropertySource`, profiles or `@DynamicPropertySource` creates a *new* context.
  - `@DirtiesContext` evicts the cached context.
  - Forking a JVM per test throws the cache away ([Spring docs](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/caching.html)).
  - Agents add one-off `@MockitoBean`s freely, so put a lint or architecture rule against new context configurations. Otherwise suite time quietly multiplies.
- **Loop tiers.**
  - Inner loop: `compile` plus unit tests and test slices.
  - Merge gate: `@SpringBootTest` with real dependencies in containers ([Testcontainers](https://testcontainers.com/)), for example a real Postgres rather than H2.
  - Holdout layer: HTTP scenarios against the booted jar.
- **Boot cost for e2e.** For repeated scenario runs against a packaged app, the Spring Boot docs recommend the JVM **AOT cache** (Java 25+, JEP 483) over the older CDS. Both need a training run, and the cache is valid only while the app and JDK are unchanged ([Spring Boot AOT cache](https://docs.spring.io/spring-boot/4.0/reference/packaging/aot-cache.html)). A fresh worktree build invalidates it, so it helps more for the scenario runner than for inner loops.
- **Type system.** Strong at compile time, but reflection, annotations and DI wiring fail at *startup*. That is why a boot-smoke check (the context loads) is a cheap, high-value gate.
- **Contracts.** For microservices, consumer-driven contracts ([Pact](https://docs.pact.io/)) let each service's factory verify on its own against the shared expectations. Pact checks only the interactions consumers actually use, not full provider behaviour ([Pact](https://docs.pact.io/)), so keep scenarios as well.

### Rust project

- **The strongest backpressure, and the slowest.**
  - The type and borrow checker rejects a large class of agent errors before tests run. This suits loops where the compiler is the reviewer. Huntley's CURSED compiler is written in Rust ([Ralph](https://ghuntley.com/ralph/)).
  - But 55% of survey respondents wait more than 10 seconds for incremental rebuilds. Linking is always done from scratch. `cargo check` and `cargo build` don't share a cache, so running both compiles twice ([Rust compiler performance survey 2025](https://blog.rust-lang.org/2025/09/10/rust-compiler-performance-survey-2025-results/)).
- **Practical steps** (survey-recommended):
  - LLD or mold as the linker.
  - Fewer dependencies and features; split large crates.
  - `debuginfo = "line-tables-only"`.
  - Separate target dirs for the IDE and agents ([survey](https://blog.rust-lang.org/2025/09/10/rust-compiler-performance-survey-2025-results/)).
  - Per-worktree `target/` directories multiply disk use and cold builds, so consider a shared compilation cache such as sccache ([sccache](https://github.com/mozilla/sccache)).
  - Use `cargo check` as the inner loop and a full `test` at the gate.
- **Gaps the compiler doesn't cover.** Cursor's agents did not notice memory leaks or deadlocks without explicit tooling ([Cursor](https://cursor.com/blog/self-driving-codebases)). Add `unsafe` lint rules, `cargo deny` or `audit`, and a dependency policy, since agents pull in crates they could have written themselves ([Cursor](https://cursor.com/blog/self-driving-codebases)).
- **Boot cost.** Usually small: binaries start fast. Scenario runs are cheap once the binary is built.

### Node / TypeScript web app

- **Fastest loop, weakest guarantees.**
  - TypeScript 7.0 (native Go port, released 2026-07-08) makes full type-checks typically 8–12x faster. Example: the VS Code repo went from 125.7 s to 10.6 s ([TypeScript 7.0 announcement](https://devblogs.microsoft.com/typescript/?p=5246)).
  - Caveat: 7.0 ships no programmatic API, so typescript-eslint and framework language tools may need `tsc6` side by side until 7.1 ([same](https://devblogs.microsoft.com/typescript/?p=5246)).
- **The type system can be bypassed.** `any`, casts and `@ts-ignore` let an agent "pass" the type-checker. Enforce `strict` plus lint bans as non-negotiable backpressure. Runtime validation at API edges, such as schema parsing, covers what types erase.
- **The web UI needs a running-app oracle.** Anthropic's harnesses depend on Puppeteer or Playwright driving the live app ([Nov 2025](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), [Mar 2026](https://www.anthropic.com/engineering/harness-design-long-running-apps)). OpenAI swapped Playwright-over-MCP for a CLI shim because of context bloat ([Latent Space](https://www.latent.space/p/harness-eng) [secondary]). Browser-native dialogs were a blind spot ([Anthropic Nov 2025](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)). A visual or design evaluator needs few-shot calibration ([Anthropic Mar 2026](https://www.anthropic.com/engineering/harness-design-long-running-apps)).
- **Monorepo sprawl.** OpenAI's repo reached about 500 npm packages ([Latent Space](https://www.latent.space/p/harness-eng) [secondary]). Use test-impact analysis or affected-only runs. CI volume will grow ([Anthropic/Claude](https://claude.com/resources/articles/agentic-coding-is-straining-ci-heres-how-we-scaled-test-impact-analysis-at-anthropic)).
- **Contracts.** The front end and back end can share types in a monorepo. Across separate repos or third-party APIs, use Pact or digital twins as StrongDM does.

### Summary comparison

| | Spring Boot | Rust | Node/TS |
|---|---|---|---|
| Inner-loop signal | compile + slices; context caching dominates | `cargo check`; slow incremental builds and linking | `tsc` (7.x fast) + Vitest/Jest-style unit tests |
| What types catch | Good, but DI and reflection fail at boot | Very strong (memory and thread safety) | Moderate; can be bypassed with `any` and casts |
| Boot cost for e2e | High; mitigate with the AOT cache | Low | Low to moderate (dev server, browser) |
| Main e2e oracle | HTTP scenarios + Testcontainers | CLI or HTTP scenarios, property tests | Playwright against the running app |
| Gaming risk | Mock overuse, `@Disabled` tests | `unsafe`, `#[ignore]`, `todo!()` | `any`, `@ts-ignore`, snapshot rewrites |

---

## 9. Gaps and unverified items

- **The OpenAI primary post was not fetched** (HTTP 403 on openai.com and on the mirror). Figures for 1M LOC, about 1,500 PRs, 3 engineers growing to 7, about 5 months, about 1/10th the time, and the 2026-02-11 date come from search-engine summaries of the post plus the [Latent Space](https://www.latent.space/p/harness-eng) interview. The no-human-review and token-spend claims are interview or secondary only.
- **Yegge's "Welcome to Gas Town" Medium post** returned 403. The Gas Town release date and 17-day build time are secondary, and his 8-stage developer scale is unverified.
- **Cursor's original "scaling agents" post** was not fetched directly. Its figures come from Willison and from the later Cursor "self-driving codebases" post.
- **The Addy Osmani "light vs dark factory" essay** was mentioned in a DEV post but not found.
- **Faros Q3 figures** ("PRs merged with no review +76.3%") were seen only via Signadot [vendor].
- **The Dex Horthy talk** was checked only through the talk page summary, not the transcript. The talk page does not say the outage was "unfixable"; a human dug in.
- **StrongDM's results** (satisfaction scores, defect rates) are not published. No independent audit of any dark-factory output was found.
- **No controlled study** compares escaped-defect rates for factory vs human-reviewed pipelines. The METR, Faros and CodeRabbit figures are adjacent evidence only.
- The stack-specific advice is synthesised from tool documentation plus the practitioner reports above. None of the practitioners published Spring Boot-specific factory results.
