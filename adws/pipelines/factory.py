#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""factory.py — M5 factory orchestrator (docs/slim-pipelines-plan.md §9).

Intake (a GitHub issue or a raw prompt) -> route -> cut a worktree sandbox ->
run the matching slim pipeline as a subprocess -> collect the two-signal
verdict (exit code = liveness, pipeline_state.json = verdict) -> draft PR on
success, or a failure report naming the state file on failure. Pipelines stay
worktree-unaware: they only ever see --working-dir (the worktree path).

CLI:
  uv run adws/pipelines/factory.py "<prompt>" [flags]
  uv run adws/pipelines/factory.py --issue N [flags]

Flags: --issue N, --working-dir DIR, --route chore|bug|feature, --model M,
--adw-id ID, --keep-worktree (boolean, no value).

Known gaps (plan §9, deliberately NOT built here): no hotfix route, no
--issues fanout (both M6/stretch), no trigger integration. Router model is
--model (single knob) — a dedicated --router-model can come later.
"""

import logging
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

_ADWS_DIR = Path(__file__).resolve().parent.parent  # pipe_feature.py's sys.path convention
sys.path.insert(0, str(_ADWS_DIR))
HARNESS_ROOT = _ADWS_DIR.parent

from adw_modules import draft_pr  # noqa: E402
from adw_modules.feature_worktree import create_feature_worktree, remove_feature_worktree, Worktree  # noqa: E402
from adw_modules.github import extract_repo_path, fetch_issue  # noqa: E402
from adw_modules.utils import make_adw_id, resolve_working_dir  # noqa: E402
from pipelines.pipeline_state import PipelineState  # noqa: E402
from pipelines.router import RouterError, route_ticket  # noqa: E402

FLAGS = ("--issue", "--working-dir", "--route", "--model", "--adw-id")
BOOL_FLAGS = ("--keep-worktree",)
VALID_MODELS = ("sonnet", "opus", "haiku")
VALID_ROUTES = ("chore", "bug", "feature")
ROUTES = {"chore": "pipe_chore.py", "bug": "pipe_bug.py", "feature": "pipe_feature.py"}
LOW_CONFIDENCE = 0.5

USAGE = (
    'Usage: uv run adws/pipelines/factory.py "<prompt>" [--working-dir DIR] '
    "[--route chore|bug|feature] [--model M] [--adw-id ID] [--keep-worktree]\n"
    "   or: uv run adws/pipelines/factory.py --issue N [--working-dir DIR] "
    "[--route chore|bug|feature] [--model M] [--adw-id ID] [--keep-worktree]"
)


def parse_args(argv: List[str]) -> Tuple[Optional[str], Dict[str, str], bool]:
    """At most one positional prompt + named flags + one boolean flag.
    Exactly one intake required: positional prompt XOR --issue."""
    positional: List[str] = []
    opts: Dict[str, str] = {}
    keep_worktree = False
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg in BOOL_FLAGS:
            keep_worktree = True
            i += 1
        elif arg.startswith("--"):
            if arg not in FLAGS:
                raise ValueError(f"unknown flag: {arg}")
            if i + 1 >= len(argv):
                raise ValueError(f"{arg} requires a value")
            opts[arg] = argv[i + 1]
            i += 2
        else:
            positional.append(arg)
            i += 1
    if len(positional) > 1:
        raise ValueError('at most one "<prompt>" argument is allowed')
    prompt = positional[0] if positional else None
    if bool(prompt) == bool(opts.get("--issue")):
        raise ValueError('exactly one of "<prompt>" or --issue is required (not both, not neither)')
    return prompt, opts, keep_worktree


def _origin_url(working_dir: str) -> Optional[str]:
    r = subprocess.run(["git", "-C", working_dir, "remote", "get-url", "origin"],
                        capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 and r.stdout.strip() else None


def _build_ticket(prompt: Optional[str], issue_number: Optional[str], working_dir: str) -> Tuple[dict, str]:
    """Returns (ticket, pipeline_prompt_text). Exits 1 on an unusable --issue intake."""
    if issue_number:
        origin_url = _origin_url(working_dir)
        if not origin_url:
            print("Error: --issue requires the target repo to have a GitHub origin remote", file=sys.stderr)
            sys.exit(1)
        repo_path = extract_repo_path(origin_url)
        if not re.fullmatch(r"[^/\s]+/[^/\s]+", repo_path):
            print(f"Error: could not derive a GitHub owner/repo from the origin remote "
                  f"{origin_url!r} (got {repo_path!r})", file=sys.stderr)
            sys.exit(1)
        issue = fetch_issue(issue_number, repo_path)
        ticket = {"title": issue.title, "body": issue.body or "", "labels": [l.name for l in issue.labels]}
        pipeline_prompt = f"Issue #{issue_number}: {issue.title}\n\n{issue.body or ''}"
        return ticket, pipeline_prompt
    return {"title": prompt, "body": "", "labels": []}, prompt


def _derive_base_branch(wt: Worktree, source_working_dir: str) -> str:
    """origin/<x> -> strip prefix; "HEAD" -> resolve the source's current
    branch (a literal "HEAD" result means detached — pass it through and let
    draft_pr degrade); anything else -> pass through unchanged."""
    if wt.base_ref.startswith("origin/"):
        return wt.base_ref[len("origin/"):]
    if wt.base_ref == "HEAD":
        r = subprocess.run(["git", "-C", source_working_dir, "rev-parse", "--abbrev-ref", "HEAD"],
                            capture_output=True, text=True)
        return r.stdout.strip() or "HEAD"
    return wt.base_ref


def _first_failed_phase(phase_results: Dict[str, dict]) -> Optional[str]:
    for phase, result in phase_results.items():
        if isinstance(result, dict) and result.get("success") is False:
            return phase
    return None


def _report_failure(adw_id: str, rc: int, state: PipelineState, wt: Worktree, log_path: Path,
                    state_missing: bool) -> None:
    """Fail-closed failure report — the worktree is always kept so the run
    stays inspectable. `state_missing` distinguishes "the child never wrote
    pipeline_state.json" from "it recorded overall_success=False" (load()
    returns the same fail-closed object for both)."""
    rc_ok, state_ok = rc == 0, state.overall_success
    verdict_desc = ("no pipeline_state.json was written" if state_missing
                    else "state overall_success=False")
    if not rc_ok and not state_ok:
        signal = f"BOTH signals failed: exit code {rc}, and {verdict_desc}"
    elif not rc_ok:
        signal = f"liveness failed: exit code {rc} (state overall_success=True — signals DISAGREE)"
    else:
        signal = f"verdict failed: {verdict_desc} though the process exited 0 — signals DISAGREE"
    print("FACTORY RUN FAILED", file=sys.stderr)
    print(f"  signal: {signal}", file=sys.stderr)
    failed_phase = _first_failed_phase(state.phase_results)
    if failed_phase:
        print(f"  first failed phase: {failed_phase}", file=sys.stderr)
    state_note = " (NOT WRITTEN)" if state_missing else ""
    print(f"  state file: {PipelineState._state_file_path(adw_id)}{state_note}", file=sys.stderr)
    print(f"  child log: {log_path}", file=sys.stderr)
    print(f"  worktree kept at: {wt.path} (branch {wt.branch})", file=sys.stderr)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logger = logging.getLogger("factory")

    try:
        prompt, opts, keep_worktree = parse_args(sys.argv[1:])
        model = opts.get("--model", "sonnet")
        if model not in VALID_MODELS:
            raise ValueError(f"--model must be one of {VALID_MODELS}, got {model!r}")
        route_override = opts.get("--route")
        if route_override is not None and route_override not in VALID_ROUTES:
            raise ValueError(f"--route must be one of {VALID_ROUTES}, got {route_override!r}")
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        print(USAGE, file=sys.stderr)
        sys.exit(1)

    working_dir = resolve_working_dir(opts.get("--working-dir"))
    adw_id = opts.get("--adw-id") or make_adw_id()
    issue_number = opts.get("--issue")

    ticket, pipeline_prompt = _build_ticket(prompt, issue_number, working_dir)
    title = f"ADW {adw_id}: {ticket['title'][:70]}"

    if route_override:
        route = route_override
        print(f"route forced: {route}")
    else:
        try:
            verdict = route_ticket(ticket, adw_id, working_dir, model=model)
        except RouterError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
        route = verdict.route
        print(f"route: {route} (confidence={verdict.confidence:.2f}) — {verdict.reason}")
        if verdict.confidence < LOW_CONFIDENCE:
            print(f"WARNING: low router confidence ({verdict.confidence:.2f}) for route "
                  f"{route!r} — proceeding anyway (use --route to override)", file=sys.stderr)

    wt, wt_err = create_feature_worktree(adw_id, working_dir, logger)
    if wt is None:
        print(f"Error: {wt_err}", file=sys.stderr)
        sys.exit(1)

    agents_dir = HARNESS_ROOT / "agents" / adw_id
    agents_dir.mkdir(parents=True, exist_ok=True)
    log_path = agents_dir / "factory_child.log"
    cmd = ["uv", "run", str(_ADWS_DIR / "pipelines" / ROUTES[route]), pipeline_prompt,
           "--working-dir", wt.path, "--adw-id", adw_id, "--model", model]
    print(f"launching {route} pipeline — log: {log_path}")
    with open(log_path, "w") as log_file:
        proc = subprocess.run(cmd, cwd=str(HARNESS_ROOT), stdout=log_file, stderr=subprocess.STDOUT, text=True)

    state_missing = not Path(PipelineState._state_file_path(adw_id)).is_file()
    state = PipelineState.load(adw_id)
    if proc.returncode == 0 and state.overall_success:
        base_branch = _derive_base_branch(wt, working_dir)
        session = draft_pr.start(wt.path, adw_id, title, logger,
                                  issue_number=issue_number, base_branch=base_branch)
        draft_pr.commit_phase(session, f"{route} pipeline", "ok", logger)
        draft_pr.finish(session, True, f"{route} pipeline succeeded (adw_id={adw_id}).", logger)
        if keep_worktree:
            print(f"worktree kept at {wt.path} (branch {wt.branch}) — --keep-worktree set")
        else:
            remove_feature_worktree(wt, logger)
            print(f"worktree removed (branch {wt.branch} kept)")
        pr_url = session.pr_url if session and session.pr_url else "local branch only"
        print("---")
        print(f"route: {route}")
        print(f"adw_id: {adw_id}")
        print(f"branch: {wt.branch}")
        print(f"pr: {pr_url}")
        print(f"state: {PipelineState._state_file_path(adw_id)}")
        sys.exit(0)

    _report_failure(adw_id, proc.returncode, state, wt, log_path, state_missing)
    sys.exit(1)


if __name__ == "__main__":
    main()
