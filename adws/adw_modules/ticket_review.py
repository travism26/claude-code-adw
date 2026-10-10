#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pydantic"]
# ///

"""Review a Ticket run against the Review oracle (ADR-0001).

Legacy `specs/` runs are reviewed by `/review` against the Plan. A Ticket run
is not: the Plan was written by the agent that built the work, so grading
against it grades the agent's own homework. Instead this module runs the
two-axis `/code-review` process inline, handed the references directly (so the
target repo needs no issue-tracker config):

  Spec       the diff against the Ticket's acceptance criteria first, then the
             parent Spec for scope creep and contradicted decisions. With no
             Spec, against the Ticket alone, and the review says so.
  Standards  the diff against the repo's own standards file, else the baseline
             smells.

The agent returns structured findings per axis. review_from_findings maps them
onto the existing ReviewResult, so the review-issues file, the review_failed
flag, draft-PR readiness and travis_patch are unchanged:

  Spec       missing_requirement  -> blocker
  Spec       implemented_wrongly  -> blocker
  Spec       scope_creep          -> tech_debt
  Standards  repo_standard        -> tech_debt
  Standards  baseline_smell       -> skippable
"""

import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Literal, Optional, Union

HARNESS_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(HARNESS_ROOT / "adws"))

from adw_modules.agent import AgentPromptRequest, prompt_claude_code  # noqa: E402
from adw_modules.data_types import ReviewIssue, ReviewResult  # noqa: E402
from adw_modules.ticket_resolver import SpecResolution, parse_reference  # noqa: E402
from adw_modules.utils import parse_json  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

REVIEW_MODEL = "sonnet"

SEVERITY = {
    "missing_requirement": "blocker",
    "implemented_wrongly": "blocker",
    "scope_creep": "tech_debt",
    "repo_standard": "tech_debt",
    "baseline_smell": "skippable",
}

NO_SPEC_NOTE = "No parent Spec: the Spec axis reviewed against the Ticket alone."


class Finding(BaseModel):
    """One review finding; each axis narrows kind to its own verdicts."""
    kind: str
    description: str
    resolution: str
    file_path: Optional[str] = None


class SpecFinding(Finding):
    kind: Literal["missing_requirement", "implemented_wrongly", "scope_creep"]


class StandardsFinding(Finding):
    kind: Literal["repo_standard", "baseline_smell"]


class TwoAxisFindings(BaseModel):
    """What the review agent returns: a summary and findings per axis."""
    spec_summary: str
    standards_summary: str
    spec_findings: List[SpecFinding] = Field(default_factory=list)
    standards_findings: List[StandardsFinding] = Field(default_factory=list)


@dataclass(frozen=True)
class AxisReview:
    """One axis of the review: its summary and its issues, already numbered
    within the whole review."""
    name: str
    summary: str
    issues: tuple


@dataclass(frozen=True)
class TicketReview:
    """The two-axis review of a Ticket run. result is the existing review
    result every downstream consumer reads; spec and standards keep the axes
    apart for the review output."""
    result: ReviewResult
    spec: AxisReview
    standards: AxisReview

    @property
    def axes(self) -> tuple:
        return (self.spec, self.standards)


def review_from_findings(findings: Union[TwoAxisFindings, dict],
                         spec_ref: Optional[str]) -> TicketReview:
    """Map two-axis findings onto the review result. The review passes unless
    a finding maps to a blocker. With no spec_ref the Spec axis says it
    reviewed against the Ticket alone."""
    if not isinstance(findings, TwoAxisFindings):
        findings = TwoAxisFindings.model_validate(findings)

    issues: list = []

    def _axis_issues(raw: list) -> tuple:
        out = []
        for f in raw:
            issue = ReviewIssue(
                review_issue_number=len(issues) + 1,
                screenshot_path=f.file_path,
                issue_description=f"[{f.kind}] {f.description}",
                issue_resolution=f.resolution,
                issue_severity=SEVERITY[f.kind],
            )
            issues.append(issue)
            out.append(issue)
        return tuple(out)

    spec_summary = findings.spec_summary.strip()
    if not spec_ref:
        spec_summary = f"{NO_SPEC_NOTE} {spec_summary}".strip()
    spec = AxisReview("Spec", spec_summary, _axis_issues(findings.spec_findings))
    standards = AxisReview("Standards", findings.standards_summary.strip(),
                           _axis_issues(findings.standards_findings))

    result = ReviewResult(
        success=not any(i.issue_severity == "blocker" for i in issues),
        review_summary=f"Spec: {spec.summary} Standards: {standards.summary}",
        review_issues=issues,
    )
    return TicketReview(result=result, spec=spec, standards=standards)


# ---- the agent -------------------------------------------------------------

