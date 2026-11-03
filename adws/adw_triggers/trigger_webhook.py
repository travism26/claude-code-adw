#!/usr/bin/env -S uv run
# /// script
# dependencies = ["fastapi", "uvicorn", "python-dotenv"]
# ///

"""
GitHub Webhook Trigger - AI Developer Workflow (ADW)

FastAPI endpoint for GitHub `issues` webhooks. When an issue is labelled
ready-for-agent it starts `travis_sdlc.py <N> --worktree --risk-gate`
(adw_triggers/ticket_launch.py) in the background and answers at once, inside
GitHub's 10-second timeout. Every other event is ignored.

Every request must carry a valid X-Hub-Signature-256 for GITHUB_WEBHOOK_SECRET;
without the secret set, every request is refused. Even then the payload is not
trusted to decide anything: the Ticket resolver inside
travis_sdlc re-reads the issue from GitHub and refuses it unless it is labelled
ready-for-agent, not in-progress, and free of open Blockers. Only someone with
triage access to the repo can apply a label in the first place.

Usage: uv run adws/adw_triggers/trigger_webhook.py

Environment: GITHUB_WEBHOOK_SECRET (required), PORT (default 8001), plus what a Ticket run needs (gh and
Claude Code logged in, or GITHUB_PAT).
"""

import json
import os
import subprocess
import sys

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import uvicorn

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from adw_modules.ticket_resolver import READY_LABEL  # noqa: E402
from adw_triggers.ticket_launch import (  # noqa: E402
    REPO_ROOT, ticket_run_command, ticket_run_env, ticket_to_run, valid_signature)

load_dotenv()

PORT = int(os.getenv("PORT", "8001"))

app = FastAPI(
    title="ADW Webhook Trigger", description="GitHub webhook endpoint for ADW"
)


@app.post("/gh-webhook")
async def github_webhook(request: Request):
    """Handle GitHub webhook events."""
    event_type = request.headers.get("X-GitHub-Event", "")
    body = await request.body()
    if not valid_signature(os.getenv("GITHUB_WEBHOOK_SECRET", ""), body,
                           request.headers.get("X-Hub-Signature-256", "")):
        return JSONResponse(status_code=401, content={
            "status": "refused", "reason": "missing or invalid X-Hub-Signature-256 "
                                           "(is GITHUB_WEBHOOK_SECRET set?)"})
    try:
        payload = json.loads(body)
    except Exception:
        return {"status": "ignored", "reason": "body is not JSON"}

    number = ticket_to_run(event_type, payload)
    if number is None:
        return {"status": "ignored",
                "reason": f"not an issue labelled {READY_LABEL} (event={event_type}, "
                          f"action={payload.get('action', '')})"}

    cmd = ticket_run_command(number)
    print(f"Starting a Ticket run for #{number}: {' '.join(cmd)}")
    # Background, own session: the run outlives this request.
    subprocess.Popen(cmd, cwd=REPO_ROOT, env=ticket_run_env(), start_new_session=True)
    return {"status": "accepted", "issue": number,
            "message": f"Ticket run started for #{number}; the resolver decides "
                       "whether it may proceed"}


@app.get("/health")
async def health():
    """Health check endpoint - runs comprehensive system health check."""
    try:
        # Run the health check script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        # Health check is in adw_tests, not adw_triggers
        health_check_script = os.path.join(
            os.path.dirname(script_dir), "adw_tests", "health_check.py"
        )

        # Run health check with timeout
        result = subprocess.run(
            ["uv", "run", health_check_script],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=os.path.dirname(script_dir),  # Run from adws directory
        )

        # Print the health check output for debugging
        print("=== Health Check Output ===")
        print(result.stdout)
        if result.stderr:
            print("=== Health Check Errors ===")
            print(result.stderr)

        # Parse the output - look for the overall status
        output_lines = result.stdout.strip().split("\n")
        is_healthy = result.returncode == 0

        # Extract key information from output
        warnings = []
        errors = []

        capturing_warnings = False
        capturing_errors = False

        for line in output_lines:
            if "⚠️  Warnings:" in line:
                capturing_warnings = True
                capturing_errors = False
                continue
            elif "❌ Errors:" in line:
                capturing_errors = True
                capturing_warnings = False
                continue
            elif "📝 Next Steps:" in line:
                break

            if capturing_warnings and line.strip().startswith("-"):
                warnings.append(line.strip()[2:])
            elif capturing_errors and line.strip().startswith("-"):
                errors.append(line.strip()[2:])

        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "service": "adw-webhook-trigger",
            "health_check": {
                "success": is_healthy,
                "warnings": warnings,
                "errors": errors,
                "details": "Run health_check.py directly for full report",
            },
        }

    except subprocess.TimeoutExpired:
        return {
            "status": "unhealthy",
            "service": "adw-webhook-trigger",
            "error": "Health check timed out",
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "adw-webhook-trigger",
            "error": f"Health check failed: {str(e)}",
        }


if __name__ == "__main__":
    print(f"Starting server on http://0.0.0.0:{PORT}")
    print("Webhook endpoint: POST /gh-webhook")
    print("Health check: GET /health")

    uvicorn.run(app, host="0.0.0.0", port=PORT)
