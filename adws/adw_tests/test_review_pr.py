#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv"]
# ///

"""Tests for the factory's Review task (adws/actions/review_pr.py): the rework
counter and its cap, the PR's Ticket link, the read-only budget-capped agent
call, and the report. GitHub and the agent are faked.

Usage:
    uv run pytest adws/adw_tests/test_review_pr.py -q
"""

import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from actions import review_pr  # noqa: E402
from actions.review_pr import Moves, label_moves, linked_ticket, rework_round  # noqa: E402
from adw_modules.agent import AgentPromptRequest, max_budget_args  # noqa: E402

REPO = "travism26/claude-code-adw"
BLOCKER = {"kind": "missing_requirement", "description": "No cap on rework.",
           "resolution": "Add the cap.", "file_path": "adws/x.py:3"}
NIT = {"kind": "baseline_smell", "description": "Mysterious Name: x.",
       "resolution": "Rename it.", "file_path": None}


def _findings(spec=(), standards=()):
    return {"spec_summary": "Checked every criterion.",
            "standards_summary": "Read CLAUDE.md.",
            "spec_findings": list(spec), "standards_findings": list(standards)}


# ---- the counter ------------------------------------------------------------

def test_a_first_blocker_starts_the_counter():
    assert label_moves(["feature"], blocker=True) == Moves(
        "rework", add=("rework", "rework:1"), remove=())


def test_a_later_blocker_moves_the_counter_and_refires_rework():
    moves = label_moves(["rework", "rework:1"], blocker=True)
    assert moves == Moves("rework", add=("rework", "rework:2"), remove=("rework:1", "rework"))


def test_the_blocker_after_rework_3_goes_to_a_human():
    moves = label_moves(["rework", "rework:3"], blocker=True)
    assert moves == Moves("human", add=("ready-for-human",), remove=("rework",))
    assert "rework:4" not in moves.add


def test_a_pass_clears_rework_and_keeps_the_count():
    assert label_moves(["rework", "rework:2"], blocker=False) == Moves("pass", remove=("rework",))
    assert label_moves([], blocker=False) == Moves("pass")


def test_a_pr_a_human_owns_is_left_alone():
    assert label_moves(["ready-for-human", "rework:3"], blocker=True) == Moves("human-owned")


def test_the_round_is_the_highest_counter():
    assert rework_round(["rework:1", "rework:3", "reworked:9", "rework"]) == 3
    assert rework_round([]) == 0


def test_every_counter_label_is_in_the_label_set():
    names = {l["name"] for l in json.loads(
        (REPO_ROOT / "adws/actions/labels.json").read_text())["labels"]}
    needed = {"rework", "ready-for-human", *(f"rework:{n}" for n in range(1, review_pr.MAX_REWORK + 1))}
    assert needed <= names


# ---- the Ticket link ------------------------------------------------------

@pytest.mark.parametrize("body,expected", [
    ("Implements the thing.\n\nCloses #25", 25),
    ("fixes: #7 and closes #8", 7),
    (f"Resolves {REPO}#12", 12),
    ("Closes other/repo#3\nCloses #4", 4),
    ("Mentions #25 but closes nothing", None),
    ("", None),
])
def test_the_ticket_is_the_issue_the_body_closes(body, expected):
    assert linked_ticket(body, REPO) == expected


# ---- the agent call -----------------------------------------------------------

def test_the_budget_cap_reaches_the_cli():
    req = AgentPromptRequest(prompt="p", adw_id="a", output_file="/tmp/x.jsonl",
                             max_budget_usd=2.5)
    assert max_budget_args(req) == ["--max-budget-usd", "2.5"]
    assert max_budget_args(AgentPromptRequest(prompt="p", adw_id="a",
                                              output_file="/tmp/x.jsonl")) == []
    with pytest.raises(ValueError):
        max_budget_args(AgentPromptRequest(prompt="p", adw_id="a",
                                           output_file="/tmp/x.jsonl", max_budget_usd=0))


def _context(out: Path, **over):
    ctx = {"repo": REPO, "pr": 40, "pr_url": "u", "base_sha": "b" * 40, "head_sha": "h" * 40,
           "code_dir": "pr", "ticket_ref": f"{REPO}#25", "spec_ref": None,
           "spec_path": None, "spec_warning": None, **over}
    out.mkdir(parents=True, exist_ok=True)
    (out / "context.json").write_text(json.dumps(ctx))
    return ctx


