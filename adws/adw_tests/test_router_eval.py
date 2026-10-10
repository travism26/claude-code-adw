#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic"]
# ///

"""Tests for evals/agents/router/run_router_eval.py — the router's isolated fixture eval
(docs/sdlc-agent-map.md §2 catalog rule: ships with a fixture eval or it doesn't ship).

Usage:
    uv run pytest adws/adw_tests/test_router_eval.py -q

Credential-free (no Claude calls, no network): every test either exercises pure functions
(load_cases, score, exit_ok, render_report, _read_cost) directly, or monkeypatches
run_router_eval.route_ticket / run_router_eval.make_adw_id the same way test_router.py
monkeypatches pipelines.router.prompt_claude_code — the real router agent is never invoked.

Covers the brief's required scenarios:
  - scoring math, per-category and overall (test_score_*)
  - a RouterError counted as a miss without aborting the run (test_run_eval_router_error_*)
  - exit-code logic at the threshold boundary: one category below -> fail; all exactly at the
    threshold -> pass; --min-accuracy 0 -> always pass (test_exit_ok_*)
  - cases.jsonl loads and every line validates: right keys, expected in the enum, 5 per
    category (test_cases_jsonl_*); load_cases also rejects malformed rows (test_load_cases_*)
  - cost aggregation with a missing/malformed jsonl -> 0 + the cost-incomplete flag set
    (test_read_cost_*, test_run_eval_aggregates_cost_*)
"""

import json
import sys
from collections import Counter
from pathlib import Path
from types import SimpleNamespace

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))
sys.path.insert(0, str(REPO_ROOT / "evals" / "agents" / "router"))

import run_router_eval as rre  # noqa: E402


# --- scoring math: per-category and overall ---------------------------------------------------


def test_score_per_category_and_overall_counts():
    results = [
        {"id": "a", "expected": "chore", "got": "chore", "confidence": 0.9, "error": None},
        {"id": "b", "expected": "chore", "got": "bug", "confidence": 0.5, "error": None},
        {"id": "c", "expected": "bug", "got": "bug", "confidence": 0.9, "error": None},
        {"id": "d", "expected": "feature", "got": "feature", "confidence": 0.9, "error": None},
    ]
    scored = rre.score(results)
    assert scored["per_category"]["chore"] == {"correct": 1, "total": 2}
    assert scored["per_category"]["bug"] == {"correct": 1, "total": 1}
    assert scored["per_category"]["feature"] == {"correct": 1, "total": 1}
    assert scored["overall_correct"] == 3
    assert scored["overall_total"] == 4


def test_score_empty_results_all_zero():
    scored = rre.score([])
    assert scored["overall_correct"] == 0
    assert scored["overall_total"] == 0
    for cat in rre.CATEGORIES:
        assert scored["per_category"][cat] == {"correct": 0, "total": 0}


# --- RouterError counted as a miss, run keeps going --------------------------------------------


def test_run_eval_router_error_counted_as_miss_without_aborting(monkeypatch):
    route_by_title = {"ok1": "chore", "ok2": "feature"}

    def fake_route(ticket, adw_id, working_dir, model="sonnet"):
        if ticket["title"] == "boom":
            raise rre.RouterError("agent exploded")
        return SimpleNamespace(route=route_by_title[ticket["title"]], confidence=0.9)

    monkeypatch.setattr(rre, "route_ticket", fake_route)

    cases = [
        {"id": "c1", "ticket": {"title": "ok1", "body": "", "labels": []}, "expected": "chore"},
        {"id": "c2", "ticket": {"title": "boom", "body": "", "labels": []}, "expected": "bug"},
        {"id": "c3", "ticket": {"title": "ok2", "body": "", "labels": []}, "expected": "feature"},
    ]
    run = rre.run_eval(cases, "sonnet", 1, "/tmp")

    assert len(run["results"]) == 3  # the RouterError case did not stop the loop
    boom_result = next(r for r in run["results"] if r["id"] == "c2")
    assert boom_result["got"] == "ERROR"
    assert boom_result["error"] is not None and "agent exploded" in boom_result["error"]

    scored = rre.score(run["results"])
    assert scored["overall_correct"] == 2
    assert scored["overall_total"] == 3
    assert scored["per_category"]["bug"] == {"correct": 0, "total": 1}


