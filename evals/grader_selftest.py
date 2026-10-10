#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pydantic", "python-dotenv", "json-repair"]
# ///
"""Grader self-tests: prove the graders catch lies, not just confirm truths.

Idea adapted from Anthropic's cwc-workshops how-we-claude-code `matrix.test.ts`
(https://github.com/anthropics/cwc-workshops, Apache-2.0), which keeps an
EXPECTED_FAIL set — fixtures *designed* to fail — so the verification
framework is itself verified. Here every grader in evals/graders.py gets:

  - known_good fixtures: a correct artifact must score well (grader not
    too strict / parses real output shapes), and
  - known_bad fixtures: a deliberately wrong-but-plausible artifact must
    score badly. If a known_bad scores well, the grader accepts lies and
    every eval number downstream of it is suspect.

Deterministic graders run by default (fast, free). Judge graders cost two
sonnet calls and are gated behind --judge (audit rule: "feed the judge a
few obviously wrong answers and confirm it fails them").

Usage:
  uv run evals/grader_selftest.py            # code graders only
  uv run evals/grader_selftest.py --judge    # + known-negative judge fixtures

Exit code 0 = every fixture behaved as designed; 1 = at least one miss.
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

EVALS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(EVALS_DIR))

import graders  # noqa: E402
from graders import Grader, GraderContext, run_graders  # noqa: E402


def make_ctx(tmp: Path, **overrides: Any) -> GraderContext:
    """A minimal valid context; fixtures override only what they test."""
    defaults: dict[str, Any] = dict(
        adw_id="selftest",
        target_dir=tmp,
        agents_dir=tmp / "agents",
        task={},
        state={},
        diff_text="",
        diff_numstat="",
        spec_text="",
        wall_ms=0.0,
    )
    defaults.update(overrides)
    return GraderContext(**defaults)


def write_agent_cost(agents_dir: Path, agent_name: str, payload: Any) -> None:
    d = agents_dir / agent_name
    d.mkdir(parents=True, exist_ok=True)
    text = payload if isinstance(payload, str) else json.dumps(payload)
    (d / "cc_final_object.json").write_text(text)


@dataclass(frozen=True)
class Case:
    name: str
    grader: str                                   # grader name in graders.GRADERS
    kind: str                                     # known_good | known_bad
    build: Callable[[Path], GraderContext]        # tmp dir -> context
    check: Callable[[Any], bool]                  # grader result -> ok?
    expect: str                                   # human-readable expectation


# ---------------------------------------------------------------------------
# Code-grader fixtures
# ---------------------------------------------------------------------------

CASES: list[Case] = [
    # -- tests_pass: summary parsing (pytest + mocha shapes) ----------------
    Case(
        "pytest summary parsed",
        "tests_pass", "known_good",
        lambda tmp: make_ctx(tmp, task={"test_command": "echo '3 passed, 1 failed'"}),
        lambda v: v == 0.75,
        "3 passed / 1 failed -> 0.75",
    ),
    Case(
        "mocha summary parsed",
        "tests_pass", "known_good",
        lambda tmp: make_ctx(tmp, task={"test_command": "echo '12 passing'; echo '2 failing'; exit 1"}),
        lambda v: abs(v - 12 / 14) < 1e-9,
        "12 passing / 2 failing -> 12/14",
    ),
    Case(
        "errors counted as failures",
        "tests_pass", "known_bad",
        lambda tmp: make_ctx(tmp, task={"test_command": "echo '2 passed, 1 error'; exit 1"}),
        lambda v: abs(v - 2 / 3) < 1e-9,
        "collection errors must not inflate the ratio (2/3, not 1.0)",
    ),
    Case(
        "all tests failing scores 0",
        "tests_pass", "known_bad",
        lambda tmp: make_ctx(tmp, task={"test_command": "echo '0 passed, 5 failed'; exit 1"}),
        lambda v: v == 0.0,
        "0 passed / 5 failed -> 0.0",
    ),
    Case(
        "deleted test suite is not a pass",
        "tests_pass", "known_bad",
        lambda tmp: make_ctx(tmp, task={"test_command": "echo 'no tests ran'; exit 5"}),
        lambda v: v == 0.0,
        "agent deleting the suite (pytest exit 5, no summary) must score 0, not 1",
    ),
    Case(
        "silent success is not a free pass",
        "tests_pass", "known_bad",
        lambda tmp: make_ctx(tmp, task={"test_command": "exit 0"}),
        lambda v: v == "no_summary",
        "exit 0 with no parseable summary -> 'no_summary' sentinel, never 1.0",
    ),
    Case(
        "crash without summary scores 0",
        "tests_pass", "known_bad",
        lambda tmp: make_ctx(tmp, task={"test_command": "echo 'Traceback (most recent call last)'; exit 1"}),
        lambda v: v == 0.0,
        "crash output with no parseable summary -> 0.0",
    ),

    # -- acceptance_checks --------------------------------------------------
    Case(
        "acceptance ratio over mixed checks",
        "acceptance_checks", "known_good",
        lambda tmp: make_ctx(tmp, task={"acceptance": ["true", "false", "true"]}),
        lambda v: abs(v - 2 / 3) < 1e-9,
        "2 of 3 shell checks pass -> 2/3",
    ),
    Case(
        "all acceptance checks failing scores 0",
        "acceptance_checks", "known_bad",
        lambda tmp: make_ctx(tmp, task={"acceptance": ["false", "exit 7"]}),
        lambda v: v == 0.0,
        "nothing satisfied -> 0.0",
    ),
    Case(
        "no acceptance checks is '-', not a free pass",
        "acceptance_checks", "known_bad",
        lambda tmp: make_ctx(tmp, task={}),
        lambda v: v == "-",
        "missing acceptance list must render '-' (excluded), never 1.0",
    ),

    # -- phases_completed ---------------------------------------------------
    Case(
        "successful phases counted",
        "phases_completed", "known_good",
        lambda tmp: make_ctx(tmp, state={"phase_results": {
            "plan": {"success": True}, "build": {"success": True},
            "test": {"success": False}, "review": None,
        }}),
        lambda v: v == 2.0,
        "two success=True phases -> 2",
    ),
    Case(
        "empty state counts zero phases",
        "phases_completed", "known_bad",
        lambda tmp: make_ctx(tmp, state={}),
        lambda v: v == 0.0,
        "missing travis_state -> 0, not an error or a default pass",
    ),

    # -- test_retries_used --------------------------------------------------
    Case(
        "retries = attempts beyond first",
        "test_retries_used", "known_good",
        lambda tmp: make_ctx(tmp, state={"phase_results": {"test": {"attempts": 3}}}),
        lambda v: v == 2.0,
        "attempts=3 -> 2 retries",
    ),
    Case(
        "missing attempts renders '-'",
        "test_retries_used", "known_good",
        lambda tmp: make_ctx(tmp, state={"phase_results": {"test": {}}}),
        lambda v: v == "-",
        "no attempts field -> '-' (not 0, which would claim a clean pass)",
    ),

    # -- total_cost_usd: the judge must never leak into SUT cost ------------
    Case(
        "SUT cost sums non-judge agents",
        "total_cost_usd", "known_good",
        lambda tmp: (
            write_agent_cost(tmp / "agents", "planner", {"total_cost_usd": 0.25}),
            write_agent_cost(tmp / "agents", "builder", {"total_cost_usd": 0.50}),
            make_ctx(tmp),
        )[-1],
        lambda v: abs(v - 0.75) < 1e-9,
        "0.25 + 0.50 -> 0.75",
    ),
    Case(
        "judge cost excluded from SUT cost",
        "total_cost_usd", "known_bad",
        lambda tmp: (
            write_agent_cost(tmp / "agents", "builder", {"total_cost_usd": 0.50}),
            write_agent_cost(tmp / "agents", "judge_eval", {"total_cost_usd": 9.99}),
            make_ctx(tmp),
        )[-1],
        lambda v: abs(v - 0.50) < 1e-9,
        "judge_* dirs must be excluded — 0.50, not 10.49",
    ),
    Case(
        "malformed cost file ignored, missing dir is '-'",
        "total_cost_usd", "known_good",
        lambda tmp: (
            write_agent_cost(tmp / "agents", "builder", "not json{"),
            make_ctx(tmp),
        )[-1],
        lambda v: v == "-",
        "unparseable final object skipped; no costs at all -> '-'",
    ),

    # -- wall_minutes ---------------------------------------------------------
    Case(
        "wall ms converted to minutes",
        "wall_minutes", "known_good",
        lambda tmp: make_ctx(tmp, wall_ms=90_000.0),
        lambda v: v == 1.5,
        "90s -> 1.5 minutes",
    ),

    # -- diff_size ------------------------------------------------------------
    Case(
        "numstat summed, binary rows skipped",
        "diff_size", "known_good",
        lambda tmp: make_ctx(tmp, diff_numstat="10\t5\ta.py\n-\t-\tbin.png\n3\t0\tb.py\n"),
        lambda v: v == 18.0,
        "10+5+3+0 with binary '-' rows ignored -> 18",
    ),
    Case(
        "empty diff scores 0 lines",
        "diff_size", "known_bad",
        lambda tmp: make_ctx(tmp, diff_numstat=""),
        lambda v: v == 0.0,
        "no implementation -> 0, visible in the scorecard",
    ),

    # -- spec_word_count --------------------------------------------------------
    Case(
        "missing spec counts 0 words",
        "spec_word_count", "known_bad",
        lambda tmp: make_ctx(tmp, spec_text=""),
        lambda v: v == 0.0,
        "no spec produced -> 0, never '-' (absence is a signal here)",
    ),
    Case(
        "spec words counted",
        "spec_word_count", "known_good",
        lambda tmp: make_ctx(tmp, spec_text="alpha beta gamma"),
        lambda v: v == 3.0,
        "3 words -> 3",
    ),
]


# ---------------------------------------------------------------------------
# Judge fixtures (known negatives — gated, costs ~2 sonnet calls)
# ---------------------------------------------------------------------------

TASK_03_PROMPT = (
    "Fix a bug in the notes app: after deleting a note, newly added notes can "
    "receive an id that already belongs to another note. Ids must be unique for "
    "the lifetime of the store. Add a regression test covering the "
    "delete-then-add sequence."
)

OFF_SPEC_DIFF = """\
diff --git a/README.md b/README.md
index 000000..111111 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,4 @@
 # Notes app
