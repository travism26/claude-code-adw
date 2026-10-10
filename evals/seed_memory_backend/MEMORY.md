# Project Memory

Lessons and conventions learned by the ADW harness across runs on
this codebase. Edit entries by hand under `entries/`, or regenerate
via `uv run adws/travis/travis_dream.py --working-dir <this repo>`.

## Conventions
- immutable-field-guard — PATCH handlers must explicitly block writes to immutable FK fields (plant_a_id, plant_b_id, relationship)
- route-handler-pattern — Standard Express route structure: authenticateJWT → validator chain → service delegation → status codes
- sequential-migration-numbering — Migrations use zero-padded 5-digit prefix (e.g. 00048-) in src/migrations/
- service-method-reload-pattern — Service update methods reload the record with associations before returning
- test-runner-commands — Test suite runs via npm run test:api:parallel (4 workers) + npx tsc --noEmit
- trend-computation-pattern — Timeline trend uses first-vs-last health score delta with ±5 stable threshold

## Pitfalls
- mocha-parallel-root-hook-pitfall — Root-level beforeEach/afterEach in Mocha parallel mode corrupts sibling test files
- patch-absent-field-guard — Use 'key in req.body' guard on PATCH handlers to avoid silently nulling optional fields
