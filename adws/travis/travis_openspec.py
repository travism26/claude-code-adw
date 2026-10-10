#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""Travis experimental OpenSpec planner.

Usage:
  uv run travis_openspec.py <prompt> [adw-id] [--model MODEL] [--plan-type TYPE] [--working-dir DIR]

Replaces the research + plan phases with a single call to OpenSpec's
/opsx:propose slash command, then flattens the resulting
openspec/changes/<name>/ directory into a single
specs/openspec-<adw-id>-<change-name>.md file that the existing downstream
phases (build, validate, test, review, document) consume without modification.

Requires OpenSpec initialized in the repo first:
    npm install -g @fission-ai/openspec
    openspec init
    openspec update

Options:
  --model MODEL: Model to use (sonnet|opus|haiku, default: opus)
  --plan-type TYPE: Hint passed to /opsx:propose (feature|chore|bug, default: feature)
  --working-dir DIR: Project directory to plan against (default: current directory)

Outputs:
  - Flattened spec file path (printed to stdout)
  - State saved to agents/{adw_id}/travis_state.json (marks both research + plan complete)
  - Logs written to agents/{adw_id}/travis_openspec.log
"""

import sys
import os
import re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from adw_modules.agent import execute_template, AgentTemplateRequest
from adw_modules.utils import setup_logger, check_env_vars, make_adw_id, resolve_working_dir
from travis.travis_state import TravisState


CHANGE_FOLDER_RE = re.compile(r"openspec/changes/([a-zA-Z0-9][a-zA-Z0-9_\-]*)/?")


def preflight_openspec(project_root: Path) -> None:
    """Verify OpenSpec has been initialized in this repo."""
    if not (project_root / "openspec").is_dir():
        print(
            "Error: openspec/ not found in project root.\n"
            "Install with:\n"
            "  npm install -g @fission-ai/openspec\n"
            "  openspec init\n"
            "  openspec update",
            file=sys.stderr,
        )
        sys.exit(1)


def extract_change_name(output: str) -> str:
    """Extract the OpenSpec change folder name from the agent response.

    Args:
        output: Agent response text

    Returns:
        Change folder name (e.g., "add-user-auth")

    Raises:
        ValueError: if no change folder reference is found
    """
    matches = CHANGE_FOLDER_RE.findall(output)
    if not matches:
        raise ValueError("No openspec/changes/<name>/ reference found in agent output")
    # Last mention wins — usually the final "created at ..." confirmation line.
    return matches[-1]


def flatten_change_dir(project_root: Path, change_name: str, adw_id: str) -> Path:
    """Concatenate an OpenSpec change folder into a single spec file.

    Reads proposal.md, design.md, tasks.md, and any files under specs/ from
    openspec/changes/<change_name>/, then writes them as a single markdown
    file under specs/ so existing downstream phases work unchanged.

    Args:
        project_root: Repo root
        change_name: OpenSpec change folder name
        adw_id: ADW workflow ID (used in the output filename)

    Returns:
        Path to the flattened spec file

    Raises:
        FileNotFoundError: if the change folder or proposal.md is missing
    """
    change_dir = project_root / "openspec" / "changes" / change_name
    if not change_dir.is_dir():
        raise FileNotFoundError(f"Change folder not found: {change_dir}")

    proposal = change_dir / "proposal.md"
    if not proposal.is_file():
        raise FileNotFoundError(f"proposal.md missing in {change_dir}")

    sections: list[tuple[str, str]] = [("Proposal", proposal.read_text())]

    design = change_dir / "design.md"
    if design.is_file():
        sections.append(("Design", design.read_text()))

    specs_dir = change_dir / "specs"
    if specs_dir.is_dir():
        spec_bodies = []
        for spec_file in sorted(specs_dir.rglob("*.md")):
            rel = spec_file.relative_to(specs_dir)
            spec_bodies.append(f"### {rel}\n\n{spec_file.read_text()}")
        if spec_bodies:
            sections.append(("Specs", "\n\n".join(spec_bodies)))

    tasks = change_dir / "tasks.md"
    if tasks.is_file():
        sections.append(("Tasks", tasks.read_text()))

    # Downstream readers need to know this file is regenerated — the OpenSpec
    # change folder is the source of truth, not this flattened copy.
    header = (
        f"# OpenSpec Change: {change_name}\n\n"
        f"> Flattened from `openspec/changes/{change_name}/` for ADW `{adw_id}`.\n"
        f"> Source of truth lives in the change folder; this file is regenerated per run.\n\n"
    )
    body = "\n\n".join(f"## {title}\n\n{content.rstrip()}" for title, content in sections)

    out_dir = project_root / "specs"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"openspec-{adw_id}-{change_name}.md"
    out_path.write_text(header + body + "\n")
    return out_path


def main():
    """Main entry point."""
    load_dotenv()

    if len(sys.argv) < 2:
        print(
            "Usage: uv run travis_openspec.py <prompt> [adw-id] [--model MODEL] [--plan-type TYPE] [--working-dir DIR]",
            file=sys.stderr,
        )
        sys.exit(1)

    prompt = sys.argv[1]
    adw_id: str | None = None
    model = "opus"
    plan_type = "feature"
    working_dir_arg: str | None = None

    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "--model":
            if i + 1 >= len(sys.argv):
                print("Error: --model requires a value (sonnet|opus|haiku)", file=sys.stderr)
                sys.exit(1)
            model = sys.argv[i + 1]
            if model not in ("sonnet", "opus", "haiku"):
                print(f"Error: Invalid model value: {model}", file=sys.stderr)
                sys.exit(1)
            i += 2
        elif arg == "--plan-type":
            if i + 1 >= len(sys.argv):
                print("Error: --plan-type requires a value (feature|chore|bug)", file=sys.stderr)
                sys.exit(1)
            plan_type = sys.argv[i + 1]
            if plan_type not in ("feature", "chore", "bug"):
                print(f"Error: Invalid plan-type value: {plan_type}", file=sys.stderr)
                sys.exit(1)
            i += 2
        elif arg == "--working-dir":
            if i + 1 >= len(sys.argv):
                print("Error: --working-dir requires a value", file=sys.stderr)
                sys.exit(1)
            working_dir_arg = sys.argv[i + 1]
            i += 2
        elif not adw_id and not arg.startswith("--"):
            adw_id = arg
            i += 1
        else:
            print(f"Error: Unknown argument: {arg}", file=sys.stderr)
            sys.exit(1)

    if not adw_id:
        adw_id = make_adw_id()

    logger = setup_logger(adw_id, "travis_openspec")
    logger.info(f"Travis OpenSpec starting - ADW ID: {adw_id}")
    logger.info(f"Model: {model}, plan-type hint: {plan_type}")

    check_env_vars(logger)

    # The "project root" for OpenSpec preflight/flattening is the target
    # project, not the harness repo — resolve from --working-dir.
    working_dir = resolve_working_dir(working_dir_arg)
    project_root = Path(working_dir)
    preflight_openspec(project_root)

    state = TravisState.load(adw_id)

    # OpenSpec has no notion of feature/chore/bug — surface the intent in the
    # prompt itself so /opsx:propose can frame the proposal accordingly.
    framed_prompt = f"[intent={plan_type}] {prompt}"

    request = AgentTemplateRequest(
        agent_name="openspec_proposer",
        slash_command="/opsx:propose",
        args=[framed_prompt],
        adw_id=adw_id,
        model=model,
        working_dir=working_dir,
    )

    logger.info("Executing OpenSpec propose agent...")
    response = execute_template(request)

    if not response.success:
        logger.error(f"OpenSpec propose failed: {response.output}")
        state.set_phase_result("plan", {"success": False, "error": response.output})
        state.save()
        sys.exit(1)

    try:
        change_name = extract_change_name(response.output)
        logger.info(f"OpenSpec change created: openspec/changes/{change_name}/")
    except ValueError as e:
        logger.error(f"Could not extract change folder from agent output: {e}")
        logger.debug(f"Agent output was: {response.output}")
        state.set_phase_result("plan", {"success": False, "error": str(e)})
        state.save()
        sys.exit(1)

    try:
        flat_spec = flatten_change_dir(project_root, change_name, adw_id)
        logger.info(f"Flattened spec written to: {flat_spec}")
    except FileNotFoundError as e:
        logger.error(f"Flattening failed: {e}")
        state.set_phase_result("plan", {"success": False, "error": str(e)})
        state.save()
        sys.exit(1)

    rel_spec = str(flat_spec.relative_to(project_root))
    state.update(plan_file=rel_spec)

    # Mark research complete so the orchestrator's resume logic skips it —
    # /opsx:propose subsumes research in the OpenSpec path.
    state.set_phase_result("research", {
        "success": True,
        "skipped_by": "openspec",
        "message": "Subsumed by /opsx:propose",
    })
    state.set_phase_result("plan", {
        "success": True,
        "file": rel_spec,
        "planner": "openspec",
        "change_name": change_name,
        "change_dir": f"openspec/changes/{change_name}/",
    })
    state.save()

    logger.info("OpenSpec plan phase completed successfully")
    print(rel_spec)


if __name__ == "__main__":
    main()
