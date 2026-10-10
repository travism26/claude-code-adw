#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic"]
# ///

"""Tests for pipelines/router.py (docs/slim-pipelines-plan.md §9, factory
Router agent — catalog #1).

Usage:
    uv run pytest adws/adw_tests/test_router.py -q

Credential-free (no Claude calls, no network): `pipelines.router.prompt_claude_code`
is monkeypatched with a fake that records every AgentPromptRequest it was called
with (into `calls`) and returns pre-scripted AgentPromptResponse objects in order,
so tests can assert call counts, prompt contents, and the fail-closed / one-retry
contract without ever invoking the real CLI.

Covers the 8 scenarios from the brief:
  (a) clean JSON -> verdict fields returned; prompt carries title/body/labels;
      output_file lands under agents/<adw_id>/router/.
  (b) JSON wrapped in a ```json fence -> parsed (parse_json handles fences).
  (c) garbage first response, valid second -> exactly 2 calls; second prompt
      carries the parse-failure hint; verdict returned.
  (d) garbage twice -> RouterError; exactly 2 calls (bounded retry).
  (e) resp.success=False -> RouterError after exactly 1 call (no retry).
  (f) {"route": "hotfix", ...} twice -> ValidationError path both times ->
      RouterError (the enum is closed, no third try).
  (g) 100k-char body -> the prompt actually sent is bounded (< 20_000 chars).
  (h) confidence 1.5 (out of [0,1]) on the first response, valid on the
      retry -> demonstrates a schema ValidationError (not just a JSON parse
      failure) also drives the same one-retry path, and can recover.
"""

import json
import shutil
import sys
import uuid
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

import pipelines.router as router  # noqa: E402
from adw_modules.agent import AgentPromptResponse  # noqa: E402


@pytest.fixture
def adw_id():
    """A unique adw_id per test, with agents/<adw_id> cleaned up afterward
    (mirrors test_pipe_feature_bug.py's fixture)."""
    generated = f"test-router-{uuid.uuid4().hex[:8]}"
    yield generated
    state_dir = REPO_ROOT / "agents" / generated
    if state_dir.exists():
        shutil.rmtree(state_dir)


TICKET = {
    "title": "Login redirect goes to the wrong page",
    "body": "After logging in, users land on /404 instead of /dashboard.",
    "labels": ["bug", "urgent"],
}


def _fake_agent(calls: list, responses: list):
    """Records each AgentPromptRequest into `calls`; returns `responses` in
    call order. Raises if called more times than there are responses."""

    def fn(req):
        calls.append(req)
        return responses[len(calls) - 1]

    return fn


def _verdict_json(route: str = "bug", confidence: float = 0.8, reason: str = "repro-first fix") -> str:
    return json.dumps({"route": route, "confidence": confidence, "reason": reason})


# (a) clean JSON response -----------------------------------------------------


def test_clean_json_response(tmp_path, adw_id, monkeypatch):
    calls: list = []
    resp = AgentPromptResponse(output=_verdict_json(), success=True)
    monkeypatch.setattr(router, "prompt_claude_code", _fake_agent(calls, [resp]))

    verdict = router.route_ticket(TICKET, adw_id, str(tmp_path))

    assert verdict.route == "bug"
    assert verdict.confidence == 0.8
    assert verdict.reason == "repro-first fix"
    assert len(calls) == 1

    prompt = calls[0].prompt
    assert TICKET["title"] in prompt
    assert TICKET["body"] in prompt
    assert "urgent" in prompt

    expected_out = str(REPO_ROOT / "agents" / adw_id / "router" / "router.jsonl")
    assert calls[0].output_file == expected_out


# (b) JSON wrapped in a ```json fence -----------------------------------------


def test_json_fence_is_parsed(tmp_path, adw_id, monkeypatch):
    calls: list = []
    fenced = f"```json\n{_verdict_json(route='feature', confidence=0.6, reason='new capability')}\n```"
    resp = AgentPromptResponse(output=fenced, success=True)
    monkeypatch.setattr(router, "prompt_claude_code", _fake_agent(calls, [resp]))

    verdict = router.route_ticket(TICKET, adw_id, str(tmp_path))

    assert verdict.route == "feature"
    assert verdict.confidence == 0.6
    assert len(calls) == 1


