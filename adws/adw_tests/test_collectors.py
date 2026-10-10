#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic"]
# ///

"""Tests for pipelines/collectors/ — the four evidence collectors (REPLAY
mode only) plus the pure bounding helpers.

Usage:
    uv run pytest adws/adw_tests/test_collectors.py -q

Hermetic, no network, no agent imports. Covers:
  (a) downsample_series: 1000-point series -> <=120 points, first/last
      preserved, original_count 1000; 5-point series passes through
      unchanged.
  (b) cluster_log_lines: lines differing only in ids/timestamps/digits
      collapse to one pattern with correct count and <=3 exemplars; top_n
      enforced; deterministic tie order (count desc, pattern asc).
  (c) replay ok path per collector: valid snapshot -> status ok, artifact
      written under out_dir, ids prefixed correctly (m-/l-/d-/c-).
  (d) missing snapshot -> "empty"; corrupt JSON -> "error"; wrong shape ->
      "error"; collect_all always returns 4 results and writes index.json
      containing only the ok collectors' ids.
  (e) a collector that raises unexpectedly -> its result is status "error",
      the other three still run.
  (f) mode="live" -> IncidentConfigError propagates (from the first
      collector, both at the single-collector and collect_all level).
  (g) index.json ids exactly match the union of ok results' evidence_ids.
"""

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from pipelines import collectors as collectors_pkg  # noqa: E402
from pipelines.collectors import config_inspect, dd_logs, dd_metrics, deploy_correlation  # noqa: E402
from pipelines.collectors.bounding import cluster_log_lines, downsample_series  # noqa: E402
from pipelines.incident_types import IncidentConfigError, IncidentPayload  # noqa: E402

REDIS_PAYLOAD = {
    "incident_id": "inc-cache-01",
    "source": "datadog",
    "alert_name": "Cache load high",
    "resource": "cache-prod-01",
    "resource_class": "cache",
    "fired_at": "2026-07-12T14:05:00Z",
}


def _payload() -> IncidentPayload:
    return IncidentPayload.model_validate(REDIS_PAYLOAD)


WINDOW = {"start": "2026-07-12T13:50:00Z", "end": "2026-07-12T14:10:00Z"}


def _write_snapshot(replay_dir: Path, name: str, data) -> None:
    evidence_dir = replay_dir / "evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    (evidence_dir / f"{name}.json").write_text(json.dumps(data))


