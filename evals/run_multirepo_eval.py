#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml", "python-dotenv", "pydantic", "rich", "json-repair"]
# ///
"""Multi-repo eval — measure travis_multirepo.py across multiple targets.

Targets range from hermetic stdlib CLIs (app/cli) to the realistic vendored
growbuddy pair: the Express/TS backend (postgres+redis, per-trial DB reset) and
the Next.js frontend (graded build-then-serve with a held-out Playwright oracle,
backend API stubbed). Services start only when a backend repo is in the task.

For a multi-repo task (evals/multirepo_tasks/<id>.yaml): prepare each repo's
bundled target into a clean git-init'd temp dir, generate a repos.json manifest,
run `travis_multirepo.py <ticket> --manifest ...` (each repo runs its OWN full
SDLC in its OWN worktree — independent per-repo plans), then grade each repo
against its worktree (`trees/<child_adw_id>/`): the parent's plan+build verdict
from the run summary, plus the repo's own test_command and acceptance checks.

This is the multi-repo analogue of run_eval.py (which is single-target). It
exercises the orchestration the single-repo evals never touch: manifest loading,
per-repo worktree/port isolation, and the cross-repo scorecard.

Results feed the existing scorecard: each trial writes
evals/results/{variant}/{task}/{trial}/result.json in compare.py's schema
(status + scores), so `uv run evals/compare.py --variants <variant>` renders
mean±spread / pass@k / pass^k and baselines — same machinery as the single-target
eval. The two repos are pooled into `acceptance_checks` and `tests_pass` (1.0 only
when EVERY repo fully passes, so pass^k means "all repos solved on every trial"),
with per-repo detail columns (`<repo>_acceptance`, `<repo>_tests`).

Usage:
    uv run evals/run_multirepo_eval.py <task-id> [--variant NAME] [--trials N]
        [--serialize] [--model M] [--effort L] [--keep-trees] [--dry-run]

    --variant    label for the compare.py scorecard (default: multirepo). A/B by
                 running two variants on the same task (e.g. parallel vs serialize).
    --trials N   independent trials (default 1); agents are non-deterministic.
    --dry-run    prepare repos + write the manifest + print the command, then
                 stop. Credential-free — validates prep/manifest without agents.
    --serialize  run repos one at a time (forwarded to travis_multirepo).
    --keep-trees leave the worktrees in place after grading (default: remove).

Needs Claude credentials for a real run (each repo runs travis_sdlc). The
--dry-run path does not.
"""

import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import yaml
from dotenv import load_dotenv

HARNESS_ROOT = Path(__file__).resolve().parent.parent
EVALS_DIR = HARNESS_ROOT / "evals"
MULTIREPO_TASKS = EVALS_DIR / "multirepo_tasks"
MULTIREPO_SCRIPT = HARNESS_ROOT / "adws" / "travis" / "travis_multirepo.py"
MULTIREPO_RESULTS = EVALS_DIR / "multirepo_results"   # human logs + per-trial json
COMPARE_RESULTS = EVALS_DIR / "results"               # compare.py reads {variant}/{task}/{trial}/result.json
FE_ORACLE_DIR = EVALS_DIR / "oracles" / "frontend"    # held-out frontend grading specs

# The single-target eval owns the service orchestration (postgres+redis, docker
# fallback, per-trial DB reset, fast node_modules clone). Reuse it rather than
# fork a second copy — importing run_eval only runs its module-level setup (it
# never calls main()).
sys.path.insert(0, str(EVALS_DIR))
import run_eval  # noqa: E402
from graders import clean_subprocess_env  # noqa: E402

# Bundled targets a task's repos may reference by `target:` name.
# - app / cli: hermetic stdlib CLIs (tier 1)
# - backend:  vendored growbuddy Express/TS backend (needs postgres+redis +
#             npm-ci'd node_modules in the vendored dir)
# - frontend: vendored growbuddy Next.js app (needs npm-ci'd node_modules +
#             a playwright chromium install; graded build-then-serve, API stubbed)
TARGETS = {
    "app": EVALS_DIR / "target_app",
    "cli": EVALS_DIR / "target_cli",
    "backend": EVALS_DIR / "target_backend",
    "frontend": EVALS_DIR / "target_frontend",
}

