#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pydantic", "python-dotenv", "pyyaml", "rich", "json-repair"]
# ///
"""ADW eval orchestrator — measure whether harness changes are good or bad.

For each (task, trial): copy the bundled target app to a clean temp dir,
git-init it (baseline commit = diff base), run the full Travis SDLC against
it with --working-dir, collect artifacts, run graders, and persist
results/{variant}/{task}/{trial}/result.json.

A "variant" is just a label for whatever harness code/flags you're testing:
  - planner A/B:   --variant travis --planner travis   vs  --variant openspec --planner openspec
  - branch A/B:    git checkout branchA && run --variant branchA ...  (then branchB)

Hygiene rules (adapted from Anthropic's cwc-workshops rightmodel audit,
https://github.com/anthropics/cwc-workshops, Apache-2.0):
  - Same task list per variant; 3 independent trials by default.
  - Infra failures get status="infra_error" — never counted as task failure.
  - Judge cost recorded separately from SUT cost.

Usage:
  uv run evals/run_eval.py run --variant travis --all --trials 3
  uv run evals/run_eval.py run --variant smoke --tasks 03 --trials 1 --keep-tmp
  uv run evals/run_eval.py run --variant openspec --planner openspec --all
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import yaml
from dotenv import load_dotenv
from rich.console import Console

EVALS_DIR = Path(__file__).resolve().parent
HARNESS_ROOT = EVALS_DIR.parent
sys.path.insert(0, str(HARNESS_ROOT / "adws"))
sys.path.insert(0, str(EVALS_DIR))

from adw_modules.utils import make_adw_id  # noqa: E402
from graders import build_context, clean_subprocess_env, run_graders  # noqa: E402

TARGET_APP = EVALS_DIR / "target_app"
TARGET_BACKEND = EVALS_DIR / "target_backend"
TASKS_DIR = EVALS_DIR / "tasks"
RESULTS_DIR = EVALS_DIR / "results"
SDLC_SCRIPT = HARNESS_ROOT / "adws" / "travis" / "travis_sdlc.py"
PIPE_FEATURE_SCRIPT = HARNESS_ROOT / "adws" / "pipelines" / "pipe_feature.py"
COMPOSE_FILE = EVALS_DIR / "docker-compose.backend.yml"

# --engine slim invokes pipe_feature.py for every plan_type (feature/chore/
# bug) instead of pipe_bug.py — docs/slim-pipelines-plan.md §7.2, and see
# build_slim_cmd()'s docstring for why.
ENGINES = ("travis", "slim")

# Eval targets. Tasks pick one via a `target:` field (default "app").
# - app: hermetic stdlib notes CLI (tier 1 — cheap regression gate)
# - backend: vendored growbuddy Express/TS backend (tier 2 — realistic;
#   needs postgres+redis (local or docker), npm ci'd node_modules in the
#   vendored dir, and a longer trial timeout)
TARGETS = {
    "app": {
        "dir": TARGET_APP,
        "seed_memory": EVALS_DIR / "seed_memory",
        "sdlc_timeout_s": 3600,
    },
    "backend": {
        "dir": TARGET_BACKEND,
        "seed_memory": EVALS_DIR / "seed_memory_backend",
        "sdlc_timeout_s": 5400,  # bigger codebase, slower phases
    },
}

BACKEND_TEST_DB = "growbuddy_test_0"

console = Console()


def load_tasks(task_ids: list[str] | None) -> list[dict]:
    """Load task YAMLs; filter by id prefix list (e.g. ['01','03']) if given."""
    tasks = []
    for path in sorted(TASKS_DIR.glob("*.yaml")):
        task = yaml.safe_load(path.read_text())
        task.setdefault("target", "app")
        if task["target"] not in TARGETS:
            raise ValueError(f"{path.name}: unknown target {task['target']!r}")
        if task_ids is None or any(
            task["id"] == tid or task["id"].startswith(tid) for tid in task_ids
        ):
            tasks.append(task)
    return tasks


# ---------------------------------------------------------------------------
# Backend services (docker compose) — only when backend-target tasks run
# ---------------------------------------------------------------------------

def _port_free(port: int) -> bool:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def _local_services_usable() -> bool:
    """True if postgres (5432, postgres/postgres) and redis (6379) answer.

    Developers running the original app locally already have the exact
    services the backend tests expect — reuse them instead of requiring
    Docker. Only the throwaway growbuddy_test_0 DB is touched.
    """
    probe = (
        "const {Client}=require('pg');"
        "const c=new Client({host:'127.0.0.1',port:5432,user:'postgres',"
        "password:'postgres',database:'postgres',connectionTimeoutMillis:3000});"
        "c.connect().then(()=>c.end()).then(()=>process.exit(0))"
        ".catch(()=>process.exit(1));"
    )
    pg_ok = subprocess.run(
        ["node", "-e", probe], cwd=TARGET_BACKEND, capture_output=True, timeout=15,
    ).returncode == 0
    return pg_ok and not _port_free(6379)


_started_compose = False


def ensure_backend_services() -> dict:
    """Return DB_*/REDIS_* env for backend trials.

    Prefers already-running local services (the developer's growbuddy
    stack); falls back to docker compose with port-conflict avoidance.
    """
    global _started_compose
    if _local_services_usable():
        console.print("[dim]Reusing local postgres:5432 + redis:6379 for backend trials[/dim]")
        pg_port, redis_port = 5432, 6379
    else:
        pg_port = 5432 if _port_free(5432) else 55432
        redis_port = 6379 if _port_free(6379) else 56379
        env = {
            **clean_subprocess_env(),
            "ADW_EVAL_PG_PORT": str(pg_port),
            "ADW_EVAL_REDIS_PORT": str(redis_port),
        }
        console.print(f"[dim]Starting eval services via docker (postgres:{pg_port}, redis:{redis_port})...[/dim]")
        result = subprocess.run(
            ["docker", "compose", "-f", str(COMPOSE_FILE), "up", "-d", "--wait"],
            env=env, capture_output=True, text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(
                "Backend services unavailable: no usable local postgres/redis and "
                f"docker compose failed:\n{result.stderr[-500:]}\n"
                "Start Docker Desktop or a local postgres (postgres/postgres) + redis."
            )
        _started_compose = True
    return {
        "DB_HOST": "127.0.0.1",
        "DB_PORT": str(pg_port),
        "DB_USER": "postgres",
        "DB_PASSWORD": "postgres",
        "REDIS_HOST": "127.0.0.1",
        "REDIS_PORT": str(redis_port),
    }


def teardown_backend_services() -> None:
    """Tear down only what we started — never a developer's own services."""
    if _started_compose:
        subprocess.run(
            ["docker", "compose", "-f", str(COMPOSE_FILE), "down", "-v"],
            capture_output=True, env=clean_subprocess_env(),
        )


