#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pydantic", "python-dotenv", "json-repair"]
# ///
"""Graders for the ADW eval harness.

Declarative grader pattern (adapted from Anthropic's cwc-workshops
eval-driven-agent-development TypeScript harness, https://github.com/anthropics/cwc-workshops, Apache-2.0):

  - Grader: {name, kind: code|judge, description, grade(ctx), scale, fmt}
  - GraderContext is built ONCE per trial; judge calls are memoized so one
    combined judge response feeds every judge grader.
  - Scores are scalar (ratios, counts, USD, 0-5) — never pass/fail.

Audit-hygiene rules followed (adapted from the cwc-workshops rightmodel skill):
  - Judge cost is recorded separately from system-under-test cost (the judge
    runs as agent "judge_eval"; SUT cost excludes agents/<id>/judge_* dirs).
  - Judge model is FIXED so it is constant across A/B variants.
  - Judge parse failures yield a sentinel + status, never a crash.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Literal, Optional, Union

HARNESS_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HARNESS_ROOT / "adws"))

from pydantic import BaseModel, Field  # noqa: E402

from adw_modules.agent import (  # noqa: E402
    AgentPromptRequest,
    parse_jsonl_output,
    prompt_claude_code,
)
from adw_modules.utils import parse_json  # noqa: E402

# Judge model is fixed across all variants so A/B comparisons share one judge.
JUDGE_MODEL = "sonnet"
JUDGE_AGENT_NAME = "judge_eval"

# Truncation caps for judge prompt inputs (keep the judge call cheap).
MAX_SPEC_CHARS = 12_000
MAX_DIFF_CHARS = 24_000

# Paths excluded from diff metrics — workflow artifacts, not implementation.
DIFF_EXCLUDES = [":(exclude)specs", ":(exclude)ai_docs", ":(exclude)app_docs"]

ACCEPTANCE_TIMEOUT_S = 120
TEST_TIMEOUT_S = 600


def clean_subprocess_env() -> dict:
    """Environment for nested `uv run` calls in the target app.

    This script itself runs under `uv run`, which exports VIRTUAL_ENV /
    PYTHONPATH pointing at the harness's ephemeral environment. Nested
    `uv run pytest` in the target would resolve against that environment
    instead of the target's own project — scrub the leaky vars.
    """
    env = dict(os.environ)
    for var in ("VIRTUAL_ENV", "PYTHONPATH", "PYTHONHOME", "UV_PROJECT_ENVIRONMENT"):
        env.pop(var, None)
    return env


# ---------------------------------------------------------------------------
# Grader declaration
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Scale:
    """Display scale for heat-map coloring. good: 'high' | 'low' | number."""

    min: float
    max: float
    good: Union[str, float]


@dataclass(frozen=True)
class Grader:
    name: str
    kind: Literal["code", "judge"]
    description: str
    grade: Callable[["GraderContext"], Union[float, str]]
    scale: Optional[Scale] = None
    fmt: Optional[str] = None  # str.format spec, e.g. "{:.0%}" or "${:.4f}"


@dataclass
class GraderContext:
    """Built once per trial; passed to every grader."""

    adw_id: str
    target_dir: Path
    agents_dir: Path           # harness agents/{adw_id}
    task: dict                 # parsed task YAML
    state: dict                # travis_state.json contents ({} if missing)
    diff_text: str             # git diff of implementation vs baseline commit
    diff_numstat: str          # git diff --numstat output (same pathspec)
    spec_text: str             # contents of the produced spec ("" if missing)
    wall_ms: float             # orchestrator-recorded wall time for the SDLC run
    extra_env: dict = field(default_factory=dict)  # e.g. DB_*/REDIS_* for backend targets
    judge_cost_usd: float = 0.0
    judge_status: str = "not_run"   # not_run | ok | judge_parse_error | judge_error
    judge_inputs_truncated: list = field(default_factory=list)  # subset of ["spec", "diff"]
    _judge_result: Optional[dict] = field(default=None, repr=False)


def build_context(
    adw_id: str,
    target_dir: Path,
    task: dict,
    wall_ms: float,
    extra_env: Optional[dict] = None,
) -> GraderContext:
    """Build the per-trial grader context (state, diff, spec) exactly once."""
    agents_dir = HARNESS_ROOT / "agents" / adw_id

    state: dict = {}
    state_file = agents_dir / "travis_state.json"
    if state_file.exists():
        try:
            state = json.loads(state_file.read_text())
        except json.JSONDecodeError:
            state = {}

    # Stage everything (including untracked files the builder created) so the
    # diff against the baseline commit covers the full implementation.
    subprocess.run(
        ["git", "-C", str(target_dir), "add", "-A"],
        capture_output=True, check=False,
    )
    diff_text = subprocess.run(
        ["git", "-C", str(target_dir), "diff", "--cached", "--", "."] + DIFF_EXCLUDES,
        capture_output=True, text=True, check=False,
    ).stdout
    diff_numstat = subprocess.run(
        ["git", "-C", str(target_dir), "diff", "--cached", "--numstat", "--", "."] + DIFF_EXCLUDES,
        capture_output=True, text=True, check=False,
    ).stdout

    spec_text = ""
    plan_file = state.get("plan_file")
    if plan_file:
        spec_path = target_dir / plan_file
        if spec_path.exists():
            spec_text = spec_path.read_text()

    return GraderContext(
        adw_id=adw_id,
        target_dir=target_dir,
        agents_dir=agents_dir,
        task=task,
        state=state,
        diff_text=diff_text,
        diff_numstat=diff_numstat,
        spec_text=spec_text,
        wall_ms=wall_ms,
        extra_env=extra_env or {},
    )


# ---------------------------------------------------------------------------
# Code graders
# ---------------------------------------------------------------------------

# Covers pytest ("12 passed, 1 failed, 2 errors") and mocha ("12 passing, 1 failing")
PYTEST_SUMMARY_RE = re.compile(r"(\d+) pass(?:ed|ing)")
PYTEST_FAILED_RE = re.compile(r"(\d+) fail(?:ed|ing)")
PYTEST_ERROR_RE = re.compile(r"(\d+) error")


def grade_tests_pass(ctx: GraderContext) -> Union[float, str]:
    """Run the task's test command in the target; ratio of passing tests."""
    cmd = ctx.task.get("test_command", "uv run pytest -q")
    try:
        result = subprocess.run(
            cmd, shell=True, cwd=ctx.target_dir,
            capture_output=True, text=True, timeout=TEST_TIMEOUT_S,
            env={**clean_subprocess_env(), **ctx.extra_env},
        )
    except subprocess.TimeoutExpired:
        return "timeout"

    output = result.stdout + result.stderr
    passed = sum(int(m) for m in PYTEST_SUMMARY_RE.findall(output))
    failed = sum(int(m) for m in PYTEST_FAILED_RE.findall(output))
    failed += sum(int(m) for m in PYTEST_ERROR_RE.findall(output))

    total = passed + failed
    if total == 0:
        # No parseable summary: a clean exit proves nothing ran-and-passed,
        # so render a sentinel instead of minting a free 1.0 (audit
        # 2026-06-09, finding 3). A dirty exit is still a failure.
        return "no_summary" if result.returncode == 0 else 0.0
    return passed / total