def test_run_eval_multiple_trials_all_recorded(monkeypatch):
    monkeypatch.setattr(rre, "route_ticket",
                         lambda ticket, adw_id, working_dir, model="sonnet": SimpleNamespace(route="chore", confidence=0.7))
    cases = [{"id": "c1", "ticket": {"title": "t", "body": "", "labels": []}, "expected": "chore"}]
    run = rre.run_eval(cases, "sonnet", 3, "/tmp")
    assert len(run["results"]) == 3


# --- exit-code logic at the threshold boundary --------------------------------------------------


def _scored(chore, bug, feature):
    return {"per_category": {"chore": chore, "bug": bug, "feature": feature},
            "overall_correct": chore["correct"] + bug["correct"] + feature["correct"],
            "overall_total": chore["total"] + bug["total"] + feature["total"]}


def test_exit_ok_one_category_below_threshold_fails():
    scored = _scored({"correct": 4, "total": 5}, {"correct": 3, "total": 5}, {"correct": 5, "total": 5})
    assert rre.exit_ok(scored, 0.8) is False  # bug is 0.6, below 0.8


def test_exit_ok_all_categories_exactly_at_threshold_passes():
    scored = _scored({"correct": 4, "total": 5}, {"correct": 4, "total": 5}, {"correct": 4, "total": 5})
    assert rre.exit_ok(scored, 0.8) is True  # each is exactly 0.8 -- boundary is inclusive


def test_exit_ok_min_accuracy_zero_is_always_report_only_pass():
    scored = _scored({"correct": 0, "total": 5}, {"correct": 0, "total": 5}, {"correct": 0, "total": 5})
    assert rre.exit_ok(scored, 0.0) is True


def test_exit_ok_category_with_no_cases_excluded_from_gate():
    scored = _scored({"correct": 5, "total": 5}, {"correct": 5, "total": 5}, {"correct": 0, "total": 0})
    assert rre.exit_ok(scored, 0.8) is True  # feature has no data -- can't fail a gate it has none for


# --- cases.jsonl loads and every line validates --------------------------------------------------


def test_cases_jsonl_loads_and_validates():
    cases = rre.load_cases(rre.DEFAULT_CASES)
    assert len(cases) == 15
    ids = set()
    counts = Counter()
    for case in cases:
        assert {"id", "ticket", "expected"} <= case.keys()
        assert case["expected"] in rre.CATEGORIES
        assert case["id"] not in ids, f"duplicate id: {case['id']}"
        ids.add(case["id"])
        ticket = case["ticket"]
        assert {"title", "body", "labels"} <= ticket.keys()
        assert isinstance(ticket["title"], str) and ticket["title"]
        assert isinstance(ticket["labels"], list)
        counts[case["expected"]] += 1
    assert counts == {"chore": 5, "bug": 5, "feature": 5}


def test_cases_jsonl_has_keyword_defeating_cases():
    """Sanity-checks the 4 keyword-defeating cases the brief requires actually exist."""
    cases = {c["id"]: c for c in rre.load_cases(rre.DEFAULT_CASES)}
    assert cases["feature-fix-csv-export"]["ticket"]["title"].startswith("Fix")
    assert cases["feature-fix-csv-export"]["expected"] == "feature"
    assert "add" in cases["chore-add-editorconfig"]["ticket"]["title"]
    assert cases["chore-add-editorconfig"]["expected"] == "chore"
    assert cases["bug-totals-mismatch"]["expected"] == "bug"
    assert "bug" in cases["feature-mute-notifications"]["ticket"]["labels"]
    assert cases["feature-mute-notifications"]["expected"] == "feature"  # label contradicts body; body wins


def test_load_cases_rejects_bad_json_line(tmp_path):
    bad = tmp_path / "cases.jsonl"
    bad.write_text("not json at all\n")
    with pytest.raises(ValueError):
        rre.load_cases(bad)


def test_load_cases_rejects_invalid_expected(tmp_path):
    bad = tmp_path / "cases.jsonl"
    bad.write_text(json.dumps({"id": "x", "ticket": {"title": "t", "body": "b", "labels": []},
                                "expected": "hotfix"}) + "\n")
    with pytest.raises(ValueError):
        rre.load_cases(bad)


