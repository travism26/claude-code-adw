# 03 — Session lifecycle

> **Foundations** · Previous: [The context diet](02-context-diet.md) · Next: [Orchestration and delegation](04-orchestration-and-delegation.md)

A session is the unit of work. It starts empty, fills as it goes, and at some point you have to
decide what happens next. Most people never make that decision explicitly — they keep typing
until something feels wrong, then start over.

Making the decision deliberately is most of the discipline.

---

## The three options

At the end of any meaningful chunk of work, you have exactly three moves.

**Continue.** Keep the session. Correct when you have smart zone left *and* the context you are
carrying is relevant to what comes next. Both conditions matter — a session with plenty of room
but full of irrelevant history is worse than a fresh one, because the irrelevant history competes
for attention with the instructions that matter.

**Compact.** Summarize the history in place and carry on. Preserves continuity at the cost of
fidelity: the summary is a lossy projection, and the things it drops are chosen for you. Correct
when the context is genuinely still relevant but there is too much of it — you want what the
session *learned*, not the transcript of it learning.

**Clear.** End it, start fresh. The cheapest and fastest way back to a full smart zone. Correct
when the work you are about to do does not depend on the conversation you just had, or when
everything worth keeping has already been written down somewhere durable.

---

## The decision, in order

Ask these in sequence and stop at the first one that decides it:

1. **Is what I'm about to do a different kind of work than what I just did?**
   → Clear. Relevance beats continuity. Debugging a production incident after finishing a feature
   spec shares nothing but the repository.

2. **Has everything durable been written down outside the session?**
   → Clear. See below — this is the condition you can engineer.

3. **Am I still in the smart zone, with relevant context?**
   → Continue. Don't reset a session that is working.

4. **Is the context relevant but bloated?**
   → Compact. This is the narrow case where compaction genuinely wins.

5. **Otherwise** → Clear. When in doubt, clear. The cost is re-exploration; the cost of the
   alternative is degraded judgment you cannot see.

The bias toward clearing is deliberate. Clearing has a visible, bounded cost — the agent re-reads
some files. Staying too long has an invisible, unbounded one.

---

## Why clearing is cheap: handoff artifacts

Clearing only feels expensive when the session is the only place your thinking exists. Fix that
and the calculus changes completely.

A **handoff artifact** is anything durable that carries knowledge between sessions by living
outside the context window:

- A **spec** — where the work is going and what done looks like
- **Tickets** — the sliced journey to get there
- **Decision records** — the choices made and why, so they are not silently re-litigated
- **Standards files** — the conventions the reviewer enforces
- **Research notes** — findings that would otherwise need rediscovering

Once the planning conversation has been distilled into a spec and a set of tickets, the
conversation itself is **strictly redundant**. It is a longer, less organized version of documents
you now have. Keeping it costs smart zone and buys nothing.

That is the whole trick, and it is worth stating plainly because it inverts the intuition: **you
are not preserving context by keeping a session alive. You preserve context by writing it down
and throwing the session away.**

Anything you are reluctant to clear is telling you something did not get written down. That
reluctance is a useful signal — treat it as a prompt to produce the artifact, not as a reason to
keep the session.

---

## Where the artifacts live

Handoff artifacts belong **outside the repository working tree**, in whatever issue tracker the
team already uses.

Three reasons, in increasing order of importance:

**They survive your local setup.** Branches, worktrees, machines, reinstalls. State that lives in
a local file collides with the very workflow it is supposed to support.

**They are the team's, not yours.** A spec in a tracker is reviewable, commentable, and findable
by someone who was not in the room. The same spec as a local markdown file is a private note.

**Closing one archives it.** A completed spec drops out of the default view but remains findable
if someone later asks why something was built the way it was. That is exactly the lifecycle you
want, and it is the mechanism that lets specs be disposable without being destroyed. The
reasoning behind that is in [Feature delivery](../plays/01-feature-delivery.md).

Any tracker works. The requirement is that the agent can read and write it directly, without a
human relaying contents — which is [the access principle](06-access-principle.md) applied to
work items.

---

## Sizing work to the session

The lifecycle decision gets much easier if the work was sized correctly to begin with. A ticket
scoped to a single session means the answer at the end is nearly always "clear, take the next
one."

There is independent support for keeping the units small, from a direction that has nothing to do
with context windows. Google's code review guidance puts a reasonable changelist at around 100
lines and describes ~1000 as usually too large, advising that *when in doubt, write changes
smaller than you think you need*. DORA's research goes further for this specific situation,
framing small batches as a safety net for AI adoption — a counterweight to the delivery
instability associated with AI-accelerated code production.

Two independent traditions — one about human review capacity, one about delivery stability —
arrive at the same place as the context argument: **smaller units, more often.** When three
unrelated lines of reasoning converge, the practice is probably not an artifact of any one of
them.

---

## The failure mode this prevents

The characteristic bad session is long, and it feels productive throughout.

It starts well. Somewhere past the middle the agent begins re-reading files it has already read,
because the earlier read has been crowded out. It restates decisions slightly differently than it
made them an hour ago. It proposes something you explicitly ruled out. Asked to fix a small
thing, it makes a change that quietly contradicts something from earlier in the same session.

None of these register as failure in the moment. Each looks like a small correction. The session
ends with something that works, and the cost — the design that got worse, the decision that got
reversed without anyone noticing — is invisible because there is nothing to compare against.

You will not catch this by watching for it. The only reliable defense is structural: size the work
to the session, write down what matters, and clear.
