#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""Parallel multi-feature fan-out — run N feature pipelines at once, one repo.

Launches N independent `travis_sdlc.py` runs concurrently against the SAME repo,
each `--worktree`-isolated (its own branch adw/<id>, its own ports, its own tree
under trees/<id>/). Mirrors bestof.py's ThreadPoolExecutor + bounded concurrency
+ summary.json; the per-child spawn/collect lives in adw_modules/child_run.py.

Usage:
  uv run travis_fanout.py [FEATURE ...] [--features-file FILE] [--working-dir DIR]
      [--max-parallel N] [--remove-worktrees]
      [<any travis_sdlc flag, forwarded to every child>]
      [-- <extra args forwarded verbatim to every child>]

  - FEATURE positional args and/or --features-file lines (one prompt or spec-file
    path per non-empty, non-# line) compose the feature list.
  - --max-parallel N: cap concurrent children (default min(#features, 4); max 15,
    the port-range ceiling — see worktree_ops.find_next_available_ports).
  - --remove-worktrees: forward --remove-worktree to children (default: keep the
    trees; each branch holds its work for review).
  - Any other recognized travis_sdlc flag (e.g. --draft-pr, --model opus,
    --plan-type, --attempts N, --skip-document, --no-memory, --diff-base REF) is
    forwarded to every child. Anything after a literal -- is forwarded verbatim.

Examples:
  uv run travis_fanout.py "Add /health endpoint" "Add /version endpoint" \\
      --working-dir ~/code/api --max-parallel 2 --skip-document
  uv run travis_fanout.py --features-file features.txt --working-dir ~/code/api --draft-pr
"""

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from adw_modules.utils import make_adw_id, resolve_working_dir, setup_logger
from adw_modules.child_run import ChildResult, spawn_sdlc_child, HARNESS_ROOT

# Port range is 15 slots (worktree_ops); refuse to exceed it up front rather than
# letting find_next_available_ports raise mid-run.
MAX_PARALLEL_CEILING = 15

# travis_sdlc flags that take a value — needed to forward them with their argument.
# Everything else starting with -- is treated as a boolean flag and forwarded as-is.
SDLC_VALUE_FLAGS = {
    "--plan-type", "--model", "--effort", "--planner", "--attempts",
    "--test-command", "--diff-base", "--max-test-retries",
    "--max-validation-retries", "--mcp-config", "--worktree-base",
}
# Runner-owned flags must NOT be forwarded to children.
RUNNER_FLAGS = {"--features-file", "--working-dir", "--max-parallel", "--remove-worktrees"}


def load_features(positional: List[str], features_file: Optional[str]) -> List[str]:
    """Combine positional features with one-per-line entries from a file."""
    features = list(positional)
    if features_file:
        for line in Path(features_file).read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                features.append(line)
    return features


def run_fanout(
    features: List[str],
    base_working_dir: str,
    child_args: List[str],
    max_parallel: int,
    logger,
) -> List[ChildResult]:
    """Run each feature as a --worktree-isolated child travis_sdlc, concurrently."""
    results: List[ChildResult] = []
    workers = min(len(features), max_parallel)
    logger.info(f"Fan-out: {len(features)} feature(s), up to {workers} in parallel")
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {
            ex.submit(spawn_sdlc_child, feat, base_working_dir, child_args, logger,
                      runner="fanout"): feat
            for feat in features
        }
        for fut in as_completed(futs):
            results.append(fut.result())
    # Stable order by feature for the scorecard.
    results.sort(key=lambda r: features.index(r.feature))
    return results


def write_summary(results: List[ChildResult], run_id: str, logger) -> Path:
    """Write summary.json and print a scorecard."""
    out_dir = HARNESS_ROOT / "agents" / run_id / "fanout"
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = {
        "run_id": run_id,
        "total": len(results),
        "succeeded": sum(1 for r in results if r.success),
        "failed": sum(1 for r in results if not r.success),
        "features": [
            {
                "feature": r.feature, "adw_id": r.adw_id, "branch": r.branch,
                "success": r.success, "failed_phase": r.failed_phase,
                "pr_url": r.pr_url, "log": r.log_path,
            }
            for r in results
        ],
    }
    summary_path = out_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, indent=2))

    print(f"\n{'='*78}\n  FAN-OUT SCORECARD (run {run_id})\n{'='*78}")
    print(f"  {'feature':<40} {'adw_id':<9} {'branch':<16} result")
    for r in results:
        verdict = "✅ success" if r.success else f"❌ {r.failed_phase or 'fail'}"
        pr = f"  {r.pr_url}" if r.pr_url else ""
        print(f"  {r.feature[:40]:<40} {r.adw_id:<9} {r.branch:<16} {verdict}{pr}")
    print(f"\n  {summary['succeeded']}/{summary['total']} succeeded · "
          f"{summary['failed']} failed · summary → {summary_path}\n")
    return summary_path


def main():
    load_dotenv()
    argv = sys.argv[1:]

    positional: List[str] = []
    features_file: Optional[str] = None
    working_dir_arg: Optional[str] = None
    max_parallel: Optional[int] = None
    remove_worktrees = False
    child_args: List[str] = []

    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--":
            child_args.extend(argv[i + 1:])
            break
        elif arg == "--features-file":
            features_file = argv[i + 1]; i += 2
        elif arg == "--working-dir":
            working_dir_arg = argv[i + 1]; i += 2
        elif arg == "--max-parallel":
            try:
                max_parallel = int(argv[i + 1])
            except (IndexError, ValueError):
                print("Error: --max-parallel requires an integer", file=sys.stderr)
                sys.exit(1)
            i += 2
        elif arg == "--remove-worktrees":
            remove_worktrees = True; i += 1
        elif arg.startswith("--"):
            # Forward recognized travis_sdlc flags to every child.
            if arg in RUNNER_FLAGS:
                print(f"Error: {arg} is a runner flag, not a child flag", file=sys.stderr)
                sys.exit(1)
            child_args.append(arg)
            if arg in SDLC_VALUE_FLAGS:
                child_args.append(argv[i + 1]); i += 2
            else:
                i += 1
        else:
            positional.append(arg); i += 1

    features = load_features(positional, features_file)
    if not features:
        print("Error: no features given (positional args or --features-file)", file=sys.stderr)
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    if remove_worktrees:
        child_args.append("--remove-worktree")

    base_working_dir = resolve_working_dir(working_dir_arg)
    if max_parallel is None:
        max_parallel = min(len(features), 4)
    if max_parallel > MAX_PARALLEL_CEILING:
        print(f"Error: --max-parallel {max_parallel} exceeds the {MAX_PARALLEL_CEILING}-slot "
              "port range; lower it (or widen the range in worktree_ops.py).", file=sys.stderr)
        sys.exit(1)

    run_id = make_adw_id()
    logger = setup_logger(run_id, "travis_fanout")
    logger.info(f"Fan-out run {run_id}: {len(features)} feature(s) against {base_working_dir}")

    results = []
    try:
        results = run_fanout(features, base_working_dir, child_args, max_parallel, logger)
    finally:
        # Always write whatever results we have, even on interruption.
        write_summary(results, run_id, logger)

    # Exit non-zero if any feature failed its required phases.
    sys.exit(0 if all(r.success for r in results) and results else 1)


if __name__ == "__main__":
    main()
