# Software Factories for Real Engineers (Matt Pocock's cohort)

**URL:** https://www.aihero.dev/cohorts/software-factories-for-real-engineers-xdy1m
**Date fetched:** 2026-10-26
**Note:** This is a paid course. This file records only what the public sales page shows (via a summarising fetch, so treat wording as close paraphrase). No paid lesson content was accessed. Prices and dates may change.

## Logistics

| Item | As listed |
|---|---|
| Tagline | "Use your Real Engineering skills to ship code at scale and maintain a self-improving codebase" |
| Instructor | Matt (Pocock), hosted on aihero.dev |
| Format | Two-week async cohort; all lessons unlock Nov 9, self-paced |
| Dates | Mon Nov 9 to Nov 20 (2026) |
| Content | Nearly 60 videos plus hands-on exercises in a sandbox, example codebase, course code repo |
| Live support | Six Office Hours across Nov 9, 16, 20 (staggered for time zones), recorded with transcripts; questions can be submitted in advance |
| Community | Private AI Hero Discord with a cohort channel |
| Price | $1,295 full. Early bird 30% off until 11:59pm PST Nov 2. Returning students (prior Claude Code / AI Coding cohorts) 40% off, $777. Crash Course buyers since August get a discount equal to what they paid (stackable). Teams of 5+ get 35-45% off (aihero.dev/for-teams, team@aihero.dev) |
| Prerequisite | AI Coding Crash Course, included free ($299 value), self-guided, about 3 days: how models work, how harnesses work, the agent's environment |
| Access | Permanent |
| Tooling guidance | Taught with Claude Code CLI. Claude Max $100/month is enough for the course; Max 20x ($200) recommended for a real Software Factory. Other tools (Copilot, Cursor, Windsurf) can be used; principles transfer |
| Who it's for (implied) | Engineers on brownfield codebases, often in teams, who want to delegate well-specified tickets to agents with less review and babysitting |

## Syllabus (as listed)

**Week 1: From Domain Language to Codebase Design**
- Kickoff Office Hours
- Shared glossary and ADRs using `/grill-with-docs`
- Planning large work with the Wayfinder skill: map the work, grill and prototype risky parts, produce specs
- Three kinds of review, faster and prioritised human review, retros that improve the system that writes code
- Codebase design: deep modules, enforced boundaries, rescuing legacy code, making code testable
- Wrap-up Office Hours

**Week 2: Feedback Loops and Building Your Factory**
- Automated checks, custom lint rules, mutation testing, verification for frontend apps
- Build a Software Factory on GitHub Actions to investigate, triage, assign, delegate, track and review units of work
- Design your own factory for your codebase and team
- Week 2 Office Hours with Matt

## Learning outcomes (as stated)

1. Create and document the team's knowledge: ubiquitous language, project map, ADRs, specs, tickets, continually improving code.
2. Coding standards enforced through written guidance, tests, linters, type checks and automated review.
3. Three layers of checks: automated checks, automated review, human review.
4. A codebase that is better for developers, users and coding agents.

Promised results: less bug-chasing (factory triages bugs), less babysitting (agents report when done or blocked), less "brain fry".

## Concepts and tools named

- Concepts: Software Factory, Real Engineering, Real Engineering Loop, loop engineering, DDD, deep modules, tracer bullets, ubiquitous language, ADRs, adversarial review, hooks, mutation testing. `/goal` is described as insufficient on its own.
- Tools: Claude Code CLI, GitHub Actions, `/grill-with-docs`, Wayfinder.
- Books cited: The Pragmatic Programmer; Working Effectively With Legacy Code; A Philosophy of Software Design.

## How it relates to this research

- **Week 2 is "Part Two".** The public page does not use the term, but its factory build (GitHub Actions that investigate, triage, assign, delegate, track, review; "design your own factory") matches the PR's stated purpose: the `software-factory` glossary skill is the language for "Software Factory Part Two", a course module. See [../../dissections/matt-pocock/software-factory-skill.md](../../dissections/matt-pocock/software-factory-skill.md). The page names GitHub Actions as the runner; the skill's Task/Trigger/Run/Runner vocabulary is deliberately runner-agnostic. Whether the course teaches those exact terms is not visible publicly.
- **Week 1 matches skills we already have installed:** `/grill-with-docs`, Wayfinder, `domain-modeling` (glossary + ADRs), `codebase-design` (deep modules), `code-review`, `retro`. The overview's pipeline ([overview.md](overview.md)) is the same material minus the course framing.
- **Review and checks layers** (automated checks, automated review, human review) are the same three layers recorded in the overview; the course keeps a human layer, consistent with his "dark factory is a failure mode" stance.
- **Curriculum coverage** ([../../curriculum.md](../../curriculum.md)): Exercise 3 (Pocock pipeline) maps to Week 1. Part 2 lessons Shape (grill, prototype), Plan (Wayfinder/specs), Review and Learn (retros, lint/test hardening) map to Week 1 and early Week 2. Intake (triage), Dispatch/Isolate (the optional paper design exercise on Task/slots), and Operate/Monitor map to the Week 2 factory build. Merge authority and overnight autonomy are not visibly covered; the page stresses human review, so poteto-style merge tiers look out of scope.
- **Gap to watch:** the page lists mutation testing and frontend verification, which our Verify exercise (Exercise 1) does not cover.

## Employer reimbursement pitch

1. **Less review and babysitting time:** the stated outcome is agents that report back when done or blocked, plus a factory that triages bugs, which cuts senior engineer interruptions.
2. **Quality guardrails, not just speed:** three check layers (automated checks, automated review, human review) with lint rules, type checks and mutation testing keep agent output from degrading the codebase.
3. **Shared team knowledge:** glossary, ADRs, specs and a project map make onboarding and delegation cheaper for both people and agents.
4. **A factory built for our codebase:** the course ends with designing and building one on GitHub Actions, so the deliverable is a working design, not just training.
5. **Low risk and team-friendly:** two weeks, self-paced with recordings, permanent access, 35-45% team discounts for 5+ seats, and it runs on a $100/month Claude plan.
