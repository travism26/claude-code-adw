#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic"]
# ///

"""Tests for pipelines/pipe_feature.py + pipelines/pipe_bug.py (docs/m3-tasks.md T1).

Usage:
    uv run pytest adws/adw_tests/test_pipe_feature_bug.py -q

Credential-free (no Claude calls): gates are real shell commands (`true`)
run against a tmp_path working dir; the planner/build/fixer/reviewer
"agent" is a single fake runner routed by `request.agent_name`, monkeypatched
onto BOTH `pipelines.core.execute_template` (the seam build_loop's build+fix
calls resolve at call time) and `pipelines.pipe_feature.execute_template`
(the seam run_pipeline()'s own plan/review calls resolve at call time) —
two separate module-level bindings of the same imported name, both need
patching. pipe_bug.py imports run_pipeline() directly from pipe_feature, so
patching pipe_feature.execute_template covers pipe_bug runs too.

The fake planner WRITES a spec file into the tmp working dir (when
write_spec=True) and returns a configurable "output" string, so tests can
exercise the exact-path case, the missing-path case, and the
prose-wrapped-path regex-fallback case independently of what the (fake)
planner claims to have done.

main() is invoked in-process (not via subprocess) so the monkeypatched
runner is actually used; sys.argv is patched per test and the resulting
sys.exit(code) is caught with pytest.raises(SystemExit).

Covers the 7 scenarios from the T1 brief, plus 3 review-round additions
tightening _extract_spec_path (candidate must be non-empty, end in .md, and
be an existing FILE — never a bare/whitespace/directory/wrong-extension
"pass"):
  (a) feature happy path: plan->implement->gates pass->review recorded,
      exit 0, state has plan_file + phase_results.review.
  (b) planner returns a path that doesn't exist -> pipeline fails with a
      clear error, no /implement (builder) call made.
  (b1) planner returns whitespace-only output -> same.
  (b2) planner returns "specs" (an existing directory, not a file) -> same.
  (b3) planner returns an existing non-.md file path -> same.
  (c) planner output has prose around the path -> regex fallback finds it.
  (d) advisory review: reviewer response success=False -> exit code still
      0, warning recorded.
  (e) bug: gates config with only a lint gate -> startup failure, no
      agents called.
  (f) bug: with a unit gate -> runs, plan_type "bug" sent to /bug (assert
      slash_command).
  (g) --plan-type chore accepted on pipe_feature.
"""

import json
import shutil
import sys
import uuid
from pathlib import Path
from typing import Optional

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

import pipelines.core as core  # noqa: E402
import pipelines.pipe_bug as pipe_bug  # noqa: E402
import pipelines.pipe_feature as pipe_feature  # noqa: E402
from adw_modules.agent import AgentPromptResponse  # noqa: E402
from pipelines.pipeline_state import PipelineState  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def adw_id():
    """A unique adw_id per test, with agents/<adw_id> cleaned up afterward
    (mirrors test_pipe_chore.py's fixture)."""
    generated = f"test-pipe-fb-{uuid.uuid4().hex[:8]}"
    yield generated
    state_dir = REPO_ROOT / "agents" / generated
    if state_dir.exists():
        shutil.rmtree(state_dir)


def _write_gates(path: Path, gates: list) -> None:
    path.write_text(json.dumps({"gates": gates}))


def _run_main(monkeypatch, module, argv):
    """Run `module`.main() with the given argv (excluding argv[0]); returns
    the captured SystemExit code."""
    monkeypatch.setattr(sys, "argv", [f"{module.__name__}.py"] + argv)
    with pytest.raises(SystemExit) as exc_info:
        module.main()
    return exc_info.value.code


def _make_runner(
    working_dir: str,
    calls: list,
    *,
    spec_rel: str,
    plan_output: Optional[str] = None,
    plan_success: bool = True,
    write_spec: bool = True,
    build_success: bool = True,
    review_success: bool = True,
):
    """A single fake agent runner, routed by agent_name, that also records
    every AgentTemplateRequest it was called with (into `calls`) so tests
    can assert which agents ran and with what args."""

    def runner(request):
        calls.append(request)
        if request.agent_name == "planner":
            if write_spec:
                path = Path(working_dir) / spec_rel
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("# spec\n")
            return AgentPromptResponse(
                output=spec_rel if plan_output is None else plan_output,
                success=plan_success,
            )
        if request.agent_name == "builder":
            return AgentPromptResponse(output="implemented", success=build_success)
        if request.agent_name == "reviewer":
            return AgentPromptResponse(output="reviewed", success=review_success)
        return AgentPromptResponse(output="fixed", success=True)  # fixer-N

    return runner


def _patch_runner(monkeypatch, runner) -> None:
    """Both call sites that resolve `execute_template` at call time: the one
    build_loop uses (core.py's own binding) and the one run_pipeline() uses
    (pipe_feature.py's own binding) — see module docstring."""
    monkeypatch.setattr(core, "execute_template", runner)
    monkeypatch.setattr(pipe_feature, "execute_template", runner)


