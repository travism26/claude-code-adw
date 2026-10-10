---
name: patch-absent-field-guard
description: Use 'key in req.body' guard on PATCH handlers to avoid silently nulling optional fields
type: pitfall
source_adw_ids: [40b8aa5f, 02650fb6, 425ca342, 69308d6f, 28d7ac76, ddeb74c8, 3d2c2be9, 4f846238, f6605c3a]
date: 2026-06-06
---

On PATCH endpoints where a field is optional (omitting it means 'no change'), the expression `req.body.notes ?? null` is a data-loss trap: when the key is absent, `req.body.notes` is `undefined`, and `?? null` converts it to `null`, wiping the existing value.

Correct pattern:
```ts
if ('notes' in req.body) {
  const updated = await Service.updateField(record, req.body.notes ?? null);
  return res.status(200).json(updated);
}
return res.status(200).json(record); // no-op, return existing
```
Always test the empty-body case and assert the existing field value is preserved in the response.
