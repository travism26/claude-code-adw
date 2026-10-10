"""Draft-PR loop: a reviewable, human-gated surface for autonomous runs.

Verified pattern from the 2026-06-10 deep-research pass (GitHub Copilot coding
agent): an autonomous run should push incremental commits to a *draft* PR and
keep the PR description updated as it progresses, so a human can watch and must
approve before anything merges. ADW's triggered runs were fire-and-forget.

When enabled (travis_sdlc `--draft-pr`, or ADW_DRAFT_PR=1 from a trigger):
  - start():        branch `adw/<id>`, an initial empty commit, and a draft PR
                    opened up front so the surface exists from turn one.
  - commit_phase(): after each phase, commit the working tree and push; the PR
                    body carries a live phase checklist.
  - finish():       final push; mark the PR ready for review on success (left
                    draft on failure). Never auto-merges — approval is human.

Degrades gracefully: with no GitHub remote or no `gh`/token, it still creates
the local branch and per-phase commits (reviewable via `git log`/`git diff`)
and logs that PR creation was skipped. Every gh call is best-effort and never
crashes the workflow.
"""

import os
import re
import subprocess
from dataclasses import dataclass, field
from typing import Optional

from adw_modules.github import (
    extract_repo_path,
    get_github_env,
)

BOT_MARK = "🤖 ADW autonomous run"

# Harness runtime state that must never ride a pipeline commit into a target
# repo. `.ports.env` is the proven leak (8+ runs against an early target repo;
# one PR shipped a stray port bump): older harness versions wrote it into the
# worktree root and the blanket `git add -A` below swept it in. The harness no longer writes
# it, but a doctored/legacy tree can still contain one — and this list is the
# extension point for the whole harness-internal-file class, not just one name.
# Paths are worktree-root-relative.
HARNESS_INTERNAL_FILES = (".ports.env",)


@dataclass
class DraftPRSession:
    working_dir: str
    adw_id: str
    branch: str
    base_branch: str
    title: str
    issue_number: Optional[str] = None
    repo_path: Optional[str] = None       # owner/name, set when a remote exists
    pr_number: Optional[str] = None        # set when a draft PR was opened
    pr_url: Optional[str] = None
    phases: list = field(default_factory=list)  # [(label, status)] for the checklist
    warnings: list = field(default_factory=list)  # e.g. Spec warnings, shown near the top

    @property
    def has_pr(self) -> bool:
        return self.pr_number is not None


def _git(args: list[str], cwd: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True)


def _gh(args: list[str]) -> subprocess.CompletedProcess:
    """Run a gh command with the GitHub token env (falls back to ambient auth)."""
    env = get_github_env() or {**os.environ}
    return subprocess.run(["gh", *args], capture_output=True, text=True, env=env)


def _remote_repo_path(working_dir: str) -> Optional[str]:
    """owner/name if the TARGET's origin is a GitHub remote and gh sees it.

    Scoped to working_dir on purpose: the harness repo has its own GitHub
    origin, and an ambient lookup would leak it onto a target that has no
    remote (and then try to push the target's branch to the harness).
    """
    url = _git(["remote", "get-url", "origin"], working_dir)
    if url.returncode != 0 or not url.stdout.strip():
        return None
    try:
        repo_path = extract_repo_path(url.stdout.strip())
    except Exception:
        return None
    # Confirm gh can see the repo (auth + network); cheap and avoids later failures.
    probe = _gh(["repo", "view", repo_path, "--json", "name"])
    return repo_path if probe.returncode == 0 else None


def _render_body(session: DraftPRSession, footer: str = "", description: str = "") -> str:
    """PR body. During the run: bot mark + live checklist. At finish, when an
    agent-written description exists, the description leads and the checklist
    moves into a collapsed provenance block so reviewers see substance first."""
    lines = [
        BOT_MARK + f" — `{session.adw_id}`",
        "",
        "Automated implementation. **Draft until the run finishes; review before merging.**",
    ]
    if session.issue_number:
        lines.append(f"\nCloses #{session.issue_number}")
    for warning in session.warnings:
        lines.append(f"\n> ⚠️ {warning}")
    icon = {"ok": "✅", "fail": "❌", "running": "⏳", "skip": "⏭️"}
    checklist = [f"- {icon.get(status, '•')} {label}" for label, status in session.phases]
    if description:
        lines.append("\n" + description.strip())
        lines.append("\n<details><summary>Run provenance</summary>\n")
        lines.append("### Progress")
        lines.extend(checklist)
        if footer:
            lines.append(f"\n### Summary\n{footer}")
        lines.append("\n</details>")
    else:
        lines.append("\n### Progress")
        lines.extend(checklist)
        if footer:
            lines.append(f"\n### Summary\n{footer}")
    return "\n".join(lines)


