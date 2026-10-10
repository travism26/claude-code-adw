#!/usr/bin/env -S uv run
# /// script
# dependencies = ["python-dotenv", "pydantic"]
# ///

"""Router isolated eval (docs/sdlc-agent-map.md §2: fixture eval or it doesn't ship). Scores cases.jsonl through pipelines.router.route_ticket, PER-CATEGORY — an aggregate can hide a weak category inside a good average. Real Claude Code calls, real cost; running against a model is a downstream (T4) decision. CLI: uv run evals/agents/router/run_router_eval.py [--model M] [--trials N] [--cases FILE] [--min-accuracy F] [--working-dir DIR]. Exit 0 iff every category with data clears --min-accuracy (0 = report-only, always exits 0)."""

import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# 3 levels below repo root; adws/ must be on sys.path (mirrors pipelines/router.py's HARNESS_ROOT convention).
HARNESS_ROOT = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(HARNESS_ROOT / "adws"))

from pipelines.router import RouterError, route_ticket  # noqa: E402
from adw_modules.utils import make_adw_id  # noqa: E402

FLAGS = ("--model", "--trials", "--cases", "--min-accuracy", "--working-dir")
VALID_MODELS = ("sonnet", "opus", "haiku")
CATEGORIES = ("chore", "bug", "feature")
DEFAULT_CASES = Path(__file__).resolve().parent / "cases.jsonl"
USAGE = "Usage: uv run evals/agents/router/run_router_eval.py [--model M] [--trials N] [--cases FILE] [--min-accuracy F] [--working-dir DIR]"

def parse_args(argv: List[str]) -> Dict[str, str]:
    """Flags only, no positional args (mirrors pipe_chore.py's argv loop)."""
    opts: Dict[str, str] = {}
    i = 0
    while i < len(argv):
        arg = argv[i]
        if not arg.startswith("--"):
            raise ValueError(f"unexpected positional argument: {arg}")
        if arg not in FLAGS:
            raise ValueError(f"unknown flag: {arg}")
        if i + 1 >= len(argv):
            raise ValueError(f"{arg} requires a value")
        opts[arg] = argv[i + 1]
        i += 2
    return opts

def load_cases(path: Path) -> List[dict]:
    # Fail-closed: bad JSON, missing keys, a bad `expected`, or a malformed ticket all raise.
    cases = []
    with open(path) as f:
        for n, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                case = json.loads(line)
            except json.JSONDecodeError as e:
                raise ValueError(f"{path}:{n}: invalid JSON: {e}") from e
            valid = (isinstance(case, dict) and {"id", "ticket", "expected"} <= case.keys() and case["expected"] in CATEGORIES
                     and isinstance(case.get("ticket"), dict) and {"title", "body", "labels"} <= case["ticket"].keys())
            if not valid:
                raise ValueError(f"{path}:{n}: malformed case: {case!r}")
            cases.append(case)
    return cases

def _read_cost(adw_id: str) -> Tuple[float, bool]:
    """total_cost_usd from router.jsonl's last line; missing file/field/bad JSON -> (0.0, True)."""
    path = HARNESS_ROOT / "agents" / adw_id / "router" / "router.jsonl"
    if not path.is_file():
        return 0.0, True
    try:
        lines = [ln for ln in path.read_text().splitlines() if ln.strip()]
        if not lines:
            return 0.0, True
        cost = json.loads(lines[-1]).get("total_cost_usd")
        return (float(cost), False) if cost is not None else (0.0, True)
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return 0.0, True

