#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pydantic"]
# ///

"""Auto spec-reviewer — the headless half of the spec-review gate.

The gate (travis_sdlc.py, between plan and build) has two modes:

  human  pause after plan, write a review pointer, exit; the human edits the
         spec and `--resume`s into build. No code here — that lives in the
         orchestrator.

  auto   THIS module. An LLM spec-critic reads the freshly-planned spec against
         the original request and returns one of approve / revise / reject. On
         `revise` it edits the spec file in place (via tools) so the downstream
         build consumes the corrected spec; on `reject` the gate fails closed,
         exactly like a failed plan.

`auto` is what makes the gate eval-able: a pausing human gate can't be exercised
by the headless eval harness, so the eval drives this reviewer as variant B
(see docs/spec-review-gate-plan.md §6).

Mirrors the in-process agent-call pattern of adw_modules/bestof.py (judge_candidate).
"""

import os
import sys
from pathlib import Path
from typing import TYPE_CHECKING, Literal, Optional

HARNESS_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(HARNESS_ROOT / "adws"))

from adw_modules.agent import AgentPromptRequest, prompt_claude_code  # noqa: E402
from adw_modules.utils import parse_json  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

if TYPE_CHECKING:
    from adw_modules.ticket_resolver import Ticket

REVIEW_MODEL = "sonnet"
MAX_SPEC_CHARS = 12_000
MAX_PROMPT_CHARS = 8_000


class SpecVerdict(BaseModel):
    """Structured output of the auto spec-reviewer."""
    verdict: Literal["approve", "revise", "reject"]
    concerns: list[str] = Field(default_factory=list)
    summary: str


_REVIEW_PROMPT = """You are an impartial spec reviewer standing in for a human, \
at the gate between planning and implementation. A planning agent has written the \
spec below from the original request. Your job is to confirm the SPEC is correct \
and complete BEFORE any code is written — a wrong spec is the cheapest thing to fix now.

Original request:
<request>
{prompt}
</request>

The spec to review (file: {spec_path}):
<spec>
{spec}
</spec>

Decide one of:
- "approve": the spec faithfully and completely captures the request, with correct,
  testable acceptance criteria and no missing edge cases. Change nothing.
- "revise": the spec is salvageable but has fixable gaps (wrong/missing acceptance
  criterion, omitted edge case, contradicts the request). EDIT the spec file at
  {spec_path} in place using your tools to fix exactly those gaps — make the
  smallest change that corrects the spec; do not pad it or change its structure.
- "reject": the spec fundamentally misreads the request and is not salvageable by a
  small edit. Do not edit the file.

Judge the spec against the request only. Do not implement anything. Do not touch any
file other than the spec. After any edit, respond with ONLY this JSON object:
{{"verdict": "approve"|"revise"|"reject", "concerns": ["<short>", ...], "summary": "<one sentence>"}}"""


_TICKET_REVIEW_PROMPT = """You are an impartial Plan reviewer standing in for a human, \
at the gate between planning and implementation. A planning agent has written the \
Plan below for Ticket {ticket_ref}. Your job is to confirm the Plan delivers the \
Ticket's acceptance criteria BEFORE any code is written — a wrong Plan is the \
cheapest thing to fix now.

The Ticket's acceptance criteria — the review oracle:
<acceptance_criteria>
{criteria}
</acceptance_criteria>

The full Ticket:
<ticket>
{prompt}
</ticket>

The Plan to review (file: {spec_path}):
<plan>
{spec}
</plan>

Check the Plan against EVERY acceptance criterion, one by one. You must not approve \
a Plan that drops, weakens or contradicts any criterion — name each such criterion \
in "concerns".

Decide one of:
- "approve": the Plan covers every acceptance criterion and nothing in it contradicts
  the Ticket. Change nothing.
- "revise": the Plan is salvageable but misses or contradicts one or more criteria (or
  omits an edge case they imply). EDIT the Plan file at {spec_path} in place using
  your tools to cover exactly those criteria — make the smallest change that corrects
  the Plan; do not pad it or change its structure.
- "reject": the Plan fundamentally misreads the Ticket and is not salvageable by a
  small edit. Do not edit the file.

Judge the Plan against the Ticket only. Do not implement anything. Do not touch any
file other than the Plan. After any edit, respond with ONLY this JSON object:
{{"verdict": "approve"|"revise"|"reject", "concerns": ["<short>", ...], "summary": "<one sentence>"}}"""

_NO_CRITERIA = ("(The Ticket has no acceptance criteria section — judge the Plan "
                "against what the Ticket body asks for.)")


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    head = int(limit * 0.6)
    tail = int(limit * 0.4)
    return text[:head] + f"\n\n[... {len(text) - limit} chars omitted ...]\n\n" + text[-tail:]


def build_review_prompt(prompt: str, spec_path: str, spec_text: str,
                        ticket: Optional["Ticket"] = None) -> str:
    """The critic's prompt. On a Ticket run (`ticket` given) the Plan is judged
    against the Ticket's acceptance criteria; otherwise against the request."""
    fields = dict(
        prompt=_truncate(prompt, MAX_PROMPT_CHARS),
        spec_path=spec_path,
        spec=_truncate(spec_text, MAX_SPEC_CHARS),
    )
    if ticket is None:
        return _REVIEW_PROMPT.format(**fields)
    return _TICKET_REVIEW_PROMPT.format(
        ticket_ref=ticket.ref,
        criteria=_truncate(ticket.acceptance_criteria or _NO_CRITERIA, MAX_PROMPT_CHARS),
        **fields,
    )


def review_spec(
    adw_id: str,
    spec_path: str,
    prompt: str,
    working_dir: str,
    model: Optional[str] = None,
    ticket: Optional["Ticket"] = None,
) -> SpecVerdict:
    """Run the auto spec-critic. `spec_path` is relative to `working_dir`.
    `ticket` (an adw_modules.ticket_resolver.Ticket) makes its acceptance
    criteria the review oracle; None keeps the legacy request-only review.

    On a "revise" verdict the spec file at `spec_path` is edited in place by the
    agent. Raises on unreadable spec or unparseable agent output (the caller
    decides whether that fails the gate — it should, fail-closed).
    """
    abs_spec = Path(working_dir) / spec_path
    spec_text = abs_spec.read_text()

    review_prompt = build_review_prompt(prompt, spec_path, spec_text, ticket)
    out_file = str(HARNESS_ROOT / "agents" / adw_id / "spec_review" / "reviewer.jsonl")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)

    req = AgentPromptRequest(
        prompt=review_prompt,
        adw_id=adw_id,
        agent_name="spec_reviewer",
        model=model or REVIEW_MODEL,
        output_file=out_file,
        working_dir=working_dir,
    )
    resp = prompt_claude_code(req)
    return parse_json(resp.output, SpecVerdict)