def grade_acceptance_checks(ctx: GraderContext) -> Union[float, str]:
    """Run the task's acceptance shell checks in the target; ratio passing."""
    checks = ctx.task.get("acceptance", [])
    if not checks:
        return "-"
    passed = 0
    for check in checks:
        try:
            result = subprocess.run(
                check, shell=True, cwd=ctx.target_dir,
                capture_output=True, text=True, timeout=ACCEPTANCE_TIMEOUT_S,
                env={**clean_subprocess_env(), **ctx.extra_env},
            )
            if result.returncode == 0:
                passed += 1
        except subprocess.TimeoutExpired:
            pass
    return passed / len(checks)


def grade_phases_completed(ctx: GraderContext) -> Union[float, str]:
    """Count of SDLC phases with success=True in travis_state.json."""
    results = ctx.state.get("phase_results", {})
    return float(sum(1 for r in results.values() if r and r.get("success")))


def grade_test_retries_used(ctx: GraderContext) -> Union[float, str]:
    """Extra test attempts beyond the first (0 = clean first pass)."""
    test_result = ctx.state.get("phase_results", {}).get("test") or {}
    attempts = test_result.get("attempts")
    if attempts is None:
        return "-"
    return float(max(0, attempts - 1))


def _iter_agent_costs(agents_dir: Path):
    """Yield (agent_name, total_cost_usd) from each agent's final object."""
    if not agents_dir.is_dir():
        return
    for agent_dir in sorted(agents_dir.iterdir()):
        final_obj = agent_dir / "cc_final_object.json"
        if not final_obj.exists():
            continue
        try:
            data = json.loads(final_obj.read_text())
        except json.JSONDecodeError:
            continue
        cost = data.get("total_cost_usd")
        if isinstance(cost, (int, float)):
            yield agent_dir.name, float(cost)


def grade_total_cost_usd(ctx: GraderContext) -> Union[float, str]:
    """Sum of agent costs for the system under test (judges excluded)."""
    costs = [
        cost for name, cost in _iter_agent_costs(ctx.agents_dir)
        if not name.startswith("judge_")
    ]
    if not costs:
        return "-"
    return sum(costs)


