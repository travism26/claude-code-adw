#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "pydantic",
#   "python-dotenv",
#   "click",
#   "rich",
# ]
# ///
"""
Run complete plan→build→test→review workflow from a prompt.

This script runs four slash commands in sequence:
1. /chore, /feature, or /bug - Creates a plan based on the prompt and plan type
2. /implement - Implements the plan created in step 1
3. /test - Runs tests with automatic resolution
4. /review - Reviews the implementation against the spec

Usage:
    # Method 1: Direct execution (requires uv)
    ./adws/adw_prompt_plan_build_test_review.py "Add error handling to all API endpoints"

    # Method 2: Using uv run
    uv run adws/adw_prompt_plan_build_test_review.py "Refactor database connection logic"

Examples:
    # Run with default plan type (chore)
    ./adws/adw_prompt_plan_build_test_review.py "Add logging to agent.py"

    # Run with feature plan type
    ./adws/adw_prompt_plan_build_test_review.py "Add user authentication" --plan-type feature

    # Run with bug plan type (requires issue number)
    ./adws/adw_prompt_plan_build_test_review.py "Fix login error" --plan-type bug --issue-number 42

    # Dry run mode - preview what would happen without executing
    ./adws/adw_prompt_plan_build_test_review.py "Update UI" --dry-run

    # Run with specific model
    ./adws/adw_prompt_plan_build_test_review.py "Add logging" --model opus

    # Run from a different working directory
    ./adws/adw_prompt_plan_build_test_review.py "Update documentation" --working-dir /path/to/project

    # Skip E2E tests
    ./adws/adw_prompt_plan_build_test_review.py "Add tests" --skip-e2e

    # Skip review issue resolution
    ./adws/adw_prompt_plan_build_test_review.py "Update UI" --skip-resolution

    # Combine multiple options
    ./adws/adw_prompt_plan_build_test_review.py "Add feature X" --plan-type feature --model opus --skip-e2e
"""

import os
import sys
import json
import re
import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.rule import Rule

# Add the adw_modules directory to the path so we can import agent
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "adw_modules"))

from agent import (
    AgentTemplateRequest,
    AgentPromptResponse,
    execute_template,
    generate_short_id,
)

# Output file name constants
OUTPUT_JSONL = "cc_raw_output.jsonl"
OUTPUT_JSON = "cc_raw_output.json"
FINAL_OBJECT_JSON = "cc_final_object.json"
SUMMARY_JSON = "custom_summary_output.json"


def extract_plan_path(output: str) -> str:
    """Extract the plan file path from the planning command output.

    Looks for patterns like:
    - specs/chore-12345678-update-readme.md
    - specs/feature-12345678-add-feature.md
    - specs/bug-12345678-fix-login-error.md
    - specs/issue-8-adw-12345678-sdlc_planner-fix-bug.md (legacy /bug spec filenames)
    - Created plan at: specs/...
    - Plan file: specs/...
    """
    # Try multiple patterns to find the plan path (support chore, feature, and bug;
    # "issue-" is kept for legacy spec files predating the bug- filename convention)
    patterns = [
        r"specs/(?:chore|feature|bug|issue)-[a-zA-Z0-9\-]+\.md",
        r"Created plan at:\s*(specs/(?:chore|feature|bug|issue)-[a-zA-Z0-9\-]+\.md)",
        r"Plan file:\s*(specs/(?:chore|feature|bug|issue)-[a-zA-Z0-9\-]+\.md)",
        r"path.*?:\s*(specs/(?:chore|feature|bug|issue)-[a-zA-Z0-9\-]+\.md)",
    ]

    for pattern in patterns:
        match = re.search(pattern, output, re.IGNORECASE | re.MULTILINE)
        if match:
            return match.group(1) if match.groups() else match.group(0)

    # If no match found, raise an error
    raise ValueError("Could not find plan file path in planning output")


