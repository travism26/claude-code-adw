---
name: id-generation-pattern
description: Note IDs must use max-based assignment, not length-based, to survive deletions
type: pitfall
source_adw_ids: [68f6b646]
date: 2026-06-04
---

Bug: using `len(notes) + 1` for new note IDs causes collisions after deletions (e.g., add/add/delete/add produces duplicate id 2). Fix: `(max(note.id for note in notes) + 1) if notes else 1`. Always use the max-based approach for any sequential ID assignment in this codebase. Regression test pattern: add/add/delete/add sequence, assert third note gets id 3, confirm no duplicates.