# (c) garbage first, valid second ---------------------------------------------


def test_garbage_then_valid_retries_once(tmp_path, adw_id, monkeypatch):
    calls: list = []
    responses = [
        AgentPromptResponse(output="not json at all, sorry", success=True),
        AgentPromptResponse(output=_verdict_json(route="chore", confidence=0.7, reason="doc fix"), success=True),
    ]
    monkeypatch.setattr(router, "prompt_claude_code", _fake_agent(calls, responses))

    verdict = router.route_ticket(TICKET, adw_id, str(tmp_path))

    assert verdict.route == "chore"
    assert len(calls) == 2
    assert "could not be parsed" in calls[1].prompt
    assert TICKET["title"] in calls[1].prompt  # original prompt preserved, hint appended


# (d) garbage twice -> RouterError, exactly 2 calls ----------------------------


def test_garbage_twice_raises_router_error_bounded(tmp_path, adw_id, monkeypatch):
    calls: list = []
    responses = [
        AgentPromptResponse(output="still not json", success=True),
        AgentPromptResponse(output="nope, still not json", success=True),
    ]
    monkeypatch.setattr(router, "prompt_claude_code", _fake_agent(calls, responses))

    with pytest.raises(router.RouterError):
        router.route_ticket(TICKET, adw_id, str(tmp_path))

    assert len(calls) == 2


# (e) agent failure -> RouterError after exactly 1 call, no retry -------------


def test_agent_failure_raises_immediately_no_retry(tmp_path, adw_id, monkeypatch):
    calls: list = []
    responses = [AgentPromptResponse(output="transport error", success=False)]
    monkeypatch.setattr(router, "prompt_claude_code", _fake_agent(calls, responses))

    with pytest.raises(router.RouterError):
        router.route_ticket(TICKET, adw_id, str(tmp_path))

    assert len(calls) == 1


# (f) hotfix twice -> closed enum -> RouterError -------------------------------


def test_hotfix_route_rejected_by_closed_enum(tmp_path, adw_id, monkeypatch):
    calls: list = []
    hotfix_json = json.dumps({"route": "hotfix", "confidence": 0.9, "reason": "prod is down"})
    responses = [
        AgentPromptResponse(output=hotfix_json, success=True),
        AgentPromptResponse(output=hotfix_json, success=True),
    ]
    monkeypatch.setattr(router, "prompt_claude_code", _fake_agent(calls, responses))

    with pytest.raises(router.RouterError):
        router.route_ticket(TICKET, adw_id, str(tmp_path))

    assert len(calls) == 2


# (g) 100k-char body -> bounded prompt -----------------------------------------


def test_huge_body_is_truncated_in_prompt(tmp_path, adw_id, monkeypatch):
    calls: list = []
    resp = AgentPromptResponse(output=_verdict_json(), success=True)
    monkeypatch.setattr(router, "prompt_claude_code", _fake_agent(calls, [resp]))

    huge_ticket = {"title": "huge ticket", "body": "x" * 100_000, "labels": []}
    router.route_ticket(huge_ticket, adw_id, str(tmp_path))

    assert len(calls) == 1
    assert len(calls[0].prompt) < 20_000


# (h) confidence 1.5 -> validation failure -> retry -> recovers ---------------


def test_out_of_range_confidence_triggers_validation_retry(tmp_path, adw_id, monkeypatch):
    calls: list = []
    bad_confidence = json.dumps({"route": "bug", "confidence": 1.5, "reason": "overconfident"})
    responses = [
        AgentPromptResponse(output=bad_confidence, success=True),
        AgentPromptResponse(output=_verdict_json(route="bug", confidence=0.4, reason="fixed"), success=True),
    ]
    monkeypatch.setattr(router, "prompt_claude_code", _fake_agent(calls, responses))

    verdict = router.route_ticket(TICKET, adw_id, str(tmp_path))

    assert verdict.confidence == 0.4
    assert len(calls) == 2
    assert "could not be parsed" in calls[1].prompt
