#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pydantic", "python-dotenv", "pytest"]
# ///

"""
Test adws/pipelines/core.py — Gate/GateResult, run_gates(), build_loop().

Usage:
    uv run pytest adws/adw_tests/test_pipeline_core.py -q

Credential-free (no Claude calls): gates are real shell commands (`true`,
`false`, `sleep N`) run against a tmp_path working dir, and the build/fixer
"agent" is a fake `agent_runner` injected into build_loop() — never
adw_modules.agent.execute_template. Verifies:

1. run_gates: ordering (first failure stops the run; later gates never run),
   all-pass returns None, and a hung command is hard-killed at its
   timeout_s and reported as timed_out=True.
2. build_loop: a failing fast gate invokes a /fix_gate-style fixer and
   re-runs the gate, converging once the fixer's side effect satisfies the
   gate command; max_iters exhaustion fails loudly and is recorded in state.
3. Slow-gate economics (load-bearing): an always-failing slow gate runs
   EXACTLY TWICE regardless of max_iters, and the fast loop never touches
   it; a pipeline with no slow gates configured skips stage 2 entirely
   (no "fixer-slow" call, ever).
4. PipelineState is written to agents/<adw_id>/pipeline_state.json with
   iterations, phase_results, and overall_success.
"""

import json
import shutil
import sys
import time
import uuid
from pathlib import Path
from typing import Callable, List

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from pipelines.core import Gate, GateResult, run_gates, build_loop, _tail
from pipelines.pipeline_state import PipelineState
from adw_modules.agent import AgentTemplateRequest, AgentPromptResponse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def adw_id():
    """A unique adw_id per test, with agents/<adw_id> cleaned up afterward
    (agents/ is gitignored, but tests shouldn't accumulate junk in it)."""
    generated = f"test-pipeline-core-{uuid.uuid4().hex[:8]}"
    yield generated
    state_dir = REPO_ROOT / "agents" / generated
    if state_dir.exists():
        shutil.rmtree(state_dir)


def make_build_request(
    adw_id: str, working_dir: Path, model: str = "sonnet"
) -> AgentTemplateRequest:
    return AgentTemplateRequest(
        agent_name="build",
        slash_command="/build",
        args=["do the thing"],
        adw_id=adw_id,
        working_dir=str(working_dir),
        model=model,
    )


def make_state(adw_id: str, working_dir: Path) -> PipelineState:
    return PipelineState(
        adw_id=adw_id,
        pipeline="chore",
        prompt="do the thing",
        working_dir=str(working_dir),
    )


def ok_runner_factory() -> Callable[[AgentTemplateRequest], AgentPromptResponse]:
    """An agent_runner that always reports success and does nothing else."""

    def runner(request: AgentTemplateRequest) -> AgentPromptResponse:
        return AgentPromptResponse(output="ok", success=True)

    return runner


# ---------------------------------------------------------------------------
# (a)(b)(c) run_gates
# ---------------------------------------------------------------------------


def test_run_gates_returns_first_failure_and_skips_later_gates(tmp_path):
    ran_marker = tmp_path / "unit_ran.txt"
    gates = [
        Gate(name="compile", command="true"),
        Gate(name="lint", command="false"),
        Gate(name="unit", command=f"echo ran >> {ran_marker}; true"),
    ]

    result = run_gates(gates, str(tmp_path))

    assert isinstance(result, GateResult)
    assert result.gate == "lint"
    assert result.passed is False
    assert result.timed_out is False
    assert not ran_marker.exists(), "gate after the first failure must never run"


def test_run_gates_all_pass_returns_none(tmp_path):
    gates = [
        Gate(name="compile", command="true"),
        Gate(name="lint", command="true"),
        Gate(name="unit", command="true"),
    ]

    assert run_gates(gates, str(tmp_path)) is None


def test_run_gates_timeout_kills_hung_command(tmp_path):
    gate = Gate(name="hangs", command="sleep 5", timeout_s=1)

    start = time.monotonic()
    result = run_gates([gate], str(tmp_path))
    elapsed = time.monotonic() - start

    assert result is not None
    assert result.gate == "hangs"
    assert result.passed is False
    assert result.timed_out is True
    assert elapsed < 4, f"timeout must kill the hung gate promptly, took {elapsed}s"


