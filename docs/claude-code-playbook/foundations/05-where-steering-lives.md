# 05 — Where steering lives

> **Foundations** · Previous: [Orchestration and delegation](04-orchestration-and-delegation.md) · Next: [The access principle](06-access-principle.md)

You will accumulate instructions. The agent does something you don't like, you write a rule. It
happens again in a different shape, you write another. Within a month you have a long file of
accumulated corrections that loads on every session.

This chapter is about the fact that **where** an instruction lives determines whether it works.
The same sentence can be effective, useless, or actively harmful depending on which file you put
it in.

---

## Three places, three jobs

**Always-on context files** load every session regardless of what you are doing. They should
contain only what is true and relevant *every time*: how to run the thing, how to run the checks,
where the logs are, and the handful of non-negotiables specific to this project that cannot be
inferred from the code.

**Skills** load when a particular kind of work comes up. Anything that applies to one type of
task — how releases work here, how to handle a schema migration, how this team writes tests —
belongs in a skill. It costs a line of listing until the moment it is relevant, then arrives in
full.

**Standards files** load during review, and only during review. Everything about how code should
look, what patterns are preferred, which idioms this team rejects.

Most teams put all three in the first bucket. That is the mistake.

---

## The argument for pushing standards into review

This is the least obvious move in the playbook and the one with the best reasoning behind it.

The intuition is that if you want the agent to write code a certain way, you should tell it
before it writes the code. Reasonable, and mostly wrong, for two reasons.

**The implementer is the busiest agent you have.** Look at what an implementation session is
already doing:

| | Implementation | Review |
| --- | --- | --- |
| Explore the codebase to find where things go | Yes | No — it is handed the diff |
| Write the files | Yes | No — it reads what exists |
| Debug and prove it works | Yes | No — checks already ran |

The implementer is carrying exploration, authorship, and verification simultaneously, and its
context fills fast. The reviewer arrives with almost none of that load. Adding forty lines of
style guidance to the implementer competes directly with the work; adding it to the reviewer
costs nothing that matters.

**Review catches what instruction misses.** An instruction is advisory — the agent reads it,
intends to follow it, and drifts under load. A review is a check with a verdict. Practitioner
trials of spec-driven approaches have repeatedly found agents not following all the instructions
they were given, and named the resulting confidence a *false sense of control*. The lesson
generalizes: **instructions are advisory, checks are binding.** If a standard matters, it needs
something that catches its violation, not just something that requests compliance.

So a standards file is not documentation the implementer reads. It is the checklist the reviewer
enforces. And because it is only ever loaded during review, its size stops being a problem — it
can grow to whatever it needs to be without taxing a single implementation session.

---

## The habit

The practice this produces is small and worth building deliberately.

**When the agent does something you don't like, don't correct it in chat. Write it into the
standards file.**

A correction in chat fixes one instance and evaporates when the session clears. A line in the
standards file catches every future instance, in every session, forever, at zero standing cost.

The lines that accumulate this way are unglamorous and specific, which is why they work:

```
Context menu items always include a leading icon, matching the surrounding items.

Everything under `app/routes` is exposed publicly as a route. Never put test files
or utilities there.

Prefer a single well-named function over three tiny ones extracted "for testability."
```

Each exists because someone watched an agent get it wrong. A mature standards file is loose,
repetitive, and slightly embarrassing to read. That is what a real one looks like.

---

## What you get before writing anything

An empty standards file is not an empty review. A reviewing agent already knows the classical
code smells — mysterious name, duplicated code, feature envy, data clumps, shotgun surgery,
divergent change — because they are decades-old vocabulary that is thoroughly represented in what
the model learned.

So review returns findings from day one. Your standards file sits *on top* of that baseline and
overrides it: where your project deliberately does something the baseline would flag, writing it
down turns the flag off.

That is a good reason to start reviewing before you have written a single standard, and to let
the file grow from what you actually see rather than from an upfront attempt to codify
everything.

---

## Review with fresh eyes

One structural requirement: **the agent that reviews should not be the agent that wrote the
code.**

Anthropic's documentation states the reason directly — a fresh context improves code review
because the agent will not be biased toward code it just wrote. The same reasoning that makes
human self-review weak applies, and the fix is cheaper: a new context costs nothing but tokens.

One documented caution, worth carrying: **a reviewer asked to find problems will usually report
some, even when the work is sound.** Review findings are input to a judgment, not a task list to
apply. Verify a finding before acting on it, particularly when it arrives with confident phrasing
and no specific evidence.

---

## Two axes, reported separately

Review answers two independent questions, and collapsing them lets one hide the other:

- **Standards** — does this follow how code is written here?
- **Spec** — does this faithfully do what was actually asked for?

A change can pass either and fail the other. Code that follows every convention while
implementing the wrong feature passes standards and fails spec. Code that does exactly what the
ticket asked while violating three conventions does the reverse.

Run them as separate reviews — ideally in parallel sub-agents, per
[orchestration](04-orchestration-and-delegation.md) — and report them separately. A single
combined "looks good with some notes" is where a spec failure goes to hide behind four style
nits.

The spec axis needs the spec, which is the second reason
[the destination gets written down](../plays/01-feature-delivery.md). Without it, review can only
check that the code does *something* coherent, never that it does the *right* thing.
