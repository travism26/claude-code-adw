#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic"]
# ///

"""Tests for pipelines/factory.py (docs/slim-pipelines-plan.md §9, M5 factory
orchestrator).

Usage:
    uv run pytest adws/adw_tests/test_factory.py -q

Hermetic (no Claude calls, no network, no real worktrees/git-worktree/gh):
  - `factory.route_ticket` / `factory.create_feature_worktree` /
    `factory.remove_feature_worktree` / `factory.fetch_issue` are monkeypatched
    with call-recording fakes.
  - `factory.draft_pr.start/commit_phase/finish` are monkeypatched (draft_pr's
    OWN internal git/gh subprocess calls never run).
  - `subprocess.run` is monkeypatched with a router fake that recognizes the
    three shapes factory.py itself invokes: the `git remote get-url origin`
    origin check, the `git rev-parse --abbrev-ref HEAD` base-branch lookup,
    and the `uv run <pipeline>` child launch.
  - PipelineState is real: each test that needs a "child already ran" verdict
    writes agents/<adw_id>/pipeline_state.json directly via
    `PipelineState(...).save()` (mirroring test_router.py's fixture, which
    cleans up agents/<adw_id> after each test).
"""

import shutil
import subprocess
import sys
import uuid
from pathlib import Path
from types import SimpleNamespace
from typing import Optional

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

import pipelines.factory as factory  # noqa: E402
from adw_modules.data_types import GitHubIssue, GitHubLabel, GitHubUser  # noqa: E402
from adw_modules.feature_worktree import Worktree  # noqa: E402
from pipelines.pipeline_state import PipelineState  # noqa: E402
from pipelines.router import RouteVerdict, RouterError  # noqa: E402


@pytest.fixture
def adw_id():
    """A unique adw_id per test, with agents/<adw_id> cleaned up afterward
    (mirrors test_router.py's fixture)."""
    generated = f"test-factory-{uuid.uuid4().hex[:8]}"
    yield generated
    state_dir = REPO_ROOT / "agents" / generated
    if state_dir.exists():
        shutil.rmtree(state_dir)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _run_main(monkeypatch, argv):
    monkeypatch.setattr(sys, "argv", ["factory.py"] + argv)
    with pytest.raises(SystemExit) as exc_info:
        factory.main()
    return exc_info.value.code


def _fake_worktree(adw_id: str, tmp_path: Path, base_ref: str = "origin/main") -> Worktree:
    return Worktree(adw_id=adw_id, path=str(tmp_path / "wt"), branch=f"adw/{adw_id}",
                     base_ref=base_ref, backend_port=9000, frontend_port=9001, source_repo=str(tmp_path))


def _patch_create_worktree(monkeypatch, wt: Optional[Worktree], err: Optional[str] = None) -> list:
    calls: list = []

    def fn(adw_id, working_dir, logger, **kwargs):
        calls.append((adw_id, working_dir))
        if wt is None:
            return None, err
        return wt, None

    monkeypatch.setattr(factory, "create_feature_worktree", fn)
    return calls


def _patch_remove_worktree(monkeypatch) -> list:
    calls: list = []
    monkeypatch.setattr(factory, "remove_feature_worktree", lambda wt, logger: calls.append(wt))
    return calls


def _patch_route_ticket(monkeypatch, route: str = "chore", confidence: float = 0.9, reason: str = "ok") -> list:
    calls: list = []

    def fn(ticket, adw_id, working_dir, model=None):
        calls.append((ticket, adw_id, working_dir, model))
        return RouteVerdict(route=route, confidence=confidence, reason=reason)

    monkeypatch.setattr(factory, "route_ticket", fn)
    return calls


def _patch_route_ticket_raises(monkeypatch) -> list:
    calls: list = []

    def fn(ticket, adw_id, working_dir, model=None):
        calls.append((ticket, adw_id, working_dir, model))
        raise RouterError("router agent failed")

    monkeypatch.setattr(factory, "route_ticket", fn)
    return calls


