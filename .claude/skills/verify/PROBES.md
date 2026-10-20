# Probes: how to drive the running app

Reference for step 4 of [SKILL.md](SKILL.md). Use the section for the surface
the claims touch; a full-stack change uses both.

## Backend probe matrix (HTTP APIs)

Run probes as real HTTP requests against the booted server (`curl -sS -i`,
`hurl`, or `httpie`). In-process test clients and mocked layers skip the
middleware, serialization and error handling that real requests hit. Save each
request and its full response (status, headers, body) as one file under
`evidence/`.

For every endpoint the diff touches, run the rows that apply:

| Probe | Expected |
|---|---|
| Happy path | 2xx, body has the documented shape, side effect visible on a follow-up GET |
| Missing or invalid auth token | 401; nothing created or changed |
| User A's token on user B's resource | 403 or 404, with none of B's data in the body |
| Malformed JSON, wrong `Content-Type` | 400 (or 415); never 5xx |
| Missing required field, wrong type, boundary values (empty, max length, max+1) | 4xx naming the field; never 5xx |
| Undeclared method on a known path | 405 |
| Oversized body | 413 or 400; never 5xx |
| GET after DELETE | 404 |
| Read-only or privileged fields (`id`, `role`, `owner`) in a create/update body | Ignored; not echoed or stored |
| Same request replayed (create, payment, any non-idempotent call) | Matches the API's stated idempotency rule |
| **Every** non-2xx or error response | Consistent error shape for the project; no traceback, absolute file path or framework internals in the body |

The last row is the most valuable single check: it catches leaked stack traces
and inconsistent error handling across the whole surface at once.

Proving state changes: a 2xx is not proof a write happened. Follow every create,
update or delete with a read (GET, or a direct DB query when the API can't show
it) and save that too. Negative probes need the same: show the count or record
is unchanged after a refused request.

## UI journeys (frontends)

A journey is a claim from step 1 written as user steps with an expected
observation at each checkpoint: "Given a signed-in user on /notes, when they
submit the form with an empty title, then an inline error appears under the
title field and no note is added to the list."

Drive journeys with real interaction (click, type, navigate) through the
browser tools: Claude-in-Chrome MCP, or a browser CLI when the project uses one,
which costs far fewer tokens per step than MCP snapshots. Reading the DOM to
infer what a user would see is a proxy.

For each journey:
- Run it at desktop (1280×800) and mobile (375×812) width when the change
  touches layout.
- Screenshot each checkpoint into `evidence/`, named by claim and step.
- Capture the browser console: zero errors on the routes the journey visits.
  Save the dump.
- Capture network requests: any 4xx/5xx the journey did not expect is a finding.
- Check the backend side effect, not just the toast: after "saved", reload the
  page or GET the record.

When the project has committed E2E specs (Playwright, Cypress) covering the
touched feature, run them as well and save the report. They are part of the
oracle: a failing spec is a FAIL, and editing it is a hack flag.

## What breaks probes

- Port already taken by another worktree's server: find a free port or reuse
  the live one; never kill a process you didn't start.
- Shared dev database: probes that create data leave it behind. Use a disposable
  DB or clean up the records you created, and say which in the report.
- Flaky result: re-run once. If it differs, report the claim INCONCLUSIVE with
  both runs as evidence; a flaky PASS is not a PASS.
