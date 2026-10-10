#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""Repo ship gate — deterministic preconditions + all configured gates.
Report only: no agents, no fixing, no PR creation (docs/m2-tasks.md T3).

DESIGN INVARIANT: ZERO network calls, ever. Only local `git` (branch/tree
inspection) and whatever local gate commands adw_gates.json/auto-detect
resolve to. Never talks to GitHub, never pushes, never opens a PR — that is
documented human-in-the-loop procedure in .claude/skills/ship-gate/SKILL.md,
kept out of this CLI so the gate can never be the thing that leaks or ships
anything. --skip-precheck exists but is loud + audited, never silent — the
escape-hatch gap this replacement closes.

CLI: uv run adws/pipelines/ship_gate.py [--working-dir DIR] [--json] [--skip-precheck]

Preconditions (skipped only with --skip-precheck, itself logged + reported):
  - current branch must not be the default branch (via
    `git symbolic-ref refs/remotes/origin/HEAD`, fallback "main")
  - tracked working tree must be clean; untracked files are warn-only

Exit codes: 0 all gates passed, 1 a gate failed (or adw_gates.json is
malformed), 2 a precondition failed.
"""

import json
import subprocess
import sys
import time
from pathlib import Path
from typing import List, Optional, Tuple

# adws/pipelines/ship_gate.py -> need "adws" on sys.path so `pipelines`
# resolves as a package (same convention as gates.py/core.py).
_ADWS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ADWS_DIR))

from pipelines.core import Gate, run_gates  # noqa: E402
from pipelines.gates import GateConfigError, resolve_gates  # noqa: E402

GIT_TIMEOUT_S = 30


class GitUnavailableError(Exception):
    """A `git` call timed out or could not be launched — fail closed with a
    clean precondition-class error, never a raw traceback."""


def _git(args: List[str], cwd: str) -> Tuple[int, str]:
    try:
        proc = subprocess.run(
            ["git", *args], cwd=cwd, capture_output=True, text=True, timeout=GIT_TIMEOUT_S
        )
    except (subprocess.TimeoutExpired, OSError) as e:
        raise GitUnavailableError(f"git {' '.join(args)} failed: {e}") from e
    return proc.returncode, proc.stdout.strip()


def _current_branch(cwd: str) -> str:
    code, out = _git(["rev-parse", "--abbrev-ref", "HEAD"], cwd)
    return out if code == 0 and out else "HEAD"


def _default_branch(cwd: str) -> str:
    code, out = _git(["symbolic-ref", "refs/remotes/origin/HEAD"], cwd)
    return out.rsplit("/", 1)[-1] if code == 0 and out else "main"


def _tree_status(cwd: str) -> Tuple[bool, bool]:
    """Returns (tracked_dirty, has_untracked). A `git status` failure (e.g.
    not a git repo) counts as dirty — fail closed on the precondition."""
    code, out = _git(["status", "--porcelain"], cwd)
    if code != 0:
        return True, False
    lines = out.splitlines()
    tracked_dirty = any(ln.strip() and not ln.startswith("??") for ln in lines)
    has_untracked = any(ln.startswith("??") for ln in lines)
    return tracked_dirty, has_untracked


def _check_preconditions(cwd: str, skip: bool) -> Tuple[Optional[str], str, bool]:
    """Returns (error_or_None, branch, dirty). branch/dirty are always
    computed (for the report) even when --skip-precheck bypasses the checks."""
    branch = _current_branch(cwd)
    dirty, has_untracked = _tree_status(cwd)
    if skip:
        print(
            "SHIP GATE: --skip-precheck set — branch/clean-tree preconditions BYPASSED (audited).",
            file=sys.stderr,
        )
        return None, branch, dirty

    default = _default_branch(cwd)
    if branch == default:
        return f"on default branch '{default}' — refusing to ship-gate from it", branch, dirty
    if dirty:
        return "tracked working tree is dirty — commit or stash before shipping", branch, dirty
    if has_untracked:
        print("SHIP GATE: warning — untracked files present (not blocking)", file=sys.stderr)
    return None, branch, dirty


def _run_all_gates(gates: List[Gate], cwd: str) -> List[dict]:
    """Runs gates in order, stopping at the first failure (cheap before
    expensive). Calls core.run_gates once per gate — same short-circuit
    behavior as a single call, but lets us time each gate individually
    (core.py is frozen and GateResult carries no duration field)."""
    results = []
    for gate in gates:
        start = time.monotonic()
        failure = run_gates([gate], cwd)
        duration = round(time.monotonic() - start, 3)
        results.append(
            {
                "name": gate.name,
                "passed": failure is None,
                "timed_out": bool(failure.timed_out) if failure else False,
                "duration_s": duration,
            }
        )
        if failure is not None:
            break
    return results


def main() -> int:
    args = sys.argv[1:]
    as_json = "--json" in args
    skip_precheck = "--skip-precheck" in args
    working_dir = "."
    if "--working-dir" in args:
        idx = args.index("--working-dir")
        if idx + 1 >= len(args):
            print("Error: --working-dir requires a value", file=sys.stderr)
            return 1
        working_dir = args[idx + 1]
    cwd_path = Path(working_dir).resolve()
    if not cwd_path.is_dir():
        print(f"SHIP GATE: --working-dir '{cwd_path}' does not exist or is not a directory", file=sys.stderr)
        return 2
    cwd = str(cwd_path)

    try:
        err, branch, dirty = _check_preconditions(cwd, skip_precheck)
    except GitUnavailableError as e:
        print(f"SHIP GATE: precondition failed — {e}", file=sys.stderr)
        return 2
    if err is not None:
        print(f"SHIP GATE: precondition failed — {err}", file=sys.stderr)
        return 2

    try:
        gates = resolve_gates(cwd)
    except GateConfigError as e:
        print(f"SHIP GATE: {e}", file=sys.stderr)
        return 1

    results = _run_all_gates(gates, cwd)
    all_passed = all(r["passed"] for r in results) if results else True

    for r in results:
        status = "PASS" if r["passed"] else "FAIL"
        note = " (timed out)" if r["timed_out"] else ""
        print(f"[{status}] {r['name']} ({r['duration_s']}s){note}")
    verdict = "ALL GATES PASSED" if all_passed else "GATE FAILURE"
    print(f"SHIP GATE: {verdict} ({len(results)}/{len(gates)} gates run)")

    if as_json:
        print(json.dumps({
            "gates": results,
            "all_passed": all_passed,
            "skip_precheck": skip_precheck,
            "branch": branch,
            "dirty": dirty,
        }))

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
