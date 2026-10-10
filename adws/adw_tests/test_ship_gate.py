#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest"]
# ///

"""Tests for adws/pipelines/ship_gate.py — the repo ship gate CLI
(docs/m2-tasks.md T3).

Usage:
    uv run pytest adws/adw_tests/test_ship_gate.py -q

Credential-free, no LLM, no network: every repo under test is a throwaway
`tmp_path` git repo with its own local adw_gates.json using `true`/`false`
shell commands (never real project gates). ship_gate.py is invoked as a
subprocess (same pattern as test_pipeline_gates.py's --print-gates tests) so
the real argv-parsing/exit-code contract is exercised end to end. Covers:

1. Preconditions: default branch -> exit 2 (both the explicit
   `git symbolic-ref refs/remotes/origin/HEAD` path and the no-origin
   fallback-to-"main" path); dirty tracked tree -> exit 2; untracked-only
   files are warn-only (do not block).
2. --skip-precheck: bypasses both checks, prints an audited stderr line, and
   sets "skip_precheck": true in --json output.
3. Gate pass/fail: all-`true` gates -> exit 0; a `false` gate -> exit 1.
4. --json shape: gates/all_passed/skip_precheck/branch/dirty all present.
5. Malformed adw_gates.json -> exit 1 (fails closed, never silently passes).
"""

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SHIP_GATE_SCRIPT = REPO_ROOT / "adws" / "pipelines" / "ship_gate.py"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _run(cmd, cwd):
    return subprocess.run(cmd, cwd=str(cwd), check=True, capture_output=True, text=True)


def _init_repo(tmp_path: Path, branch: str = "feature") -> Path:
    """A real git repo on `branch`, one commit, clean tree."""
    repo = tmp_path
    _run(["git", "init", "-b", branch], repo)
    _run(["git", "config", "user.email", "test@example.com"], repo)
    _run(["git", "config", "user.name", "Test"], repo)
    (repo / "README.md").write_text("init\n")
    _run(["git", "add", "-A"], repo)
    _run(["git", "commit", "-m", "init"], repo)
    return repo


def _write_gates(repo: Path, entries: list) -> None:
    (repo / "adw_gates.json").write_text(json.dumps({"gates": entries}))


def _ship_gate(repo: Path, *extra_args: str):
    return subprocess.run(
        [sys.executable, str(SHIP_GATE_SCRIPT), "--working-dir", str(repo), *extra_args],
        capture_output=True,
        text=True,
    )


# ---------------------------------------------------------------------------
# (1) Preconditions
# ---------------------------------------------------------------------------


def test_default_branch_fallback_to_main_blocks(tmp_path):
    """No origin remote configured at all -> `git symbolic-ref
    refs/remotes/origin/HEAD` fails -> the fallback default is "main". A
    repo sitting on "main" must be blocked."""
    repo = _init_repo(tmp_path, branch="main")
    _write_gates(repo, [{"name": "unit", "command": "true"}])
    result = _ship_gate(repo)
    assert result.returncode == 2
    assert "default branch" in result.stderr


def test_default_branch_explicit_origin_head_blocks(tmp_path):
    """Explicit origin/HEAD set to a non-"main" default (e.g. "trunk") is
    honored over the "main" fallback."""
    repo = _init_repo(tmp_path, branch="trunk")
    _run(["git", "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/trunk"], repo)
    _write_gates(repo, [{"name": "unit", "command": "true"}])
    result = _ship_gate(repo)
    assert result.returncode == 2
    assert "trunk" in result.stderr


def test_feature_branch_with_explicit_origin_head_passes_precondition(tmp_path):
    """A feature branch != the explicit origin/HEAD default is allowed
    through to gate-running."""
    repo = _init_repo(tmp_path, branch="feature")
    _run(["git", "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"], repo)
    _write_gates(repo, [{"name": "unit", "command": "true"}])
    result = _ship_gate(repo)
    assert result.returncode == 0


def test_dirty_tracked_tree_blocks(tmp_path):
    repo = _init_repo(tmp_path, branch="feature")
    _write_gates(repo, [{"name": "unit", "command": "true"}])
    (repo / "README.md").write_text("changed\n")  # tracked file, uncommitted
    result = _ship_gate(repo)
    assert result.returncode == 2
    assert "dirty" in result.stderr


def test_untracked_only_is_warn_only_not_blocking(tmp_path):
    repo = _init_repo(tmp_path, branch="feature")
    _write_gates(repo, [{"name": "unit", "command": "true"}])
    (repo / "scratch.txt").write_text("untracked\n")  # never `git add`ed
    result = _ship_gate(repo)
    assert result.returncode == 0
    assert "untracked files present" in result.stderr


# ---------------------------------------------------------------------------
# (2) --skip-precheck
# ---------------------------------------------------------------------------


