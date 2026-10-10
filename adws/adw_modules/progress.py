"""Live progress one-liners teed off the Claude Code stream-json output.

Pattern adapted from Anthropic's cwc-workshops agent-battle harness
(https://github.com/anthropics/cwc-workshops, Apache-2.0): the
structured JSONL stays the machine record; this module appends one
human-readable line per interesting event to agents/<adw_id>/progress.log
so a whole SDLC run can be followed live with:

    tail -F agents/latest-progress.log

Design constraints:
  - Append-only, opened per write: every phase runs in its own process and
    several agents may interleave; small appends keep lines whole.
  - Never raises: progress is best-effort decoration around the real run.
  - Heartbeat: a "still working" line at most every HEARTBEAT_S of silence,
    so a quiet log is distinguishable from a hung one.

Disable with ADW_NO_PROGRESS_LOG=1.
"""

import json
import os
import time
from datetime import datetime
from typing import Any, Optional

HEARTBEAT_S = 30
SNIPPET_LEN = 110

# Tool-input keys worth showing, in preference order, per common tools.
_ARG_KEYS = ("command", "file_path", "path", "pattern", "query", "description", "prompt")


def _snippet(text: str, limit: int = SNIPPET_LEN) -> str:
    text = " ".join(str(text).split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def format_stream_event(obj: dict) -> Optional[str]:
    """One human line for a stream-json event, or None for noise."""
    etype = obj.get("type")

    if etype == "system" and obj.get("subtype") == "init":
        model = obj.get("model", "?")
        return f"session started (model={model})"

    if etype == "assistant":
        parts = []
        for block in (obj.get("message") or {}).get("content") or []:
            btype = block.get("type")
            if btype == "text" and block.get("text", "").strip():
                parts.append(f"says: {_snippet(block['text'])}")
            elif btype == "tool_use":
                arg = ""
                tool_input = block.get("input") or {}
                for key in _ARG_KEYS:
                    if tool_input.get(key):
                        arg = f": {_snippet(str(tool_input[key]), 80)}"
                        break
                parts.append(f"{block.get('name', 'tool')}{arg}")
        return " | ".join(parts) if parts else None

    if etype == "user":
        for block in (obj.get("message") or {}).get("content") or []:
            if block.get("type") == "tool_result" and block.get("is_error"):
                content = block.get("content")
                if isinstance(content, list):
                    content = " ".join(
                        c.get("text", "") for c in content if isinstance(c, dict)
                    )
                return f"tool error: {_snippet(str(content))}"
        return None  # ordinary tool results are noise at this altitude

    if etype == "result":
        cost = obj.get("total_cost_usd")
        turns = obj.get("num_turns")
        dur_ms = obj.get("duration_ms")
        bits = ["done"]
        if obj.get("subtype") and obj["subtype"] != "success":
            bits = [f"done ({obj['subtype']})"]
        if turns is not None:
            bits.append(f"{turns} turns")
        if dur_ms is not None:
            bits.append(f"{dur_ms / 60000:.1f}m")
        if isinstance(cost, (int, float)):
            bits.append(f"${cost:.4f}")
        return ", ".join(bits)

    return None


class ProgressWriter:
    """Tails an agent's JSONL output and appends one-liners to progress.log.

    The log path is derived from the agent's output file
    (agents/<adw_id>/<agent_name>/raw.jsonl -> agents/<adw_id>/progress.log);
    if the output file doesn't follow that layout, the writer is a no-op.
    """

    def __init__(self, output_file: str, agent_name: str):
        self.agent_name = agent_name
        self._offset = 0
        self._buf = ""
        self._last_line_at = time.time()
        self._output_file = output_file
        self.log_path: Optional[str] = None

        if os.getenv("ADW_NO_PROGRESS_LOG"):
            return
        agent_dir = os.path.dirname(os.path.abspath(output_file))
        run_dir = os.path.dirname(agent_dir)
        if not os.path.basename(run_dir):
            return
        self.log_path = os.path.join(run_dir, "progress.log")
        self._refresh_latest_symlink(run_dir)

    def _refresh_latest_symlink(self, run_dir: str) -> None:
        """agents/latest-progress.log -> <adw_id>/progress.log (last run wins)."""
        try:
            agents_dir = os.path.dirname(run_dir)
            link = os.path.join(agents_dir, "latest-progress.log")
            target = os.path.join(os.path.basename(run_dir), "progress.log")
            tmp = link + ".tmp"
            if os.path.lexists(tmp):
                os.unlink(tmp)
            os.symlink(target, tmp)
            os.replace(tmp, link)
        except OSError:
            pass

    def event(self, text: str) -> None:
        """Append one stamped line; never raises."""
        if not self.log_path:
            return
        try:
            stamp = datetime.now().strftime("%H:%M:%S")
            with open(self.log_path, "a") as f:
                f.write(f"[{stamp}] [{self.agent_name}] {text}\n")
        except OSError:
            pass
        self._last_line_at = time.time()

    def tick(self) -> None:
        """Tail new JSONL lines into one-liners; heartbeat when silent."""
        if not self.log_path:
            return
        try:
            with open(self._output_file, "r") as f:
                f.seek(self._offset)
                chunk = f.read()
                self._offset = f.tell()
        except OSError:
            chunk = ""

        if chunk:
            self._process(chunk)
        elif time.time() - self._last_line_at > HEARTBEAT_S:
            quiet = int(time.time() - self._last_line_at)
            self.event(f"… still working ({quiet}s without output)")

    def _process(self, chunk: str) -> None:
        self._buf += chunk
        *complete, self._buf = self._buf.split("\n")
        for raw in complete:
            if not raw.strip():
                continue
            try:
                line = format_stream_event(json.loads(raw))
            except (json.JSONDecodeError, AttributeError, TypeError):
                line = None
            if line:
                self.event(line)

    def close(self) -> None:
        """Flush any buffered partial line, then drain the file one last time."""
        if not self.log_path:
            return
        self.tick()
        if self._buf.strip():
            self._process("\n")
