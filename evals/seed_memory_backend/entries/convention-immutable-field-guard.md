---
name: immutable-field-guard
description: PATCH handlers must explicitly block writes to immutable FK fields (plant_a_id, plant_b_id, relationship)
type: convention
source_adw_ids: [40b8aa5f, 02650fb6, 425ca342, 69308d6f, 28d7ac76, ddeb74c8, 3d2c2be9, 4f846238, f6605c3a]
date: 2026-06-06
---

For resource-update endpoints, certain fields are declared immutable after creation (e.g. `plant_a_id`, `plant_b_id`, `relationship` on companions). The route must check for their presence in `req.body` and return 400 before any DB call. Required test cases: (1) update with immutable field present → 400 and DB state unchanged, (2) update with only mutable fields → 200.
