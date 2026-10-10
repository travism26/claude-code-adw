#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv", "pyyaml", "rich"]
# ///
"""Tests for evals/run_eval.py's --engine travis|slim support (M4,
docs/slim-pipelines-plan.md §8).

Pure python — no LLM calls, no subprocess of the real pipelines
(travis_sdlc.py / pipe_feature.py are never invoked here, only the pure
command-construction/parsing/classification functions that sit around them).

Covers:
  - build_travis_cmd(): the travis_sdlc.py invocation is byte-identical to
    the inline command run_sdlc() built before --engine existed.
  - build_slim_cmd(): the pipe_feature.py invocation — no --adw-id (the
    runner discovers it after the fact, see parse_state_path below);
    --plan-type forwarded verbatim for feature/chore/bug, never pipe_bug.py.
  - validate_engine_flags(): --engine slim fails closed (raises, doesn't
    silently ignore) when combined with any travis-only flag; --engine
    travis is never restricted.
  - parse_state_path(): the `state: <path>` stdout-line contract
    pipe_feature.py prints, including the "line absent" case.
  - classify_status_slim(): ok/task_fail/infra_error bucketing from a fake
    run_meta, exercising the "exit code AND pipeline_state.json
    overall_success" rule plus the infra-error carve-outs.
"""

import argparse
import shutil
import sys
from pathlib import Path

import pytest

EVALS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(EVALS_DIR))

import run_eval  # noqa: E402

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_cfg(**overrides) -> argparse.Namespace:
    """A cfg Namespace mirroring argparse's `run` defaults right after
    parsing — i.e. planner=None, exactly as it is when validate_engine_flags
    runs in main() (BEFORE the travis-only default-fill). Tests that need
    the filled-in travis default pass planner="travis" explicitly, the same
    way main() does post-validation.
    """
    defaults = dict(
        variant="test", engine="travis", planner=None, model="opus",
        effort=None, tasks=None, all=True, trials=1, memory=False,
        skip_review=False, skip_validate=False, review_spec=False, keep_tmp=False,
    )
    defaults.update(overrides)
    return argparse.Namespace(**defaults)


TASK_FEATURE = {"id": "01-feature-tags", "prompt": " add tags \n", "plan_type": "feature", "target": "app"}
TASK_BUG = {"id": "03-bug-duplicate-id", "prompt": "fix duplicate ids", "plan_type": "bug", "target": "app"}
TASK_CHORE = {"id": "04-chore-rename-field", "prompt": "rename field", "plan_type": "chore", "target": "app"}


# ---------------------------------------------------------------------------
# build_travis_cmd — the travis engine's invocation must stay byte-identical
# ---------------------------------------------------------------------------


def test_build_travis_cmd_default_matches_pre_flag_shape():
    cfg = make_cfg(planner="travis")
    cmd = run_eval.build_travis_cmd(TASK_FEATURE, "abc12345", Path("/tmp/target"), cfg)
    assert cmd == [
        "uv", "run", str(run_eval.SDLC_SCRIPT),
        "add tags",
        "abc12345",
        "--plan-type", "feature",
        "--planner", "travis",
        "--model", "opus",
        "--working-dir", "/tmp/target",
        "--diff-base", "HEAD",
        "--skip-document",
        "--no-memory",
    ]


def test_build_travis_cmd_includes_optional_flags_when_set():
    cfg = make_cfg(planner="travis", effort="high", memory=True,
                    skip_review=True, skip_validate=True, review_spec=True)
    cmd = run_eval.build_travis_cmd(TASK_BUG, "id2", Path("/tmp/t2"), cfg)
    assert cmd[cmd.index("--effort") + 1] == "high"
    assert "--no-memory" not in cmd, "memory=True must suppress --no-memory"
    assert "--skip-review" in cmd
    assert "--skip-validate" in cmd
    assert "--review-spec=auto" in cmd
    assert cmd[cmd.index("--plan-type") + 1] == "bug"


