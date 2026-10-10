#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv", "rich"]
# ///

"""Tests for reviewing a Ticket run against the Review oracle (#25): two-axis
findings map onto the existing review result, only blockers keep the draft PR
in draft, the axes are reported separately, the Plan never reaches review, and
legacy runs keep /review. The agent call is the only thing faked.

Usage:
    uv run pytest adws/adw_tests/test_ticket_review.py -q
"""

import json
import logging
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from adw_modules import ticket_review  # noqa: E402
from adw_modules.ticket_review import review_from_findings  # noqa: E402
from travis import travis_review, travis_sdlc  # noqa: E402

REPO = "travism26/claude-code-adw"
TICKET_REF = f"{REPO}#25"
SPEC_REF = f"{REPO}#19"
PLAN = "specs/issue-25-adw-deadbeef-review-oracle.md"
LOGGER = logging.getLogger("test_ticket_review")


def _findings(spec=(), standards=(), spec_summary="Spec looks done.",
              standards_summary="Standards look fine."):
    return {
        "spec_summary": spec_summary,
        "standards_summary": standards_summary,
        "spec_findings": [{"kind": k, "description": f"{k} found",
                           "resolution": f"fix {k}"} for k in spec],
        "standards_findings": [{"kind": k, "description": f"{k} found",
                                "resolution": f"fix {k}"} for k in standards],
    }


def _review(spec=(), standards=(), spec_ref=SPEC_REF):
    return review_from_findings(_findings(spec, standards), spec_ref)


def _ready(review) -> bool:
    phase = travis_review.review_phase_result(review.result, None)
    return travis_sdlc.pr_ready_after_run(True, phase)


class _State:
    def __init__(self, **data):
        self.data = {"plan_file": PLAN, "ticket_ref": None, "spec_ref": None, **data}

    def get(self, key, default=None):
        return self.data.get(key, default)


# ---- the verdict mapping (one row of the table each) -----------------------

@pytest.mark.parametrize("axis,kind,severity", [
    ("spec", "missing_requirement", "blocker"),
    ("spec", "implemented_wrongly", "blocker"),
    ("spec", "scope_creep", "tech_debt"),
    ("standards", "repo_standard", "tech_debt"),
    ("standards", "baseline_smell", "skippable"),
])
def test_each_finding_maps_to_its_severity(axis, kind, severity):
    review = _review(**{axis: [kind]})
    assert [i.issue_severity for i in review.result.review_issues] == [severity]
    assert review.result.success is (severity != "blocker")


@pytest.mark.parametrize("axis,kind,ready", [
    ("spec", "missing_requirement", False),
    ("spec", "implemented_wrongly", False),
    ("spec", "scope_creep", True),
    ("standards", "repo_standard", True),
    ("standards", "baseline_smell", True),
])
def test_only_blockers_keep_the_draft_pr_in_draft(axis, kind, ready):
    assert _ready(_review(**{axis: [kind]})) is ready


def test_a_clean_review_marks_the_pr_ready():
    review = _review()
    assert review.result.success is True
    assert review.result.review_issues == []
    assert _ready(review) is True


def test_one_blocker_among_many_findings_keeps_the_pr_in_draft():
    review = _review(spec=["scope_creep", "missing_requirement"],
                     standards=["repo_standard", "baseline_smell"])
    assert _ready(review) is False
    assert [i.review_issue_number for i in review.result.review_issues] == [1, 2, 3, 4]


def test_unknown_finding_kinds_are_rejected():
    with pytest.raises(Exception):
        review_from_findings(_findings(spec=["nitpick"]), SPEC_REF)


# ---- separate axes in the review output ------------------------------------

def test_axes_are_separate_sections_in_the_review_issues_file(tmp_path):
    review = _review(spec=["missing_requirement"], standards=["baseline_smell"])
    path = travis_review.create_review_issues_file(
        review.result, PLAN, "deadbeef", LOGGER, str(tmp_path), ticket_review=review)
    text = Path(path).read_text()
    spec_at, standards_at = text.index("## Spec axis"), text.index("## Standards axis")
    assert spec_at < text.index("missing_requirement found") < standards_at
    assert standards_at < text.index("baseline_smell found")


