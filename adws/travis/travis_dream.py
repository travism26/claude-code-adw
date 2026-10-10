#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic", "json-repair"]
# ///

"""Travis dreaming — consolidate run transcripts into project memory.

Usage:
  uv run travis_dream.py [adw-id ...] [--working-dir DIR] [--model MODEL] [--last N]

Mines recent SDLC run artifacts (state, agent result summaries, specs,
review issues) and regenerates the target project's memory store at
<working-dir>/ai_docs/memory/ with ONE consolidation LLM call. Pattern
adapted from Anthropic's cwc-workshops agents-that-remember Dreaming
service (https://github.com/anthropics/cwc-workshops, Apache-2.0):
existing memory + transcripts + instructions -> regenerated store.

Arguments:
  adw-id ...: Specific runs to consolidate. If omitted, uses --last N most
              recent runs under the harness agents/ dir.

Options:
  --working-dir DIR: Project whose memory to update (default: current directory)
  --model MODEL: Consolidation model (sonnet|opus|haiku, default: sonnet)
  --last N: When no adw-ids given, consolidate the N most recent runs (default: 5)

Outputs:
  - Regenerated ai_docs/memory/entries/*.md + MEMORY.md in the working dir
  - Per-entry change summary (+ add / ~ update / - delete / = keep) to stdout
  - Dreamer transcript under agents/{last_adw_id}/dreamer/ (cost tracked)

The memory changes land in the target's git — review the diff and revert
unwanted memories. Failed parse of the consolidation response leaves the
store untouched (exit 1).
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from typing import List, Literal, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from pydantic import BaseModel

from adw_modules.agent import AgentPromptRequest, prompt_claude_code
from adw_modules.memory import (
    MemoryEntry,
    delete_entry,
    memory_dir,
    read_entries,
    regenerate_index,
    write_entry,
)
from adw_modules.utils import parse_json, resolve_working_dir, setup_logger

HARNESS_ROOT = Path(__file__).resolve().parent.parent.parent

# Truncation caps for consolidation inputs (keep the call cheap)
MAX_RESULT_CHARS = 2000
MAX_SPEC_CHARS = 6000
MAX_RESEARCH_CHARS = 4000
MAX_REVIEW_CHARS = 3000

DEFAULT_LAST_N = 5


class DreamEntry(BaseModel):
    name: str
    description: str
    type: Literal["convention", "lesson", "pitfall"]
    body: str
    action: Literal["add", "update", "delete", "keep"]


class DreamResult(BaseModel):
    entries: List[DreamEntry]  # the COMPLETE new store (minus deletions)
    summary: str


CONSOLIDATION_PROMPT = """You are the memory consolidator ("dreamer") for an agentic software
development harness. You distill what was learned from recent automated
SDLC runs on a specific codebase into a small, durable memory store.

Do NOT use any tools. Respond with ONLY a JSON object, no other text.

## Existing memory store (preserve entries unless wrong or redundant)
{existing_entries_json}

## Recent run summaries
{run_summaries}

## What to remember
Record ONLY durable, reusable knowledge about THIS codebase:
- convention: how this project does things (build tooling, test runner,
  file layout, naming) that a future agent should follow.
- lesson: a generalizable insight that made a run go better or worse and
  would help next time.
- pitfall: a concrete trap that cost retries or review issues, plus how
  to avoid it.

Do NOT record:
- One-off task facts ("added a tags feature"), restated task prompts,
  run metrics/costs, or anything specific to a single feature.
- Anything already covered by an existing entry — UPDATE that entry
  instead of adding a near-duplicate.

## Rules
- Output the COMPLETE new store: include every existing entry you keep
  (action "keep"), plus updates/additions; mark removals action "delete".
- update-don't-duplicate: reuse an existing entry's `name` to revise it.
- delete-when-wrong: if these runs contradict an existing entry, mark it
  "delete" (or "update" with the correction).
- Keep each `body` under ~1500 characters and the whole store under ~25
  entries. If over, merge and prune the least useful entries.
- `name` is stable kebab-case; `description` is one line (<=100 chars).
- If the runs taught nothing durable, return the existing entries all
  marked "keep" and say so in `summary`.

