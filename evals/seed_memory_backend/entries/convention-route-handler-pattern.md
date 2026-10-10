---
name: route-handler-pattern
description: Standard Express route structure: authenticateJWT → validator chain → service delegation → status codes
type: convention
source_adw_ids: [40b8aa5f, 02650fb6, 425ca342, 69308d6f, 28d7ac76, ddeb74c8, 3d2c2be9, 4f846238, f6605c3a]
date: 2026-06-06
---

Every route follows: (1) authenticateJWT middleware, (2) express-validator chain (param UUID, body fields), (3) thin handler that calls a service method, (4) returns 400 on validation failure, 401 on auth failure, 404 on missing record, 200/201 on success. Route files stay thin — no business logic. New services should mirror an existing peer (e.g. NutrientService for SeasonalTipService). Constants like enum arrays (SEASON_VALUES) belong in the service file and should be imported by the route, not redefined locally.
