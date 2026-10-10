---
name: verify
description: Verify a change works by running the app and observing real behavior in the browser — not by reading code. Use aggressively whenever you touch frontend or backend code, and before declaring UI work done. For non-UI claims (scripts, evals, graders), use validate-work instead.
---

# Verify

A change is verified only when you have **run the app and observed the expected
behavior happen**. `tsc` passing, a green build, or "the code looks right" is
review — not verification. State what you expect to see *before* you look, then
confirm you actually saw it. Clicking around and seeing no crash is not
verification; it's theater.

For non-UI deliverables (a script, an eval, a grader, a doc), this skill is the
wrong tool — use [validate-work](../validate-work/SKILL.md), which executes
claims (including a failure path) and records misses to `LESSONS.md`.

## Procedure

### 1. State the expected behavior
Before booting anything, write down the concrete, observable claims this change
makes — e.g. "submitting the form with an empty email shows an inline error",
"the dashboard now shows the new column". Each claim is what you will confirm or
refute. No claim → nothing to verify.

### 2. Discover how to run the app (do not assume)
The dev command and port are project-specific. Find them, don't hardcode them:
- Read `package.json` `scripts` (`dev`, `start`) and the package manager
  (`pnpm`/`npm`/`yarn`/`bun` — check the lockfile).
- Find the port: framework config (`vite.config`, `next.config`), `.env`
  (`PORT=`), or the script flags. Vite defaults to `5173`, Next/CRA to `3000` —
  but confirm, don't guess.
- Note whether frontend and backend are separate processes and how each starts.

### 3. Boot it cleanly (and don't leak processes)
- **Check if it's already running first** (`curl -s localhost:<port>` or
  `lsof -i :<port>`). Reuse a live server instead of starting a second one.
- Start the dev server **in the background** so it doesn't block, and **record
  the PID** so you can stop it.
- Wait for readiness by polling the health/root URL until it responds — don't
  sleep a fixed guess.
- When done (or before re-running), **kill the process you started**. Used
  aggressively, this skill will otherwise stack orphaned servers fighting over
  the port.

### 4. Drive the real UI
- Use the Claude-in-Chrome MCP tools to open the app and exercise **every claim
  from step 1**, plus any feature touched by the change and anything named in
  `$ARGUMENTS`.
- Prefer real interaction (click, type, navigate) over reading the DOM.
- Correlate with evidence when behavior is ambiguous: console messages
  (`read_console_messages`), network requests (`read_network_requests`), and
  server logs.

### 5. Judge against the expected behavior
For each claim from step 1: **confirmed** (state what you observed) or
**refuted** (state what happened instead). A claim you couldn't exercise is
*not* confirmed — say so.

### 6. Handle the failure path honestly
If the app won't boot, the health check never goes green, or a feature is
broken: **report it as a finding and do NOT mark the work verified.** Capture
the error (console, network, logs). Don't smooth it over or assume it's
environmental without evidence.

## Verdict

End with exactly one of:
- **VERIFIED** — every claim exercised in the running app and observed as expected.
- **VERIFIED WITH GAPS** — core claims confirmed; named claims couldn't be exercised, with reasons.
- **NOT VERIFIED** — a claim was refuted or the app couldn't be run; list what's broken.

Never report VERIFIED on the strength of a passing build or code reading alone.

## Maintaining this skill
If you hit a blocker (the port discovery missed, a new framework boots
differently, the health check pattern was wrong), fix it **and update this
skill** so the next run doesn't trip on it.
