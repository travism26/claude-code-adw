"""Best-of-N build with hybrid-verifier selection.

Verified gap from the 2026-06-10 deep-research pass: parallel candidate
generation plus verifier-based selection is a measured performance lever
(CodeMonkeys; R2E-Gym showed execution-based and execution-free verifiers
have complementary failure modes, hybrid > either alone). ADW's build phase
was single-trajectory.

This runs N independent build trajectories from the same plan/spec, each in
an isolated git worktree of the target, scores every candidate with a hybrid
verifier (execution: the project's tests; execution-free: an LLM judge on the
diff vs the spec), and applies the winner's diff to the real working tree.
Research/plan stay single-trajectory — the spec is shared.

Opt-in via travis_sdlc `--attempts N` (N=1 keeps the normal single build).

Layout per run (under the harness agents/ dir):
  agents/<adw_id>/bestof/summary.json   — every candidate's score + verdict
  agents/<adw_id>-c<k>/builder/...       — each candidate's transcripts (kept)
  trees/<adw_id>-c<k>/                    — worktree (removed after selection)
"""

import json
import os
import re
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional

HARNESS_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(HARNESS_ROOT / "adws"))

from adw_modules.agent import (  # noqa: E402
    AgentPromptRequest,
    parse_jsonl_output,
    prompt_claude_code,
)
from adw_modules.utils import parse_json  # noqa: E402
# Shared with the durable feature-worktree path (travis_sdlc --worktree, fanout,
# multirepo) — one copy of the "carry untracked build inputs into a fresh tree" logic.
from adw_modules.feature_worktree import materialize_inputs  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

# Implementation diff only. Workflow artifacts (the plan already lives in the
# real working tree) and generated junk (caches, deps, build output — which a
# test run materializes and which break `git apply`) are excluded.
DIFF_EXCLUDES = [
    ":(exclude)specs", ":(exclude)ai_docs", ":(exclude)app_docs",
    ":(exclude)**/__pycache__/**", ":(exclude)**/*.pyc",
    ":(exclude).pytest_cache/**", ":(exclude)**/.pytest_cache/**",
    ":(exclude)node_modules/**", ":(exclude).venv/**",
    ":(exclude)coverage/**", ":(exclude)dist/**",
]

# Hybrid weights: execution evidence dominates, judge breaks ties / catches
# the "tests pass but solution is wrong-shaped" case (R2E-Gym rationale).
W_TESTS = 0.6
W_JUDGE = 0.4

JUDGE_MODEL = "sonnet"
MAX_DIFF_CHARS = 24_000
MAX_SPEC_CHARS = 12_000

PYTEST_PASS_RE = re.compile(r"(\d+) pass(?:ed|ing)")
PYTEST_FAIL_RE = re.compile(r"(\d+) fail(?:ed|ing)")
PYTEST_ERR_RE = re.compile(r"(\d+) error")


# --------------------------------------------------------------------------- #
# git helpers
# --------------------------------------------------------------------------- #

def _git(args: list[str], cwd: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True)


def _errtail(text: str, lines: int = 8) -> str:
    """Last few non-empty lines of stderr — avoids mid-word truncation."""
    return "\n".join(text.strip().splitlines()[-lines:])


def _head_commit(working_dir: str) -> Optional[str]:
    r = _git(["rev-parse", "HEAD"], working_dir)
    return r.stdout.strip() if r.returncode == 0 else None


def candidate_diff(cand_dir: str, base: str) -> str:
    """Implementation diff of a candidate worktree vs the base commit."""
    _git(["add", "-A"], cand_dir)
    return _git(["diff", "--cached", base, "--", ".", *DIFF_EXCLUDES], cand_dir).stdout


# --------------------------------------------------------------------------- #
# verifier
# --------------------------------------------------------------------------- #

def _verify(cand_dir: str, test_command: str, extra_env: dict) -> tuple[Optional[float], str]:
    """Run the execution verifier; return (score, combined_output).

    score is the ratio of passing tests, or 1.0/0.0 from the exit code when no
    summary is parseable. The output is returned so a fix agent can read the
    actual failure.
    """
    try:
        r = subprocess.run(
            test_command, shell=True, cwd=cand_dir,
            capture_output=True, text=True, timeout=600,
            env={**os.environ, **extra_env},
        )
    except subprocess.TimeoutExpired:
        return 0.0, "(verifier timed out after 600s)"
    out = r.stdout + r.stderr
    passed = sum(int(m) for m in PYTEST_PASS_RE.findall(out))
    failed = sum(int(m) for m in PYTEST_FAIL_RE.findall(out))
    failed += sum(int(m) for m in PYTEST_ERR_RE.findall(out))
    total = passed + failed
    if total == 0:
        # No parseable summary: trust the exit code only for a clean pass,
        # never mint a passing ratio from silence (mirrors evals/graders).
        return (1.0 if r.returncode == 0 else 0.0), out
    return passed / total, out


