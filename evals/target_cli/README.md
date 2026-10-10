# target_cli — tiny key/value CLI (ADW eval target)

A second small, hermetic eval target (alongside `target_app`) used by the
**multi-repo** eval (`evals/run_multirepo_eval.py`). Deliberately distinct from
the notes app so a cross-cutting ticket exercises *independent per-repo plans*.

```bash
uv run python -m app.kv set name ada
uv run python -m app.kv get name
uv run python -m app.kv list
uv run python -m app.kv delete name
uv run pytest -q
```

Pairs persist to `kv.json` (override with `--db`). Like `target_app`, this target
carries its own `.claude/commands` so its pipeline runs with its own project
context during a multi-repo run.
