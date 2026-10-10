#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pydantic", "python-dotenv"]
# ///

"""Test the durable feature-worktree + multi-repo manifest plumbing.

Usage:
    uv run adws/adw_tests/test_feature_worktree.py

Credential-free (no Claude calls): exercises the deterministic git/filesystem
logic shared by `travis_sdlc.py --worktree`, `travis_fanout.py`, and
`travis_multirepo.py`. Verifies, against throwaway temp repos:

1. assert_worktree_capable: a git-init'd repo passes; the "subdir of the harness"
   trap (evals/target_*) and an unborn HEAD are rejected with actionable messages.
2. resolve_base_ref: falls back to HEAD when there is no origin/main.
3. create_feature_worktree: cuts trees/<id>/ on branch adw/<id> at the base ref,
   allocates ports in range, persists them to agents/<id>/ports.json (NEVER as
   a file inside the worktree — the .ports.env leak), registers with git,
   leaves the source tree clean, REUSES an existing valid worktree of the same
   id (a paused --review-spec run must be resumable — sev1 2026-07-22) with the
   same ports (including from a legacy in-tree .ports.env), and rejects a
   non-worktree squatter at the tree path.
4. remove_feature_worktree: removes the tree but keeps the branch.
5. load_manifest: loads a valid repos.json (relative paths resolved, plan_type
   default+override) and rejects bad JSON, duplicate names, missing paths, and
   the subdir trap.

trees/ is redirected into a temp dir so the real harness repo is never touched.
"""

import logging
import os
import shutil
import subprocess
import sys
import tempfile
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "adws"))

from adw_modules import feature_worktree as fw
from adw_modules.feature_worktree import (
    create_feature_worktree,
    remove_feature_worktree,
    assert_worktree_capable,
    resolve_base_ref,
)
from travis.travis_multirepo import load_manifest

LOG = logging.getLogger("test_feature_worktree")
logging.basicConfig(level=logging.CRITICAL)  # silence the modules' warn/info


def _git(args, cwd):
    return subprocess.run(["git", "-C", str(cwd), *args], capture_output=True, text=True)


def _make_repo(parent: Path, name: str) -> Path:
    """A standalone git repo seeded from the notes-CLI target."""
    d = parent / name
    shutil.copytree(
        REPO_ROOT / "evals" / "target_app", d,
        ignore=shutil.ignore_patterns(".git", "__pycache__", "notes.json", ".venv"),
    )
    _git(["init", "-q"], d)
    _git(["add", "-A"], d)
    _git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "baseline"], d)
    return d


