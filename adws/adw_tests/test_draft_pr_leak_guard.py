#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv"]
# ///

"""Tests for the harness-internal-file leak guard in draft_pr._commit_all.

Background (2026-08-04): the worktree port file .ports.env — pure harness
runtime state — rode blanket `git add -A` phase commits into target-repo PRs
(8+ runs against an early target repo; one PR shipped a stray port bump). The harness no
longer writes the file at all (ports live in agents/<id>/ports.json, injected
as env vars), and _commit_all now excludes/unstages the whole
HARNESS_INTERNAL_FILES class as a backstop for legacy or doctored trees.

Credential-free: local temp repos only; no remote means start() skips gh.

Usage:
    uv run pytest adws/adw_tests/test_draft_pr_leak_guard.py -q
"""

import logging
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from adw_modules import draft_pr  # noqa: E402
from adw_modules.draft_pr import DraftPRSession, _commit_all  # noqa: E402

LOGGER = logging.getLogger("test_draft_pr_leak_guard")
GIT_ID = ["-c", "user.email=adw@test", "-c", "user.name=adw-test"]


def _git(args, cwd):
    return subprocess.run(
        ["git", "-C", str(cwd), *args], capture_output=True, text=True
    )


def _repo(tmp_path: Path) -> Path:
    _git(["init", "-q", "-b", "main"], tmp_path)
    (tmp_path / "app.py").write_text("x = 1\n")
    _git(["add", "."], tmp_path)
    _git([*GIT_ID, "commit", "-q", "-m", "root"], tmp_path)
    return tmp_path


def _session(repo: Path) -> DraftPRSession:
    return DraftPRSession(
        working_dir=str(repo), adw_id="deadbeef", branch="main",
        base_branch="main", title="ADW: leak guard",
    )


def _head_files(repo: Path) -> set[str]:
    out = _git(["show", "--name-only", "--format=", "HEAD"], repo).stdout
    return {line for line in out.splitlines() if line}


def test_untracked_ports_env_never_staged(tmp_path):
    repo = _repo(tmp_path)
    (repo / ".ports.env").write_text("BACKEND_PORT=9103\n")
    (repo / "app.py").write_text("x = 2\n")
    assert _commit_all(_session(repo), "phase", LOGGER) is True
    assert _head_files(repo) == {"app.py"}
    # left on disk, still untracked — never deleted, never committed
    assert (repo / ".ports.env").exists()
    assert ".ports.env" in _git(["status", "--porcelain"], repo).stdout


def test_tracked_ports_env_modification_not_committed(tmp_path):
    # The early-target failure mode: the file already tracked in the target,
    # a new run's reallocation shows as a modification (the stray port bump).
    repo = _repo(tmp_path)
    (repo / ".ports.env").write_text("BACKEND_PORT=9103\n")
    _git(["add", "."], repo)
    _git([*GIT_ID, "commit", "-q", "-m", "tracked ports file"], repo)
    (repo / ".ports.env").write_text("BACKEND_PORT=9113\n")
    (repo / "app.py").write_text("x = 3\n")
    assert _commit_all(_session(repo), "phase", LOGGER) is True
    assert _head_files(repo) == {"app.py"}
    committed = _git(["show", "HEAD:.ports.env"], repo).stdout
    assert committed == "BACKEND_PORT=9103\n"  # port bump did not ride


def test_pre_staged_ports_env_is_unstaged(tmp_path):
    # An agent inside a phase may have run `git add .ports.env` itself — the
    # exclusion pathspec can't help there; the post-stage guard must unstage.
    repo = _repo(tmp_path)
    (repo / ".ports.env").write_text("BACKEND_PORT=9103\n")
    _git(["add", "-f", ".ports.env"], repo)
    (repo / "app.py").write_text("x = 4\n")
    assert _commit_all(_session(repo), "phase", LOGGER) is True
    assert _head_files(repo) == {"app.py"}


def test_only_harness_noise_means_no_commit(tmp_path):
    repo = _repo(tmp_path)
    head_before = _git(["rev-parse", "HEAD"], repo).stdout
    (repo / ".ports.env").write_text("BACKEND_PORT=9103\n")
    assert _commit_all(_session(repo), "phase", LOGGER) is False
    assert _git(["rev-parse", "HEAD"], repo).stdout == head_before


def test_full_phase_flow_produces_clean_branch(tmp_path, monkeypatch):
    # start() -> dirty tree with a pre-dirtied .ports.env -> commit_phase ->
    # finish(): the acceptance path, minus the gh/push legs (no remote) and
    # the agent-written description (stubbed to keep the test credential-free).
    monkeypatch.setattr(draft_pr, "_describe_run", lambda *a, **k: None)
    repo = _repo(tmp_path)
    session = draft_pr.start(str(repo), "deadbeef", "ADW: leak guard", LOGGER)
    assert session is not None and not session.has_pr
    (repo / ".ports.env").write_text("BACKEND_PORT=9104\n")
    (repo / "feature.py").write_text("y = 1\n")
    draft_pr.commit_phase(session, "Build", "ok", LOGGER)
    draft_pr.finish(session, True, "done", LOGGER)
    diff = _git(["diff", "--name-only", "main...adw/deadbeef"], repo).stdout
    assert "feature.py" in diff
    assert ".ports.env" not in diff
