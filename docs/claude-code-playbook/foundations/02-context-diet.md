# 02 — The context diet

> **Foundations** · Previous: [Context economics](01-context-economics.md) · Next: [Session lifecycle](03-session-lifecycle.md)

Every session starts partly full. Before you have typed a word, the agent is carrying its system
prompt, your always-on instruction files, the definition of every tool it can call, the schema of
every integration you have connected, and whatever the harness injects about your environment.

That baseline is subtracted from your smart zone on every single session, forever. It is the one
context cost you pay repeatedly and the one you almost never look at.

Most people have never measured theirs.

---

## Measure before you cut

Start a fresh session, do nothing, and read the context meter. That number is your baseline.

A default install with a few integrations connected and a long instruction file commonly sits
somewhere in the mid-tens of thousands of tokens. Getting it down to the low teens is achievable
without giving up anything you actually use — but you have to know where it went before you can
decide what to spend it on.

Do this again after each change below. The point is not to hit a target someone else set; it is
to know what your baseline is and to have chosen it deliberately.

---

## The rule that governs all of this

**Opt out, never opt in blind.**

Everything in this chapter is a candidate for cutting, and every candidate is something *someone*
depends on. A diet that removes a tool you use daily has not saved you context; it has cost you a
capability and it will cost you the twenty minutes you spend working out why something stopped
working.

So the process is: look at each item, ask *"do I actually use this?"*, and cut only on a yes to
the inverse. The question is yours to answer for your own setup; a context diet copied from
someone else's answers is the kind that quietly gets reverted.

---

## Where the baseline actually goes

### Always-on instruction files

The single largest and most common source of waste. Instruction files that load on every session
regardless of what the session is doing — project conventions, architecture notes, style guides,
a growing list of things the agent got wrong once.

They grow monotonically because adding to them feels free. It isn't: it is a tax on every session
you will ever run, including the ones where the instructions are irrelevant.

The failure is not only cost. Anthropic's own documentation is blunt about the second-order
effect: *"Bloated CLAUDE.md files cause Claude to ignore your actual instructions!"* Cursor
independently caps its rules files at 500 lines. Past a certain size, an instruction file stops
being instructions and becomes background noise the model skims — so a bloated file is worse than
a short one *even ignoring the token cost*.

**The pruning test**, also from Anthropic's docs, applied line by line:

> Would removing this line cause the agent to make a mistake?

If not, cut it. Most lines in a mature instruction file fail this test. They are things that were
true, or things someone wanted to be true, or a rule written in frustration after one bad session
that never came up again.

What survives is a short screen of genuinely load-bearing facts: how to run the thing, how to run
the checks, where the logs are, and the two or three non-negotiables that are specific to this
project and not inferable from the code.

**The strong version of this move is to have no global instruction file at all**, and let
project-level files carry only what is genuinely project-specific. Global instructions are, by
definition, the ones that apply least often to the session in front of you.

### Connected integrations and their tool schemas

Every integration you connect injects the full definition of its tools into every session —
names, descriptions, and complete parameter schemas for each one. A single integration with
twenty tools can cost several thousand tokens, whether or not you call any of them.

This is the cost that surprises people most, because connecting an integration feels like adding
an option rather than adding weight. It isn't. An integration you use twice a month is charging
you on every session in between.

Disconnect what you do not use regularly. For the things you use occasionally, prefer connecting
them in the sessions where you need them over leaving them on permanently.

### Tools you never call

Harnesses expose a broad tool surface by design, because they do not know what you do. You do.

Tools can be denied in settings, and each denial removes its definition from the baseline. Look
at your actual usage: notebook editing, scheduling, notifications, remote triggers, artifact
generation, browser automation — some of these are load-bearing for some people and pure weight
for others.

This is the sharpest place to apply the opt-out rule. A denied tool fails at the moment you need
it, which is exactly when you have forgotten you denied it.

### Everything the harness injects

Directory listings, git status, environment details, editor state. Mostly small individually,
occasionally not — a repository with hundreds of top-level entries or a very long git status can
inject a surprising amount.

You have less control here, but it is worth knowing about, because it explains why baselines vary
between projects on the same machine.

---

## What replaces what you cut

The diet only works because the capability does not have to go with the context.

**Skills are the mechanism.** A skill is a set of instructions that loads *when the relevant kind
of work comes up*, rather than on every session. The listing costs a line; the body costs nothing
until it is invoked. Anything in your instruction file that only applies to one kind of task —
how to write tests here, how to do a release, how to handle a migration — is a skill, not a
standing instruction.

**Pointers are the other mechanism.** Rather than inlining a document, name it and say when to
read it: *"conventions for the API layer live in `docs/api-conventions.md` — read it before
changing anything under `src/api`."* One line of baseline, full document available on demand, and
the agent decides based on what it is actually doing.

The pattern generalizes. Standing context should contain **the map, not the territory**. Anything
that is only sometimes relevant should be reachable rather than present. This is the same
argument as [where steering lives](05-where-steering-lives.md), applied to the baseline instead
of to a single session.

---

## What good looks like

A baseline in the low teens of thousands of tokens, made up of:

- The harness's own system prompt, which you do not control
- A short global settings file with unused tools and integrations denied
- Either no global instruction file, or a very short one
- A project instruction file that answers five questions in one screen: how to run it, how to
  check it, where the logs are, the non-negotiables, and where the vocabulary lives
- A set of skills covering the specialized work, costing one listing line each

A starter settings file implementing this is in [`../examples/settings.json`](../examples/settings.json).
It ships commented, with each denial explained, so that adopting it is a series of deliberate
decisions rather than a copy-paste.

---

## The honest limits

Two things this chapter does not claim.

**The diet does not make the model smarter.** It moves your starting line. If your work would
have overrun the smart zone by 60,000 tokens, saving 20,000 at the baseline does not fix that —
[decomposition](03-session-lifecycle.md) does. The diet buys margin, not capacity.

**The returns stop.** Once you are down to a lean baseline, further squeezing costs real
capability for trivial gains. The diet is a one-off exercise with an occasional audit, not an
ongoing optimization to obsess over. Do it, get the margin, and go back to work.
