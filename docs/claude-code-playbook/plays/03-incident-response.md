# Play 03 — Incident response

> **Plays** · Previous: [Product intake](02-product-intake.md) · Next: [Debugging](04-debugging.md) · Foundations: [The access principle](../foundations/06-access-principle.md)

**When to reach for it:** a monitor fires, an alert pages, an error rate moves, a customer
reports something broken in production.

**Access needed:** read-only telemetry — logs, traces, metrics, dashboards — for the services the
team owns. Read access to recent deployments and the pipeline. Nothing that can change anything.

**Human stays in the loop at:** every decision. This play produces analysis, never action.

---

## The idea

An alert fires at 03:00. Someone is woken up, opens a laptop, and spends the first twenty-five
minutes doing pure retrieval: which service, which error, when did it start, what deployed
recently, is it still happening, how many users.

None of that is judgment. All of it is looking things up under time pressure, badly, on a phone
screen, half asleep.

**Trigger a first-pass analysis at the same moment the alert fires**, so that the human who
arrives finds the retrieval already done and starts at the question that actually needs a human:
*is this analysis right, and what do we do?*

The play does not resolve incidents. It removes the retrieval phase from the critical path.

---

## What the first pass produces

A short, structured brief. The constraint is that it must be readable on a phone in ninety
seconds, which is a real design constraint and not a stylistic one.

- **What fired, and what it means in plain language.** The monitor's name is not the symptom.
- **When it started**, and whether it is ongoing, worsening, or already recovering.
- **Blast radius** — which service, which endpoints, error rate, roughly how many users, and
  whether it is degradation or hard failure.
- **What changed recently.** Deployments, config changes, feature flags, infrastructure events in
  the preceding window. Correlation is not causation and the brief should say so, but this is the
  first thing a human would check and it is pure lookup.
- **The actual errors.** Representative traces and stack frames, not a count. The specific
  exception, from the real trace.
- **Related signals.** Did something upstream degrade first? Is a dependency slow? Did anything
  else move at the same moment?
- **Prior occurrences.** Has this alert fired before, and what happened then?
- **Candidate hypotheses, ranked, with the evidence for and against each** — and explicitly
  labeled as hypotheses.

Then it stops. It does not roll back, restart, scale, or open anything.

---

## Read-only is not a limitation, it is the design

The temptation to let the agent act is strongest here, because the actions are so mechanical.
Roll back the deploy. Restart the pod. It would save minutes at exactly the moment minutes are
expensive.

Do not.

**The judgment is the entire job.** Deciding whether to roll back is not mechanical — it depends
on what else shipped in that deploy, what is mid-migration, what a rollback would do to data
written since, and what else is going on that nobody told the agent about. An agent acting on a
plausible-but-wrong hypothesis during an incident turns one problem into two, in the window where
you can least afford it.

**And the injection surface is real.** Production logs contain user-supplied text. An agent that
reads logs *and* acts is an agent whose actions can be influenced by whoever can get text into
your logs. Keeping it read-only reduces a live security concern to a wrong suggestion that a
human declines — see [the access principle](../foundations/06-access-principle.md).

The failure mode of a read-only agent is a brief you disagree with, which costs thirty seconds.

---

## After the incident

Two follow-ons where the same access pays again, this time without time pressure.

**Draft the postmortem.** The timeline is the tedious part and it is pure reconstruction from
data the agent can read: when it started, when it was detected, when it was acknowledged, what
was tried, when it recovered. Hand a human a populated timeline and they can spend their
attention on contributing factors and remediation, which is the part worth a human.

**Turn findings into tickets.** Remediation items get written while everyone still remembers,
with the trace evidence attached. A human approves them, per the access principle — but the draft
is written and evidenced rather than remembered.

There is a broader habit worth adopting here, from observability practice: ask **"how will I know
if this is broken?"** of every change, at review time. The answer — a metric, a log line, a trace
— is a concrete instrument, and requiring it up front means the instrumentation exists before the
incident that needs it rather than being added afterwards.

---

## What has to be true first

**Telemetry has to be greppable.** Structured, leveled, consistently shaped, with enough context
to filter. If a human cannot reconstruct an incident from the logs, neither can an agent — this
play does not fix bad observability, it rewards good observability.

**Requests have to correlate across service boundaries.** A request that crosses two services
should carry an identifier that appears on both sides, so one query reconstructs the journey.
Prefer the W3C Trace Context `traceparent` header over a homegrown identifier; existing tooling
already speaks it. Most integration failures live exactly at these seams.

**Logs have to be quiet when healthy.** If a normal run emits hundreds of warnings, "anything
unexpected" is not a signal anyone can use. Signal-to-noise is the property that matters, not
volume — and it is the property that determines whether this play produces insight or a summary
of your log spam.

**Sensitive fields have to be redacted at source**, before anything reads them. Not by
instruction, by pipeline.

Teams often find that setting this play up surfaces observability problems they already had.
That is not a detour — a first-pass analysis is only as good as the instrument it reads, and the
work has value whether or not you ever point an agent at it.