def test_build_loop_failed_build_records_error_tail(tmp_path, adw_id):
    """F2(b): a failed build must record its response output tail into
    state (`{"success": False, "error": tail-of(build_resp.output)}`) so
    state-based infra scanning (e.g. evals/run_eval.py's
    classify_status_slim, which now scans phase_results for INFRA_ERROR_
    MARKERS) has text to scan — before this, a failed build recorded only
    {"success": False}, with no text anywhere for a session/rate-limit
    marker to be found in.
    """
    build_output = "line 1\nline 2\nClaude Code error: You've hit your session limit"

    def runner(request: AgentTemplateRequest) -> AgentPromptResponse:
        return AgentPromptResponse(output=build_output, success=False)

    build_request = make_build_request(adw_id, tmp_path)
    state = make_state(adw_id, tmp_path)

    result = build_loop(state, build_request, [Gate(name="lint", command="true")],
                         max_iters=3, agent_runner=runner)

    assert result is False
    assert state.overall_success is False
    assert state.phase_results["build"] == {
        "success": False,
        "error": _tail(build_output),
    }
    assert "session limit" in state.phase_results["build"]["error"]


# ---------------------------------------------------------------------------
# (d)(e) build_loop fast-loop convergence and exhaustion
# ---------------------------------------------------------------------------


def test_build_loop_fixer_invoked_and_gate_converges(tmp_path, adw_id):
    """A failing fast gate triggers a fixer; once the fixer's side effect
    (writing a flag file) satisfies the gate command, the loop converges."""
    flag_file = tmp_path / "ok.flag"
    gates = [Gate(name="lint", command=f"test -f {flag_file.name}")]
    calls: List[str] = []

    def runner(request: AgentTemplateRequest) -> AgentPromptResponse:
        calls.append(request.agent_name)
        if request.agent_name.startswith("fixer"):
            flag_file.write_text("fixed")
        return AgentPromptResponse(output="ok", success=True)

    build_request = make_build_request(adw_id, tmp_path)
    state = make_state(adw_id, tmp_path)

    result = build_loop(state, build_request, gates, max_iters=3, agent_runner=runner)

    assert result is True
    assert "build" in calls
    assert "fixer-1" in calls, "fixer must be invoked with agent_name f'fixer-{i}'"
    assert state.overall_success is True
    assert state.phase_results["build"]["success"] is True
    assert state.phase_results["gates"]["success"] is True
    # run_gates recorded the failing check and the passing recheck.
    gate_iterations = [it for it in state.iterations if it["gate"] == "lint"]
    assert len(gate_iterations) == 2
    assert gate_iterations[0]["passed"] is False
    assert gate_iterations[1]["passed"] is True


def test_build_loop_max_iters_exhaustion_fails_and_is_recorded(tmp_path, adw_id):
    """A fast gate that never passes exhausts max_iters and fails loudly."""
    gates = [Gate(name="lint", command="false")]
    runner = ok_runner_factory()  # fixer "succeeds" but never actually fixes anything

    build_request = make_build_request(adw_id, tmp_path)
    state = make_state(adw_id, tmp_path)

    result = build_loop(state, build_request, gates, max_iters=2, agent_runner=runner)

    assert result is False
    assert state.overall_success is False
    assert state.phase_results["gates"] == {"success": False, "iters": 2}
    # Every attempted iteration was recorded, none silently dropped.
    lint_iterations = [it for it in state.iterations if it["gate"] == "lint"]
    assert len(lint_iterations) == 2
    assert all(it["passed"] is False for it in lint_iterations)


def test_fixer_requests_propagate_build_request_model(tmp_path, adw_id):
    """A build on a non-default model must not silently downgrade its
    fixers to the AgentTemplateRequest default — every fixer request (fast
    and slow) must carry the same model as the build request. Fast gate
    converges after one fixer call (so the run reaches stage 2); the slow
    gate always fails (so 'fixer-slow' is also exercised)."""
    flag_file = tmp_path / "ok.flag"
    fast_gate = Gate(name="lint", command=f"test -f {flag_file.name}")
    slow_gate = Gate(name="integration", command="false", slow=True, timeout_s=5)
    fixer_requests: List[AgentTemplateRequest] = []

    def runner(request: AgentTemplateRequest) -> AgentPromptResponse:
        if request.agent_name.startswith("fixer"):
            fixer_requests.append(request)
            if request.agent_name != "fixer-slow":
                flag_file.write_text("fixed")  # converges the fast gate only
        return AgentPromptResponse(output="ok", success=True)

    build_request = make_build_request(adw_id, tmp_path, model="opus")
    state = make_state(adw_id, tmp_path)

    result = build_loop(
        state, build_request, [fast_gate, slow_gate], max_iters=3, agent_runner=runner
    )

    assert result is False, "slow gate never passes, so the pipeline must fail"
    fixer_names = [r.agent_name for r in fixer_requests]
    assert "fixer-1" in fixer_names
    assert "fixer-slow" in fixer_names
    assert all(r.model == "opus" for r in fixer_requests), (
        "every fixer request must carry the build request's model, "
        f"got: {[(r.agent_name, r.model) for r in fixer_requests]}"
    )
    # args is a single JSON payload (the /resolve_failed_test $ARGUMENTS
    # pattern — see fix_gate.md), not positional $1/$2 strings.
    expected_gate_by_name = {"fixer-1": "lint", "fixer-slow": "integration"}
    for r in fixer_requests:
        assert len(r.args) == 1
        payload = json.loads(r.args[0])
        assert payload["gate"] == expected_gate_by_name[r.agent_name]
        assert isinstance(payload["output_tail"], str)


