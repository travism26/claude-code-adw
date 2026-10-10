#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""Slim-pipeline engine core.

Gate/GateResult model, run_gates(), and the two-stage build_loop() described
in docs/slim-pipelines-plan.md §6.1–§6.2. This module is the composition
point for pipelines (M2) and the repo ship gate — it stays gate-source- and
pipeline-agnostic:

- It never imports gates.py (gate *resolution* — adw_gates.json / auto-detect
  — is a parallel, independent piece of work; this module only ever consumes
  an already-resolved `List[Gate]`).
- `state`, wherever accepted, is duck-typed to four members: methods
  `add_iteration(dict)` and `set_phase_result(str, dict)`, plus an assignable
  `overall_success: bool` attribute and a `save()` method (build_loop sets
  the former and calls the latter at each terminal return). This module
  never needs to import pipeline_state.PipelineState — any object
  implementing that four-member contract works, which is also what makes
  the unit tests easy to write without a real state object.
"""

import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, List, Optional

# Mirrors adws/travis/travis_sdlc.py's sys.path convention: this file lives at
# adws/pipelines/core.py, so two `.parent`s reach adws/, where adw_modules lives.
sys.path.insert(0, str(Path(__file__).parent.parent))

from adw_modules.agent import AgentTemplateRequest, execute_template  # noqa: E402

# Last-resort default for a gate's hard kill timeout (plan §6.1). The
# resolution layer (gates.py) is responsible for setting a larger default
# (1800s) on slow gates — this module only ever honors whatever `timeout_s`
# it is handed.
DEFAULT_TIMEOUT_S = 300
OUTPUT_TAIL_LINES = 200


@dataclass
class Gate:
    """docs/slim-pipelines-plan.md §6.1 — field names/defaults/order are the
    interface contract with gates.py (a parallel brief); do not change."""

    name: str
    command: str
    slow: bool = False
    timeout_s: int = DEFAULT_TIMEOUT_S


@dataclass
class GateResult:
    """docs/slim-pipelines-plan.md §6.1 — field names/order are the interface
    contract with gates.py (a parallel brief); do not change."""

    gate: str
    passed: bool
    timed_out: bool
    output_tail: str


def _tail(text: str, n: int = OUTPUT_TAIL_LINES) -> str:
    """Last ~n lines of combined stdout+stderr, fed to the fix agent."""
    return "\n".join(text.splitlines()[-n:])


def _run_single_gate(gate: Gate, cwd: Optional[str]) -> GateResult:
    """Run one gate's command; a hung/expensive process is hard-killed at
    gate.timeout_s so it fails the gate instead of wedging the pipeline."""
    try:
        proc = subprocess.run(
            gate.command,
            shell=True,
            cwd=cwd,
            capture_output=True,
            timeout=gate.timeout_s,
        )
        stdout = proc.stdout or b""
        stderr = proc.stderr or b""
        combined = (stdout + stderr).decode("utf-8", errors="replace")
        return GateResult(
            gate=gate.name,
            passed=proc.returncode == 0,
            timed_out=False,
            output_tail=_tail(combined),
        )
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout or b""
        stderr = exc.stderr or b""
        # subprocess.run always invokes us with bytes streams (no `text=True`
        # above), but TimeoutExpired's captured output type isn't guaranteed
        # across Python versions, so normalize defensively before concatenating.
        if isinstance(stdout, bytes):
            stdout = stdout.decode("utf-8", errors="replace")
        if isinstance(stderr, bytes):
            stderr = stderr.decode("utf-8", errors="replace")
        return GateResult(
            gate=gate.name,
            passed=False,
            timed_out=True,
            output_tail=_tail(stdout + stderr),
        )


def run_gates(
    gates: List[Gate], cwd: Optional[str], state: Optional[Any] = None
) -> Optional[GateResult]:
    """Run gates in config order; return on the first failure (cheap before
    expensive). Returns None if every gate passes.

    Every gate actually run (pass or fail) is appended to `state` (when
    given) via `state.add_iteration(dict)` so the run history shows every
    gate check, not just the failure that stopped the loop — gates after a
    failure are never run (plan §6.1: "cheap before expensive").
    """
    for gate in gates:
        result = _run_single_gate(gate, cwd)
        if state is not None:
            state.add_iteration(
                {
                    "gate": result.gate,
                    "passed": result.passed,
                    "timed_out": result.timed_out,
                }
            )
        if not result.passed:
            return result
    return None


def _record_phase(state: Optional[Any], phase: str, result: dict) -> None:
    if state is not None:
        state.set_phase_result(phase, result)


def _fixer_request(
    build_request: AgentTemplateRequest, failed: GateResult, agent_name: str
) -> AgentTemplateRequest:
    """Same adw_id/working_dir/model as the build request (plan §6.2); the
    fixer gets the failing gate's name and output tail as a single JSON
    payload (same $ARGUMENTS pattern as /resolve_failed_test — see
    template_claude/commands/fix_gate.md), not positional $1/$2 args.
    `model` is propagated explicitly — a build on opus must not silently
    downgrade its fixers to the AgentTemplateRequest default; picking a
    cheaper fixer tier is a caller-level policy decision, not something
    this engine does implicitly."""
    return AgentTemplateRequest(
        agent_name=agent_name,
        slash_command="/fix_gate",
        args=[json.dumps({"gate": failed.gate, "output_tail": failed.output_tail})],
        adw_id=build_request.adw_id,
        working_dir=build_request.working_dir,
        model=build_request.model,
    )


def build_loop(
    state: Optional[Any],
    build_request: AgentTemplateRequest,
    gates: List[Gate],
    max_iters: int = 3,
    agent_runner: Optional[Callable[[AgentTemplateRequest], Any]] = None,
) -> bool:
    """docs/slim-pipelines-plan.md §6.2 — the heart of Image 1.

    Build agent runs exactly once. Stage 1 converges FAST gates only, in a
    loop bounded by `max_iters` (one /fix_gate agent per failure). Stage 2
    runs SLOW gates exactly once, with at most one fix-and-rerun — that
    stage has no loop at all, so slow-gate execution is capped at 2 calls to
    run_gates(slow, ...) *by construction*, independent of max_iters and of
    how many fast-loop iterations ran.
    """
    runner = agent_runner or execute_template
    cwd = build_request.working_dir
    fast = [g for g in gates if not g.slow]
    slow = [g for g in gates if g.slow]

    # Build Agent — runs exactly once.
    build_resp = runner(build_request)
    build_phase_result: dict = {"success": bool(build_resp.success)}
    if not build_resp.success:
        # Record the response tail so state-based infra scanning (e.g.
        # evals/run_eval.py's classify_status_slim) has text to scan for a
        # session/rate-limit marker — a build failure with nothing recorded
        # here would be indistinguishable from a genuine task failure.
        build_phase_result["error"] = _tail(build_resp.output or "")
    _record_phase(state, "build", build_phase_result)
    if not build_resp.success:
        if state is not None:
            state.overall_success = False
            state.save()
        return False

    # Stage 1 — converge on FAST gates only (the ✗ loop-back edge).
    failed: Optional[GateResult] = None
    for i in range(1, max_iters + 1):
        failed = run_gates(fast, cwd, state)
        if failed is None:
            _record_phase(state, "gates", {"success": True, "iters": i})
            break
        fixer_request = _fixer_request(build_request, failed, f"fixer-{i}")
        fixer_resp = runner(fixer_request)
        _record_phase(
            state, f"fix-{i}", {"success": bool(fixer_resp.success), "gate": failed.gate}
        )
    else:
        # for/else: only reached if the loop ran out without ever `break`ing,
        # i.e. the fast gates never converged within max_iters.
        _record_phase(state, "gates", {"success": False, "iters": max_iters})
        if state is not None:
            state.overall_success = False
            state.save()
        return False

    # Stage 2 — SLOW gates run ONCE, with at most ONE fix-and-rerun. No loop:
    # at most two calls to run_gates(slow, ...) total (line below, plus the
    # one inside the `if failed is not None` branch) — the structural cap.
    failed = None
    if slow:
        failed = run_gates(slow, cwd, state)  # slow run #1
        if failed is not None:
            fixer_request = _fixer_request(build_request, failed, "fixer-slow")
            fixer_resp = runner(fixer_request)
            _record_phase(
                state,
                "fix-slow",
                {"success": bool(fixer_resp.success), "gate": failed.gate},
            )
            failed = run_gates(slow, cwd, state)  # slow run #2 — final, no more retries
        _record_phase(state, "slow_gates", {"success": failed is None})

    overall = failed is None
    if state is not None:
        state.overall_success = overall
        state.save()
    return overall
