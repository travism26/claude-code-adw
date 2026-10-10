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
ADW (Autonomous Development Workflow) Chore & Implement Script

PURPOSE:
This script orchestrates a two-phase autonomous development workflow that takes a natural
language prompt and turns it into implemented code changes. It's designed to automate
the full cycle of planning and execution for development tasks.

WORKFLOW PHASES:
1. PLANNING PHASE (/feature):
   - Takes a user's natural language prompt (e.g., "Add error handling to API endpoints")
   - Executes the /feature slash command via Claude Code
   - Claude analyzes the codebase and creates a detailed implementation plan
   - The plan is saved as a markdown file in specs/feature-{id}-{description}.md
   - The plan includes step-by-step instructions for implementing the requested changes

2. IMPLEMENTATION PHASE (/implement):
   - Takes the plan file path from phase 1
   - Executes the /implement slash command via Claude Code
   - Claude reads the plan and implements all the changes in the actual codebase
   - Makes real file edits, creates new files, runs tests, etc.

KEY FEATURES:
- Unique ADW ID: Each workflow run gets a unique identifier for tracking
- Rich Terminal Output: Uses the 'rich' library for formatted, colorful terminal output
- Complete Artifact Logging: Saves all Claude Code interactions as JSON/JSONL files
- Model Selection: Supports both Sonnet (fast) and Opus (more capable) models
- Error Handling: Validates each phase before proceeding to the next
- Summary Reports: Creates detailed JSON summaries of both phases and overall workflow

OUTPUT ARTIFACTS:
For each phase, the script saves:
- cc_raw_output.jsonl: Streaming output from Claude Code (one JSON object per line)
- cc_raw_output.json: All messages as a JSON array (easier to parse programmatically)
- cc_final_object.json: The final message from Claude (usually contains the result)
- custom_summary_output.json: High-level summary with metadata, success status, etc.

Additionally, a workflow_summary.json is created at the ADW ID level combining both phases.

USAGE EXAMPLES:
    # Basic usage with default Sonnet model
    ./adws/adw_chore_implement.py "Add error handling to all API endpoints"

    # Use more capable Opus model for complex tasks
    ./adws/adw_chore_implement.py "Add logging to agent.py" --model opus

    # Run from a different working directory
    ./adws/adw_chore_implement.py "Update documentation" --working-dir /path/to/project

TECHNICAL IMPLEMENTATION:
- Uses the 'agent' module (from adw_modules/) to execute slash commands
- Each slash command runs Claude Code in a subprocess with special formatting
- Parses Claude's output to extract key information (like plan file paths)
- Uses Click for CLI argument parsing and Rich for terminal formatting
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
# This allows us to import the agent module which contains the core logic
# for executing slash commands and communicating with Claude Code
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "adw_modules"))

from agent import (
    AgentTemplateRequest,  # Data structure for requesting slash command execution
    execute_template,      # Main function that executes a slash command
    generate_short_id,     # Utility to create unique identifiers for workflow runs
)

# Output file name constants
# These files are created in the agents/{adw_id}/{agent_name}/ directory
OUTPUT_JSONL = "cc_raw_output.jsonl"        # Streaming JSON Lines format (one JSON object per line)
OUTPUT_JSON = "cc_raw_output.json"          # All messages combined into a single JSON array
FINAL_OBJECT_JSON = "cc_final_object.json"  # Just the final message from Claude (usually the result)
SUMMARY_JSON = "custom_summary_output.json" # Human-readable summary with metadata and success status