# ---------------------------------------------------------------------------
# (f)(g) slow-gate economics — the load-bearing tests
# ---------------------------------------------------------------------------


def test_slow_gate_runs_exactly_twice_and_fast_loop_never_runs_it(tmp_path, adw_id):
    """An always-failing slow gate must run EXACTLY TWICE total (one initial
    run, one fix-and-rerun) no matter how generous max_iters is, and the
    fast loop must never execute it even once."""
    counter_file = tmp_path / "slow_runs.txt"
    slow_gate = Gate(
        name="integration",
        command=f"echo x >> {counter_file.name}; false",
        slow=True,
        timeout_s=5,
    )
    fast_gate = Gate(name="lint", command="true")  # always converges immediately
    calls: List[str] = []

    def runner(request: AgentTemplateRequest) -> AgentPromptResponse:
        calls.append(request.agent_name)
        return AgentPromptResponse(output="ok", success=True)

    build_request = make_build_request(adw_id, tmp_path)
    state = make_state(adw_id, tmp_path)

    # A generous max_iters — proves the slow-gate count is independent of it.
    result = build_loop(
        state, build_request, [fast_gate, slow_gate], max_iters=5, agent_runner=runner
    )

    assert result is False, "slow gate never passes, so the pipeline must fail"
    assert counter_file.exists()
    run_count = len(counter_file.read_text().splitlines())
    assert run_count == 2, f"slow gate must run exactly twice, ran {run_count} times"
    assert "fixer-slow" in calls
    assert not any(
        name.startswith("fixer-") and name != "fixer-slow" for name in calls
    ), "the fast loop must never invoke a fixer for the slow gate"
    assert state.phase_results["slow_gates"] == {"success": False}


def test_no_slow_gates_skips_stage_two_entirely(tmp_path, adw_id):
    """No slow gates configured => stage 2 never runs: no run_gates(slow)
    call, no 'fixer-slow' agent call, no slow_gates/fix-slow phase result."""
    gates = [Gate(name="lint", command="true")]

    def runner(request: AgentTemplateRequest) -> AgentPromptResponse:
        assert request.agent_name != "fixer-slow", "stage 2 must be fully skipped"
        return AgentPromptResponse(output="ok", success=True)

    build_request = make_build_request(adw_id, tmp_path)
    state = make_state(adw_id, tmp_path)

    result = build_loop(state, build_request, gates, max_iters=3, agent_runner=runner)

    assert result is True
    assert "slow_gates" not in state.phase_results
    assert "fix-slow" not in state.phase_results


# ---------------------------------------------------------------------------
# (h) PipelineState persistence
# ---------------------------------------------------------------------------


def test_state_file_written_with_iterations_phase_results_and_overall_success(
    tmp_path, adw_id
):
    gates = [Gate(name="lint", command="true")]
    runner = ok_runner_factory()

    build_request = make_build_request(adw_id, tmp_path)
    state = make_state(adw_id, tmp_path)

    result = build_loop(state, build_request, gates, max_iters=3, agent_runner=runner)
    assert result is True

    state_file = REPO_ROOT / "agents" / adw_id / "pipeline_state.json"
    assert state_file.exists()

    reloaded = PipelineState.load(adw_id)
    assert reloaded.adw_id == adw_id
    assert reloaded.overall_success is True
    assert isinstance(reloaded.iterations, list) and len(reloaded.iterations) > 0
    assert "build" in reloaded.phase_results
    assert "gates" in reloaded.phase_results