def reset_backend_db(svc_env: dict, target: Path) -> None:
    """Fresh schema per trial: drop/recreate the test DB, run migrations.

    Uses node+pg from the target's own node_modules so it works identically
    whether services are local or docker-managed.
    """
    sql = (
        "const {Client}=require('pg');"
        f"const c=new Client({{host:'{svc_env['DB_HOST']}',port:{svc_env['DB_PORT']},"
        "user:'postgres',password:'postgres',database:'postgres'});"
        "c.connect()"
        f".then(()=>c.query(`DROP DATABASE IF EXISTS {BACKEND_TEST_DB} WITH (FORCE)`))"
        f".then(()=>c.query(`CREATE DATABASE {BACKEND_TEST_DB}`))"
        ".then(()=>c.end())"
        ".catch(e=>{console.error(e.message);process.exit(1);});"
    )
    drop_create = subprocess.run(
        ["node", "-e", sql], cwd=target, capture_output=True, text=True, timeout=60,
        env=clean_subprocess_env(),
    )
    if drop_create.returncode != 0:
        raise RuntimeError(f"test DB reset failed: {drop_create.stderr[-500:]}")
    migrate = subprocess.run(
        ["npm", "run", "migrate:test"],
        cwd=target, capture_output=True, text=True, timeout=300,
        env={**clean_subprocess_env(), **svc_env, "DB_NAME": BACKEND_TEST_DB},
    )
    if migrate.returncode != 0:
        raise RuntimeError(f"migrate:test failed:\n{migrate.stderr[-1500:]}")


def _clone_node_modules(src: Path, dst: Path) -> None:
    """Fast node_modules copy. APFS clonefile (cp -c) is near-instant on
    macOS; falls back to a regular copy elsewhere."""
    result = subprocess.run(["cp", "-Rc", str(src), str(dst)], capture_output=True)
    if result.returncode != 0:
        shutil.copytree(src, dst, symlinks=True)


