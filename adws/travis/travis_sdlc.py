#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic", "rich"]
# ///

"""Travis SDLC orchestrator - runs complete local workflow.

Usage:
  uv run travis_sdlc.py <prompt | spec-file | ticket> [adw-id] [--plan-type TYPE] [--model MODEL] [--effort LEVEL] [--planner NAME] [--risk-gate] [--review-spec[=human|auto]] [--attempts N] [--test-command CMD] [--draft-pr] [--worktree] [--worktree-base REF] [--remove-worktree] [--working-dir DIR] [--diff-base REF] [--no-memory] [--dream] [--tui] [--no-tui] [--skip-research] [--skip-review] [--skip-document] [--skip-validate] [--max-test-retries N] [--max-validation-retries N] [--validate-warnings-only] [--with-browser] [--mcp-config FILE] [--auto-capture] [--resume]

Executes the complete SDLC workflow locally:
0. Research - Analyze codebase before planning (optional, unless --skip-research)
1. Plan - Create implementation plan
2. Build - Implement the plan
3. Validate - Run architectural validation (unless --skip-validate)
4. Test - Run tests with automatic retry (up to 3 times by default)
5. Review - Review implementation (unless --skip-review)
6. Document - Generate docs (unless --skip-document)

Ticket runs (ADR-0001): the input may be a Ready Ticket instead of a prompt or
specs/ file — a GitHub issue URL, owner/repo#N, N or #N (bare forms use the
working dir's origin). The Ticket must be labelled ready-for-agent, not be
in-progress (unless this is a --resume of the run that claimed it) and live in
the working dir's repo, else the run is refused before anything is created.
It is also refused (target_not_installed, listing them) when the target lacks
a slash command the run will invoke (run_commands): looked for in
~/.claude/commands/ and the target's .claude/commands/ — in the base ref's tree
with --worktree, else in the working dir. A --resume skips that check.
Once accepted the Ticket is labelled in-progress, before any state, worktree,
agent call or PR exists; no other label is touched and none is removed. The
plan phase always runs on the Ticket's title + body; the document phase is
skipped; a draft PR is always opened (--draft-pr is implied), it takes the
Ticket's title and closes it, and the Ticket
gets one comment with the PR link and run id. The Ticket's parent Spec (sub-issue
parent, then `## Parent`/`Part of #N`, then a `Spec:` file line) reaches the
planner as a pointer; a missing, closed or absent Spec only warns, in the run
summary and the PR body. ticket_ref, spec_ref and spec_warning survive --resume.
Review judges a Ticket run's diff against the Ticket, then its Spec, on two
separate axes (Spec, Standards) and never against the Plan; only a missing or
wrongly implemented requirement keeps the draft PR in draft.

Options:
  --plan-type TYPE: Type of plan to create (feature|chore|bug; default: feature,
                  or for a Ticket its bug/chore/feature label, then keywords)
  --model MODEL: Model to use for planning (sonnet|opus, default: sonnet)
  --effort LEVEL: Claude effort level for every agent invocation
                  (low|medium|high|xhigh|max; default: CLI default, i.e. high).
                  Exported as ADW_AGENT_EFFORT to all phases; no effect on
                  haiku (no effort knob). Sweep axis for evals/sweep.py.
  --planner NAME: Which planner to use for phases 0-1 (default: travis).
                  See adws/travis/planners.py for the registry and
                  PLANNER_CONTRACT.md for how to add new planners.
  --risk-gate: Deny high-risk tool calls (destructive git, system paths,
                  credential stores — see adw_modules/risk_gate.py) via a
                  PreToolUse hook. Webhook/cron triggers enable this
                  automatically; use the flag for unattended manual runs.
  --review-spec[=human|auto]: Spec-review gate between plan and build (off by
                  default; env ADW_REVIEW_SPEC). human (default) pauses after
                  plan so a human reviews/edits the spec, then --resume continues
                  into build. auto runs an inline LLM spec-critic instead (no
                  pause; rejects fail closed) — see adw_modules/spec_reviewer.py.
  --attempts N: Best-of-N build — run N parallel build trajectories from the
                  shared plan in isolated git worktrees, score each with a
                  hybrid verifier (tests + LLM judge), apply the winner.
                  Default 1 (single build). Requires the target to be a git
                  repo with a commit. See adw_modules/bestof.py.
  --test-command CMD: Execution verifier for --attempts (e.g. "uv run pytest -q").
                  Optional; without it, best-of-N selects on the LLM judge alone.
  --draft-pr: Open a draft PR up front and push an incremental commit after
                  each phase, with a live progress checklist in the PR body;
                  mark it ready for review on success (never auto-merged —
                  approval is human). Degrades to a local branch when there's
                  no GitHub remote. Triggers enable this automatically.
                  See adw_modules/draft_pr.py.
  --working-dir DIR: Project directory to run the workflow against
                  (default: current directory). Forwarded to every phase.
  --worktree: Run the whole pipeline inside an isolated git worktree of the
                  target repo (branch adw/<id>, isolated ports under trees/<id>/),
                  so parallel runs against the same repo don't collide. Only
                  working_dir changes; state/logs stay keyed by adw_id. Composes
                  with --draft-pr and --attempts. See adw_modules/feature_worktree.py.
                  (ADW_WORKTREE=1 opts unattended runs in.)
  --worktree-base REF: Base ref for the --worktree checkout
                  (default: origin/main if it resolves, else HEAD).
  --remove-worktree: Remove the worktree after the run (default: keep it — the
                  branch holds the work for review).
  --diff-base REF: Git reference the test phase diffs against for intelligent
                  test selection, and that a Ticket review diffs against
                  (default: the worktree's base with --worktree, else
                  origin/main; use HEAD for fresh repos). Recorded in state as
                  diff_base, so travis_patch re-reviews against the same base.
  --no-memory: Skip injecting project memory (ai_docs/memory/) into the
                  research/plan/build agents
  --dream: After the workflow, consolidate this run into project memory
                  (only when the build phase succeeded; see travis_dream.py)
  --tui: Show a live split-pane TUI (Pipeline phases + tailed progress.log)
                  while the run executes (also via ADW_TUI=1). Auto-disables on a
                  non-TTY (CI, webhook/cron) and falls back to plain phase prints.
  --no-tui: Force the live TUI off even when ADW_TUI is set.
  --skip-research: Skip the research phase (ignored by planners that collapse research)
  --skip-review: Skip the review phase
  --skip-document: Skip the documentation phase
  --skip-validate: Skip the validation phase
  --max-test-retries N: Set maximum test retry attempts (default: 3)
  --max-validation-retries N: Set maximum validation retry attempts (default: 3)
  --validate-warnings-only: Run validation in report-only mode (don't fail on violations)
  --with-browser: Enable Chrome DevTools MCP for E2E/browser testing
  --mcp-config FILE: Use a specific MCP config file for testing
  --auto-capture: On a required-phase failure, copy the breaking agent I/O into
                  a tests/regression/ fixture + pytest stub (also via
                  ADW_AUTO_CAPTURE=1). Writes to the working tree only — never
                  commits; agents/ may hold secrets, so scrub before git add.
  --resume: Resume from the last completed phase (requires adw-id). The run
                  environment (--working-dir, --worktree[-base], --draft-pr) is
                  restored from the run's state when not re-passed explicitly.

Outputs:
  - Progress logging to console
  - Final summary with all phase results
  - State saved to agents/{adw_id}/travis_state.json
  - Logs written to agents/{adw_id}/travis_sdlc.log

Exit codes:
  0 - All phases succeeded
  1 - One or more phases failed
"""

import os
import sys
import json
import shlex
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple, Optional, Union

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from adw_modules.utils import setup_logger, make_adw_id, resolve_working_dir
from adw_modules.agent import parse_jsonl_output, convert_jsonl_to_json, save_last_entry_as_raw_result
from travis.travis_state import TravisState
from travis.planners import planner_choices, planner_help, get_planner
from adw_modules.fixture_capture import autocapture_phase_failure
from adw_modules import tui as tui_mod
from adw_modules.ticket_resolver import (
    GitHubClient, Refusal, SpecResolution, Ticket, claim_ticket, parse_reference,
    plan_type_for, post_run_comment, resolve_spec, resolve_ticket,
)
from travis.travis_plan import determine_slash_command

