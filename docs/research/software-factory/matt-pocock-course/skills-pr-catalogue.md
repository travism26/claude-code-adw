# Catalogue: Matt Pocock's skills PRs, Oct to Nov 2026

- **Date:** 2026-11-02
- **Source:** https://github.com/mattpocock/skills, read through gh
- **Scope:** all 205 PRs listed; PRs 1168 to 1369 summarised individually; older PRs summarised by era
- **Companion docs:** [../dissections/matt-pocock/software-factory-skill.md](../dissections/matt-pocock/software-factory-skill.md), [./chief-of-staff-and-companions.md](./chief-of-staff-and-companions.md), [./github-actions-orchestration.md](./github-actions-orchestration.md), [./course-prediction.md](./course-prediction.md)

This catalogue compiles six research notes gathered on 2026-11-02. It adds no new reading of the repo.

Conventions:

- Each PR is cited as a full URL on first mention and as #N after that. Issues are written "issue #N".
- "(inference)" marks a reading that a note marks as inference, or one made while compiling.
- Dates are 2026. Times are UTC.
- Where two notes disagree, the text says so. Section 8 collects the disagreements.

## 1. Totals

### By state

| State | Count |
|---|---|
| Merged | 133 |
| Closed without merge | 50 |
| Open draft | 21 |
| Open, not draft | 1 |
| Total | 205 |

A second count through the GraphQL `totalCount` also gave 205.

### Dates

| Measure | Range |
|---|---|
| PRs created | 2026-02-21 to 2026-11-01 |
| PRs merged | 2026-04-28 to 2026-10-31 |

### By PR number range

PR and issue numbers share one sequence, so the PR numbers skip (inference).

| Range | PRs | Merged | Closed | Open draft | Open | Created |
|---|---|---|---|---|---|---|
| 1 to 400 | 48 | 9 | 39 | 0 | 0 | 2026-02-21 to 2026-06-30 |
| 401 to 700 | 58 | 51 | 5 | 2 | 0 | 2026-07-01 to 2026-07-28 |
| 701 to 1000 | 40 | 36 | 3 | 1 | 0 | 2026-08-03 to 2026-08-21 |
| 1001 to 1167 | 7 | 7 | 0 | 0 | 0 | 2026-09-03 to 2026-10-04 |
| 1168 to 1265 | 38 | 25 | 3 | 10 | 0 | 2026-10-05 to 2026-10-13 |
| 1266 to 1369 | 14 | 5 | 0 | 8 | 1 | 2026-10-19 to 2026-11-01 |

### Keyword matches

55 of the 205 PRs matched at least one keyword in title or body. The match is case-insensitive. The keywords were `software-factory`, `software factory`, `chief-of-staff`, `chief of staff`, `factory`, `GitHub Actions`, `workflow`, `orchestrat`, `loop-me`, `wiki`, `Part Two`, `course`, `cohort`, `sandcastle`, `ralph`, `subagent` and `fresh context`.

The match is a loose substring match, so many hits are incidental (inference). None of the 55 match lists names `ralph` or `cohort`.

### Release cadence

Earlier releases: 1.0.0 and 1.0.1 on 2026-06-17, 1.1.0 on 2026-07-08, 1.2.0 and 1.2.2 on 2026-08-05, 1.2.3 on 2026-08-06. There is no 1.2.1 entry. The CHANGELOG has no dates, so these are GitHub release dates.

| Release | Date | Notes |
|---|---|---|
| 1.3.0 | 2026-10-04 | Version commit `984a2c0` is dated 2026-09-29. Five minor and seven patch entries. Graduates `implement-spec`, `pr` and `retro`, and removes `resolving-merge-conflicts`. |
| 1.3.1 | 2026-10-04 | Version commit `2629ffc`. One patch: `ask-matt` points to `/retro` after a fix. |
| 1.3.2 | 2026-10-29 | Version commit `d1478fc`. 19 patch entries (20 bullets). Includes the fresh-context rule for subagents and the chief-of-staff wiki. Current package and plugin version. |
| 1.3.3 | Pending | Open version PR https://github.com/mattpocock/skills/pull/1343, three patch changesets. |

1.3.2 came 25 days after 1.3.1. Its version PR, https://github.com/mattpocock/skills/pull/1161, was created on 2026-10-04 and merged on 2026-10-29.

The open version PR #1343 was created on 2026-10-29 and regenerated on 2026-10-31. It bumps 1.3.2 to 1.3.3 in `package.json` and `.claude-plugin/plugin.json`. It adds a CHANGELOG section and deletes the three consumed changesets.

| Pending changeset | Effect |
|---|---|
| `software-factory-skill` | Adds `software-factory`, an in-progress user-invoked reference skill. It is a glossary for designing a software factory, with example tasks, slot surveys and the questions that finish a design. |
| `chief-of-staff-shared-wiki-procedures` | `chief-of-staff` looks for a shared wiki first. It runs `retro` on about one in five of its subagents' sessions and acts on the findings itself. It runs `to-spec`, `to-tickets` and `implement-spec` for large chunks of work, reading each skill by relative path so they can stay user-invoked. |
| `implementer-fresh-per-ticket` | `implement-spec` uses a fresh implementer subagent for each ticket and for the code-review fixes. |

Section 2 gives the PR behind each changeset.

## 2. The factory-relevant PRs

Newest PR number first. "Merged date" shows the creation date for PRs that are not merged. The reasons in the last column are readings for a factory, not claims by the PR authors, unless quoted.