def test_build_travis_cmd_never_touches_pipe_feature_script():
    cfg = make_cfg(planner="travis")
    cmd = run_eval.build_travis_cmd(TASK_BUG, "id3", Path("/tmp/t3"), cfg)
    assert str(run_eval.PIPE_FEATURE_SCRIPT) not in cmd
    assert str(run_eval.SDLC_SCRIPT) in cmd


# ---------------------------------------------------------------------------
# build_slim_cmd — the new pipe_feature.py invocation
# ---------------------------------------------------------------------------


def test_build_slim_cmd_shape_and_no_adw_id():
    cfg = make_cfg(engine="slim")
    cmd = run_eval.build_slim_cmd(TASK_FEATURE, Path("/tmp/target"), cfg)
    assert cmd == [
        "uv", "run", str(run_eval.PIPE_FEATURE_SCRIPT),
        "add tags",
        "--working-dir", "/tmp/target",
        "--model", "opus",
        "--plan-type", "feature",
    ]
    assert "--adw-id" not in cmd


@pytest.mark.parametrize("task,expected_plan_type", [
    (TASK_FEATURE, "feature"),
    (TASK_BUG, "bug"),
    (TASK_CHORE, "chore"),
])
def test_build_slim_cmd_plan_type_passthrough_never_pipe_bug(task, expected_plan_type):
    """feature|chore|bug all route through pipe_feature.py's own
    --plan-type — pipe_bug.py must never be invoked by the eval harness
    (task brief: "do NOT use pipe_bug here")."""
    cfg = make_cfg(engine="slim", model="sonnet")
    cmd = run_eval.build_slim_cmd(task, Path("/tmp/t"), cfg)
    assert cmd[2] == str(run_eval.PIPE_FEATURE_SCRIPT)
    assert "pipe_bug" not in " ".join(cmd)
    assert cmd[cmd.index("--plan-type") + 1] == expected_plan_type


def test_build_slim_cmd_decision_gate_task_03():
    """The exact command a slim trial executes for task 03 (bug) — the
    decision-gate example from the task report, using the task's real (post
    -strip) prompt text."""
    cfg = make_cfg(engine="slim", model="opus")
    target = Path("/tmp/adw_eval_03-bug-duplicate-id_XXXX/target_app")
    real_prompt = (
        "Fix a bug in the notes app: after deleting a note, newly added notes can "
        "receive an id that already belongs to another note. Reproduce: add two "
        "notes, delete note 1, add a third note — the third note gets id 2, which "
        "collides with the existing note. Ids must be unique for the lifetime of "
        "the store (use max existing id + 1 or equivalent). Add a regression test "
        "covering the delete-then-add sequence."
    )
    task = {**TASK_BUG, "prompt": real_prompt}
    cmd = run_eval.build_slim_cmd(task, target, cfg)
    assert cmd == [
        "uv", "run", str(run_eval.PIPE_FEATURE_SCRIPT),
        real_prompt,
        "--working-dir", str(target),
        "--model", "opus",
        "--plan-type", "bug",
    ]


# ---------------------------------------------------------------------------
# validate_engine_flags — fail closed, never silently ignore
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("overrides", [
    dict(planner="openspec"),
    dict(planner="travis"),   # explicit restatement of the default still errors
    dict(effort="high"),
    dict(memory=True),
    dict(skip_review=True),
    dict(skip_validate=True),
    dict(review_spec=True),
])
def test_validate_engine_flags_rejects_incompatible_combo(overrides):
    cfg = make_cfg(engine="slim", **overrides)
    with pytest.raises(ValueError):
        run_eval.validate_engine_flags(cfg)


def test_validate_engine_flags_slim_clean_cfg_passes():
    cfg = make_cfg(engine="slim")
    run_eval.validate_engine_flags(cfg)  # must not raise