# ---------------------------------------------------------------------------
# (a) feature happy path
# ---------------------------------------------------------------------------


def test_feature_happy_path(tmp_path, adw_id, monkeypatch, capsys):
    _write_gates(tmp_path / "adw_gates.json", [{"name": "unit", "command": "true"}])
    spec_rel = f"specs/feature-{adw_id}-add-thing.md"
    calls: list = []
    _patch_runner(monkeypatch, _make_runner(str(tmp_path), calls, spec_rel=spec_rel))

    code = _run_main(
        monkeypatch,
        pipe_feature,
        ["add a thing", "--working-dir", str(tmp_path), "--adw-id", adw_id],
    )

    assert code == 0
    assert "PASS" in capsys.readouterr().out

    state = PipelineState.load(adw_id)
    assert state.plan_file == spec_rel
    assert state.overall_success is True
    assert state.phase_results["review"]["success"] is True
    assert [c.agent_name for c in calls] == ["planner", "builder", "reviewer"]


# ---------------------------------------------------------------------------
# (b) planner returns a nonexistent path -> fail, no /implement call
# ---------------------------------------------------------------------------


def test_feature_planner_missing_spec_no_implement_call(tmp_path, adw_id, monkeypatch, capsys):
    _write_gates(tmp_path / "adw_gates.json", [{"name": "unit", "command": "true"}])
    calls: list = []
    runner = _make_runner(
        str(tmp_path), calls, spec_rel="specs/does-not-exist.md", write_spec=False
    )
    _patch_runner(monkeypatch, runner)

    code = _run_main(
        monkeypatch,
        pipe_feature,
        ["add a thing", "--working-dir", str(tmp_path), "--adw-id", adw_id],
    )

    assert code == 1
    err = capsys.readouterr().err
    assert "did not return an existing spec path" in err

    assert [c.agent_name for c in calls] == ["planner"], "no builder call must be made"
    state = PipelineState.load(adw_id)
    assert state.overall_success is False


# ---------------------------------------------------------------------------
# (b1) planner returns whitespace-only output -> fail, no /implement call
# ---------------------------------------------------------------------------


def test_feature_planner_whitespace_only_output_no_implement_call(tmp_path, adw_id, monkeypatch, capsys):
    _write_gates(tmp_path / "adw_gates.json", [{"name": "unit", "command": "true"}])
    calls: list = []
    runner = _make_runner(
        str(tmp_path), calls, spec_rel="specs/unused.md", plan_output="   \n\t  ", write_spec=False
    )
    _patch_runner(monkeypatch, runner)

    code = _run_main(
        monkeypatch,
        pipe_feature,
        ["add a thing", "--working-dir", str(tmp_path), "--adw-id", adw_id],
    )

    assert code == 1
    err = capsys.readouterr().err
    assert "did not return an existing spec path" in err

    assert [c.agent_name for c in calls] == ["planner"], "no builder call must be made"
    state = PipelineState.load(adw_id)
    assert state.overall_success is False


# ---------------------------------------------------------------------------
# (b2) planner returns an existing directory (not a file) -> fail, no /implement call
# ---------------------------------------------------------------------------


def test_feature_planner_returns_existing_directory_no_implement_call(tmp_path, adw_id, monkeypatch, capsys):
    _write_gates(tmp_path / "adw_gates.json", [{"name": "unit", "command": "true"}])
    (tmp_path / "specs").mkdir()
    calls: list = []
    runner = _make_runner(
        str(tmp_path), calls, spec_rel="specs/unused.md", plan_output="specs", write_spec=False
    )
    _patch_runner(monkeypatch, runner)

    code = _run_main(
        monkeypatch,
        pipe_feature,
        ["add a thing", "--working-dir", str(tmp_path), "--adw-id", adw_id],
    )

    assert code == 1
    err = capsys.readouterr().err
    assert "did not return an existing spec path" in err

    assert [c.agent_name for c in calls] == ["planner"], "no builder call must be made"
    state = PipelineState.load(adw_id)
    assert state.overall_success is False


# ---------------------------------------------------------------------------
# (b3) planner returns an existing non-.md file -> fail, no /implement call
# ---------------------------------------------------------------------------


def test_feature_planner_returns_existing_non_md_file_no_implement_call(tmp_path, adw_id, monkeypatch, capsys):
    _write_gates(tmp_path / "adw_gates.json", [{"name": "unit", "command": "true"}])
    (tmp_path / "specs").mkdir()
    (tmp_path / "specs" / "notes.txt").write_text("not a spec\n")
    calls: list = []
    runner = _make_runner(
        str(tmp_path), calls, spec_rel="specs/unused.md", plan_output="specs/notes.txt", write_spec=False
    )
    _patch_runner(monkeypatch, runner)

    code = _run_main(
        monkeypatch,
        pipe_feature,
        ["add a thing", "--working-dir", str(tmp_path), "--adw-id", adw_id],
    )

    assert code == 1
    err = capsys.readouterr().err
    assert "did not return an existing spec path" in err

    assert [c.agent_name for c in calls] == ["planner"], "no builder call must be made"
    state = PipelineState.load(adw_id)
    assert state.overall_success is False


