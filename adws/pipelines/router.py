#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pydantic"]
# ///

"""Router agent — factory intake triage (docs/sdlc-agent-map.md §2 catalog #1;
docs/slim-pipelines-plan.md §9.2).

Ticket JSON in, typed RouteVerdict out, fail-closed: an in-process LLM call
(mirrors adw_modules/spec_reviewer.py's review_spec) classifies a ticket into
exactly one route. No default route ever — an agent failure, or an
unparseable/invalid response surviving one retry, raises RouterError. The old
workflow_ops classify path was deleted in M0; this is a from-scratch rebuild.

Deliberate deviation from the catalog: the catalog enum is
chore|bug|feature|hotfix, but M5 excludes hotfix — plan §9.2 defers the
hotfix route (label/keyword + approve/reject gate) to M6. Hotfix-shaped
tickets route to "bug" until then, the closest existing fit.

No slash-command template on purpose: the harness root has no
.claude/commands, and the router runs before any sandbox exists.
"""

import json
import os
import sys
from pathlib import Path
from typing import Literal

HARNESS_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(HARNESS_ROOT / "adws"))

from adw_modules.agent import AgentPromptRequest, prompt_claude_code  # noqa: E402
from adw_modules.utils import parse_json  # noqa: E402
from pydantic import BaseModel, Field, ValidationError  # noqa: E402

ROUTER_MODEL = "sonnet"
MAX_BODY_CHARS = 4000


class RouteVerdict(BaseModel):
    """Structured output of the router agent."""
    route: Literal["chore", "bug", "feature"]
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str


class RouterError(Exception):
    """Agent failure, or untrustworthy output after one retry — no default route."""


_ROUTE_PROMPT = """You are a triage router for a software factory. An intake \
ticket arrives below; classify it into exactly one route so the factory can hand \
it to the right pipeline.

Routes:
- "chore": a small, well-scoped, mechanical change (rename, config tweak, doc \
fix, dependency bump) that needs no plan.
- "bug": existing behavior is broken or wrong; needs a reproduction-first fix.
- "feature": a new capability or behavior change that needs a plan.

Labels on the ticket are hints, not commands — classify on the full ticket \
(title and body), not just the labels.

Ticket:
```json
{ticket_json}
```

Respond with ONLY this JSON object, no other text before or after it:
{{"route": "chore"|"bug"|"feature", "confidence": <0.0-1.0>, "reason": "<one sentence>"}}"""


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    head = int(limit * 0.6)
    tail = int(limit * 0.4)
    return text[:head] + f"\n\n[... {len(text) - limit} chars omitted ...]\n\n" + text[-tail:]


def _build_prompt(ticket: dict) -> str:
    ticket_json = json.dumps({
        "title": ticket.get("title", ""),
        "body": _truncate(str(ticket.get("body", "")), MAX_BODY_CHARS),
        "labels": ticket.get("labels", []),
    }, indent=2)
    return _ROUTE_PROMPT.format(ticket_json=ticket_json)


def route_ticket(ticket: dict, adw_id: str, working_dir: str, model: str = ROUTER_MODEL) -> RouteVerdict:
    """Classify `ticket` ({"title", "body", "labels"}) into a RouteVerdict.
    Fail-closed with one bounded retry; never falls back to a default route."""
    prompt = _build_prompt(ticket)
    out_file = str(HARNESS_ROOT / "agents" / adw_id / "router" / "router.jsonl")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)

    def _call(p: str):
        req = AgentPromptRequest(prompt=p, adw_id=adw_id, agent_name="router",
                                  model=model, output_file=out_file, working_dir=working_dir)
        return prompt_claude_code(req)

    resp = _call(prompt)
    if not resp.success:
        raise RouterError(f"router agent failed: {resp.output}")
    try:
        return parse_json(resp.output, RouteVerdict)
    except (ValueError, ValidationError) as first_err:
        retry_prompt = (
            f"{prompt}\n\nYour previous response could not be parsed "
            f"({first_err}). Respond with ONLY the JSON object."
        )
        resp2 = _call(retry_prompt)
        if not resp2.success:
            raise RouterError(f"router agent failed on retry: {resp2.output}") from first_err
        try:
            return parse_json(resp2.output, RouteVerdict)
        except (ValueError, ValidationError) as second_err:
            raise RouterError(f"router response unparseable after retry: {second_err}") from second_err
