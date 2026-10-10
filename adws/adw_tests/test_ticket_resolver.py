#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv"]
# ///

"""Tests for the Ticket resolver (#22). A fake GitHub client stands in for gh,
so no test touches the network.

Usage:
    uv run pytest adws/adw_tests/test_ticket_resolver.py -q
"""

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from adw_modules import ticket_resolver  # noqa: E402
from adw_modules.ticket_resolver import (  # noqa: E402
    IN_PROGRESS_LABEL, GhClient, Refusal, SpecResolution, Ticket, claim_ticket, plan_type_for,
    post_run_comment, resolve_spec, resolve_ticket,
)

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "tickets"
REPO = "travism26/claude-code-adw"


def _issue(number=22, labels=("ready-for-agent",), title="Tracer: run a Ready Ticket",
           body="## What to build\n\nThe tracer bullet."):
    return {
        "number": number, "title": title, "body": body,
        "labels": [{"name": l} for l in labels],
        "url": f"https://github.com/{REPO}/issues/{number}",
        "comments": [{"body": "a comment that must never reach the Ticket"}],
    }


class FakeGitHub:
    def __init__(self, issues=None, origin=REPO, blocked_by=None, parents=None):
        self.issues = issues or {}
        self.origin = origin
        self.blocked = blocked_by or {}
        self.parents = parents or {}
        self.calls = []
        self.comments = []
        self.labels_ensured = []
        self.labels_added = []
        self.label_writes_fail = False

    def ensure_label(self, repo, name, description, color):
        self.labels_ensured.append((repo, name))
        return not self.label_writes_fail

    def add_label(self, repo, number, name):
        self.labels_added.append((repo, number, name))
        return not self.label_writes_fail

    def parent_issue(self, repo, number):
        self.calls.append(("parent_issue", repo, number))
        return self.parents.get((repo, number))

    def origin_repo(self, working_dir):
        self.calls.append(("origin_repo", working_dir))
        return self.origin

    def get_issue(self, repo, number):
        self.calls.append(("get_issue", repo, number))
        return self.issues.get((repo, number))

    def blocked_by(self, repo, number):
        self.calls.append(("blocked_by", repo, number))
        return self.blocked.get((repo, number), [])

    def comment(self, repo, number, body):
        self.comments.append((repo, number, body))
        return True


@pytest.mark.parametrize("ref", [
    f"https://github.com/{REPO}/issues/22",
    f"{REPO}#22",
    "22",
    "#22",
])
def test_every_reference_form_resolves_to_the_same_ticket(ref):
    gh = FakeGitHub({(REPO, 22): _issue()})
    ticket = resolve_ticket(ref, "/wd", client=gh)
    assert isinstance(ticket, Ticket)
    assert (ticket.repo, ticket.number, ticket.ref) == (REPO, 22, f"{REPO}#22")
    assert ticket.title == "Tracer: run a Ready Ticket"


def test_repo_mismatch_is_refused_before_fetching():
    gh = FakeGitHub({("someone/else", 5): _issue(5)})
    out = resolve_ticket("someone/else#5", "/wd", client=gh)
    assert isinstance(out, Refusal) and out.reason == "repo_mismatch"
    assert REPO in out.message
    assert not any(c[0] == "get_issue" for c in gh.calls)


def test_url_for_another_repo_is_refused():
    out = resolve_ticket("https://github.com/someone/else/issues/5", "/wd", client=FakeGitHub())
    assert isinstance(out, Refusal) and out.reason == "repo_mismatch"


def test_no_origin_is_refused():
    out = resolve_ticket("#22", "/wd", client=FakeGitHub(origin=None))
    assert isinstance(out, Refusal) and out.reason == "no_origin"


def test_garbage_reference_is_refused():
    out = resolve_ticket("specs/foo.md", "/wd", client=FakeGitHub())
    assert isinstance(out, Refusal) and out.reason == "bad_reference"


def test_missing_issue_is_refused():
    out = resolve_ticket("#99", "/wd", client=FakeGitHub())
    assert isinstance(out, Refusal) and out.reason == "not_found"


def test_ready_for_human_ticket_is_refused_naming_its_labels():
    gh = FakeGitHub({(REPO, 7): _issue(7, labels=("ready-for-human", "bug"))})
    out = resolve_ticket("#7", "/wd", client=gh)
    assert isinstance(out, Refusal) and out.reason == "not_ready"
    assert out.labels == ("ready-for-human", "bug")
    assert "ready-for-human" in out.message and "bug" in out.message


