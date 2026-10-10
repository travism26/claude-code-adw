#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pytest"]
# ///

"""Tests for pipelines/gates.py — gate resolution (docs/slim-pipelines-plan.md §6.3).

Usage:
    uv run pytest adws/adw_tests/test_pipeline_gates.py -q

Credential-free, no network, no real npm/mvn/gradle/cargo/go executions:
resolution is pure file inspection, and gate *commands* are never invoked
here — only resolved and inspected. Covers:

1. adw_gates.json parsing: file order preserved, slow flag honored, timeout
   defaults (300 fast / 1800 slow), explicit timeout_s honored regardless of
   default.
2. Malformed adw_gates.json fails closed with GateConfigError — it must
   NEVER silently fall through to auto-detect.
3. Auto-detect per ecosystem fixture (package.json / pom.xml /
   pyproject.toml), and the load-bearing rule that auto-detect NEVER
   produces a slow gate.
4. Empty dir -> [] (with a logged "0 gates configured" warning).
5. adw_gates.json wins over auto-detect when both are present in the same
   directory.
6. --print-gates CLI: exit 0 for zero gates, exit 1 for GateConfigError.
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from pipelines.gates import resolve_gates, GateConfigError  # noqa: E402

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures" / "gates"
GATES_SCRIPT = REPO_ROOT / "adws" / "pipelines" / "gates.py"


def _write_config(tmp_path: Path, payload) -> Path:
    config_path = tmp_path / "adw_gates.json"
    if isinstance(payload, str):
        config_path.write_text(payload)
    else:
        config_path.write_text(json.dumps(payload))
    return config_path


# --- (a) adw_gates.json parsing ---------------------------------------------


def test_config_gates_parsed_in_file_order(tmp_path):
    _write_config(
        tmp_path,
        {
            "gates": [
                {"name": "unit", "command": "mvn -q test"},
                {"name": "compile", "command": "mvn -q -DskipTests compile"},
            ]
        },
    )
    gates = resolve_gates(tmp_path)
    assert [g.name for g in gates] == ["unit", "compile"]


def test_config_slow_flag_and_default_timeouts(tmp_path):
    _write_config(
        tmp_path,
        {
            "gates": [
                {"name": "compile", "command": "mvn -q -DskipTests compile"},
                {"name": "integration", "command": "mvn -q verify", "slow": True},
            ]
        },
    )
    gates = resolve_gates(tmp_path)
    fast, slow = gates[0], gates[1]

    assert fast.slow is False
    assert fast.timeout_s == 300

    assert slow.slow is True
    assert slow.timeout_s == 1800


def test_config_explicit_timeout_honored(tmp_path):
    _write_config(
        tmp_path,
        {
            "gates": [
                {"name": "compile", "command": "mvn -q -DskipTests compile", "timeout_s": 45},
                {
                    "name": "integration",
                    "command": "mvn -q verify",
                    "slow": True,
                    "timeout_s": 900,
                },
            ]
        },
    )
    gates = resolve_gates(tmp_path)
    assert gates[0].timeout_s == 45
    assert gates[1].timeout_s == 900


def test_config_java_example_from_plan(tmp_path):
    """The exact example from plan §6.3 (mirrors evals/target_java's real file)."""
    _write_config(
        tmp_path,
        {
            "gates": [
                {"name": "compile", "command": "mvn -q -DskipTests compile"},
                {"name": "unit", "command": "mvn -q test -DskipITs"},
                {
                    "name": "integration",
                    "command": "mvn -q verify",
                    "slow": True,
                    "timeout_s": 1800,
                },
            ]
        },
    )
    gates = resolve_gates(tmp_path)
    assert len(gates) == 3
    assert [g.slow for g in gates] == [False, False, True]
    assert [g.timeout_s for g in gates] == [300, 300, 1800]


# --- (b) malformed adw_gates.json -> GateConfigError, never auto-detect ----


def test_malformed_json_syntax_raises(tmp_path):
    _write_config(tmp_path, "{not valid json,,,")
    with pytest.raises(GateConfigError):
        resolve_gates(tmp_path)


def test_missing_gates_key_raises(tmp_path):
    _write_config(tmp_path, {"not_gates": []})
    with pytest.raises(GateConfigError):
        resolve_gates(tmp_path)


def test_gates_not_a_list_raises(tmp_path):
    _write_config(tmp_path, {"gates": "nope"})
    with pytest.raises(GateConfigError):
        resolve_gates(tmp_path)


def test_gate_entry_missing_command_raises(tmp_path):
    _write_config(tmp_path, {"gates": [{"name": "lint"}]})
    with pytest.raises(GateConfigError):
        resolve_gates(tmp_path)


def test_gate_entry_missing_name_raises(tmp_path):
    _write_config(tmp_path, {"gates": [{"command": "echo hi"}]})
    with pytest.raises(GateConfigError):
        resolve_gates(tmp_path)


def test_gate_entry_bad_slow_type_raises(tmp_path):
    _write_config(tmp_path, {"gates": [{"name": "lint", "command": "echo hi", "slow": "yes"}]})
    with pytest.raises(GateConfigError):
        resolve_gates(tmp_path)


def test_malformed_config_does_not_fall_back_to_autodetect(tmp_path):
    """A repo with BOTH a broken adw_gates.json and an auto-detectable
    package.json must still raise — never silently degrade to auto-detect."""
    _write_config(tmp_path, "{{{ garbage")
    shutil.copy(FIXTURES_DIR / "package.json", tmp_path / "package.json")
    with pytest.raises(GateConfigError):
        resolve_gates(tmp_path)


# --- (c) auto-detect per fixture, and the "no slow gates" load-bearing rule


def test_autodetect_npm_only_existing_scripts_no_typecheck(tmp_path):
    shutil.copy(FIXTURES_DIR / "package.json", tmp_path / "package.json")
    # No tsconfig.json dropped here -> typecheck script exists but must NOT
    # be prepended (both conditions are required).
    gates = resolve_gates(tmp_path)
    names = [g.name for g in gates]
    assert names == ["lint", "format", "test"]
    assert all(g.slow is False for g in gates)


def test_autodetect_npm_prepends_typecheck_when_tsconfig_present(tmp_path):
    shutil.copy(FIXTURES_DIR / "package.json", tmp_path / "package.json")
    (tmp_path / "tsconfig.json").write_text("{}")
    gates = resolve_gates(tmp_path)
    names = [g.name for g in gates]
    assert names[0] == "typecheck"
    assert names == ["typecheck", "lint", "format", "test"]
    assert gates[0].command == "npm run --silent typecheck"


def test_autodetect_npm_skips_missing_scripts(tmp_path):
    (tmp_path / "package.json").write_text(json.dumps({"scripts": {"lint": "eslint ."}}))
    gates = resolve_gates(tmp_path)
    assert [g.name for g in gates] == ["lint"]
    assert gates[0].command == "npm run --silent lint"


def test_autodetect_pom_xml_compile_and_unit(tmp_path):
    shutil.copy(FIXTURES_DIR / "pom.xml", tmp_path / "pom.xml")
    gates = resolve_gates(tmp_path)
    assert [g.name for g in gates] == ["compile", "unit"]
    assert gates[0].command == "mvn -q -DskipTests compile"
    assert gates[1].command == "mvn -q test"
    assert all(g.slow is False for g in gates)


def test_autodetect_pyproject_ruff_and_pytest(tmp_path):
    shutil.copy(FIXTURES_DIR / "pyproject.toml", tmp_path / "pyproject.toml")
    gates = resolve_gates(tmp_path)
    assert [g.name for g in gates] == ["lint", "unit"]
    assert gates[0].command == "uv run ruff check ."
    assert gates[1].command == "uv run pytest -q"


def test_autodetect_pyproject_tests_dir_without_pytest_config(tmp_path):
    (tmp_path / "pyproject.toml").write_text('[project]\nname = "x"\n')
    (tmp_path / "tests").mkdir()
    gates = resolve_gates(tmp_path)
    assert [g.name for g in gates] == ["unit"]


def test_autodetect_gradle_compile_and_unit(tmp_path):
    (tmp_path / "build.gradle").write_text("// stub")
    gates = resolve_gates(tmp_path)
    assert [g.name for g in gates] == ["compile", "unit"]
    assert all(g.slow is False for g in gates)


def test_autodetect_cargo_lint_and_unit(tmp_path):
    (tmp_path / "Cargo.toml").write_text("[package]\nname = \"x\"\n")
    gates = resolve_gates(tmp_path)
    assert [g.name for g in gates] == ["lint", "unit"]
    assert gates[0].command == "cargo clippy"
    assert gates[1].command == "cargo test"


def test_autodetect_go_lint_and_unit(tmp_path):
    (tmp_path / "go.mod").write_text("module example.com/x\n\ngo 1.22\n")
    gates = resolve_gates(tmp_path)
    assert [g.name for g in gates] == ["lint", "unit"]
    assert gates[0].command == "go vet ./..."
    assert gates[1].command == "go test ./..."


def test_autodetect_never_produces_slow_gates(tmp_path):
    """Load-bearing: no auto-detect profile may ever emit a slow gate."""
    fixtures = [
        ("package.json", FIXTURES_DIR / "package.json"),
        ("pom.xml", FIXTURES_DIR / "pom.xml"),
        ("pyproject.toml", FIXTURES_DIR / "pyproject.toml"),
    ]
    for filename, src in fixtures:
        repo = tmp_path / filename.replace(".", "_")
        repo.mkdir()
        shutil.copy(src, repo / filename)
        gates = resolve_gates(repo)
        assert gates, f"expected {filename} fixture to resolve at least one gate"
        assert all(g.slow is False for g in gates), f"{filename} auto-detect produced a slow gate"


# --- (d) empty dir -> [] -----------------------------------------------------


def test_empty_dir_returns_no_gates(tmp_path):
    assert resolve_gates(tmp_path) == []


def test_empty_dir_logs_loud_warning(tmp_path, caplog):
    import logging

    with caplog.at_level(logging.WARNING):
        resolve_gates(tmp_path)
    assert any("0 gates configured" in rec.message for rec in caplog.records)


# --- (e) adw_gates.json wins over auto-detect --------------------------------


def test_config_wins_over_autodetect_when_both_present(tmp_path):
    shutil.copy(FIXTURES_DIR / "package.json", tmp_path / "package.json")
    _write_config(tmp_path, {"gates": [{"name": "only-this", "command": "echo only-this"}]})
    gates = resolve_gates(tmp_path)
    assert [g.name for g in gates] == ["only-this"]


# --- (e2) relative --gates config resolves against repo_dir, not cwd --------


def test_relative_config_file_resolves_against_repo_dir_not_cwd(tmp_path, monkeypatch):
    """A relative --gates value must be joined to repo_dir — not looked up
    in whatever directory the process happens to be running from."""
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    (repo_dir / "custom_gates.json").write_text(
        json.dumps({"gates": [{"name": "from-repo-dir", "command": "true"}]})
    )

    other_cwd = tmp_path / "elsewhere"
    other_cwd.mkdir()
    monkeypatch.chdir(other_cwd)

    gates = resolve_gates(repo_dir, config_file="custom_gates.json")
    assert [g.name for g in gates] == ["from-repo-dir"]


def test_relative_config_file_repo_dir_wins_over_decoy_in_cwd(tmp_path, monkeypatch):
    """A same-named decoy file sitting in the process cwd must never shadow
    the real one under repo_dir."""
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    (repo_dir / "custom_gates.json").write_text(
        json.dumps({"gates": [{"name": "real-gate", "command": "true"}]})
    )

    other_cwd = tmp_path / "elsewhere"
    other_cwd.mkdir()
    (other_cwd / "custom_gates.json").write_text(
        json.dumps({"gates": [{"name": "decoy-gate", "command": "true"}]})
    )
    monkeypatch.chdir(other_cwd)

    gates = resolve_gates(repo_dir, config_file="custom_gates.json")
    assert [g.name for g in gates] == ["real-gate"]


# --- (f) --print-gates CLI ---------------------------------------------------


def test_cli_print_gates_exit_zero_for_zero_gates(tmp_path):
    result = subprocess.run(
        [sys.executable, str(GATES_SCRIPT), "--print-gates", "--working-dir", str(tmp_path)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    assert "0 gates configured" in result.stdout


def test_cli_print_gates_exit_one_for_malformed_config(tmp_path):
    _write_config(tmp_path, "{{{ garbage")
    result = subprocess.run(
        [sys.executable, str(GATES_SCRIPT), "--print-gates", "--working-dir", str(tmp_path)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert "GateConfigError" in result.stderr


def test_cli_print_gates_lists_each_gate_with_source(tmp_path):
    shutil.copy(FIXTURES_DIR / "pom.xml", tmp_path / "pom.xml")
    result = subprocess.run(
        [sys.executable, str(GATES_SCRIPT), "--print-gates", "--working-dir", str(tmp_path)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    assert "compile" in result.stdout
    assert "unit" in result.stdout
    assert "auto-detect:maven" in result.stdout
