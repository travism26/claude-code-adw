#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv"]
# ///

"""Tests for travis.travis_build._git_snapshot — the fail-closed guard for
build agents that report success without touching the tree.

Found live on run 5dbaba17 (2026-07-29): the builder emitted a pseudo tool
call as plain TEXT (`Agent({...})`), Claude Code treated the text-only turn
as a final answer, and the session ended after ONE turn with subtype
"success" — which slips past is_zero_turn_failure (that guard fires on
num_turns == 0). travis_build now snapshots (HEAD, porcelain) before and
after the agent run, retries once on an unchanged snapshot, then fails
closed.

Usage:
    uv run pytest adws/adw_tests/test_build_noop_guard.py -q
"""

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from travis.travis_build import _git_snapshot  # noqa: E402

GIT_ID = ["-c", "user.email=adw@test", "-c", "user.name=adw-test"]


def _init_repo(path: Path) -> None:
    subprocess.run(["git", "init", "-q"], cwd=path, check=True)
    subprocess.run(["git", *GIT_ID, "commit", "--allow-empty", "-q", "-m", "root"],
                   cwd=path, check=True)


def test_untouched_tree_snapshots_equal(tmp_path):
    _init_repo(tmp_path)
    assert _git_snapshot(str(tmp_path)) == _git_snapshot(str(tmp_path))
    assert _git_snapshot(str(tmp_path)) is not None


def test_new_untracked_file_changes_snapshot(tmp_path):
    # The common build case: agent writes new files, commits nothing.
    _init_repo(tmp_path)
    before = _git_snapshot(str(tmp_path))
    (tmp_path / "new_module.py").write_text("x = 1\n")
    assert _git_snapshot(str(tmp_path)) != before


def test_modified_tracked_file_changes_snapshot(tmp_path):
    _init_repo(tmp_path)
    tracked = tmp_path / "tracked.py"
    tracked.write_text("x = 1\n")
    subprocess.run(["git", "add", "tracked.py"], cwd=tmp_path, check=True)
    subprocess.run(["git", *GIT_ID, "commit", "-q", "-m", "add tracked"],
                   cwd=tmp_path, check=True)
    before = _git_snapshot(str(tmp_path))
    tracked.write_text("x = 2\n")
    assert _git_snapshot(str(tmp_path)) != before


def test_commit_moves_head_and_changes_snapshot(tmp_path):
    # An agent that commits its work leaves a clean tree; HEAD is the signal.
    _init_repo(tmp_path)
    before = _git_snapshot(str(tmp_path))
    subprocess.run(["git", *GIT_ID, "commit", "--allow-empty", "-q", "-m", "work"],
                   cwd=tmp_path, check=True)
    assert _git_snapshot(str(tmp_path)) != before


def test_non_git_dir_returns_none(tmp_path):
    # Guard disables itself (returns None) outside a git repo rather than
    # producing a bogus comparison.
    assert _git_snapshot(str(tmp_path)) is None
