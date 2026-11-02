# chief-of-staff and its companions: Matt Pocock's stateful side of the factory

**Date:** 2026-11-02
**Question:** What is the `chief-of-staff` skill, what came with it, and how does it relate to the `software-factory` skill and to the course that starts on 2026-11-09?
**Method:** The skill files at `mattpocock/skills` main (commit `4ae2317`), the three PRs that shaped it, the commit history of its directory, the issues that mention it, Matt's public posts about it, and the companion skills in `skills/in-progress/`. Source gathering was delegated to subagents; the notes are in the firstmate data directory for this task. Every claim below carries a URL or PR number. Inference is marked.
**Companions:** [../dissections/matt-pocock/software-factory-skill.md](../dissections/matt-pocock/software-factory-skill.md) (the factory glossary, now merged), [github-actions-orchestration.md](github-actions-orchestration.md), [course-prediction.md](course-prediction.md), [skills-pr-catalogue.md](skills-pr-catalogue.md).

---

## 1. Summary

`chief-of-staff` is **one long, human-started session that pursues an unbounded goal by coordinating fresh-context subagents and keeping its memory in a dated, commit-cited wiki**. It is the opposite pole from `software-factory`: the factory skill models short stateless Runs whose only memory is the tracker, the git host and the orchestrator, while chief-of-staff is one stateful session that "will run for a long time, accruing tribal knowledge" ([SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/in-progress/chief-of-staff/SKILL.md)). Neither skill mentions the other.

It is experimental (`skills/in-progress/`, not in the plugin, missing from the in-progress README), user-invoked only (`disable-model-invocation: true`), and Matt's own description of it on 2026-10-06 was that it "will likely turn the agent into a slop cannon in most cases" ([post](https://x.com/mattpocockuk/status/2107529583411265934)). Nothing public ties it to the course. The course page, the "letter to your boss" page and his course posts never mention it (see [course-prediction.md](course-prediction.md) §4).

The captain's hypothesis was that a chief-of-staff skill and a software-factory skill were both coming. Both exist. The factory skill merged on 2026-10-31 ([#1316](https://github.com/mattpocock/skills/pull/1316)); chief-of-staff landed its third PR 36 minutes earlier ([#1363](https://github.com/mattpocock/skills/pull/1363)) and has a fourth open ([#1369](https://github.com/mattpocock/skills/pull/1369)). They are two halves of one picture: the factory is the unattended night shift on remote runners, and chief-of-staff is the attended day-shift coordinator that can drive the same procedures (`to-spec`, `to-tickets`, `implement-spec`, `retro`) from one seat. That pairing is an inference; the PRs do not state it.

## 2. What the skill is

