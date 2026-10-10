"""Regression-fixture capture helper.

Used by the /capture_fixture slash command to turn a real-world pipeline
break into a permanent regression guard. Given an adw_id, a slug, and a
list of source files inside agents/{adw_id}/, copies them into
tests/fixtures/regression/{adw_id}_{slug}/ and writes a MANIFEST.md
describing what broke. Also emits a pytest stub under
tests/regression/test_{slug}.py the operator can then fill in.

Usage (CLI):
    uv run .adw/adw_modules/fixture_capture.py <adw_id> <slug> \
        --description "phase X failed parsing INPUT_ABC" \
        --phase plan \
        --agent planner_agent \
        --source agents/<adw_id>/plan/agent_input.json \
        --source agents/<adw_id>/plan/agent_output.txt

Idempotent: re-running with the same (adw_id, slug) overwrites the
fixture directory and pytest stub. Manifest is regenerated each call.
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_ROOT = REPO_ROOT / "tests" / "fixtures" / "regression"
TEST_ROOT = REPO_ROOT / "tests" / "regression"
AGENTS_ROOT = REPO_ROOT / "agents"

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(text: str, max_len: int = 40) -> str:
    """Lowercase, hyphen-joined, ASCII slug — capped to max_len."""
    slug = _SLUG_RE.sub("-", text.lower()).strip("-")
    return slug[:max_len].rstrip("-") or "unknown"


def _resolve_source(adw_id: str, src: str) -> Path:
    """Resolve a source path: absolute → as-is, relative → repo-rooted.

    Bare filenames are looked up inside agents/<adw_id>/ recursively as a
    convenience (operator only had to remember the file name).
    """
    p = Path(src)
    if p.is_absolute():
        return p
    candidate = REPO_ROOT / src
    if candidate.exists():
        return candidate
    agent_dir = AGENTS_ROOT / adw_id
    if agent_dir.exists() and "/" not in src:
        matches = list(agent_dir.rglob(src))
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            raise SystemExit(
                f"Ambiguous source {src!r} — matches {len(matches)} files under agents/{adw_id}/"
            )
    raise SystemExit(f"Source not found: {src} (checked absolute, repo-rel, and agents/{adw_id}/**)")


def capture(
    adw_id: str,
    slug: str,
    description: str,
    sources: Iterable[Path],
    phase: str | None,
    agent: str | None,
) -> tuple[Path, Path]:
    """Copy sources into the fixture dir + write MANIFEST + pytest stub.

    Returns (fixture_dir, test_file).
    """
    fixture_dir = FIXTURE_ROOT / f"{adw_id}_{slug}"
    # Slug uses hyphens for readability, but Python module names can't have them.
    test_file = TEST_ROOT / f"test_{slug.replace('-', '_')}.py"

    fixture_dir.mkdir(parents=True, exist_ok=True)
    TEST_ROOT.mkdir(parents=True, exist_ok=True)
    (TEST_ROOT / "__init__.py").touch(exist_ok=True)

    copied: list[tuple[str, str]] = []
    for src in sources:
        if not src.exists():
            raise SystemExit(f"Source missing on disk: {src}")
        dst = fixture_dir / src.name
        shutil.copy2(src, dst)
        rel_src = src.relative_to(REPO_ROOT) if REPO_ROOT in src.parents else src
        copied.append((str(rel_src), dst.name))

    _write_manifest(
        fixture_dir / "MANIFEST.md",
        adw_id=adw_id,
        slug=slug,
        description=description,
        phase=phase,
        agent=agent,
        copied=copied,
    )

    if not test_file.exists():
        _write_test_stub(
            test_file,
            slug=slug,
            adw_id=adw_id,
            description=description,
            phase=phase,
            agent=agent,
            fixture_files=[name for _, name in copied],
        )

    return fixture_dir, test_file


# Raw agent I/O worth grabbing when a phase breaks — the inputs/outputs that
# let us replay the break. Newest match per basename wins (see below).
_AUTOCAPTURE_ARTIFACTS = (
    "cc_raw_output.jsonl",
    "cc_final_object.json",
    "agent_output.txt",
    "agent_input.json",
)

# Per-process dedup: never capture the same (adw_id, slug) twice in one run.
_AUTOCAPTURED: set[tuple[str, str]] = set()


def autocapture_phase_failure(
    adw_id: str,
    phase: str,
    *,
    reason: str | None = None,
    agent: str | None = None,
    returncode: int | None = None,
) -> tuple[Path, Path] | None:
    """Auto-capture a harness regression when a phase breaks.

    Locates the failing phase's raw agent I/O under ``agents/{adw_id}/`` and
    routes it through :func:`capture` — the same fixture + pytest stub the
    ``/capture_fixture`` command produces, minus the operator. Returns
    ``(fixture_dir, test_file)``, or ``None`` if there was nothing to capture
    (no agent dir, no artifacts found, or already captured this run).

    The caller gates this on the ``--auto-capture`` / ``ADW_AUTO_CAPTURE``
    opt-in. This NEVER commits: the fixture lands in the working tree so the
    operator can scrub secrets (``agents/`` may hold tokens/cookies) before
    ``git add``. The generated replay stays skip-marked — auto-capture
    preserves the breaking input, it does not write the assertion.
    """
    detail = reason or (f"exit-{returncode}" if returncode is not None else "failed")
    slug = slugify(f"{phase}-{detail}")
    key = (adw_id, slug)
    if key in _AUTOCAPTURED:
        return None

    agent_dir = AGENTS_ROOT / adw_id
    if not agent_dir.is_dir():
        return None

    # Scope to the failing agent's subdir when known; otherwise search the
    # whole run — the phase that just broke wrote its artifacts most recently.
    search_root = agent_dir / agent if agent and (agent_dir / agent).is_dir() else agent_dir

    sources: list[Path] = []
    for name in _AUTOCAPTURE_ARTIFACTS:
        matches = sorted(
            search_root.rglob(name), key=lambda p: p.stat().st_mtime, reverse=True
        )
        if matches:
            sources.append(matches[0])
    if not sources:
        return None

    description = (
        f"Auto-captured: phase '{phase}' broke"
        + (f" — {reason}" if reason else "")
        + (f" (exit code {returncode})" if returncode is not None else "")
        + ". Replay is a scaffold; wire the real assertion and scrub secrets before committing."
    )

    result = capture(
        adw_id=adw_id,
        slug=slug,
        description=description,
        sources=sources,
        phase=phase,
        agent=agent,
    )
    _AUTOCAPTURED.add(key)
    return result


def _write_manifest(
    path: Path,
    *,
    adw_id: str,
    slug: str,
    description: str,
    phase: str | None,
    agent: str | None,
    copied: list[tuple[str, str]],
) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = [
        f"# Regression fixture — {slug}",
        "",
        f"- **adw_id:** `{adw_id}`",
        f"- **captured_at:** {now}",
        f"- **phase:** {phase or '_(unspecified)_'}",
        f"- **agent:** {agent or '_(unspecified)_'}",
        "",
        "## What broke",
        "",
        description.strip() or "_(no description provided)_",
        "",
        "## Files",
        "",
        "| Source path | Fixture filename |",
        "|---|---|",
    ]
    for src, name in copied:
        lines.append(f"| `{src}` | `{name}` |")
    lines.extend(
        [
            "",
            "## Replay",
            "",
            f"See `tests/regression/test_{slug}.py` for the regression test.",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def _write_test_stub(
    path: Path,
    *,
    slug: str,
    adw_id: str,
    description: str,
    phase: str | None,
    agent: str | None,
    fixture_files: list[str],
) -> None:
    fixture_files_repr = ", ".join(repr(f) for f in fixture_files) or "# add fixture filenames"
    body = f'''"""Regression: {slug}

