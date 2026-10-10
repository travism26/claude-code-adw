#!/usr/bin/env python3
"""Deterministic renderer for the progress-log "build spine" view.

Reads a project's docs/progress/roadmap.toml (framing) + log.jsonl (shipped
facts) + git (commit verification), and emits a standalone index.html.

The HTML is a *rendered view*, never a source of truth: every fact on the page
comes from the log, the roadmap, or git. The renderer never invents state and
never writes anything but the output file. Re-running with unchanged inputs
produces byte-identical output (the "updated" date comes from the log's newest
entry, not the wall clock), so a git diff of index.html shows only real change.

stdlib only. No network. Runs in well under a second.

Usage:
    python render_progress.py <progress_dir> [--out PATH] [--repo DIR]

    <progress_dir>  directory holding roadmap.toml + log.jsonl
                    (conventionally <project>/docs/progress/)
    --out           output path (default: <progress_dir>/index.html)
    --repo          git repo root for commit verification
                    (default: `git -C <progress_dir> rev-parse --show-toplevel`)

Exit codes:
    0  rendered (referential warnings, if any, go to stderr)
    2  structural error — malformed input; nothing written (ship gate blocks)
"""

from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path


# --------------------------------------------------------------------------- #
# structural error — malformed input; the ship gate should block on this.
# --------------------------------------------------------------------------- #
class StructuralError(Exception):
    pass


# --------------------------------------------------------------------------- #
# text formatting: escape HTML, then re-admit a tiny markdown subset so roadmap
# / log prose can carry `code` and **bold** the way the prototype's copy does.
# --------------------------------------------------------------------------- #
_CODE = re.compile(r"`([^`]+)`")
_BOLD = re.compile(r"\*\*([^*]+)\*\*")


def fmt(text: object) -> str:
    s = html.escape(str(text if text is not None else ""))
    s = _CODE.sub(r"<code>\1</code>", s)
    s = _BOLD.sub(r"<b>\1</b>", s)
    return s


def esc(text: object) -> str:
    return html.escape(str(text if text is not None else ""))


# --------------------------------------------------------------------------- #
# loading + validation
# --------------------------------------------------------------------------- #
def load_roadmap(path: Path) -> dict:
    if not path.is_file():
        raise StructuralError(f"roadmap not found: {path}")
    try:
        with path.open("rb") as fh:
            data = tomllib.load(fh)
    except tomllib.TOMLDecodeError as exc:
        raise StructuralError(f"roadmap.toml is not valid TOML: {exc}") from exc

    if "project" not in data or not data["project"].get("name"):
        raise StructuralError("roadmap.toml [project] must define a name")
    milestones = data.get("milestones") or []
    if not milestones:
        raise StructuralError("roadmap.toml must define at least one [[milestones]]")

    real = [m for m in milestones if m.get("status") in ("done", "active", "planned")]
    active = [m for m in real if m["status"] == "active"]
    if len(active) != 1:
        raise StructuralError(
            f"exactly one milestone must have status=active (found {len(active)})"
        )
    for m in milestones:
        if not m.get("id") or not m.get("title") or not m.get("status"):
            raise StructuralError("every [[milestones]] needs id, title, status")
        if m["status"] not in ("done", "active", "planned", "next"):
            raise StructuralError(
                f"milestone {m.get('id')} has unknown status {m['status']!r}"
            )
    return data


def load_log(path: Path) -> list[dict]:
    """Parse the append-only JSONL log. One object per shipped (or dropped) task."""
    if not path.is_file():
        return []
    entries: list[dict] = []
    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not raw.strip():
            continue
        try:
            obj = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise StructuralError(f"{path}:{lineno} is not valid JSON: {exc}") from exc
        for field in ("task", "title", "status", "date"):
            if field not in obj:
                raise StructuralError(f"{path}:{lineno} missing required field {field!r}")
        if obj["status"] not in ("done", "dropped"):
            raise StructuralError(
                f"{path}:{lineno} status must be done|dropped, got {obj['status']!r}"
            )
        obj["_line"] = lineno
        entries.append(obj)
    return entries


