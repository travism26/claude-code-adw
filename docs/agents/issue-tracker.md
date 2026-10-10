# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Claiming a Ticket: `in-progress`

A Ticket being worked on carries the `in-progress` label ("Claimed: a run or session is working on
it"), so two runs, or a run and a human session, never pick up the same Ready Ticket.

- **Interactive sessions**: when you start implementing a Ticket by hand (for example
  `/implement <issue>`), your **first write to the tracker** is
  `gh issue edit <n> --add-label in-progress` (create the label first if the repo lacks it:
  `gh label create in-progress --description "Claimed: a run or session is working on it" --color fbca04`).
  Do not start on a Ticket that already carries `in-progress`: someone else has it.
- **Ticket runs** (`travis_sdlc`) add `in-progress` themselves once the Ticket passes the resolver's
  checks, before any worktree, state, agent call or PR exists, and create the label if it is
  missing. They refuse a fresh run on a Ticket already labelled `in-progress`; a `--resume` of the
  run that claimed it proceeds.
- `in-progress` is the only label a run or session adds when claiming. `ready-for-agent` stays, and
  no other label is added or removed.
- **Nothing clears it automatically.** A merged PR closes the Ticket (`Closes #N`). After a failed or
  abandoned run the label stays until a human removes it (`gh issue edit <n> --remove-label
  in-progress`), deliberately: a half-done Ticket needs a look before it runs again.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used when exploring the codebase and mapping out a larger piece of work (wayfinding). The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body; Ticket runs also read a `## Blocked by` section listing them, and refuse a Ticket with an open blocker from either source. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line), an `in-progress` label or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-label in-progress --add-assignee @me`, the session's first write (see [Claiming a Ticket](#claiming-a-ticket-in-progress)).
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