| PR | State | Merged date | What it adds | Why it matters for a factory |
|---|---|---|---|---|
| https://github.com/mattpocock/skills/pull/1369 | Open draft | Not merged (created 2026-11-01) | A `## Destination` section for `chief-of-staff`. The destination is a dated, revisable claim on a `destination.md` wiki page, with fog of war, out of scope and a frontier. | Moves wayfinder's destination idea into the single-thread coordinator whose wiki outlives the session. The body says "Chief-of-staff may replace wayfinder". It also says "The change has not been run yet." |
| https://github.com/mattpocock/skills/pull/1368 | Open draft | Not merged (created 2026-11-01) | Publishes the skills to npm as `@mattpocock/skills`, with OIDC trusted publishing and provenance. The tarball carries `skills/` without `in-progress` and `deprecated`, plus `.claude-plugin/`. | A pinned install path for Sandcastle "and any software factory". The `in-progress` factory skills would not ship under the `files` rules (inference). |
| https://github.com/mattpocock/skills/pull/1363 | Merged | 2026-10-31 | `chief-of-staff` looks for a shared wiki first. It runs `retro` on about one in five subagent sessions and acts on the findings. For large work it follows `to-spec`, `to-tickets` and `implement-spec` by relative path. | The coordinator now turns retro findings into changes without the user picking them. The procedures resemble the factory's Retro and Decompose tasks (inference). |
| https://github.com/mattpocock/skills/pull/1355 | Open draft | Not merged (created 2026-10-30) | Two `setup-matt-pocock-skills` fixes. `glab` list commands use `--output json`. The seed templates are copied "word for word". | Tracker docs are treated as contract text. A non-Claude agent condensed them and lost the meaning of the PR-surface flag. |
| https://github.com/mattpocock/skills/pull/1354 | Open draft | Not merged (created 2026-10-30) | `research` creates its findings file in its first tool calls and updates it after each source. | Durable state on disk. In three of four real background runs, all findings were lost when the agent was interrupted. |
| https://github.com/mattpocock/skills/pull/1353 | Open draft | Not merged (created 2026-10-30) | `code-review` step 3 searches the disk, not just git's tracked files, for standards files. | The Standards reviewer started without the repo's standards file, because it was a gitignored symlink. Automated review is only as good as the standards it is handed (inference). |
| #1343 | Open | Not merged (created 2026-10-29) | The Changesets version PR for 1.3.3. It bundles the three pending changesets listed in section 1. | The release train for the factory skill, the chief-of-staff changes and the fresh implementer. Its body says packages are "published to npm automatically". That is untrue today, and only becomes true if #1368 lands (inference). |
| https://github.com/mattpocock/skills/pull/1342 | Merged | 2026-10-29 | `implement-spec` uses a fresh implementer subagent for each ticket and for the code-review fix pass. The merger subagent may still be reused. | Stops one ticket's context from leaking into the next. It is the run-per-ticket model in miniature (inference). |
| https://github.com/mattpocock/skills/pull/1341 | Merged | 2026-10-29 | Every skill that dispatches a subagent asks for a fresh context window. A rule in `CLAUDE.md` makes this a repo standard. | Some Codex models fork the parent conversation, which throws away the point of a subagent. Released in 1.3.2. |
| https://github.com/mattpocock/skills/pull/1316 | Merged | 2026-10-31 | `software-factory`, an in-progress reference skill. It holds a glossary, example tasks, four slot surveys and the questions that finish a design. | The body says it gives Software Factory Part Two students "a generic language for designing their own factory". Merged byte for byte as the draft head. |
| https://github.com/mattpocock/skills/pull/1304 | Merged | 2026-10-19 | `chief-of-staff` keeps memory in an LLM wiki: `index.md` plus one page per topic, with ingest, query and lint. Every claim is dated and every claim about code cites a commit. | State lives outside the agent. Released in 1.3.2. |
| https://github.com/mattpocock/skills/pull/1240 | Merged | 2026-10-09 | `.out-of-scope/lazy-load-writing-for-agents.md`. It records why `retro` always loads `writing-for-agents`. It records the decision from the closed PR https://github.com/mattpocock/skills/pull/1238. | Decisions are stored as files so that "triage closes repeats of it". |
| https://github.com/mattpocock/skills/pull/1236 | Open draft | Not merged (created 2026-10-09) | Three `wayfinder` fixes: never infer the tracker from the git remote, fire a research subagent for research tickets created while walking the map, and use absolute URLs for research links. | An unconfigured repo gets the local-markdown tracker, not GitHub. Research subagents fire during the walk, not only while charting. |
| https://github.com/mattpocock/skills/pull/1228 | Merged | 2026-10-27 | Seven fixes to `setup-matt-pocock-skills` and its GitHub and GitLab templates. They cover a reachable repo, native blocking edges, an open-blocker count, comment-then-close and a legacy `CONTEXT.md` migration. | The setup templates hold the exact `gh` and `glab` command shapes that `triage` and `to-tickets` follow at run time. Fixes reach users only after they re-run setup. |
| https://github.com/mattpocock/skills/pull/1226 | Open draft | Not merged (created 2026-10-08) | `to-tickets` names the sub-issue link as the one allowed change to the parent issue. | An older "do not modify the parent" line cancelled the earlier sub-issue fix. Models read attaching a sub-issue as modifying the parent. |
| https://github.com/mattpocock/skills/pull/1225 | Open draft | Not merged (created 2026-10-08) | `setup-ts-deep-modules` makes `lint:boundaries` scan app code as well as packages. A probe file proves the rules fail on a deep import. It also detects `bun.lock`. | A deterministic gate with a falsifiable completion check. An instance of the factory's first brake, automated checks (inference). |
| https://github.com/mattpocock/skills/pull/1209 | Merged | 2026-10-07 | `diagnosing-bugs` Phase 5: if a red was forced by mutating code, `diff` against a pristine copy to prove the mutation landed. | The note calls it the clearest example of "an exit code of 0 is not evidence the change happened". |
| https://github.com/mattpocock/skills/pull/1208 | Merged | 2026-10-07 | `code-review` searches the repo for standards files. It issues both sub-agent calls in the foreground. It resolves the tracker through the tracker doc. | The ordering and aggregation rule for subagents is kept. A recursion guard for the same skill was refused. |
| https://github.com/mattpocock/skills/pull/1197 | Merged | 2026-10-07 | Setup creates the triage labels that its mapping file names. It also fixes `glab` and `gh` command shapes. | Without the labels in the tracker, a hand-off such as `ready-for-human` failed with "not found". |
| https://github.com/mattpocock/skills/pull/1196 | Merged | 2026-10-07 | `implement` fetches a passed ticket reference and states its title before starting. | In a fresh Codex session `#2` was resolved against another numbered list, and the wrong work started without notice. |
| https://github.com/mattpocock/skills/pull/1190 | Merged | 2026-10-06 | `.out-of-scope/subagent-recursion.md`, linked from `SCOPE.md`. | A design stance. Skills say what a subagent does and how results return. The harness owns depth and tool reach. |
| https://github.com/mattpocock/skills/pull/1189 | Merged | 2026-10-06 | `implement` calls the Skill tool for `tdd` and `code-review`, not slash-command prose. | The trace can show a real tool call. This is the repo's composition convention. |
| https://github.com/mattpocock/skills/pull/1188 | Merged | 2026-10-06 | `to-tickets` attaches tickets as sub-issues of the source issue. It omits the `## Blocked by` prose when blockers are native edges. | GitHub-native structure is the machine-readable state of the chain. |
| https://github.com/mattpocock/skills/pull/1186 | Closed | Closed 2026-10-06 | Would have told the `code-review` sub-agents to review themselves without spawning agents. | Closed with "stopping runaway sub-agent recursion is the harness's job, not something each skill should guard against." |
| https://github.com/mattpocock/skills/pull/1185 | Merged | 2026-10-06 | `claude-handoff` passes the summary to `claude --bg` from a file, not as inline shell text. | A hand-started, fresh-context run seeded only by artifacts. A local analogue of a factory trigger (inference). |
| https://github.com/mattpocock/skills/pull/1184 | Merged | 2026-10-06 | `handoff` resolves the OS temp directory the same way on every run. | The next session can find the file. |
| https://github.com/mattpocock/skills/pull/1182 | Closed | Closed 2026-10-06 | Would have made `research` delegate exactly once. | Closed with the same recursion comment as #1186. |
| https://github.com/mattpocock/skills/pull/1181 | Merged | 2026-10-07 | `wayfinder` stops applying triage labels, writes real ids in cross-references, opens no PR from research branches, and resolves a ticket as the type its label names. | Decision tickets are kept apart from the `ready-for-agent` contract. |
| https://github.com/mattpocock/skills/pull/1179 | Merged | 2026-10-06 | `SCOPE.md`, issue forms, and four new out-of-scope records plus one rewrite. | A written bar that `/triage` and human reporters apply the same way. The foundation of the intake machine. |
| https://github.com/mattpocock/skills/pull/1170 | Merged | 2026-10-06 | Two Actions workflows. Every new issue gets `needs-triage`. `needs-info` issues close after 14 days of silence. | Deterministic automation at the edges, with no secrets. A scheduled `/triage` agent was left out on purpose. |
| https://github.com/mattpocock/skills/pull/1169 | Merged | 2026-10-27 | Blank issues closed, requests routed by kind, `CONTRIBUTING.md` added. The GitHub template tells agents to file issues only into the user's own repo. | An agent-caused incident drove it. Agents running `/to-tickets` in a clone had filed their own specs and tickets upstream (issues #541 to #550). |
| https://github.com/mattpocock/skills/pull/1120 | Merged | 2026-09-29 | The v1.3 release branch. It graduates `implement-spec`, `pr` and `retro`, removes `resolving-merge-conflicts` and renames `CONTEXT.md` to `GLOSSARY.md`. | Puts the task-graph orchestrator, the PR-body skill and the retro skill into the plugin set. Shipped as 1.3.0. |
| https://github.com/mattpocock/skills/pull/926 | Merged | 2026-08-21 | Adds the `implement-spec` skill to the `in-progress` bucket. | The task-graph orchestrator before its v1.3 graduation. |
| https://github.com/mattpocock/skills/pull/807 | Open draft | Not merged (created 2026-08-07) | Proposes flattening `skills/` and adopting Agent Plugins 1.0. The catalogue gist says someone proposed a generated flat package. The gist is cut off, so the full design is unknown. | A packaging and distribution question that has sat open since August. |
| https://github.com/mattpocock/skills/pull/781 | Merged | 2026-08-06 | Three skills stop naming Claude Code's `Agent` tool and its `general-purpose` and `Explore` agent types when they tell the agent to spawn sub-agents. | Early harness neutrality for subagent dispatch. |
| https://github.com/mattpocock/skills/pull/647 | Open draft | Not merged (created 2026-07-23) | Replaces `claude-handoff` with an agent-agnostic `spawn` skill. It names claude, codex, pi, cursor, opencode and copilot as "the Sandcastle set". Its tiers are native `claude --bg`, herdr, or a transient `systemd-run --user`. | A local analogue of launching a runner. It is one of two PRs that mention Sandcastle. The other is #1368. |
| https://github.com/mattpocock/skills/pull/538 | Merged | 2026-07-13 | `wayfinder` burns research tickets down with subagents. | Early subagent fan-out for AFK research. |
| https://github.com/mattpocock/skills/pull/536 | Merged | 2026-07-13 | Ships the skill set as a native Claude Code plugin (v1.2). | The start of the plugin packaging that #1368 now extends to npm. |
| https://github.com/mattpocock/skills/pull/505 | Merged | 2026-07-10 | Adds `setup-ts-deep-modules` (in-progress), which wires dependency-cruiser so each package is a deep module. | Installs a deterministic gate in a target repo. |
| https://github.com/mattpocock/skills/pull/421 | Merged | 2026-07-02 | Adds `claude-handoff` (in-progress). It hands the conversation to a fresh background agent through `claude --bg`. | A manual, local analogue of a factory trigger (inference). |