def verify_commits(entries: list[dict], repo: Path | None) -> None:
    """Referential check (warn, never block): flag entries whose commit sha no
    longer resolves — history rewrites shouldn't retroactively brick shipping."""
    have_git = False
    if repo is not None:
        have_git = (repo / ".git").exists() or _git_toplevel(repo) is not None
    for e in entries:
        sha = e.get("commit")
        e["_stale"] = False
        if not sha:
            continue
        if not have_git:
            e["_stale"] = True
            continue
        ok = subprocess.run(
            ["git", "-C", str(repo), "cat-file", "-e", f"{sha}^{{commit}}"],
            capture_output=True,
        ).returncode == 0
        if not ok:
            e["_stale"] = True
            print(
                f"warning: commit {sha} for task {e['task']} does not resolve in "
                f"{repo}; rendering with a stale marker",
                file=sys.stderr,
            )


def _git_toplevel(start: Path) -> Path | None:
    r = subprocess.run(
        ["git", "-C", str(start), "rev-parse", "--show-toplevel"],
        capture_output=True, text=True,
    )
    return Path(r.stdout.strip()) if r.returncode == 0 and r.stdout.strip() else None


# --------------------------------------------------------------------------- #
# model: fold log facts onto the roadmap's active-milestone task list
# --------------------------------------------------------------------------- #
def fq(milestone_id: str, task_id: str) -> str:
    return f"{milestone_id}.{task_id}".lower()


def build_task_view(roadmap: dict, log: list[dict], active_id: str) -> list[dict]:
    """Merge the roadmap's declared task list with logged done-facts.

    Structural invariant: any log entry whose task id is under the active
    milestone's prefix MUST correspond to a declared task, or the roadmap and
    the log disagree about what the active milestone contains.
    """
    tasks = roadmap.get("tasks") or []
    declared = {fq(active_id, t["id"]): t for t in tasks}

    by_fq: dict[str, dict] = {}
    prefix = f"{active_id.lower()}."
    for e in log:
        key = str(e["task"]).lower()
        if key.startswith(prefix):
            if key not in declared:
                raise StructuralError(
                    f"log entry task {e['task']!r} is under active milestone "
                    f"{active_id} but no such task is declared in roadmap.toml"
                )
            by_fq[key] = e

    view = []
    next_marked = False
    for t in tasks:
        key = fq(active_id, t["id"])
        entry = by_fq.get(key)
        item = {
            "label": t.get("label", t["id"]),
            "group": t.get("group"),
            "desc": t.get("desc", ""),
            "entry": entry,
        }
        if entry and entry["status"] == "done":
            item["state"] = "done"
        elif entry and entry["status"] == "dropped":
            item["state"] = "dropped"
        elif not next_marked:
            item["state"] = "next"
            next_marked = True
        else:
            item["state"] = "planned"
        view.append(item)
    return view


def newest_done(log: list[dict]) -> dict | None:
    done = [e for e in log if e["status"] == "done"]
    if not done:
        return None
    # newest by date, tie-broken by file order (later line wins)
    return max(done, key=lambda e: (e["date"], e["_line"]))