def test_axes_are_separate_sections_in_the_printed_summary():
    review = _review(spec=["scope_creep"], standards=["repo_standard"])
    summary = travis_review.format_review_summary(review.result, ticket_review=review)
    spec_at, standards_at = summary.index("Spec axis"), summary.index("Standards axis")
    assert spec_at < summary.index("scope_creep found") < standards_at
    assert standards_at < summary.index("repo_standard found")


def test_an_axis_without_findings_still_gets_its_section(tmp_path):
    review = _review(standards=["baseline_smell"])
    path = travis_review.create_review_issues_file(
        review.result, PLAN, "deadbeef", LOGGER, str(tmp_path), ticket_review=review)
    text = Path(path).read_text()
    assert "## Spec axis" in text and "Spec looks done." in text


def test_review_summary_carries_both_axes():
    summary = _review().result.review_summary
    assert "Spec looks done." in summary and "Standards look fine." in summary


# ---- the review result and issues file keep their shape --------------------

def test_review_issues_file_keeps_its_shape_for_travis_patch(tmp_path):
    review = _review(spec=["missing_requirement"], standards=["baseline_smell"])
    path = travis_review.create_review_issues_file(
        review.result, PLAN, "deadbeef", LOGGER, str(tmp_path), ticket_review=review)
    assert path == str(tmp_path / "specs" / "review_issues" / "review-deadbeef.md")
    text = Path(path).read_text()
    assert text.startswith("# Review Issues - deadbeef")
    assert "**Status:** FAILED" in text
    assert "## Issues Found: 2" in text
    assert "### Issue #1: blocker" in text and "### Issue #2: skippable" in text
    assert "**Resolution:**\nfix missing_requirement" in text


def test_the_phase_result_keeps_its_shape():
    review = _review(spec=["implemented_wrongly"])
    phase = travis_review.review_phase_result(review.result, "specs/review_issues/x.md")
    assert set(phase) == {"success", "summary", "issue_count", "issues",
                          "screenshots", "review_issues_file"}
    assert phase["success"] is False and phase["issue_count"] == 1
    assert phase["issues"][0]["severity"] == "blocker"


def test_no_findings_means_no_review_issues_file(tmp_path):
    review = _review()
    assert travis_review.create_review_issues_file(
        review.result, PLAN, "deadbeef", LOGGER, str(tmp_path), ticket_review=review) is None


# ---- no Spec -----------------------------------------------------------------

def test_without_a_spec_the_review_says_it_used_the_ticket_alone(tmp_path):
    review = _review(spec=["scope_creep"], spec_ref=None)
    assert "Ticket alone" in review.result.review_summary
    path = travis_review.create_review_issues_file(
        review.result, PLAN, "deadbeef", LOGGER, str(tmp_path), ticket_review=review)
    spec_section = Path(path).read_text().split("## Standards axis")[0]
    assert "Ticket alone" in spec_section.split("## Spec axis")[1]


def test_with_a_spec_the_review_does_not_claim_the_ticket_alone():
    assert "Ticket alone" not in _review(spec_ref=SPEC_REF).result.review_summary


# ---- which review runs, and what it is handed --------------------------------

@pytest.fixture
def agent_calls(monkeypatch, tmp_path):
    """Fake both agent entry points; record every request."""
    calls = {"prompt": [], "template": []}

    def fake_prompt(req):
        calls["prompt"].append(req)
        return SimpleNamespace(success=True, output=json.dumps(_findings()))

    def fake_template(req):
        calls["template"].append(req)
        return SimpleNamespace(success=True, output=json.dumps(
            {"success": True, "review_summary": "legacy ok", "review_issues": []}))

    monkeypatch.setattr(ticket_review, "prompt_claude_code", fake_prompt)
    monkeypatch.setattr(ticket_review, "HARNESS_ROOT", tmp_path)
    monkeypatch.setattr(travis_review, "execute_template", fake_template)
    return calls


