#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""Gate resolution for slim pipelines (docs/slim-pipelines-plan.md §6.3).

The build-loop engine (core.py) never learns a language — it only ever runs
an ordered list of named commands with a fast/slow flag. This module is the
one place that turns "what's in this repo" into that list, in priority
order:

  1. <repo_dir>/adw_gates.json — explicit, always wins. Malformed config
     raises GateConfigError; it never silently falls through to auto-detect
     (fail closed — a typo'd gate file should not quietly start guessing).
  2. Auto-detect, FAST GATES ONLY (never slow — see plan §6.3/§12: guessing
     at a command that boots Docker/testcontainers is how a run burns 20
     minutes on the wrong thing). Best-effort by design; wrong guesses fail
     loudly at gate-run time, and adw_gates.json is the override.
  3. Nothing detected -> [] plus a loud "0 gates configured" warning.

CLI:
    uv run adws/pipelines/gates.py --print-gates [--working-dir DIR]
"""

import json
import logging
import os
import sys
from pathlib import Path
from typing import Callable, List, Optional, Sequence, Tuple

# adws/pipelines/gates.py -> need "adws" on sys.path so `pipelines` resolves
# as a package (same sys.path.insert pattern adw_tests uses, just anchored
# from this file's own location so `uv run python adws/pipelines/gates.py`
# and pytest both work).
_ADWS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ADWS_DIR))

from pipelines.core import Gate  # noqa: E402  (see sys.path setup above)


class GateConfigError(Exception):
    """adw_gates.json exists but is malformed. Fail closed — never fall
    through to auto-detect on a broken explicit config."""


# --- auto-detect profiles ---------------------------------------------------
# Each profile: (name, marker filenames, detect_fn(repo_dir) -> list[Gate]).
# Auto-detect NEVER produces a slow gate — that's opt-in via adw_gates.json.


def _npm_gates(repo_dir: Path) -> List[Gate]:
    try:
        scripts = json.loads((repo_dir / "package.json").read_text()).get("scripts", {})
    except (OSError, json.JSONDecodeError):
        return []
    if not isinstance(scripts, dict):
        return []
    gates = []
    if (repo_dir / "tsconfig.json").exists() and "typecheck" in scripts:
        gates.append(Gate("typecheck", "npm run --silent typecheck"))
    for script in ("lint", "format", "test"):
        if script in scripts:
            gates.append(Gate(script, f"npm run --silent {script}"))
    return gates


def _python_gates(repo_dir: Path) -> List[Gate]:
    try:
        text = (repo_dir / "pyproject.toml").read_text()
    except OSError:
        return []
    gates = []
    if "ruff" in text:
        gates.append(Gate("lint", "uv run ruff check ."))
    if (repo_dir / "tests").is_dir() or "pytest" in text:
        gates.append(Gate("unit", "uv run pytest -q"))
    return gates


def _maven_gates(repo_dir: Path) -> List[Gate]:
    return [Gate("compile", "mvn -q -DskipTests compile"), Gate("unit", "mvn -q test")]


def _gradle_gates(repo_dir: Path) -> List[Gate]:
    return [Gate("compile", "gradle -q compileJava"), Gate("unit", "gradle -q test")]


def _cargo_gates(repo_dir: Path) -> List[Gate]:
    return [Gate("lint", "cargo clippy"), Gate("unit", "cargo test")]


def _go_gates(repo_dir: Path) -> List[Gate]:
    return [Gate("lint", "go vet ./..."), Gate("unit", "go test ./...")]


PROFILES: List[Tuple[str, Sequence[str], Callable[[Path], List[Gate]]]] = [
    ("npm", ("package.json",), _npm_gates),
    ("pyproject", ("pyproject.toml",), _python_gates),
    ("maven", ("pom.xml",), _maven_gates),
    ("gradle", ("build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"), _gradle_gates),
    ("cargo", ("Cargo.toml",), _cargo_gates),
    ("go", ("go.mod",), _go_gates),
]


def _auto_detect(repo_dir: Path) -> Tuple[List[Gate], str]:
    for profile_name, markers, detect_fn in PROFILES:
        if any((repo_dir / marker).exists() for marker in markers):
            gates = detect_fn(repo_dir)
            if gates:
                return gates, f"auto-detect:{profile_name}"
    return [], "none"


# --- adw_gates.json parsing --------------------------------------------------


def _parse_config(config_path: Path) -> List[Gate]:
    try:
        raw = json.loads(config_path.read_text())
    except (OSError, json.JSONDecodeError) as e:
        raise GateConfigError(f"{config_path}: could not read/parse JSON — {e}") from e

    if not isinstance(raw, dict) or "gates" not in raw:
        raise GateConfigError(f'{config_path}: missing top-level "gates" array')

    entries = raw["gates"]
    if not isinstance(entries, list):
        raise GateConfigError(f'{config_path}: "gates" must be a list')

    gates = []
    for i, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise GateConfigError(f"{config_path}: gates[{i}] must be an object")

        name = entry.get("name")
        if not isinstance(name, str) or not name:
            raise GateConfigError(f'{config_path}: gates[{i}] missing required "name"')

        command = entry.get("command")
        if not isinstance(command, str) or not command:
            raise GateConfigError(f'{config_path}: gates[{i}] missing required "command"')

        slow = entry.get("slow", False)
        if not isinstance(slow, bool):
            raise GateConfigError(f'{config_path}: gates[{i}].slow must be a boolean')

        timeout_s = entry.get("timeout_s")
        if timeout_s is not None and not isinstance(timeout_s, int):
            raise GateConfigError(f'{config_path}: gates[{i}].timeout_s must be an integer')
        if timeout_s is None:
            timeout_s = 1800 if slow else 300

        gates.append(Gate(name=name, command=command, slow=slow, timeout_s=timeout_s))

    return gates


# --- public resolution API ---------------------------------------------------


def _resolve(repo_dir: Path, config_file: Optional[Path] = None) -> Tuple[List[Gate], str]:
    """Returns (gates, source). source is one of "adw_gates.json",
    the resolved config_file path (as str), "auto-detect:<profile>", or
    "none". Raises GateConfigError on a malformed adw_gates.json (fail
    closed — never falls through to auto-detect in that case).

    When `config_file` is given, it wins outright and is parsed directly
    (same schema/fail-closed semantics as adw_gates.json) instead of
    looking for <repo_dir>/adw_gates.json — a missing or malformed
    explicit file is itself a config error, never silently treated as
    "no config" (still fail closed, just against a caller-chosen path;
    see pipelines/pipe_chore.py's --gates flag). A relative config_file is
    resolved against repo_dir, never the process cwd (a same-named file
    sitting in whatever directory the caller happened to be run from must
    never shadow the intended one)."""
    if config_file is not None:
        if not config_file.is_absolute():
            config_file = repo_dir / config_file
        return _parse_config(config_file), str(config_file)

    config_path = repo_dir / "adw_gates.json"
    if config_path.exists():
        return _parse_config(config_path), "adw_gates.json"

    gates, source = _auto_detect(repo_dir)
    if not gates:
        logging.warning("0 gates configured for %s (source=%s)", repo_dir, source)
    return gates, source


def resolve_gates(repo_dir, config_file=None) -> List[Gate]:
    """Resolve the ordered list of Gates for repo_dir. See module docstring
    for priority order. Raises GateConfigError on a malformed
    adw_gates.json.

    config_file: optional explicit path (str or Path) to a gate config
    JSON, parsed with the same schema/fail-closed semantics as
    adw_gates.json, in place of <repo_dir>/adw_gates.json. Backward
    compatible — omitted or None preserves prior behavior exactly."""
    resolved_config_file = Path(config_file) if config_file is not None else None
    gates, _source = _resolve(Path(repo_dir), resolved_config_file)
    return gates


# --- CLI ---------------------------------------------------------------------


def _print_gates(working_dir: str) -> int:
    repo_dir = Path(working_dir).resolve()
    try:
        gates, source = _resolve(repo_dir)
    except GateConfigError as e:
        print(f"GateConfigError: {e}", file=sys.stderr)
        return 1

    if not gates:
        print(f"0 gates configured (source={source}, dir={repo_dir})")
        return 0

    for g in gates:
        speed = "slow" if g.slow else "fast"
        print(f"{g.name} | {speed} | timeout_s={g.timeout_s} | {g.command} | source={source}")
    return 0


def main() -> None:
    args = sys.argv[1:]
    if "--print-gates" not in args:
        print(
            "Usage: uv run adws/pipelines/gates.py --print-gates [--working-dir DIR]",
            file=sys.stderr,
        )
        sys.exit(1)

    working_dir = "."
    if "--working-dir" in args:
        idx = args.index("--working-dir")
        if idx + 1 >= len(args):
            print("Error: --working-dir requires a value", file=sys.stderr)
            sys.exit(1)
        working_dir = args[idx + 1]

    sys.exit(_print_gates(working_dir))


if __name__ == "__main__":
    main()