## 3. PR by PR, 1341 to 1369

Newest first. Between 2026-10-29 and 2026-11-01 the batch holds two small merged subagent PRs, one bot version PR, six agent-drafted fixes and one packaging draft. None of these PRs has CI checks configured. Author is `mattpocock` unless stated. Four PRs covered by other documents get one line each at the end of the section.

### #1369 chief-of-staff: work toward a revisable destination (from wayfinder)

Open draft, created 2026-11-01, stacked on #1363. Covered in [./chief-of-staff-and-companions.md](./chief-of-staff-and-companions.md).

### #1368 feat: publish skills to npm as @mattpocock/skills

- State: open draft, created 2026-11-01T10:51:25Z. Head `npm-publish`, one commit. No issue is referenced.
- Release workflow: the job is renamed "Version and publish". It gets `permissions: id-token: write`, with the comment "npm trusted publishing (OIDC): no NPM_TOKEN secret, provenance included." Node moves from 22 to 24. A new step installs npm 11.5.1 or later. The `publish:` input changes from `npx changeset tag` to `npx changeset publish`.
- Package: the name `mattpocock-skills` becomes `@mattpocock/skills`. `"private": true` goes. A `files` list ships `skills` without `in-progress` and `deprecated`, plus `.claude-plugin`. `publishConfig` sets public access and provenance. The changeset `access` moves from restricted to public.
- Changesets: the three pending ones are renamed to the new package. A new minor changeset, `publish-to-npm`, says the package ships `skills/` and `.claude-plugin/`, "so tools such as Sandcastle can install a pinned version and read `node_modules/@mattpocock/skills/skills/<category>/<skill>/SKILL.md`, or load the package root as a Claude Code plugin."
- The plugin name in `plugin.json` and `marketplace.json` stays `mattpocock-skills`. Existing plugin installs are unaffected.
- Stated reason: "Publishes the skills to npm as `@mattpocock/skills` through the existing changesets setup, so Sandcastle (and any software factory) can install a pinned version."
- Evidence in the body: `npm view mattpocock-skills` shows "1.3.0 published 2026-08-05 by `aanhnguyen`, not Matt", so an unrelated account holds the unscoped name. `npm view @mattpocock/skills` returns 404. A dry-run pack gives "96 files, 96 kB".
- Left out on purpose: a README install section, any Sandcastle change, and the `changesets/action@v2` upgrade.
- Merge Danger, quoted: "Door: two-way for this PR, one-way after the first publish." Before merging: confirm the `@mattpocock` scope belongs to Matt, and "If it isn't his, rename to `@ai-hero/skills`, the scope Sandcastle already publishes under". A trusted publisher can only be added once the package exists, so the first version is published by hand or with a short-lived token. If publishing fails, merging the version PR also makes no git tag and no GitHub release.
- Review: only the changeset-bot comment.
- Inference: `files` excludes `skills/in-progress`, so neither `software-factory` nor `chief-of-staff` would ship, even though the renamed changesets announce them. The "factory can install a pinned version" target is the stable skills, such as `implement-spec`, `code-review`, `research` and `to-tickets`. Merging also changes the package name that #1343 is built on, so #1343 would need regenerating.

### #1363 chief-of-staff: shared wiki first; retro and implement-spec as procedures

Merged 2026-10-31. Covered in [./chief-of-staff-and-companions.md](./chief-of-staff-and-companions.md).

### #1355 setup-matt-pocock-skills: --output json for glab lists, copy seed templates word for word

- State: open draft, created 2026-10-30T14:00:31Z. Closes issues #1346 and #1348. Three changed lines plus a patch changeset.
- Change: `glab issue list -O json` and `glab mr list -O json` become `--output json`. The `glab issue view ... -F json` line is left alone, because "`-F` is still `--output` on `issue view`". Setup step 4 changes from writing the docs "using the seed templates ... as a starting point" to "copying the seed templates in this skill folder word for word, changing only what the user's answers fill in".
- Why, issue #1346: on `glab mr list`, `-O` is the deprecated `--opened` flag, so the command fails on glab 1.74.0 with `ERROR  Accepts 0 arg(s), received 1.` Per the issue, the `-O json` form came from #1228, which is already in released 1.3.2. This fixes a regression shipped one release earlier.
- Why, issue #1348: "'as a starting point' let an agent condense the seed docs. The condensed `issue-tracker.md` lost what the PR-surface flag means, and agents went on to treat 'PRs are not the triage surface' as 'changes don't go through a PR'." The reporter ran a GPT-family model in a VS Code agent.
- Merge Danger: two-way. Only repos set up after the release are affected. Existing `docs/agents/*.md` files are not touched.
- Discussion: changeset-bot only. Both linked issues carry a maintainer comment from 2026-10-30T13:57 to 13:58 that starts "This was generated by AI during triage. Agent brief: ...".

### #1354 research: create the findings file first, update it after each source

- State: open draft, created 2026-10-30T14:00:23Z. Closes issue #1272, labelled `ready-for-agent`. One line in `skills/engineering/research/SKILL.md` plus a patch changeset.
- Change: step 2 becomes "Write the findings to a single Markdown file, citing each claim's source. Create it in your first tool calls and update it after each source, so an interruption doesn't lose what you've found."
- Why: "the research agent doesn't create its findings file until the end, so when it gets interrupted nothing is on disk. In three of four real background research runs, all findings were lost when the agent was stopped or disconnected." One lost run "used ~113k tokens".
- Left out: per-section headings up front, and anything about nested agents.
- Evidence caveat the PR states itself: the fix was verified only in "the reporter's hand-written briefs, not in this skill's own spawn."
- Review: the only PR from 1341 up with a review. `linogulino-byte` approved on 2026-10-30T20:18:21Z with an empty body. Their affiliation is unknown.
- Inference: this is the same durable-state-on-disk principle as the software-factory glossary for runners ("Nothing on it survives the run").

### #1353 code-review: search the disk for standards files

- State: open draft, created 2026-10-30T14:00:21Z. Closes issue #1284 (Claude Code 2.1.300, Opus 5.5 at xhigh).
- Change: one line in step 3 of `skills/engineering/code-review/SKILL.md`: "Search the disk, not just git's tracked files: a standards file may be gitignored or a symlink." Plus a patch changeset.
- Why: the Standards reviewer started without the repo's `CODING_STANDARDS.md`. The file was a gitignored symlink, and the agent looked for standards with `git ls-files`. `git ls-files`, `rg --files` and `rg --files --no-ignore` all miss it. `find` and `rg --files --no-ignore --follow` find it.
- Caveat in the body: "Not re-run in a live session." Left out: a list of exact commands, which "would be harness-specific".
- It follows #1208, which first added the "search the repo for standards files" step.

### https://github.com/mattpocock/skills/pull/1352 docs: GLOSSARY Triage role example names ready-for-agent

- State: open draft, created 2026-10-30T14:00:18Z. Closes issue #1288, confirmed by two other community comments.
- Change: one word in `GLOSSARY.md` line 19. `ready-for-afk` becomes `ready-for-agent`. No skill files and no changeset.
- Why: the old example "names a label that never existed". An agent following the glossary literally could create or apply a `ready-for-afk` label, which would split one role across two labels.
- Evidence: `grep -rn ready-for-afk` returns one hit before and none after. Door two-way.

### https://github.com/mattpocock/skills/pull/1351 codebase-design: check design-it-twice facts before comparing

- State: open draft, created 2026-10-30T14:00:17Z. Closes issue #1338 (Claude Code, Opus 5.5).
- Change: one paragraph at the top of step 3 "Present and compare" in `DESIGN-IT-TWICE.md`: "Before comparing, check each design's factual claims (library behaviour, call sites, guards) against the brief and the source. A claim that contradicts them is an error: say so, and fix or drop that design, rather than weighing it as a design difference."
- Why: in a real `/improve-codebase-architecture` session, one sub-agent built its design on a library fact that contradicted the shared facts file and the installed source. Step 3 compared designs only by depth, locality and seam placement, so the false premise got through.
- Left out: better sub-agent briefs, because the reporter's sub-agent "had read the facts file and contradicted it anyway", and any new verification sub-agent.
- The body uses a different layout from the others: Why, Change, Left out, Door. It has no Evidence or Blast Radius section.
- Inference: an orchestrator-side verification rule. A shared facts file plus a fresh-context sub-agent was not enough, so the orchestrator now audits sub-agent output against ground truth.

### https://github.com/mattpocock/skills/pull/1350 pr: link show-me credit to humanlayer/skills