def test_load_cases_rejects_missing_ticket_keys(tmp_path):
    bad = tmp_path / "cases.jsonl"
    bad.write_text(json.dumps({"id": "x", "ticket": {"title": "t"}, "expected": "bug"}) + "\n")
    with pytest.raises(ValueError):
        rre.load_cases(bad)


def test_load_cases_skips_blank_lines(tmp_path):
    good = tmp_path / "cases.jsonl"
    line = json.dumps({"id": "x", "ticket": {"title": "t", "body": "b", "labels": []}, "expected": "bug"})
    good.write_text(f"\n{line}\n\n")
    cases = rre.load_cases(good)
    assert len(cases) == 1


# --- cost aggregation: missing jsonl -> 0 + flag set ----------------------------------------------


def test_read_cost_missing_file_returns_zero_and_incomplete(monkeypatch, tmp_path):
    monkeypatch.setattr(rre, "HARNESS_ROOT", tmp_path)
    cost, incomplete = rre._read_cost("does-not-exist")
    assert cost == 0.0
    assert incomplete is True


def test_read_cost_missing_field_returns_zero_and_incomplete(monkeypatch, tmp_path):
    monkeypatch.setattr(rre, "HARNESS_ROOT", tmp_path)
    out_dir = tmp_path / "agents" / "abc123" / "router"
    out_dir.mkdir(parents=True)
    (out_dir / "router.jsonl").write_text(json.dumps({"type": "result"}) + "\n")
    cost, incomplete = rre._read_cost("abc123")
    assert cost == 0.0
    assert incomplete is True


def test_read_cost_reads_last_line_total_cost_usd(monkeypatch, tmp_path):
    monkeypatch.setattr(rre, "HARNESS_ROOT", tmp_path)
    out_dir = tmp_path / "agents" / "abc123" / "router"
    out_dir.mkdir(parents=True)
    (out_dir / "router.jsonl").write_text(
        json.dumps({"type": "assistant"}) + "\n" + json.dumps({"type": "result", "total_cost_usd": 0.0123}) + "\n")
    cost, incomplete = rre._read_cost("abc123")
    assert cost == pytest.approx(0.0123)
    assert incomplete is False


def test_run_eval_aggregates_cost_and_flags_incomplete_on_missing_file(monkeypatch, tmp_path):
    monkeypatch.setattr(rre, "HARNESS_ROOT", tmp_path)
    ids = iter(["id-one", "id-two"])
    monkeypatch.setattr(rre, "make_adw_id", lambda: next(ids))
    monkeypatch.setattr(rre, "route_ticket",
                         lambda ticket, adw_id, working_dir, model="sonnet": SimpleNamespace(route="chore", confidence=0.9))

    out_dir = tmp_path / "agents" / "id-one" / "router"
    out_dir.mkdir(parents=True)
    (out_dir / "router.jsonl").write_text(json.dumps({"type": "result", "total_cost_usd": 0.01}) + "\n")
    # id-two gets no router.jsonl at all -- must fall back to 0 and flip the flag.

    cases = [
        {"id": "c1", "ticket": {"title": "t1", "body": "", "labels": []}, "expected": "chore"},
        {"id": "c2", "ticket": {"title": "t2", "body": "", "labels": []}, "expected": "chore"},
    ]
    run = rre.run_eval(cases, "sonnet", 1, str(tmp_path))
    assert run["total_cost_usd"] == pytest.approx(0.01)
    assert run["cost_incomplete"] is True


# --- CLI plumbing: argv parsing + render_report smoke ---------------------------------------------


def test_parse_args_defaults_to_empty_opts():
    assert rre.parse_args([]) == {}


def test_parse_args_unknown_flag_raises():
    with pytest.raises(ValueError):
        rre.parse_args(["--bogus", "x"])


def test_parse_args_positional_argument_raises():
    with pytest.raises(ValueError):
        rre.parse_args(["not-a-flag"])


def test_render_report_contains_result_and_misroute_line():
    scored = rre.score([{"id": "a", "expected": "chore", "got": "bug", "confidence": 0.4, "error": None}])
    run = {"results": [{"id": "a", "expected": "chore", "got": "bug", "confidence": 0.4, "error": None}],
           "total_cost_usd": 0.05, "cost_incomplete": False}
    report = rre.render_report(scored, run, "sonnet", 1, 0.8)
    assert "Router Eval Report" in report
    assert "RESULT: FAIL" in report
    assert "expected=chore" in report and "got=bug" in report