def test_the_reviewer_cannot_write_run_commands_or_overspend(tmp_path):
    out = tmp_path / "review-out"
    _context(out)
    seen = []

    def agent(req):
        seen.append(req)
        return SimpleNamespace(success=True, output=json.dumps(_findings(spec=[BLOCKER])))

    args = SimpleNamespace(out=str(out), model="sonnet", max_budget_usd=2.0)
    assert review_pr.review(args, run_agent=agent) == 0
    req = seen[0]
    assert {"Bash", "Edit", "Write", "NotebookEdit", "WebFetch"} <= set(req.disallowed_tools)
    assert req.max_budget_usd == 2.0 and not req.dangerously_skip_permissions
    assert "gh issue view" not in req.prompt and "git diff" not in req.prompt
    assert str(out / "diff.patch") in req.prompt and str(out / "ticket.md") in req.prompt
    assert json.loads((out / "findings.json").read_text())["spec_findings"][0]["kind"] == "missing_requirement"


def test_a_failed_or_unparseable_review_fails_the_step(tmp_path):
    out = tmp_path / "review-out"
    _context(out)
    args = SimpleNamespace(out=str(out), model="sonnet", max_budget_usd=2.0)
    with pytest.raises(RuntimeError, match="agent failed"):
        review_pr.review(args, run_agent=lambda r: SimpleNamespace(success=False, output="budget"))
    with pytest.raises(RuntimeError, match="could not be parsed"):
        review_pr.review(args, run_agent=lambda r: SimpleNamespace(success=True, output="no json"))
    assert not (out / "findings.json").exists()


def test_a_review_stopped_by_its_budget_says_so(tmp_path):
    out = tmp_path / "review-out"
    _context(out)
    (out / "reviewer").mkdir()
    (out / "reviewer" / "agent.jsonl").write_text(
        '{"type": "system"}\n'
        '{"type": "result", "subtype": "error_max_budget_usd", "is_error": true, "total_cost_usd": 0.055}\n')
    args = SimpleNamespace(out=str(out), model="sonnet", max_budget_usd=0.01)
    with pytest.raises(RuntimeError, match=r"budget cap \(--max-budget-usd 0.01, spent \$0.06\)"):
        review_pr.review(args, run_agent=lambda r: SimpleNamespace(success=False, output="Unknown error"))


def test_a_pr_without_a_ticket_is_reviewed_against_its_description():
    prompt = review_pr.build_pr_review_prompt(
        pr_ref=f"{REPO}#40", diff_path="review-out/diff.patch", code_dir="pr",
        base_sha="b", head_sha="h", ticket_path="review-out/ticket.md",
        ticket_ref=None, spec_path=None, spec_ref=None)
    assert "names no Ticket" in prompt and "There is no Spec" in prompt


# ---- prepare and apply ----------------------------------------------------------

class FakePrs:
    def __init__(self, pr):
        self.pr, self.calls = pr, []

    def view(self, repo, number):
        return self.pr

    def comment(self, repo, number, body_file):
        self.calls.append(("comment", Path(body_file).read_text()))

    def edit_labels(self, repo, number, flag, labels):
        if labels:
            self.calls.append((flag, labels))


class FakeIssues:
    def __init__(self, issues):
        self.issues = issues

    def get_issue(self, repo, number):
        return self.issues.get(number)

    def parent_issue(self, repo, number):
        return None


def _git_repo(path: Path):
    def git(*a):
        return subprocess.run(["git", "-C", str(path), *a], check=True,
                              capture_output=True, text=True).stdout.strip()
    path.mkdir()
    git("init", "-q")
    git("config", "user.email", "t@example.com")
    git("config", "user.name", "t")
    (path / "a.txt").write_text("one\n")
    git("add", ".")
    git("commit", "-qm", "base")
    base = git("rev-parse", "HEAD")
    (path / "a.txt").write_text("one\ntwo\n")
    git("commit", "-qam", "head")
    return base, git("rev-parse", "HEAD")


