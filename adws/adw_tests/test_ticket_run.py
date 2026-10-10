#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv", "rich"]
# ///

"""Tests for how travis_sdlc runs a Ticket (#22): what the plan phase gets,
the document skip, the PR title/issue, the one Ticket comment, and ticket_ref
surviving --resume. main() has no isolated test, so these cover the helpers it
calls; the resolver itself is covered by test_ticket_resolver.py.

Usage:
    uv run pytest adws/adw_tests/test_ticket_run.py -q
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from adw_modules.ticket_resolver import (  # noqa: E402
    IN_PROGRESS_LABEL, Refusal, SpecResolution, Ticket,
)
from travis import travis_sdlc  # noqa: E402
from travis.travis_plan import is_spec_file  # noqa: E402

REPO = "travism26/claude-code-adw"


def _ticket(labels=("ready-for-agent",), title="Tracer: run a Ready Ticket end to end",
            body="## What to build\n\nA new thing."):
    return Ticket(repo=REPO, number=22, title=title, body=body, labels=labels,
                  url=f"https://github.com/{REPO}/issues/22")


class _State:
    def __init__(self, data=None):
        self.data = dict(data or {})
        self.saves = 0

    def get(self, key, default=None):
        return self.data.get(key, default)

    def save(self):
        self.saves += 1


class _FakeGitHub:
    def __init__(self, issues=None, origin=REPO, label_writes_fail=False):
        self.comments = []
        self.issues = issues or {}
        self.origin = origin
        self.label_writes_fail = label_writes_fail
        self.writes = []  # every label write, in order

    def origin_repo(self, working_dir):
        return self.origin

    def get_issue(self, repo, number):
        return self.issues.get((repo, number))

    def blocked_by(self, repo, number):
        return []

    def ensure_label(self, repo, name, description, color):
        self.writes.append(("ensure_label", repo, name))
        return not self.label_writes_fail

    def add_label(self, repo, number, name):
        self.writes.append(("add_label", repo, number, name))
        return not self.label_writes_fail

    def comment(self, repo, number, body):
        self.comments.append((repo, number, body))
        return True


# ---- which input is a Ticket ----------------------------------------------

def test_ticket_references_are_recognised():
    for ref in (f"https://github.com/{REPO}/issues/22", f"{REPO}#22", "22", "#22"):
        assert travis_sdlc.ticket_reference_for_run(ref, None) == ref


def test_legacy_inputs_are_not_tickets():
    assert travis_sdlc.ticket_reference_for_run("specs/feature-x.md", None) is None
    assert travis_sdlc.ticket_reference_for_run("add a dark mode toggle", None) is None
    assert travis_sdlc.ticket_reference_for_run(__file__, None) is None


def test_resume_restores_the_recorded_ticket_ref():
    state = _State({"ticket_ref": f"{REPO}#22"})
    assert travis_sdlc.ticket_reference_for_run("anything", state) == f"{REPO}#22"


def test_resume_of_a_legacy_run_stays_legacy():
    state = _State({"ticket_ref": None})
    assert travis_sdlc.ticket_reference_for_run("specs/x.md", state) is None


# ---- what a Ticket run does differently ------------------------------------

def test_ticket_run_plans_from_the_ticket_and_skips_document():
    run = travis_sdlc.build_run_input("#22", None, skip_document=False, ticket=_ticket())
    assert run.plan_input.startswith("# Tracer: run a Ready Ticket end to end")
    assert "A new thing." in run.plan_input
    assert not is_spec_file(run.plan_input)  # so travis_plan never skips planning
    assert run.skip_document is True
    assert run.pr_title == "Tracer: run a Ready Ticket end to end"
    assert run.issue_number == "22"


def test_ticket_run_plan_type_order():
    labelled = _ticket(labels=("ready-for-agent", "chore"), title="fix the broken build")
    assert travis_sdlc.build_run_input("#22", "bug", False, ticket=labelled).plan_type == "bug"
    assert travis_sdlc.build_run_input("#22", None, False, ticket=labelled).plan_type == "chore"
    unlabelled = _ticket(title="fix the broken login", body="It crashes.")
    assert travis_sdlc.build_run_input("#22", None, False, ticket=unlabelled).plan_type == "bug"


def test_legacy_run_input_is_unchanged(monkeypatch):
    monkeypatch.delenv("ADW_ISSUE_NUMBER", raising=False)
    run = travis_sdlc.build_run_input("add a dark mode toggle\nmore", None, skip_document=False)
    assert run.plan_input == "add a dark mode toggle\nmore"
    assert run.plan_type == "feature" and run.skip_document is False
    assert run.pr_title == "ADW: add a dark mode toggle"
    assert run.issue_number is None and run.ticket is None

    spec = travis_sdlc.build_run_input("specs/m2.md", "chore", skip_document=True)
    assert (spec.plan_input, spec.plan_type, spec.skip_document) == ("specs/m2.md", "chore", True)


# ---- the one comment on the Ticket -----------------------------------------

def test_pr_is_announced_on_the_ticket_exactly_once():
    gh, state = _FakeGitHub(), _State()
    pr = "https://github.com/x/y/pull/9"
    assert travis_sdlc.announce_pr_on_ticket(_ticket(), pr, "abc12345", state, client=gh)
    # A resumed segment adopts the same PR and must not comment again.
    assert not travis_sdlc.announce_pr_on_ticket(_ticket(), pr, "abc12345", state, client=gh)
    assert len(gh.comments) == 1
    repo, number, body = gh.comments[0]
    assert (repo, number) == (REPO, 22) and pr in body and "abc12345" in body


def test_no_pr_means_no_comment():
    gh = _FakeGitHub()
    assert not travis_sdlc.announce_pr_on_ticket(_ticket(), None, "abc12345", _State(), client=gh)
    assert gh.comments == []


# ---- claiming the Ticket (#30) ---------------------------------------------

def _issue(number=22, labels=("ready-for-agent",)):
    return {"number": number, "title": "A Ticket", "body": "## What to build\n\nX.",
            "labels": [{"name": l} for l in labels],
            "url": f"https://github.com/{REPO}/issues/{number}", "state": "OPEN"}


def _installed_target(tmp_path):
    """A working dir with every command a feature run invokes, and a
    Preflight that looks nowhere else (target_preflight has its own tests)."""
    commands = tmp_path / "wd" / ".claude" / "commands"
    commands.mkdir(parents=True)
    for name in travis_sdlc.run_commands("feature"):
        (commands / f"{name}.md").write_text(f"# /{name}\n")
    return str(tmp_path / "wd"), travis_sdlc.Preflight(
        plan_type="feature", user_commands_dir=tmp_path / "no-user-commands")


def test_a_resolved_ticket_is_claimed_with_in_progress_and_nothing_else(tmp_path):
    gh = _FakeGitHub({(REPO, 22): _issue()})
    wd, preflight = _installed_target(tmp_path)
    ticket = travis_sdlc.start_ticket("#22", wd, None, client=gh, preflight=preflight)
    assert isinstance(ticket, Ticket) and ticket.ref == f"{REPO}#22"
    assert [w for w in gh.writes if w[0] == "add_label"] == [
        ("add_label", REPO, 22, IN_PROGRESS_LABEL)]
    assert gh.comments == []


def test_refused_tickets_are_never_labelled():
    cases = [
        ("someone/else#22", _FakeGitHub({("someone/else", 22): _issue()}), "repo_mismatch"),
        ("#22", _FakeGitHub({(REPO, 22): _issue(labels=("ready-for-human",))}), "not_ready"),
        ("#22", _FakeGitHub({(REPO, 22): _issue(labels=("ready-for-agent", IN_PROGRESS_LABEL))}),
         "in_progress"),
    ]
    for ref, gh, reason in cases:
        out = travis_sdlc.start_ticket(ref, "/wd", None, client=gh)
        assert isinstance(out, Refusal) and out.reason == reason
        assert gh.writes == []


def test_resume_of_the_claiming_run_proceeds_without_claiming_again():
    gh = _FakeGitHub({(REPO, 22): _issue(labels=("ready-for-agent", IN_PROGRESS_LABEL))})
    state = _State({"ticket_ref": f"{REPO}#22"})
    ticket = travis_sdlc.start_ticket(f"{REPO}#22", "/wd", state, client=gh)
    assert isinstance(ticket, Ticket)
    assert gh.writes == []


def test_a_ticket_that_cannot_be_claimed_is_refused(tmp_path):
    gh = _FakeGitHub({(REPO, 22): _issue()}, label_writes_fail=True)
    wd, preflight = _installed_target(tmp_path)
    out = travis_sdlc.start_ticket("#22", wd, None, client=gh, preflight=preflight)
    assert isinstance(out, Refusal) and out.reason == "claim_failed"


# ---- the parent Spec (#24) -------------------------------------------------

SPEC_BODY = "THE WHOLE SPEC BODY, WHICH MUST NEVER REACH THE PLANNER"


def test_planner_gets_the_spec_as_a_pointer_not_its_body():
    spec = SpecResolution(ref=f"{REPO}#19", kind="issue", source="sub_issue")
    run = travis_sdlc.build_run_input("#22", None, False, _ticket(), spec)
    assert run.plan_input.startswith(_ticket().as_plan_input())
    assert spec.pointer() in run.plan_input
    assert SPEC_BODY not in run.plan_input


def test_no_spec_adds_no_pointer():
    run = travis_sdlc.build_run_input("#22", None, False, _ticket(),
                                      SpecResolution(ref=None, warning="no parent Spec"))
    assert run.plan_input == _ticket().as_plan_input()


def test_resume_restores_spec_ref_and_warning_without_resolving_again():
    def boom(*a, **k):
        raise AssertionError("a resumed run must not re-resolve its Spec")
    state = _State({"ticket_ref": f"{REPO}#22", "spec_ref": f"{REPO}#19",
                    "spec_warning": "Spec is closed"})
    spec = travis_sdlc.spec_for_run(_ticket(), "/wd", state, resolve=boom)
    assert (spec.ref, spec.kind, spec.warning) == (f"{REPO}#19", "issue", "Spec is closed")
    missing = travis_sdlc.spec_for_run(_ticket(), "/wd", _State({"spec_warning": "no parent Spec"}),
                                       resolve=boom)
    assert (missing.ref, missing.warning) == (None, "no parent Spec")


def test_fresh_run_resolves_the_spec():
    want = SpecResolution(ref="docs/spec.md", kind="file", source="spec_line")
    assert travis_sdlc.spec_for_run(_ticket(), "/wd", None, resolve=lambda t, wd: want) is want
    assert travis_sdlc.spec_for_run(_ticket(), "/wd", _State({"ticket_ref": "x"}),
                                    resolve=lambda t, wd: want) is want


def test_final_summary_shows_the_spec_and_its_warning(capsys):
    state = _State({"ticket_ref": f"{REPO}#22", "spec_ref": None,
                    "spec_warning": "Ticket has no parent Spec", "phase_results": {}})
    state.adw_id = "deadbeef"
    travis_sdlc.print_final_summary(state)
    out = capsys.readouterr().out
    assert f"Ticket: {REPO}#22" in out
    assert "Spec warning: Ticket has no parent Spec" in out