# Ordered list of all phases for resume logic
PHASE_ORDER = ["research", "plan", "build", "validate", "test", "review", "document"]

# Live pipeline TUI (Option A). None or a no-op NullTUI when disabled; set in
# main() for the duration of the phase loop. print_phase_header/result and
# run_phase consult it so the same call sites drive either plain prints or the
# split-pane view.
_TUI = tui_mod.NullTUI()

# Auto-capture context, set once in main(). When enabled, a required-phase
# failure routes the breaking agent I/O into a regression fixture (opt-in via
# --auto-capture or ADW_AUTO_CAPTURE; never commits — operator scrubs first).
_AUTOCAPTURE_CTX: dict = {"enabled": False, "adw_id": None}


def recover_phase_from_jsonl(adw_id: str, phase: str, agent_name: str, state: TravisState) -> bool:
    """Check if a phase's JSONL output shows success even though state wasn't saved.

    This handles the edge case where Claude Code completed successfully but the
    parent process hung (e.g., stdin blocking) before it could save state.

    Args:
        adw_id: The ADW workflow ID
        phase: Phase name (e.g., "build")
        agent_name: Agent name used for output directory (e.g., "builder")
        state: TravisState to update if recovery succeeds

    Returns:
        True if recovery succeeded and state was updated
    """
    project_root = Path(__file__).parent.parent.parent
    jsonl_path = project_root / "agents" / adw_id / agent_name / "cc_raw_output.jsonl"

    if not jsonl_path.exists():
        return False

    _, result_message = parse_jsonl_output(str(jsonl_path))
    if not result_message:
        return False

    if result_message.get("type") == "result" and result_message.get("subtype") == "success" and not result_message.get("is_error", False):
        # JSONL shows success — recover by saving state
        state.set_phase_result(phase, {
            "success": True,
            "message": f"Recovered from JSONL (duration: {result_message.get('duration_ms', 0)}ms)"
        })

        # Also run the post-processing that was missed
        json_file = convert_jsonl_to_json(str(jsonl_path))
        save_last_entry_as_raw_result(json_file)

        state.save()
        return True

    return False


def get_resume_phase(state: TravisState) -> Optional[str]:
    """Determine which phase to resume from based on state.

    Returns the name of the first phase that has NOT completed successfully,
    or None if all phases are complete.
    """
    for phase in PHASE_ORDER:
        result = state.get_phase_result(phase)
        if not result or not result.get("success"):
            return phase
    return None


def print_phase_header(phase_name: str) -> None:
    """Print a formatted phase header, or mark the phase running in the TUI."""
    if _TUI.enabled:
        _TUI.start_phase(phase_name)
        return
    print(f"\n{'='*70}")
    print(f"  {phase_name}")
    print(f"{'='*70}\n")


def print_phase_result(phase_name: str, success: bool, message: str = "") -> None:
    """Print a formatted phase result, or record it in the TUI."""
    if _TUI.enabled:
        _TUI.end_phase(phase_name, success)
        if message:
            _TUI.note(f"{phase_name}: {message}")
        return
    status = "✅ SUCCESS" if success else "❌ FAILED"
    print(f"\n{phase_name}: {status}")
    if message:
        print(f"  {message}")


def run_phase(
    script_name: str,
    args: list,
    phase_name: str,
    required: bool = True
) -> Tuple[bool, Optional[str]]:
    """Run a phase script and return (success, error_message).

    Args:
        script_name: Name of the script to run (e.g., "travis_plan.py")
        args: Arguments to pass to the script
        phase_name: Display name of the phase
        required: Whether failure should stop the workflow

    Returns:
        Tuple of (success, error_message)
    """
    print_phase_header(phase_name)

    # Build command
    script_path = Path(__file__).parent / script_name
    cmd = ["uv", "run", str(script_path)] + args

    # Run the script. With the live TUI active, the child's raw stdout would
    # fight the Rich Live display, so capture it to a per-run console log
    # (nothing is lost) and let the "Log" pane tail the curated progress.log.
    # Without the TUI, behavior is unchanged: output streams to the console.
    if _TUI.enabled and _TUI.console_log_path:
        try:
            with open(_TUI.console_log_path, "ab") as cf:
                cf.write(f"\n===== {phase_name} =====\n".encode())
                cf.flush()
                result = subprocess.run(cmd, stdout=cf, stderr=subprocess.STDOUT)
        except OSError:
            result = subprocess.run(cmd, capture_output=False, text=True)
    else:
        result = subprocess.run(
            cmd,
            capture_output=False,  # Let output go to console
            text=True
        )

    success = result.returncode == 0

    if success:
        print_phase_result(phase_name, True)
    else:
        error_msg = f"Script exited with code {result.returncode}"
        print_phase_result(phase_name, False, error_msg)
        if required:
            _maybe_autocapture(phase_name, result.returncode)
            return False, error_msg

    return True, None


def _maybe_autocapture(phase_name: str, returncode: int) -> None:
    """Capture a regression fixture for a required-phase failure, if enabled.

    No-ops unless auto-capture was turned on for this run. Best-effort: a
    capture failure must never mask the underlying phase failure.
    """
    if not _AUTOCAPTURE_CTX.get("enabled"):
        return
    adw_id = _AUTOCAPTURE_CTX.get("adw_id")
    if not adw_id:
        return
    try:
        result = autocapture_phase_failure(adw_id, phase_name, returncode=returncode)
        if result:
            fixture_dir, test_file = result
            project_root = Path(__file__).parent.parent.parent
            print(f"  Auto-captured regression fixture: {fixture_dir.relative_to(project_root)}")
            print(f"    Scrub secrets + wire the replay in {test_file.relative_to(project_root)} before committing.")
    except Exception as exc:  # best-effort — don't let capture mask the failure
        print(f"  (auto-capture skipped: {exc})")


def print_final_summary(state: TravisState) -> None:
    """Print final summary of all phases."""
    print(f"\n{'='*70}")
    print("  FINAL SUMMARY")
    print(f"{'='*70}\n")

    print(f"ADW ID: {state.adw_id}")
    print(f"Research File: {state.get('research_file', 'N/A')}")
    print(f"Plan File: {state.get('plan_file', 'N/A')}")
    if state.get("ticket_ref"):
        print(f"Ticket: {state.get('ticket_ref')}")
        print(f"Spec: {state.get('spec_ref') or 'none'}")
    if state.get("spec_warning"):
        print(f"⚠️  Spec warning: {state.get('spec_warning')}")
    print()

    phase_results = state.data.get("phase_results", {})

    # Research phase
    research = phase_results.get("research", {})
    if research:
        status = "✅ SUCCESS" if research.get("success") else "❌ FAILED"
        print(f"0. Research: {status}")
        if research.get("file"):
            print(f"   File: {research['file']}")

    # Plan phase
    plan = phase_results.get("plan", {})
    if plan:
        print(f"1. Plan:     {'✅ SUCCESS' if plan.get('success') else '❌ FAILED'}")
        if plan.get("file"):
            print(f"   File: {plan['file']}")

    # Build phase
    build = phase_results.get("build", {})
    if build:
        print(f"2. Build:    {'✅ SUCCESS' if build.get('success') else '❌ FAILED'}")

    # Validate phase
    validate = phase_results.get("validate", {})
    if validate:
        status = "✅ SUCCESS" if validate.get("success") else "❌ FAILED"
        print(f"3. Validate: {status}")
        if "critical" in validate:
            print(f"   Critical: {validate['critical']}, Warnings: {validate['warnings']}, Attempts: {validate['attempts']}")

    # Test phase
    test = phase_results.get("test", {})
    if test:
        status = "✅ SUCCESS" if test.get("success") else "❌ FAILED"
        print(f"4. Test:     {status}")
        if "passed" in test:
            print(f"   Passed: {test['passed']}, Failed: {test['failed']}, Attempts: {test['attempts']}")

    # Review phase
    review = phase_results.get("review", {})
    if review:
        status = "✅ SUCCESS" if review.get("success") else "❌ FAILED"
        print(f"5. Review:   {status}")
        if "issue_count" in review:
            print(f"   Issues: {review['issue_count']}")

    # Document phase
    document = phase_results.get("document", {})
    if document:
        status = "✅ SUCCESS" if document.get("success") else "❌ FAILED"
        print(f"6. Document: {status}")
        if document.get("documentation_created"):
            print(f"   Path: {document.get('documentation_path', 'N/A')}")

    print()


