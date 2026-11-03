#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv", "fastapi", "httpx", "uvicorn", "schedule"]
# ///

"""Tests for the two ADW triggers: both hand an issue number to a travis_sdlc
Ticket run (worktree, risk gate), which exists, and neither starts anything
for an issue that is not Ready. The decisions live in ticket_launch and run
everywhere; the tests that load the trigger scripts themselves need fastapi
and schedule, and are skipped without them.

Usage:
    uv run pytest adws/adw_tests/test_triggers.py -q
"""

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from adw_triggers import ticket_launch  # noqa: E402


def _issue(number, *labels):
    return SimpleNamespace(number=number, labels=[SimpleNamespace(name=l) for l in labels])


def test_the_run_command_points_at_a_script_that_exists():
    cmd = ticket_launch.ticket_run_command(42)
    assert cmd[:2] == ["uv", "run"]
    assert Path(cmd[2]).is_file() and Path(cmd[2]).name == "travis_sdlc.py"
    assert cmd[3:] == ["42", "--worktree", "--risk-gate"]


def test_the_run_env_turns_the_risk_gate_on():
    assert ticket_launch.ticket_run_env()["ADW_RISK_GATE"] == "1"


@pytest.mark.parametrize("labels,expected", [
    (("ready-for-agent",), True),
    (("ready-for-agent", "bug"), True),
    (("ready-for-agent", "in-progress"), False),
    (("needs-triage",), False),
    ((), False),
])
def test_only_ready_unclaimed_issues_look_runnable(labels, expected):
    assert ticket_launch.looks_runnable(labels) is expected


def test_cron_picks_ready_issues_oldest_first_and_waits_before_a_retry():
    issues = [_issue(9, "ready-for-agent"), _issue(3, "ready-for-agent"),
              _issue(5, "needs-info"), _issue(7, "ready-for-agent", "in-progress"),
              _issue(4, "ready-for-agent")]
    now = 10_000.0
    attempts = {4: now - 30}
    assert ticket_launch.due_tickets(issues, attempts, now, 600) == [3, 9]
    attempts = {4: now - 600}
    assert ticket_launch.due_tickets(issues, attempts, now, 600) == [3, 4, 9]


def test_cron_starts_the_ticket_run(monkeypatch):
    pytest.importorskip("schedule")
    from adw_triggers import trigger_cron
    calls = []
    monkeypatch.setattr(trigger_cron.subprocess, "run",
                        lambda cmd, **kw: calls.append((cmd, kw)) or SimpleNamespace(returncode=0))
    assert trigger_cron.start_ticket_run(12) is True
    cmd, kw = calls[0]
    assert cmd == ticket_launch.ticket_run_command(12)
    assert kw["env"]["ADW_RISK_GATE"] == "1" and kw["cwd"] == ticket_launch.REPO_ROOT


def _labeled(name, number=17, event="issues", action="labeled"):
    return event, {"action": action, "label": {"name": name}, "issue": {"number": number}}


@pytest.mark.parametrize("event,payload,expected", [
    (*_labeled("ready-for-agent"), 17),
    (*_labeled("needs-triage"), None),
    (*_labeled("ready-for-agent", action="unlabeled"), None),
    (*_labeled("ready-for-agent", event="pull_request"), None),
    ("issues", {"action": "opened", "issue": {"number": 17, "body": "adw_plan_build_iso"}}, None),
    ("issue_comment", {"action": "created", "issue": {"number": 17},
                       "comment": {"body": "adw_sdlc_iso"}}, None),
    (*_labeled("ready-for-agent", number="17"), None),
])
def test_the_webhook_runs_only_an_issue_labelled_ready(event, payload, expected):
    assert ticket_launch.ticket_to_run(event, payload) == expected


def test_the_webhook_starts_the_ticket_run_in_the_background(monkeypatch):
    pytest.importorskip("fastapi")
    pytest.importorskip("httpx")
    pytest.importorskip("uvicorn")
    from fastapi.testclient import TestClient
    from adw_triggers import trigger_webhook

    started = []
    monkeypatch.setattr(trigger_webhook.subprocess, "Popen",
                        lambda cmd, **kw: started.append((cmd, kw)))
    client = TestClient(trigger_webhook.app)
    event, payload = _labeled("ready-for-agent", number=31)
    r = client.post("/gh-webhook", json=payload, headers={"X-GitHub-Event": event})
    assert r.json()["status"] == "accepted" and r.json()["issue"] == 31
    cmd, kw = started[0]
    assert cmd == ticket_launch.ticket_run_command(31)
    assert kw["start_new_session"] is True and kw["env"]["ADW_RISK_GATE"] == "1"

    event, payload = _labeled("wontfix")
    r = client.post("/gh-webhook", json=payload, headers={"X-GitHub-Event": event})
    assert r.json()["status"] == "ignored" and len(started) == 1
