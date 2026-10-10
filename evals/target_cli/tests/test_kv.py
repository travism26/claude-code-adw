"""Tests for the kv CLI and store."""

import json

import pytest

from app.kv import KVStore, main


@pytest.fixture
def store(tmp_path):
    return KVStore(str(tmp_path / "kv.json"))


def test_set_get(store):
    store.set("a", "1")
    assert store.get("a") == "1"


def test_set_overwrites(store):
    store.set("a", "1")
    store.set("a", "2")
    assert store.get("a") == "2"


def test_set_persists_to_disk(store):
    store.set("a", "1")
    raw = json.loads(store.db_path.read_text())
    assert raw == {"a": "1"}


def test_get_missing_raises(store):
    with pytest.raises(KeyError):
        store.get("nope")


def test_list_sorted(store):
    store.set("b", "2")
    store.set("a", "1")
    assert store.list() == ["a", "b"]


def test_delete(store):
    store.set("a", "1")
    store.delete("a")
    assert store.list() == []


def test_delete_missing_raises(store):
    with pytest.raises(KeyError):
        store.delete("nope")


def test_main_set_then_get(tmp_path, capsys):
    db = str(tmp_path / "kv.json")
    assert main(["--db", db, "set", "x", "42"]) == 0
    assert main(["--db", db, "get", "x"]) == 0
    assert capsys.readouterr().out.strip() == "42"


def test_main_get_missing_exits_1(tmp_path, capsys):
    db = str(tmp_path / "kv.json")
    assert main(["--db", db, "get", "missing"]) == 1


def test_main_list(tmp_path, capsys):
    db = str(tmp_path / "kv.json")
    main(["--db", db, "set", "k2", "v"])
    main(["--db", db, "set", "k1", "v"])
    main(["--db", db, "list"])
    assert capsys.readouterr().out.split() == ["k1", "k2"]
