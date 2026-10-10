#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pydantic", "python-dotenv", "pyyaml", "rich", "json-repair", "matplotlib"]
# ///
"""ADW model×effort sweep — which (model, effort) cell is the cheapest that still passes?

Adapted from Anthropic's cwc-workshops rightmodel sweep (https://github.com/anthropics/cwc-workshops,
Apache-2.0), ported onto the existing eval runner.
The grid is model × effort (not model × thinking × effort: on 4.6+ models
thinking is adaptive and `claude --effort` is the depth knob; haiku has no
effort knob, so it contributes a single cell).

Each cell is just an eval variant named <prefix>-<model>-e<effort>, run
through run_eval.run_trial() — same tasks, graders, infra-error
classification, and results layout. Already-completed trials are skipped on
re-run, so an interrupted sweep (usage limits!) resumes where it left off.

Hygiene (rightmodel audit rules): same task list per cell, N independent
trials, infra errors never scored, judge cost separate from SUT cost.

Usage:
  uv run evals/sweep.py run --tasks 01,03 --trials 2 --yes
  uv run evals/sweep.py run --tasks 01 --models haiku,sonnet --efforts low,high --yes
  uv run evals/sweep.py report                # scorecard + PNGs + sweep_report.html
  uv run evals/sweep.py report --prefix sweep

Cost warning: the default grid is 7 cells (haiku + sonnet×3 + opus×3).
7 cells × tasks × trials adds up fast — start with 1-2 tasks, 1-2 trials.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import statistics
import sys
from argparse import Namespace
from pathlib import Path

from rich.console import Console
from rich.table import Table

EVALS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(EVALS_DIR))
sys.path.insert(0, str(EVALS_DIR.parent / "adws"))

import run_eval  # noqa: E402  (reuse the runner wholesale)

RESULTS_DIR = EVALS_DIR / "results"

# Models with no effort knob contribute one cell with effort=None.
EFFORTLESS_MODELS = {"haiku"}
DEFAULT_MODELS = ["haiku", "sonnet", "opus"]
DEFAULT_EFFORTS = ["low", "medium", "high"]

console = Console()


def build_grid(models: list[str], efforts: list[str], prefix: str) -> list[dict]:
    """One dict per cell: {model, effort, variant}."""
    cells = []
    for model in models:
        cell_efforts = [None] if model in EFFORTLESS_MODELS else efforts
        for effort in cell_efforts:
            cells.append({
                "model": model,
                "effort": effort,
                "variant": f"{prefix}-{model}-e{effort or 'na'}",
            })
    return cells


def trial_done(variant: str, task_id: str, trial: int) -> bool:
    """True if this trial already has a non-infra result on disk (resume)."""
    f = RESULTS_DIR / variant / task_id / str(trial) / "result.json"
    if not f.is_file():
        return False
    try:
        return json.loads(f.read_text()).get("status") != "infra_error"
    except json.JSONDecodeError:
        return False


def cmd_run(args: argparse.Namespace) -> int:
    task_ids = None if args.all else (args.tasks.split(",") if args.tasks else None)
    if task_ids is None and not args.all:
        console.print("[red]Specify --tasks 01,03 or --all[/red]")
        return 1
    tasks = run_eval.load_tasks(task_ids)
    if not tasks:
        console.print("[red]No tasks matched.[/red]")
        return 1

    cells = build_grid(args.models.split(","), args.efforts.split(","), args.prefix)
    total = len(cells) * len(tasks) * args.trials
    pending = sum(
        1
        for cell in cells
        for task in tasks
        for trial in range(1, args.trials + 1)
        if not trial_done(cell["variant"], task["id"], trial)
    )

    console.print(f"[bold]Sweep grid[/bold]: {len(cells)} cells × "
                  f"{len(tasks)} tasks × {args.trials} trials = {total} trials "
                  f"({pending} pending, {total - pending} already done)")
    for cell in cells:
        console.print(f"  {cell['variant']}  (model={cell['model']} "
                      f"effort={cell['effort'] or '-'})")
    if not args.yes:
        console.print("[yellow]Dry run — pass --yes to execute. Trials run "
                      "sequentially; budget wall-time accordingly.[/yellow]")
        return 0

    svc_env = None
    if any(t["target"] == "backend" for t in tasks):
        svc_env = run_eval.ensure_backend_services()

    statuses: list[str] = []
    consecutive_infra = 0
    aborted = False
    for cell in cells:
        if aborted:
            break
        cfg = Namespace(
            variant=cell["variant"], engine="travis", planner=args.planner, model=cell["model"],
            effort=cell["effort"], memory=args.memory, trials=args.trials,
            skip_review=False, skip_validate=False, keep_tmp=False,
        )
        console.print(f"\n[bold]{cell['variant']}[/bold]")
        for task in tasks:
            if aborted:
                break
            for trial in range(1, args.trials + 1):
                if trial_done(cell["variant"], task["id"], trial):
                    console.print(f"  [dim]{task['id']} trial {trial}: already done, skipping[/dim]")
                    continue
                result = run_eval.run_trial(
                    task, trial, cfg,
                    svc_env=svc_env if task["target"] == "backend" else None,
                )
                statuses.append(result["status"])
                # Same circuit breaker as run_eval: a session/rate limit
                # poisons everything after it — stop, resume after reset.
                consecutive_infra = consecutive_infra + 1 if result["status"] == "infra_error" else 0
                if consecutive_infra >= 2:
                    console.print("[red]Aborting sweep: 2 consecutive infra errors "
                                  "(likely a usage limit). Re-run the same command "
                                  "after reset — completed trials are skipped.[/red]")
                    aborted = True
                    break

    if svc_env is not None:
        run_eval.teardown_backend_services()

    console.print(f"\n[bold]Sweep done.[/bold] ok={statuses.count('ok')} "
                  f"task_fail={statuses.count('task_fail')} "
                  f"infra_error={statuses.count('infra_error')}")
    console.print(f"Report: uv run evals/sweep.py report --prefix {args.prefix}")
    return 1 if aborted else 0


# ---------------------------------------------------------------------------
# Reporting — per-cell aggregates, Pareto plots, HTML report
# ---------------------------------------------------------------------------

def load_cells(prefix: str) -> dict[str, list[dict]]:
    """variant -> result dicts, for variants matching the sweep prefix."""
    out: dict[str, list[dict]] = {}
    if not RESULTS_DIR.is_dir():
        return out
    for variant_dir in sorted(RESULTS_DIR.iterdir()):
        if not variant_dir.is_dir() or not variant_dir.name.startswith(f"{prefix}-"):
            continue
        results = []
        for f in sorted(variant_dir.glob("*/*/result.json")):
            try:
                results.append(json.loads(f.read_text()))
            except json.JSONDecodeError:
                continue
        if results:
            out[variant_dir.name] = results
    return out


def _mean_score(results: list[dict], grader: str) -> float | None:
    vals = [r["scores"][grader] for r in results
            if isinstance(r.get("scores", {}).get(grader), (int, float))]
    return statistics.fmean(vals) if vals else None


def aggregate(results: list[dict]) -> dict:
    """rightmodel-style per-cell metrics. Infra trials excluded throughout."""
    scored = [r for r in results if r.get("status") != "infra_error"]
    passes = sum(1 for r in scored if r.get("status") == "ok")
    costs = [r["scores"]["total_cost_usd"] for r in scored
             if isinstance(r.get("scores", {}).get("total_cost_usd"), (int, float))]
    total_cost = sum(costs)
    sample = scored[0] if scored else {}
    return {
        "model": sample.get("model"),
        "effort": sample.get("effort"),
        "n": len(scored),
        "infra": len(results) - len(scored),
        "pass_rate": passes / len(scored) if scored else None,
        "cost_per_task": statistics.fmean(costs) if costs else None,
        "cost_per_success": (total_cost / passes) if passes else float("inf"),
        "wall_per_task": _mean_score(scored, "wall_minutes"),
        "judge_fidelity": _mean_score(scored, "implementation_fidelity"),
    }


MODEL_COLORS = {"haiku": "#2a9d8f", "sonnet": "#e9962e", "opus": "#7b2d8b"}
EFFORT_SIZE = {None: 70, "low": 40, "medium": 90, "high": 160, "xhigh": 240, "max": 320}


def make_plots(cells: dict[str, dict], out_dir: Path) -> list[Path]:
    """Pass rate vs cost / wall-time scatter, rightmodel encoding:
    colour=model, marker size=effort."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    axes_specs = [
        ("cost_per_task", "agent cost per task ($)", "sweep_cost.png"),
        ("wall_per_task", "wall minutes per task", "sweep_wall.png"),
        ("cost_per_success", "cost per success ($)", "sweep_cost_per_success.png"),
    ]
    paths = []
    for metric, xlabel, fname in axes_specs:
        fig, ax = plt.subplots(figsize=(7, 5))
        for variant, agg in cells.items():
            x, y = agg.get(metric), agg.get("pass_rate")
            if x is None or y is None or x == float("inf"):
                continue
            ax.scatter(x, y * 100,
                       s=EFFORT_SIZE.get(agg["effort"], 90),
                       color=MODEL_COLORS.get(agg["model"], "#666666"),
                       alpha=0.8, edgecolors="black", linewidths=0.5)
            ax.annotate(f"{agg['model']}/{agg['effort'] or '-'}", (x, y * 100),
                        textcoords="offset points", xytext=(6, 4), fontsize=8)
        ax.set_xlabel(xlabel)
        ax.set_ylabel("pass rate (%)")
        ax.set_ylim(-5, 105)
        ax.set_title(f"pass rate vs {xlabel}")
        ax.grid(alpha=0.3)
        fig.tight_layout()
        path = out_dir / fname
        fig.savefig(path, dpi=120)
        plt.close(fig)
        paths.append(path)
    return paths


