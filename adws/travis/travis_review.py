#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""Travis review phase script.

Usage:
  uv run travis_review.py <adw-id> [--working-dir DIR] [--diff-base REF]

Reviews the implementation. Does NOT automatically resolve review issues -
just reports them.

A legacy run (no ticket_ref in state) is reviewed by /review against the Plan.
A Ticket run is reviewed against the Review oracle instead - the Ticket, then
its Spec - on two separate axes, Spec and Standards, and never against the
Plan (ADR-0001, adw_modules/ticket_review.py). Both produce the same review
result and review-issues file.

Options:
  --working-dir DIR: Project directory to review (default: current directory)
  --diff-base REF: Git reference a Ticket review diffs against (default: the
                   run's recorded diff_base, else origin/main)

Outputs:
  - Review summary with issue list (if any)
  - State updated with review results
  - Logs written to agents/{adw_id}/travis_review.log
"""

import sys
import os
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from adw_modules.agent import execute_template, AgentTemplateRequest
from adw_modules.utils import setup_logger, parse_json, resolve_working_dir
from adw_modules.data_types import ReviewResult
from adw_modules.ticket_review import TicketReview, run_ticket_review
from travis.travis_state import TravisState


def run_review(plan_file: str, adw_id: str, logger: logging.Logger, working_dir: str) -> ReviewResult:
    """Run the review using the /review command.

    Args:
        plan_file: Path to the plan file (from state's plan_file)
        adw_id: ADW workflow ID
        logger: Logger instance
        working_dir: Project directory to review

    Returns:
        ReviewResult object

    Raises:
        ValueError: If review output cannot be parsed
    """
    logger.info(f"Reviewing implementation against spec: {plan_file}")

    request = AgentTemplateRequest(
        agent_name="reviewer",
        slash_command="/review",
        args=[adw_id, plan_file],
        adw_id=adw_id,
        model="sonnet",
        working_dir=working_dir  # Ensure skills discovered from the target project
    )

    response = execute_template(request)

    if not response.success:
        logger.error(f"Review command failed: {response.output}")
        raise ValueError(f"Review execution failed: {response.output}")

    # Parse review results
    try:
        review_result = parse_json(response.output, ReviewResult)
        return review_result
    except Exception as e:
        logger.error(f"Failed to parse review results: {e}")
        logger.debug(f"Review output was: {response.output}")
        raise ValueError(f"Failed to parse review results: {e}")


def diff_base_for(state, explicit: Optional[str]) -> str:
    """The ref a Ticket review diffs against: an explicit --diff-base, else the
    diff base the run recorded in state (its worktree base, for a worktree
    run), else origin/main."""
    return explicit or state.get("diff_base") or "origin/main"


def review_for_state(state, adw_id: str, logger: logging.Logger, working_dir: str,
                     diff_base: str) -> tuple[ReviewResult, Optional[TicketReview]]:
    """Run the review the run calls for. A Ticket run (ticket_ref in state) is
    reviewed against its Ticket and Spec and also returns that two-axis
    TicketReview; the Plan is never handed to it. A legacy run gets /review
    against the Plan and no TicketReview.

    Raises:
        ValueError: If the review fails or can't be parsed, or a legacy run
            has no plan_file
    """
    ticket_ref = state.get("ticket_ref")
    if ticket_ref:
        spec_ref = state.get("spec_ref")
        logger.info(f"Reviewing against Ticket {ticket_ref} "
                    f"(Spec: {spec_ref or 'none'}), diff base {diff_base}")
        ticket_review = run_ticket_review(adw_id, ticket_ref, spec_ref, diff_base, working_dir)
        return ticket_review.result, ticket_review

    plan_file = state.get("plan_file")
    if not plan_file:
        raise ValueError("No plan file found in state")
    return run_review(plan_file, adw_id, logger, working_dir), None


def _issue_lines(issue, indent: str) -> list:
    lines = [
        f"\n{indent}Issue #{issue.review_issue_number}:",
        f"{indent}  Severity: {issue.issue_severity}",
        f"{indent}  Description: {issue.issue_description}",
        f"{indent}  Resolution: {issue.issue_resolution}",
    ]
    if issue.screenshot_path:
        lines.append(f"{indent}  Screenshot: {issue.screenshot_path}")
    return lines


def format_review_summary(review: ReviewResult,
                          ticket_review: Optional[TicketReview] = None) -> str:
    """Format review results summary.

    Args:
        review: ReviewResult object
        ticket_review: A Ticket review; each of its axes is printed as its own section

    Returns:
        Formatted summary string
    """
    lines = []
    lines.append("\nReview Summary:")
    lines.append(f"  Status: {'PASSED' if review.success else 'FAILED'}")

    if ticket_review is not None:
        lines.append(f"\n  Issues Found: {len(review.review_issues)}")
        for axis in ticket_review.axes:
            lines.append(f"\n  {axis.name} axis ({len(axis.issues)} issue(s)):")
            lines.append(f"    Summary: {axis.summary}")
            for issue in axis.issues:
                lines.extend(_issue_lines(issue, "    "))
    else:
        lines.append(f"  Summary: {review.review_summary}")
        if review.review_issues:
            lines.append(f"\n  Issues Found: {len(review.review_issues)}")
            for issue in review.review_issues:
                lines.extend(_issue_lines(issue, "  "))
        else:
            lines.append("\n  No issues found")

    if review.screenshots:
        lines.append(f"\n  Screenshots: {len(review.screenshots)}")
        for screenshot in review.screenshots:
            lines.append(f"    - {screenshot}")

    return "\n".join(lines)


def _issue_groups(review: ReviewResult, ticket_review: Optional[TicketReview]) -> list:
    """(heading lines, issues) for each part of the review-issues file: one
    unheaded group for a legacy review, one headed group per axis for a
    Ticket review."""
    if ticket_review is None:
        return [([], review.review_issues)]
    return [
        ([f"## {axis.name} axis", "", axis.summary, ""]
         + ([] if axis.issues else ["No issues on this axis.", ""]), axis.issues)
        for axis in ticket_review.axes
    ]


def _issue_entry(issue) -> list:
    """One `### Issue #N: severity` entry, the shape travis_patch reads."""
    return [
        f"### Issue #{issue.review_issue_number}: {issue.issue_severity}",
        "",
        f"**File:** {issue.screenshot_path or 'N/A'}",
        "",
        "**Description:**",
        issue.issue_description,
        "",
        "**Resolution:**",
        issue.issue_resolution,
        "",
        "---",
        "",
    ]


def create_review_issues_file(
    review: ReviewResult,
    plan_file: str,
    adw_id: str,
    logger: logging.Logger,
    working_dir: str,
    ticket_review: Optional[TicketReview] = None,
) -> str | None:
    """Create the review issues markdown file if there are any issues.

    Args:
        review: ReviewResult object
        plan_file: Path to the plan file
        adw_id: ADW workflow ID
        logger: Logger instance
        working_dir: Project directory the review ran against
        ticket_review: A Ticket review. Its file names the Review oracle
            instead of the Plan and gives each axis its own section; a legacy
            file keeps its original layout. Issue entries keep one shape either
            way, so travis_patch reads them as before.

    Returns:
        Path to created file, or None if no issues
    """
    if not review.review_issues:
        logger.info("No review issues - skipping review issues file creation")
        return None

    # Create directory if needed (inside the target project)
    review_issues_dir = Path(working_dir) / "specs" / "review_issues"
    review_issues_dir.mkdir(parents=True, exist_ok=True)

    # Build the file path
    review_file = review_issues_dir / f"review-{adw_id}.md"

    # Build file content
    current_date = datetime.now().strftime("%Y-%m-%d %H:%M")
    status = "PASSED" if review.success else "FAILED"

    source = (f"**Spec File:** {plan_file}" if ticket_review is None
              else "**Reviewed against:** the Ticket and its Spec (Review oracle)")
    lines = [
        f"# Review Issues - {adw_id}",
        "",
        source,
        f"**Review Date:** {current_date}",
        f"**Status:** {status}",
        "",
        "## Summary",
        "",
        review.review_summary,
        "",
        f"## Issues Found: {len(review.review_issues)}",
        "",
    ]

    for heading, issues in _issue_groups(review, ticket_review):
        lines.extend(heading)
        for issue in issues:
            lines.extend(_issue_entry(issue))

    content = "\n".join(lines)

    # Write the file
    review_file.write_text(content)
    logger.info(f"Created review issues file: {review_file}")

    return str(review_file)


def review_phase_result(review: ReviewResult, review_issues_file: Optional[str]) -> dict:
    """The review phase's entry in state; draft-PR readiness reads its success."""
    return {
        "success": review.success,
        "summary": review.review_summary,
        "issue_count": len(review.review_issues),
        "issues": [
            {
                "number": issue.review_issue_number,
                "severity": issue.issue_severity,
                "description": issue.issue_description
            }
            for issue in review.review_issues
        ],
        "screenshots": review.screenshots,
        "review_issues_file": review_issues_file
    }


def main():
    """Main entry point."""
    load_dotenv()

    if len(sys.argv) < 2:
        print("Usage: uv run travis_review.py <adw-id> [--working-dir DIR] [--diff-base REF]", file=sys.stderr)
        sys.exit(1)

    adw_id = sys.argv[1]
    working_dir_arg = None
    diff_base_arg = None

    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "--working-dir":
            if i + 1 >= len(sys.argv):
                print("Error: --working-dir requires a value", file=sys.stderr)
                sys.exit(1)
            working_dir_arg = sys.argv[i + 1]
            i += 2
        elif arg == "--diff-base":
            if i + 1 >= len(sys.argv):
                print("Error: --diff-base requires a value", file=sys.stderr)
                sys.exit(1)
            diff_base_arg = sys.argv[i + 1]
            i += 2
        else:
            print(f"Error: Unknown argument: {arg}", file=sys.stderr)
            sys.exit(1)

    working_dir = resolve_working_dir(working_dir_arg)

    # Setup logging
    logger = setup_logger(adw_id, "travis_review")
    logger.info(f"Travis Review starting - ADW ID: {adw_id}")

    # Load state
    state = TravisState.load(adw_id)

    # Check if test phase completed
    if not state.has_phase_completed("test"):
        logger.error("Test phase has not completed - run travis_test.py first")
        sys.exit(1)

    # A Ticket run is reviewed against its Ticket and Spec, never this Plan.
    plan_file = state.get("plan_file")

    # Run review
    try:
        review_result, ticket_review = review_for_state(
            state, adw_id, logger, working_dir, diff_base_for(state, diff_base_arg))
    except ValueError as e:
        logger.error(f"Review failed: {e}")
        state.set_phase_result("review", {
            "success": False,
            "error": str(e)
        })
        state.save()
        sys.exit(1)

    # Format and print summary
    summary = format_review_summary(review_result, ticket_review)
    logger.info(summary)
    print(summary)

    # Create review issues file if there are issues (deterministic - don't rely on agent)
    review_issues_file = create_review_issues_file(
        review_result, plan_file, adw_id, logger, working_dir, ticket_review)
    if review_issues_file:
        print(f"\nReview issues file created: {review_issues_file}")

    # Update state
    state.set_phase_result("review", review_phase_result(review_result, review_issues_file))
    state.save()

    # Exit with appropriate code
    if not review_result.success:
        logger.error("Review phase completed with issues")
        sys.exit(1)
    else:
        logger.info("Review phase completed successfully")
        sys.exit(0)


if __name__ == "__main__":
    main()