def run_tests(cand_dir: str, test_command: str, extra_env: dict) -> Optional[float]:
    """Execution verifier: ratio of passing tests, or None if it couldn't run."""
    return _verify(cand_dir, test_command, extra_env)[0]


class _JudgeScore(BaseModel):
    score: int = Field(ge=0, le=10)
    rationale: str


_JUDGE_PROMPT = """You are an impartial code-review judge selecting among candidate \
implementations of one spec. Do NOT use tools. Respond with ONLY a JSON object.

Spec the implementation must satisfy:
<spec>
{spec}
</spec>

Candidate implementation diff (workflow artifacts excluded):
<diff>
{diff}
</diff>

Score this candidate 0-10 on how completely and correctly it implements the spec:
0 = empty/irrelevant, 5 = partial or flawed, 8 = complete and correct,
10 = complete, correct, idiomatic, with no unrelated or risky changes.
Judge the outcome, not length. Penalize diffs that weaken/delete tests to pass,
or that change far more than the spec asked.

Respond with ONLY: {{"score": <0-10>, "rationale": "<one sentence>"}}"""


def _truncate(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: int(limit * 0.6)] + \
        f"\n\n[... {len(text) - limit} chars omitted from middle ...]\n\n" + text[-int(limit * 0.4):]


def judge_candidate(adw_id: str, cand_id: str, diff: str, spec: str,
                    working_dir: str) -> tuple[Optional[float], str]:
    """Execution-free verifier: LLM fidelity score 0-1, plus rationale."""
    if not diff.strip():
        return 0.0, "empty diff"
    prompt = _JUDGE_PROMPT.format(
        spec=_truncate(spec, MAX_SPEC_CHARS) or "(no spec found)",
        diff=_truncate(diff, MAX_DIFF_CHARS),
    )
    out_file = str(HARNESS_ROOT / "agents" / adw_id / "bestof" / f"judge_{cand_id}.jsonl")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    req = AgentPromptRequest(
        prompt=prompt, adw_id=adw_id, agent_name=f"bestof_judge_{cand_id}",
        model=JUDGE_MODEL, output_file=out_file, working_dir=working_dir,
    )
    try:
        resp = prompt_claude_code(req)
        verdict = parse_json(resp.output, _JudgeScore)
        return verdict.score / 10.0, verdict.rationale
    except Exception as e:
        return None, f"judge failed: {type(e).__name__}"


# --------------------------------------------------------------------------- #
# orchestration
# --------------------------------------------------------------------------- #

def _run_one_build(cand_id: str, cand_dir: str, no_memory: bool,
                   log) -> bool:
    """Run travis_build.py in a candidate worktree (own adw_id, own transcripts)."""
    args = ["uv", "run", str(HARNESS_ROOT / "adws" / "travis" / "travis_build.py"),
            cand_id, "--working-dir", cand_dir]
    if no_memory:
        args.append("--no-memory")
    r = subprocess.run(args, cwd=str(HARNESS_ROOT), capture_output=True, text=True)
    if r.returncode != 0:
        log(f"  candidate {cand_id}: build failed (rc={r.returncode})")
    return r.returncode == 0


_FIX_PROMPT = """The implementation in this worktree does not pass its verification \
command yet. Make it pass.

Verification command (run from the repo root):
    {test_command}

Latest output (truncated):
<output>
{output}
</output>

Fix the code so the verification command exits cleanly. Make the smallest change
that addresses the real cause of the failure. Do NOT weaken, skip, comment out, or
delete the checks/tests to force a pass, and do NOT change behavior unrelated to the
failure. When you are done the command above must succeed."""