def grade_wall_minutes(ctx: GraderContext) -> Union[float, str]:
    """Wall-clock minutes for the full SDLC run (orchestrator-recorded)."""
    return ctx.wall_ms / 60_000.0


def grade_diff_size(ctx: GraderContext) -> Union[float, str]:
    """Lines added + removed vs the baseline commit (workflow artifacts excluded)."""
    total = 0
    for line in ctx.diff_numstat.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            added = int(parts[0]) if parts[0].isdigit() else 0
            removed = int(parts[1]) if parts[1].isdigit() else 0
            total += added + removed
    return float(total)


def grade_spec_word_count(ctx: GraderContext) -> Union[float, str]:
    """Word count of the produced spec (0 = no spec found)."""
    return float(len(ctx.spec_text.split()))


def grade_spec_review_flagged(ctx: GraderContext) -> Union[float, str]:
    """Did the spec-review gate flag the spec? 1.0 = revise/reject, 0.0 = approve.

    Reads travis_state.json's spec_review block (written only when the gate ran
    in auto mode). "-" when the gate was off (variant A) or didn't record a
    verdict — so this stays blank on baselines and only carries signal for the
    spec-review variant. Interpretation is tier-dependent: on spec-defect tasks a
    flag is the gate working (catch rate ↑ is good); on clean tasks a flag is a
    false alarm (↑ is bad). See docs/spec-review-gate-plan.md §6.3.
    """
    review = ctx.state.get("spec_review")
    if not review or not isinstance(review, dict):
        return "-"
    verdict = review.get("verdict")
    if verdict in ("revise", "reject"):
        return 1.0
    if verdict == "approve":
        return 0.0
    return "-"


# ---------------------------------------------------------------------------
# Judge graders (one memoized combined call feeds both)
# ---------------------------------------------------------------------------

class JudgeScore(BaseModel):
    score: int = Field(ge=0, le=5)
    rationale: str


class JudgeVerdict(BaseModel):
    spec_quality: JudgeScore
    implementation_fidelity: JudgeScore


JUDGE_PROMPT_TEMPLATE = """You are an impartial evaluation judge for an agentic developer workflow.
Do NOT use any tools. Respond with ONLY a JSON object, no other text.

A coding agent was given this task:
<task>
{task_prompt}
</task>

It produced this spec:
<spec>
{spec_text}
</spec>

And this implementation diff (workflow artifacts excluded):
<diff>
{diff_text}
</diff>

Evaluation focus for this task: {judge_focus}

Score two dimensions on a 0-5 integer scale (0=absent/wrong, 3=adequate, 5=excellent):
1. spec_quality — Is the spec complete, testable, faithful to the task prompt, and actionable?
2. implementation_fidelity — Does the diff implement what the spec promised (no missing pieces, no unrelated changes)?

Judge outcomes, not style. Do not reward verbosity. A short spec that fully covers the task scores higher than a long vague one.

Respond with ONLY this JSON shape:
{{"spec_quality": {{"score": <0-5>, "rationale": "<1-2 sentences>"}}, "implementation_fidelity": {{"score": <0-5>, "rationale": "<1-2 sentences>"}}}}"""

JUDGE_RETRY_SUFFIX = "\n\nYour previous reply was not valid JSON. Reply with ONLY the JSON object described above."


def _truncate_head_tail(text: str, limit: int, label: str) -> tuple[str, bool]:
    """Clip oversized judge inputs keeping head AND tail, with an explicit marker.

    Head-only truncation silently drops the end of large diffs — where tests
    and registration edits usually land — which biases fidelity scores upward
    on exactly the largest changes (audit 2026-06-09, finding 2). The marker
    tells the judge it is scoring a partial artifact.
    """
    if len(text) <= limit:
        return text, False
    head = int(limit * 0.6)
    tail = limit - head
    omitted = len(text) - head - tail
    marker = (
        f"\n\n[... {omitted} chars omitted from the middle of this {label}: "
        f"it exceeded the {limit}-char judge input cap. You are scoring a "
        f"partial {label} — judge only what is visible ...]\n\n"
    )
    return text[:head] + marker + text[-tail:], True


