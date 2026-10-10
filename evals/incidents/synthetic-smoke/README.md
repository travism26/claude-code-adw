# SYNTHETIC — synthetic-smoke incident fixture

**This fixture is entirely hand-fabricated. It is NOT a real Datadog export,
NOT a real incident, and NOT a graded eval case.**

## What it is for

- Pipeline smoke testing: `pipe_incident.py --payload evals/incidents/synthetic-smoke/payload.json
  --replay evals/incidents/synthetic-smoke` runs all four collectors in
  replay mode end-to-end with zero network calls.
- Unit tests (`adws/adw_tests/test_pipe_incident.py`) use this fixture as
  their happy-path fixture, their zero-network proof, their corrupted-snapshot
  case (via a tmp copy), and their `--adw-id` plumbing check.

## What it is NOT

- **Not a graded eval case.** There is deliberately **no `ground_truth.json`**
  in this directory — the I1 pipeline has no lenses/verdict yet (that's I2),
  and even once verdict synthesis exists, this fixture's numbers were
  invented for schema-shape coverage, not drawn from a real Redis incident.
  Grading this fixture's "verdict" against anything would be contamination
  dressed up as signal (see the contamination-honesty rule in
  `evals/EVAL_PRACTICES.md`).
- **Not a recorded incident.** A hand-recorded fixture would be built from
  real exports run through `pipelines/collectors/bounding.py`; this fixture
  only uses a familiar shape (a cache node, cpu.load, a threshold breach)
  because that shape is well-understood, not because it mirrors any real event.

## Contents

- `payload.json` — a fabricated `IncidentPayload` (`incident_id:
  "synthetic-smoke-001"`, `source: "manual"`, `resource:
  "redis-synthetic-cache-01"`, fired at a fixed instant,
  `2026-07-12T14:05:00Z`, so the fixture is byte-stable across runs).
- `evidence/dd_metrics.json` — 2 series, ≤120 points each: a `redis.cpu.load`
  ramp (0.55 → 0.85 over 40 minutes) and a flat `redis.mem.used` series,
  matching `pipelines/collectors/dd_metrics.py`'s `DdMetricsSnapshot` schema
  exactly.
- `evidence/dd_logs.json` — 3 clustered log patterns (INFO/WARN/ERROR),
  matching `dd_logs.py`'s `DdLogsSnapshot` schema exactly.
- `evidence/deploy_correlation.json` — 2 changes, one `git`-sourced and one
  `datadog`-sourced, matching `deploy_correlation.py`'s
  `DeployCorrelationSnapshot` schema exactly.
- `evidence/config_inspect.json` — 1 file excerpt, matching
  `config_inspect.py`'s `ConfigInspectSnapshot` schema exactly.

If a future milestone (I2+) wants a *graded* synthetic fixture, mint a new,
separately named directory with its own `ground_truth.json` — don't repurpose
this one.
