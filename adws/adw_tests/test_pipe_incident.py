#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic"]
# ///

"""Tests for pipelines/pipe_incident.py — the first slice of the incident
triage pipeline (replay-mode evidence collection, lenses skipped).

Usage:
    uv run pytest adws/adw_tests/test_pipe_incident.py -q

Hermetic, no network, no agent imports. pipe_incident.main() is invoked
in-process (monkeypatched sys.argv), mirroring test_factory.py /
test_pipe_chore.py: pytest.raises(SystemExit) catches the exit code, and an
adw_id fixture cleans up agents/<adw_id> afterward. Uses the real
evals/incidents/synthetic-smoke/ fixture (SYNTHETIC, not graded — see its
README.md) as the happy-path input; this also proves the fixture validates
against the T2 collector snapshot schemas end-to-end.

Covers:
  (a) happy path -> exit 0; 4 evidence files + index.json written; state has
      pipeline "incident", collect.success True, lenses.skipped, 4
      iterations, overall_success True.
  (b) zero-network proof: socket.socket monkeypatched to raise -> happy path
      still exits 0 (nothing in the replay path opens a socket).
  (c) a corrupted snapshot (tmp copy of the fixture) -> that collector's
      status is "error", collect.success False, exit 1, index.json still
      written with the other collectors' ids.
  (d) --payload missing file / invalid JSON -> exit 1 with a clear stderr
      error.
  (e) --replay omitted -> usage error saying live mode is not built yet /
      replay-only; --payload
      omitted -> usage error.
  (f) unmapped resource (no adw_incident.json at repo root — none is
      created by this test suite) -> WARNING on stderr naming the resource;
      state.phase_results.mapping.mapped is False.
  (g) --adw-id is honored: state lands at agents/<given id>/pipeline_state.json.
"""

import json
import shutil
import sys
import uuid
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

import pipelines.pipe_incident as pipe_incident  # noqa: E402

FIXTURE_DIR = REPO_ROOT / "evals" / "incidents" / "synthetic-smoke"
PAYLOAD_PATH = FIXTURE_DIR / "payload.json"
ADW_INCIDENT_JSON = REPO_ROOT / "adw_incident.json"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def adw_id():
    """A unique adw_id per test, with agents/<adw_id> cleaned up afterward
    (mirrors test_factory.py's fixture)."""
    generated = f"test-pipe-incident-{uuid.uuid4().hex[:8]}"
    yield generated
    state_dir = REPO_ROOT / "agents" / generated
    if state_dir.exists():
        shutil.rmtree(state_dir)


def _run_main(monkeypatch, argv):
    monkeypatch.setattr(sys, "argv", ["pipe_incident.py"] + argv)
    with pytest.raises(SystemExit) as exc_info:
        pipe_incident.main()
    return exc_info.value.code


def _load_state(adw_id: str) -> dict:
    return json.loads((REPO_ROOT / "agents" / adw_id / "pipeline_state.json").read_text())


def _evidence_dir(adw_id: str) -> Path:
    return REPO_ROOT / "agents" / adw_id / "incident" / "evidence"


# ---------------------------------------------------------------------------
# (a) happy path on the real synthetic fixture
# ---------------------------------------------------------------------------


def test_happy_path_on_synthetic_fixture(adw_id, monkeypatch):
    code = _run_main(monkeypatch, ["--payload", str(PAYLOAD_PATH), "--replay",
                                    str(FIXTURE_DIR), "--adw-id", adw_id])

    assert code == 0
    evidence_dir = _evidence_dir(adw_id)
    for name in ("dd_metrics", "dd_logs", "deploy_correlation", "config_inspect"):
        assert (evidence_dir / f"{name}.json").exists(), f"missing {name}.json artifact"
    assert (evidence_dir / "index.json").exists()

    state = _load_state(adw_id)
    assert state["pipeline"] == "incident"
    assert state["phase_results"]["collect"]["success"] is True
    assert state["phase_results"]["lenses"]["skipped"] == "not implemented yet"
    assert state["overall_success"] is True
    assert len(state["iterations"]) == 4
    by_collector = {it["collector"]: it["status"] for it in state["iterations"]}
    assert by_collector == {
        "dd_metrics": "ok", "dd_logs": "ok", "deploy_correlation": "ok", "config_inspect": "ok",
    }


# ---------------------------------------------------------------------------
# (b) zero-network proof
# ---------------------------------------------------------------------------


def test_zero_network_proof_socket_never_instantiated(adw_id, monkeypatch):
    import socket

    def _boom(*args, **kwargs):
        raise AssertionError("socket.socket must not be instantiated in replay mode")

    monkeypatch.setattr(socket, "socket", _boom)

    code = _run_main(monkeypatch, ["--payload", str(PAYLOAD_PATH), "--replay",
                                    str(FIXTURE_DIR), "--adw-id", adw_id])

    assert code == 0


# --- all-empty replay = FAIL (review decision) ---------------------------