def test_epic_147_is_refused():
    fixture = json.loads((FIXTURES / "acme_widgets_147.json").read_text())
    gh = FakeGitHub({("acme/widgets", 147): fixture}, origin="acme/widgets")
    out = resolve_ticket("https://github.com/acme/widgets/issues/147", "/wd", client=gh)
    assert isinstance(out, Refusal) and out.reason == "not_ready"
    assert "ready-for-human" in out.labels and "epic" in out.labels


def test_ticket_excludes_comments():
    ticket = resolve_ticket("#22", "/wd", client=FakeGitHub({(REPO, 22): _issue()}))
    assert "comment" not in ticket.as_plan_input()
    assert not hasattr(ticket, "comments")
    assert ticket.as_plan_input().startswith("# Tracer: run a Ready Ticket\n\n## What to build")


def _ticket(labels=("ready-for-agent",), title="Add a thing"):
    return Ticket(repo=REPO, number=1, title=title, body="", labels=labels, url="u")


def test_plan_type_flag_beats_label_and_keywords():
    t = _ticket(labels=("ready-for-agent", "bug"), title="fix the crash")
    assert plan_type_for(t, "chore", detect=lambda s: "feature") == "chore"


def test_plan_type_label_beats_keywords():
    t = _ticket(labels=("ready-for-agent", "chore"), title="fix the crash")
    assert plan_type_for(t, None, detect=lambda s: "bug") == "chore"


def test_plan_type_falls_back_to_keyword_detection_on_ticket_text():
    seen = {}

    def detect(text):
        seen["text"] = text
        return "bug"

    assert plan_type_for(_ticket(title="fix the crash"), None, detect=detect) == "bug"
    assert "fix the crash" in seen["text"]


def test_run_comment_posts_once_with_pr_link_and_run_id():
    gh = FakeGitHub()
    ok = post_run_comment(_ticket(), "https://github.com/x/y/pull/9", "abc12345", client=gh)
    assert ok and len(gh.comments) == 1
    repo, number, body = gh.comments[0]
    assert (repo, number) == (REPO, 1)
    assert "https://github.com/x/y/pull/9" in body and "abc12345" in body


# --- In progress (#30) -----------------------------------------------------

def test_in_progress_ticket_is_refused_on_a_fresh_run():
    gh = FakeGitHub({(REPO, 30): _issue(30, labels=("ready-for-agent", IN_PROGRESS_LABEL))})
    out = resolve_ticket("#30", "/wd", client=gh)
    assert isinstance(out, Refusal) and out.reason == "in_progress"
    assert IN_PROGRESS_LABEL in out.labels
    assert f"{REPO}#30" in out.message and IN_PROGRESS_LABEL in out.message


def test_in_progress_ticket_resolves_when_resuming_the_run_that_claimed_it():
    gh = FakeGitHub({(REPO, 30): _issue(30, labels=("ready-for-agent", IN_PROGRESS_LABEL))})
    ticket = resolve_ticket("#30", "/wd", client=gh, resuming=True)
    assert isinstance(ticket, Ticket) and ticket.number == 30


def test_not_ready_wins_over_in_progress():
    gh = FakeGitHub({(REPO, 30): _issue(30, labels=("ready-for-human", IN_PROGRESS_LABEL))})
    assert resolve_ticket("#30", "/wd", client=gh).reason == "not_ready"


def test_claim_adds_only_the_in_progress_label_and_ensures_it_exists():
    gh = FakeGitHub()
    assert claim_ticket(_ticket(), client=gh)
    assert gh.labels_ensured == [(REPO, IN_PROGRESS_LABEL)]
    assert gh.labels_added == [(REPO, 1, IN_PROGRESS_LABEL)]
    assert gh.comments == []


def test_claim_of_an_already_claimed_ticket_writes_nothing():
    gh = FakeGitHub()
    assert claim_ticket(_ticket(labels=("ready-for-agent", IN_PROGRESS_LABEL)), client=gh)
    assert gh.labels_ensured == [] and gh.labels_added == []


def test_claim_reports_a_failed_label_write():
    gh = FakeGitHub()
    gh.label_writes_fail = True
    assert not claim_ticket(_ticket(), client=gh)


class _Done:
    def __init__(self, returncode=0, stdout="", stderr=""):
        self.returncode, self.stdout, self.stderr = returncode, stdout, stderr


