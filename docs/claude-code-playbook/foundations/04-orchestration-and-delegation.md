# 04 — Orchestration and delegation

> **Foundations** · Previous: [Session lifecycle](03-session-lifecycle.md) · Next: [Where steering lives](05-where-steering-lives.md)

The default way to use a coding agent is to have one session do everything: explore the
codebase, read the files, write the code, run the checks, fix what broke. Every one of those
steps deposits its output permanently into the same context window.

Exploration is the expensive one. Finding where something lives can mean reading a dozen files to
use two of them — and the ten you did not need stay in context for the rest of the session,
competing with everything that comes after.

The alternative is to treat the main session as an **orchestrator**: it holds the plan and the
judgment, and hands executable work to **sub-agents** that each get their own fresh context
window.

---

## The primary benefit is containment, not cost

This gets stated backwards almost every time, so it is worth being precise.

When a sub-agent does a task, everything it touches — every file read, every search, every
command output, every wrong turn — lives in *its* context window. What comes back to the
orchestrator is the final report. Ten thousand tokens of exploration return as a paragraph.

**The orchestrator's context is the scarce resource, and delegation is how you spend someone
else's.** That is the point. A sub-agent running on the *same* model with the *same* pricing is
still a large win, because it protects the one context window whose quality determines everything
downstream.

Cost savings from routing sub-agents to cheaper models are real and worth having. They are the
second benefit. Leading with them causes people to conclude delegation is a budget optimization
they can skip if they are not cost-sensitive, which is exactly wrong.

---

## Model tiering

Once work is delegated, you can match the model to the task:

| Tier | Use for | Examples |
| --- | --- | --- |
| **Strongest** | Judgment-heavy work: synthesis, ambiguous research, adversarial review, anything user-facing | Design synthesis, reviewing another agent's diff, deciding an approach |
| **Mid** | Well-specified implementation with a mechanical pass/fail check | Endpoints from an agreed contract, screens from a wireframe, migrations |
| **Cheapest** | Trivial and fully specified | Version checks, file inventories, mechanical renames, config edits |

The table is not the useful part. This is the rule that makes it safe:

> **If you cannot write a check that proves the work is correct, do not send it below the top
> tier.**

That single sentence does all the work. It converts an unanswerable question ("is this task hard
enough to need the good model?") into an answerable one ("can I state, right now, the command
that will tell me whether this came back correct?"). If the answer is a typecheck plus a named
test, delegate it down. If the answer is "I'd have to read it and judge," it stays at the top.

The rule degrades safely. Misjudging a task means a cheaper agent fails a check you already
wrote, and you find out immediately.

---

## The six rules

**1. Background by default; parallel when independent.**
Launch independent agents together rather than in sequence. Sequence only through real
dependencies — a contract has to exist before two agents build against it. Don't poll for
completion; do other work and handle results as they arrive.

**2. Contract first, when work runs in parallel.**
Before two agents touch adjacent ground, pin the interface between them in a document they both
read. Then give each an explicit **file ownership list**: the files it creates, and the files it
must not touch — naming the other agent's territory directly.

Parallel agents do not fail by writing bad code. They fail by both writing plausible code against
incompatible assumptions, which surfaces at integration, at the worst moment.

**3. Every prompt is self-verifying.**
An implementation prompt ends with the checks the agent must actually run and the shape of the
report it must return. **An agent that did not run its checks is not done**, whatever its summary
claims. This is what makes tiering safe — without it, a cheaper model produces confident prose
about work it did not verify.

**4. Persist everything.**
Research goes to a research file, decisions to a decision record, contracts to a shared document.
The agent's final chat report is a summary — never the only copy. A sub-agent's context is
discarded when it finishes; anything not written down went with it.

**5. Review before building on top.**
When a cheaper agent lands code, the orchestrator reviews the diff before anything is built on
it. Compounding on unreviewed work is how one bad assumption becomes five files.

If an agent was interrupted, **verify what it actually wrote** before relaunching. Do not assume
a clean workspace — assume a partial one.

**6. State the guardrails explicitly.**
Anything with real consequences — data that must not be modified, systems that must not be
touched, credentials that must not leave a boundary — is stated in the prompt, every time. A
sub-agent has no memory of your standing conventions and no access to the conversation where you
established them.

---

## The prompt skeleton

Every delegation prompt contains the same six parts, in order:

1. **Role and location** — what this agent is and where it is working
2. **Read first** — the specific files it should read before doing anything
3. **Hard constraints** — file ownership, do-not-touch, invariants that must hold
4. **Numbered deliverables** — what must exist when it finishes
5. **Verification steps** — the checks it must run, named explicitly
6. **Report shape** — the format of the summary it returns

The skeleton is worth following even when it feels like overkill. Its parts each prevent a
specific failure: no "read first" produces an agent that reinvents what exists; no ownership list
produces collisions; no verification produces confident garbage; no report shape produces a
narrative you have to re-read the diff to interpret.

A worked example is in [`../examples/skills/delegate/SKILL.md`](../examples/skills/delegate/SKILL.md).

---

## Where this stops working

Delegation is not free and it is not always right. Three limits worth stating.

**Judgment does not delegate.** If the task requires knowing what the user actually meant, or
weighing an ambiguous trade-off, a sub-agent with a fresh context does not have what it needs. It
will produce something confident and plausibly wrong. Delegate execution, keep judgment.

**Delegation has overhead.** Writing a good prompt costs real effort. For a task you could do in
two minutes, the prompt costs more than the task. The break-even is roughly: would this involve
substantial exploration, or several files, or work I would otherwise do while the main thread
waits?

**Unattended loops are a different thing entirely, and their limits are stated plainly by the
people who build them.** Fully autonomous ticket loops describe nondeterminism as their Achilles'
heel, warn that you should expect to occasionally wake up to a broken codebase, and — from their
own authors — recommend against running them in existing codebases at all.

The mode this playbook advocates is **attended**: delegate the work, gate between units, keep a
human at the decision points. That keeps the throughput benefit without betting the codebase on
an agent's judgment while nobody is watching. The distinction is not cosmetic, and it is worth
being clear about when someone asks whether this workflow "runs itself." It does not, and the
version that tries has a documented failure mode.
