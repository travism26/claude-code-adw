#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pyyaml"]
# ///

"""
Test eval-task capture — evals/capture_eval_task.py.

Usage:
    uv run adws/adw_tests/test_eval_task_capture.py

Verifies the deterministic mechanics (no LLM, no real run):
1. next_task_number() = highest NN- under evals/tasks/ + 1.
2. build_task() produces the right id + schema; setup omitted when empty.
3. test_command defaults per target; explicit override wins.
4. Emitted YAML round-trips and carries every field run_eval.py reads.
5. slugify() is kebab + capped; @file prompt reading works.
"""

import sys
import os
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

EVALS = Path(__file__).resolve().parents[2] / "evals"
sys.path.insert(0, str(EVALS))

import yaml
import capture_eval_task as cet


def main() -> None:
    failures = []

    # 1. numbering tracks the real tasks dir (>= 14 given tasks 01-13 exist)
    n = cet.next_task_number()
    if n < 14:
        failures.append(f"next_task_number={n}, expected >=14 (tasks 01-13 exist)")

    # 2 + 3. build_task schema, defaults, setup-omission
    task_id, task = cet.build_task(
        num=14, slug="x-y", prompt="do the thing", plan_type="bug",
        target="backend", acceptance=["echo ok"], judge_focus="root cause",
    )
    if task_id != "14-x-y":
        failures.append(f"task_id={task_id!r}, expected '14-x-y'")
    for k in ("id", "plan_type", "target", "prompt", "test_command", "acceptance", "judge_focus"):
        if k not in task:
            failures.append(f"task missing required key {k!r}")
    if "setup" in task:
        failures.append("setup present when none given")
    if task.get("test_command") != "npm test":
        failures.append(f"backend default test_command wrong: {task.get('test_command')!r}")

    # explicit test_command + setup
    _, task2 = cet.build_task(
        num=15, slug="z", prompt="p", plan_type="feature", target="app",
        acceptance=["a"], judge_focus="j", test_command="custom test",
        setup=["git apply p.patch"],
    )
    if task2.get("test_command") != "custom test":
        failures.append("explicit test_command override ignored")
    if task2.get("setup") != ["git apply p.patch"]:
        failures.append("setup not carried through")
    if task2.get("test_command") and "app" and cet.DEFAULT_TEST_COMMAND["app"] != "uv run pytest -q":
        failures.append("app default test_command changed unexpectedly")

    # 4. YAML round-trips with all fields intact
    loaded = yaml.safe_load(cet.dump_yaml(task))
    if loaded != task:
        failures.append(f"YAML did not round-trip:\n  in ={task}\n  out={loaded}")

    # 5. slugify + @file prompt
    if cet.slugify("Photo Timeline!! Offset") != "photo-timeline-offset":
        failures.append(f"slugify wrong: {cet.slugify('Photo Timeline!! Offset')!r}")
    if len(cet.slugify("a" * 100)) > 40:
        failures.append("slug not capped at 40")
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        f.write("  prompt from file  \n")
        fp = f.name
    try:
        if cet.read_prompt(f"@{fp}") != "prompt from file":
            failures.append("@file prompt not read/stripped correctly")
        if cet.read_prompt("inline text") != "inline text":
            failures.append("inline prompt mishandled")
    finally:
        os.unlink(fp)

    if failures:
        print("FAIL:")
        for f in failures:
            print(f"  - {f}")
        sys.exit(1)
    print("PASS: capture_eval_task — all 5 checks green")
    sys.exit(0)


if __name__ == "__main__":
    main()
