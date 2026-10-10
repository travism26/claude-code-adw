# Play 02 — Product intake

> **Plays** · Previous: [Feature delivery](01-feature-delivery.md) · Next: [Incident response](03-incident-response.md) · Foundations: [The access principle](../foundations/06-access-principle.md), [Orchestration and delegation](../foundations/04-orchestration-and-delegation.md)

**When to reach for it:** after any meeting where what the product should do got decided —
sprint planning, product planning, a customer call, a refactor discussion. Anywhere the room
contained the intent and the tracker is about to receive a lossy summary of it.

**Access needed:** the meeting transcript, read access to the repositories the discussion
touches, and write access to the issue tracker.

**Human stays in the loop at:** approving the tickets, and answering the questions the play
surfaces.

---

## The problem this solves

A planning meeting produces a transcript that nobody reads and a set of tickets written from
memory by whoever was taking notes.

The gap between those two things is where projects go wrong. Not the headline decisions — those
get captured. What gets lost is **the aside**: the half-sentence qualification someone dropped
while the conversation was moving elsewhere.

> "…and obviously that won't work for the enterprise accounts, but anyway —"

Nobody wrote that down. It did not feel like a requirement; it felt like a caveat. It is
discovered three weeks later, during implementation, by an engineer who now has to redesign
something.

Asides are load-bearing far more often than their delivery suggests, and they are exactly what a
human note-taker filters out — because filtering is what note-taking *is*. A machine reading the
full transcript does not filter.

---

## The method

### Step 1 — Fan out over the transcript

A real planning transcript is long, often thousands of lines. Reading it in one session puts you
deep in the dumb zone before analysis begins, and the tail of a long transcript gets markedly
worse treatment than the head.

So split it. **Size the fan-out to the transcript**: chunk it and give each chunk to its own
sub-agent with a fresh context window. Each returns a structured extraction; the orchestrator
holds only the results. This is [containment](../foundations/04-orchestration-and-delegation.md)
doing exactly what it is for.

**Overlap the chunks by roughly 50–200 words.** This is the detail that makes it work. Meetings
do not segment cleanly — a requirement gets stated at the end of one passage and qualified at the
start of the next, and a hard boundary between chunks cuts precisely the connection you needed.
Overlapping seams means every boundary is read twice, from both sides, by agents that each see
the full local context. Deduplicating a requirement that surfaces twice is trivial. Recovering
one that fell down a crack is not.

### Step 2 — Read the code alongside it

This is the step that separates the play from transcript summarization, and it is where the value
concentrates.

The transcript is **product-level truth**: what people want, in the language they want it in. The
repositories are **code-level truth**: what actually exists today. Neither alone is enough to
write a good ticket.

Cross-reference them. For each requirement the transcript produced, establish against the code:

- Does some version of this already exist?
- What would actually have to change — which modules, which contracts, which boundaries?
- Does this contradict something the system currently guarantees?
- Does it contradict something else agreed *in the same meeting*?

A ticket written from the transcript alone says what someone asked for. A ticket written from
both says what someone asked for, what exists, and what the gap is. The second is a ticket an
engineer can start; the first is a ticket an engineer has to research before starting.

### Step 3 — Emit two things

**Tickets**, in the tracker, in the shape the delivery play expects — vertically sliced, sized to
a session, blockers declared.

**And an ambiguities list**, which is the output people underestimate. Every question the
reconciliation raised and could not answer:

- Requirements stated too vaguely to build
- Two statements in the meeting that contradict each other
- A requirement that conflicts with existing system behavior
- Something assumed to exist that does not
- The asides — surfaced, quoted with their surrounding context, flagged as possible requirements

The framing matters: these are **questions raised before implementation rather than discovered
during it.** That is the entire economic argument for this play. An ambiguity resolved in a
five-minute reply costs five minutes. The same ambiguity discovered mid-implementation costs a
redesign, and discovered after release costs considerably more.

---

## Why this is worth building

Three things compound here that do not compound separately.

**Nothing is filtered.** The full transcript is read by something with no fatigue and no opinion
about what is important. Recall goes up in exactly the category humans are worst at.

**Intent meets reality automatically.** The reconciliation step is work someone was going to do
anyway — usually the engineer who picks up the ticket, days later, without the meeting context.
Doing it at intake means it happens once, with the full transcript available, rather than N times
with only the ticket title.

**Ambiguity surfaces at its cheapest moment.** Immediately after the meeting, when everyone still
remembers what they meant and the people who can answer are still thinking about it.

---

## Failure modes

**Transcript quality is the ceiling.** Bad diarization, crosstalk, and unattributed speech
degrade everything downstream. If the transcript cannot tell who said what, requirements arrive
without owners.

**It over-produces.** Left unconstrained, the play generates a ticket for every conversational
gesture, including the ideas the room explicitly rejected. Constrain it: require evidence of
agreement, and have it separate *decided* from *discussed* rather than flattening both into the
backlog.

**The ambiguities list can pad.** A list of forty questions is a list nobody reads. Ask for the
questions that would change what gets built, ranked, and cap the count. An agent asked for
questions will always find more.

**Tickets still need a human.** This play produces a strong draft, not an approved backlog.
Everything in it was generated from a conversation by something that was not in the room.

---

## The precondition nobody warns you about

Recording meetings and feeding them to a machine is a **people decision before it is a technical
one**.

People speak differently when they know they are being processed. The unguarded half-thought that
makes this play valuable is exactly the thing that stops being said once the room feels
surveilled — which would remove the benefit while keeping the cost.

Have the conversation with the team openly, before turning it on rather than after. Be specific
about what is retained, for how long, who can query it, and what it is used for. Introduced as
*"the tickets will stop missing things you said"*, this is usually welcomed. Discovered later, it
is a trust problem that will outlast the tooling.

This is the most sensitive step in [the access principle](../foundations/06-access-principle.md)
and it is deliberately sequenced last there.

---

A skill template implementing this play is in
[`../examples/skills/groom-transcript/SKILL.md`](../examples/skills/groom-transcript/SKILL.md).