def _patch_route_ticket_forbidden(monkeypatch) -> None:
    def fn(*a, **kw):
        raise AssertionError("route_ticket must not be called when --route overrides it")

    monkeypatch.setattr(factory, "route_ticket", fn)


def _patch_fetch_issue(monkeypatch, issue: Optional[GitHubIssue] = None, forbid: bool = False) -> list:
    calls: list = []

    def fn(issue_number, repo_path):
        if forbid:
            raise AssertionError("fetch_issue must not be called")
        calls.append((issue_number, repo_path))
        return issue

    monkeypatch.setattr(factory, "fetch_issue", fn)
    return calls


def _patch_draft_pr(monkeypatch) -> dict:
    calls = {"start": [], "commit_phase": [], "finish": []}

    def start(working_dir, adw_id, title, logger, issue_number=None, base_branch=None):
        calls["start"].append(dict(working_dir=working_dir, adw_id=adw_id, title=title,
                                    issue_number=issue_number, base_branch=base_branch))
        return SimpleNamespace(pr_url="https://github.com/acme/widgets/pull/7", branch=f"adw/{adw_id}")

    def commit_phase(session, label, status, logger):
        calls["commit_phase"].append((label, status))

    def finish(session, success, summary, logger):
        calls["finish"].append((success, summary))

    monkeypatch.setattr(factory.draft_pr, "start", start)
    monkeypatch.setattr(factory.draft_pr, "commit_phase", commit_phase)
    monkeypatch.setattr(factory.draft_pr, "finish", finish)
    return calls


def _patch_subprocess_run(monkeypatch, *, has_origin: bool = True,
                           origin_url: str = "https://github.com/acme/widgets.git",
                           head_branch: str = "main", launch_rc: int = 0) -> list:
    calls: list = []

    def fn(cmd, **kwargs):
        calls.append(cmd)
        if cmd[0] == "git" and "remote" in cmd:
            if has_origin:
                return subprocess.CompletedProcess(cmd, 0, stdout=origin_url + "\n")
            return subprocess.CompletedProcess(cmd, 1, stdout="")
        if cmd[0] == "git" and "rev-parse" in cmd:
            return subprocess.CompletedProcess(cmd, 0, stdout=head_branch + "\n")
        return subprocess.CompletedProcess(cmd, launch_rc, stdout="")

    monkeypatch.setattr(factory.subprocess, "run", fn)
    return calls


def _write_state(adw_id: str, working_dir: str, overall_success: bool, phase_results: Optional[dict] = None) -> None:
    PipelineState(adw_id=adw_id, pipeline="chore", prompt="p", working_dir=working_dir,
                  phase_results=phase_results or {}, overall_success=overall_success).save()


def _fake_issue(title: str = "Fix login redirect", body: str = "Users land on 404") -> GitHubIssue:
    return GitHubIssue(
        number=42, title=title, body=body, state="open",
        author=GitHubUser(login="octocat"), labels=[GitHubLabel(id="1", name="bug", color="fff")],
        createdAt="2026-01-01T00:00:00Z", updatedAt="2026-01-01T00:00:00Z",
        url="https://github.com/acme/widgets/issues/42",
    )


# ---------------------------------------------------------------------------
# (a) prompt + --route chore -> child argv correct; router NOT called
# ---------------------------------------------------------------------------


def test_route_override_composes_chore_argv_and_skips_router(tmp_path, adw_id, monkeypatch):
    wt = _fake_worktree(adw_id, tmp_path)
    _patch_route_ticket_forbidden(monkeypatch)
    _patch_create_worktree(monkeypatch, wt)
    calls = _patch_subprocess_run(monkeypatch, launch_rc=1)  # fail fast, no draft_pr needed

    code = _run_main(monkeypatch, ["fix the thing", "--working-dir", str(tmp_path),
                                    "--route", "chore", "--adw-id", adw_id])

    assert code == 1
    assert len(calls) == 1
    cmd = calls[0]
    assert cmd[0] == "uv" and cmd[1] == "run"
    assert cmd[2].endswith("pipe_chore.py")
    assert cmd[3] == "fix the thing"
    assert cmd[4:9] == ["--working-dir", wt.path, "--adw-id", adw_id, "--model"]
    assert cmd[9] == "sonnet"


