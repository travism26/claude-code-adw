#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv", "rich"]
# ///

"""Tests for the spec-review gate on a Ticket run (#26): the gate judges the Plan
against the Ticket's acceptance criteria, in both auto and human mode, while
legacy runs keep today's behaviour.

Usage:
    uv run pytest adws/adw_tests/test_spec_review_ticket.py -q
"""

import json
import logging
import sys
from pathlib import Path
from types import SimpleNamespace

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from adw_modules import spec_reviewer  # noqa: E402
from adw_modules.spec_reviewer import SpecVerdict, build_review_prompt  # noqa: E402
from adw_modules.ticket_resolver import Ticket  # noqa: E402
from travis import travis_sdlc  # noqa: E402

REPO = "travism26/claude-code-adw"
CRITERIA = "- [ ] The gate receives the criteria\n- [ ] Legacy runs are unchanged"
BODY = f"## What to build\n\nA gate.\n\n## Acceptance criteria\n\n{CRITERIA}\n\n## Blocked by\n\n- #22\n"
LOGGER = logging.getLogger("test_spec_review_ticket")


def _ticket(body=BODY):
    return Ticket(repo=REPO, number=26, title="The gate checks the Plan", body=body,
                  labels=("ready-for-agent",), url=f"https://github.com/{REPO}/issues/26")


class _State:
    def __init__(self):
        self.data = {}

    def get(self, key, default=None):
        return self.data.get(key, default)

    def update(self, **kw):
        self.data.update(kw)

    def save(self):
        pass


# ---- acceptance criteria on the Ticket -------------------------------------

def test_acceptance_criteria_is_the_section_up_to_the_next_heading():
    assert _ticket().acceptance_criteria == CRITERIA


def test_acceptance_criteria_is_none_without_the_section():
    assert _ticket("## What to build\n\nA gate.\n").acceptance_criteria is None


def test_acceptance_criteria_ignores_headings_inside_code_fences():
    body = "## Acceptance criteria\n\n- [ ] one\n```\n## not a heading\n```\n- [ ] two\n## Next\nx"
    assert _ticket(body).acceptance_criteria == "- [ ] one\n```\n## not a heading\n```\n- [ ] two"


def test_acceptance_criteria_matches_heading_case_insensitively():
    assert _ticket("### ACCEPTANCE CRITERIA:\n- [ ] a\n").acceptance_criteria == "- [ ] a"


def test_acceptance_criteria_matches_a_qualified_heading():
    assert _ticket("## Acceptance criteria (v1)\n- [ ] a\n").acceptance_criteria == "- [ ] a"


# ---- the auto critic's prompt ----------------------------------------------

def test_ticket_prompt_carries_the_ticket_and_its_criteria():
    prompt = build_review_prompt("# req", "specs/plan.md", "the plan", ticket=_ticket())
    assert f"{REPO}#26" in prompt
    assert CRITERIA in prompt
    assert "the plan" in prompt
    # A Plan that drops a criterion must not be approved.
    assert "must not approve" in prompt.lower()


def test_ticket_prompt_without_a_criteria_section_says_so():
    prompt = build_review_prompt("# req", "specs/plan.md", "the plan",
                                 ticket=_ticket("## What to build\n\nA gate.\n"))
    assert "no acceptance criteria section" in prompt.lower()


def test_legacy_prompt_is_unchanged():
    prompt = build_review_prompt("the request", "specs/plan.md", "the plan")
    assert prompt == spec_reviewer._REVIEW_PROMPT.format(
        prompt="the request", spec_path="specs/plan.md", spec="the plan")


def test_review_spec_sends_the_ticket_prompt_to_the_critic(tmp_path, monkeypatch):
    (tmp_path / "plan.md").write_text("the plan")
    seen = {}

    def fake_prompt(req):
        seen["prompt"] = req.prompt
        return SimpleNamespace(output='{"verdict": "revise", "concerns": ["c"], "summary": "s"}')

    monkeypatch.setattr(spec_reviewer, "prompt_claude_code", fake_prompt)
    monkeypatch.setattr(spec_reviewer, "HARNESS_ROOT", tmp_path)
    verdict = spec_reviewer.review_spec("abc", "plan.md", "# req", str(tmp_path), ticket=_ticket())
    assert verdict.verdict == "revise"
    assert CRITERIA in seen["prompt"]


# ---- auto mode -------------------------------------------------------------

def _patch_auto(monkeypatch, verdict="approve"):
    calls = []

    def fake_review(adw_id, plan_file, prompt, working_dir, ticket=None):
        calls.append(ticket)
        return SpecVerdict(verdict=verdict, concerns=["missing criterion"], summary="s")

    state = _State()
    monkeypatch.setattr(spec_reviewer, "review_spec", fake_review)
    monkeypatch.setattr(travis_sdlc.TravisState, "load", staticmethod(lambda _id: state))
    return calls, state


def test_auto_gate_passes_the_ticket_to_the_critic(monkeypatch):
    calls, _ = _patch_auto(monkeypatch)
    ticket = _ticket()
    ok, _ = travis_sdlc.auto_review_spec("abc", "plan.md", "# req", ".", LOGGER, ticket=ticket)
    assert ok and calls == [ticket]


def test_auto_gate_on_a_legacy_run_passes_no_ticket(monkeypatch):
    calls, _ = _patch_auto(monkeypatch)
    ok, _ = travis_sdlc.auto_review_spec("abc", "plan.md", "req", ".", LOGGER)
    assert ok and calls == [None]


def test_auto_gate_fails_on_reject_and_records_the_ticket(monkeypatch):
    _, state = _patch_auto(monkeypatch, verdict="reject")
    ok, msg = travis_sdlc.auto_review_spec("abc", "plan.md", "# req", ".", LOGGER, ticket=_ticket())
    assert not ok and "missing criterion" in msg
    assert state.data["spec_review"]["ticket_ref"] == f"{REPO}#26"


# ---- human mode ------------------------------------------------------------

def _pause(monkeypatch, tmp_path, ticket=None, state=None):
    state = state or _State()
    monkeypatch.setattr(travis_sdlc.TravisState, "load", staticmethod(lambda _id: state))
    monkeypatch.setattr(travis_sdlc, "_spec_review_dir", lambda _id: tmp_path)
    travis_sdlc.pause_for_spec_review("abc", "specs/plan.md", "26", LOGGER, ticket=ticket)
    return json.loads((tmp_path / "spec_review.json").read_text())


def test_human_review_file_includes_the_ticket_and_its_criteria(monkeypatch, tmp_path):
    state = _State()
    pointer = _pause(monkeypatch, tmp_path, ticket=_ticket(), state=state)
    assert state.data["spec_review"]["ticket_ref"] == f"{REPO}#26"
    assert pointer["ticket_ref"] == f"{REPO}#26"
    assert pointer["ticket_url"] == f"https://github.com/{REPO}/issues/26"
    assert pointer["acceptance_criteria"] == CRITERIA
    assert "acceptance criteria" in pointer["instructions"].lower()


def test_human_review_file_on_a_legacy_run_is_unchanged(monkeypatch, tmp_path):
    pointer = _pause(monkeypatch, tmp_path)
    assert set(pointer) == {"adw_id", "spec_file", "status", "resume_command", "instructions"}