def main() -> None:
    failures: list[str] = []

    def check(name, cond, extra=""):
        if not cond:
            failures.append(name + (f" [{extra}]" if extra else ""))

    tmp = Path(tempfile.mkdtemp(prefix="adw_wt_test_"))
    orig_root = fw.HARNESS_ROOT
    try:
        app = _make_repo(tmp, "app")

        # 1. capability gate (real HARNESS_ROOT so the harness-trap message fires)
        ok, err = assert_worktree_capable(str(app), LOG)
        check("capable: git-init'd repo passes", ok, err or "")

        ok, err = assert_worktree_capable(str(REPO_ROOT / "evals" / "target_app"), LOG)
        check("trap: evals/target_app rejected",
              (not ok) and "subdirectory of the harness" in (err or ""), err or "")

        empty = tmp / "empty"
        empty.mkdir()
        _git(["init", "-q"], empty)
        ok, err = assert_worktree_capable(str(empty), LOG)
        check("unborn HEAD rejected", (not ok) and "unborn" in (err or ""), err or "")

        # 2. base-ref fallback
        check("base-ref: HEAD fallback without origin/main",
              resolve_base_ref(str(app)) == "HEAD")

        # 3. create — redirect trees/ into the temp dir so the real repo is never
        # touched. (Scoped to this block; restored before the manifest checks so
        # the harness-trap message still fires there.)
        fw.HARNESS_ROOT = tmp
        wt, err = create_feature_worktree("zt_create", str(app), LOG)
        check("create: returns a Worktree", wt is not None, err or "")
        if wt:
            check("create: tree dir exists", os.path.isdir(wt.path))
            check("create: branch adw/zt_create", wt.branch == "adw/zt_create", wt.branch)
            check("create: base HEAD", wt.base_ref == "HEAD", wt.base_ref)
            check("create: backend port 9100-9114", 9100 <= wt.backend_port <= 9114, str(wt.backend_port))
            check("create: frontend port 9200-9214", 9200 <= wt.frontend_port <= 9214, str(wt.frontend_port))
            check("create: NO .ports.env in worktree (leak guard)",
                  not os.path.exists(os.path.join(wt.path, ".ports.env")))
            check("create: ports persisted to agents/<id>/ports.json",
                  fw.load_port_allocation("zt_create") == (wt.backend_port, wt.frontend_port))
            check("create: git registers worktree", wt.path in _git(["worktree", "list"], app).stdout)
            check("create: source tree clean", _git(["status", "--porcelain"], app).stdout.strip() == "")
            check("create: branch in source repo",
                  "adw/zt_create" in _git(["branch", "--list", "adw/zt_create"], app).stdout)

            # colliding tree path: a valid worktree of the same id is REUSED
            # (this is how --resume reattaches after a spec-review pause)
            wt2, err2 = create_feature_worktree("zt_create", str(app), LOG)
            check("create: existing worktree reused",
                  wt2 is not None and wt2.path == wt.path and wt2.branch == wt.branch,
                  err2 or "")
            check("create: reuse keeps allocated ports",
                  wt2 is not None
                  and (wt2.backend_port, wt2.frontend_port) == (wt.backend_port, wt.frontend_port))

            # legacy migration: a pre-fix worktree has .ports.env in-tree and no
            # ports.json — reattach must read the file, then persist to state
            ports_json = fw._ports_state_path("zt_create")
            ports_json.unlink()
            (Path(wt.path) / ".ports.env").write_text(
                "BACKEND_PORT=9111\nFRONTEND_PORT=9211\n"
            )
            wt_legacy, err_legacy = create_feature_worktree("zt_create", str(app), LOG)
            check("reattach: legacy .ports.env honored",
                  wt_legacy is not None
                  and (wt_legacy.backend_port, wt_legacy.frontend_port) == (9111, 9211),
                  err_legacy or "")
            check("reattach: legacy ports migrated to ports.json",
                  fw.load_port_allocation("zt_create") == (9111, 9211))
            (Path(wt.path) / ".ports.env").unlink()

            # 4. remove keeps the branch
            remove_feature_worktree(wt, LOG)
            check("remove: tree dir gone", not os.path.isdir(wt.path))
            check("remove: branch kept",
                  "adw/zt_create" in _git(["branch", "--list", "adw/zt_create"], app).stdout)

            # a non-worktree squatter at the tree path is still rejected
            os.makedirs(wt.path)
            (Path(wt.path) / "junk.txt").write_text("junk")
            wt3, err3 = create_feature_worktree("zt_create", str(app), LOG)
            check("create: non-worktree squatter rejected",
                  wt3 is None and "remove it first" in (err3 or ""), err3 or "")
            shutil.rmtree(wt.path, ignore_errors=True)

        fw.HARNESS_ROOT = orig_root  # restore for the manifest trap assertions

        # 5. manifest loader
        app2 = _make_repo(tmp, "app2")
        man = tmp / "repos.json"
        man.write_text(json.dumps({"version": 1, "repos": [
            {"name": "a", "path": str(app), "order": 1},
            {"name": "b", "path": "app2", "plan_type": "chore", "order": 2},  # relative
        ]}))
        repos = load_manifest(str(man), LOG)
        check("manifest: loads 2 repos", len(repos) == 2, str(len(repos)))
        # Compare resolved paths: load_manifest resolves relative entries via
        # .resolve() (realpath), so on macOS r.path is /private/var/... while app2
        # is the /var/... symlink form. The assertion is "resolved to app2's repo".
        check("manifest: relative path -> abs",
              any(r.name == "b" and os.path.isabs(r.path) and Path(r.path).resolve() == app2.resolve()
                  for r in repos))
        check("manifest: plan_type default+override",
              {r.name: r.plan_type for r in repos} == {"a": "feature", "b": "chore"})

        def expect_reject(label, text):
            p = tmp / f"bad_{label}.json"
            p.write_text(text)
            try:
                load_manifest(str(p), LOG)
                check(f"manifest reject: {label}", False, "no error raised")
            except ValueError:
                check(f"manifest reject: {label}", True)

        expect_reject("bad-json", "{not json")
        expect_reject("dup-names", json.dumps({"version": 1, "repos": [
            {"name": "x", "path": str(app)}, {"name": "x", "path": str(app2)}]}))
        expect_reject("missing-path", json.dumps({"version": 1, "repos": [
            {"name": "x", "path": str(tmp / "nope")}]}))
        expect_reject("subdir-trap", json.dumps({"version": 1, "repos": [
            {"name": "x", "path": str(REPO_ROOT / "evals" / "target_app")}]}))

    finally:
        fw.HARNESS_ROOT = orig_root
        shutil.rmtree(tmp, ignore_errors=True)

    if failures:
        print("FAIL:")
        for f in failures:
            print(f"  - {f}")
        sys.exit(1)
    print("PASS: feature_worktree + manifest — all checks green")
    sys.exit(0)


if __name__ == "__main__":
    main()
