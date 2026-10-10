#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""Slim-pipeline state management.

Mirrors adws/travis/travis_state.py's directory + load/save conventions
(state lives under agents/{adw_id}/), but with the slimmer schema from
docs/slim-pipelines-plan.md §6.4 and — deliberately — a DIFFERENT filename:

    agents/{adw_id}/pipeline_state.json

Kept as a separate file (not travis_state.json) so nothing that reads travis
state (resume logic, child_run.py) can ever be confused by a pipeline run
(plan §6.4).
"""

import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class PipelineState:
    """State for a single slim-pipeline run. Schema per plan §6.4:

    {
      "adw_id": "…", "pipeline": "chore", "prompt": "…", "working_dir": "…",
      "plan_file": null,
      "iterations": [{"iter": 1, "gate": "lint", "passed": false, "fixer": "fixer-1"}],
      "phase_results": {"build": {"success": true}, "gates": {"success": true, "iters": 2}},
      "overall_success": true
    }
    """

    adw_id: str
    pipeline: str
    prompt: str
    working_dir: str
    plan_file: Optional[str] = None
    iterations: List[Dict[str, Any]] = field(default_factory=list)
    phase_results: Dict[str, Any] = field(default_factory=dict)
    overall_success: bool = False

    @staticmethod
    def _state_file_path(adw_id: str) -> str:
        """agents/{adw_id}/pipeline_state.json — same dir convention as
        travis_state.py (project root is 3 levels up from this file)."""
        project_root = Path(__file__).parent.parent.parent
        state_dir = project_root / "agents" / adw_id
        state_dir.mkdir(parents=True, exist_ok=True)
        return str(state_dir / "pipeline_state.json")

    @classmethod
    def load(
        cls,
        adw_id: str,
        pipeline: str = "",
        prompt: str = "",
        working_dir: str = "",
    ) -> "PipelineState":
        """Load state from file, or start a fresh one with the given
        defaults if no file exists yet (mirrors TravisState.load)."""
        path = cls._state_file_path(adw_id)

        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    data = json.load(f)
                return cls(
                    adw_id=data.get("adw_id", adw_id),
                    pipeline=data.get("pipeline", pipeline),
                    prompt=data.get("prompt", prompt),
                    working_dir=data.get("working_dir", working_dir),
                    plan_file=data.get("plan_file"),
                    iterations=data.get("iterations", []),
                    phase_results=data.get("phase_results", {}),
                    overall_success=data.get("overall_success", False),
                )
            except (json.JSONDecodeError, IOError) as e:
                print(
                    f"Warning: Could not load pipeline state file: {e}",
                    file=sys.stderr,
                )
                # Fall through to a fresh state below.

        return cls(
            adw_id=adw_id, pipeline=pipeline, prompt=prompt, working_dir=working_dir
        )

    def save(self) -> None:
        """Save state to file."""
        path = self._state_file_path(self.adw_id)
        try:
            with open(path, "w") as f:
                json.dump(self.to_dict(), f, indent=2)
        except IOError as e:
            print(f"Error: Could not save pipeline state file: {e}", file=sys.stderr)
            sys.exit(1)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "adw_id": self.adw_id,
            "pipeline": self.pipeline,
            "prompt": self.prompt,
            "working_dir": self.working_dir,
            "plan_file": self.plan_file,
            "iterations": self.iterations,
            "phase_results": self.phase_results,
            "overall_success": self.overall_success,
        }

    def add_iteration(self, entry: Dict[str, Any]) -> None:
        """Append one iteration record (e.g. a gate check or a fix attempt).
        Consumed by core.py's run_gates()/build_loop() via duck typing —
        this is the only contract those functions rely on, so any object
        implementing add_iteration()/set_phase_result() can stand in."""
        self.iterations.append(entry)

    def set_phase_result(self, phase: str, result: Dict[str, Any]) -> None:
        """Record/overwrite the result for a named phase (e.g. "build",
        "gates", "fix-1", "fix-slow")."""
        self.phase_results[phase] = result
