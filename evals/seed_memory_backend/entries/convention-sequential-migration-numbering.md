---
name: sequential-migration-numbering
description: Migrations use zero-padded 5-digit prefix (e.g. 00048-) in src/migrations/
type: convention
source_adw_ids: [40b8aa5f, 02650fb6, 425ca342, 69308d6f, 28d7ac76, ddeb74c8, 3d2c2be9, 4f846238, f6605c3a]
date: 2026-06-06
---

Migration files live in `src/migrations/` and are named `NNNNN-description.js` with a zero-padded 5-digit sequence number (e.g. `00048-add-analysis-to-grow-log-photos.js`). Each migration exports `up` and `down` functions. When adding nullable columns to existing tables, always include a `down` that drops the columns. Migrations run as part of `test:parallel:setup`.