def save_phase_summary(
    phase: str,
    adw_id: str,
    agent_name: str,
    slash_command: str,
    args: list,
    model: str,
    working_dir: str,
    response: AgentPromptResponse,
    extra_data: dict | None = None,
):
    """Save a phase summary to JSON file."""
    output_dir = f"./agents/{adw_id}/{agent_name}"
    summary_path = f"{output_dir}/{SUMMARY_JSON}"

    data = {
        "phase": phase,
        "adw_id": adw_id,
        "slash_command": slash_command,
        "args": args,
        "path_to_slash_command_prompt": f".claude/commands/{slash_command[1:]}.md",
        "model": model,
        "working_dir": working_dir,
        "success": response.success,
        "session_id": response.session_id,
        "retry_code": response.retry_code,
        "output": response.output,
    }

    # Add extra data if provided
    if extra_data:
        data.update(extra_data)

    with open(summary_path, "w") as f:
        json.dump(data, f, indent=2)


def show_output_files(console: Console, output_dir: str, summary_path: str, title: str):
    """Display output files panel."""
    files_table = Table(show_header=True, box=None)
    files_table.add_column("File Type", style="bold cyan")
    files_table.add_column("Path", style="dim")
    files_table.add_column("Description", style="italic")

    files_table.add_row(
        "JSONL Stream",
        f"{output_dir}/{OUTPUT_JSONL}",
        "Raw streaming output from Claude Code",
    )
    files_table.add_row(
        "JSON Array",
        f"{output_dir}/{OUTPUT_JSON}",
        "All messages as a JSON array",
    )
    files_table.add_row(
        "Final Object",
        f"{output_dir}/{FINAL_OBJECT_JSON}",
        "Last message entry (final result)",
    )
    files_table.add_row(
        "Summary",
        summary_path,
        "High-level execution summary with metadata",
    )

    console.print(
        Panel(
            files_table,
            title=f"[bold blue]{title}[/bold blue]",
            border_style="blue",
        )
    )


