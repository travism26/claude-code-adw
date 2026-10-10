#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""Travis Patch - Fix review issues from a previous run.

Usage:
  uv run travis_patch.py <adw-id> [--max-test-retries N] [--skip-review] [--model MODEL]

Lightweight workflow for fixing review issues without re-planning:
1. Load previous state and review issues
2. Patch - Create and apply patch plan to fix review issues
3. Test - Verify fixes with automatic retry
4. Review - Confirm issues resolved (optional)

This skips the planning phase since you already have a spec.

Options:
  --max-test-retries N: Set maximum test retry attempts (default: 3)
  --skip-review: Skip the re-review phase
  --model MODEL: Model to use for patching (sonnet|opus, default: sonnet)

Outputs:
  - Progress logging to console
  - Final summary with phase results
  - State updated in agents/{adw_id}/travis_state.json
  - Logs written to agents/{adw_id}/travis_patch.log

Exit codes:
  0 - All phases succeeded
  1 - One or more phases failed
"""

import sys
import os
import subprocess
from pathlib import Path
from typing import Literal, Tuple, Optional, cast

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from adw_modules.agent import execute_template, AgentTemplateRequest
from adw_modules.utils import setup_logger
from travis.travis_state import TravisState


def review_args(adw_id: str, state) -> list:
    """Arguments for the re-review: the run's recorded diff base, when it has
    one, so a Ticket run is re-reviewed against the base it was reviewed
    against first rather than travis_review's origin/main default."""
    diff_base = state.get("diff_base")
    return [adw_id, "--diff-base", diff_base] if diff_base else [adw_id]


def print_phase_header(phase_name: str) -> None:
    """Print a formatted phase header."""
    print(f"\n{'='*70}")
    print(f"  {phase_name}")
    print(f"{'='*70}\n")


def print_phase_result(phase_name: str, success: bool, message: str = "") -> None:
    """Print a formatted phase result."""
    status = "✅ SUCCESS" if success else "❌ FAILED"
    print(f"\n{phase_name}: {status}")
    if message:
        print(f"  {message}")


def run_phase_script(
    script_name: str,
    args: list,
    phase_name: str,
    required: bool = True
) -> Tuple[bool, Optional[str]]:
    """Run a phase script and return (success, error_message).

    Args:
        script_name: Name of the script to run (e.g., "travis_test.py")
        args: Arguments to pass to the script
        phase_name: Display name of the phase
        required: Whether failure should stop the workflow

    Returns:
        Tuple of (success, error_message)
    """
    print_phase_header(phase_name)

    # Build command
    script_path = Path(__file__).parent / script_name
    cmd = ["uv", "run", str(script_path)] + args

    # Run the script
    result = subprocess.run(
        cmd,
        capture_output=False,  # Let output go to console
        text=True
    )

    success = result.returncode == 0

    if success:
        print_phase_result(phase_name, True)
    else:
        error_msg = f"Script exited with code {result.returncode}"
        print_phase_result(phase_name, False, error_msg)
        if required:
            return False, error_msg

    return True, None


def create_patch_plan(adw_id: str, review_issues_file: Path, plan_file: str, model: Literal["sonnet", "opus", "haiku"], logger) -> Tuple[bool, Optional[str]]:
    """Create a patch plan from review issues.

    Args:
        adw_id: Workflow ID
        review_issues_file: Path to review issues file
        plan_file: Path to the original plan file
        model: Model to use (sonnet|opus)
        logger: Logger instance

    Returns:
        Tuple of (success, patch_plan_path or error_message)
    """
    print_phase_header("Phase 1: Creating Patch Plan")

    # Read review issues file
    if not review_issues_file.exists():
        error_msg = f"Review issues file not found: {review_issues_file}"
        logger.error(error_msg)
        print_phase_result("Create Patch Plan", False, error_msg)
        return False, error_msg

    review_issues_content = review_issues_file.read_text()
    logger.info(f"Loaded review issues from: {review_issues_file}")

    # Create review change request from issues file
    review_change_request = f"Fix all review issues documented in {review_issues_file}:\n\n{review_issues_content}"

    # Execute patch planning agent
    working_dir = os.getcwd()
    request = AgentTemplateRequest(
        agent_name="patch_planner",
        slash_command="/patch",
        args=[adw_id, review_change_request, plan_file],
        adw_id=adw_id,
        model=model,
        working_dir=working_dir
    )

    logger.info("Executing patch planning agent...")
    response = execute_template(request)

    if not response.success:
        logger.error(f"Patch planning failed: {response.output}")
        print_phase_result("Create Patch Plan", False, response.output)
        return False, response.output

    # Extract patch plan path from output
    patch_plan_path = response.output.strip()
    logger.info(f"Patch plan reported: {patch_plan_path}")

    # Verify the file exists before declaring success. The agent can report
    # a path without actually writing the file - don't claim "Plan created"
    # until we've checked the filesystem. Relative paths resolve against
    # the working dir the agent ran in.
    if not os.path.exists(os.path.join(working_dir, patch_plan_path)):
        error_msg = f"Patch plan file not found at reported path: {patch_plan_path} (in {working_dir})"
        logger.error(error_msg)
        print_phase_result("Create Patch Plan", False, error_msg)
        return False, error_msg

    logger.info(f"Patch plan created: {patch_plan_path}")
    print_phase_result("Create Patch Plan", True, f"Plan: {patch_plan_path}")

    return True, patch_plan_path


