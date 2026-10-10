#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv", "requests"]
# ///

"""Tests for the 2026-07-22 sev1 resume/draft-pr regression cluster.

Found live on Tollgate runs 265e1854/464cf3d7 (a --worktree --review-spec
--draft-pr run paused for spec review, then resumed):

1. `--resume` without re-passed flags fell back to the harness cwd, where no
   .claude/commands exist -> build died with "Unknown command: /implement"
   (zero turns). Fix: run_env persisted at run start + rehydrated on resume,
   with a legacy-inference fallback for states that predate run_env.
2. The run_env fix v1 persisted via TravisState.update(), which silently
   drops keys absent from a LOADED legacy state — the write was a no-op and
   the round-trip test missed it by hand-writing its fixture (LESSONS.md
   2026-07-22). Fix: writers assign state.data["run_env"] directly.
3. draft_pr.start() inside a worktree derived its PR base from HEAD — already
   the adw/<id> branch — so `gh pr create` could never succeed ("No commits
   between adw/X and adw/X"). Fix: travis_sdlc passes the worktree's base ref
   (pr_base_from_worktree) and start() falls back to the remote default
   branch when base == head.

Worktree reuse itself (the same cluster's fourth fix) is covered in
test_feature_worktree.py. Phase gating after a failed build (review/document
no longer dispatch agents) is exercised by travis_sdlc's all_success gate and
verified live; it has no isolated unit here because it lives in main().

Usage:
    uv run pytest adws/adw_tests/test_resume_env.py -q
"""

import json
import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from adw_modules import draft_pr  # noqa: E402
from adw_modules import feature_worktree as fw  # noqa: E402
from travis import travis_sdlc  # noqa: E402
from travis.travis_state import TravisState  # noqa: E402

TEST_ID = "zt-resenv"


def _git(args, cwd):
    return subprocess.run(["git", "-C", str(cwd), *args], capture_output=True, text=True)


def _make_repo(parent: Path, name: str, branch: str = "main") -> Path:
    d = parent / name
    d.mkdir()
    _git(["init", "-q", "-b", branch], d)
    (d / "f.txt").write_text("x\n")
    _git(["add", "-A"], d)
    _git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init"], d)
    return d


@pytest.fixture
def legacy_state():
    """A pre-run_env state file on disk (what every pre-fix run left behind)."""
    state_dir = REPO_ROOT / "agents" / TEST_ID
    shutil.rmtree(state_dir, ignore_errors=True)
    state_dir.mkdir(parents=True)
    (state_dir / "travis_state.json").write_text(json.dumps({
        "adw_id": TEST_ID,
        "phase_results": {"plan": {"success": True}},
        "branch": f"adw/{TEST_ID}",
    }))
    yield TEST_ID
    shutil.rmtree(state_dir, ignore_errors=True)


# ── 1. run_env persistence (the writer-path trap) ────────────────────────────

def test_update_drops_unknown_keys_on_legacy_state(legacy_state):
    """The trap that no-opped fix v1: update() only touches keys already
    present in the loaded data, and legacy files have no run_env key."""
    st = TravisState.load(legacy_state)
    st.update(run_env={"working_dir": "/x"})
    assert "run_env" not in st.data


def test_run_env_direct_assignment_round_trips(legacy_state):
    env = {"working_dir": "/x", "worktree": True, "worktree_base": None, "draft_pr": True}
    st = TravisState.load(legacy_state)
    st.data["run_env"] = env
    st.save()
    assert TravisState.load(legacy_state).get("run_env") == env


# ── 2. legacy run_env inference from the on-disk worktree ────────────────────

def test_legacy_inference_recovers_worktree_env(tmp_path, monkeypatch, legacy_state):
    repo = _make_repo(tmp_path, "tgt")
    monkeypatch.setattr(fw, "HARNESS_ROOT", tmp_path)
    wt, err = fw.create_feature_worktree(TEST_ID, str(repo), logging.getLogger("t"))
    assert wt is not None, err

    env = travis_sdlc.infer_legacy_run_env(TEST_ID, TravisState.load(legacy_state))
    assert os.path.realpath(env["working_dir"]) == os.path.realpath(str(repo))
    assert env["worktree"] is True
    # state["branch"] is written only by the draft-pr loop -> draft_pr inferred on
    assert env["draft_pr"] is True