# ---------------------------------------------------------------------------
# (b) no --route -> router called; verdict feature -> pipe_feature.py in argv
# ---------------------------------------------------------------------------


def test_no_override_uses_router_verdict(tmp_path, adw_id, monkeypatch):
    wt = _fake_worktree(adw_id, tmp_path)
    route_calls = _patch_route_ticket(monkeypatch, route="feature", confidence=0.9)
    _patch_create_worktree(monkeypatch, wt)
    calls = _patch_subprocess_run(monkeypatch, launch_rc=1)

    code = _run_main(monkeypatch, ["add a thing", "--working-dir", str(tmp_path), "--adw-id", adw_id])

    assert code == 1
    assert len(route_calls) == 1
    assert calls[0][2].endswith("pipe_feature.py")


# ---------------------------------------------------------------------------
# (c) low confidence -> loud warning, run proceeds anyway
# ---------------------------------------------------------------------------


def test_low_confidence_warns_but_proceeds(tmp_path, adw_id, monkeypatch, capsys):
    wt = _fake_worktree(adw_id, tmp_path)
    _patch_route_ticket(monkeypatch, route="bug", confidence=0.3)
    wt_calls = _patch_create_worktree(monkeypatch, wt)
    _patch_subprocess_run(monkeypatch, launch_rc=1)

    code = _run_main(monkeypatch, ["fix it", "--working-dir", str(tmp_path), "--adw-id", adw_id])

    assert code == 1
    assert len(wt_calls) == 1, "worktree creation must proceed despite low confidence"
    assert "WARNING" in capsys.readouterr().err


# ---------------------------------------------------------------------------
# (d) RouterError -> exit 1, worktree never created
# ---------------------------------------------------------------------------


def test_router_error_stops_before_worktree(tmp_path, adw_id, monkeypatch):
    route_calls = _patch_route_ticket_raises(monkeypatch)
    wt_calls = _patch_create_worktree(monkeypatch, _fake_worktree(adw_id, tmp_path))

    code = _run_main(monkeypatch, ["fix it", "--working-dir", str(tmp_path), "--adw-id", adw_id])

    assert code == 1
    assert len(route_calls) == 1
    assert wt_calls == []


# ---------------------------------------------------------------------------
# (e) rc 0 + state True -> draft PR flow runs; worktree removed
# ---------------------------------------------------------------------------


def test_success_path_drives_draft_pr_and_removes_worktree(tmp_path, adw_id, monkeypatch):
    wt = _fake_worktree(adw_id, tmp_path, base_ref="origin/main")
    _patch_create_worktree(monkeypatch, wt)
    remove_calls = _patch_remove_worktree(monkeypatch)
    _patch_subprocess_run(monkeypatch, launch_rc=0)
    pr_calls = _patch_draft_pr(monkeypatch)
    _write_state(adw_id, str(tmp_path), overall_success=True)

    code = _run_main(monkeypatch, ["ship it", "--working-dir", str(tmp_path),
                                    "--route", "chore", "--adw-id", adw_id])

    assert code == 0
    assert len(pr_calls["start"]) == 1
    assert pr_calls["start"][0]["working_dir"] == wt.path
    assert pr_calls["start"][0]["base_branch"] == "main"
    assert len(pr_calls["commit_phase"]) == 1
    assert len(pr_calls["finish"]) == 1
    assert pr_calls["finish"][0][0] is True
    assert remove_calls == [wt]


# ---------------------------------------------------------------------------
# (f) rc 0 + state False -> failure path; draft PR NOT called; worktree kept
# ---------------------------------------------------------------------------