- State: open draft, created 2026-10-30T14:00:15Z. Closes issue #1320.
- Change: one link in `skills/engineering/pr/CREDITS.md`. The `show-me` link moves from `https://github.com/humanlayer/humanlayer` to the `show-me` SKILL.md in `humanlayer/skills`, the URL the `pr` skill's own `metadata.credits.url` already uses. Patch changeset included.
- Why: a reporter followed the old link to record where a vendored `pr` came from for license attribution. The link went to a repo with no `show-me` skill and a different license.
- Inference: people vendor `pr` into their own repos, which is part of the case for the npm packaging in #1368.

### #1343 chore: version skills

- State: open, not draft. Author `app/github-actions`, the Changesets release action. Created 2026-10-29T10:43:07Z. The last commit is 2026-10-31T14:23:43Z, so it was regenerated after #1316 merged.
- Content: 1.3.2 becomes 1.3.3. The release notes list three patch changes: the shared wiki and procedures change in #1363, the fresh implementer in #1342, and the `software-factory` skill in #1316. #1341 is not in it. #1341 shipped in 1.3.2.
- The body is the default Changesets text: "you can merge this and the packages will be published to npm automatically." Today that is untrue, because `package.json` is `"private": true` and the workflow runs `npx changeset tag`. It only becomes true if #1368 lands (inference).
- No comments or reviews.

### #1342 implement-spec: a fresh implementer subagent per ticket

- State: merged 2026-10-29T10:42:51Z, under two minutes after opening at 10:41:14Z. No issue.
- Change in `skills/engineering/implement-spec/SKILL.md`. Step 4 goes from "Use **implementer subagents** to implement each ticket, each in its own worktree on its own branch." to "Use a fresh **implementer subagent** for each ticket, each in its own worktree on its own branch." Step 7 now says "a single fresh **implementer subagent**" for the code-review fixes.
- Why: #1341 told every subagent to start fresh, but "nothing stops an orchestrator from sending ticket B, or the code-review fixes, to the implementer that built ticket A. That implementer is still carrying ticket A's context."
- Deliberately not changed: the merger subagent, "which can be reused across merges".

### #1341 Start subagents with a fresh context window, not a fork

- State: merged 2026-10-29T10:24:05Z, five minutes after opening at 10:19:06Z. Released in 1.3.2. The version PR #1161 merged at 10:27, three minutes later.
- Change: ten files. Every dispatching site now asks for a fresh context window: `implement-spec`, `code-review`, `codebase-design/DESIGN-IT-TWICE.md`, `improve-codebase-architecture`, `research`, `wayfinder`, `grilling` and the in-progress `chief-of-staff`. The ten files are those eight sites, the repo rule and a changeset.
- Repo rule added to `CLAUDE.md`: "Every skill that dispatches a subagent says to start it with a fresh context window. Some harnesses (Codex, for one) fork the parent conversation by default, and a fork inherits the parent's context, which is what the subagent was meant to escape."
- Why: "Some Codex models fork the parent conversation when they spawn a subagent. The fork inherits the parent's context window, which throws away the reason for using a subagent: a clean context that sees only its brief."
- Left out on purpose: `ask-matt` and `writing-for-agents` (they describe subagents but do not dispatch), `claude-handoff` ("already starts a fresh agent"), and harness-specific instructions such as how to turn off forking in Codex.
- Merge Danger: Door two-way. On harnesses that already start subagents fresh, nothing changes. On harnesses that fork, agents now ask for a clean subagent, "which costs the subagent any context the brief doesn't carry."

### Covered in other documents

- #1316 software-factory: glossary skill for designing a factory. Merged 2026-10-31, after 10 days open. See [../dissections/matt-pocock/software-factory-skill.md](../dissections/matt-pocock/software-factory-skill.md).
- #1304 chief-of-staff: keep memory in a dated, commit-cited wiki. Merged 2026-10-19. See [./chief-of-staff-and-companions.md](./chief-of-staff-and-companions.md).

## 4. PR by PR, 1168 to 1265

The range holds 38 PRs, all by `mattpocock`, created 2026-10-05 to 2026-10-13. 25 are merged, 3 were closed unmerged, and 10 are open drafts. Dates in the table below are 2026, shown as MM-DD.

Merges came in bursts. Eight PRs merged between 12:15 and 12:55 UTC on 2026-10-06, with two more closed in the same minutes. Ten merged between 10:02 and 10:22 UTC on 2026-10-07. Then came a gap. #1228 and #1169 merged together on 2026-10-27, after 19 and 22 days open.

Most PR bodies share one template: a Summary with a diff, Evidence with before and after, "Left out on purpose", then "Merge Danger" with "Door" and "Blast Radius", and "Closes #N". About two thirds close or cite an issue. "Door" and "Blast Radius" read as a risk label for the reviewer (inference).

### Docs-only, trivial and narrow fixes

| PR | State | Created | Merged | What it does |
|---|---|---|---|---|
| https://github.com/mattpocock/skills/pull/1265 | Open draft | 10-13 | | `wizard`: a two-line fix so apostrophes survive on bash 3.2 when Enter keeps the current value. Reviewers tested on bash 3.2.57. 8 of 20 round trips passed on main and 20 of 20 on the PR. Closes issue #1260. |
| https://github.com/mattpocock/skills/pull/1258 | Open draft | 10-12 | | `improve-codebase-architecture`: write Mermaid edge labels in pipe form. An inline label ends at its first period, which broke Mermaid v11 rendering. |
| https://github.com/mattpocock/skills/pull/1237 | Merged | 10-09 | 10-09 | `wizard`: five small `template.sh` fixes for issues #1220, #1142, #1081, #1041 and #1003. |
| https://github.com/mattpocock/skills/pull/1227 | Open draft | 10-08 | | Docs: the `--skill <name>` space form, because the skills CLI ignores the `=` form and installs every skill. Also a section reorder and a stale sentence. |
| https://github.com/mattpocock/skills/pull/1224 | Open draft | 10-08 | | `grilling`: number questions across the whole conversation, never per round. When `/wayfinder` ran grilling twice, round two restarted at Q1. |
| https://github.com/mattpocock/skills/pull/1222 | Open draft | 10-08 | | `triage`: nest the OUT-OF-SCOPE.md example in a 4-backtick fence. Cosmetic. |
| https://github.com/mattpocock/skills/pull/1218 | Merged | 10-07 | 10-08 | README leads with self-updating installs ("Managed installs first"). Claude Code uses the official marketplace. Codex and Copilot use the repo's `@mattpocock` marketplace. Gemini and others get skills.sh copies with manual updates. |
| https://github.com/mattpocock/skills/pull/1198 | Merged | 10-06 | 10-07 | `wizard`: five `template.sh` fixes for Readline arrow keys, `.env` quoting, symlinked `.env`, EOF handling and the opener warning. |
| https://github.com/mattpocock/skills/pull/1195 | Merged | 10-06 | 10-07 | README: one line telling users to run `claude plugins marketplace update` when the plugin is not found. |
| https://github.com/mattpocock/skills/pull/1194 | Merged | 10-06 | 10-07 | `ask-matt`: "Before stating what a skill does or recommending a step be skipped, read that skill's SKILL.md: the summaries here are for orientation only." The router had told a user to skip `/to-spec` from its own one-line summaries. |
| https://github.com/mattpocock/skills/pull/1193 | Merged | 10-06 | 10-07 | `grilling`: word each question so "yes" accepts the recommendation. A comment on 2026-10-23 reports a side effect: the agent no longer offers several recommended options. |
| https://github.com/mattpocock/skills/pull/1192 | Merged | 10-06 | 10-07 | `tdd`: a one-line note on what each proposed seam catches and misses. A contributor's further proposal became https://github.com/mattpocock/skills/pull/1221. |
| https://github.com/mattpocock/skills/pull/1187 | Merged | 10-06 | 10-06 | Setup: list external PRs through the REST pulls endpoint, because `gh pr list --json ...authorAssociation` fails. |
| https://github.com/mattpocock/skills/pull/1183 | Merged | 10-06 | 10-07 | `teach`: workspace paths resolve from the directory `/teach` was run in. Vary which position holds the correct quiz answer. Course authors must run `/teach` from the directory they want the course in. |
| https://github.com/mattpocock/skills/pull/1168 | Merged | 10-05 | 10-05 | Docs: unslop every page. Four subagents took seven pages each (28 pages, 544 additions, 517 deletions). It flagged two bugs for a human. One was fixed later in #1228 and one was queued in #1227. |

### #1240 out-of-scope: retro always loads writing-for-agents

