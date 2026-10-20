#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest"]
# ///

"""Tests for .claude/hooks/verify_guard.py — the PreToolUse write guard that keeps
the `verifier` subagent (.claude/agents/verifier.md) writing only evidence.

Usage:
    uv run pytest adws/adw_tests/test_verify_guard.py -q

The guard is invoked as a subprocess with hook JSON on stdin, exactly as Claude
Code calls it, so the exit-code contract (0 allow, 2 block) is exercised end to
end. `cwd` is a throwaway tmp_path, so relative paths resolve inside it.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

GUARD = Path(__file__).resolve().parents[2] / ".claude" / "hooks" / "verify_guard.py"


def run_guard(tool_name, tool_input, cwd):
    payload = {"tool_name": tool_name, "tool_input": tool_input, "cwd": str(cwd),
               "hook_event_name": "PreToolUse"}
    return subprocess.run([sys.executable, str(GUARD)], input=json.dumps(payload),
                          capture_output=True, text=True)


def bash(command, cwd):
    return run_guard("Bash", {"command": command}, cwd)


@pytest.fixture
def repo(tmp_path):
    (tmp_path / ".verify" / "abc1234" / "evidence").mkdir(parents=True)
    (tmp_path / "tests").mkdir()
    return tmp_path


# --- file tools -----------------------------------------------------------

def test_write_inside_verify_allowed(repo):
    r = run_guard("Write", {"file_path": str(repo / ".verify/abc1234/report.json"), "content": "{}"}, repo)
    assert r.returncode == 0, r.stderr


@pytest.mark.parametrize("target", ["tests/test_x.py", "src/app.py", ".claude/skills/verify/SKILL.md",
                                    ".verify/../tests/test_x.py"])
def test_write_outside_verify_blocked(repo, target):
    r = run_guard("Write", {"file_path": str(repo / target), "content": "x"}, repo)
    assert r.returncode == 2
    assert "verify-guard: blocked" in r.stderr


def test_edit_test_file_blocked(repo):
    r = run_guard("Edit", {"file_path": str(repo / "tests/test_x.py"), "old_string": "a", "new_string": "b"}, repo)
    assert r.returncode == 2


def test_symlink_out_of_verify_blocked(repo):
    (repo / ".verify" / "escape").symlink_to(repo / "tests")
    r = run_guard("Write", {"file_path": str(repo / ".verify/escape/test_x.py"), "content": "x"}, repo)
    assert r.returncode == 2


def test_notebook_path_field_checked(repo):
    r = run_guard("NotebookEdit", {"notebook_path": str(repo / "nb.ipynb"), "new_source": "x"}, repo)
    assert r.returncode == 2


def test_missing_path_blocked(repo):
    assert run_guard("Write", {"content": "x"}, repo).returncode == 2


def test_malformed_stdin_fails_closed(repo):
    r = subprocess.run([sys.executable, str(GUARD)], input="not json", capture_output=True, text=True)
    assert r.returncode == 2


# --- Bash: what a verifier legitimately runs -----------------------------

@pytest.mark.parametrize("command", [
    "curl -sS -i http://127.0.0.1:8001/health > .verify/abc1234/evidence/c3.http",
    "curl -sS -o .verify/abc1234/evidence/c1.json http://127.0.0.1:8001/x",
    "cd adws && nohup uv run adw_triggers/trigger_webhook.py > ../.verify/abc1234/server.log 2>&1 &",
    "lsof -ti :8001",
    "kill 92793 92833",
    "git diff main...HEAD --stat",
    "git log -1 --format=%H",
    "git status --short",
    "uv run pytest -q 2>&1 | tail -5",
    "jq . .verify/abc1234/report.json",
    "grep -c ERROR .verify/abc1234/server.log",
    "mkdir -p .verify/abc1234/evidence",
    "E=.verify/abc1234/evidence; curl -sS localhost:1/x > $E/c1.http",
    "curl -s localhost:1 > /dev/null 2>&1",
    "echo hi > /tmp/scratch.txt",
    "python3 -c 'import json,sys; print(json.load(sys.stdin)[\"status\"])' < .verify/abc1234/report.json",
    "cat > .verify/abc1234/claims.md <<'EOF'\n- C1: thing > other\nEOF",
    "python3 - <<'EOF'\nimport json\nprint(1 > 0)\nEOF",
    "docker compose -f evals/docker-compose.backend.yml down --volumes",
])
def test_bash_verifier_commands_allowed(repo, command):
    r = bash(command, repo)
    assert r.returncode == 0, r.stderr


# --- Bash: the ways a shell edits the oracle ------------------------------

@pytest.mark.parametrize("command", [
    "echo 'assert True' > tests/test_x.py",
    "echo x >> tests/test_x.py",
    "printf x | tee tests/test_x.py",
    "sed -i '' 's/assert/# assert/' tests/test_x.py",
    "perl -pi -e 's/a/b/' tests/test_x.py",
    "rm tests/test_x.py",
    "mv tests/test_x.py tests/test_x.py.bak",
    "cp /tmp/loose.py tests/test_x.py",
    "touch tests/conftest.py",
    "git checkout -- tests/",
    "git restore tests/test_x.py",
    "git stash",
    "git commit -am wip",
    "git apply /tmp/patch.diff",
    "git branch -D main",
    "find tests -name '*.py' -delete",
    "python3 -c \"open('tests/test_x.py','w').write('')\"",
    "uv run python -c \"import pathlib; pathlib.Path('tests/x.py').write_text('')\"",
    "node -e \"require('fs').writeFileSync('tests/x.js','')\"",
    "bash -c 'echo x > tests/test_x.py'",
    "python3 - <<'EOF'\nopen('tests/test_x.py', 'w').write('')\nEOF",
    "bash <<'EOF'\necho x > tests/test_x.py\nEOF",
    "cat > tests/test_x.py <<'EOF'\nassert True\nEOF",
    "cd tests && echo x > test_x.py",
    "curl -sS -o tests/fixture.json http://x",
    "curl -O http://x/file.py",
    "echo x > $UNSET_GUARD_VAR/test_x.py",
    "ls; echo x > tests/test_x.py",
    "dd if=/dev/zero of=tests/test_x.py count=1",
    "echo 'unterminated",
])
def test_bash_oracle_writes_blocked(repo, command):
    r = bash(command, repo)
    assert r.returncode == 2, f"not blocked: {command!r}"
    assert "verify-guard: blocked" in r.stderr
