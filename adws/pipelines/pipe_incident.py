#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pydantic"]
# ///

"""pipe_incident — Incident triage pipeline, first slice (replay-mode evidence
collection; lenses and verdict synthesis land in a later slice).

Payload -> ±2h window -> service-map lookup -> replay collectors -> evidence/
+ index.json, all recorded in PipelineState. Lenses and verdict synthesis are
a later slice — this run records "lenses" as skipped, loudly, and never imports an agent
module. No network calls anywhere in this file or its replay-mode reuse
surfaces (incident_types, collectors) — --live is not built yet.

CLI:
    uv run adws/pipelines/pipe_incident.py --payload FILE --replay DIR
      [--adw-id ID]
"""

import sys
from datetime import timedelta
from pathlib import Path
from typing import Dict, List

# adws/pipelines/pipe_incident.py -> need "adws" on sys.path (same convention
# as pipe_chore.py, anchored from this file's own location); harness root
# (repo root) is one level up from "adws".
_ADWS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ADWS_DIR))
_HARNESS_ROOT = _ADWS_DIR.parent

from pipelines.collectors import collect_all  # noqa: E402
from pipelines.incident_types import (  # noqa: E402
    IncidentConfigError,
    load_incident_map,
    load_payload,
    resolve_service,
)
from pipelines.pipeline_state import PipelineState  # noqa: E402
from adw_modules.utils import make_adw_id  # noqa: E402

FLAGS = ("--payload", "--replay", "--adw-id")

USAGE = (
    "Usage: uv run adws/pipelines/pipe_incident.py --payload FILE --replay DIR "
    "[--adw-id ID]"
)


def _parse_args(argv: List[str]) -> Dict[str, str]:
    """Manual argv parsing: only the 3 named flags, no positionals. Raises
    ValueError on an unknown/positional arg, a flag missing its value, or a
    missing required flag — the caller turns that into usage + exit 1."""
    opts: Dict[str, str] = {}
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg not in FLAGS:
            raise ValueError(f"unexpected argument: {arg!r} (no positional args)")
        if i + 1 >= len(argv):
            raise ValueError(f"{arg} requires a value")
        opts[arg] = argv[i + 1]
        i += 2
    if "--payload" not in opts:
        raise ValueError("--payload is required")
    if "--replay" not in opts:
        raise ValueError(
            "--replay is required — live mode is not built yet — this "
            "pipeline currently runs replay only"
        )
    return opts


def main() -> None:
    try:
        opts = _parse_args(sys.argv[1:])
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        print(USAGE, file=sys.stderr)
        sys.exit(1)

    try:
        payload = load_payload(opts["--payload"])
    except IncidentConfigError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    window = (
        int((payload.fired_at - timedelta(hours=2)).timestamp()),
        int((payload.fired_at + timedelta(hours=2)).timestamp()),
    )

    mapping_path = _HARNESS_ROOT / "adw_incident.json"
    try:
        mapping = load_incident_map(str(mapping_path))
    except IncidentConfigError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    adw_id = opts.get("--adw-id") or make_adw_id()
    replay_dir = str(Path(opts["--replay"]).resolve())
    state = PipelineState(
        adw_id=adw_id, pipeline="incident", prompt=payload.alert_name, working_dir=replay_dir
    )

    service = resolve_service(mapping, payload.resource)
    if service is None:
        print(f"WARNING: no mapping for resource {payload.resource!r} in "
              f"{mapping_path} — code lens will be skipped (later slice)", file=sys.stderr)
        state.set_phase_result("mapping", {"mapped": False, "resource": payload.resource})
    else:
        state.set_phase_result("mapping", {"mapped": True, "repos": service.repos})

    out_dir = _HARNESS_ROOT / "agents" / adw_id / "incident" / "evidence"
    results = collect_all(payload, window, str(out_dir), "replay", replay_dir, mapping)

    n_ok = n_empty = n_error = 0
    for r in results:
        state.add_iteration({"collector": r.collector, "status": r.status})
        if r.status == "ok":
            n_ok += 1
        elif r.status == "empty":
            n_empty += 1
        else:
            n_error += 1
    # All-empty replay = FAIL: a zero-snapshot fixture is broken; live-mode empties are a later slice's call.
    collect_success = n_error == 0 and n_ok > 0
    if n_error == 0 and n_ok == 0:
        print(f"Error: 0 evidence snapshots collected — {replay_dir} has no evidence/*.json (broken fixture?)", file=sys.stderr)
    state.set_phase_result("collect", {"success": collect_success, "ok": n_ok,
                                        "empty": n_empty, "error": n_error})

    state.set_phase_result("lenses", {"success": False, "skipped": "not implemented yet"})
    print("lenses: skipped (not implemented yet)")

    index_path = out_dir / "index.json"
    overall_success = collect_success and index_path.exists()
    state.overall_success = overall_success
    state.save()

    for r in results:
        print(f"{r.collector}: {r.status}")
    print(f"evidence dir: {out_dir}")
    print(f"state: {PipelineState._state_file_path(adw_id)}")
    print("PASS" if overall_success else "FAIL")
    sys.exit(0 if overall_success else 1)


if __name__ == "__main__":
    main()
