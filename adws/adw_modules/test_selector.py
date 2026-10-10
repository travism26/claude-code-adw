#!/usr/bin/env python3
"""Intelligent test selection based on changed files.

This module analyzes git changes and determines which tests should be run
based on per-project module mappings. It supports:
- Module-based selection (balanced approach)
- Core file detection (triggers full test suite)
- Git diff analysis (compares to specified base)
- Structured test execution plans

Usage:
    from adw_modules.test_selector import get_affected_tests

    test_plan = get_affected_tests(diff_base="origin/main")
    # Returns TestPlan with pytest_commands to run
"""

import subprocess
from dataclasses import dataclass, field
from typing import Any, List, Set
import re


@dataclass
class TestPlan:
    """Test execution plan with selected tests and reasoning."""

    pytest_commands: List[str] = field(default_factory=list)
    """Test commands to run (e.g., 'pytest tests/integration/test_pipeline.py -v')"""

    selection_strategy: str = "none"
    """Strategy used: 'full_suite', 'module_based', 'no_changes', 'docs_only'"""

    reason: str = ""
    """Human-readable reason for the selection"""

    changed_files: List[str] = field(default_factory=list)
    """List of changed files that triggered this plan"""

    affected_modules: Set[str] = field(default_factory=set)
    """Set of module names affected by changes"""

    def is_full_suite(self) -> bool:
        """Returns True if full test suite should be run."""
        return self.selection_strategy == "full_suite"

    def has_tests(self) -> bool:
        """Returns True if any tests are selected."""
        return len(self.pytest_commands) > 0


# ---------------------------------------------------------------------------
# PER-PROJECT CONFIGURATION
# Customize these for your project (the /install-adw command can do this for
# you by detecting your project layout and test framework).
# ---------------------------------------------------------------------------

# Command that runs the full test suite (used for full_suite strategy)
FULL_SUITE_COMMAND = "pytest -v"

# Core files that trigger full test suite when changed
CORE_FILES_PATTERNS = [
    # Project application core — add your project's critical paths here, e.g.:
    # r"src/myapp/config\.py",
    # r"src/myapp/engine/",

    # ADW core modules
    r"adws/adw_modules/agent\.py",
    r"adws/adw_modules/agent_sdk\.py",
    r"adws/adw_modules/data_types\.py",
    r"adws/adw_modules/state\.py",

    # Package configuration
    r"pyproject\.toml",
    r"setup\.cfg",
    r"requirements.*\.txt",
    r"\.env\.sample",
]


# Module mapping: source file patterns -> test commands.
# Add one entry per logical module in your project, e.g.:
#   "api": {
#       "source_patterns": [r"src/myapp/api/"],
#       "pytest_commands": ["pytest tests/api/ -v"],
#       "is_core": False,
#   },
MODULE_MAPPINGS: dict[str, dict[str, Any]] = {
    "adw_harness": {
        "source_patterns": [
            r"adws/travis/",
            r"adws/adw_modules/workflow_ops\.py",
            r"adws/adw_modules/git_ops\.py",
            r"adws/adw_modules/utils\.py",
            r"adws/adw_modules/worktree_ops\.py",
            r"adws/adw_modules/github\.py",
            r"adws/adw_modules/r2_uploader\.py",
        ],
        "pytest_commands": [
            "pytest adws/adw_tests/test_agents.py adws/adw_tests/test_model_selection.py -v",
        ],
        "is_core": False,
    },
}


def get_changed_files(diff_base: str = "origin/main") -> List[str]:
    """Get list of changed files from git diff.

    Args:
        diff_base: Git reference to compare against (default: origin/main)

    Returns:
        List of changed file paths relative to repo root
    """
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", diff_base],
            capture_output=True,
            text=True,
            check=True,
        )

        changed = result.stdout.strip().split("\n") if result.stdout.strip() else []

        # Also include staged files
        result_staged = subprocess.run(
            ["git", "diff", "--name-only", "--cached"],
            capture_output=True,
            text=True,
            check=True,
        )

        staged = result_staged.stdout.strip().split("\n") if result_staged.stdout.strip() else []

        # Combine and deduplicate
        all_changed = list(set(changed + staged))

        return [f for f in all_changed if f]  # Filter empty strings

    except subprocess.CalledProcessError as e:
        print(f"Error getting changed files: {e}")
        return []


def is_core_file(file_path: str) -> bool:
    """Check if file is a core file that triggers full test suite."""
    for pattern in CORE_FILES_PATTERNS:
        if re.search(pattern, file_path):
            return True
    return False


def is_docs_only(changed_files: List[str]) -> bool:
    """Return True if all changed files are docs/specs — no code changed."""
    docs_patterns = [r"^docs/", r"^specs/", r"\.md$", r"^\.claude/commands/"]
    return all(
        any(re.search(p, f) for p in docs_patterns)
        for f in changed_files
    )


