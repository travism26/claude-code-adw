"""notes — a tiny JSON-file-backed notes CLI.

Usage:
    python -m app.notes add "Title" --body "Body text"
    python -m app.notes list
    python -m app.notes get <id>
    python -m app.notes delete <id>

Notes are stored in notes.json in the current directory (override with --db).
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

DEFAULT_DB = "notes.json"


@dataclass
class Note:
    """A single note."""

    id: int
    title: str
    body: str = ""
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "Note":
        return cls(
            id=data["id"],
            title=data["title"],
            body=data.get("body", ""),
            created_at=data.get("created_at", ""),
        )


class NotesStore:
    """JSON-file-backed note storage."""

    def __init__(self, db_path: str = DEFAULT_DB):
        self.db_path = Path(db_path)

    def _load(self) -> list[Note]:
        if not self.db_path.exists():
            return []
        raw = json.loads(self.db_path.read_text())
        return [Note.from_dict(item) for item in raw]

    def _save(self, notes: list[Note]) -> None:
        self.db_path.write_text(
            json.dumps([n.to_dict() for n in notes], indent=2) + "\n"
        )

    def add(self, title: str, body: str = "") -> Note:
        """Add a new note and return it."""
        notes = self._load()
        # NOTE: id assignment is based on list length.
        next_id = len(notes) + 1
        note = Note(id=next_id, title=title, body=body)
        notes.append(note)
        self._save(notes)
        return note

    def get(self, note_id: int) -> Optional[Note]:
        """Return the note with the given id, or None."""
        for note in self._load():
            if note.id == note_id:
                return note
        return None

    def list(self) -> list[Note]:
        """Return all notes, oldest first."""
        return self._load()

    def delete(self, note_id: int) -> bool:
        """Delete the note with the given id. Returns True if deleted."""
        notes = self._load()
        remaining = [n for n in notes if n.id != note_id]
        if len(remaining) == len(notes):
            return False
        self._save(remaining)
        return True


def format_note(note: Note) -> str:
    """One-line display format for a note."""
    body_preview = note.body[:40] + ("..." if len(note.body) > 40 else "")
    return f"[{note.id}] {note.title}" + (f" — {body_preview}" if note.body else "")


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog="notes", description="Tiny notes CLI")
    parser.add_argument("--db", default=DEFAULT_DB, help="Path to the notes JSON file")
    sub = parser.add_subparsers(dest="command", required=True)

    p_add = sub.add_parser("add", help="Add a note")
    p_add.add_argument("title")
    p_add.add_argument("--body", default="", help="Note body text")

    sub.add_parser("list", help="List all notes")

    p_get = sub.add_parser("get", help="Show one note")
    p_get.add_argument("id", type=int)

    p_delete = sub.add_parser("delete", help="Delete a note")
    p_delete.add_argument("id", type=int)

    args = parser.parse_args(argv)
    store = NotesStore(args.db)

    if args.command == "add":
        note = store.add(args.title, args.body)
        print(f"Added note {note.id}: {note.title}")
        return 0

    if args.command == "list":
        notes = store.list()
        if not notes:
            print("No notes.")
            return 0
        for note in notes:
            print(format_note(note))
        return 0

    if args.command == "get":
        note = store.get(args.id)
        if note is None:
            print(f"Note {args.id} not found.", file=sys.stderr)
            return 1
        print(f"[{note.id}] {note.title}")
        if note.body:
            print(note.body)
        print(f"Created: {note.created_at}")
        return 0

    if args.command == "delete":
        if store.delete(args.id):
            print(f"Deleted note {args.id}.")
            return 0
        print(f"Note {args.id} not found.", file=sys.stderr)
        return 1

    return 2


if __name__ == "__main__":
    sys.exit(main())
