#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest"]
# ///

"""Tests for the factory's label set and its sync script
(adws/actions/sync_labels.py): the set holds the repo's vocabulary, a dry run
writes nothing, and --apply only creates and corrects, never deletes.

Usage:
    uv run pytest adws/adw_tests/test_factory_labels.py -q
"""

import json
import re
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from actions import sync_labels  # noqa: E402
from actions.sync_labels import Label, load_labels, plan_changes  # noqa: E402
from adw_modules import ticket_resolver  # noqa: E402

REPO = "travism26/claude-code-adw"


def test_the_set_holds_the_documented_vocabulary():
    names = {l.name for l in load_labels()}
    doc = (REPO_ROOT / "docs/agents/triage-labels.md").read_text()
    documented = set(re.findall(r"^\|[^|]*\|\s*`([^`]+)`\s*\|", doc, re.MULTILINE))
    documented |= set(re.findall(r"^\|\s*`([^`]+)`\s*\|", doc, re.MULTILINE))
    assert documented and documented <= names
    assert {ticket_resolver.READY_LABEL, ticket_resolver.IN_PROGRESS_LABEL,
            *ticket_resolver.PLAN_TYPE_LABELS} <= names


def test_in_progress_matches_what_a_ticket_run_creates():
    label = next(l for l in load_labels() if l.name == ticket_resolver.IN_PROGRESS_LABEL)
    assert label.color == ticket_resolver.IN_PROGRESS_COLOR
    assert label.description == ticket_resolver.IN_PROGRESS_DESCRIPTION


def test_every_label_is_well_formed():
    for label in load_labels():
        assert re.fullmatch(r"[0-9a-f]{6}", label.color), label
        assert label.description and len(label.description) <= 100, label


def test_a_label_listed_twice_is_refused(tmp_path):
    f = tmp_path / "labels.json"
    f.write_text(json.dumps({"labels": [{"name": "Bug", "color": "ffffff", "description": "a"},
                                        {"name": "bug", "color": "000000", "description": "b"}]}))
    with pytest.raises(ValueError, match="twice"):
        load_labels(f)


def test_the_plan_creates_missing_corrects_drift_and_keeps_the_rest():
    desired = [Label("rework", "e99695", "d"), Label("bug", "d73a4a", "x"),
               Label("wontfix", "ffffff", "w")]
    existing = [Label("Bug", "D73A4A", "y"), Label("wontfix", "ffffff", "w"),
                Label("question", "cc317c", "extra")]
    changes = plan_changes(desired, existing)
    assert [(c.action, c.label.name) for c in changes] == [("create", "rework"), ("update", "bug")]
    assert sync_labels.command_for(changes[1], REPO)[:3] == ["label", "edit", "Bug"]


def _fake_gh(monkeypatch, existing):
    calls = []

    def gh(args):
        calls.append(args)
        if args[:2] == ["label", "list"]:
            return SimpleNamespace(returncode=0, stdout=json.dumps(existing), stderr="")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(sync_labels, "_gh", gh)
    return calls


def test_a_dry_run_only_reads(monkeypatch, capsys):
    calls = _fake_gh(monkeypatch, [{"name": "bug", "color": "d73a4a", "description": "old"}])
    assert sync_labels.main(["--repo", REPO]) == 0
    assert [c[:2] for c in calls] == [["label", "list"]]
    out = capsys.readouterr().out
    assert "DRY RUN" in out and "create  rework" in out and "update  bug" in out


def test_apply_creates_and_edits_and_never_deletes(monkeypatch):
    calls = _fake_gh(monkeypatch, [{"name": "bug", "color": "d73a4a", "description": "old"},
                                   {"name": "question", "color": "cc317c", "description": "q"}])
    assert sync_labels.main(["--repo", REPO, "--apply"]) == 0
    verbs = [c[1] for c in calls[1:]]
    assert "delete" not in verbs and verbs.count("edit") == 1
    assert verbs.count("create") == len(load_labels()) - 1


def test_a_failed_write_fails_the_run(monkeypatch):
    def gh(args):
        if args[:2] == ["label", "list"]:
            return SimpleNamespace(returncode=0, stdout="[]", stderr="")
        return SimpleNamespace(returncode=1, stdout="", stderr="HTTP 403")

    monkeypatch.setattr(sync_labels, "_gh", gh)
    assert sync_labels.main(["--repo", REPO, "--apply"]) == 1