@pytest.mark.parametrize("overrides", [
    dict(planner="openspec"),
    dict(effort="high"),
    dict(memory=True),
    dict(skip_review=True),
    dict(skip_validate=True),
    dict(review_spec=True),
])
def test_validate_engine_flags_travis_engine_never_restricted(overrides):
    cfg = make_cfg(engine="travis", **overrides)
    run_eval.validate_engine_flags(cfg)  # must not raise — travis is untouched


def test_validate_engine_flags_error_message_names_every_bad_flag():
    cfg = make_cfg(engine="slim", planner="x", effort="high", memory=True,
                    skip_review=True, skip_validate=True, review_spec=True)
    with pytest.raises(ValueError) as exc:
        run_eval.validate_engine_flags(cfg)
    msg = str(exc.value)
    for flag in ("--planner", "--effort", "--memory", "--skip-review",
                 "--skip-validate", "--review-spec"):
        assert flag in msg


def test_main_engine_slim_incompatible_flag_exits_nonzero(monkeypatch, capsys):
    """End-to-end through main()'s real argparse wiring: the failure must
    happen before cmd_run() (and therefore before any subprocess) runs."""
    monkeypatch.setattr(sys, "argv", [
        "run_eval.py", "run", "--variant", "x", "--engine", "slim",
        "--planner", "openspec", "--tasks", "01",
    ])
    code = run_eval.main()
    assert code == 1
    out = capsys.readouterr().out
    assert "--planner" in out


def test_main_engine_slim_clean_flags_pass_validation(monkeypatch):
    """A slim run with no incompatible flags gets past validation and into
    cmd_run() — which then fails fast on "no tasks matched" rather than
    aborting on the flag check, proving validation didn't false-positive."""
    monkeypatch.setattr(sys, "argv", [
        "run_eval.py", "run", "--variant", "x", "--engine", "slim",
        "--tasks", "no-such-task-id",
    ])
    code = run_eval.main()
    assert code == 1  # "No tasks matched", not the flag-validation error


# ---------------------------------------------------------------------------
# parse_state_path — the `state: <path>` stdout contract
# ---------------------------------------------------------------------------


def test_parse_state_path_finds_the_line():
    stdout = (
        " 1 file changed, 3 insertions(+)\n"
        "state: /repo/agents/deadbeef/pipeline_state.json\n"
        "PASS\n"
    )
    assert run_eval.parse_state_path(stdout) == "/repo/agents/deadbeef/pipeline_state.json"


def test_parse_state_path_absent_returns_none():
    stdout = "Error: --model must be one of ('sonnet', 'opus', 'haiku'), got 'bogus'\n"
    assert run_eval.parse_state_path(stdout) is None


def test_parse_state_path_empty_stdout_returns_none():
    assert run_eval.parse_state_path("") is None


def test_parse_state_path_ignores_lines_only_containing_state_as_substring():
    stdout = "current state: something else\nstate: /x/agents/aaa/pipeline_state.json\n"
    assert run_eval.parse_state_path(stdout) == "/x/agents/aaa/pipeline_state.json"


# ---------------------------------------------------------------------------
# classify_status_slim — ok / task_fail / infra_error
# ---------------------------------------------------------------------------


def _run_meta(**overrides) -> dict:
    base = dict(
        returncode=0, wall_ms=1000.0, timed_out=False, tail="",
        state_path="/x/agents/abc/pipeline_state.json",
        state={"overall_success": True}, adw_id="abc",
    )
    base.update(overrides)
    return base


def test_classify_status_slim_ok():
    assert run_eval.classify_status_slim(_run_meta()) == "ok"


def test_classify_status_slim_timeout_is_infra():
    assert run_eval.classify_status_slim(_run_meta(timed_out=True)) == "infra_error"


def test_classify_status_slim_infra_marker_in_tail_is_infra():
    meta = _run_meta(tail="anthropic.APIError: rate limit exceeded, retry later",
                      state={"overall_success": False})
    assert run_eval.classify_status_slim(meta) == "infra_error"