- Merged 2026-10-09. Adds `.out-of-scope/lazy-load-writing-for-agents.md`.
- It records the decision from the closed draft #1238. That agent-drafted attempt moved the `writing-for-agents` load in `retro` to "Before you write anything for agents to read". Matt closed it about an hour later: "Closing: retro needs writing-for-agents on every run, not just before writing."
- The record's reason: the skill "defines what a no-op instruction is and what makes a good skill, and `retro` uses those definitions to judge the steering files it reads". Its stated purpose is "so triage closes repeats of it".
- A context-saving change was refused because the guide is needed for judging, not just writing.

### #1236 wayfinder: no tracker inference, research on walk, absolute research links

- Open draft, created 2026-10-09. Closes issues #599, #941 and #896. Four lines in `SKILL.md` plus a patch changeset.
- Fix 1: "No tracker doc? Tell the user to run `/setup-matt-pocock-skills` and use the local-markdown tracker; never infer the tracker from the git remote." A chart run had inferred GitHub.
- Fix 2: walking the map never fired research subagents for `research` tickets created or graduated during the walk. Work step 5 now ends "Fire a research subagent for each `research` ticket just created or graduated, as in charting step 5."
- Fix 3: the research context pointer must be "an absolute URL", since issue comments do not resolve relative links.
- Evidence is the reported failure only. The body says "Not tested by running the skill. These are wording changes."
- It changes behaviour for unconfigured repos: they get local markdown, not GitHub. It complements #1181.

### #1228 setup-matt-pocock-skills: reachable repo, legacy CONTEXT.md, tracker template fixes

- Merged 2026-10-27, 19 days after creation on 2026-10-08. Closes issues #1201, #1176, #1143, #1138, #1118, #873 and #855. About 15 lines.
- Setup now looks for legacy `CONTEXT.md` and `CONTEXT-MAP.md` and offers to `git mv` them to their `GLOSSARY` names. A GitHub or GitLab tracker needs a reachable repo, so setup wires up `git remote add origin <url>` and checks with `gh repo view` or `glab repo view`.
- GitHub template: post the explanation with `gh issue comment`, then `gh issue close`, because on an already-closed issue `gh issue close --comment` drops the comment and still exits 0. Read a PR with `gh pr view <n>` and then `--comments`. Blocking moves into Conventions with native `--blocked-by` flags (`gh` 2.94+). A "Count open blockers" bullet uses `gh api ... --jq .issue_dependencies_summary.blocked_by`.
- GitLab template: `glab mr list -O json`, child tickets linked with `--link-type relates_to`, and a frontier query through `glab api`.
- Comments before merge (2026-10-22 and 2026-10-27) noted that the GitHub frontier query is still `gh issue list --state open`, with no way to scope to a map and a 30-issue default limit, plus literal `<owner>/<repo>` placeholders. These were not folded in before merge.
- Inference: the ADW repo's own `CLAUDE.md` still says "a root CONTEXT.md", so a re-run of setup there would hit the new `GLOSSARY.md` migration offer.

### #1226 to-tickets: name the sub-issue link as the one allowed parent change

- Open draft, created 2026-10-08. Closes issue #1204. A follow-up regression fix to #1188.
- `Do NOT close or modify any parent issue.` sat a few lines under the new sub-issue instruction. Models read attaching a sub-issue as modifying the parent and dropped it. One reporter got ten children with `Parent: #154` prose only.
- New line: "Leave the parent issue's body, labels and state as they are; attaching each ticket as its sub-issue is the one change the parent gets."
- Lesson: a new instruction can be silently overridden by an older guardrail two lines away.

### #1225 setup-ts-deep-modules: scan app code in lint:boundaries, detect bun.lock

- Open draft, created 2026-10-08. Closes issues #1148 and #1088. One file in the in-progress skill plus a patch changeset.
- `lint:boundaries` was `depcruise <packages-root>`, which never sees an app file deep-importing a package. The reproduction on dependency-cruiser 18.5.0 printed `no dependency violations found` with exit 0. The step now scans `depcruise src`, or every source root that imports the packages.
- Phase 6 gains a probe file such as `src/boundary-probe.ts`. It must fail with `entrypoint-boundary-from-app`, then be deleted, and the check must pass again. Completion is "a pass, a fail on each deep import, and a pass after each revert."
- Package-manager detection treats `bun.lock` as bun, as well as `bun.lockb`.
- The pattern is proof by mutation. The old proof only mutated a test import, so it passed while the real hole stayed open.

### https://github.com/mattpocock/skills/pull/1223 teach: lessons load the script components they use

- Open draft, created 2026-10-08. Closes issue #1058.
- `/teach` quizzes rendered but never responded. The Assets section modelled only the stylesheet `<link>`, so lessons never loaded `assets/quiz.js`. In the reporter's three workspaces, 17 of 17 lessons had a `.quiz` block and no `<script src="../assets/quiz.js">`.
- One line is added: "Every lesson that uses a component includes its tag: `<link>` for a stylesheet, `<script src>` for a script (a quiz widget's JS, say)." The docs page gets a matching "It's working if" bullet.
- It is the second `teach` fix in two days after #1183. The 17-of-17 figure implies the reporter had built multi-lesson courses with the skill (inference).
- Still a draft on 2026-11-02, so quizzes may not respond unless the agent adds the script tag by hand (inference).

### #1221 tdd: a bug fix's red reproduces the bug

- Open draft, created 2026-10-08. Closes issue #1210.
- An agent's red test failed only because it could not compile against a method that did not exist yet (`error: no method named drain_settled`). The bug's behaviour was never asserted, so no regression guard was written.
- One bullet is added to "Rules of the loop": "**A bug's red reproduces the bug.** When fixing a bug, the test runs against the existing code and fails on the wrong behaviour, not on a missing symbol." Feature work is unchanged, because "a missing symbol is a legitimate first red" there.
- It takes only the smallest slice of a contributor's wider seam-note proposal from #1192. It is the same idea as #1209: do not trust a red unless it fails for the right reason.

### #1209 diagnosing-bugs: prove a forced mutation landed before trusting the red

- Merged 2026-10-07. Closes issue #955. One sentence added to Phase 5 step 2, plus a patch changeset.
- New text: "If you forced the red by mutating code or a fixture, `diff` against a pristine copy to prove the mutation landed before you trust it."
- Evidence from a real run in issue #955: an agent forced a red with BSD `sed -i '' '0,/alpha/s//ZZZ/'`. That exits 0 and changes nothing on macOS, yet the agent reported the test as "mutation-checked". The body prefers `diff` over `grep` because "`grep` confirms the text is present, not that the file changed."
- It merged within hours of opening, in the same 10:22 UTC merge window as #1208 and #1196. That suggests a maintainer review pass over a batch of agent PRs (inference).

### #1208 code-review: search for standards files, foreground sub-agents, tracker doc

- Merged 2026-10-07. Closes issues #937, #1065 and #1073. Three `ready-for-agent` fixes, "one per brief".
- Step 3 now reads "Search the repo for every file that documents how code should be written. When `CODING_STANDARDS.md` or `CONTRIBUTING.md` exists, it must be on the list."
- Step 4 gains "Issue both sub-agent calls together, in the foreground, and aggregate the reports they return." A Sonnet run had backgrounded the sub-agents and aggregated before their reports arrived.
- The hard-coded `docs/agents/issue-tracker.md` path is replaced by "The issue tracker should have been provided to you. If not, tell the user to run `/setup-matt-pocock-skills`."
- The skill still describes both axes as "parallel sub-agents so they don't pollute each other's context". The foreground rule shipped. The recursion guard proposed for the same skill, #1186, was closed. Matt's own PRs draw the line between an ordering rule (kept) and a recursion guard (rejected).

### #1197 setup-matt-pocock-skills: create triage labels, fix glab/gh tracker commands

- Merged 2026-10-07. Closes issues #616, #635, #733 and #801. Seven added lines plus a changeset.
- Issue #616: after setup, skills called `gh issue edit 25 --add-label ready-for-human` and got `'ready-for-human' not found`. The mapping file was written but the labels never existed. Setup now creates each configured label the tracker lacks.
- Issue #635: the GitLab template used `glab issue list -F json`, which `glab` rejects. It becomes `-O json`, validated by the reporter on glab 1.103.0.
- Issue #733: `gh issue view <n> --comments` fails with `--jq` and drops body and labels without a TTY. It becomes `gh issue view <number> --json number,title,body,labels,comments`.
- Issue #801: `triage-labels.md` told users to edit the "right-hand column", but that column is "Meaning". It now names "Label in our tracker".
- The `setup` docs page still described label creation as a known bug when #1168 unslopped it. #1197 did not update that page, so it may be stale (inference).
- Together with #1188, #1228 and #1187, this makes the setup templates the single source of truth for `gh` and `glab` command shapes.

