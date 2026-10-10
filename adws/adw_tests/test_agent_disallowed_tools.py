#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv"]
# ///

"""Tests for adw_modules.agent.disallowed_tools_args — the --disallowedTools
passthrough (read-only lens scoping for the incident pipeline's lenses).

Usage:
    uv run pytest adws/adw_tests/test_agent_disallowed_tools.py -q
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from adw_modules.agent import AgentPromptRequest, disallowed_tools_args  # noqa: E402


def _req(**kwargs) -> AgentPromptRequest:
    return AgentPromptRequest(
        prompt="p", adw_id="a", output_file="/tmp/x.jsonl", **kwargs
    )


def test_unset_yields_no_args():
    assert disallowed_tools_args(_req()) == []


def test_empty_list_yields_no_args():
    assert disallowed_tools_args(_req(disallowed_tools=[])) == []


def test_tools_join_into_one_flag_value():
    args = disallowed_tools_args(
        _req(disallowed_tools=["Edit", "Write", "NotebookEdit", "Bash"])
    )
    assert args == ["--disallowedTools", "Edit,Write,NotebookEdit,Bash"]


def test_blank_and_whitespace_names_filtered():
    args = disallowed_tools_args(_req(disallowed_tools=["  Edit ", "", "  "]))
    assert args == ["--disallowedTools", "Edit"]


def test_all_blank_yields_no_args():
    assert disallowed_tools_args(_req(disallowed_tools=["", "  "])) == []
