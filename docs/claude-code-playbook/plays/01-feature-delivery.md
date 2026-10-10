# Play 01 — Feature delivery

> **Plays** · Next: [Product intake](02-product-intake.md) · Foundations: [Session lifecycle](../foundations/03-session-lifecycle.md), [Where steering lives](../foundations/05-where-steering-lives.md)

**When to reach for it:** a piece of work too large or too uncertain to finish well in one
session. A feature touching several layers, a refactor crossing the codebase, anything where you
cannot confidently describe the finished state in a sentence.

**When not to:** see [the threshold](#the-threshold-when-not-to-use-this) below. This play has
real ceremony and applying it to small work makes things worse, not better.

**Access needed:** the repository, and an issue tracker the agent can read and write.

**Human stays in the loop at:** the grilling, approving the spec, approving the ticket
breakdown, and merge.

---

## The shape

```
  grill  ──▶  spec  ──▶  tickets  ──▶  implement  ──▶  review
              │            │              │
         destination    journey      one session
                                       per ticket
```

Two documents come out of the front half. A **spec** fixes the destination. **Tickets** describe
the journey, one per session. The back half is a loop over tickets.

---

## 1. Grill

Do not start by asking for a plan. Start by being interrogated.

A grilling session is an agent asking you questions about what you actually want, in rounds,
until the ambiguity is gone. It works because the questions surface decisions you did not know
you were making — and because it is far cheaper to discover a contradiction in conversation than
in code.

The move that makes it effective: **the agent should find facts itself and only ask you about
decisions.** If a question can be answered by reading the codebase, checking the config, or
searching the docs, it is not a question for you. Your input is required for choices, not for
lookups.

Expect this to take longer than feels reasonable, and expect at least one round to change your
mind about scope. If nothing changed your mind, the grilling was too gentle.

## 2. Spec

The spec captures the destination:

- **Problem statement** — from the user's perspective, not the system's
- **Solution** — also from the user's perspective
- **User stories** — a long numbered list, `As an <actor>, I want <feature>, so that <benefit>`
- **Implementation decisions** — modules and interfaces to be built or changed, architectural
  choices, schema changes, API contracts, the technical clarifications that came out of grilling
- **Testing decisions** — what gets tested and at which seams
- **Out of scope** — explicit, and load-bearing; this is what stops scope creep later
- **Further notes**

**No file paths, no code snippets.** They are the fastest-rotting content you can put in a
document, and their presence tempts the implementer to follow the spec's stale guess instead of
reading the code.

The spec goes in the issue tracker, not the repository. It gets passed to every session working
on the feature, and it is the oracle the final review checks against.

## 3. Tickets

Break the spec into units, one per session. The single decision that matters here is how you
slice.

**Vertical, not horizontal.** An agent left to itself will slice by layer — schema first, then
service, then interface — because it looks organized. It is the classic trap: nothing is proven
to integrate until the last phase, so every design mistake in phase one surfaces in phase three,
when it is most expensive.

A vertical slice cuts through every layer and delivers a narrow but complete path. The first
ticket is a tracer bullet: thin, end-to-end, integrated. Every subsequent ticket widens something
already proven to work.

Say the words "vertical slices" to the agent explicitly. The concept long predates AI and models
already understand it.

**Size each ticket to one session's smart zone**, and check the breakdown yourself before
proceeding — this is a two-minute review that saves hours. If a ticket looks like it is trying to
do too much, split it. Independent support for keeping units small is in
[session lifecycle](../foundations/03-session-lifecycle.md); Google's review guidance and DORA's
batch-size research both land in the same place from entirely different directions.

## 4. Implement

One ticket, one session, starting fresh.

Give the session the ticket and the spec. It needs the destination to understand how its slice
contributes; it needs the ticket to know what it is doing today.

Test-first where there is a seam worth testing. Agree the seams before writing tests rather than
testing everything — tests belong at public boundaries, never against internals. Two
anti-patterns to name explicitly, because agents produce both readily:

- **Implementation-coupled tests**, which assert on internals and break on every refactor while
  catching nothing
- **Tautological tests**, where the expected value is recomputed the way the code computes it —
  `expect(add(a, b)).toBe(a + b)`. It passes by construction and can never disagree with the
  code. Expected values must come from an independent source: a known-good literal, a worked
  example, the spec

Run the cheap checks constantly — typecheck and the single relevant test file. Run the full suite
once at the end.

**Then run the thing.** Start the app, exercise the path, look at it. Vendor practice is explicit
about this step — Cognition describes Devin spinning up the app, clicking through it, and
confirming its changes actually work. A diff that looks right is not evidence.

## 5. Review

Two axes, run separately in fresh contexts: **standards** and **spec**. The full argument for why
they are separate, why the reviewer must not be the author, and why review is the correct home
for coding standards is in [where steering lives](../foundations/05-where-steering-lives.md).

Then close the ticket, decide whether to clear or continue, and take the next one.

---

## Specs are disposable: the position on spec-driven development

This is where this playbook takes a deliberate position, and it is the one most likely to come up
in conversation with a team already doing spec-driven development.

**Work is driven from specs. Specs are not a source of truth.**

Once a spec is implemented, close it. Do not keep it in the repository as living documentation of
how the system works.

The reasoning is the primary/secondary source distinction. The **codebase is the primary source**
— the executable parts of a system do not lie about what the system does. A **spec is a secondary
source**: a projection, a summary, accurate at the moment it was written.

Secondary sources drift, and the drift is silent. Nobody updates a spec when they change the code
six months later; there is no check that fails.

The failure this produces is specific and worth stating precisely, because it is the part people
underestimate. **An exploring agent will prefer the stale spec over the accurate code.** The spec
is smaller, denser, better organized, and directly answers the question. The code is verbose and
requires work. Given both, the agent reads the one that is easier to read — and confidently
implements against a description of a system that no longer exists.

So a persisted spec is not neutral documentation that has gone slightly out of date. It is an
attractive nuisance that actively outcompetes the truth.

**Archive rather than delete.** Closing a spec in a tracker moves it out of the default view
while keeping it findable. If someone later asks why something was built this way, the reasoning
is there. It is out of the agent's exploration path but not gone.

**Where this differs from spec-driven development:** the disagreement is narrower than it
first appears. Both agree work should be specified before it is built. The disagreement is only
about what happens to the document *afterwards* — whether it becomes a durable artifact the
system is expected to conform to, or a scaffold removed once the building stands. The drift
failure described above is the concrete reason to prefer the scaffold; anyone who has run
spec-driven development for a while has probably already been bitten by it.

There is a related finding worth keeping in mind: hands-on trials of
spec-driven approaches have repeatedly observed agents not following all the instructions in the
specs they were given, and named the resulting comfort a **false sense of control**. A spec is
advisory. Checks are binding. Write the spec as the review oracle, and let machine-verifiable
checks carry the enforcement.

---

## The threshold: when *not* to use this

The best-documented failure of spec-driven work is not that it does not work. It is ceremony
applied below the threshold where it pays.

Thoughtworks' hands-on trial watched a small bug expand into four user stories with sixteen
acceptance criteria. Separate practitioner trials measured roughly ten times slower for
equivalent quality on small work. Even AWS Kiro's own documentation concedes that a quick chat
fix is fine for straightforward issues.

**Match the artifact weight to the change.** This play is for work large or uncertain enough that
the destination genuinely needs writing down. Below that line — a bug fix, a copy change, a
one-file adjustment — just do the thing. The verification still applies. The paperwork does not.

If you cannot say what the second ticket would be, you do not have a multi-ticket piece of work.

---

## Rerouting when the destination changes

Two tickets in, you realize the approach is wrong. This is normal and the two-document structure
exists precisely to make it cheap.

**Tickets are disposable. The spec is editable.**

1. Delete the unimplemented tickets. Keep the implemented work unless it is genuinely bad.
2. Go back to the spec and grill again — in a fresh session — about what you have learned.
3. Edit the spec. The destination has moved.
4. Regenerate tickets from where you actually are, not from where you started.
5. Continue.

The reason this is clean is that the two documents have different lifetimes. Had the destination
and the journey lived in one document, changing direction would mean surgery on a file that is
simultaneously the plan of record and the thing you are revising.
