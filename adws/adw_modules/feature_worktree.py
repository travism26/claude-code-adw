"""Durable feature worktrees: one isolated git worktree per ADW run.

The single worktree-creation path shared by `travis_sdlc.py --worktree`,
`travis_fanout.py`, and `travis_multirepo.py`. Generalized from the worktree
handling in `bestof.py` to operate on an *arbitrary* target repo and base ref.

Relationship to the two existing worktree users:
  - `bestof.py` cuts N *ephemeral, detached* sibling worktrees of the target,
    applies the winner's diff back, and removes them in a `finally`. Its
    lifecycle is fundamentally different (no branch, no ports, removed always),
    so it keeps its own inline `git worktree add --detach`. The one piece it
    shares with us is `materialize_inputs` (carrying untracked build inputs into
    a fresh tree) — defined here and imported there, so there is one copy.
  - `worktree_ops.py` has *dormant* worktree helpers (`create_worktree`, ...)
    that are hardcoded to the harness repo + `origin/main` and have no callers.
    This module supersedes them. We DO reuse its correct, reusable port helper
    (`find_next_available_ports`).

Worktrees live under the harness `trees/<adw_id>/` (already gitignored), the same
convention bestof uses, so listing/cleanup is uniform regardless of which target
repo a worktree was cut from. State and logs stay under the harness
`agents/<adw_id>/` keyed by adw_id — unaffected by the worktree.

Port allocations are harness runtime state and live in the harness state dir
(`agents/<adw_id>/ports.json`), NOT in the worktree: the old in-tree
`.ports.env` rode blanket-staged phase commits into target-repo PRs (recurred
across 8+ runs against an early target repo). Ports reach phases as env vars (travis_sdlc).
"""

import json
import logging
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple

from adw_modules.worktree_ops import find_next_available_ports

# trees/ lives at the harness repo root (adws/adw_modules/ -> up 3).
HARNESS_ROOT = Path(__file__).resolve().parent.parent.parent


@dataclass
class Worktree:
    """A created feature worktree and the ports allocated to it."""

    adw_id: str
    path: str            # absolute worktree path — the new working_dir
    branch: str          # branch checked out in the worktree
    base_ref: str        # resolved base commit-ish the worktree was cut from
    backend_port: int
    frontend_port: int
    source_repo: str     # toplevel of the target repo the worktree was cut from


def _git(args: list, cwd: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True)


def repo_toplevel(working_dir: str) -> Optional[str]:
    """Absolute path of the git toplevel containing working_dir, or None."""
    r = _git(["rev-parse", "--show-toplevel"], working_dir)
    return r.stdout.strip() if r.returncode == 0 else None


def resolve_base_ref(working_dir: str, explicit: Optional[str] = None) -> str:
    """Pick the base ref for a feature worktree.

    Order: explicit arg -> origin/main if it resolves -> current HEAD. The HEAD
    fallback (mirroring bestof) is what makes repos without an origin/main work
    (fresh `git init` targets, no-remote repos).
    """
    if explicit:
        return explicit
    if _git(["rev-parse", "--verify", "--quiet", "origin/main"], working_dir).returncode == 0:
        return "origin/main"
    return "HEAD"


def assert_worktree_capable(working_dir: str, logger: logging.Logger) -> Tuple[bool, Optional[str]]:
    """Validate that working_dir can host a feature worktree.

    Fails (returns (False, message)) when:
      - working_dir is not a git repo,
      - the repo has no commit yet (unborn HEAD), or
      - working_dir is not the repo root (a subdir) — in particular the
        evals/target_* trap, where the "target" is a tracked subdir of the
        harness repo and a worktree rooted there would check out the whole
        harness tree.
    """
    toplevel = repo_toplevel(working_dir)
    if toplevel is None:
        return False, f"{working_dir} is not a git repository (no worktree can be created)"

    if _git(["rev-parse", "--verify", "--quiet", "HEAD"], working_dir).returncode != 0:
        return False, (
            f"{working_dir} has no commit yet (unborn HEAD) — a worktree needs a "
            "base commit. Make an initial commit first."
        )

    # Compare REAL paths: `git rev-parse --show-toplevel` resolves symlinks, so on
    # macOS a temp-dir repo under /var/folders (a symlink to /private/var/folders)
    # would never equal os.path.abspath(working_dir), which keeps the symlink. That
    # made every tempfile.mkdtemp() target — i.e. every eval repo — falsely fail
    # this gate. realpath both sides; HARNESS_ROOT is already resolved at line 39.
    abs_wd = os.path.realpath(working_dir)
    if os.path.realpath(toplevel) != abs_wd:
        if os.path.realpath(toplevel) == str(HARNESS_ROOT):
            return False, (
                f"{abs_wd} is a tracked subdirectory of the harness repo, not a "
                "standalone repo — a worktree rooted here would check out the entire "
                "harness. Copy it out and `git init` first (see "
                "evals/run_eval.py:prepare_target), or point --working-dir at a real "
                "repo root."
            )
        return False, (
            f"{abs_wd} is not a git repository root (its toplevel is {toplevel}). "
            "Point --working-dir at the repo root."
        )

    return True, None


