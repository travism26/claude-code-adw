"""Spawn a child travis_sdlc run and collect its result.

Shared by the parallel runners — `travis_fanout.py` (many features, one repo)
and `travis_multirepo.py` (one ticket, many repos). Both fan out by launching
full `travis_sdlc.py` subprocesses, each `--worktree`-isolated (its own branch,
ports, and tree), so the subprocess-spawn + state-reading logic lives here once.

Result collection is two-signal: the subprocess exit code is only a liveness
check (travis_sdlc deliberately exits 0 on test/validate-only failures), so the
authoritative per-phase verdict is read back from the child's
agents/<adw_id>/travis_state.json — the same phase_results dict the orchestrator
writes.
"""

import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from adw_modules.utils import make_adw_id

HARNESS_ROOT = Path(__file__).resolve().parent.parent.parent

# The required phases, in order. A child "succeeds" when both completed — these
# are exactly the phases travis_sdlc treats as workflow-stopping (research is
# non-blocking; validate/test failures still exit 0).
REQUIRED_PHASES = ["plan", "build"]


@dataclass
class ChildResult:
    """Outcome of one child travis_sdlc run."""

    feature: str               # the prompt or spec-file given to the child
    adw_id: str
    branch: str                # adw/<adw_id>
    returncode: int
    success: bool              # required phases (plan+build) all succeeded
    failed_phase: Optional[str]
    pr_url: Optional[str]
    state_path: str
    log_path: str
    repo_name: Optional[str] = None  # set by multirepo; None for fanout


def _collect_result(feature: str, adw_id: str, returncode: int, log_path: str,
                    repo_name: Optional[str]) -> ChildResult:
    """Read the child's travis_state.json and derive the authoritative verdict."""
    from travis.travis_state import TravisState

    state = TravisState.load(adw_id)
    phase_results = state.data.get("phase_results", {})

    failed_phase: Optional[str] = None
    success = True
    for phase in REQUIRED_PHASES:
        result = phase_results.get(phase)
        if not result or not result.get("success"):
            failed_phase = phase
            success = False
            break

    return ChildResult(
        feature=feature,
        adw_id=adw_id,
        branch=state.get("branch") or f"adw/{adw_id}",
        returncode=returncode,
        success=success,
        failed_phase=failed_phase,
        pr_url=state.get("pr_url"),
        state_path=state._state_file,
        log_path=log_path,
        repo_name=repo_name,
    )


def spawn_sdlc_child(
    feature: str,
    base_working_dir: str,
    extra_args: List[str],
    logger,
    *,
    runner: str = "fanout",
    repo_name: Optional[str] = None,
) -> ChildResult:
    """Run one `travis_sdlc.py --worktree` subprocess and collect its result.

    Args:
        feature: prompt text or spec-file path passed to travis_sdlc as input.
        base_working_dir: the target repo root (--working-dir for the child).
        extra_args: args forwarded verbatim to the child (e.g. --plan-type,
            --worktree-base, --model, --diff-base, --skip-document, ...). The
            runner always adds --worktree itself.
        runner: label for the child log file name (fanout|multirepo).
        repo_name: tagged onto the result for multirepo scorecards.

    Each child gets a fresh adw_id, so state/logs/worktrees never collide across
    concurrent children.
    """
    adw_id = make_adw_id()
    log_dir = HARNESS_ROOT / "agents" / adw_id
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = str(log_dir / f"{runner}_child.log")

    cmd = [
        "uv", "run", str(HARNESS_ROOT / "adws" / "travis" / "travis_sdlc.py"),
        feature, adw_id,
        "--worktree",
        "--working-dir", base_working_dir,
        *extra_args,
    ]

    label = f"{repo_name}/{adw_id}" if repo_name else adw_id
    logger.info(f"  [{label}] launching: {feature[:60]!r} in {base_working_dir}")

    with open(log_path, "w") as log_file:
        proc = subprocess.run(
            cmd, cwd=str(HARNESS_ROOT),
            stdout=log_file, stderr=subprocess.STDOUT, text=True,
        )

    result = _collect_result(feature, adw_id, proc.returncode, log_path, repo_name)
    verdict = "✅" if result.success else f"❌ ({result.failed_phase})"
    logger.info(f"  [{label}] {verdict} branch={result.branch} → {log_path}")
    return result
