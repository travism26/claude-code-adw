#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "schedule",
#     "python-dotenv",
#     "pydantic",
# ]
# ///

"""
Polling ADW trigger: every 20 seconds, start a Ticket run for the next Ready Ticket.

A Ready Ticket is an open issue labelled ready-for-agent and not in-progress.
Each one found is handed to `travis_sdlc.py <N> --worktree --risk-gate`
(adw_triggers/ticket_launch.py), one at a time: a run finishes before the next
starts. The Ticket resolver inside travis_sdlc re-checks the Ticket and refuses
it if it has open Blockers; an accepted Ticket is labelled in-progress first,
so it is never picked up twice. A refused or failed Ticket is retried after
RETRY_AFTER_S seconds, so a Ticket waiting on a Blocker starts once the
Blocker closes.
"""

import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict

import schedule
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from adw_modules.github import extract_repo_path, fetch_open_issues, get_repo_url  # noqa: E402
from adw_triggers.ticket_launch import (  # noqa: E402
    REPO_ROOT, due_tickets, ticket_run_command, ticket_run_env)

load_dotenv()

POLL_INTERVAL_S = 20
RETRY_AFTER_S = 600

# Issue number -> when this session last started a run for it.
last_attempt: Dict[int, float] = {}
shutdown_requested = False


def signal_handler(signum, frame):
    global shutdown_requested
    print(f"\nINFO: Received signal {signum}, finishing the current run then stopping...")
    shutdown_requested = True


def start_ticket_run(issue_number: int) -> bool:
    print(f"INFO: Starting a Ticket run for #{issue_number}")
    result = subprocess.run(ticket_run_command(issue_number), cwd=REPO_ROOT,
                            env=ticket_run_env())
    if result.returncode != 0:
        print(f"WARNING: The run for #{issue_number} exited {result.returncode} "
              f"(refused or failed); retrying in {RETRY_AFTER_S}s at the earliest")
        return False
    print(f"INFO: The run for #{issue_number} finished")
    return True


def check_and_process_issues(repo_path: str):
    if shutdown_requested:
        return
    try:
        issues = fetch_open_issues(repo_path)
    except Exception as e:
        print(f"ERROR: Could not list open issues: {e}")
        return
    for number in due_tickets(issues, last_attempt, time.time(), RETRY_AFTER_S):
        if shutdown_requested:
            break
        last_attempt[number] = time.time()
        start_ticket_run(number)


def main():
    try:
        repo_path = extract_repo_path(get_repo_url())
    except ValueError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    print(f"INFO: Starting the ADW polling trigger for {repo_path} "
          f"(every {POLL_INTERVAL_S}s)")
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    schedule.every(POLL_INTERVAL_S).seconds.do(check_and_process_issues, repo_path)
    check_and_process_issues(repo_path)
    while not shutdown_requested:
        schedule.run_pending()
        time.sleep(1)
    print("INFO: Shutdown complete")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ["--help", "-h"]:
        print(__doc__)
        print("Usage: uv run adws/adw_triggers/trigger_cron.py")
        print("The repository is taken from the git remote of the current clone.")
        sys.exit(0)
    main()
