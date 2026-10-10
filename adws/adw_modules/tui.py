"""Rich Live split-pane TUI for the Travis SDLC pipeline (Option A).

A *view* over data the orchestrator already produces:

  - Left pane  ("Pipeline"): the ordered phase list rendered with ✓ / running
    spinner / ○ glyphs and per-phase elapsed time, mirroring a typical CI
    pipeline status column. Status is driven by the orchestrator loop calling
    ``start_phase`` / ``end_phase``.
  - Right pane ("Log"): a live tail of ``agents/<adw_id>/progress.log`` — the
    same curated one-liners you'd otherwise follow with ``tail -F``.

This adds no new data sources. Phase status comes from the loop; the log pane
tails the file ``adw_modules/progress.py`` already writes during every phase.

Strictly opt-in and self-disabling:
  - Enable with ``--tui`` (travis_sdlc) or ``ADW_TUI=1``.
  - Disable with ``--no-tui`` or ``ADW_NO_TUI=1``.
  - Auto-disables when stdout is not a TTY (CI, webhook/cron triggers) or when
    ``rich`` is unavailable, falling back to the plain phase prints.

``create()`` returns a no-op ``NullTUI`` whenever the TUI is disabled, so the
orchestrator can call the same methods unconditionally.
"""

import atexit
import json
import os
import sys
import threading
import time
from collections import deque
from typing import List, Optional


def tui_enabled(flag_on: bool, flag_off: bool) -> bool:
    """Decide whether a live TUI should run for this invocation."""
    if flag_off or os.getenv("ADW_NO_TUI"):
        return False
    if not (flag_on or os.getenv("ADW_TUI")):
        return False
    if not sys.stdout.isatty():
        return False
    try:
        import rich  # noqa: F401
    except ImportError:
        return False
    return True


class NullTUI:
    """No-op stand-in used whenever the live TUI is disabled."""

    enabled = False
    console_log_path: Optional[str] = None

    def start(self) -> "NullTUI":
        return self

    def stop(self) -> None:
        pass

    def start_phase(self, label: str) -> None:
        pass

    def end_phase(self, label: str, ok: bool, skipped: bool = False) -> None:
        pass

    def note(self, text: str) -> None:
        pass

    def __enter__(self) -> "NullTUI":
        return self.start()

    def __exit__(self, *exc) -> bool:
        self.stop()
        return False