def test_classify_status_slim_missing_state_file_is_infra():
    """pipe_feature.py died before ever printing `state:` (e.g. a bad
    --model value) — no state file exists at all."""
    meta = _run_meta(state_path=None, state={})
    assert run_eval.classify_status_slim(meta) == "infra_error"


def test_classify_status_slim_unparseable_state_is_infra():
    """A state: line was printed but the file was empty/unreadable when we
    tried to load it (run_slim() already reduced this to state={})."""
    meta = _run_meta(state={})
    assert run_eval.classify_status_slim(meta) == "infra_error"


def test_classify_status_slim_overall_false_is_task_fail():
    meta = _run_meta(returncode=1, state={"overall_success": False})
    assert run_eval.classify_status_slim(meta) == "task_fail"


def test_classify_status_slim_success_flag_but_nonzero_exit_is_task_fail():
    """Defensive AND (task brief: "exit code AND ... overall_success"):
    overall_success True but a non-zero exit code must not read as ok."""
    meta = _run_meta(returncode=1, state={"overall_success": True})
    assert run_eval.classify_status_slim(meta) == "task_fail"


# ---------------------------------------------------------------------------
# classify_status_slim — state-only infra markers (F2): a marker can be
# recorded solely in pipeline_state.json's phase_results, never surfacing in
# the CLI's own stdout/stderr tail. Real specimen:
# evals/results/m4-slim/01-feature-tags/3/result.json — slim_state.
# phase_results.review.output_tail contains "You've hit your session limit"
# yet the tail-only scan (pre-fix) left status "ok".
# ---------------------------------------------------------------------------


def test_classify_status_slim_state_only_marker_in_build_phase_is_infra_error():
    """A marker recorded only in a non-review phase (build/plan/gates/
    fix-N) — never in run_meta['tail'] — must still classify as
    infra_error, per adws/pipelines/core.py's build_loop now recording
    {"success": False, "error": tail-of(build_resp.output)} on a failed
    build (F2(b))."""
    meta = _run_meta(
        tail="",  # the marker never reached the CLI's own captured tail
        state={
            "overall_success": False,
            "phase_results": {
                "build": {
                    "success": False,
                    "error": "Claude Code error: You've hit your session limit",
                },
            },
        },
    )
    assert run_eval.classify_status_slim(meta) == "infra_error"


def test_classify_status_slim_review_only_marker_with_overall_success_stays_ok():
    """The m4-slim/01-feature-tags/3 specimen, reproduced directly: the
    advisory review phase alone hit the session limit, but overall_success
    is true — status must stay "ok" (never flip to infra_error), and
    slim_advisory_review_infra() must report the carve-out so the caller
    (run_trial) can record result["advisory_review_infra"] = True."""
    state = {
        "overall_success": True,
        "phase_results": {
            "plan": {"success": True},
            "build": {"success": True},
            "gates": {"success": True, "iters": 1},
            "review": {
                "success": False,
                "output_tail": "Claude Code error: You've hit your session limit "
                                "· resets 7pm (UTC)",
            },
        },
    }
    meta = _run_meta(tail="", state=state)
    assert run_eval.classify_status_slim(meta) == "ok"
    assert run_eval.slim_advisory_review_infra(state) is True


def test_classify_status_slim_review_only_marker_without_overall_success_is_task_fail():
    """Same review-only marker, but the run did NOT otherwise succeed —
    review's non-blocking design means its marker still must not force
    infra_error; the run reads as a plain task_fail, and the advisory flag
    does not apply (it's scoped to "otherwise-successful" runs only)."""
    state = {
        "overall_success": False,
        "phase_results": {
            "build": {"success": True},
            "gates": {"success": False, "iters": 3},
            "review": {
                "success": False,
                "output_tail": "Claude Code error: You've hit your session limit",
            },
        },
    }
    meta = _run_meta(tail="", state=state)
    assert run_eval.classify_status_slim(meta) == "task_fail"
    assert run_eval.slim_advisory_review_infra(state) is False