# --------------------------------------------------------------------------- #
# Spec-review gate (between plan and build). See docs/spec-review-gate-plan.md.
# --------------------------------------------------------------------------- #

def _spec_review_dir(adw_id: str) -> Path:
    """agents/<adw_id>/ — alongside travis_state.json (project root, not worktree)."""
    return Path(__file__).resolve().parent.parent.parent / "agents" / adw_id


def pr_ready_after_run(all_success: bool, review_result: Optional[dict]) -> bool:
    """A PR is flipped ready only when the run succeeded AND review (when it
    ran) did not fail. Review stays informational for the workflow exit code,
    but blocker findings must not produce a ready-for-review PR — the human
    reads specs/review_issues/ first."""
    return all_success and (review_result or {}).get("success") is not False


def pr_base_from_worktree(wt) -> Optional[str]:
    """PR base branch name for a draft PR opened inside a feature worktree.

    In a worktree the checkout is already on adw/<id>, so draft_pr.start()'s
    HEAD-derived base would equal the head branch and PR creation would always
    fail — derive the base from the ref the worktree was cut from instead.
    None (= let start() fall back) for HEAD/SHA-ish refs that can't name a base."""
    if wt is None or wt.base_ref == "HEAD":
        return None
    if wt.base_ref.startswith("origin/"):
        return wt.base_ref.split("/", 1)[1]
    return wt.base_ref


def infer_legacy_run_env(adw_id: str, state: TravisState) -> dict:
    """Best-effort run_env for states written before run_env was recorded.

    A worktree run is recoverable from disk: trees/<adw_id> knows its source
    repo via git metadata, and only the draft-pr loop writes state["branch"].
    Non-worktree legacy runs stay un-inferable and keep the cwd fallback."""
    from adw_modules.feature_worktree import HARNESS_ROOT
    wt_path = str(HARNESS_ROOT / "trees" / adw_id)
    if not os.path.isdir(wt_path):
        return {}
    r = subprocess.run(["git", "-C", wt_path, "rev-parse", "--git-common-dir"],
                       capture_output=True, text=True)
    common = r.stdout.strip()
    if r.returncode != 0 or not common:
        return {}
    if not os.path.isabs(common):
        common = os.path.join(wt_path, common)
    return {
        "working_dir": os.path.dirname(os.path.realpath(common)),
        "worktree": True,
        "worktree_base": None,
        "draft_pr": bool(state.get("branch")),
    }


def _original_flags(input_arg: str, adw_id: str) -> str:
    """The flag tokens of this invocation, re-quoted for the resume command.

    Drops the positionals (matched by exact value — the prompt and adw-id don't
    collide with flag values in practice) and any --resume already present."""
    toks = list(sys.argv[1:])
    for positional in (input_arg, adw_id):
        if positional in toks:
            toks.remove(positional)
    return " ".join(shlex.quote(t) for t in toks if t != "--resume")


def pause_for_spec_review(adw_id: str, plan_file: Optional[str], input_arg: str,
                          logger, ticket: Optional[Ticket] = None) -> None:
    """human mode: record the awaiting-approval status, write a review pointer,
    and print resume instructions. The caller exits 0 right after — the run is
    paused, not failed; `--resume` continues into build. On a Ticket run the
    pointer also carries the Ticket and its acceptance criteria, which the
    reviewer checks the Plan against."""
    state = TravisState.load(adw_id)
    spec_review = {"status": "awaiting_approval", "plan_file": plan_file}
    if ticket is not None:
        spec_review["ticket_ref"] = ticket.ref
    state.update(spec_review=spec_review)
    state.save()

    resume_cmd = " ".join(filter(None, [
        "uv run adws/travis/travis_sdlc.py",
        shlex.quote(input_arg),
        adw_id,
        _original_flags(input_arg, adw_id),
        "--resume",
    ]))
    resume_note = ("run resume_command to continue into build. It carries the "
                   "original flags; the run environment is also restored from "
                   "state on --resume.")
    pointer = {
        "adw_id": adw_id,
        "spec_file": plan_file,
        "status": "awaiting_approval",
        "resume_command": resume_cmd,
        "instructions": "Read and (if needed) edit the spec file, then " + resume_note,
    }
    if ticket is not None:
        pointer.update(
            ticket_ref=ticket.ref,
            ticket_url=ticket.url,
            acceptance_criteria=ticket.acceptance_criteria,
            instructions="Check the Plan (spec_file) against the Ticket's acceptance "
                         "criteria — every criterion must be covered and none "
                         "contradicted. Edit the Plan if needed, then " + resume_note,
        )
    pointer_path = _spec_review_dir(adw_id) / "spec_review.json"
    pointer_path.parent.mkdir(parents=True, exist_ok=True)
    pointer_path.write_text(json.dumps(pointer, indent=2))

    logger.info(f"Spec-review gate (human): paused awaiting approval of {plan_file}")
    print(f"\n{'='*70}")
    print("  ⏸  PAUSED FOR SPEC REVIEW")
    print(f"{'='*70}")
    print(f"  Spec:    {plan_file}")
    if ticket is not None:
        print(f"  Ticket:  {ticket.ref}  {ticket.url}")
        print("\n  Acceptance criteria to check the Plan against:\n")
        for line in (ticket.acceptance_criteria or "(none stated in the Ticket)").splitlines():
            print(f"    {line}")
        print()
    print(f"  Pointer: {pointer_path}")
    print("\n  Review (and edit if needed) the spec above, then resume with:\n")
    print(f"    {resume_cmd}\n")
    print("  (original flags included; the run environment is also restored from state)")
    print(f"{'='*70}\n")


def auto_review_spec(adw_id: str, plan_file: Optional[str], input_arg: str,
                     working_dir: str, logger,
                     ticket: Optional[Ticket] = None) -> Tuple[bool, str]:
    """auto mode: run the LLM spec-critic inline (no human). Returns (ok, message).
    `revise` edits the spec file in place. `reject` fails the gate (fail-closed),
    as does any error reading the spec or parsing the verdict. On a Ticket run
    the critic judges the Plan against the Ticket's acceptance criteria."""
    if not plan_file:
        return False, "no plan_file in state — cannot review"
    try:
        from adw_modules.spec_reviewer import review_spec
        verdict = review_spec(adw_id, plan_file, input_arg, working_dir, ticket=ticket)
    except Exception as e:
        # Fail closed: an unreviewable spec must not silently proceed to build.
        return False, f"spec reviewer failed ({type(e).__name__}: {e})"

    state = TravisState.load(adw_id)
    approved = verdict.verdict in ("approve", "revise")
    spec_review = {
        "status": "approved" if approved else "rejected",
        "plan_file": plan_file,
        "verdict": verdict.verdict,
        "concerns": verdict.concerns,
        "summary": verdict.summary,
    }
    if ticket is not None:
        spec_review["ticket_ref"] = ticket.ref
    state.update(spec_review=spec_review)
    state.save()

    detail = verdict.summary + (f" [{'; '.join(verdict.concerns)}]" if verdict.concerns else "")
    logger.info(f"Spec-review gate (auto): {verdict.verdict} — {detail}")
    if verdict.verdict == "reject":
        return False, f"spec rejected: {detail}"
    return True, f"spec {verdict.verdict}: {detail}"


def ticket_reference_for_run(input_arg: str, resume_state) -> Optional[str]:
    """The Ticket reference this run works on, or None for a legacy spec/prompt run.

    On --resume the recorded ticket_ref wins, so a resumed Ticket run keeps its
    Ticket whatever positional input is re-passed.
    """
    if resume_state is not None and resume_state.get("ticket_ref"):
        return resume_state.get("ticket_ref")
    if input_arg.startswith("specs/") or os.path.exists(input_arg):
        return None
    return input_arg if parse_reference(input_arg) else None


# The slash commands a Ticket run invokes in its target, in phase order. The
# phase scripts name them (travis_research/plan/build/validate/test/review and
# travis_openspec); keep this in step with them. No /document: a Ticket run
# skips that phase.
def run_commands(plan_type: str, planner: str = "travis", skip_research: bool = False,
                 skip_validate: bool = False, skip_review: bool = False) -> list:
    """The slash commands (names without the slash) a Ticket run will invoke."""
    if planner == "openspec":
        commands = ["opsx:propose"]
    else:
        commands = ([] if skip_research else ["research"]) + [plan_type]
    commands.append("implement")
    if not skip_validate:
        commands += ["validate", "resolve_validation_violation"]
    commands += ["test", "resolve_failed_test"]
    if not skip_review:
        commands.append("review")
    return commands


