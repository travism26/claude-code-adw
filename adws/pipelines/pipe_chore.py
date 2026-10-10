#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""pipe_chore — Image 1 slim pipeline (docs/slim-pipelines-plan.md §7.1).

A prompt goes straight to a build agent; deterministic gates check the
result; a /fix_gate agent handles failures; slow gates run once at the end.
No plan file, no review agent, no worktree, no memory — the fastest path
for a small, well-scoped change. See pipelines.core.build_loop for the
two-stage (fast-loop, then slow-once) loop this CLI wraps.

CLI:
    uv run adws/pipelines/pipe_chore.py "<prompt>" [--working-dir DIR]
      [--model M] [--max-iters N] [--gates FILE] [--adw-id ID]
"""

import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# adws/pipelines/pipe_chore.py -> need "adws" on sys.path (same convention
# as gates.py, anchored from this file's own location).
_ADWS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ADWS_DIR))

from pipelines.core import build_loop  # noqa: E402
from pipelines.gates import GateConfigError, resolve_gates  # noqa: E402
from pipelines.pipeline_state import PipelineState  # noqa: E402
from adw_modules.agent import AgentTemplateRequest  # noqa: E402
from adw_modules.utils import make_adw_id, resolve_working_dir  # noqa: E402

FLAGS = ("--working-dir", "--model", "--max-iters", "--gates", "--adw-id")
VALID_MODELS = ("sonnet", "opus", "haiku")

USAGE = (
    'Usage: uv run adws/pipelines/pipe_chore.py "<prompt>" '
    "[--working-dir DIR] [--model M] [--max-iters N] [--gates FILE] [--adw-id ID]"
)


def _parse_args(argv: List[str]) -> Tuple[str, Dict[str, str]]:
    """Manual argv parsing (mirrors gates.py's convention): exactly one
    positional prompt plus the 5 named flags. Raises ValueError on an
    unknown flag, a flag missing its value, or a missing/extra positional
    — the caller turns that into usage + exit 1."""
    positional: List[str] = []
    opts: Dict[str, str] = {}
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg.startswith("--"):
            if arg not in FLAGS:
                raise ValueError(f"unknown flag: {arg}")
            if i + 1 >= len(argv):
                raise ValueError(f"{arg} requires a value")
            opts[arg] = argv[i + 1]
            i += 2
        else:
            positional.append(arg)
            i += 1
    if len(positional) != 1:
        raise ValueError('exactly one "<prompt>" argument is required')
    return positional[0], opts


def _print_diff_stat(working_dir: str) -> None:
    """Best-effort `git diff --stat`; silently skipped if working_dir isn't
    a git repo (or git isn't on PATH) — never fatal to the pipeline."""
    try:
        proc = subprocess.run(
            ["git", "-C", working_dir, "diff", "--stat"],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        return
    if proc.returncode == 0 and proc.stdout.strip():
        print(proc.stdout.rstrip())


def main() -> None:
    try:
        prompt, opts = _parse_args(sys.argv[1:])
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

    if not gates:
        print(
            f"WARNING: 0 gates configured for {working_dir} — build-only run, "
            "nothing will verify this change.",
            file=sys.stderr,
        )

    state = PipelineState(
        adw_id=adw_id, pipeline="chore", prompt=prompt, working_dir=working_dir
    )
    build_request = AgentTemplateRequest(
        agent_name="builder",
        slash_command="/build",
        args=[prompt],
        adw_id=adw_id,
        model=model,
        working_dir=working_dir,
    )

    ok = build_loop(state, build_request, gates, max_iters=max_iters)

    _print_diff_stat(working_dir)
    # PipelineState's path helper is "private" (leading underscore) but
    # pipeline_state.py is frozen (see standing orders) and this is the
    # only place the path is computed — reused rather than duplicated.
    print(f"state: {PipelineState._state_file_path(adw_id)}")
    print("PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
