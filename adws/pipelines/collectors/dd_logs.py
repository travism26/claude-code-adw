#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pydantic"]
# ///

"""dd_logs collector — Datadog log-pattern evidence.

REPLAY mode only (live Datadog GET is not built yet): reads a pre-clustered snapshot
from <replay_dir>/evidence/dd_logs.json (the shape any live collector must
also write, produced by running raw log lines through
bounding.cluster_log_lines) and republishes it under <out_dir>/dd_logs.json
with per-pattern evidence ids l-01, l-02, ... in order of appearance.
"""

import json
import sys
from pathlib import Path
from typing import Any, List

_ADWS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ADWS_DIR))

from pydantic import BaseModel, ValidationError  # noqa: E402

from pipelines.incident_types import CollectorResult, IncidentConfigError  # noqa: E402

COLLECTOR_NAME = "dd_logs"


class LogPattern(BaseModel):
    """One clustered pattern — the shape bounding.cluster_log_lines
    produces per normalized pattern."""
    pattern: str
    count: int
    exemplars: List[str]


class DdLogsSnapshot(BaseModel):
    patterns: List[LogPattern] = []


def collect(payload: Any, window: Any, out_dir: str, mode: str, replay_dir: str,
            mapping: Any) -> CollectorResult:
    """Replay-only. `mode` must be "replay" — anything else raises
    IncidentConfigError (live is not built yet). Never raises past that check: a
    missing snapshot -> "empty", corrupt JSON or a schema mismatch ->
    "error" with the message, else "ok" with the normalized snapshot
    written to <out_dir>/dd_logs.json."""
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
        snapshot = DdLogsSnapshot.model_validate(raw)
    except ValidationError as e:
        return CollectorResult(collector=COLLECTOR_NAME, status="error", artifact_path=None,
                                evidence_ids=[], summary_stats={}, error=str(e))

    evidence_ids = [f"l-{i + 1:02d}" for i in range(len(snapshot.patterns))]

    out_path = Path(out_dir) / f"{COLLECTOR_NAME}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(snapshot.model_dump_json(indent=2))

    return CollectorResult(
        collector=COLLECTOR_NAME, status="ok", artifact_path=str(out_path),
        evidence_ids=evidence_ids,
        summary_stats={"window": window, "pattern_count": len(snapshot.patterns)},
    )