def _fix_candidate(cand_id: str, cand_dir: str, test_command: str, output: str,
                   attempt: int, model: Optional[str], log) -> None:
    """Run a fix agent in the candidate's worktree to repair a failing verifier."""
    prompt = _FIX_PROMPT.format(
        test_command=test_command, output=_truncate(output, MAX_DIFF_CHARS),
    )
    out_file = str(HARNESS_ROOT / "agents" / cand_id / "builder" / f"fix_{attempt}.jsonl")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    req = AgentPromptRequest(
        prompt=prompt, adw_id=cand_id, agent_name=f"bestof_fix_{cand_id}_{attempt}",
        model=model or "sonnet", output_file=out_file, working_dir=cand_dir,
    )
    try:
        prompt_claude_code(req)
    except Exception as e:
        log(f"  {cand_id}: fix attempt {attempt} agent error: {type(e).__name__}")


def _build_and_verify(cand_id: str, cand_dir: str, no_memory: bool,
                      test_command: Optional[str], extra_env: dict,
                      max_fix: int, model: Optional[str], log) -> tuple[bool, Optional[float]]:
    """Build a candidate, then iterate fixes until the execution verifier passes
    (or the attempt budget is exhausted). Returns (built, final_test_score).

    Without a test_command there is no execution signal to gate on, so this is a
    single build (test_score = None) — identical to the pre-loop behavior.
    """
    built = _run_one_build(cand_id, cand_dir, no_memory, log)
    if not built or not test_command:
        return built, None

    score, output = _verify(cand_dir, test_command, extra_env)
    attempt = 0
    while score is not None and score < 1.0 and attempt < max_fix:
        attempt += 1
        log(f"  {cand_id}: verifier failed (score={score:.2f}); fix {attempt}/{max_fix}")
        _fix_candidate(cand_id, cand_dir, test_command, output, attempt, model, log)
        score, output = _verify(cand_dir, test_command, extra_env)
    if attempt:
        verdict = "passes" if (score or 0) >= 1.0 else f"still failing ({score:.2f})"
        log(f"  {cand_id}: verifier {verdict} after {attempt} fix attempt(s)")
    return built, score


