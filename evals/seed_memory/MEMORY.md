# Project Memory

Lessons and conventions learned by the ADW harness across runs on
this codebase. Edit entries by hand under `entries/`, or regenerate
via `uv run adws/travis/travis_dream.py --working-dir <this repo>`.

## Conventions
- build-tooling — Project uses uv for running tests and uvx for linting with ruff
- file-layout — App logic lives in app/, tests in tests/, specs in specs/, research in ai_docs/research/
- regression-test-pattern — Bug fixes must include a regression test reproducing the exact failure sequence

## Pitfalls
- id-generation-pattern — Note IDs must use max-based assignment, not length-based, to survive deletions