# --------------------------------------------------------------------------- #
# rendering
# --------------------------------------------------------------------------- #
def render(roadmap: dict, log: list[dict], repo: Path | None) -> str:
    proj = roadmap["project"]
    milestones = roadmap["milestones"]
    real = [m for m in milestones if m["status"] in ("done", "active", "planned")]
    active = next(m for m in real if m["status"] == "active")

    tasks = build_task_view(roadmap, log, active["id"])
    last = newest_done(log)
    last_key = str(last["task"]).lower() if last else None
    next_task = next((t for t in tasks if t["state"] == "next"), None)

    # "Up next": the frontier task, else — when the active slice is fully shipped
    # — the next look-ahead milestone, else the first horizon item. The readout
    # must always answer "where are we going", even at a slice boundary.
    horizon = roadmap.get("horizon") or []
    next_milestone = next((m for m in milestones if m["status"] == "next"), None)
    if next_task:
        up_label, up_small = next_task["label"], next_task["desc"]
    elif next_milestone:
        up_label, up_small = next_milestone["title"], next_milestone.get("tagline", "")
    elif horizon:
        up_label, up_small = horizon[0].get("title", ""), ""
    else:
        up_label = up_small = None

    updated = max((e["date"] for e in log), default="—")
    n_done = sum(1 for m in real if m["status"] == "done")
    n_active = sum(1 for m in real if m["status"] == "active")

    STATUS_WORD = {"done": "Shipped", "active": "In progress",
                   "planned": "Planned", "next": "Next"}
    STATUS_CLASS = {"done": "is-done", "active": "is-active",
                    "planned": "is-next", "next": "is-next"}
    TAG_CLASS = {"done": "done", "active": "active", "planned": "planned", "next": "next"}

    out: list[str] = []
    a = out.append

    # ----- head / hero -----------------------------------------------------
    a('<div class="wrap">')
    a("  <header>")
    if proj.get("eyebrow"):
        a(f'    <p class="eyebrow">{fmt(proj["eyebrow"])}</p>')
    a(f'    <h1>{esc(proj["name"])}')
    if proj.get("tagline"):
        a(f'      <span class="sub">{fmt(proj["tagline"])}</span>')
    a("    </h1>")
    if proj.get("thesis"):
        a(f'    <p class="thesis">{fmt(proj["thesis"])}</p>')

    # ----- readout tiles (all derived) -------------------------------------
    pos_small = active.get("tagline", "")
    a('    <div class="readout">')
    a(f'      <div class="tile"><span class="k">Position</span>'
      f'<div class="v">{esc(active["id"])} · {esc(active["title"])}'
      f'{small(pos_small)}</div></div>')
    if last:
        a(f'      <div class="tile hot"><span class="k">Last shipped</span>'
          f'<div class="v">{esc(task_label(last, active["id"], tasks))}'
          f'{small(last.get("summary", ""))}</div></div>')
    if up_label is not None:
        a(f'      <div class="tile"><span class="k">Up next</span>'
          f'<div class="v">{esc(up_label)}{small(up_small)}</div></div>')
    a(f'      <div class="tile"><span class="k">Milestones</span>'
      f'<div class="v">{n_done} done · {n_active} active'
      f'{small(proj.get("milestone_summary", ""))}</div></div>')
    a("    </div>")

    # ----- legend ----------------------------------------------------------
    a('    <div class="legend">')
    a('      <span><i class="swatch done"></i> shipped</span>')
    a('      <span><i class="swatch active"></i> in progress</span>')
    a('      <span><i class="swatch next"></i> up next</span>')
    a('      <span><i class="swatch planned"></i> planned</span>')
    a("    </div>")
    a("  </header>")

    # ----- the spine -------------------------------------------------------
    a('  <p class="spine-h">The build spine</p>')
    a('  <div class="spine">')
    for m in milestones:
        node_cls = STATUS_CLASS[m["status"]]
        a(f'    <article class="node {node_cls}">')
        a('      <span class="dot"></span>')
        a('      <div class="card">')
        a('        <div class="card-head">')
        tag = m.get("tag", f'{m["id"]} · {STATUS_WORD[m["status"]]}')
        a(f'          <span class="tag {TAG_CLASS[m["status"]]}">{esc(tag)}</span>')
        for extra in m.get("tags_extra", []):
            a(f'          <span class="tag planned">{esc(extra)}</span>')
        a(f'          <h3>{fmt(m["title"])}</h3>')
        a("        </div>")
        if m.get("lede") or m.get("summary"):
            lede = f'<span class="lede">{fmt(m["lede"])}</span> ' if m.get("lede") else ""
            a(f'        <p>{lede}{fmt(m.get("summary", ""))}</p>')
        if m.get("evidence"):
            a('        <ul class="evidence">')
            for ev in m["evidence"]:
                a(f'          <li>{fmt(ev)}</li>')
            a("        </ul>")
        if m["status"] == "active":
            a(render_track(tasks, last_key, active["id"]))
        a("      </div>")
        a("    </article>")
    a("  </div>")

    # ----- horizon ---------------------------------------------------------
    if horizon:
        a('  <section class="horizon">')
        a(f'    <h2>{esc(proj.get("horizon_title", "Where we\'re going — next"))}</h2>')
        a("    <ol>")
        for h in horizon:
            a(f'      <li><div class="h-body"><b>{fmt(h.get("title", ""))}</b> '
              f'<span>{fmt(h.get("desc", ""))}</span></div></li>')
        a("    </ol>")
        a("  </section>")

    # ----- footer ----------------------------------------------------------
    sot = proj.get("source_of_truth", "the roadmap and git history")
    note = proj.get(
        "footer_note",
        f"This is a rendered view, not a source of truth. It reflects the roadmap in "
        f"`{sot}` and the git history — the milestones and commits are the record; "
        f"this page just makes them legible.",
    )
    after = task_label(last, active["id"], tasks) if last else "—"
    a("  <footer>")
    a(f'    <span class="note"><b>This is a rendered view, not a source of truth.</b> '
      f'It reflects the roadmap in <code>{esc(sot)}</code> and the git history — the '
      f'milestones and commits are the record; this page just makes them legible.</span>')
    a(f'    <span>{esc(proj["name"])} · updated <b>{esc(updated)}</b> · '
      f'after <b>{esc(after)}</b></span>')
    a("  </footer>")
    a("</div>")

    body = "\n".join(out)
    return document(esc(proj["name"]), body)