def test_gh_ensure_label_treats_an_existing_label_as_success(monkeypatch):
    runs = []

    def fake_run(cmd, **kwargs):
        runs.append(cmd)
        return _Done(1, stderr='label with name "in-progress" already exists; use `--force` to update')

    monkeypatch.setattr(ticket_resolver.subprocess, "run", fake_run)
    assert GhClient().ensure_label(REPO, IN_PROGRESS_LABEL, "Claimed", "fbca04")
    assert runs[0][:4] == ["gh", "label", "create", IN_PROGRESS_LABEL]
    assert "--force" not in runs[0]  # never rewrites a label a human has edited


def test_gh_ensure_label_reports_other_failures(monkeypatch):
    monkeypatch.setattr(ticket_resolver.subprocess, "run",
                        lambda cmd, **kw: _Done(1, stderr="HTTP 403: Resource not accessible"))
    assert not GhClient().ensure_label(REPO, IN_PROGRESS_LABEL, "Claimed", "fbca04")


# --- Blockers (#23) ---------------------------------------------------------

AW = "acme/widgets"


def _aw58(**states):
    """The acme/widgets#58 fixture (three Blockers in `## Blocked by`),
    with each Blocker's state overridable as n57="CLOSED" etc."""
    data = json.loads((FIXTURES / "acme_widgets_58.json").read_text())
    issues = {(AW, 58): data}
    for n, blocker in data["blockers"].items():
        issues[(AW, int(n))] = {**blocker, "state": states.get(f"n{n}", blocker["state"])}
    return FakeGitHub(issues, origin=AW)


def _native(number, title, state="open", repo=REPO):
    # Shape of `gh api repos/{repo}/issues/{n}/dependencies/blocked_by` items.
    return {"number": number, "title": title, "state": state,
            "html_url": f"https://github.com/{repo}/issues/{number}"}


def _blocker_numbers(refusal):
    return [b.number for b in refusal.blockers]


def test_open_native_dependency_blocker_is_refused_and_listed():
    gh = FakeGitHub({(REPO, 23): _issue(23)},
                    blocked_by={(REPO, 23): [_native(22, "Tracer: run a Ready Ticket")]})
    out = resolve_ticket("#23", "/wd", client=gh)
    assert isinstance(out, Refusal) and out.reason == "open_blockers"
    assert [(b.repo, b.number, b.title) for b in out.blockers] == [
        (REPO, 22, "Tracer: run a Ready Ticket")]
    assert "#22" in out.message and "Tracer: run a Ready Ticket" in out.message


def test_closed_native_dependency_does_not_block():
    gh = FakeGitHub({(REPO, 23): _issue(23)},
                    blocked_by={(REPO, 23): [_native(22, "Tracer", state="closed")]})
    assert isinstance(resolve_ticket("#23", "/wd", client=gh), Ticket)


def test_open_blocker_listed_only_in_blocked_by_section_is_refused():
    body = "## What to build\n\nX.\n\n## Blocked by\n\n- #22\n"
    gh = FakeGitHub({(REPO, 23): _issue(23, body=body),
                     (REPO, 22): {"number": 22, "title": "Tracer", "state": "OPEN"}})
    out = resolve_ticket("#23", "/wd", client=gh)
    assert isinstance(out, Refusal) and out.reason == "open_blockers"
    assert _blocker_numbers(out) == [22]
    assert "Tracer" in out.message


def test_fixture_all_open_lists_every_blocker():
    out = resolve_ticket("#58", "/wd", client=_aw58(n85="OPEN", n86="OPEN"))
    assert isinstance(out, Refusal) and out.reason == "open_blockers"
    assert _blocker_numbers(out) == [57, 85, 86]
    for title in ("Rate limiter rejects burst uploads", "delete and download resolution",
                  "closing the two-write window"):
        assert title in out.message


def test_fixture_mixed_lists_only_the_open_blocker():
    out = resolve_ticket("#58", "/wd", client=_aw58())  # as captured: 57 open, 85/86 closed
    assert isinstance(out, Refusal) and out.reason == "open_blockers"
    assert [(b.number, b.title) for b in out.blockers] == [(57, "Rate limiter rejects burst uploads")]
    assert "#85" not in out.message and "#86" not in out.message


