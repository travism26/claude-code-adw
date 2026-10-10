#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest", "pydantic", "python-dotenv"]
# ///

"""Tests for adw_modules.github.extract_repo_path — PR #10 review follow-up:
the helper only understood https:// GitHub URLs, so an SSH origin
(git@github.com:owner/repo.git) produced a malformed owner/repo and factory
--issue intake died with a raw gh error.

Usage:
    uv run pytest adws/adw_tests/test_repo_path.py -q
"""

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from adw_modules.github import extract_repo_path  # noqa: E402


@pytest.mark.parametrize("url", [
    "https://github.com/acme/widgets",
    "https://github.com/acme/widgets.git",
    "https://github.com/acme/widgets/",
    "http://github.com/acme/widgets.git",
    "git@github.com:acme/widgets.git",
    "git@github.com:acme/widgets",
    "ssh://git@github.com/acme/widgets.git",
    "  https://github.com/acme/widgets.git\n",
])
def test_all_github_remote_forms_yield_owner_repo(url):
    assert extract_repo_path(url) == "acme/widgets"


def test_dot_git_is_only_stripped_as_a_suffix():
    # A repo legitimately containing ".git" mid-name must survive (the old
    # .replace(".git", "") implementation would have mangled it).
    assert extract_repo_path("https://github.com/acme/my.github.io") == "acme/my.github.io"


def test_unrecognized_url_passes_through_minus_git_suffix():
    # Previous behavior for non-GitHub input, preserved for the other callers.
    assert extract_repo_path("https://gitlab.example.com/acme/widgets.git") == (
        "https://gitlab.example.com/acme/widgets"
    )
