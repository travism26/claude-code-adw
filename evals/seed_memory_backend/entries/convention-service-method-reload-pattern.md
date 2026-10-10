---
name: service-method-reload-pattern
description: Service update methods reload the record with associations before returning
type: convention
source_adw_ids: [40b8aa5f, 02650fb6, 425ca342, 69308d6f, 28d7ac76, ddeb74c8, 3d2c2be9, 4f846238, f6605c3a]
date: 2026-06-06
---

After `record.update(data)`, service update methods call `record.reload({ include: [...] })` or re-fetch via `findByPk` with the same includes used in `create` (e.g. plantA/plantB for companions, plant_profile for seasonal tips). This ensures the response shape is consistent with the create response and includes all association data.