@click.command()
@click.argument("prompt", required=True)
@click.option(
    "--model",
    type=click.Choice(["sonnet", "opus"]),
    default="sonnet",
    help="Claude model to use",
)
@click.option(
    "--working-dir",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, resolve_path=True),
    help="Working directory for command execution (default: current directory)",
)
@click.option(
    "--plan-type",
    type=click.Choice(["chore", "feature", "bug"]),
    default="chore",
    help="Type of plan to create (chore, feature, or bug)",
)
@click.option(
    "--issue-number",
    type=int,
    help="GitHub issue number (required when plan-type is 'bug')",
)
@click.option(
    "--dry-run",
    is_flag=True,
    help="Preview the workflow without executing it",
)
@click.option(
    "--skip-e2e",
    is_flag=True,
    help="Skip E2E tests during testing phase",
)
@click.option(
    "--skip-resolution",
    is_flag=True,
    help="Skip automatic issue resolution during review phase",
)
def main(
    prompt: str,
    model: str,
    working_dir: str,
    plan_type: str,
    issue_number: int,
    dry_run: bool,
    skip_e2e: bool,
    skip_resolution: bool,
):
    """Run complete plan→build→test→review workflow from a prompt."""
    console = Console()

    # Validate bug-specific requirements
    if plan_type == "bug" and not issue_number:
        console.print(
            Panel(
                "[bold red]Error: --issue-number is required when --plan-type is 'bug'[/bold red]",
                title="[bold red]❌ Invalid Arguments[/bold red]",
                border_style="red",
            )
        )
        sys.exit(1)

    # Generate a unique ID for this workflow
    adw_id = generate_short_id()

    # Use current directory if no working directory specified
    if not working_dir:
        working_dir = os.getcwd()

    # Set agent names for each phase
    planner_name = "planner"
    builder_name = "builder"
    tester_name = "tester"
    reviewer_name = "reviewer"

    console.print(
        Panel(
            f"[bold blue]ADW Prompt Plan→Build→Test→Review Workflow[/bold blue]\n\n"
            f"[cyan]ADW ID:[/cyan] {adw_id}\n"
            f"[cyan]Plan Type:[/cyan] {plan_type}\n"
            f"[cyan]Model:[/cyan] {model}\n"
            f"[cyan]Working Dir:[/cyan] {working_dir}\n"
            f"[cyan]Dry Run:[/cyan] {dry_run}\n"
            f"[cyan]Skip E2E:[/cyan] {skip_e2e}\n"
            f"[cyan]Skip Resolution:[/cyan] {skip_resolution}"
            + (f"\n[cyan]Issue Number:[/cyan] {issue_number}" if plan_type == "bug" else ""),
            title="[bold blue]🚀 Workflow Configuration[/bold blue]",
            border_style="blue",
        )
    )
    console.print()

    # Track all responses for summary
    all_responses = {}
    plan_path = None

    # ========================================================================
    # Phase 1: Planning (chore/feature/bug)
    # ========================================================================
    console.print(Rule(f"[bold yellow]Phase 1: Planning (/{plan_type})[/bold yellow]"))
    console.print()

    # Prepare planning request based on plan type
    if plan_type == "bug":
        # /bug uses the same [adw_id, prompt] contract as /chore and /feature.
        # When --issue-number is supplied, fold it into the prompt text so the
        # planner still sees it (structured issue JSON intake was dropped -
        # see bug.md's KNOWN GAPS note; a later milestone reintroduces it).
        bug_prompt = f"Issue #{issue_number}: {prompt}" if issue_number else prompt
        planning_args = [adw_id, bug_prompt]
        slash_command = "/bug"
    else:
        # For chore and feature, args are the same
        planning_args = [adw_id, prompt]
        slash_command = f"/{plan_type}"

    planning_request = AgentTemplateRequest(
        agent_name=planner_name,
        slash_command=slash_command,
        args=planning_args,
        adw_id=adw_id,
        model=model,
        working_dir=working_dir,
    )

    # Display planning execution info
    planning_info_table = Table(show_header=False, box=None, padding=(0, 1))
    planning_info_table.add_column(style="bold cyan")
    planning_info_table.add_column()

    planning_info_table.add_row("ADW ID", adw_id)
    planning_info_table.add_row("ADW Name", "adw_prompt_plan_build_test_review (planning)")
    planning_info_table.add_row("Command", slash_command)
    planning_info_table.add_row("Args", " ".join(planning_args))
    planning_info_table.add_row("Model", model)
    planning_info_table.add_row("Agent", planner_name)

    console.print(
        Panel(
            planning_info_table,
            title=f"[bold blue]🚀 {plan_type.capitalize()} Planning Inputs[/bold blue]",
            border_style="blue",
        )
    )
    console.print()

    # Dry run mode - show what would happen without executing
    if dry_run:
        console.print(
            Panel(
                f"[bold yellow]DRY RUN MODE - No commands will be executed[/bold yellow]\n\n"
                f"[cyan]Phase 1:[/cyan] Would execute {slash_command} with args: {planning_args}\n"
                f"[cyan]Phase 2:[/cyan] Would execute /implement with the generated plan file\n"
                f"[cyan]Phase 3:[/cyan] Would execute /test" + (" --skip-e2e" if skip_e2e else "") + "\n"
                "[cyan]Phase 4:[/cyan] Would execute /review with the plan file" + (" --skip-resolution" if skip_resolution else ""),
                title="[bold yellow]📋 Dry Run Preview[/bold yellow]",
                border_style="yellow",
            )
        )
        console.print("\n[bold green]Dry run complete. Use without --dry-run to execute.[/bold green]")
        sys.exit(0)

    try:
        # Execute the planning command
        with console.status("[bold yellow]Creating plan...[/bold yellow]"):
            planning_response = execute_template(planning_request)

        all_responses["planning"] = planning_response

        # Display the planning result
        if planning_response.success:
            console.print(
                Panel(
                    planning_response.output,
                    title="[bold green]✅ Planning Success[/bold green]",
                    border_style="green",
                    padding=(1, 2),
                )
            )

            # Extract the plan path from the output
            try:
                plan_path = extract_plan_path(planning_response.output)
                console.print(f"\n[bold cyan]Plan created at:[/bold cyan] {plan_path}")
            except ValueError as e:
                console.print(
                    Panel(
                        f"[bold red]Could not extract plan path: {str(e)}[/bold red]\n\n"
                        f"The {plan_type} command succeeded but the plan file path could not be found in the output.",
                        title="[bold red]❌ Parse Error[/bold red]",
                        border_style="red",
                    )
                )
                sys.exit(3)

        else:
            console.print(
                Panel(
                    planning_response.output,
                    title="[bold red]❌ Planning Failed[/bold red]",
                    border_style="red",
                    padding=(1, 2),
                )
            )
            console.print(
                "\n[bold red]Workflow aborted: Planning phase failed[/bold red]"
            )
            sys.exit(1)

        # Save planning phase summary
        save_phase_summary(
            "planning",
            adw_id,
            planner_name,
            slash_command,
            planning_args,
            model,
            working_dir,
            planning_response,
            {"plan_path": plan_path, "plan_type": plan_type},
        )

        # Show planning output files
        console.print()
        planning_output_dir = f"./agents/{adw_id}/{planner_name}"
        planning_summary_path = f"{planning_output_dir}/{SUMMARY_JSON}"
        show_output_files(
            console,
            planning_output_dir,
            planning_summary_path,
            "📄 Planning Output Files",
        )
        console.print()

        # ========================================================================
        # Phase 2: Implementation (/implement)
        # ========================================================================
        console.print(
            Rule("[bold yellow]Phase 2: Implementation (/implement)[/bold yellow]")
        )
        console.print()

        implement_request = AgentTemplateRequest(
            agent_name=builder_name,
            slash_command="/implement",
            args=[plan_path],
            adw_id=adw_id,
            model=model,
            working_dir=working_dir,
        )

        # Display implement execution info
        implement_info_table = Table(show_header=False, box=None, padding=(0, 1))
        implement_info_table.add_column(style="bold cyan")
        implement_info_table.add_column()

        implement_info_table.add_row("ADW ID", adw_id)
        implement_info_table.add_row("ADW Name", "adw_prompt_plan_build_test_review (building)")
        implement_info_table.add_row("Command", "/implement")
        implement_info_table.add_row("Args", plan_path)
        implement_info_table.add_row("Model", model)
        implement_info_table.add_row("Agent", builder_name)

        console.print(
            Panel(
                implement_info_table,
                title="[bold blue]🚀 Implement Inputs[/bold blue]",
                border_style="blue",
            )
        )
        console.print()

        # Execute the implement command
        with console.status("[bold yellow]Implementing plan...[/bold yellow]"):
            implement_response = execute_template(implement_request)

        all_responses["implementation"] = implement_response

        # Display the implement result
        if implement_response.success:
            console.print(
                Panel(
                    implement_response.output,
                    title="[bold green]✅ Implementation Success[/bold green]",
                    border_style="green",
                    padding=(1, 2),
                )
            )
        else:
            console.print(
                Panel(
                    implement_response.output,
                    title="[bold red]❌ Implementation Failed[/bold red]",
                    border_style="red",
                    padding=(1, 2),
                )
            )

        # Save implement phase summary
        save_phase_summary(
            "implementation",
            adw_id,
            builder_name,
            "/implement",
            [plan_path],
            model,
            working_dir,
            implement_response,
        )

        # Show implement output files
        console.print()
        implement_output_dir = f"./agents/{adw_id}/{builder_name}"
        implement_summary_path = f"{implement_output_dir}/{SUMMARY_JSON}"
        show_output_files(
            console,
            implement_output_dir,
            implement_summary_path,
            "📄 Implementation Output Files",
        )
        console.print()

        # ========================================================================
        # Phase 3: Testing (/test)
        # ========================================================================
        console.print(Rule("[bold yellow]Phase 3: Testing (/test)[/bold yellow]"))
        console.print()

        test_args = ["--skip-e2e"] if skip_e2e else []
        test_request = AgentTemplateRequest(
            agent_name=tester_name,
            slash_command="/test",
            args=test_args,
            adw_id=adw_id,
            model=model,
            working_dir=working_dir,
        )

        # Display test execution info
        test_info_table = Table(show_header=False, box=None, padding=(0, 1))
        test_info_table.add_column(style="bold cyan")
        test_info_table.add_column()

        test_info_table.add_row("ADW ID", adw_id)
        test_info_table.add_row("ADW Name", "adw_prompt_plan_build_test_review (testing)")
        test_info_table.add_row("Command", "/test")
        test_info_table.add_row("Args", " ".join(test_args) if test_args else "(none)")
        test_info_table.add_row("Model", model)
        test_info_table.add_row("Agent", tester_name)
        test_info_table.add_row("Skip E2E", str(skip_e2e))

        console.print(
            Panel(
                test_info_table,
                title="[bold blue]🚀 Test Inputs[/bold blue]",
                border_style="blue",
            )
        )
        console.print()

        # Execute the test command
        with console.status("[bold yellow]Running tests...[/bold yellow]"):
            test_response = execute_template(test_request)

        all_responses["testing"] = test_response

        # Display the test result
        if test_response.success:
            console.print(
                Panel(
                    test_response.output,
                    title="[bold green]✅ Testing Success[/bold green]",
                    border_style="green",
                    padding=(1, 2),
                )
            )
        else:
            console.print(
                Panel(
                    test_response.output,
                    title="[bold red]❌ Testing Failed[/bold red]",
                    border_style="red",
                    padding=(1, 2),
                )
            )

        # Save test phase summary
        save_phase_summary(
            "testing",
            adw_id,
            tester_name,
            "/test",
            test_args,
            model,
            working_dir,
            test_response,
            {"skip_e2e": skip_e2e},
        )

        # Show test output files
        console.print()
        test_output_dir = f"./agents/{adw_id}/{tester_name}"
        test_summary_path = f"{test_output_dir}/{SUMMARY_JSON}"
        show_output_files(
            console,
            test_output_dir,
            test_summary_path,
            "📄 Testing Output Files",
        )
        console.print()

        # ========================================================================
        # Phase 4: Review (/review)
        # ========================================================================
        console.print(Rule("[bold yellow]Phase 4: Review (/review)[/bold yellow]"))
        console.print()

        review_args = [adw_id, plan_path, reviewer_name]
        if skip_resolution:
            review_args.append("--skip-resolution")

        review_request = AgentTemplateRequest(
            agent_name=reviewer_name,
            slash_command="/review",
            args=review_args,
            adw_id=adw_id,
            model=model,
            working_dir=working_dir,
        )

        # Display review execution info
        review_info_table = Table(show_header=False, box=None, padding=(0, 1))
        review_info_table.add_column(style="bold cyan")
        review_info_table.add_column()

        review_info_table.add_row("ADW ID", adw_id)
        review_info_table.add_row("ADW Name", "adw_prompt_plan_build_test_review (reviewing)")
        review_info_table.add_row("Command", "/review")
        review_info_table.add_row("Args", " ".join(review_args))
        review_info_table.add_row("Model", model)
        review_info_table.add_row("Agent", reviewer_name)
        review_info_table.add_row("Skip Resolution", str(skip_resolution))

        console.print(
            Panel(
                review_info_table,
                title="[bold blue]🚀 Review Inputs[/bold blue]",
                border_style="blue",
            )
        )
        console.print()

        # Execute the review command
        with console.status("[bold yellow]Reviewing implementation...[/bold yellow]"):
            review_response = execute_template(review_request)

        all_responses["review"] = review_response

        # Display the review result
        if review_response.success:
            console.print(
                Panel(
                    review_response.output,
                    title="[bold green]✅ Review Success[/bold green]",
                    border_style="green",
                    padding=(1, 2),
                )
            )
        else:
            console.print(
                Panel(
                    review_response.output,
                    title="[bold red]❌ Review Failed[/bold red]",
                    border_style="red",
                    padding=(1, 2),
                )
            )

        # Save review phase summary
        save_phase_summary(
            "review",
            adw_id,
            reviewer_name,
            "/review",
            review_args,
            model,
            working_dir,
            review_response,
            {"skip_resolution": skip_resolution},
        )

        # Show review output files
        console.print()
        review_output_dir = f"./agents/{adw_id}/{reviewer_name}"
        review_summary_path = f"{review_output_dir}/{SUMMARY_JSON}"
        show_output_files(
            console,
            review_output_dir,
            review_summary_path,
            "📄 Review Output Files",
        )

        # ========================================================================
        # Show workflow summary
        # ========================================================================
        console.print()
        console.print(Rule("[bold blue]Workflow Summary[/bold blue]"))
        console.print()

        summary_table = Table(show_header=True, box=None)
        summary_table.add_column("Phase", style="bold cyan")
        summary_table.add_column("Status", style="bold")
        summary_table.add_column("Output Directory", style="dim")

        # Add rows for each phase
        for phase_name, phase_data in [
            ("Planning (/chore)", ("planning", planner_name)),
            ("Implementation (/implement)", ("implementation", builder_name)),
            ("Testing (/test)", ("testing", tester_name)),
            ("Review (/review)", ("review", reviewer_name)),
        ]:
            phase_key, agent_name = phase_data
            response = all_responses.get(phase_key)
            status = "✅ Success" if response and response.success else "❌ Failed"
            summary_table.add_row(
                phase_name,
                status,
                f"./agents/{adw_id}/{agent_name}/",
            )

        console.print(summary_table)

        # Create overall workflow summary
        workflow_summary_path = f"./agents/{adw_id}/workflow_summary.json"
        os.makedirs(f"./agents/{adw_id}", exist_ok=True)

        with open(workflow_summary_path, "w") as f:
            json.dump(
                {
                    "workflow": "prompt_plan_build_test_review",
                    "adw_id": adw_id,
                    "plan_type": plan_type,
                    "prompt": prompt,
                    "model": model,
                    "working_dir": working_dir,
                    "plan_path": plan_path,
                    "skip_e2e": skip_e2e,
                    "skip_resolution": skip_resolution,
                    "issue_number": issue_number if plan_type == "bug" else None,
                    "phases": {
                        "planning": {
                            "success": planning_response.success,
                            "session_id": planning_response.session_id,
                            "agent": planner_name,
                            "output_dir": f"./agents/{adw_id}/{planner_name}/",
                        },
                        "implementation": {
                            "success": implement_response.success,
                            "session_id": implement_response.session_id,
                            "agent": builder_name,
                            "output_dir": f"./agents/{adw_id}/{builder_name}/",
                        },
                        "testing": {
                            "success": test_response.success,
                            "session_id": test_response.session_id,
                            "agent": tester_name,
                            "output_dir": f"./agents/{adw_id}/{tester_name}/",
                        },
                        "review": {
                            "success": review_response.success,
                            "session_id": review_response.session_id,
                            "agent": reviewer_name,
                            "output_dir": f"./agents/{adw_id}/{reviewer_name}/",
                        },
                    },
                    "overall_success": (
                        planning_response.success
                        and implement_response.success
                        and test_response.success
                        and review_response.success
                    ),
                },
                f,
                indent=2,
            )

        console.print(
            f"\n[bold cyan]Workflow summary:[/bold cyan] {workflow_summary_path}"
        )
        console.print()

        # Exit with appropriate code
        all_success = all(
            response.success for response in all_responses.values()
        )
        if all_success:
            console.print(
                "[bold green]✅ Workflow completed successfully![/bold green]"
            )
            sys.exit(0)
        else:
            console.print(
                "[bold yellow]⚠️  Workflow completed with errors[/bold yellow]"
            )
            sys.exit(1)

    except Exception as e:
        console.print(
            Panel(
                f"[bold red]{str(e)}[/bold red]",
                title="[bold red]❌ Unexpected Error[/bold red]",
                border_style="red",
            )
        )
        sys.exit(2)


if __name__ == "__main__":
    main()
