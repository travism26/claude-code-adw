#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pydantic", "python-dotenv", "rich", "json-repair"]
# ///
"""ADW eval scorecard — compare harness variants side by side.

Reads evals/results/{variant}/{task}/{trial}/result.json and renders:
  - per (task, grader): mean ± spread across trials, one column per variant
  - heat-map coloring against each grader's scale (green=good, red=bad)
  - Δ-vs-baseline column when --baseline is set
  - footer: per-grader averages, judge cost (separate), infra-failure counts

Baseline snapshots (adapted from Anthropic's cwc-workshops eval-driven pattern,
https://github.com/anthropics/cwc-workshops, Apache-2.0): results/ is gitignored
and variants come and go, so pin an immutable reference point under
evals/baselines/ and compare against it forever:
  - --snapshot <variant>          pin that variant's aggregates to a JSON file
  - --baseline-file <file>        Δ columns against the saved snapshot
  - --show-baseline <file>        re-render a saved snapshot (no re-grading)

Usage:
  uv run evals/compare.py --baseline travis
  uv run evals/compare.py --baseline travis --variants travis,openspec --json out.json
  uv run evals/compare.py --snapshot baseline --out evals/baselines/tier1.json
  uv run evals/compare.py --variants slim-templates --baseline-file evals/baselines/tier1.json
"""

from __future__ import annotations

import argparse
import json
import statistics
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from rich.console import Console
from rich.table import Table

EVALS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(EVALS_DIR))
sys.path.insert(0, str(EVALS_DIR.parent / "adws"))

from graders import GRADERS, JUDGE_MODEL, Scale  # noqa: E402

RESULTS_DIR = EVALS_DIR / "results"
BASELINES_DIR = EVALS_DIR / "baselines"

console = Console()

GRADER_BY_NAME = {g.name: g for g in GRADERS}


def load_results(variants: list[str] | None) -> dict[str, list[dict]]:
    """variant -> list of result dicts."""
    out: dict[str, list[dict]] = {}
    if not RESULTS_DIR.is_dir():
        return out
    for variant_dir in sorted(RESULTS_DIR.iterdir()):
        if not variant_dir.is_dir():
            continue
        if variants and variant_dir.name not in variants:
            continue
        results = []
        for result_file in sorted(variant_dir.glob("*/*/result.json")):
            try:
                results.append(json.loads(result_file.read_text()))
            except json.JSONDecodeError:
                continue
        if results:
            out[variant_dir.name] = results
    return out


def numeric_scores(results: list[dict], task_id: str, grader: str) -> list[float]:
    """Numeric scores for (task, grader) across trials; non-numeric skipped.

    Infra-error trials carry no scores at all, so they are naturally excluded
    (they are reported separately, never averaged in — audit rule).
    """
    values = []
    for r in results:
        if r.get("task_id") != task_id:
            continue
        v = r.get("scores", {}).get(grader)
        if isinstance(v, (int, float)):
            values.append(float(v))
    return values


def mean_spread(values: list[float]) -> tuple[float, float] | None:
    if not values:
        return None
    mean = statistics.fmean(values)
    spread = statistics.stdev(values) if len(values) > 1 else 0.0
    return mean, spread


# A trial "solves" a task only when both the deterministic oracles are perfect:
# the behavioral acceptance checks AND the target's own test suite. Anything
# less is a partial/failed solve and must not count toward pass^k.
def trial_solves(results: list[dict], task_id: str) -> list[bool]:
    """Per ok-trial booleans: did this trial fully solve the task?

    Infra-error trials carry no scores and are excluded (same audit rule as
    numeric_scores) — reliability is measured only over trials that actually ran.
    """
    out: list[bool] = []
    for r in results:
        if r.get("task_id") != task_id or r.get("status") != "ok":
            continue
        s = r.get("scores", {})
        out.append(s.get("acceptance_checks") == 1.0 and s.get("tests_pass") == 1.0)
    return out


def pass_at_k(solves: list[bool]) -> bool:
    """pass@k — at least one of k trials solved (capability ceiling)."""
    return any(solves)


def pass_hat_k(solves: list[bool]) -> bool:
    """pass^k — every one of k trials solved (reliability/consistency)."""
    return bool(solves) and all(solves)