def prepare_target(
    tmp_root: Path,
    with_memory: bool = False,
    target_name: str = "app",
    svc_env: dict | None = None,
    setup: list[str] | None = None,
) -> Path:
    """Copy a target to a clean dir and commit a git baseline.

    Local development artifacts (.venv, caches, node_modules, data files)
    are excluded from the tree copy; for the backend target, node_modules is
    then cloned from the vendored install (npm ci once in target_backend/),
    and the test database is dropped/recreated + migrated.

    When with_memory is True, the target's checked-in seed store is copied
    to <target>/ai_docs/memory/ BEFORE the baseline commit, so the memory is
    part of the diff base (never counted as implementation churn).

    `setup` is an optional list of shell commands run in the target BEFORE the
    baseline commit — used by captured bug tasks to plant a regression into the
    baseline so the agent has something to fix. They become part of the diff
    base, never counted as the agent's churn.
    """
    spec = TARGETS[target_name]
    src_dir = spec["dir"]
    target = tmp_root / src_dir.name
    shutil.copytree(
        src_dir, target,
        ignore=shutil.ignore_patterns(
            ".venv", "__pycache__", ".pytest_cache", "notes.json", "uv.lock",
            ".git", "node_modules", "logs", "coverage",
        ),
    )

    if target_name == "backend":
        vendored_modules = src_dir / "node_modules"
        if not vendored_modules.is_dir():
            raise FileNotFoundError(
                f"Backend target needs dependencies installed once: "
                f"cd {src_dir} && npm ci"
            )
        _clone_node_modules(vendored_modules, target / "node_modules")
        if svc_env is None:
            raise RuntimeError("backend target requires services (svc_env)")
        reset_backend_db(svc_env, target)

    if with_memory:
        seed = spec["seed_memory"]
        if not seed.is_dir():
            raise FileNotFoundError(
                f"--memory requires a seed store at {seed} "
                "(dream one from prior runs with travis_dream.py)"
            )
        shutil.copytree(seed, target / "ai_docs" / "memory")

    # Plant any captured regression into the baseline (before the commit) so
    # the agent sees the bug as the starting state, not as someone's churn.
    for cmd in setup or []:
        proc = subprocess.run(
            cmd, shell=True, cwd=target,
            capture_output=True, text=True, env=clean_subprocess_env(),
        )
        if proc.returncode != 0:
            raise RuntimeError(
                f"setup step failed (rc={proc.returncode}): {cmd}\n{proc.stderr[-500:]}"
            )

    for cmd in (
        ["git", "init", "-q"],
        ["git", "add", "-A"],
        ["git", "-c", "user.email=eval@adw.local", "-c", "user.name=adw-eval",
         "commit", "-q", "-m", "baseline"],
    ):
        subprocess.run(cmd, cwd=target, check=True, capture_output=True)
    return target


def build_travis_cmd(task: dict, adw_id: str, target: Path, cfg: argparse.Namespace) -> list[str]:
    """The exact travis_sdlc.py invocation for a trial. Pure (no subprocess,
    no I/O) so it's unit-testable in isolation — see test_run_eval_engine.py.
    Untouched by the --engine addition: this is byte-identical to the
    inline command run_sdlc() built before that flag existed.
    """
    cmd = [
        "uv", "run", str(SDLC_SCRIPT),
        task["prompt"].strip(),
        adw_id,
        "--plan-type", task["plan_type"],
        "--planner", cfg.planner,
        "--model", cfg.model,
        *(["--effort", cfg.effort] if getattr(cfg, "effort", None) else []),
        "--working-dir", str(target),
        "--diff-base", "HEAD",          # fresh repo: baseline commit is the base
        "--skip-document",              # docs add cost, not signal, in evals
    ]
    if not cfg.memory:
        cmd.append("--no-memory")       # keep memory-off baselines clean
    if cfg.skip_review:
        cmd.append("--skip-review")
    if cfg.skip_validate:
        cmd.append("--skip-validate")
    if getattr(cfg, "review_spec", False):
        # Variant B of the spec-defect eval: run the auto spec-critic between
        # plan and build (human mode would pause and can't run headless).
        cmd.append("--review-spec=auto")
    return cmd


