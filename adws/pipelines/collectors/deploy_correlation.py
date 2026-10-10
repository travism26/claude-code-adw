#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pydantic"]
# ///

"""deploy_correlation collector — git/Datadog deploy-change evidence.

REPLAY mode only: live mode (not built yet) walks real git history in the repo(s)
`mapping` points at for payload.resource, plus Datadog deployment events;
this replay half never touches a real repo — it only reads a pre-fetched
snapshot from <replay_dir>/evidence/deploy_correlation.json and republishes
it under <out_dir>/deploy_correlation.json with per-change evidence ids
d-01, d-02, ... in order of appearance.
"""

import json
import sys
from pathlib import Path
from typing import Any, List, Literal

_ADWS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ADWS_DIR))

from pydantic import BaseModel, ValidationError  # noqa: E402

from pipelines.incident_types import CollectorResult, IncidentConfigError  # noqa: E402

COLLECTOR_NAME = "deploy_correlation"


class DeployChange(BaseModel):
    sha: str
    ts: str
    summary: str
    files: List[str]
    source: Literal["git", "datadog"]


class DeployCorrelationSnapshot(BaseModel):
    changes: List[DeployChange] = []


def collect(payload: Any, window: Any, out_dir: str, mode: str, replay_dir: str,
            mapping: Any) -> CollectorResult:
    """Replay-only. `mode` must be "replay" — anything else raises
    IncidentConfigError (live is not built yet). Never raises past that check: a
    missing snapshot -> "empty", corrupt JSON or a schema mismatch ->
    "error" with the message, else "ok" with the normalized snapshot
    written to <out_dir>/deploy_correlation.json."""
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
        snapshot = DeployCorrelationSnapshot.model_validate(raw)
    except ValidationError as e:
        return CollectorResult(collector=COLLECTOR_NAME, status="error", artifact_path=None,
                                evidence_ids=[], summary_stats={}, error=str(e))

    evidence_ids = [f"d-{i + 1:02d}" for i in range(len(snapshot.changes))]

    out_path = Path(out_dir) / f"{COLLECTOR_NAME}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(snapshot.model_dump_json(indent=2))

    return CollectorResult(
        collector=COLLECTOR_NAME, status="ok", artifact_path=str(out_path),
        evidence_ids=evidence_ids,
        summary_stats={"window": window, "change_count": len(snapshot.changes)},
    )