class PipelineTUI:
    """Live split-pane renderer for a single SDLC run."""

    enabled = True
    REFRESH_HZ = 8
    _SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"

    def __init__(self, adw_id: str, phases: List[str], run_dir: str, title: str = ""):
        self.adw_id = adw_id
        self.title = title or adw_id
        self.run_dir = run_dir
        self.log_path = os.path.join(run_dir, "progress.log")
        self.console_log_path = os.path.join(run_dir, "sdlc_console.log")
        self._timings_path = os.path.join(run_dir, "phase_timings.json")

        self._phases = [
            {"label": p, "status": "pending", "start": None, "elapsed": 0.0}
            for p in phases
        ]
        self._index = {p: i for i, p in enumerate(phases)}

        self._lock = threading.Lock()
        self._log_lines: deque = deque(maxlen=500)
        self._log_buf = ""
        self._log_offset = 0

        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._live = None
        self._console = None
        self._started = False

    # -- lifecycle ---------------------------------------------------------
    def start(self) -> "PipelineTUI":
        if self._started:
            return self
        from rich.console import Console
        from rich.live import Live

        self._console = Console()
        self._drain_log()  # prime with anything already on disk
        self._live = Live(
            self._renderable(),
            console=self._console,
            refresh_per_second=self.REFRESH_HZ,
            screen=False,            # inline: preserve scrollback + final summary
            redirect_stdout=True,    # capture stray prints so they don't corrupt
            redirect_stderr=True,
            transient=False,
        )
        self._live.start()
        self._started = True
        atexit.register(self.stop)   # crash-safe teardown
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        return self

    def stop(self) -> None:
        if not self._started:
            return
        self._started = False
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=1.0)
        try:
            self._drain_log()
            if self._live is not None:
                self._live.update(self._renderable())
                self._live.stop()
        except Exception:
            pass

    def __enter__(self) -> "PipelineTUI":
        return self.start()

    def __exit__(self, *exc) -> bool:
        self.stop()
        return False

    # -- phase state -------------------------------------------------------
    def _find(self, label: str) -> int:
        """Map a (possibly variant) phase label onto a row, appending if new."""
        if label in self._index:
            return self._index[label]
        for i, ph in enumerate(self._phases):
            pl = ph["label"]
            if label.startswith(pl) or pl.startswith(label):
                return i
        self._phases.append(
            {"label": label, "status": "pending", "start": None, "elapsed": 0.0}
        )
        idx = len(self._phases) - 1
        self._index[label] = idx
        return idx

    def start_phase(self, label: str) -> None:
        with self._lock:
            ph = self._phases[self._find(label)]
            ph["status"] = "running"
            ph["start"] = time.time()

    def end_phase(self, label: str, ok: bool, skipped: bool = False) -> None:
        with self._lock:
            ph = self._phases[self._find(label)]
            if ph["start"] is not None:
                ph["elapsed"] = time.time() - ph["start"]
            ph["status"] = "skipped" if skipped else ("done" if ok else "failed")
        self._persist_timings()

    def note(self, text: str) -> None:
        with self._lock:
            self._log_lines.append(f"· {text}")

    def _persist_timings(self) -> None:
        try:
            with self._lock:
                data = {
                    ph["label"]: {"status": ph["status"], "elapsed": round(ph["elapsed"], 2)}
                    for ph in self._phases
                    if ph["status"] != "pending"
                }
            with open(self._timings_path, "w") as f:
                json.dump(data, f, indent=2)
        except OSError:
            pass

    # -- log tailing -------------------------------------------------------
    def _drain_log(self) -> None:
        with self._lock:
            offset = self._log_offset
        try:
            with open(self.log_path, "r", errors="replace") as f:
                f.seek(offset)
                chunk = f.read()
                new_offset = f.tell()
        except OSError:
            return
        if not chunk:
            return
        with self._lock:
            if new_offset <= self._log_offset:
                return
            self._log_offset = new_offset
            self._log_buf += chunk
            *complete, self._log_buf = self._log_buf.split("\n")
            for raw in complete:
                if raw.strip():
                    self._log_lines.append(raw.rstrip())

    # -- rendering ---------------------------------------------------------
    def _loop(self) -> None:
        interval = 1.0 / self.REFRESH_HZ
        while not self._stop.is_set():
            self._drain_log()
            try:
                if self._live is not None:
                    self._live.update(self._renderable())
            except Exception:
                pass
            self._stop.wait(interval)

    def _renderable(self):
        from rich.layout import Layout
        from rich.panel import Panel
        from rich.table import Table
        from rich.text import Text

        now = time.time()
        grid = Table.grid(padding=(0, 1))
        grid.add_column()
        with self._lock:
            phases = [dict(p) for p in self._phases]
        for ph in phases:
            status = ph["status"]
            if status == "done":
                glyph, gstyle, secs, lstyle = "✓", "bold green", ph["elapsed"], "white"
            elif status == "failed":
                glyph, gstyle, secs, lstyle = "✗", "bold red", ph["elapsed"], "red"
            elif status == "running":
                glyph = self._SPINNER[int(now * 10) % len(self._SPINNER)]
                gstyle, secs, lstyle = "bold yellow", now - (ph["start"] or now), "bold white"
            elif status == "skipped":
                glyph, gstyle, secs, lstyle = "–", "dim", None, "dim"
            else:
                glyph, gstyle, secs, lstyle = "○", "dim", None, "dim"
            line = Text()
            line.append(glyph + " ", style=gstyle)
            line.append(ph["label"], style=lstyle)
            if secs is not None:
                line.append(f"  {secs:6.1f}s", style="cyan dim")
            grid.add_row(line)

        left = Panel(grid, title="Pipeline", title_align="left", border_style="yellow")

        height = self._console.size.height if self._console else 24
        visible = max(5, height - 4)
        with self._lock:
            tail = list(self._log_lines)[-visible:]
        log_text = Text("\n".join(tail) if tail else "(waiting for output…)", style="grey70")
        right = Panel(log_text, title="Log", title_align="left", border_style="grey50")

        layout = Layout()
        layout.split_row(Layout(left, name="pipe", size=40), Layout(right, name="log"))
        return layout


def create(adw_id: str, phases: List[str], run_dir: str, enabled: bool, title: str = ""):
    """Return a PipelineTUI when enabled, else a no-op NullTUI."""
    if not enabled:
        return NullTUI()
    try:
        return PipelineTUI(adw_id, phases, run_dir, title=title)
    except Exception:
        return NullTUI()
