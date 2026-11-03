"""What a trigger starts: one unattended Ticket run (ADR-0001).

Both triggers (trigger_cron.py, trigger_webhook.py) hand an issue number to
`travis_sdlc.py <N>`, whose Ticket resolver decides whether it may run: the
issue must be labelled ready-for-agent, not in-progress, in this repo, and free
of open Blockers. An accepted Ticket is claimed (in-progress) before anything
else happens, and always ends in a draft PR. So a trigger only has to say
which issue; it never decides that an issue is runnable on its own.

Nobody watches a triggered run, so it always gets an isolated worktree
(--worktree) and the risk-gate deny hook (--risk-gate, plus ADW_RISK_GATE for
any child that reads the env).
"""

import sys
from pathlib import Path
from typing import Dict, Iterable, List, Optional

ADWS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ADWS_DIR))

from adw_modules.ticket_resolver import IN_PROGRESS_LABEL, READY_LABEL  # noqa: E402
from adw_modules.utils import get_safe_subprocess_env  # noqa: E402

TRAVIS_SDLC = ADWS_DIR / "travis" / "travis_sdlc.py"
REPO_ROOT = ADWS_DIR.parent


def ticket_run_command(issue_number: int) -> List[str]:
    return ["uv", "run", str(TRAVIS_SDLC), str(issue_number), "--worktree", "--risk-gate"]


def ticket_run_env() -> Dict[str, str]:
    return {**get_safe_subprocess_env(), "ADW_RISK_GATE": "1"}


def looks_runnable(labels: Iterable[str]) -> bool:
    """A cheap pre-filter on labels the trigger already has. The resolver
    re-checks everything against GitHub, Blockers included."""
    names = set(labels)
    return READY_LABEL in names and IN_PROGRESS_LABEL not in names


def ticket_to_run(event_type: str, payload: dict) -> Optional[int]:
    """The issue a webhook asks to run: an `issues` event labelling it
    ready-for-agent. None for anything else."""
    if event_type != "issues" or payload.get("action") != "labeled":
        return None
    if (payload.get("label") or {}).get("name") != READY_LABEL:
        return None
    number = (payload.get("issue") or {}).get("number")
    return number if isinstance(number, int) and not isinstance(number, bool) else None


def due_tickets(issues, attempts: Dict[int, float], now: float,
                retry_after_s: float) -> List[int]:
    """For the poller: Ready-looking issues not attempted in the last
    retry_after_s seconds, lowest number first."""
    due = []
    for issue in issues:
        if not looks_runnable(label.name for label in issue.labels):
            continue
        if now - attempts.get(issue.number, float("-inf")) < retry_after_s:
            continue
        due.append(issue.number)
    return sorted(due)
