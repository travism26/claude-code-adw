# Router eval

Isolated fixture eval for `pipelines.router.route_ticket` (docs/sdlc-agent-map.md §2 catalog
rule: ships with a fixture eval or it doesn't ship). 15 hand-labeled tickets, 5 per route
(`chore`/`bug`/`feature`), scored **per category** — the catalog's whole point is that an
aggregate can hide a weak category inside a good average ("aggregate hides a 60% category
inside a 94% average").

## Run

```
uv run evals/agents/router/run_router_eval.py
uv run evals/agents/router/run_router_eval.py --model sonnet --trials 3
uv run evals/agents/router/run_router_eval.py --cases path/to/other_cases.jsonl --min-accuracy 0.9
```

Flags (all optional):

- `--model` — `sonnet` | `opus` | `haiku` (default `sonnet`)
- `--trials` — repeats per case, results pooled into the same per-category accuracy (default `1`)
- `--cases` — path to a cases.jsonl file (default: the sibling `cases.jsonl` in this directory)
- `--min-accuracy` — the per-category pass floor (default `0.8`)
- `--working-dir` — where the router agent's Claude Code subprocess runs (default: the harness
  repo root)

This invokes the real router agent — an actual Claude Code call per case × trial. It costs real
money and takes real wall-clock time; there is no mocked mode in this script. For a
credential-free run of the scoring/aggregation/exit-code logic (no LLM, no network), see
`adws/adw_tests/test_router_eval.py`.

## What the threshold means

`--min-accuracy` is a **per-category** floor, not an aggregate one: the run exits 0 only if
*every* route's accuracy is >= the threshold. One weak category fails the whole run even if the
overall average clears the bar — that's the point of this eval existing at all. `--min-accuracy 0`
is report-only mode: every accuracy is trivially >= 0, so the run always exits 0 and just prints
the table.

A category with zero cases in the run (only possible with a custom `--cases` file that drops a
route entirely) is excluded from the gate — there's nothing to measure, so it can't fail it.

## Known gaps

- The corpus is synthetic: 15 hand-written cases, not mined from real tickets. Harvesting real
  cases via `/capture_eval_task` is a planned post-M5 supply line, not done here.
- Single-model report only. Comparing e.g. sonnet vs. haiku accuracy and cost is a downstream
  decision — run this script twice with different `--model` values and diff the two reports.
