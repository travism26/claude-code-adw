---
name: test-runner-commands
description: Test suite runs via npm run test:api:parallel (4 workers) + npx tsc --noEmit
type: convention
source_adw_ids: [40b8aa5f, 02650fb6, 425ca342, 69308d6f, 28d7ac76, ddeb74c8, 3d2c2be9, 4f846238, f6605c3a]
date: 2026-06-06
---

Two required checks before a build is considered passing:
1. `npx tsc --noEmit` — TypeScript compile check.
2. `npm run test:api:parallel` — full API suite across 4 parallel workers; also runs `test:parallel:setup` which drops/recreates all 4 worker DBs with fresh migrations.

The project has ~550 pre-existing ESLint warnings (no-explicit-any, no-non-null-assertion). These are accepted background noise — validator reports only new violations in changed files. Zero errors is the bar; warnings in new code are tech debt but not blockers.
