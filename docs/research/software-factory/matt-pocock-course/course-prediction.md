# Predicted structure of "Software Factories for Real Engineers" (cohort of 2026-11-09)

**Date:** 2026-11-02, one week before lessons unlock.
**Status: prediction.** Only the eight workshop names, the week split, the price and the logistics are public. Every lesson-level claim below is inferred from the public pages, Matt's posts, and what changed in `mattpocock/skills` and `mattpocock/sandcastle` in the six weeks before the course. Each row carries its evidence and a confidence. No paid content was accessed.
**Method:** Public pages re-fetched on 2026-11-02 (the cohort page was edited on 2026-10-29), his X posts from 2026-09-04 to 2026-11-02, the skills repo's PRs, changesets and workflows, and the Sandcastle repo. Subagents gathered the sources; the notes live in the firstmate data directory for this task.
**Companions:** [../workflows/matt-pocock/course-software-factories.md](../workflows/matt-pocock/course-software-factories.md) (the public syllabus as recorded on 2026-10-26), [github-actions-orchestration.md](github-actions-orchestration.md), [chief-of-staff-and-companions.md](chief-of-staff-and-companions.md), [skills-pr-catalogue.md](skills-pr-catalogue.md), [adw-adoption-game-plan.md](adw-adoption-game-plan.md).

---

## 1. What is public and certain