def test_signal_disagreement_rc_ok_state_false_fails_and_keeps_worktree(tmp_path, adw_id, monkeypatch, capsys):
    wt = _fake_worktree(adw_id, tmp_path)
    _patch_create_worktree(monkeypatch, wt)
    remove_calls = _patch_remove_worktree(monkeypatch)
    _patch_subprocess_run(monkeypatch, launch_rc=0)
    pr_calls = _patch_draft_pr(monkeypatch)
    _write_state(adw_id, str(tmp_path), overall_success=False,
                 phase_results={"build": {"success": False}})

    code = _run_main(monkeypatch, ["ship it", "--working-dir", str(tmp_path),
                                    "--route", "chore", "--adw-id", adw_id])

    assert code == 1
    assert pr_calls["start"] == []
    assert remove_calls == []
    err = capsys.readouterr().err
    assert "DISAGREE" in err
    assert "build" in err  # first failed phase named
    assert wt.path in err  # worktree location reported
    # A RECORDED False verdict must not be misreported as a missing state file.
    assert "overall_success=False" in err
    assert "NOT WRITTEN" not in err


# ---------------------------------------------------------------------------
# (g) rc 1 -> failure path
# ---------------------------------------------------------------------------


def test_nonzero_exit_code_fails(tmp_path, adw_id, monkeypatch, capsys):
    wt = _fake_worktree(adw_id, tmp_path)
    _patch_create_worktree(monkeypatch, wt)
    remove_calls = _patch_remove_worktree(monkeypatch)
    _patch_subprocess_run(monkeypatch, launch_rc=1)
    pr_calls = _patch_draft_pr(monkeypatch)

    code = _run_main(monkeypatch, ["ship it", "--working-dir", str(tmp_path),
                                    "--route", "chore", "--adw-id", adw_id])

    assert code == 1
    assert pr_calls["start"] == []
    assert remove_calls == []
    assert "FACTORY RUN FAILED" in capsys.readouterr().err


# ---------------------------------------------------------------------------
# (h) no state file written -> fail-closed
# ---------------------------------------------------------------------------


def test_missing_state_file_fails_closed(tmp_path, adw_id, monkeypatch, capsys):
    wt = _fake_worktree(adw_id, tmp_path)
    _patch_create_worktree(monkeypatch, wt)
    _patch_remove_worktree(monkeypatch)
    _patch_subprocess_run(monkeypatch, launch_rc=0)  # child "lived" but never wrote state
    pr_calls = _patch_draft_pr(monkeypatch)

    code = _run_main(monkeypatch, ["ship it", "--working-dir", str(tmp_path),
                                    "--route", "chore", "--adw-id", adw_id])

    assert code == 1
    assert pr_calls["start"] == []
    # PR #10 review nit: a never-written state file must be reported as such,
    # not as a recorded overall_success=False verdict.
    err = capsys.readouterr().err
    assert "no pipeline_state.json was written" in err
    assert "NOT WRITTEN" in err
    assert "overall_success=False" not in err


# ---------------------------------------------------------------------------
# (i) intake XOR: both / neither -> usage error
# ---------------------------------------------------------------------------


def test_both_prompt_and_issue_is_usage_error(monkeypatch, capsys):
    code = _run_main(monkeypatch, ["a prompt", "--issue", "42"])
    assert code == 1
    assert "Error" in capsys.readouterr().err


def test_neither_prompt_nor_issue_is_usage_error(monkeypatch, capsys):
    code = _run_main(monkeypatch, [])
    assert code == 1
    assert "Error" in capsys.readouterr().err


# ---------------------------------------------------------------------------
# (j) --issue with no origin remote -> clear error, fetch_issue not called
# ---------------------------------------------------------------------------


def test_issue_intake_without_origin_remote_errors(tmp_path, monkeypatch, capsys):
    _patch_subprocess_run(monkeypatch, has_origin=False)
    _patch_fetch_issue(monkeypatch, forbid=True)

    code = _run_main(monkeypatch, ["--issue", "42", "--working-dir", str(tmp_path)])

    assert code == 1
    err = capsys.readouterr().err
    assert "--issue requires the target repo to have a GitHub origin remote" in err


# --- PR #10 review nit: SSH origin must yield a clean owner/repo -------------