def run_best_of_n_build(
    adw_id: str,
    working_dir: str,
    n: int,
    no_memory: bool,
    test_command: Optional[str],
    logger,
    extra_env: Optional[dict] = None,
    max_fix: int = 0,
    model: Optional[str] = None,
) -> tuple[bool, Optional[str]]:
    """Run N build trajectories, score them, apply the winner. Returns (ok, err).

    When test_command is set, each candidate is iterated up to max_fix times to
    make its execution verifier pass before scoring — so selection is among N
    *working* options, not a filter that salvages the one that happened to build.
    """
    from travis.travis_state import TravisState

    extra_env = extra_env or {}
    base = _head_commit(working_dir)
    if not base:
        return False, ("best-of-N build requires the target to be a git repo "
                       "with a commit (HEAD); none found")

    # The winner's diff is applied to the real working tree with `git apply`,
    # which needs the tree to match `base` on the touched files. Pre-existing
    # edits (e.g. a previous run's winner left uncommitted) make the apply fail
    # after N expensive builds. Fail fast with an actionable message instead.
    dirty = _git(["status", "--porcelain", "--untracked-files=no"], working_dir).stdout.strip()
    if dirty:
        return False, (
            "best-of-N needs a clean working tree — the winner's diff is applied "
            "with `git apply`, and uncommitted edits make it fail. Commit or stash "
            "your changes first (e.g. `git stash` or `git checkout -- <files>`).\n"
            "Uncommitted changes:\n" + dirty
        )

    state = TravisState.load(adw_id)
    plan_file = state.get("plan_file") or ""
    spec_text = ""
    spec_path = os.path.join(working_dir, plan_file) if plan_file else ""
    if spec_path and os.path.exists(spec_path):
        spec_text = Path(spec_path).read_text()

    trees_dir = HARNESS_ROOT / "trees"
    trees_dir.mkdir(exist_ok=True)
    cand_ids = [f"{adw_id}-c{k}" for k in range(1, n + 1)]
    cand_dirs = {cid: str(trees_dir / cid) for cid in cand_ids}

    def log(msg):
        # The adw logger's console handler already writes to stdout; don't also
        # print(), or every best-of-N line shows up twice.
        logger.info(msg)

    gate = f"verify+fix x{max_fix}" if (test_command and max_fix) else (
        "verify-only" if test_command else "judge-only")
    log(f"Best-of-{n} build from base {base[:8]} ({gate})")

    # --- set up worktrees + per-candidate state -----------------------------
    created = []
    try:
        for cid in cand_ids:
            cdir = cand_dirs[cid]
            if os.path.exists(cdir):
                _git(["worktree", "remove", "--force", cdir], working_dir)
            r = _git(["worktree", "add", "--detach", cdir, base], working_dir)
            if r.returncode != 0:
                return False, f"failed to create worktree {cdir}: {_errtail(r.stderr)}"
            created.append(cdir)
            materialize_inputs(working_dir, cdir)
            # Give the candidate build its own state keyed by its own id, so
            # travis_build finds the completed plan and writes isolated output.
            cand_state_dir = HARNESS_ROOT / "agents" / cid
            cand_state_dir.mkdir(parents=True, exist_ok=True)
            cand_state = dict(state.data)
            cand_state["adw_id"] = cid
            (cand_state_dir / "travis_state.json").write_text(json.dumps(cand_state, indent=2))

        # --- parallel build + verify/fix loop --------------------------------
        # Each candidate builds, then (if a verifier is set) iterates fixes until
        # it passes or the budget runs out. Returns (built, final_test_score).
        build_results: dict[str, tuple[bool, Optional[float]]] = {}
        with ThreadPoolExecutor(max_workers=min(n, 4)) as ex:
            futs = {ex.submit(_build_and_verify, cid, cand_dirs[cid], no_memory,
                              test_command, extra_env, max_fix, model, log): cid
                    for cid in cand_ids}
            for fut in as_completed(futs):
                build_results[futs[fut]] = fut.result()

        # --- score each candidate -------------------------------------------
        results = []
        cand_diffs: dict[str, str] = {}  # captured post-verify, reused for apply
        for cid in cand_ids:
            cdir = cand_dirs[cid]
            built_ok, tests = build_results.get(cid, (False, None))
            entry = {"candidate": cid, "build_ok": built_ok}
            if not built_ok:
                entry.update(score=-1.0, tests=None, judge=None, note="build failed")
                results.append(entry)
                continue
            # `tests` was computed during the build+verify loop; capture the diff
            # now (DIFF_EXCLUDES drops the caches/artifacts a test run materializes).
            diff = candidate_diff(cdir, base)
            entry["diff_lines"] = diff.count("\n")
            cand_diffs[cid] = diff
            judge, why = judge_candidate(adw_id, cid, diff, spec_text, working_dir)
            entry["tests"] = tests
            entry["judge"] = judge
            entry["judge_rationale"] = why
            # Hybrid score; judge-only when no execution signal available.
            if tests is None and judge is None:
                entry["score"] = 0.0
            elif tests is None:
                entry["score"] = judge
            elif judge is None:
                entry["score"] = tests
            else:
                entry["score"] = W_TESTS * tests + W_JUDGE * judge
            results.append(entry)
            log(f"  {cid}: score={entry['score']:.3f} "
                f"(tests={tests}, judge={judge}) {why[:60]}")

        winner = max(results, key=lambda e: e["score"], default=None)
        if not winner or winner["score"] < 0:
            return False, "all candidate builds failed"

        # --- apply winner's diff to the real working tree -------------------
        # Reuse the pre-test capture so no test-run artifacts enter the patch.
        win_diff = cand_diffs.get(winner["candidate"], "")
        patch = HARNESS_ROOT / "agents" / adw_id / "bestof" / "winner.patch"
        patch.parent.mkdir(parents=True, exist_ok=True)
        patch.write_text(win_diff)
        if win_diff.strip():
            apply = _git(["apply", "--3way", "--whitespace=nowarn", str(patch)], working_dir)
            if apply.returncode != 0:
                # --3way can fail if the base drifted; fall back to a plain apply.
                apply = _git(["apply", "--whitespace=nowarn", str(patch)], working_dir)
                if apply.returncode != 0:
                    return False, f"failed to apply winner diff: {_errtail(apply.stderr)}"

        summary = {
            "base": base, "n": n, "winner": winner["candidate"],
            "winner_score": winner["score"], "test_command": test_command,
            "weights": {"tests": W_TESTS, "judge": W_JUDGE},
            "candidates": results,
        }
        (patch.parent / "summary.json").write_text(json.dumps(summary, indent=2))
        log(f"Best-of-{n}: selected {winner['candidate']} "
            f"(score={winner['score']:.3f}); summary → agents/{adw_id}/bestof/summary.json")

        state.set_phase_result("build", {
            "success": True,
            "message": f"best-of-{n}: {winner['candidate']} won (score={winner['score']:.3f})",
            "bestof": summary,
        })
        state.save()
        return True, None

    finally:
        for cdir in created:
            _git(["worktree", "remove", "--force", cdir], working_dir)
