#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pydantic"]
# ///

"""Evidence collector registry + collect_all.

Deterministic plugins that turn an IncidentPayload + window into typed
evidence snapshots under an out_dir. REPLAY mode only here — live (real
Datadog/git calls) is not built yet. Datadog, Slack and Teams are example adapters; the pipeline is source-agnostic.
See dd_metrics.py / dd_logs.py /
deploy_correlation.py / config_inspect.py for the per-collector snapshot
schemas (these ARE the fixture format) and
bounding.py for the pure downsample/cluster helpers that produce them.
"""

import json
import sys
import traceback
from pathlib import Path
from typing import Any, Callable, List, Tuple

# adws/pipelines/collectors/__init__.py -> need "adws" on sys.path, one
# extra parent level vs. pipelines/*.py (parents[2] is adws/).
_ADWS_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ADWS_DIR))

from pipelines.incident_types import CollectorResult, IncidentConfigError  # noqa: E402

from . import config_inspect, dd_logs, dd_metrics, deploy_correlation  # noqa: E402

COLLECTORS: List[Tuple[str, Callable[..., CollectorResult]]] = [
    ("dd_metrics", dd_metrics.collect),
    ("dd_logs", dd_logs.collect),
    ("deploy_correlation", deploy_correlation.collect),
    ("config_inspect", config_inspect.collect),
]


def collect_all(payload: Any, window: Any, out_dir: str, mode: str, replay_dir: str,
                 mapping: Any) -> List[CollectorResult]:
    """Run every collector in COLLECTORS order and write <out_dir>/index.json
    from the ok results' evidence ids.

    A collector's own IncidentConfigError (raised for mode != "replay")
    propagates immediately — a wrong mode is a caller bug, not a
    per-collector failure. Any OTHER unexpected exception from a collector
    is caught into a status="error" CollectorResult so one broken collector
    never kills collection."""
    results: List[CollectorResult] = []
    for name, collect_fn in COLLECTORS:
        try:
            result = collect_fn(payload, window, out_dir, mode, replay_dir, mapping)
        except IncidentConfigError:
            raise
        except Exception as e:  # noqa: BLE001 - a broken collector must not kill the run
            result = CollectorResult(
                collector=name, status="error", artifact_path=None, evidence_ids=[],
                summary_stats={}, error=f"{type(e).__name__}: {e}\n{traceback.format_exc()}",
            )
        results.append(result)

    index: dict = {"evidence": {}}
    seen_ids = set()
    for result in results:
        if result.status != "ok":
            continue
        for eid in result.evidence_ids:
            # Impossible by id prefix (m-/l-/d-/c-), asserted anyway.
            assert eid not in seen_ids, f"duplicate evidence id across collectors: {eid}"
            seen_ids.add(eid)
            index["evidence"][eid] = {"collector": result.collector, "artifact": result.artifact_path}

    out_path = Path(out_dir) / "index.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(index, indent=2))

    return results
