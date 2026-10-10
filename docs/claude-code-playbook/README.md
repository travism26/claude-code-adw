# Claude Code playbook

How to get consistently good work out of a coding agent, and how to use one across the rest of
the software development job rather than only while writing code.

This folder is **self-contained**: no build step, no network access, no dependencies.

---

## Where to start

| You are | Start here |
| --- | --- |
| An engineer adopting this | [`adoption/getting-started.md`](adoption/getting-started.md) |
| Browsing the whole thing | [`index.html`](index.html) — open in any browser |

---

## What's in here

**One HTML entry point**, standalone:

- `index.html` — the practitioner's map into everything below.

**Six foundations** (`foundations/`) — the constraints everything else obeys. Read in order.

1. Context economics — what degrades, and what the evidence does and doesn't support
2. The context diet — cutting the baseline you pay on every session
3. Session lifecycle — clear, compact, or continue
4. Orchestration and delegation — sub-agents, model tiering, and where it stops working
5. Where steering lives — why standards belong in review
6. The access principle — what the agent should be able to read, and the trade-off

**Five plays** (`plays/`) — read each when its situation comes up.

1. Feature delivery — grill → spec → tickets → implement → review
2. Product intake — meeting transcripts into tickets and ambiguities
3. Incident response — first-pass analysis before a human arrives
4. Debugging — the unknown-destination loop
5. CI and build feedback — the cheapest useful access to grant

**Adoption** (`adoption/`) — the getting-started guide for an individual developer.

**Starter kit** (`examples/`) — annotated settings, a standards seed file, and two skill
templates. Adapt them; don't copy them wholesale.

**Reference** — [`glossary.md`](glossary.md).

---

## The short version

Agent output quality declines as material accumulates in a session — continuously, invisibly, and
well before any limit is reached. A bigger context window mostly buys room to keep working after
quality has already fallen.

Everything else follows:

- Cut what you carry into every session
- End sessions deliberately instead of letting them drift
- Write down what matters so throwing a session away costs nothing
- Size work so each unit fits in one good session
- Spend a sub-agent's context on exploration instead of your own
- Load instructions when they're relevant, not always
- Give the agent read access to what the human already reads

**If you do only three things:** clear between unrelated work, size work to one session, and write
standards down instead of correcting in chat.

---

## On evidence

There are no performance percentages in this playbook. None could be defended —
measuring delivery improvement honestly needs a controlled comparison that teams doing real work
don't have, and any number quoted here would be a story rather than a finding.

What is here instead is mechanism, and a careful account of how well supported it is.
[`foundations/01-context-economics.md`](foundations/01-context-economics.md) separates what
published research establishes, what is a reasonable extrapolation, and what is unsupported —
including that degradation is well documented for retrieval and reasoning tasks and thinly
evidenced for multi-turn agentic coding specifically. It also flags two things commonly said in
this space that don't survive contact with the sources.

Adopt these practices because the mechanism is sound and they cost almost nothing, not because
someone quoted a statistic.

---

## Adapting this

Two things are deliberately generic and need filling in:

- **Issue tracker.** The playbook says "issue tracker" throughout. Any will do — the requirement
  is that the agent can read and write it directly rather than having contents relayed by a human.
- **Observability and CI.** Same. The plays describe what access is needed and why, not which
  vendor provides it.

Model names in the tiering table date quickly. The tiers and the rule beneath them do not.