def test_fixture_all_closed_resolves():
    ticket = resolve_ticket("#58", "/wd", client=_aw58(n57="CLOSED"))
    assert isinstance(ticket, Ticket) and ticket.ref == f"{AW}#58"


@pytest.mark.parametrize("body", [
    "## What to build\n\nX.\n\n## Blocked by\n\nNone (can start immediately)\n",
    "## What to build\n\nX.\n\n## Blocked by\n\n- None - can start immediately (see #9 for context)\n",
    "## What to build\n\nX.\n\n## Blocked by\n\n## Acceptance criteria\n\n- [ ] see #9\n",
    "## What to build\n\nNo section here; mentions #9 in passing.\n",
])
def test_none_empty_or_missing_section_means_no_blockers(body):
    gh = FakeGitHub({(REPO, 23): _issue(23, body=body),
                     (REPO, 9): {"number": 9, "title": "Open elsewhere", "state": "OPEN"}})
    assert isinstance(resolve_ticket("#23", "/wd", client=gh), Ticket)
    assert ("get_issue", REPO, 9) not in gh.calls


def test_native_and_section_blockers_are_unioned_without_duplicates():
    body = "## Blocked by\n\n- #22\n- #30\n"
    gh = FakeGitHub({(REPO, 23): _issue(23, body=body),
                     (REPO, 30): {"number": 30, "title": "Thirty", "state": "OPEN"}},
                    blocked_by={(REPO, 23): [_native(22, "Twenty-two"), _native(31, "Thirty-one")]})
    out = resolve_ticket("#23", "/wd", client=gh)
    assert isinstance(out, Refusal)
    assert sorted(_blocker_numbers(out)) == [22, 30, 31]
    # #22 came with its state from the native list, so it is not fetched again.
    assert ("get_issue", REPO, 22) not in gh.calls


def test_section_blocker_that_cannot_be_fetched_blocks():
    body = "## Blocked by\n\n- #404\n"
    out = resolve_ticket("#23", "/wd", client=FakeGitHub({(REPO, 23): _issue(23, body=body)}))
    assert isinstance(out, Refusal) and out.reason == "open_blockers"
    assert _blocker_numbers(out) == [404]


def test_section_accepts_qualified_and_url_references():
    other = "someone/lib"
    body = f"## Blocked by\n\n- {other}#4\n- https://github.com/{other}/issues/5\n"
    gh = FakeGitHub({(REPO, 23): _issue(23, body=body),
                     (other, 4): {"number": 4, "title": "Four", "state": "OPEN"},
                     (other, 5): {"number": 5, "title": "Five", "state": "CLOSED"}})
    out = resolve_ticket("#23", "/wd", client=gh)
    assert isinstance(out, Refusal)
    assert [(b.repo, b.number) for b in out.blockers] == [(other, 4)]
    assert f"{other}#4" in out.message


def test_not_ready_ticket_is_refused_before_blockers_are_checked():
    gh = FakeGitHub({(REPO, 23): _issue(23, labels=("ready-for-human",))},
                    blocked_by={(REPO, 23): [_native(22, "Tracer")]})
    out = resolve_ticket("#23", "/wd", client=gh)
    assert out.reason == "not_ready"
    assert not any(c[0] == "blocked_by" for c in gh.calls)


_OPEN_ONE = {"number": 1, "title": "One", "state": "OPEN"}
_OPEN_TWO = {"number": 2, "title": "Two", "state": "OPEN"}


@pytest.mark.parametrize("body", [
    "## What to build\r\n\r\nX.\r\n\r\n## Blocked by\r\n\r\n- #1\r\n- #2\r\n",
    "## Blocked by:\n\n- #1\n- #2\n",
    "### Blocked by\n\n- #1\n- #2\n",
    "## Blocked by\n\n- #1\n\n```sh\n# a comment inside a fence\n```\n\n- #2\n",
    "Blocked by: #1, #2\n\n## What to build\n\nX.\n",
])
def test_blocked_by_section_forms_are_all_read(body):
    gh = FakeGitHub({(REPO, 23): _issue(23, body=body),
                     (REPO, 1): _OPEN_ONE, (REPO, 2): _OPEN_TWO})
    out = resolve_ticket("#23", "/wd", client=gh)
    assert isinstance(out, Refusal) and out.reason == "open_blockers"
    assert _blocker_numbers(out) == [1, 2]


