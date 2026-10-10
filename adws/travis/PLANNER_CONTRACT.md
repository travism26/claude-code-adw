# Planner Contract

A **planner** produces the spec that the build phase implements. The Travis SDLC
orchestrator (`travis_sdlc.py`) dispatches planning through the registry in
`planners.py`. Adding a planner (Spec Kit, BMAD, ...) means:

1. Write one script in `adws/travis/` that satisfies the contract below.
2. Add one `PLANNERS` entry in `planners.py`.

No other code changes. Deliberately no plugin discovery and no config files —
the registry dict is the single source of truth.

## Contract

### Invocation

The orchestrator invokes each planner script as:

```
uv run adws/travis/<script>.py <prompt-or-spec-file> <adw-id> [--plan-type TYPE] [--model MODEL] [--working-dir DIR]
```

- `--plan-type` is only passed when the registry entry sets `takes_plan_type=True`
  (values: `feature|chore|bug`).
- `--model` is one of `sonnet|opus|haiku`.
- `--working-dir` is the **target project directory** (may differ from the
  harness repo, e.g. eval target apps). Defaults to the current directory.

### Required behavior

1. **Write the spec** under `<working-dir>/specs/` as a single markdown file
   consumable by the `/implement` slash command. If your tool produces a
   multi-file artifact (like OpenSpec change folders), flatten it
   (see `travis_openspec.py:flatten_change_dir` for the pattern).

2. **Print the spec path** (relative to working-dir) to stdout as the last line.

3. **Update TravisState** (`agents/{adw_id}/travis_state.json`, always under the
   *harness* repo — `TravisState` handles the location):

   ```python
   state = TravisState.load(adw_id)
   state.update(plan_file=rel_spec)
   state.set_phase_result("plan", {"success": True, "file": rel_spec, "planner": "<name>"})
   # Only if your planner collapses research (collapses_research=True):
   state.set_phase_result("research", {"success": True, "skipped_by": "<name>"})
   state.save()
   ```

   On failure: `set_phase_result("plan", {"success": False, "error": ...})`,
   `state.save()`, exit non-zero.

4. **Verify the spec exists on disk** (relative to working-dir) before declaring
   success — agents sometimes report paths without writing files.

5. **Exit codes**: 0 = success, non-zero = failure. The orchestrator treats a
   non-zero exit from a `required=True` script as a workflow-stopping failure.

### Registry entry semantics (`planners.py`)

| Field | Meaning |
|---|---|
| `scripts` | Ordered `PlannerScript` tuple; each runs as its own subprocess phase |
| `required` | Failure stops the workflow (the travis research script is `required=False`) |
| `takes_plan_type` | Script accepts `--plan-type` |
| `is_research` | Script is the optional research phase (resume gates on `"research"`) |
| `collapses_research` | Planner marks `phase_results["research"]` complete itself; there is no separate research script |
| `honors_skip_research` | `--skip-research` omits the `is_research` script; planners that collapse research ignore the flag |

### Downstream guarantees you can rely on

- `travis_build.py` reads only `state.get("plan_file")` and passes it to
  `/implement` — it does not care which planner wrote it.
- Review/document read `state.get("plan_file")`.
- Resume mode (`--resume`) walks `phase_results` in order
  (research → plan → build → ...) and skips phases whose result has
  `success: true` — which is why collapsed planners must mark research complete.

### Reference implementations

- `travis_plan.py` — canonical single-script planner (with separate `travis_research.py`)
- `travis_openspec.py` — collapsed planner wrapping an external spec tool (OpenSpec)
