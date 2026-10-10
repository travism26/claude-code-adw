#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic"]
# ///

"""Tests for pipelines/pipe_chore.py (docs/m2-tasks.md T1).

Usage:
    uv run pytest adws/adw_tests/test_pipe_chore.py -q

Credential-free (no Claude calls): gates are real shell commands (`true` /
`false`) run against a tmp_path working dir, and the build/fixer "agent" is
a fake stand-in for pipelines.core.execute_template, monkeypatched directly
on the pipelines.core module — pipe_chore.py calls core.build_loop() without
overriding its agent_runner, so build_loop's `runner = agent_runner or
execute_template` resolves the *current* value of core.execute_template at
call time, which is exactly the seam monkeypatch.setattr swaps out.

pipe_chore.main() is invoked in-process (not via subprocess) so the
monkeypatched runner is actually used; sys.argv is patched per test and the
resulting sys.exit(code) is caught with pytest.raises(SystemExit).

Covers the 5 scenarios from the T1 brief:
  (a) happy path: fake runner + `true` gate -> exit 0, state file written,
      phase_results.build.success true.
  (b) gate failure exhausts max_iters -> exit 1, overall_success false.
  (c) --gates FILE override is honored over the repo's own adw_gates.json.
  (d) 0 gates resolved -> still runs build, exits per build result, loud
      warning printed.
  (e) flag parsing: unknown flag -> usage + exit 1.
"""

import json
import shutil
import sys
import uuid
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

import pipelines.core as core  # noqa: E402
import pipelines.pipe_chore as pipe_chore  # noqa: E402
from adw_modules.agent import AgentPromptResponse  # noqa: E402
from pipelines.pipeline_state import PipelineState  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def adw_id():
    """A unique adw_id per test, with agents/<adw_id> cleaned up afterward
    (mirrors test_pipeline_core.py's fixture)."""
    generated = f"test-pipe-chore-{uuid.uuid4().hex[:8]}"
    yield generated
    state_dir = REPO_ROOT / "agents" / generated
    if state_dir.exists():
        shutil.rmtree(state_dir)


def _write_gates(path: Path, gates: list) -> None:
    path.write_text(json.dumps({"gates": gates}))


def _run_main(monkeypatch, argv):
    """Run pipe_chore.main() with the given argv (excluding argv[0]);
    returns the captured SystemExit code."""
    monkeypatch.setattr(sys, "argv", ["pipe_chore.py"] + argv)
    with pytest.raises(SystemExit) as exc_info:
        pipe_chore.main()
    return exc_info.value.code


def _always_success_runner(request):
    return AgentPromptResponse(output="ok", success=True)


# ---------------------------------------------------------------------------
# (a) happy path
# ---------------------------------------------------------------------------


def test_happy_path_exits_zero_and_writes_state(tmp_path, adw_id, monkeypatch, capsys):
    _write_gates(tmp_path / "adw_gates.json", [{"name": "unit", "command": "true"}])
    monkeypatch.setattr(core, "execute_template", _always_success_runner)

    code = _run_main(
        monkeypatch,
        ["add a docstring", "--working-dir", str(tmp_path), "--adw-id", adw_id],
    )

    assert code == 0
    out = capsys.readouterr().out
    assert "PASS" in out

    state = PipelineState.load(adw_id)
    assert state.overall_success is True
    assert state.phase_results["build"]["success"] is True

    state_file = REPO_ROOT / "agents" / adw_id / "pipeline_state.json"
    assert state_file.exists()


# ---------------------------------------------------------------------------
# (b) gate failure exhausts max_iters
# ---------------------------------------------------------------------------


def test_gate_failure_exhausts_iters_exits_one(tmp_path, adw_id, monkeypatch, capsys):
    _write_gates(tmp_path / "adw_gates.json", [{"name": "lint", "command": "false"}])
    # Fixer "succeeds" but never actually fixes anything -> lint never passes.
    monkeypatch.setattr(core, "execute_template", _always_success_runner)

    code = _run_main(
        monkeypatch,
        [
            "do the thing",
            "--working-dir",
            str(tmp_path),
            "--adw-id",
            adw_id,
            "--max-iters",
            "2",
        ],
    )

    assert code == 1
    out = capsys.readouterr().out
    assert "FAIL" in out

    state = PipelineState.load(adw_id)
    assert state.overall_success is False


# ---------------------------------------------------------------------------
# (c) --gates FILE override honored
# ---------------------------------------------------------------------------


def test_gates_flag_override_honored(tmp_path, adw_id, monkeypatch):
    # The repo's own adw_gates.json would FAIL if it were used.
    _write_gates(tmp_path / "adw_gates.json", [{"name": "would-fail", "command": "false"}])
    # The override file PASSES — its use is what makes the run succeed.
    override = tmp_path / "custom_gates.json"
    _write_gates(override, [{"name": "custom", "command": "true"}])
    monkeypatch.setattr(core, "execute_template", _always_success_runner)

    code = _run_main(
        monkeypatch,
        [
            "do the thing",
            "--working-dir",
            str(tmp_path),
            "--adw-id",
            adw_id,
            "--gates",
            str(override),
        ],
    )

    assert code == 0
    state = PipelineState.load(adw_id)
    assert state.overall_success is True
    gate_names = {it["gate"] for it in state.iterations}
    assert gate_names == {"custom"}, "must run only the overridden gate, never adw_gates.json"


# ---------------------------------------------------------------------------
# (d) 0 gates resolved -> build-only run, warning printed
# ---------------------------------------------------------------------------


def test_zero_gates_still_runs_build_and_warns(tmp_path, adw_id, monkeypatch, capsys):
    # tmp_path is empty: no adw_gates.json, nothing auto-detectable.
    monkeypatch.setattr(core, "execute_template", _always_success_runner)

    code = _run_main(
        monkeypatch,
        ["add a docstring", "--working-dir", str(tmp_path), "--adw-id", adw_id],
    )

    assert code == 0
    captured = capsys.readouterr()
    assert "0 gates configured" in captured.err
    assert "WARNING" in captured.err

    state = PipelineState.load(adw_id)
    assert state.phase_results["build"]["success"] is True
    assert state.overall_success is True
    assert state.iterations == [], "no gates were resolved, so none should have run"


# ---------------------------------------------------------------------------
# (e) flag parsing: unknown flag -> usage + exit 1
# ---------------------------------------------------------------------------


def test_unknown_flag_prints_usage_and_exits_one(monkeypatch, capsys):
    code = _run_main(monkeypatch, ["do the thing", "--bogus-flag", "x"])

    assert code == 1
    err = capsys.readouterr().err
    assert "unknown flag" in err
    assert "Usage:" in err


def test_invalid_model_prints_usage_and_exits_one_no_traceback(monkeypatch, capsys):
    """--model must be validated against sonnet/opus/haiku during arg
    parsing — an invalid value must produce usage + exit 1, never a raw
    pydantic ValidationError traceback from AgentTemplateRequest."""
    code = _run_main(monkeypatch, ["do the thing", "--model", "gpt-5"])

    assert code == 1
    err = capsys.readouterr().err
    assert "--model" in err
    assert "Usage:" in err
    assert "Traceback" not in err
