# Matt Pocock's course and factory: the 2026-11-02 follow-up

**Date:** 2026-11-02, one week before "Software Factories for Real Engineers" unlocks (2026-11-09).
**Question:** What has Matt Pocock shipped in `mattpocock/skills` since the October research, what are the `chief-of-staff` and `software-factory` skills and their companions, how does his GitHub Actions orchestration work, what will the course most likely teach, and how would we adopt it on top of ADW?
**Method:** A Fable orchestrator fanned the source gathering out to Sonnet readers (PR diffs, skill files, repo docs, issues, workflows across his repos, public pages and posts) and a Haiku cataloguer (all 205 PRs), then wrote the synthesis. GitHub was read with `gh`; no paid course content was accessed. Every claim carries a URL or PR number, and inference is marked. The raw source notes live outside the repo in the firstmate data directory for this task.
**Builds on:** the October research in [../README.md](../README.md), especially [../dissections/matt-pocock/software-factory-skill.md](../dissections/matt-pocock/software-factory-skill.md), [../workflows/matt-pocock/overview.md](../workflows/matt-pocock/overview.md) and [../workflows/matt-pocock/course-software-factories.md](../workflows/matt-pocock/course-software-factories.md). Those docs were updated in place where this work changed them (the skill merged unchanged on 2026-10-31; the course page now names eight workshops).

## Reading order

| File | Read it for |
|---|---|
| [course-prediction.md](course-prediction.md) | **Start here.** The eight workshops, a lesson-level prediction per workshop with evidence and confidence, the five-step Explore / Approve / Implement / Review / Merge skeleton, what is probably not in the course, and how to check the prediction after 2026-11-09 |
| [github-actions-orchestration.md](github-actions-orchestration.md) | What he actually runs on Actions: the label state machine (`agent:explore`, `agent:implement`, `agent:review`), concurrency and the throwaway-group trick, PAT identity against his own advice, the missing retry cap, the course example repo's workflows, and the plan to move off Actions (Linear, Inngest, Daytona, Langfuse) |
| [adw-adoption-game-plan.md](adw-adoption-game-plan.md) | The plan: every slot filled, every task answered against his five questions, a workflow skeleton, a six-phase order of adoption keyed to ADW's known gaps, the decisions it forces, and what to reconcile during the course |
| [chief-of-staff-and-companions.md](chief-of-staff-and-companions.md) | The `chief-of-staff` skill (one long attended session, fresh-context subagents, a dated and commit-cited wiki, retro and implement-spec as procedures, a revisable destination), its companions (`loop-me`, `claude-handoff`, `setup-ts-deep-modules`), Sandcastle v1, and why it is the stateful opposite of the factory skill |
| [skills-pr-catalogue.md](skills-pr-catalogue.md) | All 205 PRs: totals, the factory-relevant ones, PR-by-PR notes for 1168 to 1369, earlier eras, the patterns (the repo runs a small factory on itself), and the open drafts to watch |

## The findings in one page

1. **Both skills the captain asked about exist.** `software-factory` ([#1316](https://github.com/mattpocock/skills/pull/1316)) merged on 2026-10-31, byte-identical to the draft dissected in October, so that dissection stands. `chief-of-staff` is in `skills/in-progress/` with three merged PRs and one open draft, and it is not tied to the course anywhere public.
2. **The course's spine is the skill's "Start slow" section.** The cohort page was edited on 2026-10-29 to say "starting with accelerators is backwards" and "we'll spend a lot of our time learning and building your Software Factory's brakes". The course starter repo says the same: brakes first, then a factory on GitHub Actions.
3. **Part One is a label-driven factory on GitHub Actions**, and it already exists in public: his Sandcastle and course-video-manager repos, and the course example repo, all run `agent:explore` to `agent:implement` to `agent:review` chains with draft-only PRs, human merge, per-issue concurrency groups and a PAT identity. Implement and review runs went dormant on Actions in October, and his course fork has an open issue to move onto Linear, Inngest, Daytona and Langfuse.
4. **Part Two is the `software-factory` skill**, used alongside `/grill-me`: the Task / Trigger / Run / Runner vocabulary, the four slot surveys as "infra recommendations", and five tasks sketched on the student's own infra with five questions each. His 2026-10-25 post says so in all but name.
5. **His factory still has no Verify brake.** The three brakes are checks, cold review and human review. Our `verify` with the guarded verifier is the piece to slot between Review and Merge.
6. **The repo runs a small factory on itself**, mostly attended: Actions apply `needs-triage` and close stale `needs-info`; every other label and agent brief comes from Matt's own account running `/triage` in sweeps (313 comments on 2026-10-06 alone); drafts PRs are opened by an agent "on behalf of" Matt from those briefs, in bursts, and he merges.
7. **For ADW the shortest path is unchanged but now has his names on it:** fix the triggers, use a GitHub App, add Review and Verify as Actions on PRs, then turn on one accelerator (a daily Ratchet), then Implement on `ready-for-agent` with the `in-progress` claim, a rework cap he lacks, and a budget cap.

## What changed in the older docs

- [../dissections/matt-pocock/software-factory-skill.md](../dissections/matt-pocock/software-factory-skill.md): status updated from draft to merged unchanged; the packaging bug is now [issue #1373](https://github.com/mattpocock/skills/issues/1373).
- [../workflows/matt-pocock/course-software-factories.md](../workflows/matt-pocock/course-software-factories.md): an update note pointing here; the 2026-10-26 snapshot is kept as the baseline.
- [../README.md](../README.md): a row for this folder, and the dissection row no longer says "draft".
