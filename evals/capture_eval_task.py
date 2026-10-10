#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml"]
# ///
"""Mint a new eval task from a real agent failure.

Used by the /capture_eval_task slash command to turn a real-world miss (the
agent produced a buggy/incomplete result that a human had to fix) into a
permanent benchmark task under evals/tasks/. This is the *eval-task* capture
loop — distinct from fixture_capture.py, which guards the harness itself.

The hard part — distilling the human's fix into a behavioral `acceptance`
oracle — is done by the operator/agent and passed in here as ready-made shell
checks. This script handles the deterministic mechanics: auto-numbering, sane
defaults per target, and writing a well-formed YAML that matches the existing
task schema (so run_eval.py picks it up unchanged).

Design notes:
- Targets are VENDORED and frozen (evals/target_app, evals/target_backend) —
  hermetic + contamination-resistant. We never point an eval at a live repo.
- `acceptance` checks should be BEHAVIORAL (assert the bug can't recur), not
  interface-name greps — the #1 false-negative in deterministic grading is a
  valid solution that uses different names than the test expected.
- For a bug that is NOT already present in the vendored baseline, pass `--setup`
  shell commands that plant it, so the agent has something to fix.

Usage (CLI):
    uv run evals/capture_eval_task.py \\
        --slug photo-timeline-offset \\
        --plan-type bug \\
        --target backend \\
        --prompt @/path/to/prompt.txt \\
        --acceptance "cd src && npm test -- photoTimeline >/dev/null" \\
        --setup "git apply /path/to/plant-bug.patch" \\
        --judge-focus "root-cause fix of pagination offset, not a clamp"

After writing, run the SATURATION CHECK before trusting the task:
    uv run evals/run_eval.py run --variant capture-check --tasks NN --trials 3
    uv run evals/compare.py --variants capture-check
A task only de-saturates the suite if the current harness does NOT already ace
it (pass^k < full). If it scores perfectly every trial, it adds nothing.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import yaml

EVALS_DIR = Path(__file__).resolve().parent
TASKS_DIR = EVALS_DIR / "tasks"

VALID_TARGETS = ("app", "backend")
VALID_PLAN_TYPES = ("feature", "bug", "chore")

# Sensible default test runner per vendored target.
DEFAULT_TEST_COMMAND = {
    "app": "uv run pytest -q",
    "backend": "npm test",
}

_SLUG_RE = re.compile(r"[^a-z0-9]+")
_NUM_RE = re.compile(r"^(\d+)-")


def slugify(text: str, max_len: int = 40) -> str:
    slug = _SLUG_RE.sub("-", text.lower()).strip("-")
    return slug[:max_len].rstrip("-") or "task"


def next_task_number() -> int:
    """Highest NN- prefix under evals/tasks/ + 1 (zero-padded by caller)."""
    highest = 0
    for path in TASKS_DIR.glob("*.yaml"):
        m = _NUM_RE.match(path.name)
        if m:
            highest = max(highest, int(m.group(1)))
    return highest + 1


def read_prompt(value: str) -> str:
    """A prompt given inline, or @path to read it from a file."""
    if value.startswith("@"):
        return Path(value[1:]).read_text(encoding="utf-8").strip()
    return value.strip()


def build_task(
    *,
    num: int,
    slug: str,
    prompt: str,
    plan_type: str,
    target: str,
    acceptance: list[str],
    judge_focus: str,
    test_command: str | None = None,
    setup: list[str] | None = None,
) -> tuple[str, dict]:
    """Return (task_id, ordered task dict) ready to YAML-dump."""
    task_id = f"{num:02d}-{slug}"
    task: dict = {
        "id": task_id,
        "plan_type": plan_type,
        "target": target,
        "prompt": prompt,
    }
    if setup:
        task["setup"] = list(setup)
    task["test_command"] = test_command or DEFAULT_TEST_COMMAND[target]
    task["acceptance"] = list(acceptance)
    task["judge_focus"] = judge_focus
    return task_id, task


def dump_yaml(task: dict) -> str:
    """YAML matching the existing task style — block scalars, no aliases."""
    return yaml.safe_dump(task, sort_keys=False, default_flow_style=False, width=100)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--slug", required=True, help="short kebab-case identifier for the task")
    p.add_argument("--prompt", required=True, help="the request (inline, or @path to a file)")
    p.add_argument("--plan-type", required=True, choices=VALID_PLAN_TYPES)
    p.add_argument("--target", required=True, choices=VALID_TARGETS)
    p.add_argument(
        "--acceptance", action="append", required=True,
        help="behavioral shell check that must exit 0 (repeatable) — THE oracle",
    )
    p.add_argument("--judge-focus", required=True, help="one line: what the judge should weigh")
    p.add_argument("--test-command", default=None, help=f"override; defaults per target: {DEFAULT_TEST_COMMAND}")
    p.add_argument(
        "--setup", action="append", default=None,
        help="shell command to plant a bug into the baseline before the run (repeatable)",
    )
    p.add_argument("--dry-run", action="store_true", help="print the YAML, don't write")
    args = p.parse_args()

    num = next_task_number()
    slug = slugify(args.slug)
    task_id, task = build_task(
        num=num,
        slug=slug,
        prompt=read_prompt(args.prompt),
        plan_type=args.plan_type,
        target=args.target,
        acceptance=args.acceptance,
        judge_focus=args.judge_focus,
        test_command=args.test_command,
        setup=args.setup,
    )
    text = dump_yaml(task)

    if args.dry_run:
        print(text)
        return

    out_path = TASKS_DIR / f"{task_id}.yaml"
    if out_path.exists():
        raise SystemExit(f"refusing to overwrite existing task: {out_path}")
    out_path.write_text(text, encoding="utf-8")

    print(f"task: {out_path.relative_to(EVALS_DIR.parent)}")
    print(f"id:   {task_id}")
    print()
    print("SATURATION CHECK (a task only helps if the harness does NOT already ace it):")
    print(f"  uv run evals/run_eval.py run --variant capture-check --tasks {num:02d} --trials 3")
    print(f"  uv run evals/compare.py --variants capture-check")
    print("Keep it only if pass^k < full (some trials fail). If it scores 3/3, it's saturated too.")


if __name__ == "__main__":
    main()
    sys.exit(0)
