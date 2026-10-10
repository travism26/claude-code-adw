# The seven-phase AI workflow, scrutinized: convergence vs. criticism

**Date:** 2026-08-17
**Question:** Matt Pocock's seven-phase flow — Idea → Research (opt) → Prototype (opt) → PRD →
Kanban → Implementation → QA/Code Review — which phases are independently backed, which are
his framing, and which have documented failure modes? Purpose: decide what enters
`docs/AI_DEVELOPMENT_PRACTICES.md` without bloating it or handcuffing us to ceremony.
**Method:** Two independent research passes (run on Sonnet subagents): one mapping each phase to
primary sources that back it, one deliberately adversarial, hunting sourced criticism. All quotes
fetched live from the cited URL on 2026-08-17; unverifiable claims are flagged, not laundered.

---

## Joint verdict

| Phase | Independent backing | Documented criticism | Net |
|---|---|---|---|
| Idea | Pocock-specific as a *named* phase | none (not a ceremony risk) | fine, not really a "phase" |
| Research (opt) | partial (Task Master's `tm research`, different position) | boundary-blur into spec ceremony | keep optional; sprint-scoped cache |
| Prototype (opt) | Pocock-specific; spike-solution tradition supports the *ordering* | contested on order only, not existence | keep optional; strongest under design uncertainty |
| PRD | **full convergence** (Spec Kit, Kiro, Task Master, Anthropic's SPEC.md pattern) | **most criticized phase by far** — ceremony below a size threshold; "false sense of control" | load-bearing *above* a size/uncertainty threshold; a toll below it |
| Kanban/tickets | **full convergence** (only Pocock + Task Master formalize blocking edges) | thin direct criticism; inherits neighbors' risks | solid |
| Implementation loop | **full convergence** as a stage; unattended-loop mechanics trace to Huntley's Ralph | severe, from the inventor himself | fine attended; unattended needs guardrails, greenfield-only |
| QA plan for human | weakest convergence (Cognition's test plans are the nearest analogue) | none — criticism research *reinforces* verifiable-artifact QA | keep, as complement to machine checks, not substitute |

**Bottom line:** the middle three phases (PRD → tickets → implement) are the actual
"spec-driven development" core that GitHub, AWS, and Task Master arrived at independently — and
they are already this repo's loop (`DEVELOPMENT_WORKFLOW.md` §2: Specify → Plan → Tasks →
Implement). The seven-phase flow adds three Pocock-specific framings (Idea, Prototype, QA-plan)
that are cheap and sensible, and one hard rule the critics all converge on: **match artifact
weight to change size.**

---

## Part 1 — Who backs each phase (convergence pass)

Primary sources fetched: Pocock's `mattpocock/skills` README + aihero.dev/my-7-phases-of-ai-development
+ the installed skills; `github/spec-kit` README + GitHub's SDD blog post;
`kiro.dev/docs/specs/`; `claude-task-master` README + tryhamster.com docs;
`code.claude.com/docs/en/best-practices`; `ghuntley.com/ralph/`; `cognition.com/blog/testing-development`.

- **Idea.** Pocock: "Every project starts with an idea… refine your idea iteratively. I use a
  `/grill-me` skill." No other implementation instruments idea capture as a gate — Spec Kit,
  Kiro, and Task Master all start from a prose description. Pocock-specific.
- **Research (optional).** Pocock: create `RESEARCH.md` "if your idea involves external
  dependencies or difficult exploration phases" — and *time-boxed*: "Research assets typically
  live only for the duration of this sprint… Research can go out of date or cause agents to take
  wrong turns if kept too long." Task Master has a first-class `tm research` but positions it
  *after* task generation. Absent from Spec Kit/Kiro.
- **Prototype (optional).** Pocock: "essential when you need to impose your taste on the
  outcome… By the time you write the PRD, concrete examples are more valuable than abstract
  descriptions." The `prototype` skill: "Throwaway from day one… The main branch keeps only
  the validated decision." No equivalent stage elsewhere (Spec Kit's "Creative Exploration" is a
  loose gesture). Pocock-specific.
- **PRD.** Full convergence, strongest of the seven: Spec Kit `/speckit.specify` ("requirements
  and user stories") + `/speckit.plan`; Kiro `requirements.md` + `design.md`; Task Master
  ("Always start with a detailed PRD… The more detailed your PRD, the better the generated
  tasks") — though Task Master itself hedges: "While a PRD is recommended for complex projects,
  you can always create individual tasks by asking…"; Anthropic's best practices describe the
  same shape un-named ("have Claude interview you first… then write a complete spec to
  SPEC.md").
- **Kanban/tickets.** Full convergence: Spec Kit `/speckit.tasks`, Kiro `tasks.md`, Task
  Master's dependency graph ("When task 5 depends on task 3, Taskmaster ensures task 3 is
  completed before recommending task 5" — with its own "not over-depend" caveat). Only Pocock
  and Task Master formalize blocking edges; Spec Kit/Kiro describe flatter lists.
- **Implementation loop.** Convergent as a stage everywhere; the *unattended loop* mechanics are
  genealogically Huntley's Ralph (`while :; do cat PROMPT.md | claude-code; done`), which Pocock
  credits directly. Huntley's stated preconditions: accurate specs first (he lost a month to a
  bad one), a prioritized fix plan, an agent-readable build/run doc, tests run per iteration,
  human review between loops. Task Master's default is task-by-task, human-directed. Anthropic
  documents fan-out loops but doesn't recommend unattended multi-task execution in its best
  practices.
- **QA plan.** Pocock: "have the agent create a QA plan for human review… you'll iterate through
  phases 5–7 multiple times" — and he flags this himself as the least settled phase. No other
  implementation has it as a named phase. Nearest analogues: Cognition's in-session test plans
  ("This plan must be grounded in source, not assumptions" — a product feature, not neutral
  best practice), Spec Kit's *pre*-implementation `/speckit.analyze` + `/speckit.checklist`,
  Anthropic's fresh-context adversarial subagent review.

---

## Part 2 — What the critics document (adversarial pass)

- **PRD ceremony below the threshold — the fault line.** Birgitta Böckeler (Thoughtworks, on
  martinfowler.com, hands-on trial of Kiro/spec-kit/Tessl): "The requirements document turned
  this small bug into 4 'user stories' with a total of 16 acceptance criteria"; "In the same
  time it took me to run and review the spec-kit results I could have implemented the feature
  with 'plain' AI-assisted coding, and I would have felt much more in control."
  (https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html). Corroborated by Scott
  Logic ("around ten times faster" without SDD; "Spec Kit drags you right back into the past!" —
  https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html)
  and Marmelab ("Ten times slower. More ceremony. Same bugs." —
  https://marmelab.com/blog/2025/11/12/spec-driven-development-waterfall-strikes-back.html).
  Kiro's own docs scope the practice: "A quick fix in chat is fine for straightforward issues
  like typos, simple logic errors, or well-understood one-line changes"
  (https://kiro.dev/docs/specs/best-practices/). Spec Kit's spec-driven.md, notably, sets **no**
  size floor for itself — possibly why it draws the harshest backlash.
- **The false sense of control.** Böckeler: "I frequently saw the agent ultimately not follow
  all the instructions" despite the spec — and the review burden migrates rather than shrinks:
  "I'd rather review code than all these markdown files." Prose specs are advisory to the model;
  machine-verifiable checks are not (cf. practices doc §4, enforce-don't-advise).
- **Waterfall regression — more conditional than the slogan.** Fowler's actual position
  (https://martinfowler.com/articles/designDead.html): evolutionary design beats planned design
  only *with* enabling practices (tests, CI, refactoring); without them "evolutionary design
  cannot possibly work" either — the criticism is symmetric. He flags his Design Stamina
  Hypothesis as "a conjecture, there is no objective proof." DORA's small-batches research
  (about change batch size, not document phases — bridge flagged as inference) cuts against
  large upfront batching.
- **Unattended loops — the inventor's own warnings** (https://ghuntley.com/ralph/):
  "This nondeterminism is the Achilles' heel of Ralph"; "There is no way this is possible
  without senior expertise guiding Ralph. Anyone claiming that engineers are no longer
  required…" is not credible; "You'll wake up to a broken codebase that doesn't compile
  from time to time"; "There's no way in heck would I use Ralph in an existing code base"
  (greenfield-only; expect "90% done"). Also documents effective context degradation
  (~147–152k tokens) on long loops.
- **Prototype ordering.** James Shore on spike solutions
  (https://www.jamesshore.com/v2/books/aoad1/spike_solutions): "a small experiment to research
  the answer to a problem… to give you the information and experience to know how to solve a
  problem, not to produce the code that solves it" — supports prototype-before-design-commitment
  under uncertainty; nothing found arguing prototypes should *replace* specs (that stronger
  claim is inference, flagged).
- **Cost.** Best practitioner-measured data: Scott Logic's ~4× agent time + 3.5 hours human
  markdown review for one modest feature, equivalent code quality. No source measured the full
  seven-phase chain end to end; generic "10–100× token" multi-agent figures are
  marketing-adjacent and deliberately not load-bearing here.

---

## Honesty appendix (merged)

- **Could not find at primary source:** Armin Ronacher or Simon Willison attacking spec-driven
  development by name (both are widely *assumed* to have; neither could be verified on their own
  sites — Ronacher's plan-mode post is adjacent, a preference for lightweight conversational
  iteration, not a hit). The Kiro line "SDD is recommended… not mandatory for every interaction"
  circulates in search synthesis but wasn't confirmed by direct fetch.
- **Secondary, used only as color:** ettema.dev adopter write-up (compressed seven phases into
  two in practice); explainx.ai / LinkedIn / podcast transcripts excluded entirely.
- **Vendor flags:** GitHub's SDD blog post is promotional; Cognition's test-plan post is a
  product feature; Task Master's docs now route through a commercial rebrand (tryhamster.com).
- **Left unconfirmed:** Task Master's `Loop Command` doc (whether it ships a Ralph-style
  unattended loop); Kiro nuance on pages beyond `/docs/specs/`.
