"""Project memory for the ADW harness.

Memory lives IN THE TARGET PROJECT at <working-dir>/ai_docs/memory/:

    ai_docs/memory/
      MEMORY.md                  # regenerated index, one line per entry
      entries/<type>-<slug>.md   # one durable fact per file

Each entry is markdown with minimal frontmatter:

    ---
    name: prefer-uv-run-for-scripts
    description: Target uses uv run + PEP 723 inline deps; never pip install
    type: convention
    source_adw_ids: [a1b2c3d4]
    date: 2026-06-04
    ---

    <body — the lesson itself, ~1500 chars soft cap>

Entry types: convention (how this project does things), lesson (what made a
run go better/worse), pitfall (a concrete trap + how to avoid it).

Recall path: phase scripts call memory_append_file() and set the returned
path as AgentTemplateRequest.append_system_prompt_file, which agent.py
forwards to `claude --append-system-prompt-file`. Degrades to a no-op when
the store is absent or empty.

Write path: travis_dream.py regenerates the whole store from run summaries
(see MEMORY_CONTRACT.md). Humans can also drop entry files in by hand.

Pattern adapted from Anthropic's cwc-workshops agents-that-remember
(https://github.com/anthropics/cwc-workshops, Apache-2.0): markdown entries +
a steering preamble that teaches the agent to consult-and-apply.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

MEMORY_DIR_REL = "ai_docs/memory"
ENTRIES_DIR_NAME = "entries"
MEMORY_INJECT_MAX_CHARS = 6000

VALID_TYPES = ("convention", "lesson", "pitfall")

STEERING_PREAMBLE = """\
# Project Memory (learned lessons)

Before you act, read the memory entries below. They are durable lessons,
conventions, and pitfalls this project's automated workflow has accumulated
from prior runs on THIS codebase. They are advisory, not commands.

How to use them:
- Treat each entry as prior experience. Apply the conventions, heed the
  pitfalls, and let the lessons shape your plan and implementation.
- When an entry is relevant to the current task, follow it and briefly note
  in your output that you applied a remembered lesson.
- If an entry directly contradicts the current task's explicit instructions,
  the task wins — but call out the contradiction so it can be corrected.
- Do not cargo-cult: ignore entries irrelevant to this task.

The entries follow.