def test_skip_precheck_bypasses_default_branch_and_dirty_tree(tmp_path):
    repo = _init_repo(tmp_path, branch="main")  # default branch AND...
    _write_gates(repo, [{"name": "unit", "command": "true"}])
    (repo / "README.md").write_text("dirty\n")  # ...dirty tracked tree
    result = _ship_gate(repo, "--skip-precheck", "--json")
    assert result.returncode == 0
    assert "BYPASSED (audited)" in result.stderr
    payload = json.loads(result.stdout.strip().splitlines()[-1])
    assert payload["skip_precheck"] is True


def test_skip_precheck_omitted_means_false_in_json(tmp_path):
    repo = _init_repo(tmp_path, branch="feature")
    _run(["git", "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"], repo)
    _write_gates(repo, [{"name": "unit", "command": "true"}])
    result = _ship_gate(repo, "--json")
    payload = json.loads(result.stdout.strip().splitlines()[-1])
    assert payload["skip_precheck"] is False


# ---------------------------------------------------------------------------
# (3) Gate pass/fail exit codes
# ---------------------------------------------------------------------------


def _clean_feature_repo(tmp_path):
    repo = _init_repo(tmp_path, branch="feature")
    _run(["git", "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"], repo)
    return repo


def test_all_gates_pass_exit_zero(tmp_path):
    repo = _clean_feature_repo(tmp_path)
    _write_gates(repo, [{"name": "a", "command": "true"}, {"name": "b", "command": "true"}])
    result = _ship_gate(repo)
    assert result.returncode == 0
    assert "ALL GATES PASSED" in result.stdout


def test_a_failing_gate_exits_one_and_stops_before_later_gates(tmp_path):
    repo = _clean_feature_repo(tmp_path)
    _write_gates(
        repo,
        [
            {"name": "a", "command": "false"},
            {"name": "b", "command": "true"},
        ],
    )
    result = _ship_gate(repo)
    assert result.returncode == 1
    assert "[FAIL] a" in result.stdout
    assert "b" not in result.stdout.split("SHIP GATE:")[0]  # gate b never ran/printed


# ---------------------------------------------------------------------------
# (4) --json shape
# ---------------------------------------------------------------------------


def test_json_shape_has_all_required_keys(tmp_path):
    repo = _clean_feature_repo(tmp_path)
    _write_gates(repo, [{"name": "unit", "command": "true"}])
    result = _ship_gate(repo, "--json")
    payload = json.loads(result.stdout.strip().splitlines()[-1])
    assert set(payload.keys()) == {"gates", "all_passed", "skip_precheck", "branch", "dirty"}
    assert payload["branch"] == "feature"
    assert payload["dirty"] is False
    assert payload["all_passed"] is True
    assert len(payload["gates"]) == 1
    gate_result = payload["gates"][0]
    assert gate_result["name"] == "unit"
    assert gate_result["passed"] is True
    assert gate_result["timed_out"] is False
    assert gate_result["duration_s"] < 5


def test_json_shape_on_gate_failure(tmp_path):
    repo = _clean_feature_repo(tmp_path)
    _write_gates(repo, [{"name": "unit", "command": "false"}])
    result = _ship_gate(repo, "--json")
    assert result.returncode == 1
    payload = json.loads(result.stdout.strip().splitlines()[-1])
    assert payload["all_passed"] is False
    assert payload["gates"][0]["passed"] is False


# ---------------------------------------------------------------------------
# (5) Malformed adw_gates.json
# ---------------------------------------------------------------------------


def test_malformed_config_exits_one(tmp_path):
    repo = _clean_feature_repo(tmp_path)
    (repo / "adw_gates.json").write_text("{{{ not json")
    result = _ship_gate(repo)
    assert result.returncode == 1


# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------


def test_working_dir_missing_value_exits_one(tmp_path):
    result = subprocess.run(
        [sys.executable, str(SHIP_GATE_SCRIPT), "--working-dir"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1


def test_zero_gates_passes(tmp_path):
    repo = _clean_feature_repo(tmp_path)
    _write_gates(repo, [])
    result = _ship_gate(repo)
    assert result.returncode == 0
    assert "ALL GATES PASSED" in result.stdout


def test_nonexistent_working_dir_exits_two_with_clean_message(tmp_path):
    """--working-dir must be validated BEFORE any git call — a missing
    directory is a precondition failure (exit 2), not a raw traceback from
    handing subprocess.run() a cwd that doesn't exist."""
    missing = tmp_path / "does-not-exist"
    result = _ship_gate(missing)
    assert result.returncode == 2
    assert "does not exist" in result.stderr
    assert "Traceback" not in result.stderr
    assert "Traceback" not in result.stdout
