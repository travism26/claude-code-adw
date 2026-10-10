---
name: regression-test-pattern
description: Bug fixes must include a regression test reproducing the exact failure sequence
type: convention
source_adw_ids: [68f6b646]
date: 2026-06-04
---

When fixing a bug, add a test in `tests/test_notes.py` that replicates the exact operation sequence that triggered the bug. Assert the corrected output and confirm no side effects (e.g., no duplicate IDs, correct `get` behavior). Test name should describe the scenario: `test_no_duplicate_id_after_delete_then_add`.
