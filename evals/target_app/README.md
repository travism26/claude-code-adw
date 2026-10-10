# notes-app

A tiny JSON-file-backed notes CLI. This is the **ADW eval target app** — the
fixed codebase that benchmark tasks (see `evals/tasks/`) run against. Keep it
small and boring on purpose: eval results are only comparable if this app stays
stable.

## Commands

```bash
uv run python -m app.notes add "Title" --body "Body text"
uv run python -m app.notes list
uv run python -m app.notes get <id>
uv run python -m app.notes delete <id>
```

Notes are stored in `notes.json` in the current directory (override with `--db PATH`).

## Tests

```bash
uv run pytest -q
```

## Structure

```
app/notes.py        # Note dataclass, NotesStore (JSON file), argparse CLI
tests/test_notes.py # pytest suite
```
