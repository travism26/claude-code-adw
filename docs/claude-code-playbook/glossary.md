# Glossary

The playbook leans on a small vocabulary. Most of these terms are borrowed from practice rather
than invented here, but they are used precisely and consistently throughout, so it is worth
pinning them down once.

Terms are ordered by how early you meet them, not alphabetically.

---

### Context window

The total amount of text a model can hold at once — the system prompt, the conversation so far,
every file read, every tool result, and the response being written. Measured in tokens. When it
fills, something has to give: older content is dropped, summarized, or the session ends.

The context window is a **capacity**, not a **budget you should spend**. Most of the practices in
this playbook exist because those two things get confused.

### Token

The unit a model reads and writes in — roughly ¾ of a word in English, less for code. Every file
the agent opens and every command output it sees is converted to tokens and occupies the context
window permanently for that session.

### Smart zone

The early portion of a context window, where output quality is at its best. Work that fits
entirely inside the smart zone produces noticeably better results than the same work done later
in a session.

The critical property, and the reason it gets its own name: the smart zone appears to be bounded
by an **absolute** quantity of context, not by a percentage of whatever window the model happens
to have. See [Context economics](foundations/01-context-economics.md) for what the evidence
does and does not support here.

### Dumb zone

Everything past the smart zone. Not a cliff and not a failure state — the model still works, and
for many tasks the degradation is invisible. But instruction-following gets looser, earlier
decisions get forgotten or contradicted, and the agent becomes more likely to confidently repeat
work it already did.

The name is deliberately blunt. It is a reminder that a session which *feels* fine can be
producing measurably worse work.

### Session

One continuous conversation with an agent, from a fresh start to a clear or a close. The unit of
work this playbook plans around. A session has one context window, and therefore one smart zone.

### Context diet

Deliberately reducing the amount of context consumed *before you type anything* — trimming
always-on instruction files, disabling unused tools and integrations, and replacing standing
documentation with pointers the agent follows only when relevant. Every token cut from the
baseline is a token available for actual work. See
[The context diet](foundations/02-context-diet.md).

### Spec

A **destination document**. It describes where a piece of multi-session work is going and what
"done" looks like, in terms of the problem, the solution, user stories, and the decisions already
made. It does not describe how to get there, and it deliberately avoids file paths and code
snippets, which go stale fastest.

A spec is passed to every session working on the feature, so each session understands how its
slice contributes to the whole. It is also the oracle used to review the finished work.

**A spec is disposable.** It is archived once the work is in code. It is never a parallel source
of truth that lives alongside the codebase. This is a deliberate position, argued in
[Feature delivery](plays/01-feature-delivery.md).

### Ticket

A **journey document**. One unit of work, sized to fit comfortably inside a single session's
smart zone, sliced so that it delivers working end-to-end behavior rather than one horizontal
layer. Tickets declare what blocks them, so they can be worked in a valid order.

Tickets are even more disposable than specs. If the destination changes, unimplemented tickets
are thrown away and regenerated from the revised spec.

### Vertical slice

A unit of work that cuts through every layer it touches — storage, service, interface — and
delivers a narrow but complete path. The opposite of a **horizontal slice**, which completes one
layer at a time.

Agents default to horizontal slicing because it looks organized. It is a trap: nothing is proven
to integrate until the last layer lands, so design problems surface at the worst possible moment.
The term "vertical slice" is worth using out loud with an agent, because the concept predates AI
by decades and models already understand it.

### Handoff artifact

Any document that carries knowledge *between* sessions by living outside the context window —
specs, tickets, decision records, standards files. Handoff artifacts are what make clearing a
session cheap instead of lossy: the conversation is disposable precisely because everything
durable was written down somewhere else.

### Clearing

Ending a session and starting fresh with an empty context window. The cheapest way back into the
smart zone, and the correct default once the current context has been distilled into handoff
artifacts.

### Compaction

Summarizing a session's history in place to reclaim context, keeping the conversation alive.
Preserves continuity at the cost of fidelity — the summary is a lossy projection of what actually
happened. Useful when the context is genuinely still relevant; wasteful when it isn't.

### Primary source / secondary source

The **primary source** for how a system behaves is the code that runs. A **secondary source** is
any description of it — a spec, a design doc, an architecture diagram, a summary.

Secondary sources drift, and the drift is silent. Worse, an exploring agent will often prefer
them, because they are smaller, denser and easier to read than the code they describe. This
asymmetry is the argument behind archiving specs rather than keeping them.

### Orchestrator

The main agent session, which holds the plan and the judgment, and hands executable work to
sub-agents rather than doing it all itself. The orchestrator's context is the scarce resource
being protected.

### Sub-agent

A separate agent launched by the orchestrator with its own fresh context window and a specific
task. Its intermediate work — every file it read, every command it ran — stays in its own
context; only its final report returns to the orchestrator.

That containment is the primary benefit. Cost savings from routing sub-agents to cheaper models
are real, but secondary.

### Model tiering

Matching the model to the task rather than using the strongest one everywhere: judgment-heavy
work on the strongest model, well-specified work with a mechanical pass/fail check on a mid
model, trivial fully-specified lookups on the cheapest.

The rule that makes it safe: **if you cannot write a check that proves the work is correct, do
not send it to a cheaper model.** See
[Orchestration and delegation](foundations/04-orchestration-and-delegation.md).

### Self-verifying prompt

A task handed to an agent that ends with the checks the agent must actually run and the shape of
the report it must return. An agent that did not run its checks is not done, regardless of what
its summary says.

### Seam

The public boundary a test is written against — a module's interface, an API contract, a
component's props. Tests live at seams, never against internals, because internals change without
the behavior changing.

Agreeing seams *before* writing tests keeps testing effort on the paths that matter.

### Play

A repeatable way of using an agent for one kind of work. This playbook contains five: feature
delivery, product intake, incident response, debugging, and CI feedback. Each names when to reach
for it, what access the agent needs, the shape of the session, and where the human stays in the
loop.

The term exists to make one point: the feature-delivery workflow is one play among several, not
the entirety of what an agent is for.

### Access principle

The working rule that an agent should be able to read whatever a human on the team can read —
logs, dashboards, pipelines, tickets, meeting transcripts — scoped and read-only, rather than
having information relayed to it by a human acting as a copy-paste layer.

The trade-off it incurs is real and is argued rather than waved away in
[The access principle](foundations/06-access-principle.md).

### Skill

A packaged set of instructions that an agent loads when a particular kind of task comes up,
keeping specialized guidance out of the context window until the moment it is relevant. The
mechanism that makes a context diet possible without losing capability.

---

Some of this vocabulary (smart zone, grill → spec → tickets) draws on Matt Pocock's public
writing at aihero.dev.