def extract_plan_path(output: str) -> str:
    """Extract the plan file path from the chore command output.

    WHAT THIS DOES:
    After the /feature command runs, Claude Code creates a plan file and mentions
    it in the output text. This function searches through that text to find
    the file path so we can pass it to the /implement command in phase 2.

    WHY MULTIPLE PATTERNS:
    Claude might phrase the output differently each time, so we try multiple
    regex patterns to catch different ways it might mention the file:
    - Just the path: "specs/feature-12345678-update-readme.md"
    - With context: "Created plan at: specs/feature-..."
    - With label: "Plan file: specs/feature-..."
    - Generic: "path: specs/feature-..."

    EXPECTED FORMAT:
    The plan file always follows the pattern: specs/feature-{id}-{description}.md

    RAISES:
    ValueError if no plan path can be found in the output (indicates /feature failed)
    """
    # Try multiple patterns to find the plan path
    # Ordered from most specific to most general to get the best match first
    patterns = [
        r"specs/feature-[a-zA-Z0-9\-]+\.md",  # Just the file path itself
        r"Created plan at:\s*(specs/feature-[a-zA-Z0-9\-]+\.md)",  # "Created plan at: {path}"
        r"Plan file:\s*(specs/feature-[a-zA-Z0-9\-]+\.md)",  # "Plan file: {path}"
        r"path.*?:\s*(specs/feature-[a-zA-Z0-9\-]+\.md)",  # Any variation with "path:"
    ]

    for pattern in patterns:
        match = re.search(pattern, output, re.IGNORECASE | re.MULTILINE)
        if match:
            # If the pattern has a capture group (parentheses), use that
            # Otherwise use the full match
            return match.group(1) if match.groups() else match.group(0)

    # If no match found after trying all patterns, the /feature command likely failed
    # or returned output in an unexpected format
    raise ValueError("Could not find plan file path in chore output")


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
def main(
    prompt: str,
    model: str,
    working_dir: str,
):
    """Run chore planning and implementation workflow.

    MAIN ENTRY POINT:
    This function orchestrates the entire two-phase workflow. It:
    1. Sets up the environment and generates a unique ID
    2. Executes the /feature command (planning phase)
    3. Extracts the plan file path from the output
    4. Executes the /implement command (implementation phase)
    5. Saves comprehensive logs and summaries
    6. Reports success/failure status

    PARAMETERS:
    - prompt: Natural language description of what to build (e.g., "Add error handling")
    - model: Which Claude model to use ("sonnet" is faster, "opus" is more capable)
    - working_dir: Where to run the commands (defaults to current directory)

    EXIT CODES:
    0 = Both phases succeeded
    1 = One or both phases failed (but completed)
    2 = Unexpected error (exception thrown)
    3 = Parse error (couldn't extract plan path)
    """
    console = Console()

    # Generate a unique ID for this workflow run
    # This ID is used to organize all output files and is included in the plan filename
    # Format: 8 random lowercase letters/numbers (e.g., "a3f9x2b1")
    adw_id = generate_short_id()

    # Use current directory if no working directory specified
    # This allows the workflow to run in any project directory
    if not working_dir:
        working_dir = os.getcwd()

    # Set default agent names for organizing output files
    # Each agent gets its own subdirectory under agents/{adw_id}/
    planner_name = "planner"  # Agent that creates the plan (/feature command)
    builder_name = "builder"  # Agent that implements the plan (/implement command)

    console.print(
        Panel(
            f"[bold blue]ADW Chore & Implement Workflow[/bold blue]\n\n"
            f"[cyan]ADW ID:[/cyan] {adw_id}\n"
            f"[cyan]Model:[/cyan] {model}\n"
            f"[cyan]Working Dir:[/cyan] {working_dir}",
            title="[bold blue]🚀 Workflow Configuration[/bold blue]",
            border_style="blue",
        )
    )
    console.print()

    # ====================================================================
    # PHASE 1: PLANNING - Run /feature command
    # ====================================================================
    # This phase uses Claude Code to analyze the prompt and create a detailed
    # implementation plan. The plan is saved as a markdown file that will be
    # used in Phase 2.
    console.print(Rule("[bold yellow]Phase 1: Planning (/feature)[/bold yellow]"))
    console.print()

    # Create the chore request
    # AgentTemplateRequest is a data structure that specifies:
    # - Which slash command to run (/feature)
    # - What arguments to pass (the adw_id and user's prompt)
    # - Which model to use (sonnet or opus)
    # - Where to run it (working_dir)
    # - Where to save outputs (organized by agent_name and adw_id)
    chore_request = AgentTemplateRequest(
        agent_name=planner_name,      # Organizes output in agents/{adw_id}/planner/
        slash_command="/feature",       # The command to execute
        args=[adw_id, prompt],        # Passed to the /feature command
        adw_id=adw_id,                # Unique identifier for this workflow run
        model=model,                  # "sonnet" or "opus"
        working_dir=working_dir,      # Where Claude Code will run
    )

    # Display chore execution info
    chore_info_table = Table(show_header=False, box=None, padding=(0, 1))
    chore_info_table.add_column(style="bold cyan")
    chore_info_table.add_column()

    chore_info_table.add_row("ADW ID", adw_id)
    chore_info_table.add_row("ADW Name", "adw_chore_implement (planning)")
    chore_info_table.add_row("Command", "/feature")
    chore_info_table.add_row("Args", f'{adw_id} "{prompt}"')
    chore_info_table.add_row("Model", model)
    chore_info_table.add_row("Agent", planner_name)

    console.print(
        Panel(
            chore_info_table,
            title="[bold blue]🚀 Chore Inputs[/bold blue]",
            border_style="blue",
        )
    )
    console.print()

    plan_path = None  # Will be populated after /feature succeeds

    try:
        # Execute the chore command
        # execute_template() calls Claude Code as a subprocess and waits for completion
        # It captures all output and saves it to the various JSON files
        # This may take several minutes depending on the complexity of the prompt
        with console.status("[bold yellow]Creating plan...[/bold yellow]"):
            chore_response = execute_template(chore_request)

        # Display the chore result
        # chore_response contains:
        # - success: True if the command completed without errors
        # - output: The text output from Claude Code
        # - session_id: Unique identifier for the Claude Code session
        # - retry_code: Code to resume if needed
        if chore_response.success:
            # Success panel
            console.print(
                Panel(
                    chore_response.output,
                    title="[bold green]✅ Planning Success[/bold green]",
                    border_style="green",
                    padding=(1, 2),
                )
            )

            # Extract the plan path from the output
            # The /feature command creates a file like specs/feature-{id}-{description}.md
            # We need to find this path in the output text so we can pass it to /implement
            try:
                plan_path = extract_plan_path(chore_response.output)
                console.print(f"\n[bold cyan]Plan created at:[/bold cyan] {plan_path}")
            except ValueError as e:
                # If we can't find the plan path, something went wrong with parsing
                # This shouldn't happen if /feature succeeded, but if it does we can't continue
                console.print(
                    Panel(
                        f"[bold red]Could not extract plan path: {str(e)}[/bold red]\n\n"
                        "The chore command succeeded but the plan file path could not be found in the output.",
                        title="[bold red]❌ Parse Error[/bold red]",
                        border_style="red",
                    )
                )
                sys.exit(3)

        else:
            # Error panel
            console.print(
                Panel(
                    chore_response.output,
                    title="[bold red]❌ Planning Failed[/bold red]",
                    border_style="red",
                    padding=(1, 2),
                )
            )
            console.print(
                "\n[bold red]Workflow aborted: Planning phase failed[/bold red]"
            )
            sys.exit(1)

        # Save chore phase summary
        # This creates a custom_summary_output.json file with high-level information
        # about the planning phase. This is separate from the raw Claude Code output
        # and makes it easier to understand what happened at a glance.
        chore_output_dir = f"./agents/{adw_id}/{planner_name}"
        chore_summary_path = f"{chore_output_dir}/{SUMMARY_JSON}"

        with open(chore_summary_path, "w") as f:
            json.dump(
                {
                    "phase": "planning",
                    "adw_id": adw_id,
                    "slash_command": "/feature",
                    "args": [adw_id, prompt],
                    "path_to_slash_command_prompt": ".claude/commands/feature.md",  # The prompt file used
                    "model": model,
                    "working_dir": working_dir,
                    "success": chore_response.success,
                    "session_id": chore_response.session_id,  # Can be used to resume the session
                    "retry_code": chore_response.retry_code,  # Can be used to retry if needed
                    "output": chore_response.output,          # The full text output from Claude
                    "plan_path": plan_path,                   # The generated plan file path (critical for phase 2)
                },
                f,
                indent=2,
            )

        # Show chore output files
        console.print()

        # Files saved panel for chore phase
        chore_files_table = Table(show_header=True, box=None)
        chore_files_table.add_column("File Type", style="bold cyan")
        chore_files_table.add_column("Path", style="dim")
        chore_files_table.add_column("Description", style="italic")

        chore_files_table.add_row(
            "JSONL Stream",
            f"{chore_output_dir}/{OUTPUT_JSONL}",
            "Raw streaming output from Claude Code",
        )
        chore_files_table.add_row(
            "JSON Array",
            f"{chore_output_dir}/{OUTPUT_JSON}",
            "All messages as a JSON array",
        )
        chore_files_table.add_row(
            "Final Object",
            f"{chore_output_dir}/{FINAL_OBJECT_JSON}",
            "Last message entry (final result)",
        )
        chore_files_table.add_row(
            "Summary",
            chore_summary_path,
            "High-level execution summary with metadata",
        )

        console.print(
            Panel(
                chore_files_table,
                title="[bold blue]📄 Planning Output Files[/bold blue]",
                border_style="blue",
            )
        )

        console.print()

        # ====================================================================
        # PHASE 2: IMPLEMENTATION - Run /implement command
        # ====================================================================
        # This phase reads the plan file created in Phase 1 and actually
        # implements all the changes in the codebase. Claude Code will:
        # - Read and understand the plan
        # - Make file edits, create new files, etc.
        # - Run tests to verify the changes work
        # - Report on what was done
        console.print(
            Rule("[bold yellow]Phase 2: Implementation (/implement)[/bold yellow]")
        )
        console.print()

        # Create the implement request
        # This is similar to the chore request but:
        # - Uses a different agent name (builder) for organization
        # - Runs the /implement command instead of /feature
        # - Takes the plan file path as the argument (not the user's prompt)
        implement_request = AgentTemplateRequest(
            agent_name=builder_name,     # Organizes output in agents/{adw_id}/builder/
            slash_command="/implement",  # The command to execute
            args=[plan_path],            # Path to the plan file from Phase 1
            adw_id=adw_id,               # Same ID as Phase 1 (links them together)
            model=model,                 # Same model as Phase 1
            working_dir=working_dir,     # Same working directory as Phase 1
        )

        # Display implement execution info
        implement_info_table = Table(show_header=False, box=None, padding=(0, 1))
        implement_info_table.add_column(style="bold cyan")
        implement_info_table.add_column()

        implement_info_table.add_row("ADW ID", adw_id)
        implement_info_table.add_row("ADW Name", "adw_chore_implement (building)")
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
        # This is where the actual code changes happen!
        # execute_template() runs Claude Code which will:
        # 1. Read the plan file
        # 2. Analyze the codebase
        # 3. Make the necessary changes (file edits, new files, etc.)
        # 4. Run tests and verify the implementation
        # This can take several minutes or even longer for complex implementations
        with console.status("[bold yellow]Implementing plan...[/bold yellow]"):
            implement_response = execute_template(implement_request)

        # Display the implement result
        # The response indicates whether implementation succeeded and what was done
        if implement_response.success:
            # Success panel
            console.print(
                Panel(
                    implement_response.output,
                    title="[bold green]✅ Implementation Success[/bold green]",
                    border_style="green",
                    padding=(1, 2),
                )
            )

            if implement_response.session_id:
                console.print(
                    f"\n[bold cyan]Session ID:[/bold cyan] {implement_response.session_id}"
                )
        else:
            # Error panel
            console.print(
                Panel(
                    implement_response.output,
                    title="[bold red]❌ Implementation Failed[/bold red]",
                    border_style="red",
                    padding=(1, 2),
                )
            )

        # Save implement phase summary
        implement_output_dir = f"./agents/{adw_id}/{builder_name}"
        implement_summary_path = f"{implement_output_dir}/{SUMMARY_JSON}"

        with open(implement_summary_path, "w") as f:
            json.dump(
                {
                    "phase": "implementation",
                    "adw_id": adw_id,
                    "slash_command": "/implement",
                    "args": [plan_path],
                    "path_to_slash_command_prompt": ".claude/commands/implement.md",
                    "model": model,
                    "working_dir": working_dir,
                    "success": implement_response.success,
                    "session_id": implement_response.session_id,
                    "retry_code": implement_response.retry_code,
                    "output": implement_response.output,
                },
                f,
                indent=2,
            )

        # Show implement output files
        console.print()

        # Files saved panel for implement phase
        implement_files_table = Table(show_header=True, box=None)
        implement_files_table.add_column("File Type", style="bold cyan")
        implement_files_table.add_column("Path", style="dim")
        implement_files_table.add_column("Description", style="italic")

        implement_files_table.add_row(
            "JSONL Stream",
            f"{implement_output_dir}/{OUTPUT_JSONL}",
            "Raw streaming output from Claude Code",
        )
        implement_files_table.add_row(
            "JSON Array",
            f"{implement_output_dir}/{OUTPUT_JSON}",
            "All messages as a JSON array",
        )
        implement_files_table.add_row(
            "Final Object",
            f"{implement_output_dir}/{FINAL_OBJECT_JSON}",
            "Last message entry (final result)",
        )
        implement_files_table.add_row(
            "Summary",
            implement_summary_path,
            "High-level execution summary with metadata",
        )

        console.print(
            Panel(
                implement_files_table,
                title="[bold blue]📄 Implementation Output Files[/bold blue]",
                border_style="blue",
            )
        )

        # Show workflow summary
        # This displays a table showing the success/failure of both phases
        # at a glance, making it easy to see if the entire workflow succeeded
        console.print()
        console.print(Rule("[bold blue]Workflow Summary[/bold blue]"))
        console.print()

        summary_table = Table(show_header=True, box=None)
        summary_table.add_column("Phase", style="bold cyan")
        summary_table.add_column("Status", style="bold")
        summary_table.add_column("Output Directory", style="dim")

        # Planning phase row
        planning_status = "✅ Success" if chore_response.success else "❌ Failed"
        summary_table.add_row(
            "Planning (/feature)",
            planning_status,
            f"./agents/{adw_id}/{planner_name}/",
        )

        # Implementation phase row
        implement_status = "✅ Success" if implement_response.success else "❌ Failed"
        summary_table.add_row(
            "Implementation (/implement)",
            implement_status,
            f"./agents/{adw_id}/{builder_name}/",
        )

        console.print(summary_table)

        # Create overall workflow summary
        # This is the top-level summary file that ties both phases together
        # It's saved at agents/{adw_id}/workflow_summary.json (not in a subdirectory)
        # This makes it easy to find the overall results of any workflow run
        workflow_summary_path = f"./agents/{adw_id}/workflow_summary.json"
        os.makedirs(f"./agents/{adw_id}", exist_ok=True)

        with open(workflow_summary_path, "w") as f:
            json.dump(
                {
                    "workflow": "chore_implement",
                    "adw_id": adw_id,
                    "prompt": prompt,
                    "model": model,
                    "working_dir": working_dir,
                    "plan_path": plan_path,
                    "phases": {
                        "planning": {
                            "success": chore_response.success,
                            "session_id": chore_response.session_id,
                            "agent": planner_name,
                            "output_dir": f"./agents/{adw_id}/{planner_name}/",
                        },
                        "implementation": {
                            "success": implement_response.success,
                            "session_id": implement_response.session_id,
                            "agent": builder_name,
                            "output_dir": f"./agents/{adw_id}/{builder_name}/",
                        },
                    },
                    # Overall success means BOTH phases succeeded
                    "overall_success": chore_response.success
                    and implement_response.success,
                },
                f,
                indent=2,
            )

        console.print(
            f"\n[bold cyan]Workflow summary:[/bold cyan] {workflow_summary_path}"
        )
        console.print()

        # ====================================================================
        # EXIT WITH APPROPRIATE STATUS CODE
        # ====================================================================
        # The exit code tells calling scripts whether the workflow succeeded:
        # 0 = Success (both phases completed successfully)
        # 1 = Failure (one or both phases failed, but workflow completed)
        # These exit codes are used if you want to chain this script with others
        if chore_response.success and implement_response.success:
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
        # Catch any unexpected errors that weren't handled above
        # This includes things like:
        # - File system errors
        # - Network errors
        # - Bugs in the script itself
        # Exit code 2 indicates an unexpected error (different from planned failure = 1)
        console.print(
            Panel(
                f"[bold red]{str(e)}[/bold red]",
                title="[bold red]❌ Unexpected Error[/bold red]",
                border_style="red",
            )
        )
        sys.exit(2)


if __name__ == "__main__":
    # Standard Python idiom: only run main() if this file is executed directly
    # (not if it's imported as a module)
    main()
