# The factory on GitHub Actions

This is the unattended layer from the
[ADW adoption game plan](../research/software-factory/matt-pocock-course/adw-adoption-game-plan.md),
built in Matt Pocock's vocabulary: Tasks, Triggers, Runs and brakes. Phases 0 (plumbing) and 1
(brakes) are built. Verify in the loop (phase 2) and Implement on a label (phase 4) come later.

The repo owner has to do two things before any of it runs: create the GitHub App and store three
values. [github-app-setup.md](github-app-setup.md) walks through both. Until that is done, every
Review run fails with a message saying what is missing. It never goes green without doing anything.

## What is built

| Piece | File | What it does |
|---|---|---|
| Label set | `adws/actions/labels.json`, `adws/actions/sync_labels.py` | The repo's label vocabulary in one file, and a script that creates or corrects the labels. Dry run by default. It never deletes a label. |
| Preflight | `.github/actions/factory-preflight/action.yml` | The first steps of every factory workflow. It checks the App and API key are configured, enforces the daily run cap, and mints the App token. |
| Review | `.github/workflows/review.yml`, `adws/actions/review_pr.py` | The Review task: a two-axis review of every ready PR from an `adw/*` branch. |
| Rework trigger | `.github/workflows/rework.yml` | Starts when Review adds `rework`, and records the hand-off. No agent works on it yet; this proves the App's label events start workflows. |
| Local triggers | `adws/adw_triggers/` | The cron poller and the webhook server. Both now start a Ticket run (`travis_sdlc.py <N> --worktree --risk-gate`) for an issue labelled `ready-for-agent`. Before this they called scripts that do not exist. |

## The Review task, against the five questions

| Question | Answer |
|---|---|
| 1. Trigger | `pull_request`: `ready_for_review`, `synchronize`, `reopened`. The job runs only when the PR is not a draft, its branch is `adw/*` in this repo (not a fork), its author is an `OWNER`, `MEMBER` or `COLLABORATOR`, and it is not labelled `ready-for-human`. |
| 2. Does | `prepare` (App token, no agent) writes the diff, the Ticket the PR body closes (`Closes #N`) and the Ticket's parent Spec to files. `review` (API key, no GitHub token) runs one agent in a fresh context with Read, Grep and Glob only. It has no shell, no write tools and no web access, and `--max-budget-usd` caps its spend. `apply` (App token, no agent) posts the Spec and Standards reports as one PR comment and moves the labels. |
| 3. Triggers next | On a Spec blocker, it adds `rework`. That starts `rework.yml`. |
| 4. Human re-enters | At the merge, always. After three rework rounds, the next blocker labels the PR `ready-for-human`, and Review skips the PR from then on. |
| 5. Dedupe | Concurrency group `review-<pr>` with `cancel-in-progress: false`: one review runs and at most one waits. Events the job skips get a throwaway group, so they cannot push out a waiting review. |

### Why drafts are skipped

The game plan says to review on `opened` and `synchronize`. The code says otherwise. A Ticket run
(`travis_sdlc.py`) opens its draft PR first, pushes one commit per phase, and marks the PR ready
when it succeeds. Reviewing on every push would review half-built work. It would also use up all
three rework rounds before the run finished. So Review starts when the PR becomes ready, and runs
again on each later push.

### The rework counter

Only a Spec blocker counts: a requirement that is missing, or implemented wrongly. Scope creep and
Standards findings are reported but never block. The same rule keeps a Ticket run's PR in draft.

| PR labels before | Review result | Labels after |
|---|---|---|
| none | blocker | `rework`, `rework:1` |
| `rework`, `rework:1` | blocker | `rework`, `rework:2` (`rework` is removed and re-added so the label event fires again) |
| `rework`, `rework:3` | blocker | `rework:3`, `ready-for-human`. The factory stops. |
| `rework`, `rework:N` | pass | `rework:N` (the count stays as history) |
| `ready-for-human` | anything | unchanged |

If the PR gets a new push while a review is running, that review posts its report but changes no
labels. The review of the new head decides them.

### Trust boundaries

- The harness that runs the review is checked out from the PR's base commit. A PR cannot change
  the code that judges it. The PR's own code is checked out under `pr/`, where the reviewer reads
  it but never runs it.
- The agent's step has the Anthropic key and nothing else. The steps that hold the App token run
  no agent.
- No step ends in `|| true`. A step that cannot do its job fails the run, so a red run means the
  brake did not engage.

## Knobs

All are repository variables (Settings, then Secrets and variables, then Actions, then Variables).
Defaults apply when a variable is unset.

| Variable | Default | Meaning |
|---|---|---|
| `FACTORY_DAILY_RUN_CAP` | `20` | Runs per workflow per UTC day. Runs that skipped all their work do not count. `0` stops every run, which makes it a kill switch. |
| `FACTORY_REVIEW_BUDGET_USD` | `2` | `--max-budget-usd` for the review agent. A run that hits the cap fails. Claude Code checks the cap between turns, so a run can finish the turn it is in and go a few cents over. |
| `FACTORY_REVIEW_MODEL` | `sonnet` | `sonnet`, `opus` or `haiku`. |

The workflow pins the Claude Code version in `CLAUDE_CODE_VERSION` at the top of `review.yml`.

## Labels

The set is the vocabulary in [../agents/triage-labels.md](../agents/triage-labels.md). It holds the
triage roles, `in-progress`, the plan types (`bug`, `chore`, `feature`), the wayfinding labels, and
`rework` with `rework:1` to `rework:3`. To change a label, edit `adws/actions/labels.json`, then:

```bash
uv run adws/actions/sync_labels.py            # dry run: prints what would change
uv run adws/actions/sync_labels.py --apply    # does it
```

## The workflow skeleton

Each later Task workflow (Verify, Ratchet, Implement) should follow the same shape. Use
`review.yml` as the template.

1. `permissions: {}` at the top, and only what the job needs below it.
2. A concurrency group per Ticket or PR with `cancel-in-progress: false`, plus a throwaway group for
   skipped events.
3. A job `if:` that admits only collaborators and only the events this Task owns.
4. Check out the harness from a trusted ref first, then run `./.github/actions/factory-preflight`.
5. Give the App token to the steps that talk to GitHub. Give the API key only to the agent step,
   with `--max-budget-usd`.
6. Upload the run's files as an artifact with `if: always()`.

## Not built yet

- **Verify** (phase 2): the guarded verifier as the step after Review.
- **Rework by an agent**: `rework.yml` only records the hand-off.
- **Implement on `ready-for-agent`** (phase 4). When it comes, its PRs will be opened by the App, and
  the `author_association` guard will need to admit the App's bot account.
- **Ratchet, Explore, Fix, Retro** (phases 3 and 4).
