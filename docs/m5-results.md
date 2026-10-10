# M5 results — the factory, live-verified

**Date:** 2026-07-19 · **Branch:** `feat/m5-factory` · **Plan:** `docs/slim-pipelines-plan.md` §9, §11 (M5 row) · **Catalog:** `docs/sdlc-agent-map.md` #1 (Router)

**Exit criterion (plan §11):** issue → routed → sandboxed → draft PR end-to-end on a
test repo; failure path reports the state file. **MET** — evidence below.

## What shipped

| Piece | File | Notes |
|---|---|---|
| Router agent | `adws/pipelines/router.py` | Catalog #1 rebuilt from scratch: ticket JSON → `RouteVerdict{route, confidence, reason}`, fail-closed, one bounded retry, closed enum (hotfix deferred to M6 per plan §9.2). In-process prompt (spec_reviewer pattern) — no slash-command template, so no install dependency. |
| Router fixture eval | `evals/agents/router/` | 15 labeled cases (5/5/5) incl. 4 keyword-defeating; per-category accuracy gate (`--min-accuracy` is a per-route floor, not an aggregate). |
| Factory orchestrator | `adws/pipelines/factory.py` | Intake (`--issue N` \| raw prompt) → route (before any worktree exists; `--route` = human override) → `feature_worktree` sandbox → slim pipeline subprocess (`--working-dir`) → two-signal collect → `draft_pr` on success / failure report on failure. Human merges. |
| Fail-closed agent fix | `adws/adw_modules/agent.py` | Zero-turn CLI results (e.g. `Unknown command: /build`) were counted as SUCCESS — found live by the smoke below, fixed same day (`4c9b7aa`). |
| Tests | `test_router.py` (8), `test_router_eval.py` (22), `test_factory.py` (14), `test_agent_zero_turn.py` (5) | All appended to the root `adw_gates.json` unit command; ship gate green. |

## Router eval (real LLM runs, 15 cases × 1 trial)

| Model | chore | bug | feature | Overall | Cost |
|---|---|---|---|---|---|
| sonnet | 5/5 | 5/5 | 5/5 | 15/15 (100%) | $0.9108 |
| haiku | 5/5 | 5/5 | 5/5 | 15/15 (100%) | $0.2558 |

Haiku routes at parity for **28% of sonnet's cost**. Caveat before acting on that:
the corpus is 15 synthetic cases and both models saturate it — per the repo's eval
discipline this is now a regression smoke, not a discriminating eval. Harvest real
tickets (via `/capture_eval_task`) before switching the factory's default router
model; a `--router-model` knob is the natural follow-up.

## Live smokes (factory end-to-end)

1. **Local success path** (scratch repo from `target_cli`, raw prompt, no remote):
   router chose `chore` at 0.97 → worktree → `pipe_chore` → unit gate 1 iter →
   CHANGELOG.md verified **on the branch** → draft-PR degraded to local branch →
   worktree removed, branch kept. Exit 0. Cost $0.19.
2. **Negative control** (target missing the `/build` template, `--route chore`):
   build phase fails, factory exits 1, report names BOTH failed signals, the first
   failed phase, the state file, the child log, and the **kept** worktree. Cost $0.00.
3. **GitHub issue intake** (a throwaway smoke-test repo):
   issue #1 ("bump version to 0.1.1") → fetched via target-remote → routed `chore`
   (0.97) → worktree from `origin/main` → pipeline → pushed → **draft PR #2**, body
   `Closes #1`, marked ready on success; diff contains exactly the version bump
   (plus artifact noise, see gaps). PR and issue closed after verification, branch
   deleted; the repo itself is left for manual deletion (the token used did not have
   repo-deletion scope).
   Cost $0.17.

## Defect found and fixed by smoke #2 (the reason smokes exist)

The FIRST run of smoke #1 reported PASS with an **empty diff**: the Claude CLI
returns an unknown slash command as a *normal* result (`subtype "success"`,
`is_error false`, `num_turns 0`), `execute_template` called the build successful,
and the unit gate passed on the pristine repo. Same class as the sdlc-agent-map §4
silent-success defects. Fixed fail-closed in `agent.py` (`num_turns == 0` → phase
failure; `Unknown command:` prefix as fallback), regression-tested in
`test_agent_zero_turn.py`, and re-proven live: the identical run now fails loudly
(smoke #2).

## Known gaps carried forward

- **`draft_pr._commit_all` sweeps untracked artifacts** (`git add -A`): `.ports.env`
  (written by the harness's own worktree setup), `__pycache__`, `uv.lock` landed in
  the smoke PR because the scratch target has no `.gitignore`. Real targets mostly
  gitignore these, and `.ports.env` is harness-inflicted either way. Candidate fix
  at the draft_pr/worktree seam — out of M5 scope, flagged.
- **Router cost undercount on retries:** a retried router call overwrites
  `router.jsonl`, so the eval's cost column misses the first call. Rare path, small
  error; noted in review.
- **`PIPELINES.md`** (plan §5 user-facing doc) still unwritten — no milestone owns it.
- **The harness repo can't be a factory target** — it has no `.claude/commands/`.
  Deliberate for now (installing the template set into the harness would also change
  interactive sessions); revisit if self-hosting is ever wanted.
- Hotfix route (+approve gate), `--issues` fanout, trigger integration: M6 as planned.