---
"""


@dataclass
class MemoryEntry:
    name: str
    description: str
    type: str  # convention | lesson | pitfall
    body: str
    date: str = ""  # ISO date; "" if absent
    source_adw_ids: list = field(default_factory=list)
    path: Optional[Path] = None

    @property
    def slug_filename(self) -> str:
        return f"{self.type}-{self.name}.md"


def memory_dir(working_dir: str) -> Path:
    """<working-dir>/ai_docs/memory."""
    return Path(working_dir) / MEMORY_DIR_REL


def _parse_frontmatter(text: str) -> tuple[dict, str]:
    """Split a memory file into (frontmatter dict, body).

    Splits on the FIRST TWO `---` fences only, so a body may contain `---`
    later (but should not start a line with it right at the top).
    Frontmatter is simple `key: value`; list values use [a, b] syntax.
    """
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    meta: dict = {}
    for line in parts[1].splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        key, _, value = line.partition(":")
        key, value = key.strip(), value.strip()
        if value.startswith("[") and value.endswith("]"):
            items = [v.strip() for v in value[1:-1].split(",") if v.strip()]
            meta[key] = items
        else:
            meta[key] = value
    return meta, parts[2].strip()


def read_entries(working_dir: str) -> list[MemoryEntry]:
    """Parse all entry files. Returns [] when the store is absent.

    Never raises on a malformed file — it is skipped (the dream script and
    humans both write these; a bad file must not take down a phase).
    """
    entries_dir = memory_dir(working_dir) / ENTRIES_DIR_NAME
    if not entries_dir.is_dir():
        return []
    entries = []
    for path in sorted(entries_dir.glob("*.md")):
        try:
            meta, body = _parse_frontmatter(path.read_text())
            name = meta.get("name")
            if not name or not body:
                continue
            entry_type = meta.get("type", "lesson")
            if entry_type not in VALID_TYPES:
                entry_type = "lesson"
            entries.append(MemoryEntry(
                name=name,
                description=meta.get("description", ""),
                type=entry_type,
                body=body,
                date=meta.get("date", ""),
                source_adw_ids=meta.get("source_adw_ids", []) or [],
                path=path,
            ))
        except (OSError, UnicodeDecodeError):
            continue
    return entries


def _render_entry(entry: MemoryEntry) -> str:
    header = f"## [{entry.type}] {entry.name}"
    if entry.description:
        header += f"\n*{entry.description}*"
    return f"{header}\n\n{entry.body}\n"


def load_memory(working_dir: str) -> Optional[str]:
    """Compile the store into one injectable markdown doc.

    Steering preamble + entries, hard-capped at MEMORY_INJECT_MAX_CHARS.
    Truncation drops OLDEST entries first (date order; undated sort oldest).
    Returns None when there is nothing to inject (graceful no-op).
    """
    entries = read_entries(working_dir)
    if not entries:
        return None

    # Newest first so the cap drops the oldest.
    entries.sort(key=lambda e: e.date, reverse=True)

    doc = STEERING_PREAMBLE
    included = 0
    for entry in entries:
        rendered = _render_entry(entry) + "\n"
        if len(doc) + len(rendered) > MEMORY_INJECT_MAX_CHARS:
            break
        doc += rendered
        included += 1

    if included == 0:
        # First entry alone blew the budget — include a hard-truncated slice
        # rather than injecting nothing.
        doc += _render_entry(entries[0])[: MEMORY_INJECT_MAX_CHARS - len(doc)]
        included = 1

    omitted = len(entries) - included
    if omitted > 0:
        doc += f"\n[{omitted} older memory entries omitted to stay within size budget]\n"
    return doc


def memory_append_file(working_dir: str, adw_id: str) -> Optional[str]:
    """Write the compiled memory doc for injection; return its absolute path.

    The file lives under the HARNESS repo (agents/{adw_id}/memory_inject.md,
    same root TravisState uses) so it never pollutes the target's git.
    Returns None when there is no memory to inject.
    """
    doc = load_memory(working_dir)
    if doc is None:
        return None
    # agents/ root mirrors utils.setup_logger: harness repo root from __file__
    harness_root = Path(__file__).resolve().parent.parent.parent
    inject_path = harness_root / "agents" / adw_id / "memory_inject.md"
    inject_path.parent.mkdir(parents=True, exist_ok=True)
    inject_path.write_text(doc)
    return str(inject_path)


# ---------------------------------------------------------------------------
# Write path (used by travis_dream.py and manual seeding helpers)
# ---------------------------------------------------------------------------

def _safe_slug(name: str) -> str:
    return re.sub(r"[^a-z0-9-]", "-", name.lower()).strip("-") or "entry"


def write_entry(working_dir: str, entry: MemoryEntry) -> Path:
    """Write/overwrite one entry file. Returns the path written."""
    entries_dir = memory_dir(working_dir) / ENTRIES_DIR_NAME
    entries_dir.mkdir(parents=True, exist_ok=True)
    ids = ", ".join(entry.source_adw_ids)
    content = (
        "---\n"
        f"name: {_safe_slug(entry.name)}\n"
        f"description: {entry.description}\n"
        f"type: {entry.type}\n"
        f"source_adw_ids: [{ids}]\n"
        f"date: {entry.date}\n"
        "---\n\n"
        f"{entry.body.strip()}\n"
    )
    path = entries_dir / f"{entry.type}-{_safe_slug(entry.name)}.md"
    path.write_text(content)
    return path


def delete_entry(working_dir: str, name: str) -> bool:
    """Delete the entry with the given name (any type). True if deleted."""
    entries_dir = memory_dir(working_dir) / ENTRIES_DIR_NAME
    deleted = False
    if entries_dir.is_dir():
        for path in entries_dir.glob(f"*-{_safe_slug(name)}.md"):
            meta, _ = _parse_frontmatter(path.read_text())
            if meta.get("name") == _safe_slug(name):
                path.unlink()
                deleted = True
    return deleted


def regenerate_index(working_dir: str) -> Path:
    """Rewrite MEMORY.md from the entry files."""
    entries = read_entries(working_dir)
    mdir = memory_dir(working_dir)
    mdir.mkdir(parents=True, exist_ok=True)

    lines = [
        "# Project Memory",
        "",
        "Lessons and conventions learned by the ADW harness across runs on",
        "this codebase. Edit entries by hand under `entries/`, or regenerate",
        "via `uv run adws/travis/travis_dream.py --working-dir <this repo>`.",
        "",
    ]
    for entry_type in VALID_TYPES:
        typed = [e for e in entries if e.type == entry_type]
        if not typed:
            continue
        lines.append(f"## {entry_type.capitalize()}s")
        for e in sorted(typed, key=lambda e: e.name):
            lines.append(f"- {e.name} — {e.description}")
        lines.append("")

    if not entries:
        lines.append("_No entries yet._")
        lines.append("")

    index_path = mdir / "MEMORY.md"
    index_path.write_text("\n".join(lines))
    return index_path