def materialize_inputs(working_dir: str, dest: str) -> None:
    """Carry untracked build inputs into a fresh worktree.

    A worktree checks out the committed base only; the plan (specs/), the memory
    store, and gitignored deps the build/tests need (node_modules) are untracked
    in the target, so copy/clone them in. Shared with bestof.py.
    """
    for sub in ("specs", "ai_docs", "app_docs"):
        src = os.path.join(working_dir, sub)
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(dest, sub), dirs_exist_ok=True)
    nm_src = os.path.join(working_dir, "node_modules")
    nm_dst = os.path.join(dest, "node_modules")
    if os.path.isdir(nm_src) and not os.path.exists(nm_dst):
        # Hardlink clone — fast, space-cheap, isolated enough for a read-mostly dep tree.
        try:
            subprocess.run(["cp", "-al", nm_src, nm_dst], check=True, capture_output=True)
        except subprocess.CalledProcessError:
            shutil.copytree(nm_src, nm_dst, dirs_exist_ok=True)


def _ports_state_path(adw_id: str) -> Path:
    # Module global read at call time so tests that redirect HARNESS_ROOT
    # (test_feature_worktree) redirect the ports state too.
    return HARNESS_ROOT / "agents" / adw_id / "ports.json"


def save_port_allocation(
    adw_id: str, backend_port: int, frontend_port: int, logger: logging.Logger
) -> None:
    """Persist a run's port allocation in the harness state dir."""
    path = _ports_state_path(adw_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(
        {"backend_port": backend_port, "frontend_port": frontend_port}
    ))
    logger.info(
        f"ports: allocated backend {backend_port} / frontend {frontend_port} ({path})"
    )


def load_port_allocation(adw_id: str) -> Optional[Tuple[int, int]]:
    """(backend, frontend) persisted for this adw_id, or None."""
    try:
        data = json.loads(_ports_state_path(adw_id).read_text())
        return int(data["backend_port"]), int(data["frontend_port"])
    except (OSError, ValueError, KeyError, TypeError):
        return None


def _read_ports_env(wt_path: str) -> Optional[Tuple[int, int]]:
    """(backend, frontend) from a legacy in-worktree .ports.env, or None.

    Read-only migration fallback for worktrees created before allocations moved
    to agents/<adw_id>/ports.json. The harness never writes this file anymore.
    """
    try:
        with open(os.path.join(wt_path, ".ports.env")) as f:
            pairs = dict(
                line.strip().split("=", 1) for line in f if "=" in line
            )
        return int(pairs["BACKEND_PORT"]), int(pairs["FRONTEND_PORT"])
    except (OSError, KeyError, ValueError):
        return None


def _reattach_existing_worktree(
    adw_id: str,
    wt_path: str,
    branch: str,
    base: str,
    source_repo: str,
    logger: logging.Logger,
) -> Optional[Worktree]:
    """Reuse trees/<adw_id>/ left behind by an earlier run of the same id.

    Valid only when the path is itself a git worktree OF source_repo checked
    out on the expected adw/<id> branch; anything else returns None so the
    caller fails with the remove-it-first message. Ports come from the
    persisted allocation (agents/<adw_id>/ports.json — same allocation as the
    original run), falling back to a legacy in-worktree .ports.env."""
    if repo_toplevel(wt_path) != os.path.realpath(wt_path):
        return None
    if _git(["rev-parse", "--abbrev-ref", "HEAD"], wt_path).stdout.strip() != branch:
        return None
    common = _git(["rev-parse", "--git-common-dir"], wt_path).stdout.strip()
    if not os.path.isabs(common):
        common = os.path.join(wt_path, common)
    if os.path.realpath(common) != os.path.realpath(os.path.join(source_repo, ".git")):
        return None

    persisted = load_port_allocation(adw_id)
    ports = persisted or _read_ports_env(wt_path) or find_next_available_ports(adw_id)
    backend_port, frontend_port = ports
    if persisted is None:
        # Migrate legacy/fresh allocations into the state dir so the next
        # resume finds them without touching the worktree.
        save_port_allocation(adw_id, backend_port, frontend_port, logger)
    logger.info(
        f"worktree: reusing existing {wt_path} (branch {branch}, "
        f"ports {backend_port}/{frontend_port})"
    )
    return Worktree(
        adw_id=adw_id,
        path=wt_path,
        branch=branch,
        base_ref=base,
        backend_port=backend_port,
        frontend_port=frontend_port,
        source_repo=source_repo,
    )