def build_slim_cmd(task: dict, target: Path, cfg: argparse.Namespace) -> list[str]:
    """The pipe_feature.py invocation for --engine slim. Pure — see
    build_travis_cmd()'s docstring.

    No --adw-id: pipe_feature.py mints its own (adw_modules.utils.make_adw_id)
    when the flag is omitted, and prints `state: <path>` on stdout at the end
    of every run (both the early-exit and normal-completion code paths) — the
    runner discovers the adw_id and pipeline_state.json from that line
    (parse_state_path/run_slim) rather than pre-assigning one, matching how a
    human would invoke the pipeline standalone.

    plan_type feature|chore|bug ALL route through pipe_feature.py's own
    --plan-type (it forwards to the matching /feature, /chore, or /bug
    planner slash command) — pipe_bug.py is a separate, thinner CLI wrapper
    around the same run_pipeline() and is intentionally not used here.
    """
    return [
        "uv", "run", str(PIPE_FEATURE_SCRIPT),
        task["prompt"].strip(),
        "--working-dir", str(target),
        "--model", cfg.model,
        "--plan-type", task["plan_type"],
    ]


def run_sdlc(task: dict, adw_id: str, target: Path, cfg: argparse.Namespace,
             svc_env: dict | None = None) -> dict:
    """Run travis_sdlc.py against the target. Returns run metadata.

    svc_env (DB_*/REDIS_* for the backend target) is merged into the
    subprocess env; agent.py inherits the parent env, so these reach the
    Claude agents and the test commands they run.
    """
    cmd = build_travis_cmd(task, adw_id, target, cfg)
    timeout_s = TARGETS[task["target"]]["sdlc_timeout_s"]
    start = time.monotonic()
    try:
        proc = subprocess.run(
            cmd,
            cwd=HARNESS_ROOT,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            # Don't leak this script's uv env into phases; thread service env in
            env={**clean_subprocess_env(), **(svc_env or {})},
        )
        wall_ms = (time.monotonic() - start) * 1000
        return {
            "returncode": proc.returncode,
            "wall_ms": wall_ms,
            "timed_out": False,
            "tail": proc.stdout[-2000:],
        }
    except subprocess.TimeoutExpired:
        return {
            "returncode": -1,
            "wall_ms": (time.monotonic() - start) * 1000,
            "timed_out": True,
            "tail": "",
        }


STATE_LINE_PREFIX = "state: "


def parse_state_path(stdout: str) -> str | None:
    """Pull the `state: <path>` line pipe_feature.py prints on stdout.

    Both of pipe_feature.py's terminal code paths (early-exit via
    _fail_before_build, and normal completion at the end of run_pipeline)
    print exactly one such line right before PASS/FAIL — see
    adws/pipelines/pipe_feature.py. Returns None if no such line is present
    (e.g. the process died before ever reaching either of those, such as a
    bad --model value or a malformed adw_gates.json).
    """
    for line in stdout.splitlines():
        if line.startswith(STATE_LINE_PREFIX):
            return line[len(STATE_LINE_PREFIX):].strip()
    return None


def run_slim(task: dict, target: Path, cfg: argparse.Namespace,
             svc_env: dict | None = None) -> dict:
    """Run pipe_feature.py against the target for --engine slim.

    Mirrors run_sdlc()'s run_meta shape (returncode/wall_ms/timed_out/tail)
    plus what the slim engine additionally needs: the adw_id pipe_feature.py
    minted for itself and its parsed agents/<adw_id>/pipeline_state.json —
    discovered by parsing the `state: <path>` stdout line (parse_state_path),
    never pre-assigned (see build_slim_cmd's docstring). `state`/`adw_id`
    stay {} / None when the line is absent or the file can't be read — the
    caller (classify_status_slim) treats that as infra_error, never a fake
    task_fail.
    """
    cmd = build_slim_cmd(task, target, cfg)
    timeout_s = TARGETS[task["target"]]["sdlc_timeout_s"]
    start = time.monotonic()
    try:
        proc = subprocess.run(
            cmd,
            cwd=HARNESS_ROOT,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            env={**clean_subprocess_env(), **(svc_env or {})},
        )
        wall_ms = (time.monotonic() - start) * 1000
        # pipe_feature.py's own errors go to stderr (its `print(..., file=
        # sys.stderr)` calls); the tail must include both streams or an
        # infra-marker (session/rate limit) printed only to stderr would be
        # invisible to classify_status_slim's INFRA_ERROR_MARKERS scan.
        tail = ((proc.stdout or "") + (proc.stderr or ""))[-2000:]
        state_path = parse_state_path(proc.stdout or "")
        state: dict = {}
        adw_id = None
        if state_path:
            try:
                state = json.loads(Path(state_path).read_text())
                adw_id = state.get("adw_id")
            except (OSError, json.JSONDecodeError):
                state = {}
        return {
            "returncode": proc.returncode,
            "wall_ms": wall_ms,
            "timed_out": False,
            "tail": tail,
            "state_path": state_path,
            "state": state,
            "adw_id": adw_id,
        }
    except subprocess.TimeoutExpired:
        return {
            "returncode": -1,
            "wall_ms": (time.monotonic() - start) * 1000,
            "timed_out": True,
            "tail": "",
            "state_path": None,
            "state": {},
            "adw_id": None,
        }