Respond with ONLY this JSON shape:
{{"entries": [{{"name": "...", "description": "...", "type": "convention|lesson|pitfall", "body": "...", "action": "add|update|delete|keep"}}], "summary": "<1-2 sentences>"}}"""

RETRY_SUFFIX = "\n\nYour previous reply was not valid JSON. Reply with ONLY the JSON object described above."


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n... [truncated at {limit} chars]"


def find_recent_runs(last_n: int) -> list[str]:
    """Most recent adw_ids under harness agents/ that have travis state."""
    agents_root = HARNESS_ROOT / "agents"
    if not agents_root.is_dir():
        return []
    candidates = [
        d for d in agents_root.iterdir()
        if (d / "travis_state.json").exists()
    ]
    candidates.sort(key=lambda d: (d / "travis_state.json").stat().st_mtime, reverse=True)
    return [d.name for d in candidates[:last_n]]


def gather_run_summary(adw_id: str, working_dir: str) -> Optional[str]:
    """Build one run's summary from its small artifacts (never raw JSONL)."""
    run_dir = HARNESS_ROOT / "agents" / adw_id
    state_file = run_dir / "travis_state.json"
    if not state_file.exists():
        return None
    try:
        state = json.loads(state_file.read_text())
    except json.JSONDecodeError:
        return None

    parts = [f"### Run {adw_id}"]
    parts.append(f"Phase results: {json.dumps(state.get('phase_results', {}), indent=1)}")

    # Per-agent final result texts (small) — skip the dreamer itself
    for agent_dir in sorted(run_dir.iterdir()):
        if not agent_dir.is_dir() or agent_dir.name in ("dreamer", "judge_eval"):
            continue
        final_obj = agent_dir / "cc_final_object.json"
        if not final_obj.exists():
            continue
        try:
            data = json.loads(final_obj.read_text())
        except json.JSONDecodeError:
            continue
        result_text = data.get("result")
        if isinstance(result_text, str) and result_text.strip():
            parts.append(
                f"Agent {agent_dir.name} final output:\n{_truncate(result_text.strip(), MAX_RESULT_CHARS)}"
            )

    # Spec / research / review-issue files from the target
    wd = Path(working_dir)
    plan_file = state.get("plan_file")
    if plan_file and (wd / plan_file).exists():
        parts.append(f"Spec ({plan_file}):\n{_truncate((wd / plan_file).read_text(), MAX_SPEC_CHARS)}")
    research_file = state.get("research_file")
    if research_file and (wd / research_file).exists():
        parts.append(f"Research ({research_file}):\n{_truncate((wd / research_file).read_text(), MAX_RESEARCH_CHARS)}")
    review_issues = wd / "specs" / "review_issues" / f"review-{adw_id}.md"
    if review_issues.exists():
        parts.append(f"Review issues:\n{_truncate(review_issues.read_text(), MAX_REVIEW_CHARS)}")

    return "\n\n".join(parts)


