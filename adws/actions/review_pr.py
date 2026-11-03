#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pydantic", "python-dotenv"]
# ///

"""The factory's Review task: a fresh-context, read-only, two-axis review of a
pull request from an agent branch (docs/factory/README.md).

.github/workflows/review.yml runs it in three steps, so that the agent never
holds a GitHub token and the step holding the GitHub token runs no agent:

  prepare  (GitHub token, no agent) writes the PR's diff, its Ticket (the
           issue its body closes) and the Ticket's parent Spec into --out.
  review   (Anthropic key, no GitHub token) runs one agent over those files
           with no shell and no write tools, capped at --max-budget-usd, and
           writes its two-axis findings into --out.
  apply    (GitHub token, no agent) posts the report on the PR and moves the
           labels: on a blocker `rework` plus a `rework:N` counter; after
           rework:3 the next blocker labels the PR ready-for-human instead.

Usage:
  uv run adws/actions/review_pr.py prepare --repo O/R --pr N --base-sha SHA \\
      --head-sha SHA --code-dir pr --out review-out
  uv run adws/actions/review_pr.py review --out review-out --model sonnet --max-budget-usd 2
  uv run adws/actions/review_pr.py apply --repo O/R --pr N --out review-out

Every step exits non-zero when it cannot do its job, so a run that did not
review goes red. A blocker is a review that worked: it exits 0.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List, Optional

ADWS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ADWS_DIR))

from adw_modules.agent import AgentPromptRequest, prompt_claude_code  # noqa: E402
from adw_modules.ticket_resolver import GhClient, Ticket, resolve_spec  # noqa: E402
from adw_modules.ticket_review import (  # noqa: E402
    TicketReview, TwoAxisFindings, build_pr_review_prompt, review_from_findings)
from adw_modules.utils import parse_json  # noqa: E402

REWORK_LABEL = "rework"
HUMAN_LABEL = "ready-for-human"
MAX_REWORK = 3
MODELS = ("sonnet", "opus", "haiku")
# Everything that could change a file, run a command or reach the network.
# The reviewer keeps Read, Grep and Glob.
DENIED_TOOLS = ("Bash", "Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch",
                "Agent", "Task")
MARKER = "<!-- factory:review -->"

_COUNTER_RE = re.compile(r"^rework:(\d+)$")
# GitHub's closing keywords, then #N or owner/repo#N.
_CLOSING_RE = re.compile(
    r"\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b:?[ \t]+(?:([\w.-]+/[\w.-]+))?#(\d+)\b",
    re.IGNORECASE)


# ---- pure decisions -------------------------------------------------------

def linked_ticket(body: str, repo: str) -> Optional[int]:
    """The issue in repo that the PR body closes (first one wins), if any."""
    for m in _CLOSING_RE.finditer(body or ""):
        if m.group(1) is None or m.group(1).lower() == repo.lower():
            return int(m.group(2))
    return None


def rework_round(labels: List[str]) -> int:
    """How many times review has blocked this PR, from its rework:N label."""
    rounds = [int(m.group(1)) for m in map(_COUNTER_RE.match, labels) if m]
    return max(rounds, default=0)


@dataclass(frozen=True)
class Moves:
    """What apply does to the PR's labels. remove runs before add, so a
    `rework` already on the PR comes off and goes back on, and the label
    event that starts Rework fires again."""
    outcome: str  # pass | rework | human | human-owned | stale
    add: tuple = ()
    remove: tuple = ()


def label_moves(labels: List[str], blocker: bool) -> Moves:
    labels = list(labels)
    if HUMAN_LABEL in labels:
        return Moves("human-owned")
    if not blocker:
        return Moves("pass", remove=(REWORK_LABEL,) if REWORK_LABEL in labels else ())
    done = rework_round(labels)
    if done >= MAX_REWORK:
        return Moves("human", add=(HUMAN_LABEL,),
                     remove=(REWORK_LABEL,) if REWORK_LABEL in labels else ())
    remove = tuple(l for l in labels if _COUNTER_RE.match(l))
    if REWORK_LABEL in labels:
        remove += (REWORK_LABEL,)
    return Moves("rework", add=(REWORK_LABEL, f"rework:{done + 1}"), remove=remove)


def _axis_verdict(axis) -> str:
    if any(i.issue_severity == "blocker" for i in axis.issues):
        return "BLOCKER"
    return "NOTES" if axis.issues else "PASS"


def render_report(review: TicketReview, ctx: dict, moves: Moves,
                  labels_after: List[str], stale_head: Optional[str] = None) -> str:
    """The PR comment: a headline, what was reviewed against, then each axis."""
    verdict = "PASS" if review.result.success else "BLOCKED"
    lines = [MARKER, f"## Factory review: {verdict}", ""]
    against = (f"Ticket {ctx['ticket_ref']}" if ctx.get("ticket_ref")
               else "the PR description (the PR closes no Ticket)")
    if ctx.get("spec_ref"):
        against += f" and Spec {ctx['spec_ref']}"
    lines.append(f"Reviewed `{ctx['head_sha'][:12]}` against {against}.")
    if ctx.get("spec_warning"):
        lines.append(f"Spec warning: {ctx['spec_warning']}")
    if moves.outcome == "rework":
        lines.append(f"Sent to rework: round {rework_round(labels_after)} of {MAX_REWORK}.")
    elif moves.outcome == "human":
        lines.append(f"Review blocked this PR again after {MAX_REWORK} rework rounds, "
                     f"so it is labelled `{HUMAN_LABEL}` and the factory stops here.")
    elif moves.outcome == "human-owned":
        lines.append(f"The PR is labelled `{HUMAN_LABEL}`, so no labels were changed.")
    elif moves.outcome == "stale":
        lines.append(f"The PR has moved on to `{(stale_head or '')[:12]}` since this "
                     "review started, so no labels were changed; the review of the new "
                     "head decides them.")
    for axis in review.axes:
        lines += ["", f"### {axis.name}: {_axis_verdict(axis)}", "", axis.summary or "(no summary)"]
        for issue in axis.issues:
            where = f" (`{issue.screenshot_path}`)" if issue.screenshot_path else ""
            lines.append(f"- **{issue.issue_severity}** {issue.issue_description}{where}. "
                         f"Fix: {issue.issue_resolution}")
    lines += ["", "Only a Spec blocker (a missing or wrongly implemented requirement) "
              "sends a PR to rework. The merge is a human's."]
    return "\n".join(lines) + "\n"


# ---- GitHub ---------------------------------------------------------------

class PrClient:
    """The pull-request calls this task makes, over the gh CLI."""

    def _gh(self, args: List[str]) -> subprocess.CompletedProcess:
        return subprocess.run(["gh", *args], capture_output=True, text=True)

    def view(self, repo: str, number: int) -> dict:
        r = self._gh(["pr", "view", str(number), "-R", repo, "--json",
                      "number,title,body,state,isDraft,headRefOid,labels,url"])
        if r.returncode != 0:
            raise RuntimeError(f"could not read PR {repo}#{number}: {r.stderr.strip()}")
        return json.loads(r.stdout)

    def comment(self, repo: str, number: int, body_file: Path) -> None:
        r = self._gh(["pr", "comment", str(number), "-R", repo, "--body-file", str(body_file)])
        if r.returncode != 0:
            raise RuntimeError(f"could not comment on PR {repo}#{number}: {r.stderr.strip()}")

    def edit_labels(self, repo: str, number: int, flag: str, labels: tuple) -> None:
        if not labels:
            return
        r = self._gh(["pr", "edit", str(number), "-R", repo, flag, ",".join(labels)])
        if r.returncode != 0:
            raise RuntimeError(
                f"could not {flag.lstrip('-')} {', '.join(labels)} on PR {repo}#{number}: "
                f"{r.stderr.strip()} (are the labels synced? uv run adws/actions/sync_labels.py --apply)")


def _labels(pr: dict) -> List[str]:
    return [l["name"] for l in pr.get("labels") or []]


# ---- the three steps ------------------------------------------------------

def prepare(args, prs: Optional[PrClient] = None, issues: Optional[GhClient] = None) -> int:
    prs, issues = prs or PrClient(), issues or GhClient()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    pr = prs.view(args.repo, args.pr)

    diff = subprocess.run(["git", "-C", args.code_dir, "diff", "--no-color",
                           f"{args.base_sha}...{args.head_sha}"],
                          capture_output=True, text=True)
    if diff.returncode != 0:
        raise RuntimeError(f"git diff {args.base_sha}...{args.head_sha} failed: {diff.stderr.strip()}")
    (out / "diff.patch").write_text(diff.stdout)

    ctx = {"repo": args.repo, "pr": args.pr, "pr_url": pr.get("url"),
           "base_sha": args.base_sha, "head_sha": args.head_sha,
           "code_dir": args.code_dir, "ticket_ref": None, "spec_ref": None,
           "spec_path": None, "spec_warning": None}
    number = linked_ticket(pr.get("body") or "", args.repo)
    if number is None:
        (out / "ticket.md").write_text(f"# {pr.get('title', '')}\n\n{pr.get('body') or ''}\n")
    else:
        issue = issues.get_issue(args.repo, number)
        if issue is None:
            raise RuntimeError(f"PR closes {args.repo}#{number}, which could not be read")
        (out / "ticket.md").write_text(f"# {issue.get('title', '')}\n\n{issue.get('body') or ''}\n")
        ticket = Ticket(repo=args.repo, number=number, title=issue.get("title", ""),
                        body=issue.get("body") or "", labels=(),
                        url=issue.get("url") or "")
        ctx["ticket_ref"] = ticket.ref
        spec = resolve_spec(ticket, args.code_dir, issues)
        ctx["spec_ref"], ctx["spec_warning"] = spec.ref, spec.warning
        if spec.kind == "issue":
            spec_repo, spec_number = spec.issue_coordinates()
            spec_issue = issues.get_issue(spec_repo, spec_number)
            if spec_issue is not None:
                (out / "spec.md").write_text(
                    f"# {spec_issue.get('title', '')}\n\n{spec_issue.get('body') or ''}\n")
                ctx["spec_path"] = str(out / "spec.md")
        elif spec.kind == "file" and spec.warning is None:
            ctx["spec_path"] = str(Path(args.code_dir) / spec.ref)
    (out / "context.json").write_text(json.dumps(ctx, indent=2) + "\n")
    print(f"Prepared PR {args.repo}#{args.pr} at {args.head_sha[:12]}: "
          f"Ticket {ctx['ticket_ref'] or 'none'}, Spec {ctx['spec_ref'] or 'none'}, "
          f"diff {len(diff.stdout.splitlines())} lines")
    return 0


def _result_message(transcript: Path) -> dict:
    """The CLI's closing result message from the agent's transcript, or {}."""
    if not transcript.is_file():
        return {}
    result = {}
    for line in transcript.read_text().splitlines():
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        if isinstance(msg, dict) and msg.get("type") == "result":
            result = msg
    return result


def review(args, run_agent: Callable = prompt_claude_code) -> int:
    out = Path(args.out)
    ctx = json.loads((out / "context.json").read_text())
    transcript = out / "reviewer" / "agent.jsonl"
    prompt = build_pr_review_prompt(
        pr_ref=f"{ctx['repo']}#{ctx['pr']}", diff_path=str(out / "diff.patch"),
        code_dir=ctx["code_dir"], base_sha=ctx["base_sha"], head_sha=ctx["head_sha"],
        ticket_path=str(out / "ticket.md"), ticket_ref=ctx["ticket_ref"],
        spec_path=ctx["spec_path"], spec_ref=ctx["spec_ref"])
    resp = run_agent(AgentPromptRequest(
        prompt=prompt,
        adw_id=f"review-pr{ctx['pr']}-{ctx['head_sha'][:8]}",
        agent_name="reviewer",
        model=args.model,
        # progress.log lands two levels up from the transcript: in --out.
        output_file=str(transcript),
        working_dir=os.getcwd(),
        disallowed_tools=list(DENIED_TOOLS),
        max_budget_usd=args.max_budget_usd,
    ))
    if not resp.success:
        result = _result_message(transcript)
        if result.get("subtype") == "error_max_budget_usd":
            raise RuntimeError(
                f"the review agent stopped at its budget cap (--max-budget-usd "
                f"{args.max_budget_usd:g}, spent ${result.get('total_cost_usd', 0):.2f}); "
                "raise FACTORY_REVIEW_BUDGET_USD for a diff this size")
        raise RuntimeError(f"the review agent failed: {resp.output}")
    try:
        findings = parse_json(resp.output, TwoAxisFindings)
    except Exception as e:
        raise RuntimeError(f"the review agent's findings could not be parsed: {e}") from e
    (out / "findings.json").write_text(findings.model_dump_json(indent=2) + "\n")
    result = review_from_findings(findings, ctx["spec_ref"]).result
    print(f"Review {'passed' if result.success else 'found a blocker'}: "
          f"{len(result.review_issues)} finding(s)")
    return 0


def apply(args, prs: Optional[PrClient] = None) -> int:
    prs = prs or PrClient()
    out = Path(args.out)
    ctx = json.loads((out / "context.json").read_text())
    findings = TwoAxisFindings.model_validate_json((out / "findings.json").read_text())
    ticket_review = review_from_findings(findings, ctx["spec_ref"])
    pr = prs.view(args.repo, args.pr)
    if pr.get("state") != "OPEN":
        print(f"PR {args.repo}#{args.pr} is {pr.get('state')}; nothing posted")
        return 0
    labels = _labels(pr)

    stale_head = pr.get("headRefOid") if pr.get("headRefOid") != ctx["head_sha"] else None
    moves = (Moves("stale") if stale_head
             else label_moves(labels, blocker=not ticket_review.result.success))
    labels_after = [l for l in labels if l not in moves.remove] + list(moves.add)

    report = render_report(ticket_review, ctx, moves, labels_after, stale_head)
    (out / "report.md").write_text(report)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write(report)
    prs.comment(args.repo, args.pr, out / "report.md")
    prs.edit_labels(args.repo, args.pr, "--remove-label", moves.remove)
    prs.edit_labels(args.repo, args.pr, "--add-label", moves.add)
    print(f"Posted the review on PR {args.repo}#{args.pr}: {moves.outcome}; "
          f"removed {list(moves.remove)}, added {list(moves.add)}")
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="step", required=True)

    p = sub.add_parser("prepare")
    p.add_argument("--repo", required=True)
    p.add_argument("--pr", type=int, required=True)
    p.add_argument("--base-sha", required=True)
    p.add_argument("--head-sha", required=True)
    p.add_argument("--code-dir", required=True)
    p.add_argument("--out", required=True)

    r = sub.add_parser("review")
    r.add_argument("--out", required=True)
    r.add_argument("--model", choices=MODELS, default="sonnet")
    r.add_argument("--max-budget-usd", type=float, required=True)

    a = sub.add_parser("apply")
    a.add_argument("--repo", required=True)
    a.add_argument("--pr", type=int, required=True)
    a.add_argument("--out", required=True)

    args = parser.parse_args(argv)
    if args.step == "review" and args.max_budget_usd <= 0:
        parser.error("--max-budget-usd must be positive")
    try:
        return {"prepare": prepare, "review": review, "apply": apply}[args.step](args)
    except RuntimeError as e:
        # A workflow command on stdout, so the run page shows it as an error.
        print(f"::error title=Factory review {args.step} failed::{e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