def create_feature_worktree(
    adw_id: str,
    working_dir: str,
    logger: logging.Logger,
    *,
    base_ref: Optional[str] = None,
    branch_name: Optional[str] = None,
    materialize: bool = True,
) -> Tuple[Optional[Worktree], Optional[str]]:
    """Create trees/<adw_id>/ as a worktree of `working_dir` on a fresh branch.

    Returns (Worktree, None) on success, or (None, error_message) on failure.

    The branch defaults to `adw/<adw_id>` — the SAME name `draft_pr.start()`
    uses — so a `--worktree --draft-pr` run composes cleanly (draft_pr finds the
    branch already checked out and no-ops its create). If the branch already
    exists (e.g. a resumed run), falls back to attaching the worktree to it.
    If trees/<adw_id>/ itself already exists as a valid worktree of this repo
    on the expected branch (a paused/resumed run), it is reused as-is.
    """
    ok, err = assert_worktree_capable(working_dir, logger)
    if not ok:
        return None, err

    source_repo = repo_toplevel(working_dir)  # realpath of working_dir (matched the check above)
    base = resolve_base_ref(working_dir, base_ref)
    branch = branch_name or f"adw/{adw_id}"

    trees_dir = HARNESS_ROOT / "trees"
    trees_dir.mkdir(exist_ok=True)
    wt_path = str(trees_dir / adw_id)

    if os.path.exists(wt_path):
        # A paused run (e.g. travis_sdlc --review-spec) leaves its worktree in
        # place; --resume must reattach to it, not die here.
        wt = _reattach_existing_worktree(adw_id, wt_path, branch, base, source_repo, logger)
        if wt is not None:
            return wt, None
        return None, (
            f"worktree path already exists: {wt_path} but is not a worktree of "
            f"{source_repo} on branch {branch} — remove it first "
            f"(git worktree remove --force {wt_path}) or use a fresh adw_id"
        )

    # Warn (don't fail) on a dirty source tree: a worktree checks out the
    # committed base, so uncommitted edits in the source won't be carried in.
    dirty = _git(["status", "--porcelain", "--untracked-files=no"], working_dir).stdout.strip()
    if dirty:
        logger.warning(
            "worktree: source tree has uncommitted changes — they will NOT be in "
            f"the worktree (it is cut from {base}). Commit them first to include them."
        )

    # Create the worktree on a new branch at the base ref.
    r = _git(["worktree", "add", "-b", branch, wt_path, base], working_dir)
    if r.returncode != 0:
        if "already exists" in r.stderr:
            # Branch exists (resumed run): attach a worktree to the existing branch.
            r = _git(["worktree", "add", wt_path, branch], working_dir)
        if r.returncode != 0:
            return None, f"failed to create worktree: {r.stderr.strip()}"

    backend_port, frontend_port = find_next_available_ports(adw_id)
    save_port_allocation(adw_id, backend_port, frontend_port, logger)
    if materialize:
        materialize_inputs(working_dir, wt_path)

    logger.info(
        f"worktree: {wt_path} (branch {branch}, base {base}, "
        f"ports {backend_port}/{frontend_port})"
    )
    return (
        Worktree(
            adw_id=adw_id,
            path=wt_path,
            branch=branch,
            base_ref=base,
            backend_port=backend_port,
            frontend_port=frontend_port,
            source_repo=source_repo,
        ),
        None,
    )


def remove_feature_worktree(wt: Worktree, logger: logging.Logger) -> None:
    """Remove a feature worktree (best-effort). The branch is left intact."""
    r = _git(["worktree", "remove", "--force", wt.path], wt.source_repo)
    if r.returncode != 0 and os.path.exists(wt.path):
        try:
            shutil.rmtree(wt.path)
            logger.warning(f"worktree: manually removed {wt.path}")
        except OSError as e:
            logger.warning(f"worktree: failed to remove {wt.path}: {e}")
            return
    logger.info(f"worktree: removed {wt.path} (branch {wt.branch} kept)")
