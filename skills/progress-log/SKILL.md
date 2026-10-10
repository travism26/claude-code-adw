---
name: progress-log
description: Update a project's "build spine" — the glanceable, auto-rendered where-are-we / where-are-we-going progress page. Use after a task or milestone ships, when wiring a ship/done gate to keep the view current, when the roadmap page looks stale, or when bootstrapping the view for a new project.
---

# progress-log — the build spine

A project's roadmap usually lives in five places (CLAUDE.md, memory, docs, ADRs, git) and none is glanceable. This renders one page — `docs/progress/index.html` — that answers "where are we, where are we going?" at a glance, and stays current because it is **derived**, never hand-authored.

**The rule: facts in, render out.** You append one structured fact to an append-only log; a deterministic renderer turns log + roadmap + git into the HTML. Add facts, run the renderer — never open `index.html` and edit it. A hand-edited page is a fact that lives only in the render, which is exactly the drift this replaces. This is the one guardrail; everything below serves it.

## Update after a task ships

The task is done, committed, and (optionally) merged. Do these in order:

1. **Gather the fact** from the commit/PR you just shipped: its task id, one-sentence summary, the commit sha, the PR number if any, the date, and any short evidence chips (a metric line, an ADR ref).
2. **Append one line** to `<project>/docs/progress/log.jsonl` — a single JSON object, the schema below. Append only; never rewrite or reorder existing lines.
3. **Render**: `python3 <this-skill-dir>/render_progress.py <project>/docs/progress/`. It exits `0` on success (any stale-commit warnings go to stderr), or `2` on a structural error — a malformed log line, unparseable roadmap, or a logged task the roadmap doesn't declare. Exit `2` means the inputs disagree; fix the fact you just wrote, don't touch the HTML.
4. **Publish** (only if `roadmap.toml` `[project] publish = true`): publish the rendered `index.html` to the `[project] artifact_url` using the Artifact tool, reusing that URL so the link stays stable.
5. **Commit** `log.jsonl` and `index.html` alongside the code change (same commit or a follow-up). The render is a build product checked in for glanceability.

## The log entry schema

One JSON object per line in `log.jsonl`. `task` is milestone-qualified so ids stay unique across renumbering.

| field | required | notes |
|---|---|---|
| `task` | yes | `"m5.t4"` — `<milestone-id>.<task-id>`, lowercased, matches a `[[tasks]]` id in `roadmap.toml` |
| `title` | yes | short internal title for the record |
| `status` | yes | `"done"` normally; `"dropped"` strikes the task through (history is never deleted) |
| `date` | yes | `"YYYY-MM-DD"`; the newest date becomes the page's "updated" stamp |
| `summary` | no | one sentence; shown as the task's line on the page (falls back to the roadmap `desc`) |
| `commit` | no | sha; verified against git — an unresolvable one renders with a ⚠ marker, not a failure |
| `pr` | no | PR number, or omit / `null` |
| `evidence` | no | array of short strings (a metric, an ADR), or `null` — the facts worth keeping at ship time |

## What the renderer derives (don't write these anywhere)

- **"Up next" / "You are here"** — the first active-milestone task with no `done` entry. Never recorded; always computed, so it can't go stale.
- **"Last shipped"**, the "updated" date, milestone counts — all read off the log and roadmap.
- Milestone status (`done`/`active`) is hand-set in `roadmap.toml`; task done-ness comes from the log.

## Files (convention: `<project>/docs/progress/`)

- `roadmap.toml` — the **framing**: project header, milestones, the active milestone's task list, the horizon list. Human/agent-edited as reviewed diffs. The shape is the four tables `render_progress.py` reads: `[project]`, `[[milestones]]`, the active milestone's `[[tasks]]`, and `[[horizon]]`.
- `log.jsonl` — the **facts**, append-only (this skill writes here).
- `index.html` — the **render** (the renderer writes here; nobody else).

## Bootstrapping a new project

Create `docs/progress/roadmap.toml` (copy an existing project's as a template, or write one from the tables above: `[project]`, `[[milestones]]`, the active milestone's `[[tasks]]`, `[[horizon]]`), start an empty `log.jsonl`, and run the renderer. Then wire step 3 into that project's ship/done gate so it fires every time work lands.

## Quick start

```
python3 render_progress.py /path/to/project/docs/progress/
```
