---
name: verify
description: Verify a change works by running the app and observing real behavior — HTTP probes for a backend, real interaction for a UI — graded by a fresh agent against claims fixed before the run, with evidence saved to disk. Use whenever you touch frontend or backend code, and before declaring app work done. For non-app claims (scripts, evals, graders), use validate-work instead.
---

# Verify

A change is verified when an agent **other than its author** has run the real
app, exercised every claim, and left **evidence** on disk that each claim holds.
Green tests, a clean build, and "the code looks right" are proxies; the author's
own belief carries zero weight. The **oracle** (what counts as correct) is fixed
before the app boots and is never edited to make a run pass.

For non-app deliverables (a script, an eval, a grader, a doc), use
[validate-work](../validate-work/SKILL.md) instead.

## Author or verifier: pick your role first

- **Author**: you wrote or changed the code in this context. You do not grade it.
  Run step 1 yourself, then dispatch a fresh verifier subagent
  (`general-purpose`) with the brief below and nothing else: no transcript, no
  reasoning about why the code is right. Relay its report verbatim.
- **Verifier**: you were dispatched with a brief, or you are checking a change
  you did not write. Run steps 1–8.

Verifier brief (the author fills the angle brackets):

```
Verify <repo path> at commit <sha> (diff: <base>..<sha>) using the verify skill
at <path to this SKILL.md>. Read it in full first; you are the verifier.
Claims (the oracle; do not change them):
- C1: <observable claim> — expected: <what you will see>
- C2: ...
Launch recipe, if known: <command, port, readiness URL, auth fixtures>
```

**Fix loop.** On FAIL, the author fixes and dispatches a *new* verifier (never
resumes the old one). Two fix cycles at most; after that, stop and report to
the user with the evidence so far. An honest stop beats a third attempt.

## Procedure (verifier)

### 1. Fix the oracle
List the concrete, observable claims, each with its **expected observation**
("POST /notes with an empty title returns 400 and the note count is unchanged",
"the dashboard shows the new column at 375px wide"). Source them from the
ticket/spec and the diff, not from the author's narration. Every claim gets at
least one **negative probe**: an input or path where the app must refuse, fail
loudly, or stay unchanged. A claim with no expected observation cannot pass;
mark it INCONCLUSIVE now. When verifying a bug fix, also record what the bug
looked like, so step 4 can show it is gone. A claim that something does *not*
happen ("no workflow launched", "no email sent") needs a stated trace to look for:
the log line, child process, file, row or outbound call that would exist if it
had happened.

Write the claims to `.verify/<short-sha>/claims.md` before booting anything.
From here on, claims, tests, probes and journey specs are **read-only**: if one
is wrong, report FLAG with the change you would propose, and leave the file as
it is.

### 2. Launch
Use the project's verify recipe (`.claude/verify-recipe.md`, one section per
app or server) if it has one; otherwise discover the launch command from the environment (`package.json`
scripts and lockfile, `pyproject.toml`, framework config, `.env` `PORT=`).
- Check whether it is already running (`lsof -i :<port>`); reuse a live server.
- Start it in the background with output to `.verify/<short-sha>/server.log`.
  Record the **listener's** PID (`lsof -ti :<port>` once it is up) as well as
  `$!`: a wrapper like `uv`, `npm` or `mvn` forks the real server, and killing
  only the wrapper can orphan it.
- Poll a cheap route until it answers; any HTTP status means the server is up.
  A fixed `sleep` is a guess, and a health endpoint that runs checks or calls
  external services is too slow and costly to poll.

### 3. Doctor (read-only health check)
Before driving anything, confirm the environment can produce a verdict:
readiness answers 2xx, the routes or pages the claims touch respond, required
services (DB, queue) are up, migrations applied. Also note any probe the
claims require that has external cost or side effects (calls a paid API, sends
mail, posts to GitHub); run it only if the brief allows, otherwise list it in
`not_checked`. A Doctor failure makes the run
INCONCLUSIVE (environment), not FAIL. Capture the error either way.

