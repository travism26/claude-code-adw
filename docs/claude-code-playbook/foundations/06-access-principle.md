# 06 — The access principle

> **Foundations** · Previous: [Where steering lives](05-where-steering-lives.md) · Next: [Feature delivery](../plays/01-feature-delivery.md)

Most teams give an agent exactly one thing: the code. Then they spend their day being a relay —
copying an error out of a dashboard, pasting a failing build log into a chat, summarizing what a
monitor said, describing what the ticket asked for.

The human becomes a copy-paste layer between the agent and the information the agent needs. And
because copying is tedious, the human copies *less* than the full picture: the error but not the
surrounding trace, the failure but not the three preceding warnings, the ticket title but not the
comment thread where the requirement actually got decided.

The working rule:

> **An agent should be able to read whatever a human on the team can read — scoped, read-only,
> and audited.**

Logs. Dashboards and traces. Pipeline runs. The issue tracker. Meeting transcripts. Not because
more access is better in the abstract, but because every one of these is something a human
currently reads *and then retypes badly*.

---

## Why this is the highest-leverage chapter

The other foundations make an agent better at writing code. This one changes what an agent is
*for*.

An agent with code access can implement a ticket. An agent that can also read production
telemetry, the pipeline, and the conversation where the feature was discussed can do first-pass
incident triage, explain why the build broke, and notice that what the ticket asks for
contradicts what the customer actually said in the meeting.

Every play in the second half of this playbook is an application of this chapter. Without it,
they are all just "paste more context into the chat."

---

## The trade-off, stated honestly

Access is not free, and the cost is real rather than theoretical. Anyone evaluating this — a
security reviewer, a platform team, or the developer granting the access — is right to push on
it, and the argument below is the one that has to hold.

### What the cost actually is

**Expanded blast radius on credential compromise.** Every system the agent can reach is a system
reachable through the agent's credentials. This is not an AI-specific problem — it is true of any
CI runner or service account — but the surface is broader than most service accounts because the
agent is deliberately connected to many things.

**Sensitive data flows into context.** Production logs contain what production contains. Without
scoping, that means user identifiers, tokens in error payloads, and personal data landing in a
model context and possibly in a transcript that persists.

**Prompt injection through data the agent reads.** This is the genuinely new risk and it deserves
to be named, not buried. If the agent reads content that an outsider can influence — a log line
containing user-supplied text, a ticket comment, a support message — that content can attempt to
issue instructions. An agent that can *only read* is far less dangerous here than one that can
also act, which is most of why the rule says read-only.

**Auditability gets muddier.** "Who looked at that data?" has a less satisfying answer when part
of the answer is "an agent, on behalf of someone, at 2am."

### What the benefit actually is

**The relay disappears, and with it the transcription loss.** The agent sees the whole trace
rather than the line a human thought was relevant. Most of the value is in the part nobody
thought to copy.

**First-pass analysis happens before a human is involved.** A monitor fires at 3am; by the time a
human looks, there is already a summary of what changed, which service degraded first, and which
recent deployments correlate. The human starts at "is this analysis right?" rather than "what
happened?" — a much cheaper question.

**Judgment work stops being gated on retrieval work.** Debugging is mostly finding the relevant
information. When retrieval is instant, the expensive human hours go to deciding what to do.

**Intent stops getting lost.** A requirement discussed in a meeting and never written into a
ticket is invisible to everyone downstream. An agent that can read the transcript recovers it —
this is the entire basis of [product intake](../plays/02-product-intake.md).

### Does the benefit outweigh the cost?

**Yes, under scoping — and the scoping is what makes the answer yes.** Unscoped access does not
obviously win, and this playbook does not argue for it.

The comparison people usually make is wrong. The alternative to agent access is not "that data is
safe." It is a human reading the same data and pasting fragments of it into a chat window
manually, with less scoping, no audit trail, and no consistency. **The data was already flowing.
Granting deliberate, scoped, logged access frequently improves the security posture over the
status quo**, because it replaces an unmanaged path with a managed one.

The residual risk that genuinely remains after scoping is prompt injection via untrusted data,
and the mitigation is architectural rather than procedural: keep the reading agent read-only, and
keep a human at every point where something gets changed.

---

## The scoping rules

Six rules that turn the principle into something that holds up in a review.

**1. Read-only by default, and act only through a human.**
The agent reads telemetry and proposes; a human creates the ticket, approves the rollback,
triggers the deploy. This single rule collapses most of the risk, including the majority of the
prompt-injection surface.

**2. Never more than the human it works alongside.**
The ceiling is the access of the engineer whose work it supports. If an engineer cannot read that
database, neither can their agent. This is the rule that makes the principle defensible to a
security team: it grants no new capability to the organization, it just removes a human
bottleneck from an existing one.

**3. Scope narrowly, and by system rather than by role.**
Read-only telemetry for the services this team owns. Pipeline read for these repositories. Not
"observability access."

**4. Redact at the source, not in the prompt.**
Sensitive fields should be scrubbed by the logging pipeline before anything reads them. An
instruction telling the agent to ignore personal data is not a control. If your logs are not safe
for an agent to read, they were probably not safe for a laptop screen in an open-plan office
either — fixing that is a real benefit of doing this exercise.

**5. Separate credentials, and audit them.**
The agent gets its own identity, not a borrowed human one. Its reads are attributable and
reviewable, and it can be revoked in isolation.

**6. Treat everything read as untrusted input.**
Log lines, ticket comments and transcripts can contain text engineered to look like
instructions. The agent should treat retrieved content as *data about the world*, never as
direction. Combined with rule 1, an injection attempt becomes a wrong suggestion a human declines
rather than an action taken.

---

## Rolling it out

Do not attempt this as a single access-request ticket. It will be refused, and it should be.

**Start where the data is least sensitive and the payoff is most visible.** CI and build logs are
usually the right beachhead: rarely sensitive, immediately useful, and the win is legible to
everyone within a day.

**Add observability read next**, scoped to services the team owns, once the logging pipeline's
redaction has actually been checked rather than assumed.

**Add the issue tracker**, which is normally uncontroversial and unlocks the whole
[feature delivery](../plays/01-feature-delivery.md) play.

**Add meeting transcripts last**, because they are the most sensitive and the most political.
They contain unguarded speech, and people speak differently when they know a machine will read
it. That is a conversation to have with the team openly, not a permission to quietly enable.

Each step is separately justifiable and separately reversible. Once the CI step has shown its
value, the case for the next step makes itself, which is a considerably better position than
asking for everything upfront.