# Error markers that mean the ENVIRONMENT failed, not the task. A session/rate
# limit mid-run poisons every subsequent trial — these must never be scored as
# task failures (audit rule: never conflate infra with task failure).
INFRA_ERROR_MARKERS = (
    "session limit",
    "rate limit",
    "usage limit",
    "Invalid MCP configuration",
    "overloaded",
)


def _phase_errors(state: dict) -> list[str]:
    return [
        str(r.get("error", ""))
        for r in (state.get("phase_results") or {}).values()
        if r and not r.get("success")
    ]


def _phase_infra_marker_hits(phase_results: dict) -> set[str]:
    """Names of phases (from pipeline_state.json's phase_results, slim
    engine) whose recorded text — any string value on that phase's dict,
    e.g. "error" or "output_tail" — contains an INFRA_ERROR_MARKERS hit.

    Unlike classify_status()'s _phase_errors() (travis, "error" field only),
    slim phases record marker text under different keys depending on phase
    (build/plan/gates/fix-N use "error"; the advisory review phase uses
    "output_tail" — see the m4-slim/01-feature-tags/3 specimen), so every
    string value is scanned rather than assuming a single field name.
    """
    hits = set()
    for phase, result in (phase_results or {}).items():
        if not isinstance(result, dict):
            continue
        blob = " ".join(str(v) for v in result.values() if isinstance(v, str))
        if any(marker.lower() in blob.lower() for marker in INFRA_ERROR_MARKERS):
            hits.add(phase)
    return hits


def slim_advisory_review_infra(state: dict) -> bool:
    """True iff an infra marker is recorded ONLY in the advisory review
    phase of an otherwise-successful slim run (state["overall_success"] is
    True).

    pipe_feature.py's review phase is advisory/non-blocking by design — its
    success or failure never affects overall_success (see the
    m4-slim/01-feature-tags/3 specimen: review failed with a session-limit
    marker, overall_success is still true). So a marker recorded ONLY there
    must not retroactively cast doubt on an otherwise fully-measured,
    successful run; it's recorded via this flag instead of infra_error (see
    classify_status_slim). Any marker found in a non-review phase — or a
    review-only marker on a run that wasn't otherwise successful — does not
    set this flag (the former is a real infra_error; the latter is a plain
    task_fail with an incidental, non-gating review hiccup, not "advisory
    cover" for anything).
    """
    if not bool(state.get("overall_success")):
        return False
    phase_results = state.get("phase_results") or {}
    return _phase_infra_marker_hits(phase_results) == {"review"}


def classify_status(run_meta: dict, state: dict) -> str:
    """ok | task_fail | infra_error.

    Infra errors (harness/claude breakage, timeouts, session/rate limits,
    no phase ever ran) are a separate bucket from task failures — never
    conflate them (audit rule).
    """
    if run_meta["timed_out"]:
        return "infra_error"
    # Any phase error matching a known environment-failure marker → infra,
    # even if earlier phases succeeded (e.g. limit hit mid-build).
    for error in _phase_errors(state):
        if any(marker.lower() in error.lower() for marker in INFRA_ERROR_MARKERS):
            return "infra_error"
    phase_results = state.get("phase_results", {})
    if not phase_results:
        return "infra_error"  # nothing ran — env/CLI problem, not the task
    plan = phase_results.get("plan") or {}
    build = phase_results.get("build") or {}
    if plan.get("success") and build.get("success"):
        return "ok" if run_meta["returncode"] == 0 else "task_fail"
    return "task_fail"