def test_section_ends_at_the_next_heading():
    body = "## Blocked by\n\n- #1\n\n## Notes\n\n- see #2\n"
    gh = FakeGitHub({(REPO, 23): _issue(23, body=body),
                     (REPO, 1): _OPEN_ONE, (REPO, 2): _OPEN_TWO})
    assert _blocker_numbers(resolve_ticket("#23", "/wd", client=gh)) == [1]


def test_hashes_glued_to_a_word_are_not_references():
    body = "## Blocked by\n\n- Needs the C#1 port and foo#2 renamed, plus #1\n"
    gh = FakeGitHub({(REPO, 23): _issue(23, body=body),
                     (REPO, 1): _OPEN_ONE, (REPO, 2): _OPEN_TWO})
    assert _blocker_numbers(resolve_ticket("#23", "/wd", client=gh)) == [1]


def test_unreadable_native_dependencies_refuse_rather_than_run():
    gh = FakeGitHub({(REPO, 23): _issue(23)}, blocked_by={(REPO, 23): None})
    out = resolve_ticket("#23", "/wd", client=gh)
    assert isinstance(out, Refusal) and out.reason == "blockers_unavailable"
    assert f"{REPO}#23" in out.message


# ---- the parent Spec (#24) -------------------------------------------------

_SPEC_19 = {"number": 19, "title": "Spec: Ticket-driven runs", "state": "OPEN"}
_SPEC_40 = {"number": 40, "title": "Another Spec", "state": "OPEN"}


def _spec_ticket(body, repo=REPO, number=24):
    return Ticket(repo=repo, number=number, title="Find the parent Spec", body=body,
                  labels=("ready-for-agent",), url=f"https://github.com/{repo}/issues/{number}")


def test_sub_issue_parent_is_the_spec():
    gh = FakeGitHub({(REPO, 19): _SPEC_19}, parents={(REPO, 24): {
        **_SPEC_19, "html_url": f"https://github.com/{REPO}/issues/19"}})
    spec = resolve_spec(_spec_ticket("## What to build\n\nX."), "/wd", client=gh)
    assert (spec.ref, spec.kind, spec.source, spec.warning) == (f"{REPO}#19", "issue", "sub_issue", None)


@pytest.mark.parametrize("body", [
    "## Parent\n\n#19\n\n## What to build\n\nX.",
    f"### Parent\n\n- https://github.com/{REPO}/issues/19\n",
    "Part of #19\n\n## What to build\n\nX.",
    "**Part of:** #19",
])
def test_parent_section_or_part_of_line_names_the_spec(body):
    gh = FakeGitHub({(REPO, 19): _SPEC_19})
    spec = resolve_spec(_spec_ticket(body), "/wd", client=gh)
    assert (spec.ref, spec.kind, spec.source, spec.warning) == (f"{REPO}#19", "issue", "parent_section", None)


def test_spec_line_names_a_file_in_the_repo(tmp_path):
    (tmp_path / "docs").mkdir()
    (tmp_path / "docs" / "spec.md").write_text("# Spec\n")
    spec = resolve_spec(_spec_ticket("Spec: docs/spec.md\n\n## What to build\n\nX."),
                        str(tmp_path), client=FakeGitHub())
    assert (spec.ref, spec.kind, spec.source, spec.warning) == ("docs/spec.md", "file", "spec_line", None)


def test_sub_issue_parent_wins_over_parent_section_and_spec_line(tmp_path):
    (tmp_path / "spec.md").write_text("x")
    gh = FakeGitHub({(REPO, 19): _SPEC_19, (REPO, 40): _SPEC_40},
                    parents={(REPO, 24): {**_SPEC_19, "html_url": f"https://github.com/{REPO}/issues/19"}})
    spec = resolve_spec(_spec_ticket("## Parent\n\n#40\n\nSpec: spec.md"), str(tmp_path), client=gh)
    assert spec.ref == f"{REPO}#19" and spec.source == "sub_issue"


def test_parent_section_wins_over_spec_line(tmp_path):
    (tmp_path / "spec.md").write_text("x")
    gh = FakeGitHub({(REPO, 40): _SPEC_40})
    spec = resolve_spec(_spec_ticket("Spec: spec.md\n\n## Parent\n\n#40\n"), str(tmp_path), client=gh)
    assert spec.ref == f"{REPO}#40" and spec.source == "parent_section"


