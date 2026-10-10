#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""Multi-repo orchestration — drive one cross-cutting ticket across many repos.

Decision: INDEPENDENT PER-REPO PLANS. The same ticket is handed to each repo,
and each repo runs its OWN full travis_sdlc pipeline (its own research→plan→build
using that repo's own .claude/ commands+skills+memory), in its own
`--worktree`-isolated branch+tree. Repos are defined by a JSON manifest checked
into the orchestrator repo. Reuses the per-child spawn/collect in
adw_modules/child_run.py.

Usage:
  uv run travis_multirepo.py <ticket-or-spec-file> [--manifest repos.json]
      [--repos name1,name2] [--max-parallel N] [--serialize] [--stop-on-fail]
      [--remove-worktrees]
      [<any travis_sdlc flag, forwarded to every repo's child>]
      [-- <extra args forwarded verbatim>]

Manifest (repos.json):
  {
    "version": 1,
    "repos": [
      { "name": "backend",  "path": "/abs/or/manifest-relative/backend",
        "base_branch": "origin/main", "enabled": true, "plan_type": "feature",
        "order": 1 },
      { "name": "frontend", "path": "../frontend", "plan_type": "feature", "order": 2 }
    ]
  }
  - name (required, unique), path (required; resolved relative to the manifest
    file's directory when not absolute), base_branch (optional → --worktree-base),
    enabled (optional, default true), plan_type (optional, default feature),
    order (optional int; used only by --serialize for dependency ordering).

  --repos filters by name (default: all enabled). Default runs repos in parallel
  (independent repos/worktrees/ports). --serialize runs them one at a time in
  ascending (order, name) — e.g. backend before frontend. --stop-on-fail halts a
  serialized run after the first required-phase failure (default: continue).
"""

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from adw_modules.utils import make_adw_id, setup_logger
from adw_modules.child_run import ChildResult, spawn_sdlc_child, HARNESS_ROOT
from adw_modules.feature_worktree import assert_worktree_capable

MAX_PARALLEL_CEILING = 15  # port-range ceiling (worktree_ops.find_next_available_ports)

SDLC_VALUE_FLAGS = {
    "--model", "--effort", "--planner", "--attempts", "--test-command",
    "--diff-base", "--max-test-retries", "--max-validation-retries",
    "--mcp-config", "--worktree-base", "--plan-type",
}
RUNNER_FLAGS = {"--manifest", "--repos", "--max-parallel", "--serialize",
                "--stop-on-fail", "--remove-worktrees"}


@dataclass
class RepoSpec:
    name: str
    path: str            # absolute, resolved against the manifest dir
    base_branch: Optional[str]
    enabled: bool
    plan_type: str
    order: int


def load_manifest(manifest_path: str, logger) -> List[RepoSpec]:
    """Parse and validate the repos.json manifest. Raises ValueError on any
    structural problem so no partial run starts."""
    p = Path(manifest_path)
    if not p.is_file():
        raise ValueError(f"manifest not found: {manifest_path}")
    try:
        data = json.loads(p.read_text())
    except json.JSONDecodeError as e:
        raise ValueError(f"manifest is not valid JSON: {e}")

    if not isinstance(data, dict) or "repos" not in data:
        raise ValueError("manifest must be an object with a 'repos' array")

    manifest_dir = p.resolve().parent
    repos: List[RepoSpec] = []
    seen: set = set()
    for idx, entry in enumerate(data["repos"]):
        name = entry.get("name")
        raw_path = entry.get("path")
        if not name or not raw_path:
            raise ValueError(f"repos[{idx}]: 'name' and 'path' are required")
        if name in seen:
            raise ValueError(f"duplicate repo name: {name!r}")
        seen.add(name)
        abs_path = raw_path if os.path.isabs(raw_path) else str((manifest_dir / raw_path).resolve())
        if not os.path.isdir(abs_path):
            raise ValueError(f"repo {name!r}: path does not exist: {abs_path}")
        # Same worktree-capability gate the runs will hit — fail early with the
        # actionable message (catches the subdir-of-another-repo trap, unborn HEAD).
        ok, err = assert_worktree_capable(abs_path, logger)
        if not ok:
            raise ValueError(f"repo {name!r}: {err}")
        if not os.path.isdir(os.path.join(abs_path, ".claude", "commands")):
            logger.warning(
                f"repo {name!r}: no .claude/commands found at {abs_path} — its "
                "pipeline will likely fail at plan/build (install the harness commands)."
            )
        repos.append(RepoSpec(
            name=name,
            path=abs_path,
            base_branch=entry.get("base_branch"),
            enabled=entry.get("enabled", True),
            plan_type=entry.get("plan_type", "feature"),
            order=int(entry.get("order", idx)),
        ))
    return repos


def select_repos(repos: List[RepoSpec], names_filter: Optional[List[str]]) -> List[RepoSpec]:
    """Filter by --repos names, else all enabled."""
    if names_filter:
        by_name = {r.name: r for r in repos}
        missing = [n for n in names_filter if n not in by_name]
        if missing:
            raise ValueError(f"--repos names not in manifest: {', '.join(missing)}")
        return [by_name[n] for n in names_filter]
    return [r for r in repos if r.enabled]


def run_one_repo(ticket: str, repo: RepoSpec, child_args: List[str], logger) -> ChildResult:
    """Run repo's full travis_sdlc on the ticket, in its own worktree."""
    repo_flags = ["--plan-type", repo.plan_type]
    if repo.base_branch:
        repo_flags += ["--worktree-base", repo.base_branch]
    # User child_args come after repo flags so an explicit override wins (sdlc is last-wins).
    return spawn_sdlc_child(
        ticket, repo.path, [*repo_flags, *child_args], logger,
        runner="multirepo", repo_name=repo.name,
    )


def run_multirepo(ticket, repos, child_args, *, serialize, max_parallel,
                  stop_on_fail, logger) -> List[ChildResult]:
    """Run each repo's pipeline — parallel by default, sequential with --serialize."""
    if serialize:
        results: List[ChildResult] = []
        for repo in sorted(repos, key=lambda r: (r.order, r.name)):
            res = run_one_repo(ticket, repo, child_args, logger)
            results.append(res)
            if stop_on_fail and not res.success:
                logger.warning(f"--stop-on-fail: halting after {repo.name} failed "
                               f"({res.failed_phase})")
                break
        return results

    workers = min(len(repos), max_parallel)
    logger.info(f"Multi-repo: {len(repos)} repo(s), up to {workers} in parallel")
    results = []
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(run_one_repo, ticket, repo, child_args, logger): repo
                for repo in repos}
        for fut in as_completed(futs):
            results.append(fut.result())
    order = {r.name: i for i, r in enumerate(repos)}
    results.sort(key=lambda res: order.get(res.repo_name, 0))
    return results


def write_cross_repo_summary(ticket, results: List[ChildResult], run_id, logger) -> Path:
    out_dir = HARNESS_ROOT / "agents" / run_id / "multirepo"
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = {
        "run_id": run_id,
        "ticket": ticket,
        "total": len(results),
        "succeeded": sum(1 for r in results if r.success),
        "failed": sum(1 for r in results if not r.success),
        "repos": [
            {
                "repo": r.repo_name, "adw_id": r.adw_id, "branch": r.branch,
                "success": r.success, "failed_phase": r.failed_phase,
                "pr_url": r.pr_url, "log": r.log_path,
            }
            for r in results
        ],
    }
    summary_path = out_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, indent=2))

    print(f"\n{'='*78}\n  MULTI-REPO SCORECARD (run {run_id})\n{'='*78}")
    print(f"  ticket: {ticket[:70]}")
    print(f"  {'repo':<16} {'adw_id':<9} {'branch':<16} result")
    for r in results:
        verdict = "✅ success" if r.success else f"❌ {r.failed_phase or 'fail'}"
        pr = f"  {r.pr_url}" if r.pr_url else ""
        print(f"  {(r.repo_name or '?'):<16} {r.adw_id:<9} {r.branch:<16} {verdict}{pr}")
    print(f"\n  {summary['succeeded']}/{summary['total']} repos succeeded · "
          f"{summary['failed']} failed · summary → {summary_path}\n")
    return summary_path