def classify_status_slim(run_meta: dict) -> str:
    """ok | task_fail | infra_error, for --engine slim (run_slim()'s run_meta).

    Mirrors classify_status()'s infra-vs-task split (never conflate them —
    audit rule) but against pipeline_state.json's schema instead of
    travis_state.json's: success is exit code AND state["overall_success"]
    (both, per the task brief) rather than travis's per-named-phase check,
    since pipe_feature.py's phases (plan/build/gates/fix-N/review) aren't the
    same shape as travis's 7-phase state.

    The tail (run_meta["tail"], the CLI's own captured stdout+stderr) is
    scanned first, but a phase can fail with an infra marker that never
    reaches that tail at all — e.g. a review sub-agent's own session-limit
    error, recorded only in pipeline_state.json's phase_results (see the
    m4-slim/01-feature-tags/3 specimen, which was scored "ok" before this
    fix). So every phase's recorded text is scanned too
    (_phase_infra_marker_hits) — except a marker found ONLY in the advisory
    review phase does not flip status to infra_error (see
    slim_advisory_review_infra's docstring for why); the caller (run_trial)
    records that case via a separate "advisory_review_infra" result field
    instead, and status here follows the normal overall_success/returncode
    computation.
    """
    if run_meta["timed_out"]:
        return "infra_error"
    tail = run_meta.get("tail") or ""
    if any(marker.lower() in tail.lower() for marker in INFRA_ERROR_MARKERS):
        return "infra_error"
    if not run_meta.get("state_path") or not run_meta.get("state"):
        # pipe_feature.py never wrote a state file at all — it died before
        # run_pipeline()/_fail_before_build ever ran (bad flags, malformed
        # adw_gates.json). Environment/harness problem, not a task failure —
        # same "nothing ran" rule classify_status applies to travis.
        return "infra_error"
    state = run_meta["state"]
    marker_phases = _phase_infra_marker_hits(state.get("phase_results") or {})
    if marker_phases - {"review"}:
        # A marker in any phase other than the advisory review one (plan/
        # build/gates/fix-N) is a real infra failure, even if overall_success
        # ended up true — same "even if earlier phases succeeded" rule
        # classify_status applies to travis.
        return "infra_error"
    overall_success = bool(state.get("overall_success"))
    if overall_success and run_meta["returncode"] == 0:
        return "ok"
    return "task_fail"


def validate_engine_flags(cfg: argparse.Namespace) -> None:
    """Fail closed: --engine slim combined with a travis-only flag is an
    error, never a silent no-op (task brief). --planner is checked against
    None (its pre-fill sentinel — see main()) rather than the string
    "travis" so that an explicit `--engine slim --planner travis` is still
    rejected, not treated as a harmless restatement of the default.
    """
    if getattr(cfg, "engine", "travis") != "slim":
        return
    bad = []
    if getattr(cfg, "planner", None) is not None:
        bad.append("--planner")
    if getattr(cfg, "effort", None) is not None:
        bad.append("--effort")
    if getattr(cfg, "memory", False):
        bad.append("--memory")
    if getattr(cfg, "skip_review", False):
        bad.append("--skip-review")
    if getattr(cfg, "skip_validate", False):
        bad.append("--skip-validate")
    if getattr(cfg, "review_spec", False):
        bad.append("--review-spec")
    if bad:
        raise ValueError(
            f"--engine slim is incompatible with: {', '.join(bad)} "
            "(travis-only flags with no slim-pipeline equivalent — omit "
            "them, or drop --engine slim to use travis_sdlc.py)"
        )