def render_track(tasks: list[dict], last_key: str | None, active_id: str) -> str:
    """Render the active milestone's nested task track, grouped by `group`, with
    the derived "You are here" marker before the first not-yet-done task."""
    STEP_ST = {"done": "done", "next": "next", "planned": "planned", "dropped": "dropped"}
    lines: list[str] = []
    a = lines.append
    a('        <div class="track">')
    cur_group = object()  # sentinel: force first label if a group is set
    youarehere_done = False
    for t in tasks:
        if t["state"] in ("next", "planned", "dropped") and not youarehere_done:
            a('        </div>')
            a('        <span class="youarehere">You are here</span>')
            a('        <div class="track" style="border-top:none; padding-top:.2rem">')
            youarehere_done = True
            cur_group = object()  # re-emit group label after the break
        if t.get("group") and t["group"] != cur_group:
            cur_group = t["group"]
            a(f'          <span class="track-label">{fmt(cur_group)}</span>')

        entry = t["entry"]
        is_last_shipped = (
            entry is not None and last_key is not None
            and str(entry["task"]).lower() == last_key
        )
        # the freshest shipped step gets the pulsing "active" treatment
        step_cls = "active" if is_last_shipped else t["state"]
        st_txt = "done · now" if is_last_shipped else STEP_ST[t["state"]]

        desc = fmt(entry["summary"]) if (entry and entry.get("summary")) else fmt(t["desc"])
        if t["state"] == "dropped":
            desc = f'<s>{desc}</s>'
        warn = " ⚠" if (entry and entry.get("_stale")) else ""
        annot = step_annotation(entry)
        ev = step_evidence(entry)
        a(f'          <div class="step {step_cls}">'
          f'<span class="id">{esc(t["label"])}</span>'
          f'<span class="st">{esc(st_txt)}</span>'
          f'<span class="desc">{desc}{annot}{ev}{warn}</span></div>')
    a("        </div>")
    return "\n".join(lines)


def step_annotation(entry: dict | None) -> str:
    if not entry:
        return ""
    bits = []
    if entry.get("commit"):
        bits.append(f'<code>{esc(str(entry["commit"])[:7])}</code>')
    if entry.get("pr"):
        bits.append(f'PR #{esc(entry["pr"])}')
    if not bits:
        return ""
    return f' <span style="opacity:.7">{" · ".join(bits)}</span>'


