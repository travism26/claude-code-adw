---
name: mocha-parallel-root-hook-pitfall
description: Root-level beforeEach/afterEach in Mocha parallel mode corrupts sibling test files
type: pitfall
source_adw_ids: [40b8aa5f, 02650fb6, 425ca342, 69308d6f, 28d7ac76, ddeb74c8, 3d2c2be9, 4f846238, f6605c3a]
date: 2026-06-06
---

In Mocha parallel mode, root-level `beforeEach` and `afterEach` hooks (declared outside any `describe` block) execute before/after EVERY test in the same worker process, including tests from other files assigned to that worker. This corrupts shared `testHelper` state and DB rows.

Fix: always nest `beforeEach`, `afterEach`, and their associated `let` declarations inside the top-level `describe` block for the test file. Existing test files like `grows.test.ts` and `growLogs.photoAnalysis.test.ts` set the convention correctly.
