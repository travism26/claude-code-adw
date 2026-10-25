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

## Factory structure

Adopted from Matt Pocock's `software-factory` skill ([dissection](dissections/matt-pocock/software-factory-skill.md)). Terms name roles, not machines: one product can fill several slots. His three brakes map onto ours: "automated checks" are Checks, and "automated review" and "human review" are both Review. Verification is a brake his list doesn't have.

**Task**:
A kind of work the factory performs, defined once and run many times: explore, implement, review, ratchet. It may work on a ticket, a PR or the whole codebase.
_Avoid_: Job, workflow, action

**Trigger**:
The event that starts a Run: a change in the Ticket tracker or Git host, a clock in the Orchestrator, or another Run.
_Avoid_: Hook, event source

**Run**:
One execution of a Task on one Runner, from its Trigger to its finish, treated as a black box that may contain several agent sessions. It never waits for a human: it ends, and the human's later change triggers a new Run.
_Avoid_: Session, job

**Runner**:
The disposable machine a Run executes on. Nothing on it survives the Run, so a Run's only memory is the Ticket tracker, the Git host and the Orchestrator.
_Avoid_: Server, host, box, sandbox

**Ticket tracker**:
Where tickets live, and the factory's human interface: humans file tickets, answer agents in comments, and their changes trigger Runs.
_Avoid_: Issue tracker, project board

**Ticket source**:
Anything outside the factory that creates tickets in the Ticket tracker: a feedback button, a monitor, an error tracker.
_Avoid_: Intake, data source

**Git host**:
Where branches, PRs and reviews live.
_Avoid_: Forge, code host, repo

**Orchestrator**:
The component that receives Triggers, starts Runs on Runners, and records which Runs are queued, in flight or finished.
_Avoid_: Dispatcher, scheduler, control plane

**Observability platform**:
Where Runners send logs, traces and status so a human can see inside each Run. Optional, since the Runner's or Orchestrator's own run pages often suffice.
_Avoid_: Monitoring, dashboard, logs