def main():
    load_dotenv()
    argv = sys.argv[1:]
    if not argv or argv[0].startswith("--"):
        print("Error: first argument must be the ticket (prompt or spec-file)", file=sys.stderr)
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    ticket = argv[0]
    manifest = "repos.json"
    repos_filter: Optional[List[str]] = None
    max_parallel: Optional[int] = None
    serialize = False
    stop_on_fail = False
    remove_worktrees = False
    child_args: List[str] = []

    i = 1
    while i < len(argv):
        arg = argv[i]
        if arg == "--":
            child_args.extend(argv[i + 1:]); break
        elif arg == "--manifest":
            manifest = argv[i + 1]; i += 2
        elif arg == "--repos":
            repos_filter = [n.strip() for n in argv[i + 1].split(",") if n.strip()]; i += 2
        elif arg == "--max-parallel":
            try:
                max_parallel = int(argv[i + 1])
            except (IndexError, ValueError):
                print("Error: --max-parallel requires an integer", file=sys.stderr); sys.exit(1)
            i += 2
        elif arg == "--serialize":
            serialize = True; i += 1
        elif arg == "--stop-on-fail":
            stop_on_fail = True; i += 1
        elif arg == "--remove-worktrees":
            remove_worktrees = True; i += 1
        elif arg.startswith("--"):
            if arg in RUNNER_FLAGS:
                print(f"Error: {arg} is a runner flag, not a child flag", file=sys.stderr); sys.exit(1)
            child_args.append(arg)
            if arg in SDLC_VALUE_FLAGS:
                child_args.append(argv[i + 1]); i += 2
            else:
                i += 1
        else:
            print(f"Error: unexpected positional argument: {arg!r} "
                  "(only one ticket is allowed)", file=sys.stderr)
            sys.exit(1)

    if remove_worktrees:
        child_args.append("--remove-worktree")

    run_id = make_adw_id()
    logger = setup_logger(run_id, "travis_multirepo")

    try:
        repos = load_manifest(manifest, logger)
        selected = select_repos(repos, repos_filter)
    except ValueError as e:
        logger.error(f"manifest error: {e}")
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if not selected:
        print("Error: no repos selected (all disabled, or --repos matched none)", file=sys.stderr)
        sys.exit(1)

    if max_parallel is None:
        max_parallel = min(len(selected), 4)
    if max_parallel > MAX_PARALLEL_CEILING:
        print(f"Error: --max-parallel {max_parallel} exceeds the {MAX_PARALLEL_CEILING}-slot "
              "port range; lower it (or widen the range in worktree_ops.py).", file=sys.stderr)
        sys.exit(1)

    logger.info(f"Multi-repo run {run_id}: ticket={ticket[:60]!r} across "
                f"{len(selected)} repo(s): {', '.join(r.name for r in selected)} "
                f"({'serial' if serialize else 'parallel'})")

    results: List[ChildResult] = []
    try:
        results = run_multirepo(ticket, selected, child_args, serialize=serialize,
                                max_parallel=max_parallel, stop_on_fail=stop_on_fail,
                                logger=logger)
    finally:
        write_cross_repo_summary(ticket, results, run_id, logger)

    sys.exit(0 if results and all(r.success for r in results) else 1)


if __name__ == "__main__":
    main()