def apply_patch(adw_id: str, patch_plan_path: str, logger) -> bool:
    """Apply the patch plan using /implement.

    Args:
        adw_id: Workflow ID
        patch_plan_path: Path to patch plan file
        logger: Logger instance

    Returns:
        True if successful, False otherwise
    """
    print_phase_header("Phase 2: Applying Patch")

    # Execute implementation agent
    request = AgentTemplateRequest(
        agent_name="patch_implementor",
        slash_command="/implement",
        args=[patch_plan_path],
        adw_id=adw_id,
        model="sonnet",
        working_dir=os.getcwd()
    )

    logger.info("Executing patch implementation agent...")
    response = execute_template(request)

    if not response.success:
        logger.error(f"Patch implementation failed: {response.output}")
        print_phase_result("Apply Patch", False, response.output)
        return False

    logger.info("Patch applied successfully")
    print_phase_result("Apply Patch", True)
    return True


def print_final_summary(state: TravisState, patch_plan_path: str) -> None:
    """Print final summary of all phases."""
    print(f"\n{'='*70}")
    print("  FINAL SUMMARY")
    print(f"{'='*70}\n")

    print(f"ADW ID: {state.adw_id}")
    print(f"Original Spec: {state.get('plan_file', 'N/A')}")
    print(f"Patch Plan: {patch_plan_path}")
    print()

    phase_results = state.data.get("phase_results", {})

    # Patch phase
    patch = phase_results.get("patch", {})
    if patch:
        print(f"1. Patch:   {'✅ SUCCESS' if patch.get('success') else '❌ FAILED'}")
        if patch.get("patch_plan"):
            print(f"   Plan: {patch['patch_plan']}")

    # Test phase
    test = phase_results.get("test", {})
    if test:
        status = "✅ SUCCESS" if test.get("success") else "❌ FAILED"
        print(f"2. Test:    {status}")
        if "passed" in test:
            print(f"   Passed: {test['passed']}, Failed: {test['failed']}, Attempts: {test['attempts']}")

    # Review phase
    review = phase_results.get("review", {})
    if review:
        status = "✅ SUCCESS" if review.get("success") else "❌ FAILED"
        print(f"3. Review:  {status}")
        if "issue_count" in review:
            print(f"   Issues: {review['issue_count']}")

    print()