def test_a_ticket_run_is_reviewed_against_the_ticket_and_spec(agent_calls, tmp_path):
    state = _State(ticket_ref=TICKET_REF, spec_ref=SPEC_REF)
    review, axes = travis_review.review_for_state(
        state, "deadbeef", LOGGER, str(tmp_path), "origin/feature-base")
    assert axes is not None and review.success is True
    assert agent_calls["template"] == []
    prompt = agent_calls["prompt"][0].prompt
    assert TICKET_REF in prompt and SPEC_REF in prompt and "origin/feature-base" in prompt


def test_a_ticket_run_never_passes_the_plan_to_review(agent_calls, tmp_path):
    state = _State(ticket_ref=TICKET_REF, spec_ref=SPEC_REF)
    travis_review.review_for_state(state, "deadbeef", LOGGER, str(tmp_path), "origin/main")
    prompt = agent_calls["prompt"][0].prompt
    assert PLAN not in prompt and "issue-25-adw-deadbeef" not in prompt


def test_a_ticket_run_without_a_spec_reviews_against_the_ticket(agent_calls, tmp_path):
    state = _State(ticket_ref=TICKET_REF, spec_ref=None)
    review, axes = travis_review.review_for_state(
        state, "deadbeef", LOGGER, str(tmp_path), "origin/main")
    assert TICKET_REF in agent_calls["prompt"][0].prompt
    assert "Ticket alone" in review.review_summary


def test_a_legacy_run_keeps_the_existing_review(agent_calls, tmp_path):
    review, axes = travis_review.review_for_state(
        _State(), "deadbeef", LOGGER, str(tmp_path), "origin/main")
    assert axes is None and review.review_summary == "legacy ok"
    assert agent_calls["prompt"] == []
    request = agent_calls["template"][0]
    assert request.slash_command == "/review" and PLAN in request.args


def test_unparseable_findings_fail_the_review(monkeypatch, tmp_path):
    monkeypatch.setattr(ticket_review, "prompt_claude_code",
                        lambda req: SimpleNamespace(success=True, output="not json"))
    monkeypatch.setattr(ticket_review, "HARNESS_ROOT", tmp_path)
    state = _State(ticket_ref=TICKET_REF, spec_ref=SPEC_REF)
    with pytest.raises(ValueError):
        travis_review.review_for_state(state, "deadbeef", LOGGER, str(tmp_path), "origin/main")


# ---- the diff base review compares against ----------------------------------

def test_an_unset_diff_base_follows_the_worktree_base():
    wt = SimpleNamespace(base_ref="origin/release-2")
    assert travis_sdlc.run_diff_base(None, wt) == "origin/release-2"


def test_an_explicit_diff_base_beats_the_worktree_base():
    wt = SimpleNamespace(base_ref="origin/release-2")
    assert travis_sdlc.run_diff_base("HEAD~3", wt) == "HEAD~3"


def test_without_a_worktree_the_diff_base_defaults_to_origin_main():
    assert travis_sdlc.run_diff_base(None, None) == "origin/main"


def _git_repo_with_commit(path):
    import subprocess
    run = lambda *a: subprocess.run(["git", "-C", str(path), *a],
                                    check=True, capture_output=True, text=True)
    run("init", "-q")
    run("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q",
        "--allow-empty", "-m", "base")
    return run


def test_a_head_worktree_base_is_pinned_to_the_commit_it_was_cut_from(tmp_path):
    # No origin/main: the worktree is cut from HEAD. Inside the worktree "HEAD"
    # is the run's own tip, so an unpinned base would diff the run against itself.
    run = _git_repo_with_commit(tmp_path)
    base_sha = run("rev-parse", "HEAD").stdout.strip()
    wt = SimpleNamespace(base_ref="HEAD", source_repo=str(tmp_path))
    assert travis_sdlc.run_diff_base(None, wt) == base_sha


def test_a_resumed_run_keeps_the_diff_base_it_recorded(tmp_path):
    run = _git_repo_with_commit(tmp_path)
    recorded = run("rev-parse", "HEAD").stdout.strip()
    run("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q",
        "--allow-empty", "-m", "source moved on")
    wt = SimpleNamespace(base_ref="HEAD", source_repo=str(tmp_path))
    assert travis_sdlc.run_diff_base(None, wt, recorded=recorded) == recorded