def default_user_commands_dir() -> Path:
    """User-level commands, which Claude Code resolves in every project."""
    return Path.home() / ".claude" / "commands"


def missing_commands(commands, working_dir: str, base_ref: Optional[str] = None,
                     user_commands_dir: Optional[Path] = None) -> list:
    """The commands the run would not find: in neither the user-level commands
    dir nor the target's .claude/commands/ (read from base_ref's tree when the
    run's worktree is cut from it, else from working_dir's files)."""
    user_dir = Path(user_commands_dir or default_user_commands_dir())
    missing = []
    for name in commands:
        rel = name.replace(":", "/") + ".md"  # /opsx:propose is opsx/propose.md
        if (user_dir / rel).is_file():
            continue
        if base_ref is not None:
            found = subprocess.run(
                ["git", "-C", working_dir, "cat-file", "-e",
                 f"{base_ref}:./.claude/commands/{rel}"],
                capture_output=True, text=True).returncode == 0
        else:
            found = (Path(working_dir) / ".claude" / "commands" / rel).is_file()
        if not found:
            missing.append(name)
    return missing


@dataclass
class Preflight:
    """What start_ticket needs to check the target before claiming: which
    commands the run calls (plan-type flag, planner, skipped phases) and where
    it will find them (its worktree base)."""
    plan_type: Optional[str] = None           # --plan-type
    planner: str = "travis"
    skip_research: bool = False
    skip_validate: bool = False
    skip_review: bool = False
    worktree: bool = False
    worktree_base: Optional[str] = None       # --worktree-base
    user_commands_dir: Optional[Path] = None  # default ~/.claude/commands


def target_preflight(ticket: Ticket, working_dir: str,
                     preflight: Preflight) -> Optional[Refusal]:
    """Refuse a target missing a slash command the run will invoke, else None.

    A --worktree run finds its commands in the base ref its worktree is cut
    from (resolve_base_ref), not in working_dir's files."""
    commands = run_commands(ticket_plan_type(ticket, preflight.plan_type), preflight.planner,
                            preflight.skip_research, preflight.skip_validate,
                            preflight.skip_review)
    base_ref = None
    if preflight.worktree:
        from adw_modules.feature_worktree import resolve_base_ref
        base_ref = resolve_base_ref(working_dir, preflight.worktree_base)
    missing = missing_commands(commands, working_dir, base_ref, preflight.user_commands_dir)
    if not missing:
        return None
    where = f"{working_dir} at {base_ref}" if base_ref is not None else working_dir
    return Refusal(
        "target_not_installed",
        f"{where} is missing the pipeline's slash commands "
        + ", ".join(f"/{m}" for m in missing)
        + " (install them into .claude/commands/ from template_claude/commands/)",
        missing=tuple(missing))


def start_ticket(ticket_ref: str, working_dir: str, resume_state,
                 client: Optional[GitHubClient] = None,
                 preflight: Optional[Preflight] = None) -> Union[Ticket, Refusal]:
    """Resolve the Ticket, check the target, and claim it (label it
    in-progress), or refuse.

    A refused Ticket is never labelled. A --resume of a Ticket run (its state
    recorded ticket_ref, written only after the claim) is the claiming run, so
    the Ticket's in-progress label does not refuse it and the target is not
    re-checked. A target missing a slash command the run will invoke is
    refused (target_not_installed): the run would claim the Ticket and open a
    PR, then fail at its first agent call. A Ticket that cannot be claimed is
    refused: running unclaimed could collide with another run.
    """
    resuming = resume_state is not None and bool(resume_state.get("ticket_ref"))
    resolved = resolve_ticket(ticket_ref, working_dir, client=client, resuming=resuming)
    if isinstance(resolved, Refusal):
        return resolved
    if not resuming:
        refusal = target_preflight(resolved, working_dir, preflight or Preflight())
        if refusal is not None:
            return refusal
    if not claim_ticket(resolved, client=client):
        return Refusal("claim_failed",
                       f"could not label {resolved.ref} in-progress to claim it")
    return resolved


def run_diff_base(explicit: Optional[str], wt, recorded: Optional[str] = None) -> str:
    """The ref the run's diff is measured against: an explicit --diff-base,
    else the base a resumed run recorded, else the base the worktree was cut
    from (so a --worktree-base run is reviewed against its own base), else
    origin/main.

    A worktree cut from "HEAD" (no origin/main) is pinned to the source repo's
    commit: inside the worktree "HEAD" is the run's own tip, so an unpinned
    base would diff the run against itself."""
    if explicit:
        return explicit
    if recorded:
        return recorded
    if wt is None:
        return "origin/main"
    if wt.base_ref == "HEAD":
        r = subprocess.run(["git", "-C", wt.source_repo, "rev-parse", "HEAD"],
                           capture_output=True, text=True)
        if r.returncode == 0:
            return r.stdout.strip()
    return wt.base_ref


@dataclass
class RunInput:
    """What the run was started from, reduced to what the phases need."""
    plan_input: str             # argv for the planner scripts
    plan_type: str
    skip_document: bool
    pr_title: str
    issue_number: Optional[str]  # rendered as `Closes #N` in the draft PR
    ticket: Optional[Ticket] = None


def spec_for_run(ticket: Ticket, working_dir: str, resume_state,
                 resolve=None) -> SpecResolution:
    """The Ticket's parent Spec. On --resume the recorded spec_ref and
    spec_warning win, so a resumed run keeps the Spec (and warning) it started with."""
    if resume_state is not None and (resume_state.get("spec_ref")
                                     or resume_state.get("spec_warning")):
        return SpecResolution.from_state(resume_state.get("spec_ref"),
                                         resume_state.get("spec_warning"))
    return (resolve or resolve_spec)(ticket, working_dir)


def ticket_plan_type(ticket: Ticket, plan_type: Optional[str]) -> str:
    """--plan-type, else the Ticket's bug/chore/feature label, else keywords."""
    return plan_type_for(ticket, plan_type,
                         detect=lambda text: determine_slash_command(text).lstrip("/"))


def build_run_input(input_arg: str, plan_type: Optional[str], skip_document: bool,
                    ticket: Optional[Ticket] = None,
                    spec: Optional[SpecResolution] = None) -> RunInput:
    """A Ticket run plans from the Ticket itself (never skipping the plan phase)
    and skips the document phase (ADR-0001). The parent Spec reaches the planner
    as a one-line pointer after the Ticket, never inlined. Legacy input is
    passed through."""
    if ticket is None:
        title_seed = (Path(input_arg).name if os.path.exists(input_arg)
                      else (input_arg.strip().splitlines() or [""])[0])
        return RunInput(input_arg, plan_type or "feature", skip_document,
                        f"ADW: {title_seed[:72]}",
                        os.environ.get("ADW_ISSUE_NUMBER") or None)
    detected = ticket_plan_type(ticket, plan_type)
    plan_input = ticket.as_plan_input()
    pointer = spec.pointer() if spec is not None else ""
    if pointer:
        plan_input += f"\n---\n\n{pointer}\n"
    return RunInput(plan_input, detected, True, ticket.title, str(ticket.number), ticket)


def announce_pr_on_ticket(ticket: Ticket, pr_url: Optional[str], adw_id: str,
                          state, client=None) -> bool:
    """Post the run's one comment on its Ticket once a PR is open.

    The state marker keeps a resumed run (which adopts the same PR) from
    commenting twice. It touches no labels.
    """
    if not pr_url or state.get("ticket_comment_pr") == pr_url:
        return False
    if not post_run_comment(ticket, pr_url, adw_id, client=client):
        return False
    state.data["ticket_comment_pr"] = pr_url
    state.save()
    return True