Captured from adw_id={adw_id} ({phase or "?phase"} / {agent or "?agent"}).

What broke:
{description.strip() or "(no description)"}

TODO: import the real parser/agent that broke and assert it now succeeds.
The bare scaffold below just proves the fixture loads — replace it with
the actual replay before merging.
"""
from pathlib import Path

import pytest

FIXTURE_DIR = Path(__file__).parent.parent / "fixtures" / "regression" / "{adw_id}_{slug}"
FIXTURE_FILES = [{fixture_files_repr}]


def test_fixture_present():
    assert FIXTURE_DIR.is_dir(), f"missing fixture dir: {{FIXTURE_DIR}}"
    for name in FIXTURE_FILES:
        assert (FIXTURE_DIR / name).is_file(), f"missing fixture file: {{name}}"


@pytest.mark.skip(reason="TODO: wire the real replay — import the parser/agent and assert it no longer raises")
def test_replay():
    # Example skeleton:
    #   from my_module import parse_agent_output
    #   raw = (FIXTURE_DIR / "agent_output.txt").read_text()
    #   result = parse_agent_output(raw)
    #   assert result is not None
    raise NotImplementedError
'''
    path.write_text(body, encoding="utf-8")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("adw_id")
    p.add_argument("slug", help="short kebab-case identifier for this regression")
    p.add_argument("--description", required=True, help="what broke, in 1-2 sentences")
    p.add_argument("--phase", default=None, help="phase name, e.g. plan")
    p.add_argument("--agent", default=None, help="agent name, e.g. planner_agent")
    p.add_argument(
        "--source",
        action="append",
        required=True,
        help="path to a breaking-input file (repeatable). Absolute, repo-rel, or bare filename under agents/<adw_id>/.",
    )
    args = p.parse_args()

    sources = [_resolve_source(args.adw_id, s) for s in args.source]
    fixture_dir, test_file = capture(
        adw_id=args.adw_id,
        slug=slugify(args.slug),
        description=args.description,
        sources=sources,
        phase=args.phase,
        agent=args.agent,
    )

    print(f"fixture: {fixture_dir.relative_to(REPO_ROOT)}")
    print(f"test:    {test_file.relative_to(REPO_ROOT)}")
    print("next: open the test file and replace the skip-marked test_replay with the real assertion.")


if __name__ == "__main__":
    main()
    sys.exit(0)
