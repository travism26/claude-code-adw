#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""Travis build (implementation) phase script.

Usage:
  uv run travis_build.py <adw-id> [--working-dir DIR]

Loads plan from state and executes /implement command to build the feature.

Options:
  --working-dir DIR: Project directory to build in (default: current directory)
  --no-memory: Skip injecting project memory (ai_docs/memory/) into the agent

Outputs:
  - Implementation complete confirmation
  - State updated with build results
  - Logs written to agents/{adw_id}/travis_build.log
"""

import sys
import os
import subprocess
from pathlib import Path
from typing import Optional, Tuple

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from adw_modules.agent import execute_template, AgentTemplateRequest
from adw_modules.utils import setup_logger, resolve_working_dir
from adw_modules.memory import memory_append_file
from travis.travis_state import TravisState


def _git_snapshot(working_dir: str) -> Optional[Tuple[str, str]]:
    """(HEAD sha, porcelain status) used for no-op build detection. Returns
    None when working_dir is not a git repo or git fails — the guard is
    disabled there because there is no way to measure work."""
    try:
        head = subprocess.run(["git", "-C", working_dir, "rev-parse", "HEAD"],
                              capture_output=True, text=True, timeout=30)
        status = subprocess.run(["git", "-C", working_dir, "status", "--porcelain"],
                                capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if head.returncode != 0 or status.returncode != 0:
        return None
    return (head.stdout.strip(), status.stdout)


def main():
    """Main entry point."""
    load_dotenv()

    if len(sys.argv) < 2:
        print("Usage: uv run travis_build.py <adw-id> [--working-dir DIR]", file=sys.stderr)
        sys.exit(1)

    adw_id = sys.argv[1]
    working_dir_arg = None
    no_memory = False

    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "--working-dir":
            if i + 1 >= len(sys.argv):
                print("Error: --working-dir requires a value", file=sys.stderr)
                sys.exit(1)
            working_dir_arg = sys.argv[i + 1]
            i += 2
        elif arg == "--no-memory":
            no_memory = True
            i += 1
        else:
            print(f"Error: Unknown argument: {arg}", file=sys.stderr)
            sys.exit(1)

    working_dir = resolve_working_dir(working_dir_arg)

    # Setup logging
    logger = setup_logger(adw_id, "travis_build")
    logger.info(f"Travis Build starting - ADW ID: {adw_id}")

    # Load state
    state = TravisState.load(adw_id)

    # Check if plan phase completed
    if not state.has_phase_completed("plan"):
        logger.error("Plan phase has not completed - run travis_plan.py first")
        sys.exit(1)

    # Get plan file from state
    plan_file = state.get("plan_file")
    if not plan_file:
        logger.error("No plan file found in state")
        sys.exit(1)

    logger.info(f"Implementing plan: {plan_file}")

    # Execute implementation agent
    request = AgentTemplateRequest(
        agent_name="builder",
        slash_command="/implement",
        args=[plan_file],
        adw_id=adw_id,
        model="sonnet",
        working_dir=working_dir  # Ensure skills discovered from the target project
    )

    # Inject project memory (ai_docs/memory/) unless suppressed
    if not no_memory:
        inject_path = memory_append_file(working_dir, adw_id)
        if inject_path:
            request.append_system_prompt_file = inject_path
            logger.info(f"Memory injected: {inject_path}")
        else:
            logger.info("No project memory found — skipping injection")

    logger.info("Executing implementation agent...")
    before = _git_snapshot(working_dir)
    response = execute_template(request)

    # Fail closed on a "successful" no-op: a builder that reports success but
    # leaves HEAD and the tree untouched did no work. Found live on run
    # 5dbaba17: the agent emitted a pseudo tool call as plain text, ending the
    # session after ONE turn with subtype success — which slips past
    # is_zero_turn_failure (that guard needs num_turns == 0). One retry for
    # transient flakes, then hard fail.
    if response.success and before is not None and _git_snapshot(working_dir) == before:
        logger.warning("Build agent reported success but produced no changes - retrying once")
        response = execute_template(request)
        if response.success and _git_snapshot(working_dir) == before:
            error = ("build agent reported success twice but produced no file changes "
                     "and no commits; failing closed. If the spec is genuinely already "
                     "implemented on this branch, mark the build phase successful in "
                     "agents/{}/travis_state.json and rerun with --resume.".format(adw_id))
            logger.error(error)
            state.set_phase_result("build", {"success": False, "error": error})
            state.save()
            sys.exit(1)

    if not response.success:
        logger.error(f"Implementation failed: {response.output}")
        state.set_phase_result("build", {
            "success": False,
            "error": response.output
        })
        state.save()
        sys.exit(1)

    # Update state
    state.set_phase_result("build", {
        "success": True,
        "message": "Implementation completed"
    })
    state.save()

    logger.info("Build phase completed successfully")
    print("Implementation complete")


if __name__ == "__main__":
    main()
