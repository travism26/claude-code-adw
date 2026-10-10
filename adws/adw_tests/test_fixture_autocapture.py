#!/usr/bin/env -S uv run
# /// script
# dependencies = []
# ///

"""
Test fixture auto-capture — autocapture_phase_failure().

Usage:
    uv run adws/adw_tests/test_fixture_autocapture.py

Verifies, against a throwaway temp tree (no repo pollution):
1. A failing phase with raw agent I/O produces a fixture dir + pytest stub.
2. The MANIFEST records the phase/reason; the stub is skip-marked.
3. Per-run dedup: a second identical capture returns None.
4. No agent dir → None (never raises).
5. Agent-scoped search picks the right subdir's artifacts.
"""

import sys
import os
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from adw_modules import fixture_capture as fc


def _redirect_roots(base: Path) -> None:
    """Point the module's path constants at a temp tree."""
    fc.AGENTS_ROOT = base / "agents"
    fc.FIXTURE_ROOT = base / "tests" / "fixtures" / "regression"
    fc.TEST_ROOT = base / "tests" / "regression"
    fc.REPO_ROOT = base
    fc._AUTOCAPTURED.clear()


def _make_run(base: Path, adw_id: str, agent: str) -> None:
    d = base / "agents" / adw_id / agent
    d.mkdir(parents=True, exist_ok=True)
    (d / "cc_raw_output.jsonl").write_text('{"type":"result","output":"boom"}\n', encoding="utf-8")
    (d / "agent_output.txt").write_text("unparseable LLM output {", encoding="utf-8")


def main() -> None:
    failures = []

    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp)
        _redirect_roots(base)
        _make_run(base, "abc12345", "builder")

        # 1. capture produces fixture + stub
        result = fc.autocapture_phase_failure("abc12345", "build", returncode=1)
        if result is None:
            failures.append("expected a capture result, got None")
        else:
            fixture_dir, test_file = result
            if not fixture_dir.is_dir():
                failures.append(f"fixture dir not created: {fixture_dir}")
            if not test_file.is_file():
                failures.append(f"test stub not created: {test_file}")
            if not (fixture_dir / "MANIFEST.md").is_file():
                failures.append("MANIFEST.md not written")
            else:
                manifest = (fixture_dir / "MANIFEST.md").read_text()
                if "build" not in manifest:
                    failures.append("manifest missing phase name")
            # captured both artifacts
            if not (fixture_dir / "cc_raw_output.jsonl").is_file():
                failures.append("cc_raw_output.jsonl not copied")
            if not (fixture_dir / "agent_output.txt").is_file():
                failures.append("agent_output.txt not copied")
            # slug == build-exit-1 → module name test_build_exit_1.py
            if test_file.name != "test_build_exit_1.py":
                failures.append(f"unexpected stub name: {test_file.name}")
            stub = test_file.read_text()
            if "@pytest.mark.skip" not in stub:
                failures.append("replay stub is not skip-marked")

        # 2. dedup — same (adw_id, slug) returns None second time
        if fc.autocapture_phase_failure("abc12345", "build", returncode=1) is not None:
            failures.append("expected None on duplicate capture (per-run dedup)")

        # 3. a different reason is a distinct slug → captures
        if fc.autocapture_phase_failure("abc12345", "build", reason="parser-crash") is None:
            failures.append("distinct reason should produce a new capture")

    # 4. missing agent dir → None, no raise
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp)
        _redirect_roots(base)
        (base / "agents").mkdir(parents=True)
        if fc.autocapture_phase_failure("nope0000", "build", returncode=2) is not None:
            failures.append("expected None when agent dir absent")

    # 5. agent-scoped search isolates the right subdir
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp)
        _redirect_roots(base)
        _make_run(base, "scoped01", "validator")
        result = fc.autocapture_phase_failure(
            "scoped01", "validate", reason="validator-output-unparseable", agent="validator"
        )
        if result is None:
            failures.append("agent-scoped capture returned None")
        else:
            fixture_dir, _ = result
            if not (fixture_dir / "cc_raw_output.jsonl").is_file():
                failures.append("scoped capture missing validator artifact")

    if failures:
        print("FAIL:")
        for f in failures:
            print(f"  - {f}")
        sys.exit(1)
    print("PASS: autocapture_phase_failure — all 5 checks green")
    sys.exit(0)


if __name__ == "__main__":
    main()
