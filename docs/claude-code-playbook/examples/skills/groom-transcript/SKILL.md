---
name: groom-transcript
description: Turn a meeting transcript into draft tickets plus a ranked list of ambiguities, by fanning out over the transcript in overlapping chunks and reconciling what was said against what the code actually does. Use after sprint planning, product planning, customer calls, or any meeting where requirements were discussed.
---

# Groom transcript

Reads a planning transcript, reconciles it against the codebase, and produces **draft tickets**
and **a ranked ambiguities list**.

**Adapt before use:** fill in the repository list, your tracker's ticket format, and your team's
labels.

## Why

A planning meeting produces a transcript nobody reads and tickets written from memory by whoever
took notes.

Headline decisions get captured. What gets lost is **the aside** — the half-sentence
qualification dropped while the conversation moved on. *"…and obviously that won't work for the
enterprise accounts, but anyway —"* Nobody wrote it down; it didn't feel like a requirement. It
gets discovered three weeks later by an engineer who now has to redesign something.

Filtering is what note-taking *is*. A machine reading the whole transcript doesn't filter.

## Inputs

- **Transcript**, ideally with speaker attribution and timestamps
- **Repositories** the discussion touches (read access)
- **Existing backlog**, to avoid duplicating open work

## Method

### Step 1 — Fan out over the transcript

Real planning transcripts run to thousands of lines. Reading one in a single session puts you
deep in the dumb zone before analysis begins, and the tail gets markedly worse treatment than the
head.

**Split by size and delegate each chunk to its own sub-agent with a fresh context.** The
orchestrator holds only the structured results.

**Overlap consecutive chunks by roughly 50–200 words.** This is the detail that makes it work.
Meetings don't segment cleanly — a requirement is stated at the end of one passage and qualified
at the start of the next, and a hard boundary cuts exactly the connection you needed. Overlapping
means every seam is read twice, from both sides, by agents that each see the full local context.

Deduplicating a requirement that surfaces twice is trivial. Recovering one that fell down a crack
is not.

Each chunk agent returns:

- **Requirements** — anything stated as something the product should do, with the verbatim quote
- **Decisions** — things settled, with who settled them
- **Rejections** — things explicitly ruled out, so they don't come back as tickets
- **Asides** — qualifications, caveats and constraints mentioned in passing, quoted with
  surrounding context
- **Open questions** — things the room raised and did not resolve
- **Speaker attribution** wherever available, so requirements have owners

### Step 2 — Reconcile against the code

The step that makes this more than transcript summarization, and where the value concentrates.

The transcript is **product-level truth** — what people want, in their language. The repositories
are **code-level truth** — what exists today. Neither alone produces a good ticket.

For each requirement, establish against the code:

- Does some version of this already exist?
- What would actually have to change — which modules, which contracts, which boundaries?
- Does it contradict something the system currently guarantees?
- Does it contradict something else agreed in the same meeting?
- Is it already covered by an open backlog item?

Delegate these lookups; they parallelize well.

A ticket written from the transcript alone says what someone asked for. A ticket written from
both says what was asked for, what exists, and what the gap is. The first needs research before
anyone can start. The second is startable.

### Step 3 — Emit two artifacts

**Draft tickets**, in the tracker's format: vertically sliced, sized to one session, blockers
declared, with the transcript quote that motivated each one and what the reconciliation found in
the code.

**A ranked ambiguities list** — the output people underestimate:

- Requirements too vague to build
- Direct contradictions between two things said in the meeting
- Requirements that conflict with existing system behavior
- Assumptions about things that exist and don't
- The asides, surfaced and quoted, flagged as possible requirements

Rank by *"how much would getting this wrong cost?"* and **cap the list** — see failure modes.

Attribute each question to whoever can answer it.

## Constraints

- **Separate decided from discussed.** Never flatten both into the backlog. Anything without
  evidence of agreement goes in a "raised, not decided" section, not into tickets.
- **Never invent a requirement.** Every ticket traces to a quote. If it can't, it goes in the
  ambiguities list as a question.
- **Quote, don't paraphrase**, for anything contested or surprising. Paraphrase is where
  intent quietly shifts.
- **Nothing is filed automatically.** Output is a draft for human approval. This was generated
  from a conversation by something that was not in the room.

## Failure modes

**Transcript quality is the ceiling.** Bad diarization and crosstalk degrade everything
downstream. If it can't tell who said what, requirements arrive without owners — say so in the
output rather than guessing.

**Over-production.** Unconstrained, this generates a ticket for every conversational gesture,
including ideas the room explicitly rejected. Require evidence of agreement.

**Padded ambiguities.** Forty questions is a list nobody reads, and an agent asked for questions
will always find more. Ask for the questions that would *change what gets built*, ranked, capped
at ten.

**Confident reconciliation.** "This already exists" is a claim that needs a file and a line, not
an assertion. Require evidence for every claim about current behavior.

## Before you turn this on

Recording meetings and feeding them to a machine is a **people decision before it is a technical
one**.

People speak differently when they know they're being processed — and the unguarded half-thought
is exactly what makes this valuable. Turning it on badly removes the benefit while keeping the
cost.

Have the conversation openly with the team beforehand: what's retained, for how long, who can
query it, what it's used for. Framed as *"the tickets will stop missing things you said"*, this
is usually welcomed. Discovered later, it's a trust problem that outlasts the tooling.