def run_trial(task: dict, trial: int, cfg: argparse.Namespace,
              svc_env: dict | None = None) -> dict:
    adw_id = make_adw_id()
    tmp_root = Path(tempfile.mkdtemp(prefix=f"adw_eval_{task['id']}_"))
    console.print(f"  [dim]trial {trial}: adw_id={adw_id} target={tmp_root}[/dim]")

    result: dict = {
        "variant": cfg.variant,
        "task_id": task["id"],
        "trial": trial,
        "adw_id": adw_id,
        "planner": cfg.planner,
        "model": cfg.model,
        "effort": getattr(cfg, "effort", None),
        "memory": cfg.memory,
        "target": task["target"],
        "review_spec": getattr(cfg, "review_spec", False),
    }
    if getattr(cfg, "engine", "travis") == "slim":
        # New key, only present for the new engine — travis's result.json
        # shape (keys/order/values above) stays byte-identical either way.
        result["engine"] = "slim"

    try:
        target = prepare_target(
            tmp_root, with_memory=cfg.memory,
            target_name=task["target"], svc_env=svc_env,
            setup=task.get("setup"),
        )
        if getattr(cfg, "engine", "travis") == "slim":
            run_meta = run_slim(task, target, cfg, svc_env=svc_env)
            if run_meta.get("adw_id"):
                # pipe_feature.py mints its own adw_id (build_slim_cmd never
                # passes --adw-id — see its docstring); adopt the ID it
                # actually used so grading (agents/<adw_id>/*/
                # cc_final_object.json cost scan, etc.) looks in the right
                # place, and result["adw_id"] reflects the real run instead
                # of the placeholder generated above.
                adw_id = run_meta["adw_id"]
                result["adw_id"] = adw_id
            # Real pipeline_state.json (iterations/phase_results/plan_file),
            # kept verbatim — never translated into travis_state.json's
            # shape (graders.py is frozen and travis-shaped; see JUDGMENT
            # CALLS in the task report for what that means for `scores`).
            result["slim_state"] = run_meta.get("state") or None
            ctx = build_context(adw_id, target, task, run_meta["wall_ms"],
                                extra_env=svc_env or {})
            result["status"] = classify_status_slim(run_meta)
            if run_meta.get("state") and slim_advisory_review_infra(run_meta["state"]):
                # Non-blocking review-only infra hit on an otherwise-
                # successful run — see slim_advisory_review_infra's
                # docstring. Recorded here rather than flipping status, so
                # the legitimate cost/wall/tests scores for this trial are
                # kept while still surfacing that the review phase itself
                # didn't complete cleanly.
                result["advisory_review_infra"] = True
        else:
            run_meta = run_sdlc(task, adw_id, target, cfg, svc_env=svc_env)
            ctx = build_context(adw_id, target, task, run_meta["wall_ms"],
                                extra_env=svc_env or {})
            result["status"] = classify_status(run_meta, ctx.state)

        if result["status"] == "infra_error":
            result["scores"] = {}
            result["error_tail"] = run_meta["tail"]
        else:
            result["scores"] = run_graders(ctx)
            result["judge_cost_usd"] = ctx.judge_cost_usd
            result["judge_status"] = ctx.judge_status
            result["judge_inputs_truncated"] = ctx.judge_inputs_truncated

        result["wall_ms"] = run_meta["wall_ms"]
        result["sdlc_returncode"] = run_meta["returncode"]
    except Exception as e:
        result["status"] = "infra_error"
        result["scores"] = {}
        result["error"] = f"{type(e).__name__}: {e}"
    finally:
        if cfg.keep_tmp:
            result["target_dir"] = str(tmp_root)
            console.print(f"  [dim]kept target at {tmp_root}[/dim]")
        else:
            shutil.rmtree(tmp_root, ignore_errors=True)

    out_dir = RESULTS_DIR / cfg.variant / task["id"] / str(trial)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "result.json"
    out_file.write_text(json.dumps(result, indent=2) + "\n")
    console.print(f"  [green]✓[/green] {task['id']} trial {trial}: "
                  f"status={result['status']} → {out_file.relative_to(EVALS_DIR)}")
    return result


