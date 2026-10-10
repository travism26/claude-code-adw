#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""pipe_feature — Image 2 slim pipeline (docs/slim-pipelines-plan.md §7.2). Planner -> spec under specs/ -> build agent implements it via gates + fix loop (core.build_loop) -> one ADVISORY reviewer pass; review never changes the exit code (build_loop's verdict alone). pipe_bug.py (§7.3) reuses run_pipeline() below with plan_type forced to "bug".

CLI: uv run adws/pipelines/pipe_feature.py "<prompt>" [--working-dir DIR] [--model M] [--max-iters N] [--gates FILE] [--plan-type feature|chore|bug] [--adw-id ID]
"""

import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Tuple

_ADWS_DIR = Path(__file__).resolve().parent.parent  # pipe_chore.py's sys.path convention
sys.path.insert(0, str(_ADWS_DIR))

from pipelines.core import OUTPUT_TAIL_LINES, build_loop  # noqa: E402
from pipelines.gates import Gate, GateConfigError, resolve_gates  # noqa: E402
from pipelines.pipeline_state import PipelineState  # noqa: E402
from adw_modules.agent import AgentTemplateRequest, execute_template  # noqa: E402
from adw_modules.utils import make_adw_id, resolve_working_dir  # noqa: E402

FLAGS = ("--working-dir", "--model", "--max-iters", "--gates", "--plan-type", "--adw-id")
VALID_MODELS = ("sonnet", "opus", "haiku")
VALID_PLAN_TYPES = ("feature", "chore", "bug")
SPEC_PATH_RE = re.compile(r"specs/[^\s]+\.md")
USAGE = ('Usage: uv run adws/pipelines/pipe_feature.py "<prompt>" [--working-dir DIR] '
         "[--model M] [--max-iters N] [--gates FILE] [--plan-type feature|chore|bug] [--adw-id ID]")

def parse_args(argv: List[str], flags: Tuple[str, ...] = FLAGS) -> Tuple[str, Dict[str, str]]:
    """One positional prompt + named `flags`; pipe_bug.py reuses this minus --plan-type."""
    positional: List[str] = []
    opts: Dict[str, str] = {}
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg.startswith("--"):
            if arg not in flags:
                raise ValueError(f"unknown flag: {arg}")
            if i + 1 >= len(argv):
                raise ValueError(f"{arg} requires a value")
            opts[arg] = argv[i + 1]
            i += 2
        else:
            positional.append(arg)
            i += 1
    if len(positional) != 1:
        raise ValueError('exactly one "<prompt>" argument is required')
    return positional[0], opts

def _print_diff_stat(working_dir: str) -> None:
    try:
        proc = subprocess.run(["git", "-C", working_dir, "diff", "--stat"],
                               capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        return
    if proc.returncode == 0 and proc.stdout.strip():
        print(proc.stdout.rstrip())

def _extract_spec_path(output: str, working_dir: str) -> str:
    """Strip+exists-check under working_dir; else regex specs/*.md fallback in the raw output; else ValueError — never hand a hallucinated path to /implement. A candidate must be non-empty, end in .md, and be an existing FILE (never a bare directory)."""
    candidate = output.strip()
    if candidate and candidate.endswith(".md") and (Path(working_dir) / candidate).is_file():
        return candidate
    match = SPEC_PATH_RE.search(output)
    if match and match.group(0) and match.group(0).endswith(".md") and (Path(working_dir) / match.group(0)).is_file():
        return match.group(0)
    raise ValueError(f"planner did not return an existing spec path under {working_dir} "
                      f"(output: {output!r})")

def _fail_before_build(state: PipelineState, working_dir: str, message: str) -> bool:
    print(f"Error: {message}", file=sys.stderr)
    state.overall_success = False
    state.save()
    _print_diff_stat(working_dir)
    print(f"state: {PipelineState._state_file_path(state.adw_id)}")
    print("FAIL")
    return False

def run_pipeline(prompt: str, working_dir: str, adw_id: str, model: str, max_iters: int,
                  gates: List[Gate], plan_type: str = "feature") -> bool:
    """Plan -> build+gates -> ADVISORY review (plan §7.2); reused by pipe_bug.py with plan_type="bug". Returns build_loop's verdict only — review never changes it."""
    state = PipelineState(adw_id=adw_id, pipeline=plan_type, prompt=prompt, working_dir=working_dir)
    plan_req = AgentTemplateRequest(agent_name="planner", slash_command=f"/{plan_type}",
                                     args=[adw_id, prompt], adw_id=adw_id, model=model, working_dir=working_dir)
    plan_resp = execute_template(plan_req)
    if not plan_resp.success:
        state.set_phase_result("plan", {"success": False, "error": "planner agent failed"})
        return _fail_before_build(state, working_dir, f"planner agent failed: {plan_resp.output}")
    try:
        spec_path = _extract_spec_path(plan_resp.output, working_dir)
    except ValueError as e:
        state.set_phase_result("plan", {"success": False, "error": str(e)})
        return _fail_before_build(state, working_dir, str(e))
    state.plan_file = spec_path
    state.set_phase_result("plan", {"success": True})
    state.save()
    build_req = AgentTemplateRequest(agent_name="builder", slash_command="/implement", args=[spec_path],
                                      adw_id=adw_id, model=model, working_dir=working_dir)
    ok = build_loop(state, build_req, gates, max_iters=max_iters)
    if ok:
        review_req = AgentTemplateRequest(agent_name="reviewer", slash_command="/review",
                                           args=[adw_id, spec_path, "reviewer"],
                                           adw_id=adw_id, model=model, working_dir=working_dir)
        review_resp = execute_template(review_req)
        tail = "\n".join(review_resp.output.splitlines()[-OUTPUT_TAIL_LINES:])
        state.set_phase_result("review", {"success": review_resp.success, "output_tail": tail})
        state.save()
        if not review_resp.success:
            print(f"WARNING: advisory review reported issues (adw_id={adw_id}) — advisory "
                  "only, does not affect the pipeline's exit code.", file=sys.stderr)
    _print_diff_stat(working_dir)
    print(f"state: {PipelineState._state_file_path(adw_id)}")
    print("PASS" if ok else "FAIL")
    return ok

def main() -> None:
    try:
        prompt, opts = parse_args(sys.argv[1:])
        max_iters = int(opts.get("--max-iters", "3"))
        model = opts.get("--model", "sonnet")
        if model not in VALID_MODELS:
            raise ValueError(f"--model must be one of {VALID_MODELS}, got {model!r}")
        plan_type = opts.get("--plan-type", "feature")
        if plan_type not in VALID_PLAN_TYPES:
            raise ValueError(f"--plan-type must be one of {VALID_PLAN_TYPES}, got {plan_type!r}")
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        print(USAGE, file=sys.stderr)
        sys.exit(1)
    working_dir = resolve_working_dir(opts.get("--working-dir"))
    adw_id = opts.get("--adw-id") or make_adw_id()
    try:
        gates = resolve_gates(working_dir, config_file=opts.get("--gates"))
    except GateConfigError as e:
        print(f"GateConfigError: {e}", file=sys.stderr)
        sys.exit(1)
    if not gates:
        print(f"WARNING: 0 gates configured for {working_dir} — build-only run, nothing "
              "will verify this change.", file=sys.stderr)
    ok = run_pipeline(prompt, working_dir, adw_id, model, max_iters, gates, plan_type)
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