_BASELINE_SMELLS = """\
- Mysterious Name: a name that doesn't reveal what it does or holds.
- Duplicated Code: the same logic shape in more than one hunk or file.
- Feature Envy: a function reaching into another object's data more than its own.
- Data Clumps: the same few fields or params travelling together.
- Primitive Obsession: a primitive standing in for a domain concept.
- Repeated Switches: the same switch/if-cascade on the same type recurring.
- Shotgun Surgery: one logical change forcing scattered edits across many files.
- Divergent Change: one module edited for several unrelated reasons.
- Speculative Generality: abstraction or hooks for needs the Ticket doesn't have.
- Message Chains: long a.b().c().d() navigation the caller shouldn't depend on.
- Middle Man: a class or function that mostly just delegates onward.
- Refused Bequest: an implementer that ignores most of what it inherits."""

_PROMPT = """You are reviewing a finished change along two separate axes, Spec and \
Standards, the way the two-axis /code-review does. Do not edit any file, do not \
run the build or the tests, and do not go looking for a Plan or any other \
requirement source of your own: the requirement sources are given below.

The change: `git diff {diff_base}...HEAD` (commits: `git log {diff_base}..HEAD --oneline`).

Requirement sources, in priority order:
1. PRIMARY, the Ticket {ticket_ref}. Read its body with \
`gh issue view {number} --repo {repo} --json title,body` (not its comments). Its \
acceptance criteria are the review oracle.
2. SECONDARY, {spec_source}

## Spec axis
Check the diff against every acceptance criterion of the Ticket, one by one, then \
against the Ticket's "what to build". {spec_use} Report each finding as one of:
- "missing_requirement": a criterion or asked-for behaviour that is missing or partial.
- "implemented_wrongly": it looks implemented but the implementation is wrong.
- "scope_creep": behaviour the Ticket didn't ask for, or that contradicts a Spec decision.
Quote the criterion or Spec line in the description.

## Standards axis
Find the repo's own standards file(s) (e.g. CODING_STANDARDS.md, CONTRIBUTING.md, \
a coding-standards section in CLAUDE.md or AGENTS.md). Report each place the diff \
violates one as "repo_standard", citing the file and rule. Also report any of these \
baseline smells as "baseline_smell" (always a judgement call; a documented repo \
standard overrides the baseline, and skip anything tooling enforces):
{smells}

Keep the axes separate: never move, merge or rerank a finding across axes.

Respond with ONLY this JSON object:
{{"spec_summary": "<1-3 sentences on the Spec axis>",
  "standards_summary": "<1-3 sentences on the Standards axis>",
  "spec_findings": [{{"kind": "missing_requirement"|"implemented_wrongly"|"scope_creep", \
"description": "...", "resolution": "...", "file_path": "path:line or null"}}],
  "standards_findings": [{{"kind": "repo_standard"|"baseline_smell", \
"description": "...", "resolution": "...", "file_path": "path:line or null"}}]}}"""


def build_ticket_review_prompt(ticket_ref: str, spec_ref: Optional[str],
                               diff_base: str) -> str:
    """The review agent's prompt: the Ticket and Spec references and the diff
    base. Never the Plan."""
    repo, number = parse_reference(ticket_ref)
    spec = SpecResolution.from_state(spec_ref, None)
    if spec.kind == "issue":
        spec_repo, spec_number = spec.issue_coordinates()
        spec_source = (f"the parent Spec {spec.ref}. Read it with `gh issue view "
                       f"{spec_number} --repo {spec_repo} --json title,body`.")
    elif spec.kind == "file":
        spec_source = f"the parent Spec in the repo at `{spec.ref}`."
    else:
        spec_source = "none: this Ticket has no parent Spec."
    spec_use = ("Then read the Spec only to flag scope creep and decisions the "
                "diff contradicts." if spec.ref else
                "There is no Spec, so judge scope against the Ticket alone and "
                "say so in spec_summary.")
    return _PROMPT.format(diff_base=diff_base, ticket_ref=ticket_ref, repo=repo,
                          number=number, spec_source=spec_source, spec_use=spec_use,
                          smells=_BASELINE_SMELLS)


def run_ticket_review(adw_id: str, ticket_ref: str, spec_ref: Optional[str],
                      diff_base: str, working_dir: str,
                      model: Optional[str] = None) -> TicketReview:
    """Review the run's diff against the Ticket (and Spec). Raises ValueError
    when the agent fails or its findings can't be parsed."""
    out_file = str(HARNESS_ROOT / "agents" / adw_id / "reviewer" / "ticket_review.jsonl")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    resp = prompt_claude_code(AgentPromptRequest(
        prompt=build_ticket_review_prompt(ticket_ref, spec_ref, diff_base),
        adw_id=adw_id,
        agent_name="reviewer",
        model=model or REVIEW_MODEL,
        output_file=out_file,
        working_dir=working_dir,
    ))
    if not resp.success:
        raise ValueError(f"Ticket review execution failed: {resp.output}")
    try:
        findings = parse_json(resp.output, TwoAxisFindings)
    except Exception as e:
        raise ValueError(f"Failed to parse Ticket review findings: {e}") from e
    return review_from_findings(findings, spec_ref)