+
+Updated documentation styling and added a badge.
"""

PLAUSIBLE_SPEC = (
    "# Bug fix: duplicate ids after delete\n\n"
    "## Problem\nIds are assigned as len(notes)+1, so delete-then-add reuses an id.\n\n"
    "## Fix\nAssign max(existing ids)+1 in add(). \n\n"
    "## Tests\nRegression test: add two, delete first, add third, assert unique ids.\n"
)


def judge_cases(tmp: Path) -> list[tuple[str, GraderContext, str, Callable[[Any], bool], str]]:
    """(name, ctx, grader, check, expect) — each ctx is one combined judge call."""
    empty = make_ctx(
        tmp, task={"prompt": TASK_03_PROMPT, "judge_focus": "root-cause id fix"},
        spec_text="", diff_text="",
        agents_dir=tmp / "agents_judge_empty",
    )
    off_spec = make_ctx(
        tmp, task={"prompt": TASK_03_PROMPT, "judge_focus": "root-cause id fix"},
        spec_text=PLAUSIBLE_SPEC, diff_text=OFF_SPEC_DIFF,
        agents_dir=tmp / "agents_judge_offspec",
    )
    return [
        ("judge fails empty spec", empty, "spec_quality",
         lambda v: isinstance(v, float) and v <= 1.0,
         "no spec at all must score <=1/5"),
        ("judge fails empty diff", empty, "implementation_fidelity",
         lambda v: isinstance(v, float) and v <= 1.0,
         "no implementation must score <=1/5"),
        ("judge fails off-spec diff", off_spec, "implementation_fidelity",
         lambda v: isinstance(v, float) and v <= 2.0,
         "README-only diff for an id-fix spec must score <=2/5"),
    ]


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def grader_by_name(name: str) -> Grader:
    for g in graders.GRADERS:
        if g.name == name:
            return g
    raise KeyError(f"no grader named {name!r}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--judge", action="store_true",
                    help="Also run known-negative judge fixtures (~2 sonnet calls)")
    cfg = ap.parse_args()

    misses: list[str] = []
    with tempfile.TemporaryDirectory(prefix="grader_selftest_") as tmpdir:
        tmp = Path(tmpdir)

        for i, case in enumerate(CASES):
            ctx = case.build(tmp / f"case_{i}")
            ctx.target_dir.mkdir(parents=True, exist_ok=True)
            value = grader_by_name(case.grader).grade(ctx)
            ok = case.check(value)
            mark = "ok " if ok else "MISS"
            print(f"[{mark}] {case.grader:<20} {case.kind:<10} {case.name}  -> {value!r}")
            if not ok:
                misses.append(f"{case.grader}/{case.name}: got {value!r}, expected {case.expect}")

        # Judge-input truncation: head AND tail must survive, with a marker.
        long_text = "HEAD_SENTINEL " + ("x" * 5_000) + " TAIL_SENTINEL"
        clipped, was_truncated = graders._truncate_head_tail(long_text, 1_000, "diff")
        trunc_checks = [
            ("truncation flagged", was_truncated is True),
            ("head survives truncation", "HEAD_SENTINEL" in clipped),
            ("tail survives truncation (head-only clipping is the lie)",
             "TAIL_SENTINEL" in clipped),
            ("marker declares the omission", "omitted from the middle" in clipped),
            ("output stays near the cap", len(clipped) <= 1_000 + 250),
        ]
        short_text = "tiny diff"
        untouched, was_truncated = graders._truncate_head_tail(short_text, 1_000, "diff")
        trunc_checks += [
            ("under-limit text unchanged", untouched == short_text),
            ("under-limit not flagged", was_truncated is False),
        ]
        for name, ok in trunc_checks:
            kind = "known_bad" if "lie" in name else "known_good"
            mark = "ok " if ok else "MISS"
            print(f"[{mark}] _truncate_head_tail   {kind:<10} {name}")
            if not ok:
                misses.append(f"_truncate_head_tail/{name}")

        # run_graders must absorb grader bugs, not kill the trial.
        broken = Grader("boom", "code", "always raises", lambda ctx: 1 / 0)
        original = graders.GRADERS
        graders.GRADERS = original + [broken]
        try:
            results = run_graders(make_ctx(tmp / "robustness"))
        finally:
            graders.GRADERS = original
        robust_ok = str(results.get("boom", "")).startswith("grader_error")
        mark = "ok " if robust_ok else "MISS"
        print(f"[{mark}] run_graders          known_bad  raising grader contained  -> {results.get('boom')!r}")
        if not robust_ok:
            misses.append("run_graders did not contain a raising grader")

        if cfg.judge:
            print("\nJudge known-negative fixtures (costs ~2 sonnet calls):")
            for name, ctx, gname, check, expect in judge_cases(tmp):
                ctx.target_dir.mkdir(parents=True, exist_ok=True)
                value = grader_by_name(gname).grade(ctx)
                ok = check(value)
                mark = "ok " if ok else "MISS"
                print(f"[{mark}] {gname:<24} {name}  -> {value!r}  "
                      f"(judge_status={ctx.judge_status}, cost=${ctx.judge_cost_usd:.4f})")
                if not ok:
                    misses.append(f"{gname}/{name}: got {value!r}, expected {expect}")

    print()
    if misses:
        print(f"SELFTEST FAILED — {len(misses)} miss(es):")
        for m in misses:
            print(f"  - {m}")
        return 1
    print("SELFTEST PASSED — every known-good scored well and every known-bad was caught.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