def heat_color(value: float, scale: Scale) -> str:
    """green=good, yellow=middle, red=bad, normalized to the grader's scale."""
    span = scale.max - scale.min or 1.0
    pos = max(0.0, min(1.0, (value - scale.min) / span))
    if scale.good == "low":
        pos = 1.0 - pos
    elif isinstance(scale.good, (int, float)):
        # closeness to the target value
        pos = 1.0 - min(1.0, abs(value - float(scale.good)) / span)
    if pos >= 0.75:
        return "green"
    if pos >= 0.4:
        return "yellow"
    return "red"


def fmt_value(value: float, grader_name: str) -> str:
    g = GRADER_BY_NAME.get(grader_name)
    if g and g.fmt:
        try:
            return g.fmt.format(value)
        except (ValueError, IndexError):
            pass
    return f"{value:.2f}"


def render_cell(values: list[float], grader_name: str) -> str:
    ms = mean_spread(values)
    if ms is None:
        return "[dim]-[/dim]"
    mean, spread = ms
    text = fmt_value(mean, grader_name)
    if len(values) > 1:
        text += f" ±{spread:.2f}"
    g = GRADER_BY_NAME.get(grader_name)
    if g and g.scale:
        return f"[{heat_color(mean, g.scale)}]{text}[/{heat_color(mean, g.scale)}]"
    return text


# ---------------------------------------------------------------------------
# Baseline snapshots — immutable per-task/grader reference points
# ---------------------------------------------------------------------------

def _git_head() -> str:
    proc = subprocess.run(
        ["git", "-C", str(EVALS_DIR.parent), "rev-parse", "--short", "HEAD"],
        capture_output=True, text=True, check=False,
    )
    return proc.stdout.strip() or "unknown"


def build_snapshot(variant: str, results: list[dict]) -> dict:
    """Aggregate one variant's results into an immutable snapshot dict."""
    task_ids = sorted({r["task_id"] for r in results})
    cells = {}
    for task_id in task_ids:
        for grader in GRADERS:
            ms = mean_spread(numeric_scores(results, task_id, grader.name))
            if ms:
                cells[f"{task_id}/{grader.name}"] = {
                    "mean": ms[0], "spread": ms[1],
                    "n": len(numeric_scores(results, task_id, grader.name)),
                }
    return {
        "variant": variant,
        "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        # Provenance: scores are only comparable across identical grader/task
        # versions (audit 2026-06-09, finding 4).
        "harness_commit": _git_head(),
        "judge_model": JUDGE_MODEL,
        "tasks": task_ids,
        "cells": cells,
        "summary": {
            "trials": len(results),
            "ok": sum(1 for r in results if r.get("status") == "ok"),
            "task_fail": sum(1 for r in results if r.get("status") == "task_fail"),
            "infra_error": sum(1 for r in results if r.get("status") == "infra_error"),
            "judge_cost_usd": sum(r.get("judge_cost_usd", 0.0) for r in results),
        },
    }


def load_snapshot(path: str) -> dict:
    snap = json.loads(Path(path).read_text())
    for key in ("variant", "created", "tasks", "cells"):
        if key not in snap:
            raise ValueError(f"{path}: not a baseline snapshot (missing {key!r})")
    return snap


def snapshot_label(snap: dict) -> str:
    return f"{snap['variant']}@{snap['created'][:10]}"


def cmd_snapshot(args: argparse.Namespace) -> int:
    data = load_results([args.snapshot])
    if args.snapshot not in data:
        console.print(f"[red]No results found for variant {args.snapshot!r}.[/red]")
        return 1
    snap = build_snapshot(args.snapshot, data[args.snapshot])
    out = Path(args.out) if args.out else (
        BASELINES_DIR / f"{args.snapshot}_{snap['created'][:10]}.json"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(snap, indent=2) + "\n")
    s = snap["summary"]
    console.print(
        f"Pinned baseline [bold]{snapshot_label(snap)}[/bold] → {out} "
        f"({s['trials']} trials, ok={s['ok']} task_fail={s['task_fail']} "
        f"infra_error={s['infra_error']})"
    )
    console.print(f"Compare against it with: uv run evals/compare.py --baseline-file {out}")
    return 0