def test_prepare_gathers_the_diff_ticket_and_spec_file(tmp_path):
    code = tmp_path / "pr"
    base, head = _git_repo(code)
    (code / "docs").mkdir()
    (code / "docs/spec.md").write_text("spec")
    prs = FakePrs({"title": "t", "body": "Closes #25", "url": "u"})
    issues = FakeIssues({25: {"title": "Cap rework", "body": "Spec: docs/spec.md\n\n## Acceptance criteria\n- cap"}})
    args = SimpleNamespace(repo=REPO, pr=40, base_sha=base, head_sha=head,
                           code_dir=str(code), out=str(tmp_path / "out"))
    assert review_pr.prepare(args, prs=prs, issues=issues) == 0
    out = tmp_path / "out"
    assert "+two" in (out / "diff.patch").read_text()
    assert (out / "ticket.md").read_text().startswith("# Cap rework")
    ctx = json.loads((out / "context.json").read_text())
    assert ctx["ticket_ref"] == f"{REPO}#25" and ctx["spec_ref"] == "docs/spec.md"
    assert ctx["spec_path"] == str(code / "docs/spec.md")


def test_prepare_fails_when_the_closed_ticket_cannot_be_read(tmp_path):
    code = tmp_path / "pr"
    base, head = _git_repo(code)
    args = SimpleNamespace(repo=REPO, pr=40, base_sha=base, head_sha=head,
                           code_dir=str(code), out=str(tmp_path / "out"))
    with pytest.raises(RuntimeError, match="could not be read"):
        review_pr.prepare(args, prs=FakePrs({"body": "Closes #99"}), issues=FakeIssues({}))


def _apply(tmp_path, findings, labels, head="h" * 40, state="OPEN"):
    out = tmp_path / "review-out"
    _context(out)
    (out / "findings.json").write_text(json.dumps(findings))
    prs = FakePrs({"state": state, "headRefOid": head, "labels": [{"name": l} for l in labels]})
    assert review_pr.apply(SimpleNamespace(repo=REPO, pr=40, out=str(out)), prs=prs) == 0
    return prs.calls


def test_apply_posts_both_axes_then_moves_the_labels(tmp_path):
    calls = _apply(tmp_path, _findings(spec=[BLOCKER], standards=[NIT]), ["rework", "rework:1"])
    kind, report = calls[0]
    assert kind == "comment" and report.startswith(review_pr.MARKER)
    assert "## Factory review: BLOCKED" in report and "round 2 of 3" in report
    assert "### Spec: BLOCKER" in report and "### Standards: NOTES" in report
    assert calls[1:] == [("--remove-label", ("rework:1", "rework")),
                         ("--add-label", ("rework", "rework:2"))]


def test_apply_hands_the_fourth_blocker_to_a_human(tmp_path):
    calls = _apply(tmp_path, _findings(spec=[BLOCKER]), ["rework", "rework:3"])
    assert "factory stops here" in calls[0][1]
    assert calls[1:] == [("--remove-label", ("rework",)), ("--add-label", ("ready-for-human",))]


def test_apply_on_a_pass_reports_pass_and_clears_rework(tmp_path):
    calls = _apply(tmp_path, _findings(standards=[NIT]), ["rework", "rework:1"])
    assert "## Factory review: PASS" in calls[0][1] and "### Spec: PASS" in calls[0][1]
    assert calls[1:] == [("--remove-label", ("rework",))]


def test_apply_leaves_labels_alone_when_the_pr_moved_on(tmp_path):
    calls = _apply(tmp_path, _findings(spec=[BLOCKER]), ["rework:1"], head="n" * 40)
    assert [c[0] for c in calls] == ["comment"] and "moved on" in calls[0][1]


def test_apply_skips_a_closed_pr(tmp_path):
    assert _apply(tmp_path, _findings(spec=[BLOCKER]), [], state="MERGED") == []


def test_main_turns_a_failure_into_an_error_annotation(tmp_path, capsys, monkeypatch):
    monkeypatch.setattr(review_pr, "review", lambda args: (_ for _ in ()).throw(RuntimeError("boom")))
    assert review_pr.main(["review", "--out", str(tmp_path), "--max-budget-usd", "1"]) == 1
    assert "::error title=Factory review review failed::boom" in capsys.readouterr().out


def test_main_refuses_a_budget_that_is_not_positive(tmp_path):
    with pytest.raises(SystemExit):
        review_pr.main(["review", "--out", str(tmp_path), "--max-budget-usd", "0"])