def main():
    load_dotenv()

    adw_ids: list[str] = []
    working_dir_arg = None
    model = "sonnet"
    last_n = DEFAULT_LAST_N

    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "--working-dir":
            if i + 1 >= len(sys.argv):
                print("Error: --working-dir requires a value", file=sys.stderr)
                sys.exit(1)
            working_dir_arg = sys.argv[i + 1]
            i += 2
        elif arg == "--model":
            if i + 1 >= len(sys.argv):
                print("Error: --model requires a value (sonnet|opus|haiku)", file=sys.stderr)
                sys.exit(1)
            model = sys.argv[i + 1]
            if model not in ("sonnet", "opus", "haiku"):
                print(f"Error: Invalid model value: {model}", file=sys.stderr)
                sys.exit(1)
            i += 2
        elif arg == "--last":
            if i + 1 >= len(sys.argv):
                print("Error: --last requires a value", file=sys.stderr)
                sys.exit(1)
            try:
                last_n = int(sys.argv[i + 1])
            except ValueError:
                print(f"Error: Invalid --last value: {sys.argv[i + 1]}", file=sys.stderr)
                sys.exit(1)
            i += 2
        elif not arg.startswith("--"):
            adw_ids.append(arg)
            i += 1
        else:
            print(f"Error: Unknown argument: {arg}", file=sys.stderr)
            sys.exit(1)

    working_dir = resolve_working_dir(working_dir_arg)

    if not adw_ids:
        adw_ids = find_recent_runs(last_n)
    if not adw_ids:
        print("No runs found to consolidate (no agents/*/travis_state.json).", file=sys.stderr)
        sys.exit(1)

    logger = setup_logger(adw_ids[-1], "travis_dream")
    logger.info(f"Dreaming over runs: {', '.join(adw_ids)}")
    logger.info(f"Memory target: {memory_dir(working_dir)}")
    logger.info(f"Model: {model}")

    # Gather inputs
    summaries = []
    for adw_id in adw_ids:
        summary = gather_run_summary(adw_id, working_dir)
        if summary:
            summaries.append(summary)
        else:
            logger.warning(f"No usable artifacts for run {adw_id} — skipping")
    if not summaries:
        print("No usable run artifacts found.", file=sys.stderr)
        sys.exit(1)

    existing = read_entries(working_dir)
    existing_json = json.dumps(
        [{"name": e.name, "description": e.description, "type": e.type, "body": e.body}
         for e in existing],
        indent=1,
    ) if existing else "(empty — this is the first dream for this project)"

    prompt = CONSOLIDATION_PROMPT.format(
        existing_entries_json=existing_json,
        run_summaries="\n\n---\n\n".join(summaries),
    )

    # ONE consolidation call, cost-tracked like every agent (judge pattern)
    dreamer_dir = HARNESS_ROOT / "agents" / adw_ids[-1] / "dreamer"
    dreamer_dir.mkdir(parents=True, exist_ok=True)

    result: Optional[DreamResult] = None
    attempt_prompt = prompt
    for attempt in (1, 2):
        request = AgentPromptRequest(
            prompt=attempt_prompt,
            adw_id=adw_ids[-1],
            agent_name="dreamer",
            model=model,
            output_file=str(dreamer_dir / f"cc_raw_output_attempt{attempt}.jsonl"),
            working_dir=working_dir,
        )
        logger.info(f"Executing consolidation call (attempt {attempt})...")
        response = prompt_claude_code(request)
        if not response.success:
            logger.error(f"Consolidation call failed: {response.output[:300]}")
            print("Dream failed: consolidation call errored. Memory left untouched.", file=sys.stderr)
            sys.exit(1)
        try:
            result = parse_json(response.output, DreamResult)
            break
        except Exception as e:
            logger.warning(f"Parse failure on attempt {attempt}: {e}")
            attempt_prompt = prompt + RETRY_SUFFIX

    if result is None:
        print("Dream failed: consolidation response was not valid JSON after retry. "
              "Memory left untouched.", file=sys.stderr)
        sys.exit(1)

    # Apply: full regenerate — write kept/updated/added, drop deleted + absent
    existing_by_name = {e.name: e for e in existing}
    today = date.today().isoformat()
    kept_names = set()
    counts = {"add": 0, "update": 0, "delete": 0, "keep": 0}

    print(f"\nDream consolidated {len(summaries)} run(s) into {memory_dir(working_dir)} (model: {model})")
    for entry in result.entries:
        if entry.action == "delete":
            delete_entry(working_dir, entry.name)
            counts["delete"] += 1
            print(f"  - delete  {entry.type}-{entry.name}")
            continue

        prior = existing_by_name.get(entry.name)
        source_ids = list(prior.source_adw_ids) if prior else []
        for adw_id in adw_ids:
            if adw_id not in source_ids:
                source_ids.append(adw_id)
        entry_date = prior.date if (prior and entry.action == "keep") else today

        write_entry(working_dir, MemoryEntry(
            name=entry.name,
            description=entry.description,
            type=entry.type,
            body=entry.body,
            date=entry_date or today,
            source_adw_ids=source_ids,
        ))
        kept_names.add(entry.name)
        counts[entry.action] += 1
        marker = {"add": "+ add   ", "update": "~ update", "keep": "= keep  "}[entry.action]
        print(f"  {marker}  {entry.type}-{entry.name}  \"{entry.description}\"")

    # Full-regenerate semantics: anything on disk not in the result is removed
    for stale in [e for e in read_entries(working_dir) if e.name not in kept_names]:
        delete_entry(working_dir, stale.name)
        counts["delete"] += 1
        print(f"  - delete  {stale.type}-{stale.name}  (absent from consolidated store)")

    regenerate_index(working_dir)

    total = counts["add"] + counts["update"] + counts["keep"]
    print(f"\nNet: {total} entries ({counts['add']} added, {counts['update']} updated, "
          f"{counts['delete']} deleted, {counts['keep']} kept).")
    print(f"Dreamer says: {result.summary}")
    print("Review the memory diff in the target's git and revert anything unwanted.")
    logger.info(f"Dream complete: {counts}")


if __name__ == "__main__":
    main()