### #1196 implement: fetch a passed ticket reference and state its title

- Merged 2026-10-07. Closes issue #700. In a fresh Codex session, `/implement #2` resolved `#2` against another numbered list and started the wrong work without saying so.
- New rule: "If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask."

### #1190 docs(scope): subagent recursion is the harness's job, not skills'

- Merged 2026-10-06. Docs only, two files: `.out-of-scope/subagent-recursion.md`, linked from `SCOPE.md`. It refers to issues #530 and #573 and to PR #1186.
- The policy: "Skills do not add guards against sub-agents recursively invoking skills or spawning nested agents ... Requests to add leaf-agent instructions, depth limits or "do not invoke this skill" lines are out of scope."
- The reasoning opens "The harness should be responsible for stopping infinite subagent loops, not skills". The harness "decides which tools and skills a sub-agent can reach and how deep nesting can go, so a limit set there holds for every skill at once". A guard in one skill "covers only that skill, costs tokens on every run, and still depends on the model choosing to obey it."
- The closing instruction: "If a sub-agent recurses or fans out without bound, report it to the harness."
- Before this PR, issue #573 had been closed with the reasoning recorded nowhere. The body does not close issue #530, which "stays with triage".
- For the course this is a design stance (inference from the note). Skills say what a subagent does and how results return. The harness decides who may spawn what.

### #1189 implement: call the Skill tool for tdd and code-review

- Merged 2026-10-06. No issue. A leftover from https://github.com/mattpocock/skills/pull/878, which had standardised cross-skill invocation on "call the Skill tool".
- "Use /tdd where possible" becomes "Call the Skill tool with "tdd" where possible, at pre-agreed seams." The same change applies to `code-review`.
- Evidence is a grep: `grep -rn "use /" skills/engineering skills/productivity` matched only `implement/SKILL.md` before and nothing after.
- It pins down the orchestration convention. User-invoked skills (`implement`, `ask-matt`, `handoff`) compose model-invoked skills through the Skill tool, so the trace can show an actual tool call.

### #1188 to-tickets: attach tickets to their parent issue as sub-issues

- Merged 2026-10-06. Closes issue #554. Four files, +11 and -5.
- Tickets landed as top-level issues, not sub-issues of the spec issue. The report was "across a dozen runs and several models". The GitHub template now says: "Make an issue a sub-issue of a parent: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards (`gh` 2.94+)."
- Blockers were recorded twice. The template always ended with `## Blocked by`, so agents wrote that prose even after wiring native edges. The template now says to omit the section when blockers were native edges.
- Evidence: the flags were checked against the `gh` v2.94.0 release notes. The body admits "I didn't run a live ticket publish".
- It is the main evidence that the factory chain of `grilling`, `to-spec`, `to-tickets` and `implement` relies on native GitHub structure as machine-readable state, not prose. The fix was later found to be partly undone by an older line, hence #1226.

### #1186 and #1182 code-review leaf reviewers, research delegate once (both closed)

- Both were agent-drafted fixes, closed on 2026-10-06 with the same comment: "Closing: stopping runaway sub-agent recursion is the harness's job, not something each skill should guard against."
- #1186 would have prefixed both `code-review` sub-agent briefs with "Do this review yourself, without invoking `code-review` or spawning agents." The reporter saw a recursive fan-out of 50 or more agents.
- #1182 would have told `research` to spin up one background agent and brief it that it is the researcher. A spawned agent had read the instruction as addressed to itself and nested a duplicate, about 250k tokens in one report.
- #1190 superseded both. The `research` docs page still calls issue #530 an open bug (inference).

### #1185 claude-handoff: pass the summary to claude --bg without shell interpolation

- Merged 2026-10-06. Closes issue #562, point 1 only. In-progress skill, so no changeset or docs page.
- The old form put the summary in a double-quoted shell argument. Backticks, `$(...)` and `$VAR` ran or expanded, so the background agent got a silently truncated prompt.
- The new form saves the summary to the OS temp directory and launches `claude --bg --name "<descriptive name>" -- "$(cat <summary file>)"`. The `--` stops a summary that starts with `-` being read as an option.
- Left out: merging `claude-handoff` into `handoff`, and passing `--model`. The body notes that draft #647 would replace this skill with `spawn`.
- It is the only skill in the range that launches a fresh background agent from a summary. The lesson is that the hand-off payload travels as a file, not as inline shell text.

### #1184 handoff: resolve the temp dir the same way every run and report the path

- Merged 2026-10-06. Closes issue #272. Agents needed three or four attempts on Windows to find the temp directory, and on macOS wrote to three places across three runs.
- The clause becomes "Save to the temporary directory of the user's OS (`$TMPDIR`, else `/tmp`; `%TEMP%` on Windows) - not the current workspace."
- The title overstates the change. The diff does not add path reporting. The body lists "having the skill report the written path back" under Left out, as a separate ask.
- The docs page also says temp is not durable, and that Codex clears it between sessions.

### #1181 wayfinder: no triage labels, no placeholder refs, no research PRs

- Merged 2026-10-07. Refs issues #518, #507, #576 and #625. Four fixes, each "one sentence, placed at the step where the mistake happens", in one `SKILL.md`.
- Triage labels: "`wayfinder:` labels are the only labels a map and its tickets carry, never a triage label like `ready-for-agent`: they are decisions, not implementation work."
- Placeholder refs: drafted tickets T1 to T8 were written as `#1` to `#8`, and GitHub auto-linked them to unrelated old issues. Cross-references now use real ids.
- Research PRs: the research subagent pushed a branch and opened a draft PR. Step 5 now ends "Push the branch but open no PR: it is never merged."
- Ticket type: Codex fetched a ticket body only and solved a human-in-the-loop grilling ticket alone. The skill now says to read the label, not just the body.
- Evidence method, stated outright: "No test harness for skill prose; evidence is the reported failure each line guards against." The research subagent rule survives #1190. A parent still spawns children and guards their output, but does not guard recursion.

### #1179 Add SCOPE.md, issue forms, and out-of-scope records

- Merged 2026-10-06. Refs issues #1164 and #1176. 13 files, about 260 lines of prose and YAML, no changeset because no skill changed.
- The bar: an idea or feedback issue "stays open only if it clears **both** parts". Part one is an observed failure in a real session. Part two is fit with the philosophy: no `.out-of-scope/` match, and not "a config option, a harness-specific branch, or a tweak to suit one person's workflow". Reactions and +1 comments do not count.
- Buckets: `engineering/`, `productivity/` and `in-progress/` face the bar. `misc/` is "frozen and unmaintained. Every issue is closed". New skills are closed. Unclear issues get one round of questions and `needs-info`, then close after 14 days. "Rejections close as "not planned"."
- Four out-of-scope records are added: `native-question-tool.md`, `harness-name-collisions.md`, `new-skills.md` and `frozen-misc-skills.md`. `mainstream-issue-trackers-only.md` is rewritten to name exactly three trackers: GitHub via `gh`, GitLab via `glab`, and local markdown under `.scratch/`. It rejects Jira even though Jira has an official CLI.
- New forms: `bug.yml` and `idea.yml`, plus `config.yml` with `blank_issues_enabled: false`. A `docs/agents/triage-labels.md` maps the five canonical labels one to one. The skills repo's `CLAUDE.md` gains an `## Agent skills` block so `/triage` finds it.
- A side fix: the README claim that plugin updates "arrive automatically" was false. The official listing pins a commit `sha` that Anthropic moves by hand.
- Left out: undecided skill-design questions, which "go to the weekly digest".
- It is the foundation PR for the intake machine: a written bar that an agent and humans apply identically, with rejected concepts stored as files.

### #1170 Label new issues and close silent needs-info issues

- Merged 2026-10-06. "Lever 4 of the issue survey". Two Actions workflows, no secrets and no new labels.
- `triage-label.yml` runs on `issues: opened` and adds `needs-triage`. Its comment: "Every new issue gets `needs-triage`, so nothing skips the queue."
- `needs-info.yml` runs daily at `30 1 * * *` through `actions/stale@v10`. It never marks anything stale itself and closes after 14 days as not planned. If anyone comments after `needs-info` was added, the issue goes back to `needs-triage`.
- Maintainer habit from the Merge Danger: add `needs-info` after you post your question. A comment posted after the label counts as a reply.
- Evidence: both files pass `actionlint` 1.7.7. The first run would have closed 2 open `needs-info` issues.
- Left out: duplicate suggestions, out-of-scope keyword replies, auto-labelling of AI-drafted issues, and a scheduled `/triage` agent. The reason is not given. A scheduled agent triager was considered and deferred in favour of deterministic Actions (inference).
- The close comment links `CONTRIBUTING.md`, which did not exist on main until #1169 merged 21 days later (inference from the merge dates).