def planned_phase_labels(
    planner_spec,
    skip_research: bool,
    skip_validate: bool,
    skip_review: bool,
    skip_document: bool,
    attempts: int,
    review_spec: bool,
    review_spec_mode: str,
) -> list:
    """Phase labels the run will execute, in order, for the TUI's Pipeline pane.

    Mirrors the dispatch conditions in main()'s phase loop so the left column
    can show upcoming phases as pending ○. Drift is self-healing: any label the
    loop emits that isn't seeded here is appended live by the TUI.
    """
    labels = []
    for ps in planner_spec.scripts:
        if ps.is_research and planner_spec.honors_skip_research and skip_research:
            continue
        labels.append(ps.phase_label)
    if review_spec and review_spec_mode == "auto":
        labels.append("Spec Review (auto)")
    labels.append("Phase 2: Implementation" + (f" (best-of-{attempts})" if attempts > 1 else ""))
    if not skip_validate:
        labels.append("Phase 3: Validation")
    labels.append("Phase 4: Testing")
    if not skip_review:
        labels.append("Phase 5: Review")
    if not skip_document:
        labels.append("Phase 6: Documentation")
    return labels


def main():
    """Main entry point."""
    load_dotenv()

    if len(sys.argv) < 2:
        print("Usage: uv run travis_sdlc.py <prompt | spec-file | ticket> [adw-id] [--plan-type TYPE] [--model MODEL] [--effort LEVEL] [--planner NAME] [--risk-gate] [--review-spec[=human|auto]] [--attempts N] [--test-command CMD] [--draft-pr] [--worktree] [--worktree-base REF] [--remove-worktree] [--working-dir DIR] [--diff-base REF] [--tui] [--no-tui] [--skip-research] [--skip-review] [--skip-document] [--skip-validate] [--max-test-retries N] [--max-validation-retries N] [--validate-warnings-only] [--with-browser] [--mcp-config FILE] [--auto-capture] [--resume]", file=sys.stderr)
        print("\nPlanners:", file=sys.stderr)
        print(planner_help(), file=sys.stderr)
        sys.exit(1)

    # Parse arguments
    input_arg = sys.argv[1]
    adw_id = None
    plan_type = None  # --plan-type; None = feature for legacy input, label/keywords for a Ticket
    model = "opus"  # Default to opus for planning/research phases (sonnet used for build)
    effort = None  # claude --effort level; None = CLI default (high). See agent.py EFFORT_LEVELS.
    risk_gate = False  # PreToolUse deny hook for unattended runs (adw_modules/risk_gate.py)
    # Spec-review gate: pause after plan so the spec is reviewed before build spends
    # tokens. Off by default (headless stays the default). --review-spec[=human|auto];
    # env ADW_REVIEW_SPEC mirrors the trigger opt-in of ADW_RISK_GATE/ADW_DRAFT_PR.
    # human = pause + --resume; auto = inline LLM critic (adw_modules/spec_reviewer.py).
    _review_spec_env = os.environ.get("ADW_REVIEW_SPEC", "").strip().lower()
    review_spec = _review_spec_env in ("1", "true", "human", "auto")
    review_spec_mode = _review_spec_env if _review_spec_env in ("human", "auto") else "human"
    attempts = 1  # best-of-N build trajectories; 1 = normal single build (adw_modules/bestof.py)
    test_command = None  # execution verifier for best-of-N selection (optional)
    # Draft-PR loop: branch + incremental per-phase commits + a draft PR that is
    # marked ready only on success (adw_modules/draft_pr.py). Env lets triggers
    # opt unattended runs in, mirroring ADW_RISK_GATE.
    draft_pr_enabled = bool(os.environ.get("ADW_DRAFT_PR", "").strip())
    # Worktree isolation: run the whole pipeline inside an isolated git worktree of
    # the target repo (branch adw/<id>, isolated ports). Env mirrors the trigger
    # opt-in pattern used by ADW_DRAFT_PR/ADW_RISK_GATE. See feature_worktree.py.
    worktree_enabled = bool(os.environ.get("ADW_WORKTREE", "").strip())
    worktree_base = None       # --worktree-base REF; default resolved per repo
    remove_worktree_flag = False  # --remove-worktree; default keeps the worktree
    planner = "travis"  # default: existing research + plan scripts (see planners.py)
    # Auto-capture: on a required-phase failure, route the breaking agent I/O
    # into a tests/regression/ fixture (fixture_capture.autocapture_phase_failure).
    # Opt-in — agents/ may hold secrets, so it writes to the working tree only.
    auto_capture = bool(os.environ.get("ADW_AUTO_CAPTURE", "").strip())
    working_dir_arg = None
    diff_base = None  # --diff-base REF; resolved by run_diff_base once any worktree exists
    no_memory = False
    dream = False
    skip_research = False
    skip_review = False
    skip_document = False
    skip_validate = False # Default Skip validation
    max_test_retries = 3
    max_validation_retries = 3
    validate_warnings_only = False
    mcp_config: Optional[str] = None
    resume_mode = False
    tui_flag = False   # --tui: opt into the live split-pane TUI (Option A)
    no_tui_flag = False  # --no-tui: force the TUI off even if ADW_TUI is set

    # Process optional arguments
    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "--resume":
            resume_mode = True
            i += 1
        elif arg == "--plan-type":
            if i + 1 < len(sys.argv):
                plan_type = sys.argv[i + 1]
                if plan_type not in ["feature", "chore", "bug"]:
                    print(f"Error: Invalid plan-type value: {plan_type}. Must be 'feature', 'chore', or 'bug'", file=sys.stderr)
                    sys.exit(1)
                i += 2
            else:
                print("Error: --plan-type requires a value (feature|chore|bug)", file=sys.stderr)
                sys.exit(1)
        elif arg == "--auto-capture":
            auto_capture = True
            i += 1
        elif arg == "--tui":
            tui_flag = True
            i += 1
        elif arg == "--no-tui":
            no_tui_flag = True
            i += 1
        elif arg == "--skip-research":
            skip_research = True
            i += 1
        elif arg == "--skip-review":
            skip_review = True
            i += 1
        elif arg == "--skip-document":
            skip_document = True
            i += 1
        elif arg == "--model":
            if i + 1 < len(sys.argv):
                model = sys.argv[i + 1]
                if model not in ["sonnet", "opus", "haiku"]:
                    print(f"Error: Invalid model value: {model}. Must be 'sonnet', 'opus', or 'haiku'", file=sys.stderr)
                    sys.exit(1)
                i += 2
            else:
                print("Error: --model requires a value (sonnet|opus|haiku)", file=sys.stderr)
                sys.exit(1)
        elif arg == "--effort":
            if i + 1 < len(sys.argv):
                effort = sys.argv[i + 1]
                if effort not in ["low", "medium", "high", "xhigh", "max"]:
                    print(f"Error: Invalid effort value: {effort}. Must be 'low', 'medium', 'high', 'xhigh', or 'max'", file=sys.stderr)
                    sys.exit(1)
                i += 2
            else:
                print("Error: --effort requires a value (low|medium|high|xhigh|max)", file=sys.stderr)
                sys.exit(1)
        elif arg == "--risk-gate":
            risk_gate = True
            i += 1
        elif arg == "--review-spec" or arg.startswith("--review-spec="):
            review_spec = True
            if "=" in arg:
                review_spec_mode = arg.split("=", 1)[1]
                if review_spec_mode not in ("human", "auto"):
                    print(f"Error: Invalid --review-spec mode: {review_spec_mode}. Must be 'human' or 'auto'", file=sys.stderr)
                    sys.exit(1)
            i += 1
        elif arg == "--draft-pr":
            draft_pr_enabled = True
            i += 1
        elif arg == "--worktree":
            worktree_enabled = True
            i += 1
        elif arg == "--worktree-base":
            if i + 1 < len(sys.argv):
                worktree_base = sys.argv[i + 1]
                i += 2
            else:
                print("Error: --worktree-base requires a value", file=sys.stderr)
                sys.exit(1)
        elif arg == "--remove-worktree":
            remove_worktree_flag = True
            i += 1
        elif arg == "--attempts":
            if i + 1 < len(sys.argv):
                try:
                    attempts = int(sys.argv[i + 1])
                except ValueError:
                    print("Error: --attempts requires an integer (e.g. 3)", file=sys.stderr)
                    sys.exit(1)
                if attempts < 1:
                    print("Error: --attempts must be >= 1", file=sys.stderr)
                    sys.exit(1)
                i += 2
            else:
                print("Error: --attempts requires a value", file=sys.stderr)
                sys.exit(1)
        elif arg == "--test-command":
            if i + 1 < len(sys.argv):
                test_command = sys.argv[i + 1]
                i += 2
            else:
                print("Error: --test-command requires a value", file=sys.stderr)
                sys.exit(1)
        elif arg == "--planner":
            if i + 1 < len(sys.argv):
                planner = sys.argv[i + 1]
                if planner not in planner_choices():
                    print(f"Error: Invalid planner value: {planner}. Must be one of: {', '.join(planner_choices())}", file=sys.stderr)
                    sys.exit(1)
                i += 2
            else:
                print(f"Error: --planner requires a value ({'|'.join(planner_choices())})", file=sys.stderr)
                sys.exit(1)
        elif arg == "--working-dir":
            if i + 1 < len(sys.argv):
                working_dir_arg = sys.argv[i + 1]
                i += 2
            else:
                print("Error: --working-dir requires a value", file=sys.stderr)
                sys.exit(1)
        elif arg == "--diff-base":
            if i + 1 < len(sys.argv):
                diff_base = sys.argv[i + 1]
                i += 2
            else:
                print("Error: --diff-base requires a value", file=sys.stderr)
                sys.exit(1)
        elif arg == "--no-memory":
            no_memory = True
            i += 1
        elif arg == "--dream":
            dream = True
            i += 1
        elif arg == "--skip-validate":
            skip_validate = True
            i += 1
        elif arg == "--validate-warnings-only":
            validate_warnings_only = True
            i += 1
        elif arg == "--max-validation-retries":
            if i + 1 < len(sys.argv):
                try:
                    max_validation_retries = int(sys.argv[i + 1])
                    i += 2
                except ValueError:
                    print(f"Error: Invalid max-validation-retries value: {sys.argv[i + 1]}", file=sys.stderr)
                    sys.exit(1)
            else:
                print("Error: --max-validation-retries requires a value", file=sys.stderr)
                sys.exit(1)
        elif arg == "--max-test-retries":
            if i + 1 < len(sys.argv):
                try:
                    max_test_retries = int(sys.argv[i + 1])
                    i += 2
                except ValueError:
                    print(f"Error: Invalid max-test-retries value: {sys.argv[i + 1]}", file=sys.stderr)
                    sys.exit(1)
            else:
                print("Error: --max-test-retries requires a value", file=sys.stderr)
                sys.exit(1)
        elif arg == "--with-browser":
            mcp_config = ".mcp-browser.json"
            i += 1
        elif arg == "--mcp-config":
            if i + 1 < len(sys.argv):
                mcp_config = sys.argv[i + 1]
                i += 2
            else:
                print("Error: --mcp-config requires a value", file=sys.stderr)
                sys.exit(1)
        elif not adw_id and not arg.startswith("--"):
            # This is the adw_id
            adw_id = arg
            i += 1
        else:
            print(f"Error: Unknown argument: {arg}", file=sys.stderr)
            sys.exit(1)

    # Generate adw_id if not provided
    if not adw_id:
        if resume_mode:
            print("Error: --resume requires an adw-id argument", file=sys.stderr)
            sys.exit(1)
        adw_id = make_adw_id()

    # Resume rehydration: restore the execution environment recorded at run
    # start, so a bare `<input> <adw-id> --resume` continues where the run
    # actually lives instead of falling back to the harness cwd (where the
    # slash commands don't exist). Explicit flags still win.
    _resume_state = None
    if resume_mode:
        _resume_state = TravisState.load(adw_id)
        run_env = (_resume_state.get("run_env")
                   or infer_legacy_run_env(adw_id, _resume_state))
        if working_dir_arg is None and run_env.get("working_dir"):
            working_dir_arg = run_env["working_dir"]
        if not worktree_enabled and run_env.get("worktree"):
            worktree_enabled = True
        if worktree_base is None and run_env.get("worktree_base"):
            worktree_base = run_env["worktree_base"]
        if not draft_pr_enabled and run_env.get("draft_pr"):
            draft_pr_enabled = True

    working_dir = resolve_working_dir(working_dir_arg)

    # Ticket intake (ADR-0001): resolve and claim before any log, state,
    # worktree, agent call or PR exists, so a refused Ticket leaves nothing
    # behind (not even a label).
    ticket = None
    spec = None
    ticket_ref = ticket_reference_for_run(input_arg, _resume_state)
    if ticket_ref:
        resolved = start_ticket(ticket_ref, working_dir, _resume_state, preflight=Preflight(
            plan_type=plan_type, planner=planner, skip_research=skip_research,
            skip_validate=skip_validate, skip_review=skip_review,
            worktree=worktree_enabled, worktree_base=worktree_base))
        if isinstance(resolved, Refusal):
            print(f"Error: Ticket refused ({resolved.reason}): {resolved.message}", file=sys.stderr)
            sys.exit(1)
        ticket = resolved
        # A missing or doubtful Spec warns but never refuses the Ticket.
        spec = spec_for_run(ticket, working_dir, _resume_state)
        # A Ticket run ends in a draft PR that closes the Ticket; without one
        # there is nothing to link from the Ticket comment.
        draft_pr_enabled = True
    run_input = build_run_input(input_arg, plan_type, skip_document, ticket, spec)
    # input_arg stays the raw argv[1] (the resume command re-passes it);
    # planners and the spec critic get plan_input (the Ticket text for a Ticket run).
    plan_input, plan_type, skip_document = run_input.plan_input, run_input.plan_type, run_input.skip_document

    # Setup logging
    logger = setup_logger(adw_id, "travis_sdlc")
    # Effort reaches agent.py through the environment (phases inherit it via
    # run_phase → subprocess → prompt_claude_code), so phase runners need no
    # changes. See AgentPromptRequest.effort for the per-request override.
    if effort:
        os.environ["ADW_AGENT_EFFORT"] = effort

    # Risk gate reaches agent.py the same way (env → all phase subprocesses).
    # Triggers (webhook/cron) set ADW_RISK_GATE themselves; the flag is for
    # explicitly running an unattended SDLC by hand.
    if risk_gate:
        os.environ["ADW_RISK_GATE"] = "1"

    # Arm auto-capture for run_phase. Set here (not threaded through each
    # run_phase call) so all phases pick it up once adw_id is final. The env
    # var also reaches phase subprocesses that capture their own breaks
    # directly (e.g. travis_validate.py's fail-closed gate).
    if auto_capture:
        _AUTOCAPTURE_CTX["enabled"] = True
        _AUTOCAPTURE_CTX["adw_id"] = adw_id
        os.environ["ADW_AUTO_CAPTURE"] = "1"

    # Record the execution environment for --resume rehydration (see above).
    # Written before the worktree swap so working_dir is the target root.
    # Direct data[] assignment: update() drops keys absent from a loaded
    # legacy state, which silently no-ops exactly when it matters most.
    run_state = TravisState.load(adw_id)
    run_state.data["run_env"] = {
        "working_dir": working_dir,
        "worktree": worktree_enabled,
        "worktree_base": worktree_base,
        "draft_pr": draft_pr_enabled,
    }
    if ticket is not None:
        run_state.data["ticket_ref"] = ticket.ref
        run_state.data["spec_ref"] = spec.ref
        run_state.data["spec_warning"] = spec.warning
    run_state.save()

    # Worktree isolation: cut an isolated worktree of the target repo and point
    # every phase at it. Only working_dir changes — state/logs stay under the
    # harness agents/<adw_id>/ keyed by adw_id (see feature_worktree.py). Done
    # before the phase loop so draft_pr/build/test/etc. all run inside it.
    wt = None
    if worktree_enabled:
        from adw_modules.feature_worktree import create_feature_worktree
        wt, wt_err = create_feature_worktree(
            adw_id, working_dir, logger, base_ref=worktree_base
        )
        if wt_err:
            logger.error(f"Worktree setup failed: {wt_err}")
            print(f"Error: worktree setup failed: {wt_err}", file=sys.stderr)
            sys.exit(1)
        working_dir = wt.path
        os.environ["ADW_BACKEND_PORT"] = str(wt.backend_port)
        os.environ["ADW_FRONTEND_PORT"] = str(wt.frontend_port)
        # Ports are injected as env vars only — never written into the worktree.
        # The old in-tree .ports.env rode `git add -A` phase commits into target
        # PRs; the plain names below are the ones that file used to define, so
        # target commands/tools that read them keep working.
        os.environ["BACKEND_PORT"] = str(wt.backend_port)
        os.environ["FRONTEND_PORT"] = str(wt.frontend_port)
        os.environ["VITE_BACKEND_URL"] = f"http://localhost:{wt.backend_port}"
        if remove_worktree_flag:
            # Clean up on normal exit, sys.exit, or unhandled crash. The branch
            # is kept regardless — only the working tree is removed.
            import atexit
            from adw_modules.feature_worktree import remove_feature_worktree
            atexit.register(remove_feature_worktree, wt, logger)

    # An unset diff base follows the worktree base. Recorded so a later
    # travis_patch re-review (or a --resume) compares against the same base.
    run_state = TravisState.load(adw_id)
    diff_base = run_diff_base(diff_base, wt, recorded=run_state.get("diff_base"))
    run_state.data["diff_base"] = diff_base
    run_state.save()

    logger.info(f"Travis SDLC starting - ADW ID: {adw_id}")
    if ticket is not None:
        logger.info(f"Ticket: {ticket.ref} — {ticket.title}")
        logger.info(f"Spec: {spec.ref or 'none'}")
        if spec.warning:
            logger.warning(f"Spec warning: {spec.warning}")
    logger.info(f"Plan type: {plan_type}, Model: {model}, Effort: {effort or 'default (high)'}")
    logger.info(f"Planner: {planner}" + (" (EXPERIMENTAL)" if planner != "travis" else ""))
    logger.info(f"Working dir: {working_dir}")
    logger.info(f"Diff base: {diff_base}")
    logger.info(f"Memory: {'disabled (--no-memory)' if no_memory else 'enabled when ai_docs/memory/ exists'}")
    logger.info(f"Dream after run: {dream}")
    logger.info(f"Skip research: {skip_research}, Skip review: {skip_review}, Skip document: {skip_document}, Skip validate: {skip_validate}")
    logger.info(f"Max test retries: {max_test_retries}, Max validation retries: {max_validation_retries}")
    logger.info(f"Validate warnings only: {validate_warnings_only}")
    logger.info(f"MCP config: {mcp_config or 'None (default)'}")
    logger.info(f"Resume mode: {resume_mode}")

    print(f"\n{'='*70}")
    print("  Travis SDLC Workflow")
    print(f"  ADW ID: {adw_id}")
    if planner != "travis":
        print(f"  Planner: {planner} (EXPERIMENTAL)")
    if resume_mode:
        print("  Mode: RESUME")
    print(f"{'='*70}\n")

    # Resume logic: determine which phases to skip
    resume_from_phase: Optional[str] = None
    if resume_mode:
        state = TravisState.load(adw_id)
        phase_results = state.data.get("phase_results", {})

        if not phase_results:
            print("No completed phases found in state — starting from scratch")
            logger.info("Resume: no completed phases, starting fresh")
        else:
            # Check for phases where JSONL succeeded but state wasn't saved (the hang bug)
            agent_map = {"build": "builder", "plan": "planner", "research": "researcher",
                         "test": "tester", "validate": "validator", "review": "reviewer",
                         "document": "documenter"}
            for phase_name, agent_name in agent_map.items():
                if phase_name not in phase_results:
                    if recover_phase_from_jsonl(adw_id, phase_name, agent_name, state):
                        print(f"  Recovered {phase_name} phase from JSONL output (completed but state was not saved)")
                        logger.info(f"Resume: recovered {phase_name} from JSONL")

            # Reload state after potential recovery
            state = TravisState.load(adw_id)
            resume_from_phase = get_resume_phase(state)

            if resume_from_phase is None:
                print("All phases already completed!")
                print_final_summary(state)
                sys.exit(0)

            # Print what we're skipping
            for phase in PHASE_ORDER:
                if phase == resume_from_phase:
                    break
                result = state.get_phase_result(phase)
                if result and result.get("success"):
                    print(f"  Skipping {phase}: already completed ✓")
                    logger.info(f"Resume: skipping completed phase {phase}")

            print(f"\n  Resuming from: {resume_from_phase}\n")
            logger.info(f"Resume: resuming from {resume_from_phase}")

    def should_skip_phase(phase: str) -> bool:
        """Check if a phase should be skipped due to resume mode."""
        if not resume_mode or resume_from_phase is None:
            return False
        try:
            return PHASE_ORDER.index(phase) < PHASE_ORDER.index(resume_from_phase)
        except ValueError:
            return False

    all_success = True
    failed_phase = None
    review_failed = False  # informational phase: never clears all_success, but
    # the final banner must not print an unqualified success over it

    # Draft-PR loop (opt-in): branch + per-phase commits + a draft PR opened up
    # front and marked ready only on success. Degrades to a local branch when
    # there's no GitHub remote. See adw_modules/draft_pr.py.
    dpr = None
    if draft_pr_enabled:
        from adw_modules import draft_pr
        dpr = draft_pr.start(
            working_dir, adw_id, run_input.pr_title, logger,
            issue_number=run_input.issue_number,
            base_branch=pr_base_from_worktree(wt),
            warnings=[spec.warning] if spec is not None and spec.warning else None,
        )
        # Persist branch + PR url so parent runners (fanout/multirepo) can read
        # them from travis_state.json without parsing logs.
        if dpr is not None:
            st = TravisState.load(adw_id)
            st.data["branch"] = dpr.branch
            if dpr.pr_url:
                st.data["pr_url"] = dpr.pr_url
            st.save()
        if ticket is not None:
            if dpr is None or not dpr.pr_url:
                logger.warning(f"Ticket {ticket.ref}: no draft PR was opened — the run "
                               "continues on a local branch and the Ticket gets no comment")
            elif st.get("ticket_comment_pr") != dpr.pr_url:
                if announce_pr_on_ticket(ticket, dpr.pr_url, adw_id, st):
                    logger.info(f"Ticket {ticket.ref}: commented with PR {dpr.pr_url}")
                else:
                    logger.warning(f"Ticket {ticket.ref}: could not post the PR comment "
                                   "(a --resume retries it)")

    def record_phase(label, ok, skipped=False):
        """Commit + push this phase to the draft PR (no-op when disabled)."""
        if dpr is not None:
            from adw_modules import draft_pr
            draft_pr.commit_phase(dpr, label, "skip" if skipped else ("ok" if ok else "fail"), logger)

    # Phases 0-1: Planning — dispatch via the planner registry (planners.py).
    # Planners that collapse research + plan (e.g. openspec) mark both
    # phase_results["research"] and ["plan"] as complete on success, so
    # resume logic walks past them naturally.
    planner_spec = get_planner(planner)

    # Live pipeline TUI (Option A). Opt-in via --tui / ADW_TUI; auto-disables on
    # non-TTY (CI, triggers) or when rich is unavailable — see adw_modules/tui.py.
    # NullTUI when disabled, so every call site below is a no-op then.
    global _TUI
    run_dir = str(Path(__file__).parent.parent.parent / "agents" / adw_id)
    _TUI = tui_mod.create(
        adw_id,
        planned_phase_labels(
            planner_spec, skip_research, skip_validate, skip_review,
            skip_document, attempts, review_spec, review_spec_mode,
        ),
        run_dir,
        enabled=tui_mod.tui_enabled(tui_flag, no_tui_flag),
        title=adw_id,
    )
    _TUI.start()

    for planner_script in planner_spec.scripts:
        # Honor --skip-research for planners with a separate research script
        if planner_script.is_research and planner_spec.honors_skip_research and skip_research:
            continue

        # Resume-mode skip: collapsed planners gate on "plan"; separate
        # research scripts gate on "research".
        resume_gate = "research" if planner_script.is_research else "plan"
        if should_skip_phase(resume_gate):
            continue

        script_args = [plan_input, adw_id]
        if planner_script.takes_plan_type:
            script_args.extend(["--plan-type", plan_type])
        script_args.extend(["--model", model, "--working-dir", working_dir])
        if no_memory and planner_script.script in ("travis_research.py", "travis_plan.py"):
            script_args.append("--no-memory")

        success, error = run_phase(
            planner_script.script,
            script_args,
            planner_script.phase_label,
            required=planner_script.required
        )
        if not success:
            if planner_script.required:
                logger.error(f"{planner_script.phase_label} failed: {error}")
                all_success = False
                failed_phase = "Plan"
                record_phase(planner_script.phase_label, False)
                break
            else:
                logger.warning(f"{planner_script.phase_label} failed: {error}")
                # Non-blocking phase (e.g. research) — workflow continues
                record_phase(planner_script.phase_label, False)
        else:
            record_phase(planner_script.phase_label, True)

    # Spec-review gate: between plan and build. Fires only on the first pass
    # (not --resume) and only when the plan succeeded. human mode pauses (exit 0,
    # resume into build); auto mode runs the inline critic and may fail closed.
    if review_spec and all_success and not resume_mode:
        plan_file = TravisState.load(adw_id).get("plan_file")
        if review_spec_mode == "human":
            _TUI.stop()  # tear down the Live before the pause message + exit
            pause_for_spec_review(adw_id, plan_file, input_arg, logger,
                                  ticket=run_input.ticket)
            return  # exit 0 — paused, not failed; --resume continues at build
        else:  # auto
            print_phase_header("Spec Review (auto)")
            ok, msg = auto_review_spec(adw_id, plan_file, plan_input, working_dir, logger,
                                       ticket=run_input.ticket)
            print_phase_result("Spec Review (auto)", ok, msg)
            record_phase("Spec Review", ok)
            if not ok:
                all_success = False
                failed_phase = "SpecReview"

    # Phase 2: Build
    if all_success and not should_skip_phase("build"):
        if attempts > 1:
            # Best-of-N: N parallel build trajectories from the shared plan,
            # hybrid-verifier selection, winner applied to the working tree.
            print_phase_header(f"Phase 2: Implementation (best-of-{attempts})")
            from adw_modules.bestof import run_best_of_n_build
            success, error = run_best_of_n_build(
                adw_id=adw_id,
                working_dir=working_dir,
                n=attempts,
                no_memory=no_memory,
                test_command=test_command,
                logger=logger,
                max_fix=max_test_retries,
            )
            print_phase_result(f"Phase 2: Implementation (best-of-{attempts})", success, error or "")
        else:
            build_args = [adw_id, "--working-dir", working_dir]
            if no_memory:
                build_args.append("--no-memory")
            success, error = run_phase(
                "travis_build.py",
                build_args,
                "Phase 2: Implementation",
                required=True
            )
        if not success:
            logger.error(f"Build phase failed: {error}")
            all_success = False
            failed_phase = "Build"
        record_phase("Build", success)

    # Phase 3: Validate (unless --skip-validate)
    if all_success and not skip_validate and not should_skip_phase("validate"):
        validate_args = [adw_id, "--max-retries", str(max_validation_retries), "--working-dir", working_dir]
        if validate_warnings_only:
            validate_args.append("--warnings-only")
        success, error = run_phase(
            "travis_validate.py",
            validate_args,
            "Phase 3: Validation",
            required=False  # Allow workflow to continue even if validation fails
        )
        if not success:
            logger.warning(f"Validation phase failed: {error}")
            # Track failure but don't stop workflow
            if not failed_phase:
                failed_phase = "Validate"
        record_phase("Validation", success)

    # Phase 4: Test
    if all_success and not should_skip_phase("test"):
        test_args = [adw_id, "--max-retries", str(max_test_retries), "--working-dir", working_dir, "--diff-base", diff_base]
        if mcp_config:
            test_args.extend(["--mcp-config", mcp_config])
        success, error = run_phase(
            "travis_test.py",
            test_args,
            "Phase 4: Testing",
            required=False  # Allow workflow to continue even if tests fail
        )
        if not success:
            logger.warning(f"Test phase failed: {error}")
            # Track failure but don't stop workflow
            if not failed_phase:
                failed_phase = "Test"
        record_phase("Testing", success)

    # Phase 5: Review (optional) — still runs after test/validate failures
    # (those don't clear all_success; review is informational), but not after
    # a failed plan/build: there is no implementation diff to review and the
    # agent dispatch is wasted spend.
    if all_success and not skip_review and not should_skip_phase("review"):
        success, error = run_phase(
            "travis_review.py",
            [adw_id, "--working-dir", working_dir, "--diff-base", diff_base],
            "Phase 5: Review",
            required=False  # Don't stop workflow if review fails
        )
        if not success:
            logger.warning(f"Review phase failed: {error}")
            # Don't set all_success to False - review is informational
            review_failed = True
        record_phase("Review", success)

    # Phase 6: Document (optional) — same gate as review: test/validate
    # failures don't block it, a failed plan/build does.
    if all_success and not skip_document and not should_skip_phase("document"):
        success, error = run_phase(
            "travis_document.py",
            [adw_id, "--working-dir", working_dir],
            "Phase 6: Documentation",
            required=False  # Don't stop workflow if documentation fails
        )
        if not success:
            logger.warning(f"Documentation phase failed: {error}")
            # Don't set all_success to False - documentation is optional
        record_phase("Documentation", success)

    # Tear down the live TUI before the final summary so it prints cleanly below.
    _TUI.stop()

    # Load final state and print summary
    state = TravisState.load(adw_id)
    print_final_summary(state)

    # Post-run: dreaming (memory consolidation), opt-in and build-success-gated.
    # Failed builds teach noise, not durable lessons. Runs BEFORE the draft-PR
    # finalize so the regenerated ai_docs/memory rides the finalize commit into
    # the PR (found live on 8c1253f8: dream output was left uncommitted in the
    # worktree after finish()'s final push).
    if dream:
        build_result = state.get_phase_result("build") or {}
        if build_result.get("success"):
            run_phase(
                "travis_dream.py",
                [adw_id, "--working-dir", working_dir],
                "Post-run: Dreaming (memory consolidation)",
                required=False
            )
        else:
            print("Dream skipped: build did not succeed — nothing durable to consolidate.")
            logger.info("Dream skipped: build phase not successful")

    # Draft-PR: final push + mark ready for review on success (stays draft on
    # failure; never auto-merged — approval is the human's).
    if dpr is not None:
        from adw_modules import draft_pr
        review_result = state.get_phase_result("review")
        ready = pr_ready_after_run(all_success, review_result)
        summary_line = ("All phases completed." if all_success
                        else f"Stopped/degraded at: {failed_phase or 'unknown'}.")
        if all_success and not ready:
            summary_line = (f"All phases completed, but review filed "
                            f"{(review_result or {}).get('issue_count', '?')} issue(s) "
                            "(see specs/review_issues/) — PR left in draft until resolved.")
        draft_pr.finish(dpr, ready, summary_line, logger)

    # Final result
    if all_success and review_failed:
        # All required phases passed but review filed blockers; the draft PR
        # (if any) was left in draft above. A green banner here would
        # contradict the "run failed — PR left as draft" line and hide the
        # blockers (seen live on run 5dbaba17).
        logger.warning("Travis SDLC completed with review blockers")
        print(f"{'='*70}")
        print("  ⚠️  WORKFLOW COMPLETED WITH REVIEW BLOCKERS")
        print("  Review filed issues (see specs/review_issues/) — fix before shipping.")
        print(f"{'='*70}\n")
        sys.exit(0)
    if all_success:
        logger.info("Travis SDLC completed successfully")
        print(f"{'='*70}")
        print("  ✅ WORKFLOW COMPLETED SUCCESSFULLY")
        print(f"{'='*70}\n")
        sys.exit(0)
    elif failed_phase == "Validate":
        # Validation failed but workflow continued - exit with warning
        logger.warning("Travis SDLC completed with validation failures")
        print(f"{'='*70}")
        print("  ⚠️  WORKFLOW COMPLETED WITH VALIDATION FAILURES")
        print(f"{'='*70}\n")
        sys.exit(0)  # Exit success so workflow continues
    elif failed_phase == "Test":
        # Tests failed but workflow continued - exit with warning
        logger.warning("Travis SDLC completed with test failures")
        print(f"{'='*70}")
        print("  ⚠️  WORKFLOW COMPLETED WITH TEST FAILURES")
        print(f"{'='*70}\n")
        sys.exit(0)  # Exit success so workflow continues
    else:
        logger.error(f"Travis SDLC failed at {failed_phase} phase")
        print(f"{'='*70}")
        print(f"  ❌ WORKFLOW FAILED AT {failed_phase.upper()} PHASE")
        print(f"{'='*70}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