def test_classify_status_slim_marker_outside_review_wins_even_if_review_also_hit():
    """A marker in a non-review phase always classifies infra_error, even
    when the review phase *also* has a marker — the review-only carve-out
    only applies when review is the SOLE phase with a hit."""
    state = {
        "overall_success": True,
        "phase_results": {
            "build": {"success": False, "error": "rate limit exceeded"},
            "review": {"success": False, "output_tail": "session limit hit"},
        },
    }
    meta = _run_meta(tail="", state=state)
    assert run_eval.classify_status_slim(meta) == "infra_error"


# ---------------------------------------------------------------------------
# run_trial engine dispatch (F1): evals/sweep.py builds its own
# argparse.Namespace (never through run_eval.py's argparse `run` defaults)
# and calls run_eval.run_trial() directly. Before the getattr(cfg, "engine",
# "travis") guards, the very first `cfg.engine` read — in run_trial's
# result-dict construction, BEFORE its try/except — raised an uncaught
# AttributeError on any engine-less Namespace, crashing the whole sweep on
# trial 1 every time.
# ---------------------------------------------------------------------------


def test_run_trial_engine_less_namespace_dispatches_travis_and_does_not_raise(
    monkeypatch, tmp_path,
):
    # Deliberately mirrors sweep.py's Namespace(...) shape (pre-fix): no
    # `engine` attribute at all.
    cfg = argparse.Namespace(
        variant="sweep-test", planner="travis", model="opus", effort=None,
        memory=False, trials=1, skip_review=False, skip_validate=False,
        keep_tmp=False,
    )
    assert not hasattr(cfg, "engine")

    calls = {"run_sdlc": 0, "run_slim": 0}

    def fake_prepare_target(*args, **kwargs):
        return tmp_path / "target"

    def fake_run_sdlc(task, adw_id, target, cfg, svc_env=None):
        calls["run_sdlc"] += 1
        return {"returncode": 0, "wall_ms": 1.0, "timed_out": False, "tail": ""}

    def fake_run_slim(*args, **kwargs):
        calls["run_slim"] += 1
        raise AssertionError("an engine-less cfg must dispatch to travis, not slim")

    class FakeCtx:
        # plan+build success so classify_status() (the travis path) reads
        # "ok" — this test is about the engine dispatch, not classification.
        state: dict = {
            "phase_results": {"plan": {"success": True}, "build": {"success": True}},
        }
        judge_cost_usd = 0.0
        judge_status = "n/a"
        judge_inputs_truncated: list = []

    def fake_build_context(*args, **kwargs):
        return FakeCtx()

    def fake_run_graders(ctx):
        return {}

    monkeypatch.setattr(run_eval, "prepare_target", fake_prepare_target)
    monkeypatch.setattr(run_eval, "run_sdlc", fake_run_sdlc)
    monkeypatch.setattr(run_eval, "run_slim", fake_run_slim)
    monkeypatch.setattr(run_eval, "build_context", fake_build_context)
    monkeypatch.setattr(run_eval, "run_graders", fake_run_graders)

    # result.json lands under the real evals/results/ (run_trial computes an
    # out_file.relative_to(EVALS_DIR) for its console log) — use a
    # throwaway variant name and clean it up afterward either way.
    variant_dir = run_eval.RESULTS_DIR / cfg.variant
    try:
        result = run_eval.run_trial(TASK_FEATURE, 1, cfg)

        assert calls == {"run_sdlc": 1, "run_slim": 0}, (
            "engine-less cfg must default to the travis dispatch path, not raise"
        )
        assert "error" not in result, f"run_trial swallowed an exception: {result}"
        assert "engine" not in result, "travis path must not stamp result['engine']"
        assert result["status"] == "ok"
    finally:
        shutil.rmtree(variant_dir, ignore_errors=True)