# Targets whose dependencies live in a vendored node_modules cloned per trial.
NODE_TARGETS = {"backend", "frontend"}

_IGNORE = shutil.ignore_patterns(
    ".venv", "__pycache__", ".pytest_cache", "notes.json", "kv.json",
    "uv.lock", ".git", "node_modules", "logs", "coverage",
    ".next", "dist", "playwright-report", "test-results", ".env", ".env.*",
    "*.tsbuildinfo",
)


def load_task(task_id: str) -> dict:
    matches = sorted(MULTIREPO_TASKS.glob(f"{task_id}*.yaml"))
    if not matches:
        raise SystemExit(f"no multi-repo task matching {task_id!r} in {MULTIREPO_TASKS}")
    return yaml.safe_load(matches[0].read_text())


def prepare_repo(target_name: str, dest: Path, svc_env: dict | None = None,
                 deps: bool = True) -> Path:
    """Copy a bundled target to dest and commit a git baseline (the diff base).

    For node targets (backend/frontend) the vendored node_modules is cloned in
    (fast APFS clonefile) since it is excluded from the tree copy; the backend
    additionally gets a fresh migrated test DB. `deps=False` (dry-run) skips both
    so the prep stays credential- and service-free.
    """
    if target_name not in TARGETS:
        raise SystemExit(f"unknown target {target_name!r}; known: {', '.join(TARGETS)}")
    src_dir = TARGETS[target_name]
    shutil.copytree(src_dir, dest, ignore=_IGNORE)

    if deps and target_name in NODE_TARGETS:
        vendored = src_dir / "node_modules"
        if not vendored.is_dir():
            raise FileNotFoundError(
                f"{target_name} target needs dependencies installed once: "
                f"cd {src_dir} && npm ci"
            )
        run_eval._clone_node_modules(vendored, dest / "node_modules")
        if target_name == "backend":
            if svc_env is None:
                raise RuntimeError("backend target requires services (svc_env)")
            run_eval.reset_backend_db(svc_env, dest)

    for cmd in (
        ["git", "init", "-q"],
        ["git", "add", "-A"],
        ["git", "-c", "user.email=eval@adw.local", "-c", "user.name=adw-eval",
         "commit", "-q", "-m", "baseline"],
    ):
        subprocess.run(cmd, cwd=dest, check=True, capture_output=True)
    return dest


def build_manifest(task: dict, work_root: Path, svc_env: dict | None = None,
                   deps: bool = True) -> tuple[Path, dict]:
    """Prepare every repo and write a repos.json; return (manifest_path, name->dir)."""
    entries, prepared = [], {}
    for repo in task["repos"]:
        dest = work_root / repo["name"]
        prepare_repo(repo["target"], dest, svc_env=svc_env, deps=deps)
        prepared[repo["name"]] = dest
        entries.append({
            "name": repo["name"],
            "path": str(dest),
            "base_branch": "HEAD",          # fresh repo: baseline commit is the base
            "plan_type": repo.get("plan_type", "feature"),
            "order": len(entries) + 1,
        })
    manifest = work_root / "repos.json"
    manifest.write_text(json.dumps({"version": 1, "repos": entries}, indent=2))
    return manifest, prepared


def run_command(cmd: list[str], log_path: Path) -> tuple[int, str]:
    with open(log_path, "w") as log:
        proc = subprocess.run(cmd, cwd=str(HARNESS_ROOT), stdout=log,
                              stderr=subprocess.STDOUT, text=True)
    return proc.returncode, log_path.read_text()


def find_summary(stdout: str) -> dict | None:
    """Locate the multirepo summary.json — parse the printed path, else newest."""
    m = re.search(r"summary → (\S+summary\.json)", stdout)
    candidates = [Path(m.group(1))] if m else []
    candidates += sorted((HARNESS_ROOT / "agents").glob("*/multirepo/summary.json"),
                         key=lambda p: p.stat().st_mtime, reverse=True)
    for p in candidates:
        if p.is_file():
            return json.loads(p.read_text())
    return None


