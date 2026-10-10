# Getting started

> For an individual developer. Zero to your first feature shipped this way.

You do not need to adopt all of this at once, and you should not try. The order below is chosen
so that each step is useful on its own and makes the next one easier.

Budget about half a day for days 1–2, then work normally.

---

## Day 1 — Find out where you're starting

**Measure your baseline.** Open a fresh session, do nothing, and read the context meter. Write
the number down. That is what every session you run costs before you begin.

Most people have never looked. The number is usually higher than expected, and it is the only
figure in this playbook you get for free.

**Watch one session degrade.** Work normally on something substantial and pay attention to the
context meter as you go. Note where the agent starts re-reading files it already read,
contradicting an earlier decision, or proposing something you ruled out.

That's your smart-zone boundary. It is personal, it varies by task, and having found it once by
observation is worth more than any number someone gives you.

Background for both: [Context economics](../foundations/01-context-economics.md).

---

## Day 2 — Cut the baseline

Work through [The context diet](../foundations/02-context-diet.md) and re-measure after each
change.

The order that pays fastest:

1. **Disconnect integrations you don't use weekly.** Usually the biggest single win, because each
   one injects its full tool schemas into every session whether you call it or not.
2. **Prune your always-on instruction files.** Line by line, ask: *would removing this cause a
   mistake?* Most lines fail. Anything specific to one kind of task becomes a skill instead.
3. **Deny tools you never call.**

**The rule: opt out, don't cut blind.** Only remove things you have established you don't use.
Cutting a tool you rely on costs you more than the tokens saved, and you will not remember you
cut it.

A starter settings file is in [`../examples/settings.json`](../examples/settings.json) — read the
comments and decide each line rather than copying it wholesale.

Re-measure. Getting from the mid-tens of thousands down to the low teens is normal.

---

## Day 3 — Change how sessions end

This is the highest-value habit and it costs nothing.

**Clear between unrelated pieces of work.** Finished a feature and moving to a bug? Clear. The
context you're carrying is about to become noise competing with what you're doing next.

**Before clearing, ask what needs writing down.** If the answer is "nothing," clear immediately.
If something needs to survive, write it somewhere durable and *then* clear. Reluctance to clear
is a signal that something didn't get captured — not a reason to keep the session.

Read [Session lifecycle](../foundations/03-session-lifecycle.md) once. It is short and it is the
chapter you'll use most.

---

## Day 4 — Start a standards file

Create a `CODING_STANDARDS.md`. One line is a legitimate starting point.

Then build the habit: **when the agent does something you don't like, don't correct it in chat —
write it in the file.** A chat correction fixes one instance and disappears. A line in the file
catches every future instance forever.

Then use it. Run a review of your own work against it before you open a pull request, in a
**fresh session** — the agent that wrote the code is biased toward it.

Background: [Where steering lives](../foundations/05-where-steering-lives.md). Seed file:
[`../examples/CODING_STANDARDS.md`](../examples/CODING_STANDARDS.md).

---

## Day 5 — Give the agent pipeline access

Scoped, read-only access to your CI runs.

This is the smallest useful application of [the access principle](../foundations/06-access-principle.md)
and the fastest to prove out. The next time a build fails, point the agent at the run instead of
pasting the error. It reads the parts you wouldn't have thought to copy — the job that failed
first, the warning three steps up, whether this test has been flaky across recent runs.

Details: [CI and build feedback](../plays/05-ci-and-build-feedback.md).

---

## Week 2 — Run the feature workflow once, properly

Pick something real, and specifically something **too big for one session**. The workflow's
overhead does not pay on small work, and trying it on a small task will teach you the wrong
lesson.

Then work [Feature delivery](../plays/01-feature-delivery.md) end to end:

1. **Get grilled.** Let the agent interrogate you until the ambiguity is gone. Expect this to
   take longer than feels reasonable and expect to change your mind about scope at least once.
2. **Produce a spec** and put it in your issue tracker, not the repo.
3. **Break it into tickets** — vertically sliced, one session each. Review the breakdown
   yourself; this is two minutes that saves hours.
4. **Implement one ticket per session**, starting fresh each time.
5. **Review on both axes**, standards and spec, in a fresh context.
6. **Close the spec when it's done.** Archived, not deleted, not kept as documentation.

Two things to watch on your first run:

- **Are the tickets vertically sliced?** If ticket one is "build the schema" and ticket three is
  "wire up the UI," that's horizontal and you'll pay for it in ticket three. Say "vertical
  slices" explicitly and regenerate.
- **Did you actually clear between tickets?** The temptation to continue is strong because the
  session feels warm. That feeling is the thing this playbook is about.

---

## Week 3 onward — Add plays as they come up

The remaining plays are situational. Read each when its situation arises rather than upfront:

- A meeting produced requirements → [Product intake](../plays/02-product-intake.md)
- Something broke in production → [Incident response](../plays/03-incident-response.md)
- Something is broken and you don't know why → [Debugging](../plays/04-debugging.md)

And when work is bigger than one session, or you find yourself waiting while the agent explores,
read [Orchestration and delegation](../foundations/04-orchestration-and-delegation.md). It is the
chapter that changes throughput most, and it is also the one most worth delaying until the basics
are habitual — delegation multiplies whatever practice you already have, including a bad one.

---

## If you only do three things

1. **Clear between unrelated work.** Free, immediate, largest quality effect.
2. **Size work to one session.** Everything else is downstream of this.
3. **Write standards down instead of correcting in chat.** Compounds; nothing else here does.

---

## Things that will feel wrong at first

**Clearing feels wasteful.** You built up all that context. But the agent re-reads what it needs
in seconds, and it re-reads it into a clean window. The cost is visible and small; the cost of
staying too long is invisible and unbounded.

**Grilling feels slow.** Twenty minutes of questions before any code. It is faster than
discovering the same ambiguity three days into implementation, which is where it goes otherwise.

**Closing the spec feels like throwing away work.** It's archived, not deleted, and still findable
in the tracker. The reasoning is in
[Feature delivery](../plays/01-feature-delivery.md#specs-are-disposable-the-position-on-spec-driven-development)
— a persisted spec doesn't sit quietly, it actively outcompetes the code for the agent's
attention.

**Small tickets feel like overhead.** Three tickets instead of one feels like three times the
ceremony. But each one runs in a fresh smart zone, and the quality difference is the entire
argument of this playbook.