def test_legacy_inference_without_branch_key(tmp_path, monkeypatch, legacy_state):
    repo = _make_repo(tmp_path, "tgt")
    monkeypatch.setattr(fw, "HARNESS_ROOT", tmp_path)
    wt, err = fw.create_feature_worktree(TEST_ID, str(repo), logging.getLogger("t"))
    assert wt is not None, err

    st = TravisState.load(legacy_state)
    del st.data["branch"]
    assert travis_sdlc.infer_legacy_run_env(TEST_ID, st)["draft_pr"] is False


def test_legacy_inference_absent_worktree_is_empty(tmp_path, monkeypatch, legacy_state):
    monkeypatch.setattr(fw, "HARNESS_ROOT", tmp_path)  # no trees/ under it at all
    assert travis_sdlc.infer_legacy_run_env(TEST_ID, TravisState.load(legacy_state)) == {}


# ── 3. resume command reconstruction ─────────────────────────────────────────

def test_original_flags_keeps_flags_and_quotes_values(monkeypatch):
    prompt = "Execute task M0-1"
    monkeypatch.setattr(sys, "argv", ["travis_sdlc.py", prompt, "--working-dir",
                                      "/tmp/x y", "--worktree", "--draft-pr"])
    assert travis_sdlc._original_flags(prompt, TEST_ID) == \
        "--working-dir '/tmp/x y' --worktree --draft-pr"


def test_original_flags_drops_positionals_and_resume(monkeypatch):
    prompt = "Execute task M0-1"
    monkeypatch.setattr(sys, "argv", ["travis_sdlc.py", prompt, TEST_ID,
                                      "--worktree", "--resume"])
    assert travis_sdlc._original_flags(prompt, TEST_ID) == "--worktree"


# ── 4. draft-PR base derivation ──────────────────────────────────────────────

def test_pr_base_from_worktree():
    wt = lambda ref: SimpleNamespace(base_ref=ref)
    assert travis_sdlc.pr_base_from_worktree(wt("origin/main")) == "main"
    assert travis_sdlc.pr_base_from_worktree(wt("develop")) == "develop"
    assert travis_sdlc.pr_base_from_worktree(wt("HEAD")) is None
    assert travis_sdlc.pr_base_from_worktree(None) is None


def test_draft_pr_start_records_explicit_base(tmp_path):
    """Worktree-shaped repo (already on adw/<id>): explicit base wins."""
    repo = _make_repo(tmp_path, "repo")
    _git(["checkout", "-qb", f"adw/{TEST_ID}"], repo)
    session = draft_pr.start(str(repo), TEST_ID, "t",
                             logging.getLogger("t"), base_branch="main")
    assert session is not None and session.base_branch == "main"


def test_draft_pr_base_head_falls_back_to_default_branch(tmp_path, monkeypatch):
    """No explicit base + already on the adw branch (the 464cf3d7 shape):
    start() must recover the remote default branch instead of issuing
    gh pr create --base adw/X --head adw/X."""
    repo = _make_repo(tmp_path, "repo")
    _git(["checkout", "-qb", f"adw/{TEST_ID}"], repo)

    gh_calls = []

    def fake_gh(args):
        gh_calls.append(args)
        if args[:2] == ["repo", "view"]:
            return SimpleNamespace(returncode=0, stdout="main\n", stderr="")
        if args[:2] == ["pr", "create"]:
            return SimpleNamespace(returncode=0, stderr="",
                                   stdout="https://github.com/acme/x/pull/7\n")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(draft_pr, "_gh", fake_gh)
    monkeypatch.setattr(draft_pr, "_remote_repo_path", lambda wd: "acme/x")
    monkeypatch.setattr(draft_pr, "_push", lambda s: True)

    session = draft_pr.start(str(repo), TEST_ID, "t", logging.getLogger("t"))
    assert session is not None
    assert session.base_branch == "main"
    assert session.pr_number == "7"
    create = next(a for a in gh_calls if a[:2] == ["pr", "create"])
    base_idx = create.index("--base")
    assert create[base_idx + 1] == "main"


