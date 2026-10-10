#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv", "rich"]
# ///

"""Tests for the Ticket run's target preflight: a target that lacks the
pipeline's slash commands (.claude/commands/) is refused before the Ticket is
claimed, so a doomed run never labels it in-progress, opens a PR or comments.

Usage:
    uv run pytest adws/adw_tests/test_target_preflight.py -q
"""

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from adw_modules.ticket_resolver import IN_PROGRESS_LABEL, Refusal, Ticket  # noqa: E402
from travis import travis_sdlc  # noqa: E402
from travis.travis_sdlc import Preflight  # noqa: E402

REPO = "travism26/claude-code-adw"
FEATURE_RUN = travis_sdlc.run_commands("feature")


class _FakeGitHub:
    def __init__(self, labels=("ready-for-agent",)):
        self.labels = labels
        self.writes = []  # every label write, in order

    def origin_repo(self, working_dir):
        return REPO

    def get_issue(self, repo, number):
        return {"number": number, "title": "Add a thing", "body": "## What to build\n\nX.",
                "labels": [{"name": l} for l in self.labels],
                "url": f"https://github.com/{repo}/issues/{number}", "state": "OPEN"}

    def blocked_by(self, repo, number):
        return []

    def ensure_label(self, repo, name, description, color):
        self.writes.append(("ensure_label", repo, name))
        return True

    def add_label(self, repo, number, name):
        self.writes.append(("add_label", repo, number, name))
        return True


def _install(root: Path, commands):
    d = root / ".claude" / "commands"
    for name in commands:
        f = d / (name.replace(":", "/") + ".md")
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(f"# /{name}\n")