### #1169 Close blank issues and route requests by kind

- Merged 2026-10-27, created 2026-10-05, so 22 days open. It was rebased onto the commit that carried #1179's forms.
- Intake changes: `config.yml` routes Q&A, new-skill ideas and other-harness or tracker requests to Discussions. `bug.yml` adds a required version-or-commit field and required "one problem" and "searched for a duplicate" checkboxes. `CONTRIBUTING.md` has a "Where each request goes" table and an "Issues written with AI" section: "Agents are welcome to help, but you post the issue, so you own it". It also says "Pull requests are open to collaborators only".
- Template fix: agents running `/to-tickets` in a clone of the skills repo had filed their own specs and tickets upstream (issues #541 to #550). New paragraph: "File issues only into the user's own repo. Never file into `mattpocock/skills` (the repo these skills come from) unless the user owns it." Before the first `gh issue create`, check the target with `gh repo view --json nameWithOwner`.
- A reviewer reproduced that `gh` picks an `upstream` remote as base repo, and suggested `gh issue create -R <owner>/<repo>` as a stronger guard. Left out: the same fix for GitLab.

## 5. Earlier eras, by number range

Titles are the only evidence for these ranges. Counts come from the catalogue table.

| Range | PRs | Created | Headline |
|---|---|---|---|
| 1 to 400 | 48 | 2026-02-21 to 2026-06-30 | Outside contributions, then the first self-merges |
| 401 to 700 | 58 | 2026-07-01 to 2026-07-28 | Wayfinder wave, docs template, plugin |
| 701 to 1000 | 40 | 2026-08-03 to 2026-08-21 | Docs rewrite wave, v1.2, style housekeeping |
| 1001 to 1167 | 7 | 2026-09-03 to 2026-10-04 | v1.3 graduations |

### 1 to 400

The first 39 PRs in the catalogue were all closed without merging, starting with https://github.com/mattpocock/skills/pull/1, "Add frontmatter to skills missing YAML metadata". Most came from outside contributors, on frontmatter for `npx skills add`, Claude Code marketplace support (https://github.com/mattpocock/skills/pull/8) and native sub-issues for `to-issues` (https://github.com/mattpocock/skills/pull/61). The first merge is https://github.com/mattpocock/skills/pull/90 on 2026-04-28, "Add setup-matt-pocock-skills; rename github-triage; migrate skills to vague prose". From June the PRs are Matt's own: https://github.com/mattpocock/skills/pull/291 split skills into model-invoked and user-invoked (2026-06-17), and https://github.com/mattpocock/skills/pull/398 generalised `decision-mapping` beyond engineering (2026-06-30), the seed of wayfinder.

### 401 to 700

This is the wayfinder wave. Seventeen merged PRs carry "wayfinder" in the title between 2026-07-01 and 2026-07-13, from https://github.com/mattpocock/skills/pull/412 (the rename from `decision-mapping`) to #538. The v1.1 release, https://github.com/mattpocock/skills/pull/464 (merged 2026-07-08), unified the planning skills in a breaking change and graduated wayfinder. Around it came a docs-page template and pages (https://github.com/mattpocock/skills/pull/402 and https://github.com/mattpocock/skills/pull/403), `review` becoming `code-review` (https://github.com/mattpocock/skills/pull/405), the `research` skill (https://github.com/mattpocock/skills/pull/409) and the native Claude Code plugin (#536). Late July brought the rename to `writing-for-agents` (https://github.com/mattpocock/skills/pull/650), the v1.2 release branch (https://github.com/mattpocock/skills/pull/593, merged 2026-08-05) and an open draft for a self-maintaining plugin directory form (https://github.com/mattpocock/skills/pull/565).

### 701 to 1000

This is the docs rewrite wave. On 2026-08-05, 22 PRs merged, 11 of them titled "docs:", running from "tell one true install story" (https://github.com/mattpocock/skills/pull/749) to "rewrite every skills page to the four-section standard" (https://github.com/mattpocock/skills/pull/761). The same day saw six unused skills and the personal bucket removed (https://github.com/mattpocock/skills/pull/752) and `wait-what` added (https://github.com/mattpocock/skills/pull/751). Mid August brought invocation and style housekeeping: #878 (call the Skill tool), https://github.com/mattpocock/skills/pull/905 (remove all em-dashes) and https://github.com/mattpocock/skills/pull/911 (quote invalid YAML front matter). The range also holds the closed CONTEXT-to-GLOSSARY rename (https://github.com/mattpocock/skills/pull/876), which landed later in v1.3 (inference), the Agent Plugins draft #807 and the `implement-spec` addition #926.

### 1001 to 1167

Only seven PRs fall in these 167 numbers, so most numbers here are issues (inference). They are `link-skills` no longer linking `misc/` (https://github.com/mattpocock/skills/pull/1025), `retro` pushing mechanical findings toward deterministic checks (https://github.com/mattpocock/skills/pull/1083), the `pr` skill (https://github.com/mattpocock/skills/pull/1092), an `ask-matt` fix (https://github.com/mattpocock/skills/pull/1121) and two bot version PRs (https://github.com/mattpocock/skills/pull/1160 and #1161). The centrepiece is the v1.3 release #1120, merged 2026-09-29, which graduated `implement-spec`, `pr` and `retro`. It shipped as 1.3.0 on 2026-10-04. The intake and triage work starts around #1168 and is in section 4.

## 6. Patterns

The two "patterns across this batch" lists in the source notes are merged here.

1. **The repo runs a small factory on itself.** Intake is engineered. #1179 wrote a bar in `SCOPE.md`, issue forms and out-of-scope records. #1170 added two Actions workflows. Six draft PRs, #1350 to #1355, were opened within 16 seconds of each other (2026-10-30T14:00:15Z to 14:00:31Z). That was roughly two minutes after the maintainer account posted "This was generated by AI during triage. Agent brief: ..." comments on their issues (13:57:06Z to 13:58:52Z). Every issue carried `ready-for-agent`. Every PR body follows the `pr` skill template and says "Generated with Claude Code". All are still drafts, with one approval in total. Read this with care. The issues research found that the triage labels come from Matt's own account running the `triage` skill locally. Actions only add `needs-triage` and close stale `needs-info`. So "unattended" is an inference. It rests on the burst timing, and it does not cover the label step. The `triage` docs say the skill "recommends and then waits".
2. **Subagents get fresh context windows and one job each.** #1341 made "start with a fresh context window" a repo-wide rule, because some Codex models fork the parent. #1342 applied the same logic to lifetime: a fresh implementer per ticket and per fix pass, with only the merger reusable. They merged 18 minutes apart (10:24 and 10:42 UTC on 2026-10-29). #1208 keeps an ordering rule for the code-review pair: both calls in the foreground, reports aggregated. The model is a fresh worker, a brief, and pointers to durable artefacts such as the spec, tickets, commits and wiki pages.
3. **State lives outside the agent.** #1354 writes the findings file early, because three of four real research runs lost everything on interruption. #1304 keeps chief-of-staff's memory in a dated wiki with commit-cited claims. #1185 sends the hand-off payload as a file, not inline shell text. #1316 says the same of runners: a run's only memory of earlier runs is the ticket tracker, the git host and the orchestrator. Agent context is treated as disposable. The filesystem, the tracker and git are the memory.
4. **Tracker integration moves to GitHub-native structure.** #1188 attaches tickets as sub-issues with `gh issue create --parent`. #1228 adds native blocking edges and an open-blocker count. The skill text stays tracker-neutral, and the commands live in seed templates, so fixes reach users only after they re-run setup. The templates are contract text: #1355 turns "as a starting point" into "word for word". Instruction conflicts bite. #1226 shows an older "Do NOT close or modify any parent issue." line cancelling the sub-issue fix.
5. **Orchestration and recursion requests are closed as out of scope.** #1190 records "The harness should be responsible for stopping infinite subagent loops, not skills". #1186 and #1182 were closed the same day on that basis. Issue #1263 asked `chief-of-staff` for callback and watchdog plumbing. Matt closed it as not planned: "`chief-of-staff` is harness-neutral text, so it won't specify callback plumbing for one setup. Your adapted copy, or a line in your AGENTS.md, is the right home for it." #1179 narrowed trackers to GitHub, GitLab and local markdown. The `implement-spec` docs page sends truly AFK work to "a deterministic loop (Sandcastle, a shell script, a CI job)", "because no agent makes the orchestration decisions". Two older requests were closed the same way in the 2026-10-06 triage sweep: [issue #329](https://github.com/mattpocock/skills/issues/329) (poll `needs-triage` and `ready-for-agent`, one session per issue) with "An orchestrator that polls queues and launches sessions would be a new skill or tool", and [issue #885](https://github.com/mattpocock/skills/issues/885) (a `docs/agents/orchestration.md` for external runners) with "An orchestration config file is a set of options for running under external runners, which the skills deliberately don't carry". The run machinery lives in the course and Sandcastle, not the skills (inference).
6. **Packaging moves from plugin installs to a pinned npm package.** #536 shipped the native Claude Code plugin. #1218 led the README with self-updating installs. #1368 renames the package to `@mattpocock/skills` so "Sandcastle (and any software factory) can install a pinned version". The open version PR #1343 already bundles the factory-related changesets, and #1368 would rename them, so the two are being sequenced together. A plugin install is a floating, read-only dependency, which is hostile to reproducible runner images. The npm package is the pinned answer (inference).
7. **Harness neutrality.** Use outside Claude Code is visible. Codex forks subagents (#1341). A GPT-family model in a VS Code agent condensed the seed templates (issue #1348, fixed by #1355). Issues #1284 and #1338 came from Claude Code with Opus 5.5. The fixes stay neutral on purpose. #1353 declines to list exact commands because they "would be harness-specific". #1341 declines Codex-specific settings. #781 removed Claude Code tool names from dispatch text.
8. **Verify the signal before trusting it.** A red or a pass only counts if it fails for the right reason. #1209 diffs a forced mutation against a pristine copy. #1221 asks a bug-fix red to fail on wrong behaviour, not on a missing symbol. #1225 adds a probe file to prove the boundary lint can fail. #1351 has the orchestrator check sub-agent factual claims against the brief and source before comparing designs. #1221, #1225 and #1351 are still drafts.

## 7. Open drafts to watch before 2026-11-09

The course starts on 2026-11-09. None of these is merged as of 2026-11-02. Whether any ships before that date is unknown.

- #1369: chief-of-staff `Destination` section, created 2026-11-01. It is stacked on the branch that #1363 already merged, so it needs retargeting (inference). It has never been run.
- #1368: npm publishing as `@mattpocock/skills`, created 2026-11-01. One-way door after the first publish. Scope ownership and a trusted-publisher setup come first.
- #1355: `glab --output json` and verbatim seed templates, created 2026-10-30. Fixes a regression that shipped in 1.3.2.
- #1354: research findings file written early, created 2026-10-30. The only PR from 1341 up with a review (one approval).
- #1353: code-review searches the disk for standards files, created 2026-10-30. Not re-run in a live session.
- #1352: GLOSSARY example label `ready-for-agent`, created 2026-10-30. One word, no changeset.
- #1351: codebase-design checks design-it-twice facts, created 2026-10-30. Closes issue #1338.
- #1350: `pr` CREDITS link for `show-me`, created 2026-10-30. Closes issue #1320.
- #1265: wizard apostrophes on bash 3.2, created 2026-10-13. Third-party testers report 20 of 20 round trips.
- #1258: Mermaid pipe-form edge labels, created 2026-10-12.
- #1236: wayfinder tracker and research fixes, created 2026-10-09. Not tested by running the skill.
- #1227: docs `--skill <name>` space form, created 2026-10-08.
- #1226: to-tickets sub-issue link, created 2026-10-08. Completes the sub-issue fix from #1188.
- #1225: setup-ts-deep-modules boundary scan and `bun.lock`, created 2026-10-08.
- #1224: grilling question numbering, created 2026-10-08.
- #1223: teach script tags, created 2026-10-08. Until it ships, quizzes may not respond (inference).
- #1222: triage OUT-OF-SCOPE.md fence, created 2026-10-08. Cosmetic.
- #1221: tdd bug-fix red, created 2026-10-08.
- #807: Agent Plugins 1.0 flatten, created 2026-08-07. The oldest packaging question.
- #647: the `spawn` skill, created 2026-07-23. One of two PRs that mention Sandcastle.

Also open: #1343 (not a draft, the 1.3.3 version PR) and #565 (a draft from 2026-07-14). The list above covers drafts numbered 1221 and above, plus #807 and #647. The catalogue count of 21 open drafts only reconciles when #565 is included: 18 drafts from 1221 up, plus #807, #647 and #565.

## 8. Gaps

- **No PR-body edit history.** The REST API does not expose it. For #1316 the notes could read only the body as it stood at merge.
- **Drafts may change.** All draft summaries are as of 2026-11-02. A draft body or diff can change before it merges. The 14 PRs numbered 1300 and above had no CI checks configured.
- **Older PRs are summarised from titles.** Section 5 rests on titles and a gist column that is cut short. #807 is known only from its title and a truncated gist. #647 adds one note's quotes from its body.
- **Direct commits are invisible here.** Some in-progress skills arrived without a PR. `loop-me` was moved in by a direct commit on 2026-06-24. The first five `chief-of-staff` commits (2026-10-05 and 2026-10-06) went straight to main, with no PR and no changeset. A PR catalogue misses them.
- **Reviews are almost absent.** From 1341 up there is one approval, on #1354. #1316 has one inline review comment, never addressed: an unquoted colon in the `description:` front matter that breaks `npx skills install`. Issue #1373 reports it. The chief-of-staff PRs #1304, #1363 and #1369 have no human review.
- **Course link is thin.** Only #1316 mentions the course ("Software Factory Part Two"). No chief-of-staff PR mentions it. The PRs in the 1168 to 1265 range never mention it. Any link to the 2026-11-09 start is timing only (inference).
- **Who ran the burst is unknown.** The notes infer that the #1350 to #1355 burst came from an agent run, but no note shows what ran it.
- **Not read.** The Karpathy gist behind #1304 could not be fetched, so statements about it come from the PR body. The four `software-factory` survey files were not re-read for content. Issues and Discussions are covered only where a PR cites them.
- **Docs pages lag the code.** The `triage` docs page still calls label creation an open bug that #1197 fixed. The `research` page still calls issue #530 an open bug.

### Where the source notes disagree or differ

| Topic | One note says | Another note says | Reading |
|---|---|---|---|
| PR numbers in the CHANGELOG | The repo-docs note reads CHANGELOG 1.2.0 as crediting https://github.com/mattpocock/skills/pull/763 with the `writing-for-agents` rename and the `prototype` reshape, and #593 with the `to-questionnaire` graduation. | The catalogue titles #650 as the rename and https://github.com/mattpocock/skills/pull/679 as the graduation. It titles #763 "chore: condense changesets and drop docs-only entries" and #593 "Release v1.2". | The CHANGELOG may credit the condensing or release PR, not the original (inference). |
| "Generated with Claude Code" | The 1300-and-above note lists the line among the marks of the agent-drafted batch #1350 to #1355, and contrasts that batch with PRs that look hand-driven. | The chief-of-staff note says the same line ends the bodies of #1304, #1363 and #1369, and that #1363 commits carry a "Co-Authored-By: Claude Opus 5.5" trailer. | The line does not separate the burst from other PRs. The hand-driven versus agent-drafted split is an inference. |
| Course name | The #1316 body, as quoted in the software-factory note, says "Software Factory Part Two". | The 1168 to 1265 note calls it "Software Factories for Real Engineers" and gives a 2026-11-09 start. | Probably one course under two names (inference). |
| glab flags and versions | #1197 changed `glab issue list -F json` to `-O json`, validated by the reporter on glab 1.103.0. | #1355 says `-O` is the deprecated `--opened` flag on `glab mr list` and fails on glab 1.74.0. It credits the `-O json` form to #1228. | Different subcommands and versions. The notes do not reconcile them. |
| Time #1169 sat open | The 1168 to 1265 note says it sat open "longer than any other merged PR in the batch except #1228". | The same note gives 22 days for #1169 and 19 days for #1228. | Internal slip. By its own dates #1169 was open longest. |
| Time #1316 sat open | The 1300-and-above note says 10 days (2026-10-21 to 2026-10-31). | The software-factory note says 9 days after the last commit on 2026-10-22. | Same facts, different start point. |
| 1.3.0 and 1.3.1 version PRs | The repo-docs note gives a version commit dated 2026-09-29 for 1.3.0 and a release date of 2026-10-04. | The catalogue shows two "chore: version skills" PRs merged on 2026-10-04, https://github.com/mattpocock/skills/pull/849 and #1160. | No note says which PR shipped which release. #1161 is named for 1.3.2 only. |
| Token cost of the research recursion bug | The 1168 to 1265 note says the #1182 body reports about 250k tokens in one report. | The repo-docs note says the `research` docs page cites about 450k tokens in one report. | Probably different reports (inference). |