def _sh(check: str, cwd: Path) -> bool:
    try:
        return subprocess.run(check, shell=True, cwd=cwd, capture_output=True,
                              text=True, timeout=300).returncode == 0
    except subprocess.TimeoutExpired:
        return False


def grade_repo(repo_task: dict, worktree: Path) -> dict:
    """Grade one repo's worktree: its test_command (pass/fail) + acceptance ratio."""
    tests_ok = _sh(repo_task["test_command"], worktree) if repo_task.get("test_command") else None
    checks = repo_task.get("acceptance", [])
    acc_passed = sum(1 for c in checks if _sh(c, worktree))
    return {
        "tests_pass": tests_ok,
        "acceptance_passed": acc_passed,
        "acceptance_total": len(checks),
        "acceptance_ok": acc_passed == len(checks),
    }


def _free_port() -> int:
    """Ask the OS for an unused TCP port (avoids the worktree's 9200-9214 range)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_for_http(port: int, timeout: float = 90.0) -> bool:
    """Poll until the Next server accepts connections (or timeout)."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) == 0:
                return True
        time.sleep(0.5)
    return False


def grade_frontend(repo_task: dict, worktree: Path) -> dict:
    """Grade the Next.js worktree without a live backend.

    tests_pass = `next build` (compile + typecheck gate) AND the held-out
    Playwright oracle, which runs against `next start` on a free port with the
    API stubbed. acceptance = the task's structural greps. The oracle spec is
    copied in just for the run and removed after — the agent never sees it.

    CI is unset so playwright.config's `reuseExistingServer` is true: it reuses
    the server we start instead of launching its own `npm run dev`.
    """
    checks = repo_task.get("acceptance", [])
    acc_passed = sum(1 for c in checks if _sh(c, worktree))
    base = {
        "acceptance_passed": acc_passed,
        "acceptance_total": len(checks),
        "acceptance_ok": acc_passed == len(checks),
    }
    env = clean_subprocess_env()
    env.pop("CI", None)

    build = subprocess.run("npx next build", shell=True, cwd=worktree, env=env,
                           capture_output=True, text=True, timeout=1200)
    build_ok = build.returncode == 0
    oracle_ok = False

    spec_name = repo_task.get("oracle_spec", "grow_phase_age.spec.ts")
    spec_src = FE_ORACLE_DIR / spec_name
    if build_ok and spec_src.is_file():
        port = _free_port()
        dest_spec = worktree / "e2e" / f"_oracle_{spec_name}"
        dest_spec.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(spec_src, dest_spec)
        srv_env = {**env, "PORT": str(port), "FRONTEND_PORT": str(port),
                   "NODE_ENV": "production"}
        server = subprocess.Popen(
            f"npx next start -p {port}", shell=True, cwd=worktree, env=srv_env,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        try:
            if _wait_for_http(port):
                pw = subprocess.run(
                    f"npx playwright test e2e/{dest_spec.name} "
                    f"--project=chromium --reporter=line --workers=1",
                    shell=True, cwd=worktree,
                    env={**env, "FRONTEND_PORT": str(port)},
                    capture_output=True, text=True, timeout=300,
                )
                oracle_ok = pw.returncode == 0
        finally:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
            dest_spec.unlink(missing_ok=True)

    return {**base, "tests_pass": build_ok and oracle_ok,
            "build_ok": build_ok, "oracle_ok": oracle_ok}


def score_rows(rows: list[dict]) -> dict:
    """Map per-repo grades into compare.py's flat scores schema.

    `acceptance_checks` and `tests_pass` are POOLED across repos so each is 1.0
    only when every repo fully passes — which is what makes compare.py's pass^k
    mean "all repos solved on every trial". Per-repo detail lands as
    `<repo>_acceptance` / `<repo>_tests` columns.
    """
    acc_passed = sum(r["acceptance_passed"] for r in rows)
    acc_total = sum(r["acceptance_total"] for r in rows)
    tested = [r for r in rows if r["tests_pass"] is not None]
    scores = {
        "acceptance_checks": (acc_passed / acc_total) if acc_total else 0.0,
        "tests_pass": (sum(1 for r in tested if r["tests_pass"]) / len(tested)) if tested else 0.0,
        "plan_build": (sum(1 for r in rows if r["success"]) / len(rows)) if rows else 0.0,
    }
    for r in rows:
        tot = r["acceptance_total"]
        scores[f"{r['repo']}_acceptance"] = (r["acceptance_passed"] / tot) if tot else 0.0
        if r["tests_pass"] is not None:
            scores[f"{r['repo']}_tests"] = 1.0 if r["tests_pass"] else 0.0
    return scores


def write_compare_result(variant: str, task_id: str, trial: int, status: str,
                         scores: dict) -> Path:
    """Write result.json where compare.py reads it: results/{variant}/{task}/{trial}/."""
    out = COMPARE_RESULTS / variant / task_id / str(trial)
    out.mkdir(parents=True, exist_ok=True)
    path = out / "result.json"
    path.write_text(json.dumps(
        {"variant": variant, "task_id": task_id, "trial": trial,
         "status": status, "scores": scores}, indent=2) + "\n")
    return path


def execute_trial(task: dict, by_name: dict, ticket: str, args, trial: int,
                  svc_env: dict | None = None) -> tuple[str, list[dict]]:
    """Run one trial: prepare fresh repos, run travis_multirepo, grade each repo's
    worktree. Returns (status, rows). status is "infra_error" when no run summary
    is produced — so the trial carries no scores and compare.py excludes it."""
    work_root = Path(tempfile.mkdtemp(prefix=f"mreval_{task['id']}_t{trial}_"))
    manifest, prepared = build_manifest(task, work_root, svc_env=svc_env)

    cmd = ["uv", "run", str(MULTIREPO_SCRIPT), ticket,
           "--manifest", str(manifest), "--no-memory", "--skip-document"]
    if args.serialize:
        cmd.append("--serialize")
    if args.model:
        cmd += ["--model", args.model]
    if args.effort:
        cmd += ["--effort", args.effort]

    run_label = f"{task['id']}_{args.variant}_t{trial}_{int(time.time())}"
    log_path = MULTIREPO_RESULTS / f"{run_label}.log"
    print(f"[trial {trial}] {task['id']} variant={args.variant}: {len(task['repos'])} repos "
          f"({'serial' if args.serialize else 'parallel'}) → {log_path}")

    rc, stdout = run_command(cmd, log_path)
    summary = find_summary(stdout)
    if summary is None:
        print(f"  infra_error: no run summary produced (rc={rc}); see {log_path}")
        if args.keep_trees:
            print(f"  --keep-trees: prepared repos + manifest kept under {work_root}")
        else:
            shutil.rmtree(work_root, ignore_errors=True)
        return "infra_error", []

    rows = []
    for entry in summary["repos"]:
        name, adw_id = entry["repo"], entry["adw_id"]
        worktree = HARNESS_ROOT / "trees" / adw_id
        graded = {"tests_pass": None, "acceptance_passed": 0,
                  "acceptance_total": 0, "acceptance_ok": False}
        if worktree.is_dir() and name in by_name:
            repo_task = by_name[name]
            graded = (grade_frontend(repo_task, worktree)
                      if repo_task.get("target") == "frontend"
                      else grade_repo(repo_task, worktree))
        ok = bool(entry["success"]) and graded["acceptance_ok"]
        rows.append({**entry, **graded, "overall_ok": ok, "worktree": str(worktree)})

    # Cleanup unless --keep-trees. work_root holds the prepared SOURCE repos; each
    # kept worktree's gitdir links back INTO work_root, so removing work_root would
    # orphan the kept tree (git breaks inside it). Keep both together, or remove both
    # together — never split them.
    if not args.keep_trees:
        for r in rows:
            d = prepared.get(r["repo"])
            if d:
                subprocess.run(["git", "-C", str(d), "worktree", "remove", "--force",
                                r["worktree"]], capture_output=True)
            shutil.rmtree(r["worktree"], ignore_errors=True)
        shutil.rmtree(work_root, ignore_errors=True)
    else:
        print(f"  --keep-trees: worktrees + their source repos kept under {work_root}")
    return "ok", rows


def print_scorecard(task: dict, trial: int, status: str, rows: list[dict],
                    scores: dict, result_path: Path) -> None:
    print(f"\n{'='*72}\n  MULTI-REPO EVAL: {task['id']}  (trial {trial}, status={status})\n{'='*72}")
    if status != "ok":
        print(f"  (no scores — trial excluded from compare) → {result_path}\n")
        return
    print(f"  {'repo':<8} {'plan+build':<11} {'tests':<7} {'acceptance':<11} overall")
    for r in rows:
        pb = "✅" if r["success"] else f"❌ {r.get('failed_phase') or 'fail'}"
        tests = {True: "✅", False: "❌", None: "—"}[r["tests_pass"]]
        acc = f"{r['acceptance_passed']}/{r['acceptance_total']}"
        print(f"  {r['repo']:<8} {pb:<11} {tests:<7} {acc:<11} "
              f"{'✅' if r['overall_ok'] else '❌'}")
    pooled = f"acceptance_checks={scores['acceptance_checks']:.2f} tests_pass={scores['tests_pass']:.2f}"
    print(f"\n  pooled: {pooled} → {result_path}\n")


def _dry_run(task: dict, ticket: str, args) -> int:
    """Credential-free: prepare repos + write the manifest + print the command."""
    work_root = Path(tempfile.mkdtemp(prefix=f"mreval_{task['id']}_dry_"))
    manifest, prepared = build_manifest(task, work_root, deps=False)
    sys.path.insert(0, str(HARNESS_ROOT / "adws"))
    import logging
    from adw_modules.feature_worktree import assert_worktree_capable
    print(f"[dry-run] task {task['id']} — {len(task['repos'])} repo(s)")
    for name, d in prepared.items():
        ok, err = assert_worktree_capable(str(d), logging.getLogger("dry"))
        print(f"  prepared {name:<8} {d}  worktree-capable={ok}" + (f" ({err})" if err else ""))
    cmd = ["uv", "run", str(MULTIREPO_SCRIPT), ticket, "--manifest", str(manifest),
           "--no-memory", "--skip-document"] + (["--serialize"] if args.serialize else [])
    print(f"  manifest → {manifest}")
    print(f"  would run: {' '.join(cmd)}")
    shutil.rmtree(work_root, ignore_errors=True)
    return 0


def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("task_id")
    ap.add_argument("--variant", default="multirepo")
    ap.add_argument("--trials", type=int, default=1)
    ap.add_argument("--serialize", action="store_true")
    ap.add_argument("--model")
    ap.add_argument("--effort")
    ap.add_argument("--keep-trees", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    task = load_task(args.task_id)
    ticket = task["ticket"].strip()
    by_name = {r["name"]: r for r in task["repos"]}

    if args.dry_run:
        return _dry_run(task, ticket, args)

    # Backend repos need postgres+redis; start them once (and only then) so
    # frontend-only or stdlib-only tasks stay service-free. svc_env goes into our
    # process env so it reaches the travis_multirepo child and the grade commands
    # (both inherit it), and is threaded into prepare_repo for the per-trial DB reset.
    needs_services = any(r["target"] == "backend" for r in task["repos"])
    svc_env = None
    if needs_services:
        svc_env = run_eval.ensure_backend_services()
        os.environ.update(svc_env)

    MULTIREPO_RESULTS.mkdir(parents=True, exist_ok=True)
    solved = 0
    try:
        for trial in range(args.trials):
            status, rows = execute_trial(task, by_name, ticket, args, trial, svc_env=svc_env)
            scores = score_rows(rows) if status == "ok" else {}
            path = write_compare_result(args.variant, task["id"], trial, status, scores)
            print_scorecard(task, trial, status, rows, scores, path)
            if status == "ok" and rows and all(r["overall_ok"] for r in rows):
                solved += 1
    finally:
        if needs_services:
            run_eval.teardown_backend_services()

    print(f"  variant={args.variant} · {solved}/{args.trials} trial(s) fully solved · "
          f"scorecard: uv run evals/compare.py --variants {args.variant}\n")
    return 0 if args.trials > 0 and solved == args.trials else 1


if __name__ == "__main__":
    raise SystemExit(main())