def test_no_spec_resolves_with_a_warning_not_a_refusal():
    spec = resolve_spec(_spec_ticket("## What to build\n\nX."), "/wd", client=FakeGitHub())
    assert isinstance(spec, SpecResolution)
    assert spec.ref is None and spec.warning and "no parent Spec" in spec.warning


def test_closed_spec_issue_resolves_with_a_warning():
    gh = FakeGitHub({(REPO, 19): {**_SPEC_19, "state": "CLOSED"}})
    spec = resolve_spec(_spec_ticket("## Parent\n\n#19\n"), "/wd", client=gh)
    assert spec.ref == f"{REPO}#19"
    assert spec.warning and "closed" in spec.warning and "reroute" in spec.warning


def test_missing_spec_path_resolves_with_a_warning(tmp_path):
    spec = resolve_spec(_spec_ticket("Spec: docs/gone.md\n"), str(tmp_path), client=FakeGitHub())
    assert spec.ref == "docs/gone.md" and spec.kind == "file"
    assert spec.warning and "does not exist" in spec.warning


def test_the_three_spec_warnings_are_distinct(tmp_path):
    none = resolve_spec(_spec_ticket("X."), str(tmp_path), client=FakeGitHub())
    closed = resolve_spec(_spec_ticket("Part of #19"), str(tmp_path),
                          client=FakeGitHub({(REPO, 19): {**_SPEC_19, "state": "CLOSED"}}))
    missing = resolve_spec(_spec_ticket("Spec: nope.md"), str(tmp_path), client=FakeGitHub())
    assert len({none.warning, closed.warning, missing.warning}) == 3


def test_spec_line_path_outside_the_repo_is_not_a_spec(tmp_path):
    spec = resolve_spec(_spec_ticket("Spec: ../../etc/passwd"), str(tmp_path), client=FakeGitHub())
    assert spec.warning and "does not exist" in spec.warning


def test_acme_widgets_58_resolves_its_spec_from_the_spec_line(tmp_path):
    fixture = json.loads((FIXTURES / "acme_widgets_58.json").read_text())
    spec_path = tmp_path / "docs" / "epics" / "csv-export" / "spec.md"
    spec_path.parent.mkdir(parents=True)
    spec_path.write_text("# CSV export\n")
    ticket = _spec_ticket(fixture["body"], repo=AW, number=58)
    spec = resolve_spec(ticket, str(tmp_path), client=FakeGitHub(origin=AW))
    assert (spec.ref, spec.kind, spec.source, spec.warning) == (
        "docs/epics/csv-export/spec.md", "file", "spec_line", None)


def test_spec_pointer_names_the_spec_and_when_to_read_it_without_inlining():
    spec = SpecResolution(ref=f"{REPO}#19", kind="issue", source="sub_issue")
    pointer = spec.pointer()
    assert f"https://github.com/{REPO}/issues/19" in pointer and "\n" not in pointer.strip()
    assert "read" in pointer.lower()
    assert SpecResolution(ref=None, warning="w").pointer() == ""


def test_a_spec_issue_knows_its_repo_and_number():
    spec = SpecResolution.from_state(f"{REPO}#19", None)
    assert spec.issue_coordinates() == (REPO, 19)


def test_spec_resolution_round_trips_through_state():
    for spec in (SpecResolution(ref=f"{REPO}#19", kind="issue", warning="closed"),
                 SpecResolution(ref="docs/spec.md", kind="file"),
                 SpecResolution(ref=None, warning="no parent Spec")):
        back = SpecResolution.from_state(spec.ref, spec.warning)
        assert (back.ref, back.kind, back.warning) == (spec.ref, spec.kind, spec.warning)


def test_part_of_in_prose_is_not_a_parent(tmp_path):
    (tmp_path / "spec.md").write_text("x")
    gh = FakeGitHub({(REPO, 12): _SPEC_40})
    spec = resolve_spec(_spec_ticket("Part of the fix, see #12\n\nSpec: spec.md"), str(tmp_path), client=gh)
    assert (spec.ref, spec.source) == ("spec.md", "spec_line")


def test_closed_sub_issue_parent_resolves_with_a_warning():
    gh = FakeGitHub(parents={(REPO, 24): {**_SPEC_19, "state": "closed",
                                          "html_url": f"https://github.com/{REPO}/issues/19"}})
    spec = resolve_spec(_spec_ticket("X."), "/wd", client=gh)
    assert spec.ref == f"{REPO}#19" and spec.source == "sub_issue"
    assert spec.warning and "closed" in spec.warning