def cmd_report(args: argparse.Namespace) -> int:
    data = load_cells(args.prefix)
    if not data:
        console.print(f"[red]No results for variants matching '{args.prefix}-*'.[/red]")
        return 1
    cells = {variant: aggregate(results) for variant, results in data.items()}

    table = Table(title=f"Sweep scorecard ({args.prefix}-*)")
    for col in ("Cell", "Model", "Effort", "n", "Pass rate", "$ / task",
                "$ / success", "Wall / task", "Judge fidelity", "Infra"):
        table.add_column(col)
    # Cheapest-first among full-pass cells makes the winner obvious.
    def sort_key(item):
        agg = item[1]
        return (-(agg["pass_rate"] or 0), agg["cost_per_task"] or float("inf"))
    for variant, agg in sorted(cells.items(), key=sort_key):
        table.add_row(
            variant, agg["model"] or "-", agg["effort"] or "-", str(agg["n"]),
            f"{agg['pass_rate']:.0%}" if agg["pass_rate"] is not None else "-",
            f"${agg['cost_per_task']:.2f}" if agg["cost_per_task"] is not None else "-",
            ("∞" if agg["cost_per_success"] == float("inf")
             else f"${agg['cost_per_success']:.2f}"),
            f"{agg['wall_per_task']:.1f}m" if agg["wall_per_task"] is not None else "-",
            f"{agg['judge_fidelity']:.1f}/5" if agg["judge_fidelity"] is not None else "-",
            str(agg["infra"]),
        )
    console.print(table)

    full_pass = {v: a for v, a in cells.items()
                 if a["pass_rate"] == 1.0 and a["cost_per_task"] is not None}
    if full_pass:
        winner = min(full_pass.items(), key=lambda kv: kv[1]["cost_per_task"])
        console.print(f"[bold green]Cheapest full-pass cell:[/bold green] {winner[0]} "
                      f"(${winner[1]['cost_per_task']:.2f}/task, "
                      f"{winner[1]['wall_per_task']:.1f}m/task)")

    out_dir = RESULTS_DIR / f"{args.prefix}_report"
    out_dir.mkdir(parents=True, exist_ok=True)
    plot_paths = make_plots(cells, out_dir)

    # Single-file HTML report with inlined images (rightmodel pattern).
    rows = ""
    for v, a in sorted(cells.items(), key=sort_key):
        pass_rate = f"{a['pass_rate']:.0%}" if a["pass_rate"] is not None else "-"
        cost = f"${a['cost_per_task']:.2f}" if a["cost_per_task"] is not None else "-"
        rows += (
            f"<tr><td>{v}</td><td>{a['model']}</td><td>{a['effort'] or '-'}</td>"
            f"<td>{a['n']}</td><td>{pass_rate}</td><td>{cost}</td></tr>\n"
        )
    imgs = ""
    for p in plot_paths:
        b64 = base64.b64encode(p.read_bytes()).decode()
        imgs += f'<img src="data:image/png;base64,{b64}" style="max-width:100%"><br>\n'
    html = (
        "<html><head><title>ADW sweep report</title></head><body>"
        f"<h1>ADW sweep report ({args.prefix}-*)</h1>"
        "<table border=1 cellpadding=4><tr><th>Cell</th><th>Model</th>"
        f"<th>Effort</th><th>n</th><th>Pass rate</th><th>$ / task</th></tr>{rows}</table><br>"
        f"{imgs}</body></html>"
    )
    report = out_dir / "sweep_report.html"
    report.write_text(html)
    console.print(f"Plots + report → {out_dir}/")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="Run the model×effort grid")
    p_run.add_argument("--tasks", help="Comma-separated task id prefixes, e.g. 01,03")
    p_run.add_argument("--all", action="store_true", help="Run all tasks")
    p_run.add_argument("--trials", type=int, default=3, help="Trials per cell (default: 3)")
    p_run.add_argument("--models", default=",".join(DEFAULT_MODELS),
                       help=f"Comma-separated models (default: {','.join(DEFAULT_MODELS)})")
    p_run.add_argument("--efforts", default=",".join(DEFAULT_EFFORTS),
                       help=f"Comma-separated effort levels (default: {','.join(DEFAULT_EFFORTS)})")
    p_run.add_argument("--prefix", default="sweep", help="Variant prefix (default: sweep)")
    p_run.add_argument("--planner", default="travis")
    p_run.add_argument("--memory", action="store_true",
                       help="Seed memory into targets (e.g. 'haiku + memory vs sonnet')")
    p_run.add_argument("--yes", action="store_true",
                       help="Actually run (without it: print the grid and exit)")

    p_report = sub.add_parser("report", help="Aggregate + plot sweep results")
    p_report.add_argument("--prefix", default="sweep", help="Variant prefix (default: sweep)")

    args = parser.parse_args()
    if args.command == "run":
        return cmd_run(args)
    if args.command == "report":
        return cmd_report(args)
    return 2


if __name__ == "__main__":
    sys.exit(main())