def test_an_explicit_diff_base_beats_a_recorded_one():
    wt = SimpleNamespace(base_ref="origin/main")
    assert travis_sdlc.run_diff_base("HEAD~3", wt, recorded="abc123") == "HEAD~3"


def test_review_uses_the_diff_base_the_run_recorded():
    state = _State(diff_base="origin/release-2")
    assert travis_review.diff_base_for(state, None) == "origin/release-2"
    assert travis_review.diff_base_for(state, "HEAD~1") == "HEAD~1"
    assert travis_review.diff_base_for(_State(), None) == "origin/main"


def test_patch_re_review_passes_the_runs_diff_base():
    from travis import travis_patch
    args = travis_patch.review_args("deadbeef", _State(diff_base="origin/release-2"))
    assert args == ["deadbeef", "--diff-base", "origin/release-2"]


def test_patch_re_review_of_a_run_without_a_recorded_diff_base():
    from travis import travis_patch
    assert travis_patch.review_args("deadbeef", _State()) == ["deadbeef"]


# ---- the review-issues file shape ------------------------------------------

def _legacy_review():
    from adw_modules.data_types import ReviewIssue, ReviewResult
    return ReviewResult(success=False, review_summary="Two problems.", review_issues=[
        ReviewIssue(review_issue_number=1, screenshot_path="a.py:3",
                    issue_description="broken", issue_resolution="fix it",
                    issue_severity="blocker"),
        ReviewIssue(review_issue_number=2, screenshot_path=None,
                    issue_description="ugly", issue_resolution="tidy it",
                    issue_severity="skippable"),
    ])


def test_a_legacy_review_issues_file_keeps_its_original_layout(tmp_path):
    import re
    path = travis_review.create_review_issues_file(
        _legacy_review(), PLAN, "deadbeef", LOGGER, str(tmp_path))
    text = re.sub(r"\*\*Review Date:\*\* .*", "**Review Date:** DATE",
                  Path(path).read_text())
    assert text == "\n".join([
        "# Review Issues - deadbeef", "",
        f"**Spec File:** {PLAN}",
        "**Review Date:** DATE",
        "**Status:** FAILED", "",
        "## Summary", "", "Two problems.", "",
        "## Issues Found: 2", "",
        "### Issue #1: blocker", "", "**File:** a.py:3", "",
        "**Description:**", "broken", "", "**Resolution:**", "fix it", "", "---", "",
        "### Issue #2: skippable", "", "**File:** N/A", "",
        "**Description:**", "ugly", "", "**Resolution:**", "tidy it", "", "---", "",
    ])


def test_ticket_review_issue_entries_stay_parseable_for_travis_patch(tmp_path):
    import re
    review = _review(spec=["missing_requirement", "scope_creep"], standards=["baseline_smell"])
    path = travis_review.create_review_issues_file(
        review.result, PLAN, "deadbeef", LOGGER, str(tmp_path), ticket_review=review)
    entries = re.findall(r"^### Issue #(\d+): (\w+)$", Path(path).read_text(), re.M)
    assert entries == [("1", "blocker"), ("2", "tech_debt"), ("3", "skippable")]


def test_the_prompt_uses_the_glossary_and_reads_the_spec_issue():
    prompt = ticket_review.build_ticket_review_prompt(TICKET_REF, SPEC_REF, "origin/main")
    assert "spec file" not in prompt.lower()
    assert f"gh issue view 19 --repo {REPO}" in prompt
    assert prompt.count("only to flag scope creep") == 1
    file_prompt = ticket_review.build_ticket_review_prompt(TICKET_REF, "docs/spec.md", "origin/main")
    assert "`docs/spec.md`" in file_prompt and "only to flag scope creep" in file_prompt
    no_spec = ticket_review.build_ticket_review_prompt(TICKET_REF, None, "origin/main")
    assert "Ticket alone" in no_spec and "only to flag scope creep" not in no_spec
