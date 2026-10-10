#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""Travis test phase script with automatic retry logic.

Usage:
  uv run travis_test.py <adw-id> [OPTIONS]

Options:
  --max-retries N       Maximum retry attempts (default: 3)
  --run-all-tests       Accepted but ignored — /test does not support test
                         selection and always runs the full suite. (Only
                         /test_e2e supports test selection.)
  --diff-base REF       Accepted but ignored, for the same reason as above.
  --with-browser        Enable Chrome DevTools MCP for E2E/browser testing
  --mcp-config FILE     Use a specific MCP config file (e.g., .mcp-testing.json)
  --working-dir DIR     Project directory to test (default: current directory)

MCP Configuration:
  - By default, no MCP servers are loaded (uses empty .mcp.json)
  - Use --with-browser to load Chrome DevTools for E2E tests
  - Use --mcp-config to specify a custom MCP config file

Outputs:
  - Test summary with pass/fail status
  - State updated with test results
  - Logs written to agents/{adw_id}/travis_test.log
"""

import sys
import logging
from pathlib import Path
from typing import List, Tuple, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from adw_modules.agent import execute_template, AgentTemplateRequest, AgentPromptResponse
from adw_modules.utils import setup_logger, parse_json, resolve_working_dir
from adw_modules.data_types import TestResult
from travis.travis_state import TravisState

# Default max retry attempts
DEFAULT_MAX_RETRIES = 3


def parse_test_results(
    output: str, logger: logging.Logger
) -> Optional[Tuple[List[TestResult], int, int]]:
    """Parse test results JSON into (results, passed_count, failed_count).

    Returns None if the output can't be parsed — the caller must treat that as a
    failed /test attempt (fail closed), never as "0 tests, all passed".
    """
    try:
        results = parse_json(output, List[TestResult])  # type: ignore[type-var]
        passed_count = sum(1 for test in results if test.passed)
        failed_count = len(results) - passed_count
        return results, passed_count, failed_count
    except Exception as e:
        logger.error(f"Error parsing test results: {e}")
        return None


def run_tests(
    adw_id: str,
    logger: logging.Logger,
    working_dir: str,
    run_all_tests: bool = False,
    diff_base: str = "origin/main",
    mcp_config: Optional[str] = None
) -> AgentPromptResponse:
    """Run the test suite using the /test command.

    Args:
        adw_id: ADW workflow ID
        logger: Logger instance
        working_dir: Project directory to test (where .mcp.json lives)
        run_all_tests: Accepted but unused — /test has no test selection to bypass.
        diff_base: Accepted but unused — /test has no test selection to scope.
        mcp_config: Path to MCP config file (e.g., .mcp-browser.json)

    Returns:
        AgentPromptResponse with test results
    """
    # /test does not support test-selection flags (only /test_e2e does) — it
    # always runs the full suite, so run_all_tests/diff_base are never
    # forwarded into the template args. Warnings for callers who pass them are
    # logged once at startup in main().
    request = AgentTemplateRequest(
        agent_name="test_runner",
        slash_command="/test",
        args=[],
        adw_id=adw_id,
        model="sonnet",
        working_dir=working_dir,
        mcp_config=mcp_config
    )

    mcp_msg = f" with MCP: {mcp_config}" if mcp_config else ""
    logger.info(f"Running test suite{mcp_msg}...")
    return execute_template(request)


def resolve_failed_test(
    test: TestResult,
    adw_id: str,
    logger: logging.Logger,
    iteration: int,
    test_index: int,
    working_dir: str,
    mcp_config: Optional[str] = None
) -> bool:
    """Attempt to resolve a single failed test.

    Args:
        test: Failed test result
        adw_id: ADW workflow ID
        logger: Logger instance
        iteration: Current retry iteration
        test_index: Index of test in failed tests list
        working_dir: Project directory to operate in
        mcp_config: Path to MCP config file (e.g., .mcp-browser.json)

    Returns:
        True if resolution succeeded
    """
    logger.info(f"Resolving failed test: {test.test_name}")

    # Create payload for the resolve command
    test_payload = test.model_dump_json(indent=2)

    # Create agent name with iteration
    agent_name = f"test_resolver_iter{iteration}_{test_index}"

    # Execute resolution
    request = AgentTemplateRequest(
        agent_name=agent_name,
        slash_command="/resolve_failed_test",
        args=[test_payload],
        adw_id=adw_id,
        model="sonnet",
        working_dir=working_dir,
        mcp_config=mcp_config
    )

    response = execute_template(request)

    if response.success:
        logger.info(f"Successfully resolved: {test.test_name}")
        return True
    else:
        logger.error(f"Failed to resolve: {test.test_name}")
        return False


def run_tests_with_resolution(
    adw_id: str,
    logger: logging.Logger,
    max_retries: int,
    working_dir: str,
    run_all_tests: bool = False,
    diff_base: str = "origin/main",
    mcp_config: Optional[str] = None
) -> Optional[Tuple[List[TestResult], int, int, int]]:
    """Run tests with automatic resolution and retry logic.

    Args:
        adw_id: ADW workflow ID
        logger: Logger instance
        max_retries: Maximum retry attempts
        working_dir: Project directory to test
        run_all_tests: If True, force running all tests
        diff_base: Git reference to compare against
        mcp_config: Path to MCP config file (e.g., .mcp-browser.json)

    Returns:
        Tuple of (results, passed_count, failed_count, attempts), or None if
        the /test agent failed to execute or its output was unparseable on
        every attempt (fail closed — callers must never treat None as
        "0 tests, all passed").
    """
    attempt = 0
    results: list[TestResult] = []
    passed_count = 0
    failed_count = 0

    while attempt < max_retries:
        attempt += 1
        logger.info(f"\n{'='*60}")
        logger.info(f"Test Run Attempt {attempt}/{max_retries}")
        logger.info(f"{'='*60}\n")

        # Run tests
        test_response = run_tests(adw_id, logger, working_dir, run_all_tests, diff_base, mcp_config)

        # Check for execution errors. Fail closed: a failed /test agent run
        # must never count as "0 tests, all passed" — retry, and fail the
        # phase if the agent never succeeds.
        if not test_response.success:
            logger.error(f"Error running tests: {test_response.output}")
            if attempt < max_retries:
                logger.error("Test agent run failed — retrying test run.")
                continue
            logger.error("Test agent failed on all retries — failing closed.")
            return None

        # Parse test results. Fail closed: unparseable /test output must never
        # count as "0 tests, all passed" — retry, and fail the phase if it
        # never parses.
        parsed = parse_test_results(test_response.output, logger)
        if parsed is None:
            if attempt < max_retries:
                logger.error("Could not parse test output — retrying test run.")
                continue
            logger.error("Test output unparseable after all retries — failing closed.")
            return None
        results, passed_count, failed_count = parsed

        logger.info(f"Test results: {passed_count} passed, {failed_count} failed")

        # If all tests passed, we're done
        if failed_count == 0:
            logger.info("All tests passed!")
            return results, passed_count, failed_count, attempt

        # If this is the last attempt, don't try to resolve
        if attempt == max_retries:
            logger.info(f"Reached maximum retry attempts ({max_retries})")
            return results, passed_count, failed_count, attempt

        # Try to resolve failed tests
        logger.info(f"\nAttempting to resolve {failed_count} failed test(s)...")
        failed_tests = [test for test in results if not test.passed]

        resolved_count = 0
        for idx, test in enumerate(failed_tests):
            if resolve_failed_test(test, adw_id, logger, attempt, idx, working_dir, mcp_config):
                resolved_count += 1

        logger.info(f"Resolved {resolved_count}/{len(failed_tests)} failed test(s)")

        # Continue to next iteration to re-run tests
        if resolved_count > 0:
            logger.info("Re-running tests after resolution...")
        else:
            logger.warning("No tests were resolved, but continuing to retry...")

    return results, passed_count, failed_count, attempt


def format_test_summary(
    results: List[TestResult],
    passed_count: int,
    failed_count: int,
    attempts: int
) -> str:
    """Format test results summary."""
    lines = []
    lines.append(f"\nTest Summary (after {attempts} attempt(s)):")
    lines.append(f"  Passed: {passed_count}")
    lines.append(f"  Failed: {failed_count}")
    lines.append(f"  Total:  {len(results)}")

    if failed_count > 0:
        lines.append("\nFailed tests:")
        for test in results:
            if not test.passed:
                lines.append(f"  - {test.test_name}")

    return "\n".join(lines)


def main():
    """Main entry point."""
    load_dotenv()

    # Parse arguments
    if len(sys.argv) < 2:
        print("Usage: uv run travis_test.py <adw-id> [OPTIONS]", file=sys.stderr)
        print("Options:", file=sys.stderr)
        print("  --max-retries N       Maximum retry attempts (default: 3)", file=sys.stderr)
        print("  --run-all-tests       Accepted but ignored (/test has no test selection)", file=sys.stderr)
        print("  --diff-base REF       Accepted but ignored (/test has no test selection)", file=sys.stderr)
        print("  --with-browser        Enable Chrome DevTools MCP for E2E/browser testing", file=sys.stderr)
        print("  --mcp-config FILE     Use a specific MCP config file", file=sys.stderr)
        print("  --working-dir DIR     Project directory to test (default: current directory)", file=sys.stderr)
        sys.exit(1)

    adw_id = sys.argv[1]
    max_retries = DEFAULT_MAX_RETRIES
    run_all_tests = False
    diff_base = "origin/main"
    run_all_tests_given = False
    diff_base_given = False
    mcp_config: Optional[str] = None
    working_dir_arg: Optional[str] = None

    # Parse flags
    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]

        if arg == "--max-retries":
            if i + 1 >= len(sys.argv):
                print("Error: --max-retries requires a value", file=sys.stderr)
                sys.exit(1)
            try:
                max_retries = int(sys.argv[i + 1])
                i += 2
            except ValueError:
                print(f"Error: Invalid max-retries value: {sys.argv[i + 1]}", file=sys.stderr)
                sys.exit(1)

        elif arg == "--run-all-tests":
            run_all_tests = True
            run_all_tests_given = True
            i += 1

        elif arg == "--diff-base":
            if i + 1 >= len(sys.argv):
                print("Error: --diff-base requires a value", file=sys.stderr)
                sys.exit(1)
            diff_base = sys.argv[i + 1]
            diff_base_given = True
            i += 2

        elif arg == "--with-browser":
            mcp_config = ".mcp-browser.json"
            i += 1

        elif arg == "--mcp-config":
            if i + 1 >= len(sys.argv):
                print("Error: --mcp-config requires a value", file=sys.stderr)
                sys.exit(1)
            mcp_config = sys.argv[i + 1]
            i += 2

        elif arg == "--working-dir":
            if i + 1 >= len(sys.argv):
                print("Error: --working-dir requires a value", file=sys.stderr)
                sys.exit(1)
            working_dir_arg = sys.argv[i + 1]
            i += 2

        else:
            print(f"Error: Unknown argument: {arg}", file=sys.stderr)
            sys.exit(1)

    working_dir = resolve_working_dir(working_dir_arg)

    # Setup logging
    logger = setup_logger(adw_id, "travis_test")
    logger.info(f"Travis Test starting - ADW ID: {adw_id}")
    logger.info(f"Max retries: {max_retries}")
    logger.info(f"Run all tests: {run_all_tests}")
    logger.info(f"Diff base: {diff_base}")
    logger.info(f"MCP config: {mcp_config or 'None (default)'}")
    logger.info(f"Working dir: {working_dir}")

    # Test selection is not wired into /test (only /test_e2e supports it) —
    # /test always runs the full {{TEST_COMMAND}}. Warn rather than silently
    # ignore so callers know the flag had no effect.
    if run_all_tests_given:
        logger.warning("--run-all-tests was given, but test selection is not wired for /test — the flag is ignored.")
    if diff_base_given:
        logger.warning("--diff-base was given, but test selection is not wired for /test — the flag is ignored.")

    # Load state
    state = TravisState.load(adw_id)

    # Check if build phase completed
    if not state.has_phase_completed("build"):
        logger.error("Build phase has not completed - run travis_build.py first")
        sys.exit(1)

    # Run tests with resolution
    test_run_result = run_tests_with_resolution(
        adw_id, logger, max_retries, working_dir, run_all_tests, diff_base, mcp_config
    )

    # Fail closed: a /test agent that failed to execute or produced
    # unparseable output on every attempt must never be reported as a
    # passing phase.
    if test_run_result is None:
        logger.error("Test phase failed: /test agent failed or its output was unparseable after all retries.")
        state.set_phase_result("test", {
            "success": False,
            "error": "test agent failed or output unparseable"
        })
        state.save()
        sys.exit(1)

    results, passed_count, failed_count, attempts = test_run_result

    # Format and print summary
    summary = format_test_summary(results, passed_count, failed_count, attempts)
    logger.info(summary)
    print(summary)

    # Update state
    state.set_phase_result("test", {
        "success": failed_count == 0,
        "passed": passed_count,
        "failed": failed_count,
        "total": len(results),
        "attempts": attempts,
        "mcp_config": mcp_config
    })
    state.save()

    # Exit with appropriate code
    if failed_count > 0:
        logger.error("Test phase completed with failures")
        sys.exit(1)
    else:
        logger.info("Test phase completed successfully")
        sys.exit(0)


if __name__ == "__main__":
    main()