# ---------------------------------------------------------------------------
# (c) prose-wrapped path -> regex fallback finds it
# ---------------------------------------------------------------------------


def test_feature_prose_wrapped_path_regex_fallback(tmp_path, adw_id, monkeypatch):
    _write_gates(tmp_path / "adw_gates.json", [{"name": "unit", "command": "true"}])
    spec_rel = f"specs/feature-{adw_id}-desc.md"
    calls: list = []
    prose_output = f"Sure! Here is the plan:\n{spec_rel}\nLet me know if you need anything else."
    runner = _make_runner(str(tmp_path), calls, spec_rel=spec_rel, plan_output=prose_output)
    _patch_runner(monkeypatch, runner)

    code = _run_main(
        monkeypatch,
        pipe_feature,
        ["add a thing", "--working-dir", str(tmp_path), "--adw-id", adw_id],
    )

    assert code == 0
    state = PipelineState.load(adw_id)
    assert state.plan_file == spec_rel


# ---------------------------------------------------------------------------
# (d) advisory review failure never fails the pipeline
# ---------------------------------------------------------------------------


def test_feature_advisory_review_failure_does_not_fail_pipeline(tmp_path, adw_id, monkeypatch, capsys):
    _write_gates(tmp_path / "adw_gates.json", [{"name": "unit", "command": "true"}])
    spec_rel = f"specs/feature-{adw_id}-desc.md"
    calls: list = []
    runner = _make_runner(str(tmp_path), calls, spec_rel=spec_rel, review_success=False)
    _patch_runner(monkeypatch, runner)

    code = _run_main(
        monkeypatch,
        pipe_feature,
        ["add a thing", "--working-dir", str(tmp_path), "--adw-id", adw_id],
    )

    assert code == 0, "review is advisory — it must never flip the exit code"
    err = capsys.readouterr().err
    assert "WARNING" in err

    state = PipelineState.load(adw_id)
    assert state.phase_results["review"]["success"] is False
    assert state.overall_success is True


# ---------------------------------------------------------------------------
# (e) bug: no fast test/unit gate -> startup failure, no agents called
# ---------------------------------------------------------------------------


def test_bug_startup_guard_requires_fast_test_gate(tmp_path, adw_id, monkeypatch, capsys):
    _write_gates(tmp_path / "adw_gates.json", [{"name": "lint", "command": "true"}])
    calls: list = []
    runner = _make_runner(str(tmp_path), calls, spec_rel=f"specs/bug-{adw_id}-desc.md")
    _patch_runner(monkeypatch, runner)

    code = _run_main(
        monkeypatch,
        pipe_bug,
        ["kv list is reversed", "--working-dir", str(tmp_path), "--adw-id", adw_id],
    )

    assert code == 1
    err = capsys.readouterr().err
    assert "bug pipeline requires a fast test gate" in err
    assert calls == [], "no agent should ever run when the startup guard fails"


# ---------------------------------------------------------------------------
# (f) bug: with a unit gate -> runs, plan_type "bug" sent to /bug
# ---------------------------------------------------------------------------


def test_bug_runs_with_unit_gate_and_forces_bug_plan_type(tmp_path, adw_id, monkeypatch):
    _write_gates(tmp_path / "adw_gates.json", [{"name": "unit", "command": "true"}])
    spec_rel = f"specs/bug-{adw_id}-desc.md"
    calls: list = []
    runner = _make_runner(str(tmp_path), calls, spec_rel=spec_rel)
    _patch_runner(monkeypatch, runner)

    code = _run_main(
        monkeypatch,
        pipe_bug,
        ["kv list is reversed", "--working-dir", str(tmp_path), "--adw-id", adw_id],
    )

    assert code == 0
    planner_calls = [c for c in calls if c.agent_name == "planner"]
    assert len(planner_calls) == 1
    assert planner_calls[0].slash_command == "/bug"
    assert planner_calls[0].args[0] == adw_id

    state = PipelineState.load(adw_id)
    assert state.pipeline == "bug"


# ---------------------------------------------------------------------------
# (g) --plan-type chore accepted on pipe_feature
# ---------------------------------------------------------------------------


def test_feature_plan_type_chore_accepted(tmp_path, adw_id, monkeypatch):
    _write_gates(tmp_path / "adw_gates.json", [{"name": "unit", "command": "true"}])
    spec_rel = f"specs/chore-{adw_id}-desc.md"
    calls: list = []
    runner = _make_runner(str(tmp_path), calls, spec_rel=spec_rel)
    _patch_runner(monkeypatch, runner)

    code = _run_main(
        monkeypatch,
        pipe_feature,
        [
            "clean up the thing",
            "--working-dir",
            str(tmp_path),
            "--adw-id",
            adw_id,
            "--plan-type",
            "chore",
        ],
    )

    assert code == 0
    planner_calls = [c for c in calls if c.agent_name == "planner"]
    assert planner_calls[0].slash_command == "/chore"

    state = PipelineState.load(adw_id)
    assert state.pipeline == "chore"