def run_eval(cases: List[dict], model: str, trials: int, working_dir: str) -> dict:
    """route_ticket per case x trial, fresh adw_id each time; a RouterError is a recorded miss, not a crash — one bad case must not kill the run."""
    results: List[dict] = []
    total_cost, cost_incomplete = 0.0, False
    for case in cases:
        for _ in range(trials):
            adw_id = make_adw_id()
            error = None
            try:
                verdict = route_ticket(case["ticket"], adw_id, working_dir, model=model)
                got, confidence = verdict.route, verdict.confidence
            except RouterError as e:
                got, confidence, error = "ERROR", None, str(e)
            results.append({"id": case["id"], "expected": case["expected"], "got": got, "confidence": confidence, "error": error})
            cost, incomplete = _read_cost(adw_id)
            total_cost += cost
            cost_incomplete = cost_incomplete or incomplete
    return {"results": results, "total_cost_usd": total_cost, "cost_incomplete": cost_incomplete}

def score(results: List[dict]) -> dict:
    # Per-category + overall; separate from run_eval so scoring math is testable standalone.
    per_category = {cat: {"correct": 0, "total": 0} for cat in CATEGORIES}
    for r in results:
        if r["expected"] in per_category:
            per_category[r["expected"]]["total"] += 1
            per_category[r["expected"]]["correct"] += int(r["got"] == r["expected"])
    return {"per_category": per_category,
            "overall_correct": sum(b["correct"] for b in per_category.values()),
            "overall_total": sum(b["total"] for b in per_category.values())}

def exit_ok(scored: dict, min_accuracy: float) -> bool:
    """True iff every category WITH data clears min_accuracy (an empty custom-file category can't fail the gate; min_accuracy=0 always passes)."""
    return all(b["correct"] / b["total"] >= min_accuracy for b in scored["per_category"].values() if b["total"])

def render_report(scored: dict, run: dict, model: str, trials: int, min_accuracy: float) -> str:
    cats, ot, oc = scored["per_category"], scored["overall_total"], scored["overall_correct"]
    cat_lines = [f"  {c:<8} {cats[c]['correct']}/{cats[c]['total']}  ({cats[c]['correct'] / cats[c]['total'] * 100:.1f}%)" if cats[c]["total"] else f"  {c:<8} 0/0  (n/a)" for c in CATEGORIES]
    misroutes = [r for r in run["results"] if r["got"] != r["expected"]]
    miss_lines = [f"  {r['id']:<28} expected={r['expected']:<8} got={r['got']:<8} confidence="
                  + (f"{r['confidence']:.2f}" if r["confidence"] is not None else "n/a") for r in misroutes] or ["  (none)"]
    return "\n".join([
        "Router Eval Report", "=" * 19, f"model={model} trials={trials} cases={ot}", "",
        "Per-category accuracy:", *cat_lines, "",
        f"Overall: {oc}/{ot} ({(oc / ot * 100) if ot else 0.0:.1f}%)", "",
        f"Misroutes ({len(misroutes)}):", *miss_lines, "",
        f"Total cost: ${run['total_cost_usd']:.4f} USD",
        f"Cost incomplete: {'YES' if run['cost_incomplete'] else 'NO'}", "",
        f"RESULT: {'PASS' if exit_ok(scored, min_accuracy) else 'FAIL'} (min-accuracy={min_accuracy})",
    ])

def main() -> None:
    try:
        opts = parse_args(sys.argv[1:])
        model = opts.get("--model", "sonnet")
        if model not in VALID_MODELS:
            raise ValueError(f"--model must be one of {VALID_MODELS}, got {model!r}")
        trials = int(opts.get("--trials", "1"))
        min_accuracy = float(opts.get("--min-accuracy", "0.8"))
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        print(USAGE, file=sys.stderr)
        sys.exit(1)
    cases_path = Path(opts["--cases"]) if "--cases" in opts else DEFAULT_CASES
    working_dir = opts.get("--working-dir", str(HARNESS_ROOT))
    try:
        cases = load_cases(cases_path)
    except (OSError, ValueError) as e:
        print(f"Error loading cases: {e}", file=sys.stderr)
        sys.exit(1)
    run = run_eval(cases, model, trials, working_dir)
    scored = score(run["results"])
    print(render_report(scored, run, model, trials, min_accuracy))
    sys.exit(0 if exit_ok(scored, min_accuracy) else 1)

if __name__ == "__main__":
    main()
