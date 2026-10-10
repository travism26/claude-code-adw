#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv"]
# ///

"""Tests for draft_pr PR-body composition: the agent-written description
(2026-07-31, requested after PR #7's body was just a phase checklist) and its
fail-open fallback. _describe_run takes a prompt_fn seam so no test touches a
live agent.

Usage:
    uv run pytest adws/adw_tests/test_draft_pr_body.py -q
"""

import logging
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from adw_modules.draft_pr import DraftPRSession, _describe_run, _render_body  # noqa: E402

LOGGER = logging.getLogger("test_draft_pr_body")
GIT_ID = ["-c", "user.email=adw@test", "-c", "user.name=adw-test"]

DESCRIPTION = """## Overview
Adds the rolling backtest mode.

## Technical changes
- `src/widgets/backtest/rolling.py`: new engine
"""


def _session(working_dir: str = "/nonexistent") -> DraftPRSession:
    return DraftPRSession(
        working_dir=working_dir, adw_id="deadbeef", branch="adw/deadbeef",
        base_branch="main", title="ADW: specs/M2a.md",
        phases=[("Build", "ok"), ("Review", "ok")],
    )


def _repo_with_change(tmp_path: Path) -> Path:
    subprocess.run(["git", "init", "-q", "-b", "main"], cwd=tmp_path, check=True)
    (tmp_path / "a.py").write_text("x = 1\n")
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
    subprocess.run(["git", *GIT_ID, "commit", "-q", "-m", "root"], cwd=tmp_path, check=True)
    subprocess.run(["git", "checkout", "-q", "-b", "adw/deadbeef"], cwd=tmp_path, check=True)
    (tmp_path / "a.py").write_text("x = 2\n")
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
    subprocess.run(["git", *GIT_ID, "commit", "-q", "-m", "work"], cwd=tmp_path, check=True)
    return tmp_path


def test_body_without_description_keeps_checklist_shape():
    body = _render_body(_session(), footer="All phases completed.")
    assert "### Progress" in body and "<details>" not in body
    assert body.index("### Progress") < body.index("### Summary")


def test_body_with_description_leads_and_folds_provenance():
    body = _render_body(_session(), footer="All phases completed.", description=DESCRIPTION)
    assert body.index("## Overview") < body.index("<details>")
    assert "### Progress" in body and "### Summary" in body
    assert body.index("<details>") < body.index("### Progress")


def test_describe_run_happy_path_strips_to_overview(tmp_path):
    repo = _repo_with_change(tmp_path)
    seen = {}

    def fake_prompt(prompt, session):
        seen["prompt"] = prompt
        return "preamble to strip\n" + DESCRIPTION

    out = _describe_run(_session(str(repo)), LOGGER, prompt_fn=fake_prompt)
    assert out is not None and out.startswith("## Overview")
    assert "a.py" in seen["prompt"]  # diff actually reached the agent


def test_describe_run_returns_none_outside_git_repo(tmp_path):
    out = _describe_run(_session(str(tmp_path)), LOGGER,
                        prompt_fn=lambda p, s: DESCRIPTION)
    assert out is None


def test_describe_run_fails_open_on_agent_failure(tmp_path):
    repo = _repo_with_change(tmp_path)
    assert _describe_run(_session(str(repo)), LOGGER, prompt_fn=lambda p, s: None) is None
    assert _describe_run(_session(str(repo)), LOGGER,
                         prompt_fn=lambda p, s: "no overview header here") is None

    def raising(prompt, session):
        raise RuntimeError("boom")

    assert _describe_run(_session(str(repo)), LOGGER, prompt_fn=raising) is None


# ---- Ticket runs (#22): the PR closes its Ticket ---------------------------

def test_body_closes_the_ticket_during_and_after_the_run():
    session = _session()
    session.issue_number = "22"
    assert "Closes #22" in _render_body(session)
    assert "Closes #22" in _render_body(session, footer="done", description=DESCRIPTION)


def test_body_without_issue_has_no_closes_line():
    assert "Closes #" not in _render_body(_session())


def test_ticket_pr_opens_with_ticket_title_and_closes_line(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from adw_modules import draft_pr

    repo = _repo_with_change(tmp_path)
    subprocess.run(["git", "checkout", "-q", "main"], cwd=repo, check=True)
    calls = []

    def fake_gh(args):
        calls.append(args)
        if args[:2] == ["pr", "create"]:
            return SimpleNamespace(returncode=0, stderr="",
                                   stdout="https://github.com/acme/x/pull/9\n")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(draft_pr, "_gh", fake_gh)
    monkeypatch.setattr(draft_pr, "_remote_repo_path", lambda wd: "acme/x")
    monkeypatch.setattr(draft_pr, "_push", lambda s: True)

    draft_pr.start(str(repo), "tk000022", "Tracer: run a Ready Ticket end to end",
                   LOGGER, issue_number="22")
    create = next(a for a in calls if a[:2] == ["pr", "create"])
    assert create[create.index("--title") + 1] == "Tracer: run a Ready Ticket end to end"
    assert "Closes #22" in create[create.index("--body") + 1]


def test_body_carries_spec_warnings_during_and_after_the_run():
    session = _session()
    session.warnings = ["Spec travism26/x#19 is closed; this Ticket may have missed a reroute"]
    for body in (_render_body(session), _render_body(session, footer="done", description=DESCRIPTION)):
        assert "Spec travism26/x#19 is closed" in body


def test_body_without_warnings_has_no_warning_block():
    assert "⚠️" not in _render_body(_session())