def cmd_run(cfg: argparse.Namespace) -> int:
    task_ids = None if cfg.all else (cfg.tasks.split(",") if cfg.tasks else None)
    if task_ids is None and not cfg.all:
        console.print("[red]Specify --tasks 01,03 or --all[/red]")
        return 1

    tasks = load_tasks(task_ids)
    if not tasks:
        console.print("[red]No tasks matched.[/red]")
        return 1

    console.print(f"[bold]Eval run[/bold] variant={cfg.variant} planner={cfg.planner} "
                  f"model={cfg.model} memory={'on' if cfg.memory else 'off'} "
                  f"tasks={[t['id'] for t in tasks]} trials={cfg.trials}")
    if getattr(cfg, "engine", "travis") == "slim":
        console.print(
            f"[dim]engine=slim → {PIPE_FEATURE_SCRIPT.relative_to(HARNESS_ROOT)} "
            "(docs/slim-pipelines-plan.md M4)[/dim]"
        )

    # Start docker services once if any task targets the backend
    svc_env: dict | None = None
    needs_backend = any(t["target"] == "backend" for t in tasks)
    if needs_backend:
        svc_env = ensure_backend_services()

    statuses: list[str] = []
    consecutive_infra = 0
    aborted = False
    for task in tasks:
        if aborted:
            break
        console.print(f"\n[bold]{task['id']}[/bold] ({task['plan_type']}, target={task['target']})")
        for trial in range(1, cfg.trials + 1):
            result = run_trial(task, trial, cfg,
                               svc_env=svc_env if task["target"] == "backend" else None)
            statuses.append(result["status"])
            # Circuit breaker: a session/rate limit poisons every subsequent
            # trial — stop burning the suite instead of recording junk.
            consecutive_infra = consecutive_infra + 1 if result["status"] == "infra_error" else 0
            if consecutive_infra >= 2:
                console.print(
                    "[red]Aborting run: 2 consecutive infra errors "
                    "(likely a session/rate limit). Re-run remaining tasks "
                    "after the limit resets.[/red]"
                )
                aborted = True
                break

    if needs_backend:
        console.print("[dim]Tearing down eval services...[/dim]")
        teardown_backend_services()

    ok = statuses.count("ok")
    fail = statuses.count("task_fail")
    infra = statuses.count("infra_error")
    console.print(f"\n[bold]Done.[/bold] ok={ok} task_fail={fail} infra_error={infra}")
    console.print(f"Compare variants with: uv run evals/compare.py --baseline {cfg.variant}")
    return 0


def main() -> int:
    load_dotenv(HARNESS_ROOT / ".env")

    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="Run benchmark tasks for one variant")
    p_run.add_argument("--variant", required=True, help="Label for this harness variant")
    p_run.add_argument("--engine", default="travis", choices=list(ENGINES),
                       help="SDLC engine (default: travis). 'travis' runs "
                            "adws/travis/travis_sdlc.py unchanged; 'slim' runs "
                            "adws/pipelines/pipe_feature.py (docs/slim-pipelines-plan.md "
                            "§7.2/§8 M4). --engine slim is incompatible with "
                            "--planner/--effort/--memory/--skip-review/--skip-validate/"
                            "--review-spec (travis-only concepts) — combining them errors.")
    p_run.add_argument("--planner", default=None,
                       help="Planner to pass through (default: travis; --engine travis only)")
    p_run.add_argument("--model", default="opus", choices=["sonnet", "opus", "haiku"],
                       help="Planning model passed to travis_sdlc (default: opus)")
    p_run.add_argument("--effort", choices=["low", "medium", "high", "xhigh", "max"],
                       help="Claude effort level for every agent invocation "
                            "(default: unset → CLI default, high). Sweep axis; "
                            "no effect on haiku.")
    p_run.add_argument("--tasks", help="Comma-separated task id prefixes, e.g. 01,03")
    p_run.add_argument("--all", action="store_true", help="Run all tasks")
    p_run.add_argument("--trials", type=int, default=3, help="Trials per task (default: 3)")
    p_run.add_argument("--memory", action="store_true",
                       help="Seed evals/seed_memory/ into the target and enable memory injection "
                            "(default: off — baselines run with --no-memory)")
    p_run.add_argument("--skip-review", action="store_true", help="Skip the review phase")
    p_run.add_argument("--skip-validate", action="store_true", help="Skip the validate phase")
    p_run.add_argument("--review-spec", action="store_true",
                       help="Enable the auto spec-review gate (LLM spec-critic between plan and "
                            "build). This is variant B of the spec-defect eval; baselines (variant A) "
                            "leave it off. See docs/spec-review-gate-plan.md §6.")
    p_run.add_argument("--keep-tmp", action="store_true", help="Keep trial target dirs for debugging")

    cfg = parser.parse_args()
    if cfg.command == "run":
        try:
            validate_engine_flags(cfg)
        except ValueError as e:
            console.print(f"[red]{e}[/red]")
            return 1
        if getattr(cfg, "engine", "travis") != "slim" and cfg.planner is None:
            # Restores the pre-flag default ("travis") for the travis engine;
            # left as None for slim so result.json honestly records "no
            # planner flag applies here" instead of a misleading "travis".
            cfg.planner = "travis"
        return cmd_run(cfg)
    return 2


if __name__ == "__main__":
    sys.exit(main())
