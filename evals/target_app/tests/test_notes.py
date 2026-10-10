"""Tests for the notes CLI and store."""

import json

import pytest

from app.notes import Note, NotesStore, format_note, main


@pytest.fixture
def store(tmp_path):
    return NotesStore(str(tmp_path / "notes.json"))


def test_add_returns_note_with_id(store):
    note = store.add("First", "hello")
    assert note.id == 1
    assert note.title == "First"
    assert note.body == "hello"
    assert note.created_at  # timestamp populated


def test_add_persists_to_disk(store):
    store.add("First")
    raw = json.loads(store.db_path.read_text())
    assert len(raw) == 1
    assert raw[0]["title"] == "First"


def test_get_returns_matching_note(store):
    store.add("First")
    second = store.add("Second")
    found = store.get(second.id)
    assert found is not None
    assert found.title == "Second"


def test_get_missing_returns_none(store):
    assert store.get(99) is None


def test_list_returns_all_notes_in_order(store):
    store.add("A")
    store.add("B")
    titles = [n.title for n in store.list()]
    assert titles == ["A", "B"]


def test_delete_removes_note(store):
    note = store.add("Bye")
    assert store.delete(note.id) is True
    assert store.get(note.id) is None


def test_delete_missing_returns_false(store):
    assert store.delete(42) is False


def test_format_note_truncates_long_body():
    note = Note(id=1, title="T", body="x" * 60)
    formatted = format_note(note)
    assert "..." in formatted
    assert len(formatted) < 70


def test_cli_add_and_list(tmp_path, capsys):
    db = str(tmp_path / "notes.json")
    assert main(["--db", db, "add", "CLI note"]) == 0
    assert main(["--db", db, "list"]) == 0
    out = capsys.readouterr().out
    assert "CLI note" in out


def test_cli_get_missing_exits_nonzero(tmp_path):
    db = str(tmp_path / "notes.json")
    assert main(["--db", db, "get", "7"]) == 1
