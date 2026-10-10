#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pydantic"]
# ///

"""dd_metrics collector — Datadog timeseries evidence.

REPLAY mode only (live Datadog GET is not built yet): reads a pre-bounded snapshot
from <replay_dir>/evidence/dd_metrics.json (the shape any live collector
must also write, produced by running raw points through
bounding.downsample_series per series) and republishes it under
<out_dir>/dd_metrics.json with per-series evidence ids m-01, m-02, ... in
order of appearance.
"""

import json
import sys
from pathlib import Path
from typing import Any, List

_ADWS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ADWS_DIR))

from pydantic import BaseModel, ValidationError  # noqa: E402

from pipelines.incident_types import CollectorResult, IncidentConfigError  # noqa: E402

COLLECTOR_NAME = "dd_metrics"


class MetricSeries(BaseModel):
    """One bounded timeseries — the shape bounding.downsample_series
    produces per metric/scope pair."""
    metric: str
    scope: str
    points: List[List[float]]
    original_count: int


class DdMetricsSnapshot(BaseModel):
    series: List[MetricSeries] = []


def collect(payload: Any, window: Any, out_dir: str, mode: str, replay_dir: str,
            mapping: Any) -> CollectorResult:
    """Replay-only. `mode` must be "replay" — anything else raises
    IncidentConfigError (live is not built yet). Never raises past that check: a
    missing snapshot -> "empty", corrupt JSON or a schema mismatch ->
    "error" with the message, else "ok" with the normalized snapshot
    written to <out_dir>/dd_metrics.json."""
    if mode != "replay":
        raise IncidentConfigError(f"{COLLECTOR_NAME}: mode={mode!r} not supported — live mode is not built yet")

    snapshot_path = Path(replay_dir) / "evidence" / f"{COLLECTOR_NAME}.json"
    if not snapshot_path.exists():
        return CollectorResult(collector=COLLECTOR_NAME, status="empty", artifact_path=None,
                                evidence_ids=[], summary_stats={"note": "no snapshot in fixture"})

    try:
        raw = json.loads(snapshot_path.read_text())
    except (OSError, json.JSONDecodeError) as e:
        return CollectorResult(collector=COLLECTOR_NAME, status="error", artifact_path=None,
                                evidence_ids=[], summary_stats={}, error=str(e))
    try:
        snapshot = DdMetricsSnapshot.model_validate(raw)
    except ValidationError as e:
        return CollectorResult(collector=COLLECTOR_NAME, status="error", artifact_path=None,
                                evidence_ids=[], summary_stats={}, error=str(e))

    evidence_ids = [f"m-{i + 1:02d}" for i in range(len(snapshot.series))]

    out_path = Path(out_dir) / f"{COLLECTOR_NAME}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(snapshot.model_dump_json(indent=2))

    return CollectorResult(
        collector=COLLECTOR_NAME, status="ok", artifact_path=str(out_path),
        evidence_ids=evidence_ids,
        summary_stats={"window": window, "series_count": len(snapshot.series)},
    )