DESCRIPTION_PROMPT = """You are writing the pull-request description for an \
autonomous implementation run. Using the diff and context below, write \
GitHub-flavored markdown with these sections:

## Overview
Two to four sentences: what changed and why, in plain language, the first \
thing a reviewer reads.

## Technical changes
Bullets grouped by area (library modules, CLI, tests, docs), naming the key \
files and what happened in each. Specific, not exhaustive.

## Risk notes
Include this section ONLY when something genuinely deserves extra reviewer \
attention: frozen or public interfaces touched, data handling or schema \
changes, tricky edge cases (DST, numerical tolerances), performance-sensitive \
paths, security surfaces. When nothing qualifies, omit the section entirely. \
Never invent risk to fill space.

Rules: no em-dashes anywhere. No preamble, no sign-off. Output ONLY the \
markdown body, starting exactly at "## Overview". Do not repeat the phase \
checklist; it is appended separately.
"""


def _describe_run(session: DraftPRSession, logger, prompt_fn=None) -> Optional[str]:
    """Agent-written PR description from the run's final diff. Best-effort by
    design: any failure returns None and finish() falls back to the
    checklist-only body; the run's verdict is never affected. prompt_fn is a
    test seam (same pattern as is_zero_turn_failure)."""
    try:
        stat = _git(["diff", "--stat", f"{session.base_branch}...HEAD"], session.working_dir)
        if stat.returncode != 0 or not stat.stdout.strip():
            return None
        diff = _git(["diff", f"{session.base_branch}...HEAD"], session.working_dir)
        diff_text = diff.stdout if diff.returncode == 0 else ""
        if len(diff_text) > 40_000:
            diff_text = diff_text[:40_000] + "\n... (diff truncated)"
        review_note = ""
        review_file = os.path.join(session.working_dir, "specs", "review_issues",
                                   f"review-{session.adw_id}.md")
        if os.path.exists(review_file):
            with open(review_file) as fh:
                review_note = fh.read()[:2_000]
        prompt = (f"{DESCRIPTION_PROMPT}\nPR title: {session.title}\n\n"
                  f"Diff stat:\n```\n{stat.stdout[:3_000]}\n```\n\n"
                  f"Notes from the run's own review phase:\n{review_note or '(none)'}\n\n"
                  f"Diff:\n```diff\n{diff_text}\n```\n")
        if prompt_fn is None:
            prompt_fn = _prompt_for_description
        text = prompt_fn(prompt, session)
        if not text or "## Overview" not in text:
            return None
        return text[text.index("## Overview"):].strip()
    except Exception as e:  # noqa: BLE001 — cosmetic path, never fail the run
        logger.debug(f"draft-pr: description generation failed: {e}")
        return None


def _prompt_for_description(prompt: str, session: DraftPRSession) -> Optional[str]:
    """Read-only sonnet call; mutating tools are structurally denied."""
    from adw_modules.agent import AgentPromptRequest, prompt_claude_code_with_retry

    project_root = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    output_dir = os.path.join(project_root, "agents", session.adw_id, "pr_describer")
    os.makedirs(output_dir, exist_ok=True)
    request = AgentPromptRequest(
        prompt=prompt,
        adw_id=session.adw_id,
        agent_name="pr_describer",
        model="sonnet",
        dangerously_skip_permissions=True,
        output_file=os.path.join(output_dir, "cc_raw_output.jsonl"),
        working_dir=session.working_dir,
        disallowed_tools=["Edit", "Write", "NotebookEdit", "Bash", "Task"],
    )
    response = prompt_claude_code_with_retry(request)
    return response.output if response.success else None


def _commit_all(session: DraftPRSession, message: str, logger=None) -> bool:
    """Stage and commit the working tree; True if a commit was made.

    Harness-internal files (HARNESS_INTERNAL_FILES) are excluded from staging
    and, if something else already staged them (an agent running git add, a
    doctored tree), auto-unstaged before the commit — they are runtime state,
    never part of the change under review.
    """
    status = _git(["status", "--porcelain"], session.working_dir)
    if not status.stdout.strip():
        return False
    excludes = [f":(exclude){path}" for path in HARNESS_INTERNAL_FILES]
    _git(["add", "-A", "--", ".", *excludes], session.working_dir)
    staged = _git(
        ["diff", "--cached", "--name-only"], session.working_dir
    ).stdout.splitlines()
    leaked = [path for path in HARNESS_INTERNAL_FILES if path in staged]
    if leaked:
        _git(["reset", "-q", "HEAD", "--", *leaked], session.working_dir)
        if logger:
            logger.warning(
                f"draft-pr: unstaged harness-internal file(s) from commit set: "
                f"{', '.join(leaked)}"
            )
    if _git(["diff", "--cached", "--quiet"], session.working_dir).returncode == 0:
        return False  # only harness-internal noise was dirty — nothing to commit
    r = _git(
        ["-c", "user.email=adw@local", "-c", "user.name=ADW",
         "commit", "-m", message],
        session.working_dir,
    )
    return r.returncode == 0


def _push(session: DraftPRSession) -> bool:
    if not session.repo_path:
        return False
    r = _git(["push", "-u", "origin", session.branch], session.working_dir)
    return r.returncode == 0


