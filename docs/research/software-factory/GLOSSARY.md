# Software factory research

The shared vocabulary for studying and building an autonomous development workflow. These terms are used across the research docs, the pilot log, and the future personal plugin.

## Checking work

**Check**:
A deterministic gate (types, lint, tests, static analysis) whose pass/fail the implementing agent cannot edit.
_Avoid_: Gate (alone), validation

**Verification**:
An agent that did not write the change runs the real application against claims fixed before the run and records evidence.
_Avoid_: Validation, testing, QA

**Verdict**:
The outcome of one verification, bound to the exact code it judged, with evidence attached.
_Avoid_: Result, report, sign-off

**Claim**:
One observable statement about the running application with an explicit expected observation, fixed before verification starts.
_Avoid_: Assertion, test case, acceptance criterion

**Review**:
An agent or human reads the diff for quality and fit to the spec, without running the application.
_Avoid_: Verification, code check

## Roles

**Author**:
The agent that wrote the change. It never produces the Verdict on its own work.
_Avoid_: Worker, implementer, owner

**Verifier**:
The agent that runs the application and produces the Verdict, with no write access to the code or the claims.
_Avoid_: Grader, judge, tester
