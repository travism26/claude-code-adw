---
name: build-tooling
description: Project uses uv for running tests and uvx for linting with ruff
type: convention
source_adw_ids: [68f6b646]
date: 2026-06-04
---

Test runner: `uv run pytest -q`. Linter: `uvx ruff check app tests`. Both must pass before a fix is considered complete. No failures and no ruff warnings are the bar.