def test_all_empty_replay_fails_loudly(adw_id, tmp_path, monkeypatch, capsys):
    # A replay dir with no evidence/*.json at all: every collector returns
    # "empty", and a fixture with zero snapshots is a broken fixture — FAIL,
    # never a silent PASS on nothing.
    bare = tmp_path / "bare-fixture"
    (bare / "evidence").mkdir(parents=True)

    code = _run_main(monkeypatch, ["--payload", str(PAYLOAD_PATH), "--replay",
                                    str(bare), "--adw-id", adw_id])

    assert code == 1
    assert "0 evidence snapshots collected" in capsys.readouterr().err
    state = _load_state(adw_id)
    assert state["phase_results"]["collect"] == {
        "success": False, "ok": 0, "empty": 4, "error": 0,
    }
    assert state["overall_success"] is False


# ---------------------------------------------------------------------------
# (c) a corrupted snapshot -> that collector errors, others still recorded
# ---------------------------------------------------------------------------


def test_corrupted_snapshot_marks_collector_error_and_fails(adw_id, tmp_path, monkeypatch):
    fixture_copy = tmp_path / "synthetic-smoke"
    shutil.copytree(FIXTURE_DIR, fixture_copy)
    (fixture_copy / "evidence" / "dd_logs.json").write_text("{not valid json")

    code = _run_main(monkeypatch, ["--payload", str(fixture_copy / "payload.json"), "--replay",
                                    str(fixture_copy), "--adw-id", adw_id])

    assert code == 1
    state = _load_state(adw_id)
    by_collector = {it["collector"]: it["status"] for it in state["iterations"]}
    assert by_collector["dd_logs"] == "error"
    assert by_collector["dd_metrics"] == "ok"
    assert by_collector["deploy_correlation"] == "ok"
    assert by_collector["config_inspect"] == "ok"
    assert state["phase_results"]["collect"]["success"] is False
    assert state["overall_success"] is False

    index_path = _evidence_dir(adw_id) / "index.json"
    assert index_path.exists()
    index = json.loads(index_path.read_text())
    assert any(k.startswith("m-") for k in index["evidence"])
    assert any(k.startswith("d-") for k in index["evidence"])
    assert any(k.startswith("c-") for k in index["evidence"])
    assert not any(k.startswith("l-") for k in index["evidence"])


# ---------------------------------------------------------------------------
# (d) bad --payload
# ---------------------------------------------------------------------------


def test_missing_payload_file_exits_1_with_clear_error(tmp_path, monkeypatch, capsys):
    missing = tmp_path / "does-not-exist.json"

    code = _run_main(monkeypatch, ["--payload", str(missing), "--replay", str(FIXTURE_DIR)])

    assert code == 1
    err = capsys.readouterr().err
    assert "Error" in err
    assert str(missing) in err


def test_invalid_json_payload_exits_1(tmp_path, monkeypatch, capsys):
    bad = tmp_path / "payload.json"
    bad.write_text("{not valid json")

    code = _run_main(monkeypatch, ["--payload", str(bad), "--replay", str(FIXTURE_DIR)])

    assert code == 1
    assert "Error" in capsys.readouterr().err


# ---------------------------------------------------------------------------
# (e) missing required flags -> usage errors
# ---------------------------------------------------------------------------


def test_missing_replay_flag_mentions_replay_only(monkeypatch, capsys):
    code = _run_main(monkeypatch, ["--payload", str(PAYLOAD_PATH)])

    assert code == 1
    err = capsys.readouterr().err
    assert "live mode is not built yet" in err
    assert "replay only" in err


def test_missing_payload_flag_is_usage_error(monkeypatch, capsys):
    code = _run_main(monkeypatch, ["--replay", str(FIXTURE_DIR)])

    assert code == 1
    assert "Error" in capsys.readouterr().err


# ---------------------------------------------------------------------------
# (f) unmapped resource -> loud WARNING + state records mapped=False
#
# No adw_incident.json exists at the repo root (nor does this suite create
# one) — the absent-file path is the first slice's default.
# ---------------------------------------------------------------------------


def test_unmapped_resource_warns_and_records_unmapped_in_state(adw_id, monkeypatch, capsys):
    assert not ADW_INCIDENT_JSON.exists(), (
        "adw_incident.json must not exist at repo root for this test's premise to hold"
    )

    code = _run_main(monkeypatch, ["--payload", str(PAYLOAD_PATH), "--replay",
                                    str(FIXTURE_DIR), "--adw-id", adw_id])

    assert code == 0
    err = capsys.readouterr().err
    assert "WARNING" in err
    assert "redis-synthetic-cache-01" in err
    assert str(ADW_INCIDENT_JSON) in err

    state = _load_state(adw_id)
    assert state["phase_results"]["mapping"] == {
        "mapped": False, "resource": "redis-synthetic-cache-01",
    }


# ---------------------------------------------------------------------------
# (g) --adw-id honored
# ---------------------------------------------------------------------------


def test_adw_id_flag_honored_state_path(adw_id, monkeypatch):
    code = _run_main(monkeypatch, ["--payload", str(PAYLOAD_PATH), "--replay",
                                    str(FIXTURE_DIR), "--adw-id", adw_id])

    assert code == 0
    assert (REPO_ROOT / "agents" / adw_id / "pipeline_state.json").exists()