| Item | Fact | Source |
|---|---|---|
| Workshops | Eight, in this order: Before We Start (open now), Domain Language, Wayfinder, Review, Codebase Design, Feedback Loops, **Software Factory Part One**, **Software Factory Part Two**. Modules 2 to 8 unlock on 2026-11-09. | [cohort page](https://www.aihero.dev/cohorts/software-factories-for-real-engineers-xdy1m) |
| Size | "seven workshops and 59 lessons" (the boss letter counts the seven content workshops), "about 5 to 8 hours a week", two weeks, six office hours, a provided example codebase. | [letter to your boss](https://www.aihero.dev/boss/software-factories-for-real-engineers-xdy1m), cohort page |
| Week split | Week 1 "From Domain Language to Codebase Design"; Week 2 "Feedback Loops and Building Your Factory". | cohort page |
| Framing | "The goal of any software factory is **speed**." Most people "start building **accelerators**... 'loop engineering'... infrastructure to connect their agents to data sources, and to run them in sandboxes". "That's why starting with accelerators is backwards." "In this cohort, we'll spend *a lot* of our time learning and building your Software Factory's brakes." | cohort page (wording added by the 2026-10-29 edit) |
| Three layers of safety | automated checks, automated review, human review. | cohort page |
| The factory in one sentence | "a setup where an agent takes a well-specified ticket, does the work inside guardrails, and comes back with clean code and a pull request worth reviewing." | boss letter |
| Section titles | The course starter repo's README names section 7 "Software Factory Part One: Running your agent in GitHub Actions" and section 8 "Part Two: Choosing the infrastructure your factory runs on, and designing the jobs you want it to do", and frames the whole course as "put the brakes on first (review, automated checks, feedback loops), then build a factory that runs your agent in GitHub Actions". Students run Opus on their own Claude subscription in a public repo, where Actions minutes are free. | [ai-hero-dev/cohort-005-project README](https://github.com/ai-hero-dev/cohort-005-project/blob/main/README.md); see [github-actions-orchestration.md](github-actions-orchestration.md) §2 |
| Free lesson | 6 minutes, 2026-10-27: "how you can use a trusted Software Factory to intervene in some or all of the steps of **Explore, Approve, Implement, Review and Merge**." | [free lesson](https://www.aihero.dev/a-free-lesson-from-software-factories-for-real-engineers~57zjo) |
| Tooling | Claude Code CLI; Claude Max $100 is enough for the course. | cohort page |

The accelerator-versus-brakes framing is lifted straight from the `software-factory` skill: "Every trigger is an accelerator. Accelerators without brakes make a slop cannon" ([SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/in-progress/software-factory/SKILL.md)). The page and the skill were written weeks apart by the same person, so the course's spine is the skill's "Start slow" section.

## 2. Predicted lesson structure, workshop by workshop

Confidence: **H** means stated publicly in some form; **M** means strongly implied by a dated artifact; **L** means plausible from the skills repo only.

### Workshop 1: Before We Start (open now)

| Predicted content | Evidence | Conf. |
|---|---|---|
| The AI Coding Crash Course as prerequisite (models, harnesses, the agent's environment). | Listed as included, "about 3 days". | H |
| Installing the skills as a self-updating plugin and running `/setup-matt-pocock-skills` on the example codebase (tracker doc, triage labels, glossary layout). | README now "leads with self-updating installs" ([#1218](https://github.com/mattpocock/skills/pull/1218)); setup creates the triage labels ([#1197](https://github.com/mattpocock/skills/pull/1197)); copies seed templates "word for word" (draft [#1355](https://github.com/mattpocock/skills/pull/1355)). | M |
| GitHub as the tracker: issues, labels, sub-issues, native dependencies. | Setup migrated to GitHub-native structure in October ([#1188](https://github.com/mattpocock/skills/pull/1188), [#1228](https://github.com/mattpocock/skills/pull/1228)). The Part One factory is "entirely on GitHub Actions". | M |

### Workshop 2: Domain Language

| Predicted content | Evidence | Conf. |
|---|---|---|
| `/grill-with-docs` producing `GLOSSARY.md` and ADRs; "ubiquitous language, the project map". | Cohort page and learning outcome 1. | H |
| The `CONTEXT.md` to `GLOSSARY.md` rename and migration. | Setup now offers "legacy CONTEXT.md" migration ([#1228](https://github.com/mattpocock/skills/pull/1228)); the v1.3 post is titled with `GLOSSARY.md`. | M |
| Grilling mechanics: the design-tree frontier, "yes accepts the recommendation", questions numbered across the whole conversation. | [#1193](https://github.com/mattpocock/skills/pull/1193) merged, draft [#1224](https://github.com/mattpocock/skills/pull/1224). | M |

### Workshop 3: Wayfinder

| Predicted content | Evidence | Conf. |
|---|---|---|
| Planning work bigger than a session: a map issue, decision tickets, "decisions, not deliverables", then `/to-spec` and `/to-tickets` into tracer-bullet tickets with blocking edges. | Cohort page: "map the work, grill and prototype risky parts, produce specs". | H |
| Tickets as GitHub sub-issues with native blocking; the frontier query. | [#1188](https://github.com/mattpocock/skills/pull/1188), [#1228](https://github.com/mattpocock/skills/pull/1228). | M |
| `/implement-spec` with a fresh implementer subagent per ticket, one integration branch, a merger subagent. | Graduated in v1.3 ([#1120](https://github.com/mattpocock/skills/pull/1120)); fresh-context fix ([#1342](https://github.com/mattpocock/skills/pull/1342)) merged 11 days before the course. Boss letter: "work through several tickets in parallel". | M |
| Not expected: chief-of-staff replacing wayfinder. | Draft [#1369](https://github.com/mattpocock/skills/pull/1369) is unrun and undecided; no course material names it. | L (that it appears) |

### Workshop 4: Review

| Predicted content | Evidence | Conf. |
|---|---|---|
| "Three kinds of review": automated checks, automated review, human review, and why each catches what the others miss. | Cohort page, boss letter. | H |
| `/code-review`: two fresh-context sub-agents (Standards, Spec), never merged; standards files found on disk. | [#1208](https://github.com/mattpocock/skills/pull/1208), draft [#1353](https://github.com/mattpocock/skills/pull/1353). | M |
| "Hide your coding standards from your implementer agent, fix them in review." | His AI Engineer Paris slide, [post 2026-09-18](https://x.com/mattpocockuk/status/2100928387753635892). | M |
| Faster human review with `/pr`: smallest picture, before/after evidence, merge danger (one-way door, blast radius). | `/pr` graduated in v1.3; cohort page "faster and prioritised human review". | H |
| `/retro` after each run: mechanical lessons become deterministic checks, judgement calls go to `CODING_STANDARDS.md`; rejected ideas go to `.out-of-scope/`. | [#1083](https://github.com/mattpocock/skills/pull/1083), [#1179](https://github.com/mattpocock/skills/pull/1179); boss letter "run a retrospective on each run". | H |

### Workshop 5: Codebase Design

| Predicted content | Evidence | Conf. |
|---|---|---|
| Deep modules, enforced boundaries, rescuing legacy code, making code testable. | Cohort page; his 2026-09-22 post: "A huge chunk of my next course will tackle this: deepening modules, establishing domain language, increasing testability". | H |
| A boundary linter as the worked example (`dependency-cruiser`, `lint:boundaries`, entry points as the only way in). | `setup-ts-deep-modules` exists for exactly this ([#505](https://github.com/mattpocock/skills/pull/505), draft [#1225](https://github.com/mattpocock/skills/pull/1225)). | M |
| "Design it twice" with fact-checked designs; an app as a hierarchy of deep modules with tool-enforced boundaries. | Draft [#1351](https://github.com/mattpocock/skills/pull/1351); Matt's own voice-note issue [#1362](https://github.com/mattpocock/skills/issues/1362) of 2026-10-31. | M |

### Workshop 6: Feedback Loops

| Predicted content | Evidence | Conf. |
|---|---|---|
| Automated checks, custom lint rules, mutation testing, frontend verification. | Cohort page; his 2026-10-25 post lists "mutation testing". | H |
| "a graded test suite, and browser checks"; pre-commit versus per-edit hooks. | Boss letter. | H |
| Prove the signal before trusting it: a forced mutation must land before a red counts; a bug fix's red must reproduce the bug. | [#1209](https://github.com/mattpocock/skills/pull/1209) merged, draft [#1221](https://github.com/mattpocock/skills/pull/1221). | M |

### Workshop 7: Software Factory Part One ("Running your agent in GitHub Actions")

The example codebase is public: [ai-hero-dev/cohort-005-project](https://github.com/ai-hero-dev/cohort-005-project), with Matt's teaching fork carrying four commented workflows (`agent-explore`, `agent-implement`, `agent-implement-spec`, `agent-review`), a feedback-button ticket source that files `agent:explore` issues, and a 15-minute cron. Its commits show the explore, implement and review chain running with no human label and the merge staying human. Details and YAML in [github-actions-orchestration.md](github-actions-orchestration.md) §2 and §4.

"I show you a basic software factory, entirely on GitHub Actions; I name every part of it and show you how GitHub is hiding a lot of complexity" ([post 2026-10-25](https://x.com/mattpocockuk/status/2114432666103931215)).

| Predicted content | Evidence | Conf. |
|---|---|---|
| The seven reasons to start on Actions: free sandboxes for public repos, an existing login, issues as tickets, labels trigger Actions that open PRs, "Actions can apply labels, which create loops", cron for daily jobs, run pages as observability. | [post 2026-10-02](https://x.com/mattpocockuk/status/2105947776236376475), with the reply "(and yes, we'll be doing this in my next course)". | H |
| Five intervention points, each a task or a human gate: **Explore** (triage a ticket), **Approve** (a human applies `ready-for-agent`), **Implement** (a run opens a draft PR), **Review** (automated review, rework loop), **Merge** (a human). | Free lesson title; the chain matches `EXAMPLE-TASKS.md` Explore, Implementer, Automated review, Rework, with "a human merges". | M |
| "Naming every part": the Actions workflow is the Orchestrator, the job is the Run, the hosted runner is the Runner, GitHub Issues is the Ticket tracker, the repo is the Git host, run pages are the Observability platform. "What GitHub is hiding": that one product fills five slots, that `GITHUB_TOKEN` events start no new workflows, bot identity, concurrency, cron drift. | The skill's three-design table and `GIT-HOSTS.md` gotchas; see [github-actions-orchestration.md](github-actions-orchestration.md). | M |
| "run agents unattended in a sandbox, with secrets and permissions under control and the build step separated from the review step." | Boss letter, bullet 6. | H |
| "feed the factory from a ticket queue or a schedule, and work through several tickets in parallel." | Boss letter, bullet 7. | H |
| Brakes first: human review on every PR, one throttled trigger at a time, a cap on retries. | Skill "Start slow"; cohort page "starting with accelerators is backwards". | H |

### Workshop 8: Software Factory Part Two ("Choosing the infrastructure your factory runs on, and designing the jobs you want it to do")

"We brainstorm how YOU are going to build your own factory, with infra recommendations (and a new skill!); We sketch out 5 different tasks on YOUR infra, each testing different system design principles" (same post).

| Predicted content | Evidence | Conf. |
|---|---|---|
| The new skill is `/software-factory`, called alongside `/grill-me`: "Prompt of the day: /grill-me on how a /software-factory might help us... brainstorms the infra you need". | [post 2026-10-22](https://x.com/mattpocockuk/status/2113196247964074322); PR [#1316](https://github.com/mattpocock/skills/pull/1316) body: "Matt wants Software Factory Part Two to give students a generic language for designing their own factory, deployed on their own infrastructure". | H |
| The vocabulary: Task, Trigger, Run, Runner; Ticket tracker, Ticket source, Git host, Orchestrator, Observability platform. | The merged skill. | H |
| "Infra recommendations" are the four slot surveys (ticket trackers, git hosts, runners, observability platforms) and the three reference designs (all on GitHub, Linear plus own server, own tracker). | "Also includes initial research docs on: Orchestrators, Git hosts, Ticket trackers, Runners. To help you set up the infra" (follow-up post). | H |
| The five tasks are chosen from the skill's nine example tasks, each testing a different principle: Explore (dedupe, question 5), Implementer (claim and draft PR), Automated review plus Rework (a capped loop), Ratchet (a clock trigger and a shrinking exception list), Retro or Fix (a factory that changes itself only under human review). | `EXAMPLE-TASKS.md`; "each testing different system design principles" matches the five questions per task. Which five is unknown. | M |
| Each student answers the five questions per task and names a product per slot; a design is "done" when every slot and question has an answer. | Skill "Question every task" and its done condition. | H |
| Sandcastle as the "your own infra" path: templates for Inngest and Trigger.dev, sandbox providers, HITL over Slack and Discord, every skill as an `Agent()` function. The course fork's open issue 16 is titled "Move the software factory off GitHub Actions onto Linear, Inngest, Daytona and Langfuse" and names a Factory GitHub App. | [Sandcastle v1 pitch 2026-11-01](https://x.com/mattpocockuk/status/2116805878187794740); v0.13.0 shipped 2026-11-02; [issue 16](https://github.com/mattpocock/cohort-005-project-fork-2/issues/16). Not named on the course page. | M |
| Known packaging defect at course start: the skill's frontmatter has an unquoted colon, so `npx skills` and pi skip it. | Review comment on #1316, issue [#1373](https://github.com/mattpocock/skills/issues/1373). Expect a fix before or during the course (inference). | H (the defect), L (timing of the fix) |

## 3. The five-step model is the skeleton

The free lesson names Explore, Approve, Implement, Review, Merge. Read against the skill's example tasks, that is one chain, with the human at two places:

```
ticket opened ──► Explore (agent: reproduce, sort, brief) ──► Approve (human: label ready-for-agent)
      ──► Implement (agent: build until checks pass, draft PR) ──► Review (agent: cold diff vs standards + ticket;
      Rework on fail, capped) ──► Merge (human)
```

This is the same day-shift / night-shift split the earlier research recorded ([../workflows/matt-pocock/overview.md](../workflows/matt-pocock/overview.md) §4.5), now stated as five slots a factory may own "some or all of". The prediction is that Part One builds this exact chain on Actions, and Part Two asks each student which of the five steps their own factory should take over first, with the human kept at Approve and Merge.

## 4. What is probably not in the course

| Topic | Why probably not | Conf. |
|---|---|---|
| `chief-of-staff`, the LLM wiki | Never mentioned on the course page, in the boss letter, or in any course post. Matt calls it experimental and a likely "slop cannon". See [chief-of-staff-and-companions.md](chief-of-staff-and-companions.md). | M |
| Self-merge or merge tiers | Every example task ends with "a human merges"; the course sells "human review". His 2026-10-25 musing that automerge might be decided deterministically under "very, very strict constraints" (only reorganises code, module graph unchanged, coverage not worse) is a hint, not a lesson. | M |
| A run-the-app verifier | The three brakes are checks, cold review and human review; "frontend verification" in Week 2 is a check, not an independent verifier. The earlier finding stands: our `verify` fills a gap his stack still has. | M |
| "Dark factory" by name | Not on the page. The dictionary entry exists, so it may appear as a warning. | L |
| Linear, Jira or non-GitHub trackers in depth | Scope is GitHub, GitLab and local markdown ([SCOPE.md](https://github.com/mattpocock/skills/blob/main/SCOPE.md)); the surveys cover other trackers at the level of deciding questions only. | M |

## 5. Timeline

| Dates | Expected | Source |
|---|---|---|
| 2026-11-02 | Early bird ends. | cohort page |
| 2026-11-09 | Modules 2 to 8 unlock; kickoff office hours. | cohort page |
| 2026-11-09 to 13 | Week 1: workshops 2 to 5 (Domain Language, Wayfinder, Review, Codebase Design). | week split (inference on mapping) |
| 2026-11-16 to 20 | Week 2: workshops 6 to 8 (Feedback Loops, Part One, Part Two). Office hours on 11-16 and 11-20. | week split, the 10-26 notes |

## 6. How to check this prediction after 2026-11-09

Public artifacts that would confirm or refute the table above, without buying the course:

1. A changeset or PR in `mattpocock/skills` that quotes the frontmatter fix for `software-factory` (#1373) or renames terms the course scripts use ("trigger / state / workflow / action" alignment was parked in #1316).
2. New Sandcastle templates named after the example tasks (explore, review, rework, ratchet) or an Actions-based template; a `.github/workflows/` directory in a course example repo.
3. The course example repo and Matt's fork: new or edited workflows under `.github/workflows/`, movement on issue 16, and any retry counter appearing in the chain. At least one third-party repo named like `software-factory-course` appeared on 2026-11-01 and was not read here.
4. The AI Hero RSS feed and his posts in the week of 2026-11-09, which usually restate the lesson of the day.
5. Office-hours transcripts, if any are made public.

## 7. Delta from the 2026-10-26 notes

- The page now lists eight named workshops, including the two Software Factory parts; on 2026-10-26 it listed only the week themes.
- The accelerators-versus-brakes framing and "starting with accelerators is backwards" are new wording.
- The software-factory skill moved from draft to merged (unchanged in content), which removes the "may change before merge" caveat in the dissection.
- Sandcastle v1 was pitched on 2026-11-01 as the factory-on-your-own-infra tool, which was not visible in October.
- The "letter to your boss" page gives the only public hint of the two factory modules' lesson content (sandboxes, secrets, build separated from review, ticket queue or schedule, parallel tickets).