| Fact | Value | Source |
|---|---|---|
| Location | `skills/in-progress/chief-of-staff/SKILL.md` (75 lines) plus `agents/openai.yaml` (5 lines). No companion files. | [tree](https://github.com/mattpocock/skills/tree/main/skills/in-progress/chief-of-staff) |
| Frontmatter | `description: Pursue a long-running goal in a single session by co-ordinating subagents.` and `disable-model-invocation: true`. Codex metadata sets `allow_implicit_invocation: false`. | SKILL.md, `agents/openai.yaml` |
| Who starts it | A human, by typing the skill name, at the start of a long session about one goal. #1369's body: it "only affects people who invoke `chief-of-staff` by hand". | [#1369](https://github.com/mattpocock/skills/pull/1369) |
| Role | "You are the Directly Responsible Individual for this goal... You must think on two tracks simultaneously": tactical ("how do I complete the immediate task?") and strategic ("how do I modify the environment so the next task is easier"). | SKILL.md lines 9 to 12 |
| Status | Not in the plugin (the plugin ships exactly 27 promoted skills). Installable with `npx skills@latest add mattpocock/skills --skill=chief-of-staff`. Not listed in `skills/in-progress/README.md`. | [repo docs note](https://github.com/mattpocock/skills/blob/main/skills/in-progress/README.md) |

## 3. The mechanism

### 3.1 Subagents: fresh, background, sparse

Subagents run in the background and start with a fresh context window (the fresh-context sentence came from [#1341](https://github.com/mattpocock/skills/pull/1341), merged 2026-10-29, after a Codex user reported 339 compactions across 14 forked sessions in [#1328](https://github.com/mattpocock/skills/issues/1328)). The communication rule, verbatim: "Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: research notes, previous commits, wiki pages, and others. Don't duplicate information already available via pointers." The same phrasing is in `implement-spec`, so it is shared vocabulary across his coordinator skills.

### 3.2 Wiki memory, dated and commit-cited (#1304, merged 2026-10-19)

The wiki is an `index.md` plus one page per topic, maintained through three operations: **ingest** (a source becomes cited claims on pages), **query** (answer from pages, citing them), and **lint** (find contradictions and stale claims). Sources are cited, never copied. [#1304](https://github.com/mattpocock/skills/pull/1304) credits a Karpathy gist on LLM wikis (the gist was unreachable when checked).

The rules under "Write history, not the present", verbatim where it matters:

- every claim is dated;
- every claim about code cites the commit it was true at (`repo@sha`);
- "Never write "currently", "now" or "is" about code without a date or commit beside it";
- "When something changes, add a new dated claim and mark the old one superseded. Don't rewrite the old one."

This is the same rule the earlier research adopted for its own notes, and it is the mechanism that makes the wiki safe across a long session: a claim can go stale without becoming wrong.

### 3.3 Shared wiki first (#1363, merged 2026-10-31)

Verbatim: "Look for a shared wiki first, one the user or other agents already keep, and write your pages into it, following its conventions where they differ from the ones below. Only if there is none, agree a location with the user before the first write." Matt's own wiki is the model: on 2026-10-19, the same day as #1304, he wrote that his personal wiki "has become critical infrastructure for my business" and that "Relying on a vendor for memory feels like a recipe for lock-in" ([post](https://x.com/mattpocockuk/status/2112131671097020895)).

### 3.4 Procedures: retro, to-spec, to-tickets, implement-spec (#1363)

Chief-of-staff does not call these four skills through the Skill tool, because all four are `disable-model-invocation: true` and "Making them model-invoked would be a big public API change". It reads their `SKILL.md` by relative path (`../retro/SKILL.md` and so on) and follows them as procedures.

- **Retro**, verbatim: "run a retro on about one in five of your subagents' sessions, including those an `implement-spec` run dispatches. Pick first the ones where something went wrong. In place of retro's last step, decide yourself which candidates are worth pursuing". Retro's last step normally hands candidates to the user. The PR body states the consequence: "Retro findings now become changes without the user picking them first, so chief-of-staff will open more environment-improvement work on its own. Those changes still go through the same review as any other change."
- **Large work**: write a spec, cut tickets, publish them to the tracker, then run `implement-spec` (fresh implementer per ticket in its own worktree, one integration branch, a merger subagent; [#1342](https://github.com/mattpocock/skills/pull/1342)).

The sampling rule moved during the four commits of #1363: "bring the candidates to the user", then "every large run", then "about one in five", with the autonomy added last.

### 3.5 Strategic view (unchanged since 2026-10-06)

"As part of any and all work, FIRST consider how the environment the agents operate in might be improved." Three lists follow: the **pit of success** (constrained APIs, "Lint rules which force correctness", `CODING_STANDARDS.md` files reviewers can enforce), data sources agents should reach, and a no-workarounds rule. On 2026-10-28 he escalated the metaphor to "a black hole of success... Make great code inevitable" ([post](https://x.com/mattpocockuk/status/2115368342898848021)).

### 3.6 A revisable destination, from wayfinder (#1369, open draft, 2026-11-01)

Source: "Matt's voice note of 2026-11-01". The draft adds a `destination.md` wiki page, "your map at low resolution", read before choosing each task, with three parts:

- **Destination**: "the current dated claim, above the ones it superseded". The goal is unbounded, so the destination moves and is redrawn as a new dated claim.
- **Fog of war**: "questions you can tell are coming but can't yet state precisely. A question you can state precisely is work, even if you can't answer it yet."
- **Out of scope**, and the **frontier**: "the work takeable now that moves toward the destination. Choose the next task from it."

The PR body says "Chief-of-staff may replace wayfinder, because the wiki outlives the session where a closed wayfinder map doesn't", leaves wayfinder untouched, and defers deprecation to Matt. It drops wayfinder's tickets, ticket types and "Plan, don't do" rule. It "has not been run yet" and is stacked on a branch that already merged, so it needs a rebase before it can land.

## 4. Evolution

| Date | Change | Source |
|---|---|---|
| 2026-10-05 | Five direct commits create the skill (Schedules, Subagents, Strategic View). No PR, no changeset. | [`e47c149`](https://github.com/mattpocock/skills/commit/e47c149) and following |
| 2026-10-06 | DRI framing and the two tracks replace a "gardener" paragraph. Matt posts a terminal screenshot of the skill proposing "a constrained git stack tool... as a background agent PR" and calls it "an attempt to turn an agent into a strategic thinker". | [post](https://x.com/mattpocockuk/status/2107528718121869448), [post](https://x.com/mattpocockuk/status/2107529583411265934) |
| 2026-10-11 | "My (experimental) /chief-of-staff skill is trying to replace OBS with a homebrew video recorder... Truly bonkers levels of verification". | [post](https://x.com/mattpocockuk/status/2109314001704194090) |
| 2026-10-13 | Issue [#1263](https://github.com/mattpocock/skills/issues/1263) (callbacks and a watchdog to stop model-driven polling) closed as not planned: the skill is "harness-neutral text, so it won't specify callback plumbing for one setup". | issue |
| 2026-10-19 | [#1304](https://github.com/mattpocock/skills/pull/1304): the wiki and "Write history, not the present". Released in 1.3.2. | PR |
| 2026-10-29 | [#1341](https://github.com/mattpocock/skills/pull/1341): fresh context window for every subagent. | PR |
| 2026-10-31 | [#1363](https://github.com/mattpocock/skills/pull/1363): shared wiki first; the four procedures. Pending in release PR [#1343](https://github.com/mattpocock/skills/pull/1343) as 1.3.3. | PR |
| 2026-11-01 | [#1369](https://github.com/mattpocock/skills/pull/1369): destination page (draft). | PR |
| 2026-11-01 to 02 | First outside bug reports: [#1370](https://github.com/mattpocock/skills/issues/1370) (nested subagents' completion notices reach the coordinator, so the middle layer idles) and [#1372](https://github.com/mattpocock/skills/issues/1372) (wiki lint has no deterministic step). | issues |

None of the three PRs had a human review; the rationale lives in the PR bodies, which are written by an agent "on behalf of" Matt from his voice notes.

## 5. How it relates to the other skills

| Skill | Relation |
|---|---|
| `retro`, `to-spec`, `to-tickets`, `implement-spec` | Absorbed as procedures by reading their text at run time (§3.4). A dependency by path, which breaks on harnesses that do not install skills side by side; no CI checks it. |
| `wayfinder` | Not called. Draft #1369 borrows its destination, fog and frontier and may replace it. Wayfinder's own recent change ([#1181](https://github.com/mattpocock/skills/pull/1181)) stopped it applying `ready-for-agent` labels, so neither skill now feeds the factory's AFK queue directly. |
| `grilling`, `handoff` | Not mentioned in chief-of-staff at main or in #1369. Wayfinder uses grilling to name the destination; #1369 only says "Name it with the user before the first task". |
| `software-factory` | Not mentioned in either direction. Opposite poles: stateless Runs with memory only in tracker, git host and orchestrator, versus one stateful session with a wiki. The factory's example tasks include an automated Retro (1 merge in 10) and Decompose; chief-of-staff runs the same procedures by hand (inference: the same loop at two autonomy levels). |

## 6. Companions in `skills/in-progress/`

| Skill | What it is | Factory relevance |
|---|---|---|
| `loop-me` | Grills you (via `/grilling`) into specs for recurring personal "loops"; writes `workflows/*.md` and `NOTES.md`; done when an implementer could build it without a question. Added by direct commit, no PR. | Low. It treats "workflow" as canonical, the very word `software-factory` bans. |
| `claude-handoff` | Writes a handoff summary to the temp dir and starts a fresh agent with `claude --bg --name ...` ([#421](https://github.com/mattpocock/skills/pull/421), fixed by [#1185](https://github.com/mattpocock/skills/pull/1185)). Open draft [#647](https://github.com/mattpocock/skills/pull/647) would generalise it into a `spawn` skill for the "Sandcastle set" of agents. | Medium. It is the local, attended version of "a run ends and another starts". |
| `setup-ts-deep-modules` | Installs dependency-cruiser and a `lint:boundaries` script so package entry points are the only way in; scaffolds an example package and proves the rule fails on a deep import ([#505](https://github.com/mattpocock/skills/pull/505); open draft [#1225](https://github.com/mattpocock/skills/pull/1225) scans app code and detects `bun.lock`). | High. It is a concrete "automated checks" brake and the Week 1 "enforced boundaries" lesson as a tool (inference). It matches the Mechanical boundary term in [../GLOSSARY.md](../GLOSSARY.md). |
| `writing-beats`, `writing-fragments`, `writing-shape` | One article-writing pipeline. | None. |
| `software-factory` | The glossary skill, merged 2026-10-31 and byte-identical to the draft dissected earlier. See [../dissections/matt-pocock/software-factory-skill.md](../dissections/matt-pocock/software-factory-skill.md). | The Part Two language. |

Outside the skills repo, **Sandcastle** is the companion that matters most. His 2026-11-01 pitch for Sandcastle v1: "Sandcastle helps you build your software factory"; "6 built-in harnesses"; sandbox providers "(Daytona, Vercel, E2B, etc)"; "Ships with templates to work with Inngest/Trigger.dev for a durable factory"; "Support for HITL (over Slack and Discord) as well as AFK runs"; "Every skill in my repo becomes an Agent(), a function you can invoke to get that workflow: CodeReview(), ImplementSpec(), Retro(), ImproveCodebaseArchitecture()" ([post](https://x.com/mattpocockuk/status/2116805878187794740)). Draft [#1368](https://github.com/mattpocock/skills/pull/1368) publishes the skills to npm "so Sandcastle (and any software factory) can install a pinned version", excluding `in-progress`, so neither chief-of-staff nor software-factory would ship in that package. See [github-actions-orchestration.md](github-actions-orchestration.md) §5 for Sandcastle's current state.

## 7. What it means for our harness

- **Day shift and night shift now have names on his side too.** Chief-of-staff is the attended coordinator; the factory is the unattended one. That matches R10 (interactive pilot first, unattended layer later) in [../decisions-to-grill.md](../decisions-to-grill.md). A chief-of-staff session is a reasonable shape for the pilot's "coordinator session", and its wiki is a candidate home for `pilot-log/` notes (which stay uncommitted under R14).
- **Adopt the dating rule for any memory an agent writes.** ADW's `ai_docs/memory/` and the dreaming step auto-apply undated notes ([../workflows/adw/overview.md](../workflows/adw/overview.md) §3.11). "Every claim dated, code claims cite `repo@sha`, supersede instead of rewrite" is cheap and fixes the staleness problem the earlier research flagged.
- **Retro sampling is a knob worth copying.** One in five sessions, worst first, with findings that still go through review. The factory skill's automated Retro uses one merge in ten. Both are throttles in his "start slow" sense.
- **Known defects to avoid repeating:** model-driven polling while background agents work (#1263), nested subagents whose completion notices skip a layer (#1370), and a lint step that is only an instruction (#1372). Our verifier's PreToolUse guard is the pattern he lacks there: make lint a script, not a sentence.
- **Do not expect it in the course.** Plan around the factory skill, GitHub Actions and Sandcastle, not chief-of-staff.

## 8. Unknowns

- No evidence of an end-to-end run inside the repo: no tests cover skill prose, #1369 "has not been run yet", and the only reported real uses are Matt's posts and three outside bug reports.
- Whether #1369 lands before 2026-11-09, and whether wayfinder is then deprecated, is Matt's call and undecided.
- The Karpathy gist that #1304 credits was unreachable (HTTP 502), so the wiki model is described from the PR body and the skill text only.
- Matt's own wiki tooling (a custom CLI, a daily podcast from ingested sources per his 2026-07-09 post) is private; the skill is the public, harness-neutral slice of it.