def test_draft_pr_adopts_existing_pr_on_resume(tmp_path, monkeypatch):
    """Resumed run: gh pr create fails with 'already exists: <url>' (seen live
    on Tollgate PR #2). start() must adopt that PR so checklist updates and
    the final ready-flip don't silently no-op."""
    repo = _make_repo(tmp_path, "repo")
    _git(["checkout", "-qb", f"adw/{TEST_ID}"], repo)

    stderr = (f'a pull request for branch "adw/{TEST_ID}" into branch "main" '
              'already exists:\nhttps://github.com/acme/x/pull/2')

    def fake_gh(args):
        if args[:2] == ["pr", "create"]:
            return SimpleNamespace(returncode=1, stdout="", stderr=stderr)
        return SimpleNamespace(returncode=0, stdout="main\n", stderr="")

    monkeypatch.setattr(draft_pr, "_gh", fake_gh)
    monkeypatch.setattr(draft_pr, "_remote_repo_path", lambda wd: "acme/x")
    monkeypatch.setattr(draft_pr, "_push", lambda s: True)

    session = draft_pr.start(str(repo), TEST_ID, "t", logging.getLogger("t"),
                             base_branch="main")
    assert session is not None
    assert session.pr_number == "2"
    assert session.pr_url == "https://github.com/acme/x/pull/2"
    assert session.has_pr


# ── 5. review blockers keep the PR in draft ──────────────────────────────────

def test_pr_ready_after_run():
    ready = travis_sdlc.pr_ready_after_run
    assert ready(True, None) is True                      # review skipped
    assert ready(True, {"success": True}) is True
    assert ready(True, {"success": False, "issue_count": 2}) is False  # bb570459 shape
    assert ready(False, {"success": True}) is False       # failed run never ready


# ── 6. legacy spec_file → plan_file (ADR-0001) ───────────────────────────────

def _write_state(adw_id, data):
    (REPO_ROOT / "agents" / adw_id / "travis_state.json").write_text(json.dumps(data))


def test_legacy_spec_file_loads_as_plan_file(legacy_state):
    """A state written before the rename carried the Plan as `spec_file`."""
    _write_state(legacy_state, {
        "adw_id": legacy_state,
        "plan_file": None,
        "spec_file": "specs/legacy-plan.md",
        "spec_review": {"status": "awaiting_approval", "spec_file": "specs/legacy-plan.md"},
        "phase_results": {"research": {"success": True}, "plan": {"success": True}},
    })
    st = TravisState.load(legacy_state)
    assert st.get("plan_file") == "specs/legacy-plan.md"
    assert "spec_file" not in st.data
    assert st.get("spec_review") == {"status": "awaiting_approval",
                                     "plan_file": "specs/legacy-plan.md"}
    assert travis_sdlc.get_resume_phase(st) == "build"


def test_legacy_state_accepts_ticket_and_spec_updates(legacy_state):
    """Unlike run_env, the new fields must survive update() on a loaded
    legacy state, or later tickets hit the same no-op write trap."""
    st = TravisState.load(legacy_state)
    assert st.get("ticket_ref", "missing") is None
    st.update(ticket_ref="#21", spec_ref="#19", spec_warning="no Spec")
    st.save()
    reloaded = TravisState.load(legacy_state)
    assert reloaded.get("ticket_ref") == "#21"
    assert reloaded.get("spec_ref") == "#19"
    assert reloaded.get("spec_warning") == "no Spec"


def test_new_state_has_empty_ticket_and_spec_fields(legacy_state):
    shutil.rmtree(REPO_ROOT / "agents" / legacy_state)
    st = TravisState.load(legacy_state)
    assert st.get("ticket_ref", "missing") is None
    assert st.get("spec_ref", "missing") is None
    assert st.get("spec_warning", "missing") is None
    assert "spec_file" not in st.data