def test_issue_intake_with_ssh_origin_derives_owner_repo(tmp_path, adw_id, monkeypatch):
    _patch_subprocess_run(monkeypatch, has_origin=True,
                          origin_url="git@github.com:acme/widgets.git", launch_rc=1)
    fetch_calls = _patch_fetch_issue(monkeypatch, issue=_fake_issue())
    _patch_create_worktree(monkeypatch, _fake_worktree(adw_id, tmp_path))
    _patch_route_ticket(monkeypatch)

    code = _run_main(monkeypatch, ["--issue", "42", "--working-dir", str(tmp_path),
                                    "--adw-id", adw_id])

    assert code == 1  # child rc=1; intake itself must have succeeded
    assert fetch_calls == [("42", "acme/widgets")]


def test_issue_intake_with_unparseable_origin_errors_cleanly(tmp_path, monkeypatch, capsys):
    # No owner component -> extract_repo_path can't yield owner/repo.
    _patch_subprocess_run(monkeypatch, has_origin=True,
                          origin_url="git@github.com:widgets.git")
    _patch_fetch_issue(monkeypatch, forbid=True)

    code = _run_main(monkeypatch, ["--issue", "42", "--working-dir", str(tmp_path)])

    assert code == 1
    assert "could not derive a GitHub owner/repo" in capsys.readouterr().err


# ---------------------------------------------------------------------------
# (k) issue intake -> pipeline prompt text + draft_pr.start(issue_number=)
# ---------------------------------------------------------------------------


def test_issue_intake_builds_prompt_and_passes_issue_number(tmp_path, adw_id, monkeypatch):
    wt = _fake_worktree(adw_id, tmp_path)
    issue = _fake_issue(title="Fix login redirect", body="Users land on 404")
    _patch_fetch_issue(monkeypatch, issue=issue)
    _patch_create_worktree(monkeypatch, wt)
    _patch_remove_worktree(monkeypatch)
    calls = _patch_subprocess_run(monkeypatch, has_origin=True, launch_rc=0)
    pr_calls = _patch_draft_pr(monkeypatch)
    _write_state(adw_id, str(tmp_path), overall_success=True)

    code = _run_main(monkeypatch, ["--issue", "42", "--working-dir", str(tmp_path),
                                    "--route", "chore", "--adw-id", adw_id])

    assert code == 0
    launch_cmd = next(c for c in calls if c[0] == "uv")
    assert launch_cmd[3] == "Issue #42: Fix login redirect\n\nUsers land on 404"
    assert pr_calls["start"][0]["issue_number"] == "42"


# ---------------------------------------------------------------------------
# (l) --keep-worktree on success -> remove_feature_worktree NOT called
# ---------------------------------------------------------------------------


def test_keep_worktree_flag_skips_removal_on_success(tmp_path, adw_id, monkeypatch):
    wt = _fake_worktree(adw_id, tmp_path)
    _patch_create_worktree(monkeypatch, wt)
    remove_calls = _patch_remove_worktree(monkeypatch)
    _patch_subprocess_run(monkeypatch, launch_rc=0)
    _patch_draft_pr(monkeypatch)
    _write_state(adw_id, str(tmp_path), overall_success=True)

    code = _run_main(monkeypatch, ["ship it", "--working-dir", str(tmp_path), "--route", "chore",
                                    "--adw-id", adw_id, "--keep-worktree"])

    assert code == 0
    assert remove_calls == []


# ---------------------------------------------------------------------------
# (m) base_ref "HEAD" + source branch "main" -> base_branch "main"
# ---------------------------------------------------------------------------


def test_head_base_ref_resolves_source_branch(tmp_path, adw_id, monkeypatch):
    wt = _fake_worktree(adw_id, tmp_path, base_ref="HEAD")
    _patch_create_worktree(monkeypatch, wt)
    _patch_remove_worktree(monkeypatch)
    _patch_subprocess_run(monkeypatch, launch_rc=0, head_branch="main")
    pr_calls = _patch_draft_pr(monkeypatch)
    _write_state(adw_id, str(tmp_path), overall_success=True)

    code = _run_main(monkeypatch, ["ship it", "--working-dir", str(tmp_path), "--route", "chore",
                                    "--adw-id", adw_id])

    assert code == 0
    assert pr_calls["start"][0]["base_branch"] == "main"