def step_evidence(entry: dict | None) -> str:
    if not entry or not entry.get("evidence"):
        return ""
    items = " · ".join(fmt(x) for x in entry["evidence"])
    return f' <span style="opacity:.7">{items}</span>'


def task_label(entry: dict | None, active_id: str, tasks: list[dict]) -> str:
    """Human label for a log entry: prefer the declared task label, else the
    raw suffix of the fq id, uppercased."""
    if not entry:
        return "—"
    key = str(entry["task"]).lower()
    for t in tasks:
        if fq(active_id, t.get("id", t["label"])) == key or \
           fq(active_id, t["label"]) == key:
            return t["label"]
    # fall back to the id suffix (e.g. "m4.slice3" -> "SLICE3")
    return key.split(".", 1)[-1].upper()


def small(text: str) -> str:
    return f"<small>{fmt(text)}</small>" if text else ""


# --------------------------------------------------------------------------- #
# the standalone HTML shell (inline CSS lifted from the prototype, verbatim)
# --------------------------------------------------------------------------- #
def document(title: str, body: str) -> str:
    return (
        "<!doctype html>\n<html lang=\"en\">\n<head>\n"
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f"<title>{title} · build spine</title>\n"
        f"{STYLE}\n</head>\n<body>\n{body}\n</body>\n</html>\n"
    )