def start(
    working_dir: str,
    adw_id: str,
    title: str,
    logger,
    issue_number: Optional[str] = None,
    base_branch: Optional[str] = None,
    warnings: Optional[list] = None,
) -> Optional[DraftPRSession]:
    """Create the branch + initial commit, and open a draft PR if a remote exists."""
    if not _git(["rev-parse", "HEAD"], working_dir).returncode == 0:
        logger.warning("draft-pr: working dir is not a git repo with a commit — skipping")
        return None

    base = base_branch or _git(["rev-parse", "--abbrev-ref", "HEAD"], working_dir).stdout.strip()
    branch = f"adw/{adw_id}"
    session = DraftPRSession(
        working_dir=working_dir, adw_id=adw_id, branch=branch,
        base_branch=base, title=title, issue_number=issue_number,
        warnings=list(warnings or ()),
    )

    # Branch (reuse if it already exists, e.g. a resumed run).
    co = _git(["checkout", "-b", branch], working_dir)
    if co.returncode != 0:
        if "already exists" in co.stderr:
            _git(["checkout", branch], working_dir)
        else:
            logger.warning(f"draft-pr: could not create branch {branch}: {co.stderr.strip()}")
            return None

    # An empty commit guarantees the branch has something to push before phase 1.
    _git(["-c", "user.email=adw@local", "-c", "user.name=ADW",
          "commit", "--allow-empty", "-m", f"ADW {adw_id}: start"], working_dir)

    session.repo_path = _remote_repo_path(working_dir)
    if not session.repo_path:
        logger.info(f"draft-pr: no usable GitHub remote — local branch {branch} only "
                    "(reviewable via git log/diff; PR creation skipped)")
        return session

    if not _push(session):
        logger.warning("draft-pr: push failed — continuing local-only")
        session.repo_path = None
        return session

    if base == branch:
        # A worktree run is already checked out on the adw branch when start()
        # runs, so the HEAD-derived base above degenerates to base == head and
        # PR creation can never succeed. Recover with the remote's default branch.
        dv = _gh(["repo", "view", session.repo_path, "--json", "defaultBranchRef",
                  "--jq", ".defaultBranchRef.name"])
        fallback = dv.stdout.strip() if dv.returncode == 0 else ""
        if fallback and fallback != branch:
            base = fallback
            session.base_branch = base
            logger.info(f"draft-pr: base equaled head branch; using default branch {base}")

    create = _gh([
        "pr", "create", "--repo", session.repo_path, "--draft",
        "--head", branch, "--base", base,
        "--title", title, "--body", _render_body(session),
    ])
    if create.returncode == 0:
        session.pr_url = create.stdout.strip()
        session.pr_number = session.pr_url.rstrip("/").split("/")[-1]
        logger.info(f"draft-pr: opened draft PR #{session.pr_number} — {session.pr_url}")
    else:
        # A resumed run re-creates against the PR its first segment opened; gh
        # refuses with 'already exists: <url>'. Adopt that PR so per-phase
        # checklist updates and the final ready-flip keep working instead of
        # silently no-oping for the rest of the run.
        m = re.search(r"already exists:?\s*(https://\S+/pull/(\d+))", create.stderr)
        if m:
            session.pr_url, session.pr_number = m.group(1), m.group(2)
            logger.info(f"draft-pr: adopted existing PR #{session.pr_number} — {session.pr_url}")
        else:
            logger.warning(f"draft-pr: gh pr create failed ({create.stderr.strip()}); "
                           "branch pushed, PR not opened")
    return session


def commit_phase(session: Optional[DraftPRSession], label: str, status: str, logger) -> None:
    """Commit the working tree after a phase, push, and refresh the PR body."""
    if session is None:
        return
    session.phases.append((label, status))
    made = _commit_all(session, f"ADW {session.adw_id}: {label} [{status}]", logger)
    if made:
        _push(session)
    if session.has_pr:
        edit = _gh(["pr", "edit", session.pr_number, "--repo", session.repo_path,
                    "--body", _render_body(session)])
        if edit.returncode != 0:
            logger.debug(f"draft-pr: pr body update failed: {edit.stderr.strip()}")


def finish(session: Optional[DraftPRSession], success: bool, summary: str, logger) -> None:
    """Final push; mark the PR ready for review on success (stays draft on failure)."""
    if session is None:
        return
    _commit_all(session, f"ADW {session.adw_id}: finalize", logger)
    _push(session)
    if not session.has_pr:
        logger.info(f"draft-pr: run finished on local branch {session.branch} "
                    f"(success={success})")
        return

    description = _describe_run(session, logger) if success else None
    body = _render_body(session, footer=summary, description=description or "")
    _gh(["pr", "edit", session.pr_number, "--repo", session.repo_path, "--body", body])
    if success:
        ready = _gh(["pr", "ready", session.pr_number, "--repo", session.repo_path])
        if ready.returncode == 0:
            logger.info(f"draft-pr: PR #{session.pr_number} marked ready for review "
                        "(human approval required before merge)")
        else:
            logger.warning(f"draft-pr: could not mark ready: {ready.stderr.strip()}")
    else:
        logger.info(f"draft-pr: run failed — PR #{session.pr_number} left as draft")