def _call_judge(ctx: GraderContext) -> Optional[JudgeVerdict]:
    """One combined judge call; memoized on the context. Cost recorded separately."""
    if ctx._judge_result is not None:
        return JudgeVerdict.model_validate(ctx._judge_result)
    if ctx.judge_status not in ("not_run",):
        return None  # already attempted and failed — don't re-pay

    spec_text, spec_truncated = _truncate_head_tail(ctx.spec_text, MAX_SPEC_CHARS, "spec")
    diff_text, diff_truncated = _truncate_head_tail(ctx.diff_text, MAX_DIFF_CHARS, "diff")
    ctx.judge_inputs_truncated = (
        (["spec"] if spec_truncated else []) + (["diff"] if diff_truncated else [])
    )

    prompt = JUDGE_PROMPT_TEMPLATE.format(
        task_prompt=ctx.task.get("prompt", "").strip(),
        spec_text=spec_text or "(no spec was produced)",
        diff_text=diff_text or "(empty diff)",
        judge_focus=ctx.task.get("judge_focus", "overall correctness"),
    )

    judge_dir = ctx.agents_dir / JUDGE_AGENT_NAME
    judge_dir.mkdir(parents=True, exist_ok=True)

    attempt_prompt = prompt
    for attempt in (1, 2):
        output_file = str(judge_dir / f"cc_raw_output_attempt{attempt}.jsonl")
        request = AgentPromptRequest(
            prompt=attempt_prompt,
            adw_id=ctx.adw_id,
            agent_name=JUDGE_AGENT_NAME,
            model=JUDGE_MODEL,
            output_file=output_file,
            working_dir=str(ctx.target_dir),
        )
        try:
            response = prompt_claude_code(request)
        except Exception:
            ctx.judge_status = "judge_error"
            return None

        # Record judge cost from the JSONL result line (separate from SUT cost).
        _, result_message = parse_jsonl_output(output_file)
        if result_message and isinstance(result_message.get("total_cost_usd"), (int, float)):
            ctx.judge_cost_usd += float(result_message["total_cost_usd"])

        if not response.success:
            ctx.judge_status = "judge_error"
            return None

        try:
            verdict = parse_json(response.output, JudgeVerdict)
            ctx._judge_result = verdict.model_dump()
            ctx.judge_status = "ok"
            return verdict
        except Exception:
            attempt_prompt = prompt + JUDGE_RETRY_SUFFIX

    ctx.judge_status = "judge_parse_error"
    return None


def grade_spec_quality(ctx: GraderContext) -> Union[float, str]:
    verdict = _call_judge(ctx)
    return float(verdict.spec_quality.score) if verdict else ctx.judge_status


def grade_implementation_fidelity(ctx: GraderContext) -> Union[float, str]:
    verdict = _call_judge(ctx)
    return float(verdict.implementation_fidelity.score) if verdict else ctx.judge_status


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

GRADERS: list[Grader] = [
    Grader("tests_pass", "code", "Ratio of passing tests in the target app",
           grade_tests_pass, Scale(0, 1, "high"), "{:.0%}"),
    Grader("acceptance_checks", "code", "Ratio of task acceptance shell checks passing",
           grade_acceptance_checks, Scale(0, 1, "high"), "{:.0%}"),
    Grader("phases_completed", "code", "SDLC phases with success=True (max 7)",
           grade_phases_completed, Scale(0, 7, "high"), "{:.0f}"),
    Grader("test_retries_used", "code", "Extra test attempts beyond the first",
           grade_test_retries_used, Scale(0, 3, "low"), "{:.0f}"),
    Grader("total_cost_usd", "code", "SUT agent cost in USD (judge excluded)",
           grade_total_cost_usd, Scale(0, 5, "low"), "${:.4f}"),
    Grader("wall_minutes", "code", "Wall-clock minutes for the SDLC run",
           grade_wall_minutes, Scale(0, 60, "low"), "{:.1f}m"),
    Grader("diff_size", "code", "Lines added+removed (workflow artifacts excluded)",
           grade_diff_size, None, "{:.0f}"),
    Grader("spec_word_count", "code", "Words in the produced spec",
           grade_spec_word_count, None, "{:.0f}"),
    Grader("spec_review_flagged", "code", "Spec-review gate flagged the spec (1=revise/reject, 0=approve)",
           grade_spec_review_flagged, None, "{:.0%}"),
    Grader("spec_quality", "judge", "Judge 0-5: spec completeness/testability/fidelity",
           grade_spec_quality, Scale(0, 5, "high"), "{:.0f}/5"),
    Grader("implementation_fidelity", "judge", "Judge 0-5: diff implements the spec",
           grade_implementation_fidelity, Scale(0, 5, "high"), "{:.0f}/5"),
]


def run_graders(ctx: GraderContext) -> dict[str, Any]:
    """Run every grader against a built context; never raises."""
    results: dict[str, Any] = {}
    for grader in GRADERS:
        try:
            results[grader.name] = grader.grade(ctx)
        except Exception as e:  # a grader bug must not kill the trial
            results[grader.name] = f"grader_error: {e}"
    return results
