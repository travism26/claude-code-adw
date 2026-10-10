---
name: trend-computation-pattern
description: Timeline trend uses first-vs-last health score delta with ±5 stable threshold
type: convention
source_adw_ids: [40b8aa5f, 02650fb6, 425ca342, 69308d6f, 28d7ac76, ddeb74c8, 3d2c2be9, 4f846238, f6605c3a]
date: 2026-06-06
---

For photo timeline endpoints, trend is computed from sorted entries that have a non-null healthScore:
- Only scored entries participate (null entries included in timeline but skipped for trend).
- `delta = lastScore - firstScore`
- `delta > 5` → 'improving', `delta < -5` → 'declining', otherwise → 'stable'.
- Single scored entry or all-null → 'stable'.
- Sort order: `created_at ASC`, tie-break `photoId ASC`.
- STABLE_THRESHOLD = 5.