def cmd_show_baseline(args: argparse.Namespace) -> int:
    """Re-render a saved snapshot scorecard without touching results/."""
    snap = load_snapshot(args.show_baseline)
    table = Table(title=f"Baseline snapshot {snapshot_label(snap)}")
    table.add_column("Task", style="bold")
    table.add_column("Grader")
    table.add_column(snap["variant"])
    for task_id in snap["tasks"]:
        first_row_of_task = True
        for grader in GRADERS:
            cell = snap["cells"].get(f"{task_id}/{grader.name}")
            if cell is None:
                rendered = "[dim]-[/dim]"
            else:
                text = fmt_value(cell["mean"], grader.name)
                if cell["n"] > 1:
                    text += f" ±{cell['spread']:.2f}"
                if grader.scale:
                    color = heat_color(cell["mean"], grader.scale)
                    rendered = f"[{color}]{text}[/{color}]"
                else:
                    rendered = text
            table.add_row(task_id if first_row_of_task else "", grader.name, rendered)
            first_row_of_task = False
        table.add_section()
    console.print(table)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", help="Variant to compute deltas against")
    parser.add_argument("--baseline-file",
                        help="Saved snapshot (evals/baselines/*.json) to compute deltas against")
    parser.add_argument("--variants", help="Comma-separated variant filter")
    parser.add_argument("--json", help="Also write aggregated results to this JSON file")
    parser.add_argument("--snapshot", metavar="VARIANT",
                        help="Pin VARIANT's aggregates as an immutable baseline file and exit")
    parser.add_argument("--out", help="Output path for --snapshot "
                                      "(default: evals/baselines/<variant>_<date>.json)")
    parser.add_argument("--show-baseline", metavar="FILE",
                        help="Re-render a saved baseline snapshot and exit")
    args = parser.parse_args()

    if args.snapshot:
        return cmd_snapshot(args)
    if args.show_baseline:
        return cmd_show_baseline(args)
    if args.baseline and args.baseline_file:
        console.print("[red]Use either --baseline (live variant) or --baseline-file "
                      "(saved snapshot), not both.[/red]")
        return 1

    variant_filter = args.variants.split(",") if args.variants else None
    data = load_results(variant_filter)
    if not data:
        console.print("[red]No results found under evals/results/.[/red]")
        return 1

    snap = load_snapshot(args.baseline_file) if args.baseline_file else None

    variants = list(data.keys())
    if args.baseline and args.baseline in variants:
        variants = [args.baseline] + [v for v in variants if v != args.baseline]
    baseline = args.baseline if args.baseline in variants else None

    task_ids = sorted({r["task_id"] for results in data.values() for r in results})
    if snap:
        task_ids = sorted(set(task_ids) | set(snap["tasks"]))

    has_delta = bool(snap) or (baseline is not None and len(variants) > 1)

    # ---- main scorecard --------------------------------------------------
    table = Table(title="ADW Eval Scorecard (mean ± spread across trials)")
    table.add_column("Task", style="bold")
    table.add_column("Grader")
    if snap:
        table.add_column(f"{snapshot_label(snap)} (base)")
    for v in variants:
        table.add_column(v + (" (base)" if v == baseline else ""))
    if has_delta:
        table.add_column("Δ vs base")

    aggregated: dict = {"variants": {}, "tasks": task_ids}

    for task_id in task_ids:
        first_row_of_task = True
        for grader in GRADERS:
            cells = []
            means = {}

            snap_mean = None
            if snap:
                c = snap["cells"].get(f"{task_id}/{grader.name}")
                if c is None:
                    cells.append("[dim]-[/dim]")
                else:
                    snap_mean = c["mean"]
                    text = fmt_value(c["mean"], grader.name)
                    if c["n"] > 1:
                        text += f" ±{c['spread']:.2f}"
                    if grader.scale:
                        color = heat_color(c["mean"], grader.scale)
                        text = f"[{color}]{text}[/{color}]"
                    cells.append(text)

            for v in variants:
                values = numeric_scores(data[v], task_id, grader.name)
                ms = mean_spread(values)
                if ms:
                    means[v] = ms[0]
                cells.append(render_cell(values, grader.name))

            delta_cell = ""
            if snap:
                # Δ of the first variant with data vs the saved snapshot
                with_data = [v for v in variants if v in means]
                if snap_mean is not None and with_data:
                    delta_cell = f"{means[with_data[0]] - snap_mean:+.2f}"
            elif baseline and len(variants) > 1:
                others = [v for v in variants if v != baseline and v in means]
                if baseline in means and others:
                    delta = means[others[0]] - means[baseline]
                    delta_cell = f"{delta:+.2f}"

            table.add_row(
                task_id if first_row_of_task else "",
                grader.name,
                *cells,
                *( [delta_cell] if has_delta else [] ),
            )
            first_row_of_task = False
        table.add_section()

    console.print(table)

    # ---- footer: per-grader averages, judge cost, infra failures ---------
    summary = Table(title="Per-grader averages across all tasks")
    summary.add_column("Grader")
    for v in variants:
        summary.add_column(v)
    for grader in GRADERS:
        row = [grader.name]
        for v in variants:
            all_vals = []
            for task_id in task_ids:
                all_vals.extend(numeric_scores(data[v], task_id, grader.name))
            ms = mean_spread(all_vals)
            row.append(fmt_value(ms[0], grader.name) if ms else "-")
        summary.add_row(*row)
    console.print(summary)

    # ---- reliability: pass@k vs pass^k per task --------------------------
    # pass@k (>=1 trial solves) is the capability ceiling; pass^k (all trials
    # solve) is reliability. They diverge on flaky tasks, which a mean hides.
    rel = Table(title="Reliability — solved trials / k  (pass@k ✓ if any, pass^k ✓ if all)")
    rel.add_column("Task", style="bold")
    for v in variants:
        rel.add_column(v)
    pak_tot: dict[str, list[bool]] = {v: [] for v in variants}
    phk_tot: dict[str, list[bool]] = {v: [] for v in variants}
    for task_id in task_ids:
        row = [task_id]
        for v in variants:
            solves = trial_solves(data[v], task_id)
            if not solves:
                row.append("[dim]-[/dim]")
                continue
            pak, phk = pass_at_k(solves), pass_hat_k(solves)
            pak_tot[v].append(pak)
            phk_tot[v].append(phk)
            mark = "[green]✓[/green]" if phk else ("[yellow]~[/yellow]" if pak else "[red]✗[/red]")
            row.append(f"{sum(solves)}/{len(solves)} {mark}")
        rel.add_row(*row)
    rel.add_section()
    totals = ["[bold]pass@k / pass^k[/bold]"]
    for v in variants:
        n = len(pak_tot[v])
        if not n:
            totals.append("[dim]-[/dim]")
            continue
        totals.append(f"{sum(pak_tot[v])}/{n}  /  {sum(phk_tot[v])}/{n}")
    rel.add_row(*totals)
    console.print(rel)

    for v in variants:
        results = data[v]
        infra = sum(1 for r in results if r.get("status") == "infra_error")
        task_fail = sum(1 for r in results if r.get("status") == "task_fail")
        ok = sum(1 for r in results if r.get("status") == "ok")
        judge_cost = sum(r.get("judge_cost_usd", 0.0) for r in results)
        judge_problems = sum(
            1 for r in results if r.get("judge_status") not in (None, "ok")
        )
        console.print(
            f"[bold]{v}[/bold]: {len(results)} trials — ok={ok} task_fail={task_fail} "
            f"[red]infra_error={infra}[/red] | judge cost=${judge_cost:.4f} "
            f"(separate from SUT) | judge issues={judge_problems}"
        )

        aggregated["variants"][v] = {
            "trials": len(results),
            "ok": ok,
            "task_fail": task_fail,
            "infra_error": infra,
            "judge_cost_usd": judge_cost,
            "pass_at_k_tasks": sum(pak_tot[v]),
            "pass_hat_k_tasks": sum(phk_tot[v]),
            "tasks_with_trials": len(pak_tot[v]),
        }

    if args.json:
        per_cell = defaultdict(dict)
        for v in variants:
            for task_id in task_ids:
                for grader in GRADERS:
                    values = numeric_scores(data[v], task_id, grader.name)
                    ms = mean_spread(values)
                    if ms:
                        per_cell[f"{task_id}/{grader.name}"][v] = {
                            "mean": ms[0], "spread": ms[1], "n": len(values),
                        }
        aggregated["cells"] = dict(per_cell)
        Path(args.json).write_text(json.dumps(aggregated, indent=2) + "\n")
        console.print(f"Wrote {args.json}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
