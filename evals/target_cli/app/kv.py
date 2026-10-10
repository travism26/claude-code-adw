"""kv — a tiny JSON-file-backed key/value store CLI.

Usage:
    python -m app.kv set <key> <value>
    python -m app.kv get <key>
    python -m app.kv list
    python -m app.kv delete <key>

Pairs are stored in kv.json in the current directory (override with --db).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List

DEFAULT_DB = "kv.json"


class KVStore:
    """A JSON-file-backed string→string key/value store."""

    def __init__(self, db_path: str = DEFAULT_DB) -> None:
        self.db_path = Path(db_path)

    def _load(self) -> Dict[str, str]:
        if not self.db_path.exists():
            return {}
        return json.loads(self.db_path.read_text())

    def _save(self, data: Dict[str, str]) -> None:
        self.db_path.write_text(json.dumps(data, indent=2, sort_keys=True))

    def set(self, key: str, value: str) -> None:
        """Set (or overwrite) a key."""
        data = self._load()
        data[key] = value
        self._save(data)

    def get(self, key: str) -> str:
        """Return the value for key, or raise KeyError if absent."""
        data = self._load()
        if key not in data:
            raise KeyError(key)
        return data[key]

    def list(self) -> List[str]:
        """Return all keys, sorted."""
        return sorted(self._load().keys())

    def delete(self, key: str) -> None:
        """Remove a key, or raise KeyError if absent."""
        data = self._load()
        if key not in data:
            raise KeyError(key)
        del data[key]
        self._save(data)


def main(argv: list | None = None) -> int:
    parser = argparse.ArgumentParser(prog="kv", description="Tiny key/value store CLI")
    parser.add_argument("--db", default=DEFAULT_DB, help="path to the JSON store")
    sub = parser.add_subparsers(dest="command", required=True)

    p_set = sub.add_parser("set", help="set a key")
    p_set.add_argument("key")
    p_set.add_argument("value")

    p_get = sub.add_parser("get", help="get a key")
    p_get.add_argument("key")

    sub.add_parser("list", help="list all keys")

    p_del = sub.add_parser("delete", help="delete a key")
    p_del.add_argument("key")

    args = parser.parse_args(argv)
    store = KVStore(args.db)

    if args.command == "set":
        store.set(args.key, args.value)
        return 0
    if args.command == "get":
        try:
            print(store.get(args.key))
        except KeyError:
            print(f"key not found: {args.key}", file=sys.stderr)
            return 1
        return 0
    if args.command == "list":
        for key in store.list():
            print(key)
        return 0
    if args.command == "delete":
        try:
            store.delete(args.key)
        except KeyError:
            print(f"key not found: {args.key}", file=sys.stderr)
            return 1
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
