#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pydantic", "python-dotenv"]
# ///

"""
Test travis_test.py:parse_test_results — the fail-closed parse boundary.

Usage:
    uv run pytest adws/adw_tests/test_travis_test_parsing.py -q

Credential-free (no Claude calls): imports parse_test_results directly and
feeds it raw strings, and monkeypatches run_tests to exercise the retry loop.
Verifies:

1. Unparseable /test output returns None (fail closed) rather than the old
   ([], 0, 0), which a caller could mistake for "0 tests, all passed".
2. A valid JSON array of TestResult objects parses into the correct
   (results, passed_count, failed_count).
3. A valid but empty JSON array is a legitimate success — ([], 0, 0) — and
   must stay distinguishable from the unparseable case (None).
4. A /test agent that fails to execute (success=False) on every attempt
   fails closed too: run_tests_with_resolution retries up to max_retries
   then returns None, without ever entering per-test resolution.
"""

import logging
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from travis import travis_test
from travis.travis_test import parse_test_results
from adw_modules.data_types import AgentPromptResponse

LOGGER = logging.getLogger("test_travis_test_parsing")

VALID_RESULTS_JSON = """
[
  {
    "test_name": "test_addition",
    "passed": true,
    "execution_command": "pytest test_math.py::test_addition",
    "test_purpose": "Verify addition works"
  },
  {
    "test_name": "test_subtraction",
    "passed": false,
    "execution_command": "pytest test_math.py::test_subtraction",
    "test_purpose": "Verify subtraction works",
    "error": "AssertionError: 2 - 1 != 3"
  },
  {
    "test_name": "test_multiplication",
    "passed": true,
    "execution_command": "pytest test_math.py::test_multiplication",
    "test_purpose": "Verify multiplication works"
  }
]
"""


def test_garbage_input_returns_none():
    """Unparseable output must fail closed: None, never ([], 0, 0)."""
    result = parse_test_results("this is not json at all {{{", LOGGER)
    assert result is None


def test_valid_results_parse_with_correct_counts():
    """A valid JSON array parses into the right pass/fail counts."""
    result = parse_test_results(VALID_RESULTS_JSON, LOGGER)
    assert result is not None

    results, passed_count, failed_count = result
    assert len(results) == 3
    assert passed_count == 2
    assert failed_count == 1
    assert [t.test_name for t in results] == [
        "test_addition",
        "test_subtraction",
        "test_multiplication",
    ]
    assert results[1].error == "AssertionError: 2 - 1 != 3"


def test_empty_array_is_legitimate_success_not_none():
    """An empty JSON array is a real ([], 0, 0) success, distinct from None."""
    result = parse_test_results("[]", LOGGER)
    assert result is not None

    results, passed_count, failed_count = result
    assert results == []
    assert passed_count == 0
    assert failed_count == 0


def test_failed_test_agent_fails_closed_without_resolution(monkeypatch):
    """A /test agent that never executes successfully must fail closed.

    run_tests_with_resolution should retry the /test agent up to
    max_retries and, once exhausted, return None — never entering
    per-test resolution (there's nothing parsed to resolve).
    """

    def always_failing_run_tests(*args, **kwargs):
        return AgentPromptResponse(output="agent crashed", success=False)

    def resolve_failed_test_should_not_be_called(*args, **kwargs):
        raise AssertionError(
            "resolve_failed_test must not be called when the /test agent "
            "itself failed to execute"
        )

    monkeypatch.setattr(travis_test, "run_tests", always_failing_run_tests)
    monkeypatch.setattr(
        travis_test, "resolve_failed_test", resolve_failed_test_should_not_be_called
    )

    result = travis_test.run_tests_with_resolution(
        "test-adw-id", LOGGER, max_retries=2, working_dir="."
    )

    assert result is None
