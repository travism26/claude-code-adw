"""Planner registry for the Travis SDLC orchestrator.

A "planner" produces the spec consumed by the build phase. Each planner is
one or more standalone phase scripts in this directory that satisfy the
contract documented in PLANNER_CONTRACT.md (argv shape, stdout spec path,
TravisState writes).

Deliberately minimal: one frozen dataclass, one dict. To add a planner
(Spec Kit, BMAD, ...), drop a script satisfying the contract into
adws/travis/ and add one PLANNERS entry — no other code changes.
No plugin discovery, no config files.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class PlannerScript:
    """One phase script invocation within a planner."""

    script: str           # script filename in adws/travis/
    phase_label: str      # display name for the phase header
    required: bool        # failure stops the workflow
    takes_plan_type: bool  # whether the script accepts --plan-type
    is_research: bool = False  # script is the (optional) research phase


@dataclass(frozen=True)
class PlannerSpec:
    """A named planner: ordered phase scripts plus dispatch semantics."""

    name: str
    description: str
    scripts: tuple  # tuple[PlannerScript, ...]
    collapses_research: bool   # marks phase_results["research"] complete itself
    honors_skip_research: bool  # --skip-research omits the research script


PLANNERS: dict[str, PlannerSpec] = {
    "travis": PlannerSpec(
        name="travis",
        description="Built-in research + plan scripts (default).",
        scripts=(
            PlannerScript(
                script="travis_research.py",
                phase_label="Phase 0: Research",
                required=False,  # non-blocking — workflow continues if research fails
                takes_plan_type=False,
                is_research=True,
            ),
            PlannerScript(
                script="travis_plan.py",
                phase_label="Phase 1: Planning",
                required=True,
                takes_plan_type=True,
            ),
        ),
        collapses_research=False,
        honors_skip_research=True,
    ),
    "openspec": PlannerSpec(
        name="openspec",
        description=(
            "EXPERIMENTAL — collapses research + plan into a single /opsx:propose "
            "call. Requires OpenSpec initialized in the target repo "
            "(npm install -g @fission-ai/openspec && openspec init && openspec update)."
        ),
        scripts=(
            PlannerScript(
                script="travis_openspec.py",
                phase_label="Phases 0-1: OpenSpec Propose (EXPERIMENTAL)",
                required=True,
                takes_plan_type=True,
            ),
        ),
        collapses_research=True,
        honors_skip_research=False,  # /opsx:propose subsumes research; flag is ignored
    ),
}


def planner_choices() -> list[str]:
    """Valid values for --planner."""
    return list(PLANNERS.keys())


def planner_help() -> str:
    """One line per planner for usage/help text."""
    return "\n".join(f"  {name}: {spec.description}" for name, spec in PLANNERS.items())


def get_planner(name: str) -> PlannerSpec:
    """Look up a planner by name. Raises KeyError for unknown names."""
    return PLANNERS[name]
