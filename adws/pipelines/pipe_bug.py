#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""pipe_bug — slim bug pipeline (see the mermaid diagram in docs/slim-pipelines-plan.md §7.3). Thin
wrapper around pipe_feature.run_pipeline() with plan_type forced to "bug",
plus one extra startup guard: a bug run with no fast test/unit gate must not
silently "pass" untested — at least one FAST gate whose name contains "test"
or "unit" is required before any agent runs.

CLI: uv run adws/pipelines/pipe_bug.py "<prompt>" [--working-dir DIR] [--model M] [--max-iters N] [--gates FILE] [--adw-id ID]
"""

import sys
from pathlib import Path
from typing import List

_ADWS_DIR = Path(__file__).resolve().parent.parent  # pipe_chore.py's sys.path convention
sys.path.insert(0, str(_ADWS_DIR))

from pipelines.gates import Gate, GateConfigError, resolve_gates  # noqa: E402
from pipelines.pipe_feature import FLAGS as _FEATURE_FLAGS  # noqa: E402
from pipelines.pipe_feature import VALID_MODELS, parse_args, run_pipeline  # noqa: E402
from adw_modules.utils import make_adw_id, resolve_working_dir  # noqa: E402

# Same flags as pipe_feature.py minus --plan-type (bug always forces "bug").
FLAGS = tuple(f for f in _FEATURE_FLAGS if f != "--plan-type")

USAGE = (
    'Usage: uv run adws/pipelines/pipe_bug.py "<prompt>" '
    "[--working-dir DIR] [--model M] [--max-iters N] [--gates FILE] [--adw-id ID]"
)


def _has_fast_test_gate(gates: List[Gate]) -> bool:
    """plan §7.3: a bug run must have at least one FAST gate whose name
    contains "test" or "unit" — never let an untested fix report success."""
    return any(
        not g.slow and ("test" in g.name.lower() or "unit" in g.name.lower())
        for g in gates
    )


def main() -> None:
    try:
        prompt, opts = parse_args(sys.argv[1:], flags=FLAGS)
        max_iters = int(opts.get("--max-iters", "3"))
        model = opts.get("--model", "sonnet")
        if model not in VALID_MODELS:
            raise ValueError(f"--model must be one of {VALID_MODELS}, got {model!r}")
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        print(USAGE, file=sys.stderr)
        sys.exit(1)

    working_dir = resolve_working_dir(opts.get("--working-dir"))
    adw_id = opts.get("--adw-id") or make_adw_id()
    try:
        gates = resolve_gates(working_dir, config_file=opts.get("--gates"))
    except GateConfigError as e:
        print(f"GateConfigError: {e}", file=sys.stderr)
        sys.exit(1)

    if not _has_fast_test_gate(gates):
        print(
            "Error: bug pipeline requires a fast test gate (a FAST gate whose "
            "name contains 'test' or 'unit') — refusing to report an untested "
            "fix as passing.",
            file=sys.stderr,
        )
        sys.exit(1)

    ok = run_pipeline(prompt, working_dir, adw_id, model, max_iters, gates, plan_type="bug")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