def get_affected_modules(changed_files: List[str]) -> Set[str]:
    """Map changed files to affected modules."""
    affected = set()

    for file_path in changed_files:
        for module_name, module_config in MODULE_MAPPINGS.items():
            for pattern in module_config["source_patterns"]:
                if re.search(pattern, file_path):
                    affected.add(module_name)
                    break

    return affected


def build_test_plan(
    changed_files: List[str],
    affected_modules: Set[str],
    force_full_suite: bool = False
) -> TestPlan:
    """Build test execution plan based on affected modules."""
    plan = TestPlan(
        changed_files=changed_files,
        affected_modules=affected_modules,
    )

    # No changes detected
    if not changed_files:
        plan.selection_strategy = "no_changes"
        plan.reason = "No files changed — no tests to run"
        return plan

    # Force full suite
    if force_full_suite:
        plan.selection_strategy = "full_suite"
        plan.reason = "Full test suite requested via --run-all-tests flag"
        plan.pytest_commands = [FULL_SUITE_COMMAND]
        return plan

    # Docs/specs only — no code changed
    if is_docs_only(changed_files):
        plan.selection_strategy = "docs_only"
        plan.reason = "Only docs/specs changed — no tests needed"
        return plan

    # Check for core file changes
    core_files = [f for f in changed_files if is_core_file(f)]
    if core_files:
        plan.selection_strategy = "full_suite"
        plan.reason = f"Core files changed: {', '.join(core_files[:3])}{'...' if len(core_files) > 3 else ''}"
        plan.pytest_commands = [FULL_SUITE_COMMAND]
        return plan

    # Check for core modules
    core_modules = [m for m in affected_modules if MODULE_MAPPINGS.get(m, {}).get("is_core", False)]
    if core_modules:
        plan.selection_strategy = "full_suite"
        plan.reason = f"Core modules changed: {', '.join(core_modules)}"
        plan.pytest_commands = [FULL_SUITE_COMMAND]
        return plan

    # Three or more scopes simultaneously → full suite
    if len(affected_modules) >= 3:
        plan.selection_strategy = "full_suite"
        plan.reason = f"3+ modules changed ({', '.join(sorted(affected_modules))}) — full suite safer"
        plan.pytest_commands = [FULL_SUITE_COMMAND]
        return plan

    # Module-based selection
    if affected_modules:
        plan.selection_strategy = "module_based"
        plan.reason = f"Modules changed: {', '.join(sorted(affected_modules))}"

        # Collect unique pytest commands
        cmds: set = set()
        for module_name in affected_modules:
            if module_name in MODULE_MAPPINGS:
                cmds.update(MODULE_MAPPINGS[module_name].get("pytest_commands", []))

        plan.pytest_commands = sorted(list(cmds))
        return plan

    # Unknown changes — full suite to be safe
    plan.selection_strategy = "full_suite"
    plan.reason = f"Unrecognized file changes: {', '.join(changed_files[:3])}{'...' if len(changed_files) > 3 else ''}"
    plan.pytest_commands = [FULL_SUITE_COMMAND]
    return plan


def get_affected_tests(
    diff_base: str = "origin/main",
    force_full_suite: bool = False
) -> TestPlan:
    """Main entry point: analyze changes and return test execution plan.

    Args:
        diff_base: Git reference to compare against (default: origin/main)
        force_full_suite: If True, force running all tests

    Returns:
        TestPlan with selected pytest commands and reasoning

    Example:
        >>> plan = get_affected_tests()
        >>> print(plan.reason)
        'Modules changed: api'
        >>> print(plan.pytest_commands)
        ['pytest tests/api/ -v']
    """
    changed_files = get_changed_files(diff_base)
    affected_modules = get_affected_modules(changed_files)
    return build_test_plan(changed_files, affected_modules, force_full_suite)


# CLI interface
if __name__ == "__main__":
    import sys

    diff_base = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
    force_full = "--run-all-tests" in sys.argv

    plan = get_affected_tests(diff_base, force_full)

    print(f"\n{'='*60}")
    print("Test Selection Plan")
    print(f"{'='*60}")
    print(f"Strategy:  {plan.selection_strategy}")
    print(f"Reason:    {plan.reason}")
    print(f"\nChanged files ({len(plan.changed_files)}):")
    for f in plan.changed_files[:10]:
        print(f"  - {f}")
    if len(plan.changed_files) > 10:
        print(f"  ... and {len(plan.changed_files) - 10} more")

    print(f"\nAffected modules: {', '.join(sorted(plan.affected_modules)) if plan.affected_modules else 'none'}")

    print(f"\nTest commands ({len(plan.pytest_commands)}):")
    for cmd in plan.pytest_commands:
        print(f"  $ {cmd}")

    print(f"\n{'='*60}\n")
