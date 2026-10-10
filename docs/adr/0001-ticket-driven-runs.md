---
status: accepted
---

# Ticket-driven runs: review against the Ticket and its Spec, never the Plan

A run can now start from a Ready Ticket (a `ready-for-agent` GitHub issue) instead of a file under
`specs/`. Only the unattended half of the work is automated. Grilling, writing the Spec and cutting
Tickets stay human-in-the-loop.

For ticket runs, the review phase judges the diff against the Ticket's acceptance criteria first.
It reads the parent Spec only to catch scope creep and contradicted decisions. It never reviews
against the Plan. The Plan is written by the same agent that builds, so reviewing against it grades
the work against the agent's own homework. The review wraps the two-axis `/code-review` (Standards
and Spec). Its findings map onto the existing `blocker | tech_debt | skippable` verdict, so
draft-PR gating and `travis_patch` keep working. Only missing or wrongly implemented requirements
count as blockers.

The document phase is skipped for ticket runs and is marked for removal. It writes `app_docs/` and
`conditional_docs.md`, which form an unversioned third store of spec-like prose that later agents
trust without knowing whether it is stale. Knowledge now lives in the PR, the archived Spec, ADRs
and `CONTEXT.md`.

## Considered Options

- **A separate ticket pipeline.** Rejected because intake and review are the only phases that
  change, and a second orchestrator would duplicate the rest. The intake lives in a shared Ticket
  resolver that `travis_sdlc` and `factory.py` can both call.
- **Skipping the plan phase when a Ticket arrives, as legacy `specs/` input does.** Rejected
  because a Ticket deliberately says what to build, not how.

## Consequences

- The pipeline's `spec_file` state field is renamed to `plan_file`. The Ticket and Spec get their
  own references (`ticket_ref`, `spec_ref`), so the review phase cannot read the wrong document.
- A Spec may live in a parent issue (the default going forward) or in a repo file named by a
  `Spec:` line (the legacy form). The resolver accepts both.
- Legacy `specs/*.md` runs keep the old `/review` and the document phase until nothing uses them.
- A Ticket run writes exactly one label: it adds `in-progress` once the Ticket is accepted, before
  anything else exists, and a fresh run refuses a Ticket that already carries it. No run removes a
  label; a merged PR closes the Ticket and a human clears the claim after a failed run.