def _git(args, cwd):
    r = subprocess.run(["git", "-C", str(cwd), *args], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return r.stdout.strip()


def _repo(path: Path) -> Path:
    path.mkdir()
    _git(["init", "-q", "-b", "main"], path)
    _git(["config", "user.email", "t@example.com"], path)
    _git(["config", "user.name", "t"], path)
    (path / "README.md").write_text("target\n")
    _git(["add", "-A"], path)
    _git(["commit", "-qm", "init"], path)
    return path


def _no_user(tmp_path) -> Path:
    return tmp_path / "home-commands"  # never the real ~/.claude/commands


# ---- which commands a run needs --------------------------------------------

def test_the_run_needs_its_plan_command_and_the_build_and_test_commands():
    for plan_type in ("feature", "bug", "chore"):
        needed = travis_sdlc.run_commands(plan_type)
        assert plan_type in needed
        assert {"implement", "test", "resolve_failed_test"} <= set(needed)


def test_skipped_phases_need_no_commands():
    full = travis_sdlc.run_commands("feature")
    assert {"research", "validate", "resolve_validation_violation", "review"} <= set(full)
    lean = travis_sdlc.run_commands("feature", skip_research=True, skip_validate=True,
                                    skip_review=True)
    assert not {"research", "validate", "resolve_validation_violation", "review"} & set(lean)
    assert "document" not in full  # a Ticket run never documents


def test_the_openspec_planner_needs_its_own_command_not_the_plan_command():
    needed = travis_sdlc.run_commands("feature", planner="openspec")
    assert "opsx:propose" in needed
    assert "feature" not in needed and "research" not in needed


# ---- where the commands are looked for -------------------------------------

def test_working_dir_commands_are_found(tmp_path):
    wd = tmp_path / "wd"
    _install(wd, ["bug", "opsx:propose"])
    missing = travis_sdlc.missing_commands(["bug", "opsx:propose", "test"], str(wd),
                                           user_commands_dir=_no_user(tmp_path))
    assert missing == ["test"]


def test_user_level_commands_count(tmp_path):
    wd = tmp_path / "wd"
    _install(wd, ["bug"])
    home = tmp_path / "home"
    _install(home, ["test"])
    missing = travis_sdlc.missing_commands(["bug", "test", "implement"], str(wd),
                                           user_commands_dir=home / ".claude" / "commands")
    assert missing == ["implement"]


def test_a_base_ref_is_checked_in_git_not_in_the_working_tree(tmp_path):
    wd = _repo(tmp_path / "wd")
    _git(["checkout", "-qb", "installed"], wd)
    _install(wd, FEATURE_RUN)
    _git(["add", "-A"], wd)
    _git(["commit", "-qm", "install commands"], wd)
    _git(["checkout", "-q", "main"], wd)
    assert not (wd / ".claude").exists()

    assert travis_sdlc.missing_commands(FEATURE_RUN, str(wd), base_ref="installed",
                                        user_commands_dir=_no_user(tmp_path)) == []
    assert travis_sdlc.missing_commands(["implement"], str(wd), base_ref="main",
                                        user_commands_dir=_no_user(tmp_path)) == ["implement"]


def test_uncommitted_commands_do_not_reach_the_worktree(tmp_path):
    wd = _repo(tmp_path / "wd")
    _install(wd, ["implement"])  # on disk, never committed
    assert travis_sdlc.missing_commands(["implement"], str(wd), base_ref="HEAD",
                                        user_commands_dir=_no_user(tmp_path)) == ["implement"]


# ---- start_ticket ----------------------------------------------------------

def test_an_uninstalled_target_is_refused_before_any_label_write(tmp_path):
    wd = tmp_path / "wd"
    _install(wd, ["feature"])
    gh = _FakeGitHub()
    out = travis_sdlc.start_ticket("#22", str(wd), None, client=gh,
                                   preflight=Preflight(user_commands_dir=_no_user(tmp_path)))
    assert isinstance(out, Refusal) and out.reason == "target_not_installed"
    assert "implement" in out.missing and "feature" not in out.missing
    assert "/implement" in out.message
    assert gh.writes == []


def test_an_installed_target_proceeds_and_is_claimed(tmp_path):
    wd = tmp_path / "wd"
    _install(wd, FEATURE_RUN)
    gh = _FakeGitHub()
    out = travis_sdlc.start_ticket("#22", str(wd), None, client=gh,
                                   preflight=Preflight(user_commands_dir=_no_user(tmp_path)))
    assert isinstance(out, Ticket)
    assert ("add_label", REPO, 22, IN_PROGRESS_LABEL) in gh.writes


def test_the_resolved_plan_type_is_checked(tmp_path):
    wd = tmp_path / "wd"
    _install(wd, FEATURE_RUN)  # /feature, but no /bug
    gh = _FakeGitHub(labels=("ready-for-agent", "bug"))
    out = travis_sdlc.start_ticket("#22", str(wd), None, client=gh,
                                   preflight=Preflight(user_commands_dir=_no_user(tmp_path)))
    assert isinstance(out, Refusal) and out.missing == ("bug",)
    assert gh.writes == []

    explicit = Preflight(plan_type="feature", user_commands_dir=_no_user(tmp_path))
    assert isinstance(travis_sdlc.start_ticket("#22", str(wd), None, client=_FakeGitHub(
        labels=("ready-for-agent", "bug")), preflight=explicit), Ticket)


def test_a_worktree_run_passes_on_a_base_ref_that_has_the_commands(tmp_path):
    wd = _repo(tmp_path / "wd")
    _git(["checkout", "-qb", "installed"], wd)
    _install(wd, FEATURE_RUN)
    _git(["add", "-A"], wd)
    _git(["commit", "-qm", "install commands"], wd)
    _git(["checkout", "-q", "main"], wd)

    gh = _FakeGitHub()
    ok = travis_sdlc.start_ticket("#22", str(wd), None, client=gh, preflight=Preflight(
        worktree=True, worktree_base="installed", user_commands_dir=_no_user(tmp_path)))
    assert isinstance(ok, Ticket)

    # Without origin/main the worktree is cut from HEAD (main), which lacks them.
    gh = _FakeGitHub()
    out = travis_sdlc.start_ticket("#22", str(wd), None, client=gh, preflight=Preflight(
        worktree=True, user_commands_dir=_no_user(tmp_path)))
    assert isinstance(out, Refusal) and out.reason == "target_not_installed"
    assert "HEAD" in out.message
    assert gh.writes == []


def test_a_worktree_run_ignores_commands_only_in_the_working_tree(tmp_path):
    wd = _repo(tmp_path / "wd")
    _install(wd, FEATURE_RUN)  # untracked: the worktree will not have them
    gh = _FakeGitHub()
    out = travis_sdlc.start_ticket("#22", str(wd), None, client=gh, preflight=Preflight(
        worktree=True, user_commands_dir=_no_user(tmp_path)))
    assert isinstance(out, Refusal) and out.reason == "target_not_installed"
    assert gh.writes == []


def test_resume_of_the_claiming_run_skips_the_check(tmp_path):
    gh = _FakeGitHub(labels=("ready-for-agent", IN_PROGRESS_LABEL))
    state = {"ticket_ref": f"{REPO}#22"}

    class _S:
        def get(self, key, default=None):
            return state.get(key, default)

    out = travis_sdlc.start_ticket(f"{REPO}#22", str(tmp_path / "empty"), _S(), client=gh,
                                   preflight=Preflight(user_commands_dir=_no_user(tmp_path)))
    assert isinstance(out, Ticket)
    assert gh.writes == []