def main():
    """Main entry point."""
    load_dotenv()

    if len(sys.argv) < 2:
        print("Usage: uv run travis_patch.py <adw-id> [--max-test-retries N] [--skip-review] [--model MODEL]", file=sys.stderr)
        sys.exit(1)

    # Parse arguments
    adw_id = sys.argv[1]
    max_test_retries = 3
    skip_review = False
    model: Literal["sonnet", "opus", "haiku"] = "sonnet"

    # Process optional arguments
    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "--max-test-retries":
            if i + 1 < len(sys.argv):
                try:
                    max_test_retries = int(sys.argv[i + 1])
                    i += 2
                except ValueError:
                    print(f"Error: Invalid max-test-retries value: {sys.argv[i + 1]}", file=sys.stderr)
                    sys.exit(1)
            else:
                print("Error: --max-test-retries requires a value", file=sys.stderr)
                sys.exit(1)
        elif arg == "--skip-review":
            skip_review = True
            i += 1
        elif arg == "--model":
            if i + 1 < len(sys.argv):
                model_str = sys.argv[i + 1]
                if model_str not in ["sonnet", "opus", "haiku"]:
                    print(f"Error: Invalid model value: {model_str}. Must be 'sonnet', 'opus', or 'haiku'", file=sys.stderr)
                    sys.exit(1)
                model = cast(Literal["sonnet", "opus", "haiku"], model_str)
                i += 2
            else:
                print("Error: --model requires a value (sonnet|opus|haiku)", file=sys.stderr)
                sys.exit(1)
        else:
            print(f"Error: Unknown argument: {arg}", file=sys.stderr)
            sys.exit(1)

    # Setup logging
    logger = setup_logger(adw_id, "travis_patch")
    logger.info(f"Travis Patch starting - ADW ID: {adw_id}")
    logger.info(f"Max test retries: {max_test_retries}, Skip review: {skip_review}, Model: {model}")

    print(f"\n{'='*70}")
    print("  Travis Patch Workflow")
    print(f"  ADW ID: {adw_id}")
    print(f"{'='*70}\n")

    # Load previous state
    state = TravisState.load(adw_id)

    # Check that we have a spec file
    plan_file = state.get("plan_file")
    if not plan_file:
        logger.error("No spec file found in state - run full SDLC first")
        print("Error: No spec file found. Run travis_sdlc.py first.", file=sys.stderr)
        sys.exit(1)

    # Find review issues file
    review_issues_file = Path(f"specs/review_issues/review-{adw_id}.md")
    if not review_issues_file.exists():
        logger.error(f"Review issues file not found: {review_issues_file}")
        print(f"Error: Review issues file not found: {review_issues_file}", file=sys.stderr)
        print("Run travis_review.py first to generate review issues.", file=sys.stderr)
        sys.exit(1)

    logger.info(f"Original spec: {plan_file}")
    logger.info(f"Review issues: {review_issues_file}")

    all_success = True
    failed_phase = None
    patch_plan_path = None

    # Phase 1: Create patch plan
    success, result = create_patch_plan(adw_id, review_issues_file, plan_file, model, logger)
    if success:
        patch_plan_path = result
        state.set_phase_result("patch", {
            "success": True,
            "patch_plan": patch_plan_path
        })
        state.save()
    else:
        logger.error(f"Patch planning failed: {result}")
        state.set_phase_result("patch", {
            "success": False,
            "error": result
        })
        state.save()
        all_success = False
        failed_phase = "Patch Planning"

    # Phase 2: Apply patch
    if all_success:
        success = apply_patch(adw_id, patch_plan_path, logger)
        if success:
            # Update patch phase result to include implementation
            state.set_phase_result("patch", {
                "success": True,
                "patch_plan": patch_plan_path,
                "implemented": True
            })
            state.save()
        else:
            logger.error("Patch implementation failed")
            state.set_phase_result("patch", {
                "success": False,
                "patch_plan": patch_plan_path,
                "error": "Implementation failed"
            })
            state.save()
            all_success = False
            failed_phase = "Patch Implementation"

    # Phase 3: Test
    if all_success:
        success, error = run_phase_script(
            "travis_test.py",
            [adw_id, "--max-retries", str(max_test_retries)],
            "Phase 3: Testing",
            required=False  # Allow workflow to continue even if tests fail
        )
        if not success:
            logger.warning(f"Test phase failed: {error}")
            if not failed_phase:
                failed_phase = "Test"

    # Phase 4: Re-review (optional)
    if not skip_review:
        success, error = run_phase_script(
            "travis_review.py",
            review_args(adw_id, state),
            "Phase 4: Re-review",
            required=False  # Don't stop workflow if review fails
        )
        if not success:
            logger.warning(f"Review phase failed: {error}")
            # Don't set all_success to False - review is informational

    # Load final state and print summary
    state = TravisState.load(adw_id)
    print_final_summary(state, patch_plan_path or "N/A")

    # Final result
    if all_success:
        logger.info("Travis Patch completed successfully")
        print(f"{'='*70}")
        print("  ✅ PATCH WORKFLOW COMPLETED SUCCESSFULLY")
        print(f"{'='*70}\n")
        sys.exit(0)
    elif failed_phase == "Test":
        # Tests failed but workflow continued
        logger.warning("Travis Patch completed with test failures")
        print(f"{'='*70}")
        print("  ⚠️  PATCH COMPLETED WITH TEST FAILURES")
        print(f"{'='*70}\n")
        sys.exit(0)
    else:
        logger.error(f"Travis Patch failed at {failed_phase} phase")
        print(f"{'='*70}")
        print(f"  ❌ PATCH FAILED AT {failed_phase.upper()} PHASE")
        print(f"{'='*70}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
