# Agentic Developer Workflow

The harness that turns a unit of planned work into a reviewed draft PR. This glossary fixes the words
for what goes in, what the agent produces along the way, and what the result is judged against. The
Spec and Ticket definitions follow the [playbook glossary](docs/claude-code-playbook/glossary.md).

## Language

### Planned work

**Spec**:
The destination document for multi-session work: problem, solution, user stories, decisions, and
what "done" looks like, with no file paths. Disposable: archived once the work is in code.
_Avoid_: PRD, master spec, design doc

**Ticket**:
One vertical slice of a Spec, sized for a single session, with acceptance criteria and the Tickets
that block it. It is the unit of work a run accepts.
_Avoid_: task, issue (the tracker's word, not ours), slice spec, milestone spec

**Epic**:
A tracker issue that organises a body of work and, once grilled, points at its Spec. An Epic carries
no review weight of its own; only the Spec it points at does.
_Avoid_: using "epic" and "spec" interchangeably

**Ready**:
A Ticket labelled `ready-for-agent`: fully specified and safe for an unattended run. Anything else,
including an Epic or a `ready-for-human` issue, is not runnable.

**Blocker**:
A Ticket that must be closed before another Ticket may start.

**In progress**:
A Ticket labelled `in-progress`: a run or session has claimed it and is working on it. A run adds
the label when it starts, an interactive session as its first tracker write; only a human removes
it. A fresh run refuses an In progress Ticket.
_Avoid_: claimed, assigned (assignment is not the claim)

**Frontier**:
The Ready Tickets of a Spec whose Blockers are all closed and which are not In progress: the work
that can run right now, in parallel.

### Produced by a run

**Plan**:
The agent's own disposable "how" for one Ticket: files to touch, steps, validation commands.
Written by the plan phase every run; never a review source.
_Avoid_: spec, spec file

### Judging the result

**Review oracle**:
What a run's work is judged against: the Ticket's acceptance criteria first, the parent Spec for
scope creep and contradicted decisions. Never the Plan.
