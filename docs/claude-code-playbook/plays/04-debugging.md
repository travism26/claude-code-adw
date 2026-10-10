# Play 04 — Debugging

> **Plays** · Previous: [Incident response](03-incident-response.md) · Next: [CI and build feedback](05-ci-and-build-feedback.md) · Foundations: [Session lifecycle](../foundations/03-session-lifecycle.md)

**When to reach for it:** something is broken and you do not know why. A test fails
inexplicably, behavior contradicts the code, a regression appeared with no obvious cause,
something is slow and it did not used to be.

**Access needed:** the repository, the ability to run the code, and the logs.

**Human stays in the loop at:** approving the fix. Optionally at hypothesis selection, when the
search space is large.

---

## Why this is a separate play

[Feature delivery](01-feature-delivery.md) has a known destination. You write it down, slice the
route, and walk it.

Debugging has an **unknown destination**. You cannot spec what you do not understand. Applying
the feature workflow here produces a confident plan to fix a cause that has not been established
— which is the characteristic way agent debugging goes wrong.

The unit of progress is not a completed ticket. It is **an eliminated hypothesis.**

---

## The loop

**1. Reproduce it first, deterministically.**

Nothing else counts until this exists. Without a reproduction you cannot tell a fix from a
coincidence, and every subsequent step is guessing.

If it only reproduces sometimes, that is the bug you are working on now. Intermittency is
information — it usually means timing, ordering, state left over from something else, or an
environmental dependency — and chasing the symptom while the reproduction is unreliable wastes
the whole session.

**2. Establish what is actually true.**

Not what the code appears to do — what it does when it runs. Instrument it. Log the values.
Assert the invariant you believe holds and watch it fail.

This is where agents are strongest and most underused. Adding twenty log statements across six
files, running it, reading the output and removing them is tedious for a human and trivial to
delegate. It is also, very often, the entire debugging session.

**3. Form hypotheses, ranked, and say what would disprove each.**

The discipline is the second half. A hypothesis without a disproof is a belief, and an agent with
a belief will find support for it.

Force the shape: *"If X is the cause, then Y must be observable. Y is not observable, therefore
not X."* Elimination, not accumulation.

**4. Test the cheapest discriminating hypothesis first.**

Cheapest, not most likely. A test that takes thirty seconds and eliminates half the search space
beats a twenty-minute test of your favourite theory.

Bisection belongs here. If it worked before and does not now, the history is a sorted array and
you have a search algorithm for exactly this.

**5. Fix the cause, then prove the fix.**

Prove it by reverting the fix and watching the failure return. A fix that was never demonstrated
to be load-bearing might be a fix, or might be the fourth thing you changed while the real cause
went away for an unrelated reason.

**6. Write the regression test before you close it.**

At the seam, asserting the behavior — not the internals of the fix. This bug found a gap in the
test suite. That is the most valuable thing it produced.

---

## The failure modes

**Symptom-patching.** The agent makes the error disappear without establishing why it occurred —
a null check where the null should not exist, a retry around a call that should not fail, a
widened type. The error goes away. The cause does not.

Guard against it with one question, asked every time: **"why did this happen?"** If the answer is
a restatement of the symptom, the diagnosis has not happened yet.

**Confident narration.** An agent will explain a bug fluently and incorrectly. The explanation
will be internally coherent, use the right vocabulary, and reference real code. Fluency is not
evidence. Ask what observation would distinguish this explanation from the alternatives, and go
make that observation.

**Changing several things at once.** Then it works, and nobody knows which change mattered — or
whether two of them are now compensating for each other. One change at a time when isolating a
cause. Batch only after the cause is known.

**Retrying a flaky check into submission.** If a test passes on the third run, it did not pass.
Treating intermittent failure as noise is how a real bug gets shipped, and it teaches everyone —
human and agent — that red is sometimes fine. It is not.

**Context exhaustion mid-hunt.** Long debugging sessions accumulate enormous context: files read,
outputs, dead ends. Half the session ends up being hypotheses that were already eliminated. When
it gets long, write down what has been ruled out and *why*, then clear and continue from the
findings. The eliminated hypotheses are the [handoff artifact](../foundations/03-session-lifecycle.md).

---

## Where delegation helps

The retrieval half parallelizes well: *"find every call site of this function"*, *"check whether
this pattern appears elsewhere"*, *"trace this value's origin"*. Independent lookups, run
concurrently, returning findings rather than file dumps.

The hypothesis half does not delegate. It needs everything learned so far held in one place,
which is the orchestrator's job.

The split is clean: **delegate the looking, keep the thinking.**

---

## Performance regressions

Structurally the same loop, with two additions.

**Measure before you theorize.** Performance intuitions are wrong more often than not, in code
and in agents. Profile, and let the measurement pick the target.

**A baseline is mandatory.** "Slow" is meaningless without a number to compare against. If no
baseline exists, establishing one is step zero — and keeping one afterwards converts "did we
regress?" from an investigation into a check that runs.