def _write_corrupt(replay_dir: Path, name: str) -> None:
    evidence_dir = replay_dir / "evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    (evidence_dir / f"{name}.json").write_text("{not valid json")


VALID_DD_METRICS = {
    "series": [
        {"metric": "redis.cpu.load", "scope": "resource:cache-prod-01",
         "points": [[1.0, 0.5], [2.0, 0.6]], "original_count": 2},
        {"metric": "redis.mem.used", "scope": "resource:cache-prod-01",
         "points": [[1.0, 100.0]], "original_count": 1},
    ]
}

VALID_DD_LOGS = {
    "patterns": [
        {"pattern": "ERROR at <TS> conn=<ID> retries=#", "count": 5,
         "exemplars": ["ERROR at 2026-07-12T14:00:00Z conn=deadbeef retries=3"]},
        {"pattern": "INFO ok", "count": 1, "exemplars": ["INFO ok"]},
    ]
}

VALID_DEPLOY_CORRELATION = {
    "changes": [
        {"sha": "a1b2c3d", "ts": "2026-07-12T13:00:00Z", "summary": "bump redis pool size",
         "files": ["config/redis.yaml"], "source": "git"},
    ]
}

VALID_CONFIG_INSPECT = {
    "files": [
        {"repo": "org/checkout-service", "path": "config/redis.yaml", "excerpt": "pool_size: 10"},
    ]
}


# --- (a) downsample_series -----------------------------------------------


def test_downsample_series_empty_input():
    assert downsample_series([], 120) == {"points": [], "original_count": 0}


def test_downsample_series_large_series_bounded_and_endpoints_preserved():
    points = [(float(i), float(i) * 2) for i in range(1000)]

    result = downsample_series(points, max_points=120)

    assert len(result["points"]) <= 120
    assert result["original_count"] == 1000
    assert result["points"][0] == [0.0, 0.0]
    assert result["points"][-1] == [999.0, 1998.0]


def test_downsample_series_small_series_passes_through_unchanged():
    points = [(float(i), float(i) * 10) for i in range(5)]

    result = downsample_series(points, max_points=120)

    assert result == {
        "points": [[0.0, 0.0], [1.0, 10.0], [2.0, 20.0], [3.0, 30.0], [4.0, 40.0]],
        "original_count": 5,
    }


# --- (b) cluster_log_lines -------------------------------------------------


def test_cluster_log_lines_collapses_ids_timestamps_and_digits():
    lines = [
        "ERROR at 2026-07-12T14:00:00Z conn=deadbeefcafefeed retries=3",
        "ERROR at 2026-07-12T14:01:05Z conn=abcdefabcdefabcd retries=9",
        "ERROR at 2026-07-12T14:02:11Z conn=0123456789abcdef retries=1",
        "INFO all clear",
    ]

    clusters = cluster_log_lines(lines, top_n=20, exemplars=3)

    assert len(clusters) == 2
    top = clusters[0]
    assert top["pattern"] == "ERROR at <TS> conn=<ID> retries=#"
    assert top["count"] == 3
    assert len(top["exemplars"]) == 3
    assert clusters[1] == {"pattern": "INFO all clear", "count": 1, "exemplars": ["INFO all clear"]}


def test_cluster_log_lines_exemplars_capped_below_full_count():
    lines = [f"ERROR retry {i} at 2026-07-12T14:0{i}:00Z" for i in range(5)]

    clusters = cluster_log_lines(lines, top_n=20, exemplars=3)

    assert len(clusters) == 1
    assert clusters[0]["count"] == 5
    assert len(clusters[0]["exemplars"]) == 3


def test_cluster_log_lines_top_n_enforced_and_deterministic_order():
    words = ["apple", "banana", "cherry", "date", "elderberry", "fig", "grape", "honeydew"]
    lines = [f"{w} message" for w in words]  # each pattern occurs exactly once -> tie on count

    clusters = cluster_log_lines(lines, top_n=5, exemplars=3)

    assert len(clusters) == 5
    assert [c["pattern"] for c in clusters] == [f"{w} message" for w in sorted(words)[:5]]
    assert all(c["count"] == 1 for c in clusters)


# --- (c) replay ok path per collector ---------------------------------------


def test_dd_metrics_ok_path(tmp_path):
    _write_snapshot(tmp_path, "dd_metrics", VALID_DD_METRICS)
    out_dir = tmp_path / "out"

    result = dd_metrics.collect(_payload(), WINDOW, str(out_dir), "replay", str(tmp_path), {})

    assert result.status == "ok"
    assert result.evidence_ids == ["m-01", "m-02"]
    assert result.artifact_path == str(out_dir / "dd_metrics.json")
    assert (out_dir / "dd_metrics.json").exists()
    assert result.summary_stats == {"window": WINDOW, "series_count": 2}
    written = json.loads((out_dir / "dd_metrics.json").read_text())
    assert len(written["series"]) == 2


def test_dd_logs_ok_path(tmp_path):
    _write_snapshot(tmp_path, "dd_logs", VALID_DD_LOGS)
    out_dir = tmp_path / "out"

    result = dd_logs.collect(_payload(), WINDOW, str(out_dir), "replay", str(tmp_path), {})

    assert result.status == "ok"
    assert result.evidence_ids == ["l-01", "l-02"]
    assert (out_dir / "dd_logs.json").exists()
    assert result.summary_stats == {"window": WINDOW, "pattern_count": 2}


def test_deploy_correlation_ok_path(tmp_path):
    _write_snapshot(tmp_path, "deploy_correlation", VALID_DEPLOY_CORRELATION)
    out_dir = tmp_path / "out"

    result = deploy_correlation.collect(_payload(), WINDOW, str(out_dir), "replay", str(tmp_path), {})

    assert result.status == "ok"
    assert result.evidence_ids == ["d-01"]
    assert (out_dir / "deploy_correlation.json").exists()
    assert result.summary_stats == {"window": WINDOW, "change_count": 1}


def test_config_inspect_ok_path(tmp_path):
    _write_snapshot(tmp_path, "config_inspect", VALID_CONFIG_INSPECT)
    out_dir = tmp_path / "out"

    result = config_inspect.collect(_payload(), WINDOW, str(out_dir), "replay", str(tmp_path), {})

    assert result.status == "ok"
    assert result.evidence_ids == ["c-01"]
    assert (out_dir / "config_inspect.json").exists()
    assert result.summary_stats == {"window": WINDOW, "file_count": 1}


# --- (d) missing / corrupt / wrong-shape, and collect_all's 4-result guarantee --


def test_missing_snapshot_returns_empty_status(tmp_path):
    out_dir = tmp_path / "out"

    result = dd_metrics.collect(_payload(), WINDOW, str(out_dir), "replay", str(tmp_path), {})

    assert result.status == "empty"
    assert result.artifact_path is None
    assert result.evidence_ids == []
    assert result.summary_stats == {"note": "no snapshot in fixture"}
    assert not out_dir.exists()


def test_corrupt_json_returns_error_status(tmp_path):
    _write_corrupt(tmp_path, "dd_logs")
    out_dir = tmp_path / "out"

    result = dd_logs.collect(_payload(), WINDOW, str(out_dir), "replay", str(tmp_path), {})

    assert result.status == "error"
    assert result.artifact_path is None
    assert result.evidence_ids == []
    assert result.error


def test_wrong_shape_returns_error_status(tmp_path):
    _write_snapshot(tmp_path, "dd_metrics", {"series": "not-a-list"})
    out_dir = tmp_path / "out"

    result = dd_metrics.collect(_payload(), WINDOW, str(out_dir), "replay", str(tmp_path), {})

    assert result.status == "error"
    assert result.artifact_path is None
    assert result.evidence_ids == []
    assert result.error


def test_collect_all_mixed_statuses_writes_index_with_only_ok_ids(tmp_path):
    # dd_metrics: ok (2 series); dd_logs: missing -> empty;
    # deploy_correlation: corrupt -> error; config_inspect: ok (1 file).
    _write_snapshot(tmp_path, "dd_metrics", VALID_DD_METRICS)
    _write_corrupt(tmp_path, "deploy_correlation")
    _write_snapshot(tmp_path, "config_inspect", VALID_CONFIG_INSPECT)
    out_dir = tmp_path / "out"

    results = collectors_pkg.collect_all(_payload(), WINDOW, str(out_dir), "replay", str(tmp_path), {})

    assert len(results) == 4
    by_name = {r.collector: r for r in results}
    assert by_name["dd_metrics"].status == "ok"
    assert by_name["dd_logs"].status == "empty"
    assert by_name["deploy_correlation"].status == "error"
    assert by_name["config_inspect"].status == "ok"

    index = json.loads((out_dir / "index.json").read_text())
    expected_ids = set(by_name["dd_metrics"].evidence_ids) | set(by_name["config_inspect"].evidence_ids)
    assert set(index["evidence"].keys()) == expected_ids == {"m-01", "m-02", "c-01"}
    assert index["evidence"]["m-01"] == {"collector": "dd_metrics", "artifact": by_name["dd_metrics"].artifact_path}
    assert index["evidence"]["c-01"] == {"collector": "config_inspect", "artifact": by_name["config_inspect"].artifact_path}


def test_collect_all_with_no_snapshots_returns_4_empty_results_and_empty_index(tmp_path):
    out_dir = tmp_path / "out"

    results = collectors_pkg.collect_all(_payload(), WINDOW, str(out_dir), "replay", str(tmp_path), {})

    assert len(results) == 4
    assert all(r.status == "empty" for r in results)
    index = json.loads((out_dir / "index.json").read_text())
    assert index == {"evidence": {}}


# --- (e) one collector raises unexpectedly -> error, the other three still run --


def test_collect_all_survives_one_collector_raising_unexpectedly(tmp_path, monkeypatch):
    _write_snapshot(tmp_path, "dd_metrics", VALID_DD_METRICS)
    _write_snapshot(tmp_path, "deploy_correlation", VALID_DEPLOY_CORRELATION)
    _write_snapshot(tmp_path, "config_inspect", VALID_CONFIG_INSPECT)
    # dd_logs has a valid snapshot too, but its collect() is monkeypatched to
    # blow up unconditionally, to prove the OTHER three still complete.
    _write_snapshot(tmp_path, "dd_logs", VALID_DD_LOGS)

    def _boom(payload, window, out_dir, mode, replay_dir, mapping):
        raise RuntimeError("dd_logs blew up")

    patched = [(name, _boom if name == "dd_logs" else fn) for name, fn in collectors_pkg.COLLECTORS]
    monkeypatch.setattr(collectors_pkg, "COLLECTORS", patched)

    out_dir = tmp_path / "out"
    results = collectors_pkg.collect_all(_payload(), WINDOW, str(out_dir), "replay", str(tmp_path), {})

    assert len(results) == 4
    by_name = {r.collector: r for r in results}
    assert by_name["dd_logs"].status == "error"
    assert "dd_logs blew up" in by_name["dd_logs"].error
    assert by_name["dd_metrics"].status == "ok"
    assert by_name["deploy_correlation"].status == "ok"
    assert by_name["config_inspect"].status == "ok"


# --- (f) mode="live" -> IncidentConfigError propagates ----------------------


def test_single_collector_live_mode_raises_incident_config_error(tmp_path):
    with pytest.raises(IncidentConfigError):
        dd_metrics.collect(_payload(), WINDOW, str(tmp_path / "out"), "live", str(tmp_path), {})


def test_collect_all_live_mode_propagates_incident_config_error_from_first_collector(tmp_path):
    with pytest.raises(IncidentConfigError) as excinfo:
        collectors_pkg.collect_all(_payload(), WINDOW, str(tmp_path / "out"), "live", str(tmp_path), {})

    assert "dd_metrics" in str(excinfo.value)


# --- (g) index.json ids exactly match the union of ok results' evidence_ids --


def test_index_ids_exactly_match_union_of_ok_evidence_ids(tmp_path):
    _write_snapshot(tmp_path, "dd_metrics", VALID_DD_METRICS)
    _write_snapshot(tmp_path, "dd_logs", VALID_DD_LOGS)
    _write_snapshot(tmp_path, "deploy_correlation", VALID_DEPLOY_CORRELATION)
    _write_snapshot(tmp_path, "config_inspect", VALID_CONFIG_INSPECT)
    out_dir = tmp_path / "out"

    results = collectors_pkg.collect_all(_payload(), WINDOW, str(out_dir), "replay", str(tmp_path), {})

    union_ids = set()
    for r in results:
        assert r.status == "ok"
        union_ids |= set(r.evidence_ids)

    index = json.loads((out_dir / "index.json").read_text())
    assert set(index["evidence"].keys()) == union_ids
    assert union_ids == {"m-01", "m-02", "l-01", "l-02", "d-01", "c-01"}