### 4. Drive
Exercise every claim from step 1 against the running app: happy path and
negative probe. Read [PROBES.md](PROBES.md) for the branch you are on: the
**backend probe matrix** for HTTP APIs, the **UI journey** rules for frontends,
or both. Save each request/response, screenshot or console dump under
`.verify/<short-sha>/evidence/` as you go, one file per probe, named
`<claim>-<case>`, holding the exact request and the full response; an observation with no file behind it
did not happen.

### 5. Observe
Read what the app said while you drove it: `server.log` for errors and stack
traces during the run window, browser console and network panel for UIs, any
metrics endpoint for 5xx counts. A 5xx the probes did not assert on, or an
ERROR log line during a "passing" probe, is a finding.

### 6. Grade
Grade each claim on its own, against the evidence only:
- **PASS**: expected observation seen, negative probe refused as expected, and
  at least one evidence path cited.
- **FAIL**: observed something else. Quote what happened instead.
- **INCONCLUSIVE**: couldn't exercise it (environment broke, oracle missing).
  Never downgrade a FAIL to INCONCLUSIVE.

The claim's expected observation is what you grade against. Where the app
meets the claim but departs from a [PROBES.md](PROBES.md) row (200 where the
matrix expects 400), record it in the claim's `notes` as a finding; it does not
change the status.

Then check the diff for **hack flags**: edited or deleted tests, weakened or
removed assertions, added `skip`/`xfail`/`fixme`, special-casing of test
inputs, or a broadened locator. With no diff (verifying existing behavior), skip
this and say so in `not_checked`. Any hack flag makes the overall verdict FLAG,
whatever the claims scored. A change that turns out unnecessary (the behavior
already held) is a legitimate result; report it as such.

### 7. Evidence
Write `.verify/<short-sha>/report.json`:

```json
{
  "commit": "<full sha>",
  "verifier_model": "<your own model id>",
  "verdict": "VERIFIED | NOT VERIFIED | INCONCLUSIVE | FLAG",
  "claims": [
    {"id": "C1", "text": "...", "expected": "...", "status": "PASS | FAIL | INCONCLUSIVE",
     "evidence": ["evidence/c1-empty-title.http"], "notes": ""}
  ],
  "hack_flags": [],
  "not_checked": ["claims or paths deliberately skipped, with why"],
  "environment": {"launch": "<command>", "port": 0, "services": []}
}
```

Overall verdict: **VERIFIED** only when every claim is PASS and there are no
hack flags; **NOT VERIFIED** when any claim FAILs; **INCONCLUSIVE** when nothing
failed but a claim could not be exercised; **FLAG** for any hack flag or a
proposed oracle change.

### 8. Cleanup
Kill every process you started, by PID, and stop any containers you brought
up. The `.verify/` directory survives cleanup; it is the deliverable.

## Report

End with the overall verdict, one line per claim (status, what was observed,
evidence path), any hack flags, and the path to `report.json`. Report failures
verbatim. The verdict comes from the evidence and nothing else.

## Maintaining this skill

- The verifier changes nothing outside `.verify/`. When its report shows launch
  discovery took real work (non-obvious command, port, seed data, auth fixture),
  the **author** writes or updates the target project's `.claude/verify-recipe.md`
  from the report's `environment` block: per app, the launch command, readiness
  route, port, required services, test credentials, and the 3–5 most important
  user-facing features. The next run starts from it.
- When a run hits a blocker this skill didn't anticipate (a framework that boots
  differently, a probe that gave a false PASS), fix it here so the next run
  doesn't trip on it.

## Known gaps

The read-only oracle is a rule, not a mechanism: nothing yet blocks a verifier's
Edit, Write or Bash from touching tests. Enforcing it needs a PreToolUse hook
covering every write path, Bash included. Background:
[verification-loop research](../../../docs/research/verification-loop-research.md).