STYLE = r"""<style>
  :root {
    /* Light theme — cool quarried-stone ground, warm mineral-amber accent (deliberately not
       the AI-default cream+terracotta+serif: cool ground, technical sans/mono, amber on slate). */
    --ground: #e7eaee;
    --surface: #f6f8fa;
    --surface-2: #dde3ea;
    --line: #ccd4dd;
    --line-soft: #dbe1e8;
    --ink: #18222d;
    --muted: #566475;
    --faint: #8492a2;
    --accent: #a6641a;
    --accent-ink: #7c4a10;
    --done: #2c8b6a;
    --active: #b47320;
    --next: #3a72b8;
    --planned: #93a0ad;
    --shadow: 0 1px 2px rgba(24,34,45,.06), 0 8px 24px rgba(24,34,45,.06);
    --glow: rgba(166,100,26,.16);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #0f151c;
      --surface: #161f28;
      --surface-2: #1c2731;
      --line: #29343f;
      --line-soft: #212c37;
      --ink: #e3eaf1;
      --muted: #94a2b2;
      --faint: #647385;
      --accent: #dc9a52;
      --accent-ink: #eeb679;
      --done: #47b58c;
      --active: #e2a856;
      --next: #5f9ee2;
      --planned: #63717f;
      --shadow: 0 1px 2px rgba(0,0,0,.3), 0 12px 32px rgba(0,0,0,.35);
      --glow: rgba(220,154,82,.22);
    }
  }
  :root[data-theme="dark"] {
    --ground: #0f151c;
    --surface: #161f28;
    --surface-2: #1c2731;
    --line: #29343f;
    --line-soft: #212c37;
    --ink: #e3eaf1;
    --muted: #94a2b2;
    --faint: #647385;
    --accent: #dc9a52;
    --accent-ink: #eeb679;
    --done: #47b58c;
    --active: #e2a856;
    --next: #5f9ee2;
    --planned: #63717f;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 12px 32px rgba(0,0,0,.35);
    --glow: rgba(220,154,82,.22);
  }

  * { box-sizing: border-box; }

  :root {
    --sans: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --mono: ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace;
  }

  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: var(--sans);
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    font-feature-settings: "kern";
  }

  code {
    font-family: var(--mono);
    font-size: .86em;
    color: var(--accent-ink);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    padding: .05em .35em;
    border-radius: 4px;
    letter-spacing: -.01em;
  }
  .thesis code, .card p code, .horizon code, footer code { background: color-mix(in srgb, var(--accent) 10%, transparent); }

  .wrap {
    max-width: 940px;
    margin: 0 auto;
    padding: clamp(1.4rem, 4vw, 3.2rem) clamp(1.1rem, 4vw, 2rem) 4rem;
  }

  .eyebrow {
    font-family: var(--mono);
    font-size: .72rem;
    letter-spacing: .22em;
    text-transform: uppercase;
    color: var(--accent);
    margin: 0 0 .7rem;
    display: flex;
    align-items: center;
    gap: .6rem;
  }
  .eyebrow::before {
    content: "";
    width: 1.6rem; height: 1px;
    background: var(--accent);
    opacity: .6;
  }

  h1 {
    font-size: clamp(2.4rem, 7vw, 3.6rem);
    line-height: .98;
    letter-spacing: -.03em;
    font-weight: 800;
    margin: 0;
    text-wrap: balance;
  }
  h1 .sub {
    display: block;
    font-size: clamp(.95rem, 2.4vw, 1.12rem);
    font-weight: 500;
    letter-spacing: -.01em;
    color: var(--muted);
    margin-top: .9rem;
    max-width: 60ch;
    line-height: 1.5;
  }

  .thesis {
    margin: 1.8rem 0 0;
    padding: 1rem 1.2rem;
    border-left: 2px solid var(--accent);
    background: linear-gradient(90deg, var(--glow), transparent 70%);
    border-radius: 0 8px 8px 0;
    font-size: .98rem;
    color: var(--ink);
  }
  .thesis b { color: var(--accent-ink); font-weight: 600; }

  /* --- position readout ------------------------------------------------ */
  .readout {
    margin-top: 2.2rem;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: var(--line);
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  @media (max-width: 620px) { .readout { grid-template-columns: repeat(2, 1fr); } }
  .tile {
    background: var(--surface);
    padding: 1rem 1.1rem 1.05rem;
  }
  .tile .k {
    font-family: var(--mono);
    font-size: .64rem;
    letter-spacing: .16em;
    text-transform: uppercase;
    color: var(--faint);
    display: block;
    margin-bottom: .5rem;
  }
  .tile .v {
    font-size: 1.02rem;
    font-weight: 650;
    letter-spacing: -.01em;
    line-height: 1.25;
  }
  .tile .v small {
    display: block;
    font-family: var(--mono);
    font-size: .74rem;
    font-weight: 500;
    color: var(--muted);
    letter-spacing: 0;
    margin-top: .2rem;
  }
  .tile.hot .v { color: var(--accent-ink); }

  /* --- legend ---------------------------------------------------------- */
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: .5rem 1.3rem;
    margin: 2.6rem 0 .4rem;
    font-family: var(--mono);
    font-size: .72rem;
    letter-spacing: .04em;
    color: var(--muted);
  }
  .legend span { display: inline-flex; align-items: center; gap: .5rem; }
  .swatch { width: .62rem; height: .62rem; border-radius: 50%; }
  .swatch.done { background: var(--done); }
  .swatch.active { background: var(--active); }
  .swatch.next { background: var(--next); box-shadow: inset 0 0 0 1.5px var(--next); background: transparent; }
  .swatch.planned { background: var(--planned); }

  /* --- the spine ------------------------------------------------------- */
  .spine-h {
    font-family: var(--mono);
    font-size: .74rem;
    letter-spacing: .2em;
    text-transform: uppercase;
    color: var(--faint);
    margin: 2.4rem 0 1.4rem;
    display: flex; align-items: center; gap: .8rem;
  }
  .spine-h::after { content: ""; flex: 1; height: 1px; background: var(--line); }

  .spine { position: relative; margin: 0; padding: 0; }
  .spine::before {
    content: "";
    position: absolute;
    left: 11px; top: 6px; bottom: 30px;
    width: 2px;
    background: linear-gradient(var(--done) 0%, var(--done) 62%, var(--active) 74%, var(--next) 84%, var(--planned) 100%);
    opacity: .55;
  }

  .node { position: relative; padding: 0 0 1.5rem 3rem; }
  .node .dot {
    position: absolute;
    left: 3px; top: 3px;
    width: 18px; height: 18px;
    border-radius: 50%;
    background: var(--ground);
    border: 2px solid var(--planned);
    z-index: 1;
  }
  .node.is-done .dot { border-color: var(--done); background: var(--done); }
  .node.is-active .dot { border-color: var(--active); background: var(--active); }
  .node.is-next .dot { border-color: var(--next); }
  .node.is-active .dot::after {
    content: "";
    position: absolute; inset: -6px;
    border-radius: 50%;
    border: 2px solid var(--active);
    opacity: .5;
    animation: pulse 2.4s ease-out infinite;
  }
  @keyframes pulse {
    0% { transform: scale(.7); opacity: .55; }
    70% { transform: scale(1.5); opacity: 0; }
    100% { opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .node.is-active .dot::after { animation: none; opacity: .4; }
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 1.15rem 1.3rem 1.25rem;
    box-shadow: var(--shadow);
  }
  .node.is-active .card { border-color: color-mix(in srgb, var(--active) 45%, var(--line)); }
  .node.is-next .card { background: transparent; box-shadow: none; border-style: dashed; }

  .card-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: .5rem .8rem; margin-bottom: .5rem; }
  .card h3 { margin: 0; font-size: 1.16rem; letter-spacing: -.02em; font-weight: 700; }

  .tag {
    font-family: var(--mono);
    font-size: .66rem;
    font-weight: 600;
    letter-spacing: .1em;
    text-transform: uppercase;
    padding: .18rem .5rem;
    border-radius: 5px;
    white-space: nowrap;
  }
  .tag.done { color: var(--done); background: color-mix(in srgb, var(--done) 14%, transparent); }
  .tag.active { color: var(--accent-ink); background: color-mix(in srgb, var(--active) 18%, transparent); }
  .tag.next { color: var(--next); background: color-mix(in srgb, var(--next) 14%, transparent); }
  .tag.planned { color: var(--planned); background: color-mix(in srgb, var(--planned) 16%, transparent); }

  .card p { margin: .1rem 0 .2rem; color: var(--muted); font-size: .95rem; max-width: 62ch; }
  .card p .lede { color: var(--ink); font-weight: 500; }

  .evidence { list-style: none; margin: .8rem 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: .4rem; }
  .evidence li {
    font-family: var(--mono);
    font-size: .73rem;
    color: var(--muted);
    background: var(--surface-2);
    border: 1px solid var(--line-soft);
    padding: .22rem .55rem;
    border-radius: 6px;
    letter-spacing: -.005em;
  }
  .evidence li b { color: var(--accent-ink); font-weight: 600; }

  /* --- nested task track ----------------------------------------------- */
  .track { margin-top: 1.1rem; border-top: 1px dashed var(--line); padding-top: 1rem; display: grid; gap: .55rem; }
  .track-label {
    font-family: var(--mono); font-size: .64rem; letter-spacing: .16em; text-transform: uppercase;
    color: var(--faint); margin-bottom: .1rem;
  }
  .step {
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: baseline;
    gap: .7rem;
    padding: .5rem .65rem;
    border-radius: 8px;
    background: var(--surface-2);
    border: 1px solid transparent;
    font-size: .9rem;
  }
  .step .id { font-family: var(--mono); font-weight: 700; font-size: .82rem; letter-spacing: .02em; }
  .step .st {
    font-family: var(--mono); font-size: .6rem; letter-spacing: .1em; text-transform: uppercase;
    padding: .12rem .42rem; border-radius: 4px; white-space: nowrap; align-self: center;
  }
  .step .desc { color: var(--muted); }
  .step .desc b { color: var(--ink); font-weight: 600; }
  .step.done .id { color: var(--done); }
  .step.done .st { color: var(--done); background: color-mix(in srgb, var(--done) 14%, transparent); }
  .step.active { background: color-mix(in srgb, var(--active) 12%, var(--surface-2)); border-color: color-mix(in srgb, var(--active) 40%, transparent); }
  .step.active .id { color: var(--accent-ink); }
  .step.active .st { color: var(--accent-ink); background: color-mix(in srgb, var(--active) 22%, transparent); }
  .step.next .id { color: var(--next); }
  .step.next .st { color: var(--next); background: color-mix(in srgb, var(--next) 14%, transparent); }
  .step.planned { opacity: .72; }
  .step.planned .id { color: var(--planned); }
  .step.planned .st { color: var(--planned); background: color-mix(in srgb, var(--planned) 16%, transparent); }
  .step.dropped { opacity: .55; }
  .step.dropped .id { color: var(--planned); }
  .step.dropped .st { color: var(--planned); background: color-mix(in srgb, var(--planned) 16%, transparent); }
  .step.dropped .desc s { text-decoration-color: var(--faint); }

  .youarehere {
    display: inline-flex; align-items: center; gap: .5rem;
    font-family: var(--mono); font-size: .64rem; letter-spacing: .14em; text-transform: uppercase;
    color: var(--accent-ink); font-weight: 600;
    margin: .3rem 0 .1rem;
  }
  .youarehere::before { content: "▸"; }

  /* --- horizon --------------------------------------------------------- */
  .horizon {
    margin-top: 2.6rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 1.3rem 1.4rem 1.4rem;
    box-shadow: var(--shadow);
  }
  .horizon h2 {
    margin: 0 0 1rem; font-size: .78rem; font-family: var(--mono);
    letter-spacing: .2em; text-transform: uppercase; color: var(--faint); font-weight: 600;
  }
  .horizon ol { margin: 0; padding: 0; list-style: none; counter-reset: h; display: grid; gap: .85rem; }
  .horizon li { display: grid; grid-template-columns: auto 1fr; gap: .9rem; align-items: baseline; }
  .horizon li::before {
    counter-increment: h; content: counter(h);
    font-family: var(--mono); font-size: .72rem; font-weight: 700;
    color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent);
    width: 1.5rem; height: 1.5rem; border-radius: 50%;
    display: grid; place-items: center; align-self: center;
  }
  .horizon li b { font-weight: 650; color: var(--ink); }
  .horizon li span { color: var(--muted); font-size: .93rem; }

  /* --- footer ---------------------------------------------------------- */
  footer {
    margin-top: 2.8rem;
    padding-top: 1.3rem;
    border-top: 1px solid var(--line);
    display: flex; flex-wrap: wrap; justify-content: space-between; gap: .8rem;
    font-family: var(--mono); font-size: .72rem; color: var(--faint);
    letter-spacing: .02em;
  }
  footer .note { max-width: 52ch; line-height: 1.5; }
  footer b { color: var(--muted); font-weight: 600; }
</style>"""


# --------------------------------------------------------------------------- #
def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Render the build-spine progress view.")
    ap.add_argument("progress_dir", type=Path,
                    help="directory with roadmap.toml + log.jsonl")
    ap.add_argument("--out", type=Path, default=None, help="output HTML path")
    ap.add_argument("--repo", type=Path, default=None,
                    help="git repo root for commit verification")
    args = ap.parse_args(argv)

    pdir = args.progress_dir
    out = args.out or (pdir / "index.html")
    repo = args.repo or _git_toplevel(pdir)

    try:
        roadmap = load_roadmap(pdir / "roadmap.toml")
        log = load_log(pdir / "log.jsonl")
        verify_commits(log, repo)
        html_text = render(roadmap, log, repo)
    except StructuralError as exc:
        print(f"progress-log: structural error: {exc}", file=sys.stderr)
        return 2

    out.write_text(html_text, encoding="utf-8")
    stale = sum(1 for e in log if e.get("_stale"))
    tail = f" ({stale} stale commit(s))" if stale else ""
    print(f"progress-log: wrote {out} — {len(log)} log entr"
          f"{'y' if len(log) == 1 else 'ies'}{tail}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
