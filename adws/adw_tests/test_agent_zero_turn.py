#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv"]
# ///

"""Tests for adw_modules.agent.is_zero_turn_failure — the fail-closed guard
for CLI results that "succeeded" without executing a single agent turn.

Found live during the M5 factory smoke (2026-07-19): `claude -p "/build ..."`
against a repo missing the /build template returns a result message with
subtype "success", is_error False, num_turns 0 and result "Unknown command:
/build" — which execute_template previously reported as a successful build.

Usage:
    uv run pytest adws/adw_tests/test_agent_zero_turn.py -q
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from adw_modules.agent import is_zero_turn_failure  # noqa: E402


def test_unknown_command_result_is_failure():
    # The exact shape observed live.
    msg = {"type": "result", "subtype": "success", "is_error": False,
           "num_turns": 0, "result": "Unknown command: /build", "total_cost_usd": 0}
    assert is_zero_turn_failure(msg, msg["result"]) is True


def test_zero_turns_is_failure_even_with_benign_text():
    msg = {"is_error": False, "num_turns": 0, "result": "done"}
    assert is_zero_turn_failure(msg, "done") is True


def test_normal_success_with_turns_is_not_failure():
    msg = {"is_error": False, "num_turns": 7, "result": "implemented the change"}
    assert is_zero_turn_failure(msg, "implemented the change") is False


def test_error_results_are_left_to_the_existing_error_path():
    msg = {"is_error": True, "num_turns": 0, "result": "boom"}
    assert is_zero_turn_failure(msg, "boom") is False


def test_missing_num_turns_falls_back_to_unknown_command_prefix():
    assert is_zero_turn_failure({"is_error": False}, "Unknown command: /feature") is True
    assert is_zero_turn_failure({"is_error": False}, "all good") is False
