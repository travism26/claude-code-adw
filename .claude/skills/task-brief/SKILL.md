---
name: task-brief
description: Draft an unambiguous, information-dense task prompt (GOAL / SCOPE / BUILD / KNOWN GAPS / DECISION GATE) for handing work to a coding agent or teammate. Use when the user wants to write a prompt for an agent run, package a task into a brief, says "write me a prompt for...", "turn this into a task brief", or asks to de-ambiguate a task description before kicking off autonomous work.
---

# Task Brief

Turn a rough task description into a brief that minimizes blind judgment calls.
The principle: every section answers a question the executor would otherwise
guess at — and guesses are where autonomous runs go sideways.

## Workflow

1. **Collect the raw task** from the user (conversation context, a ticket, or
   a sentence). Do not draft yet.
2. **Interrogate for the five answers.** From context, fill in what you can;
   ask the user ONLY for load-bearing facts you cannot infer:
   - What decision or outcome does this work serve? (the *why* — it changes
     how the work gets done)
   - What must NOT be touched, rebuilt, or expanded? (negative scope)
   - What are the concrete deliverables, and what exact resources do they use?
     (file paths, commands, APIs — named, not described)
   - What will look broken but is expected? (known gaps + disposition)
   - What does the executor report back, and where do they STOP?
3. **Draft using [TEMPLATE.md](TEMPLATE.md).** Drop sections that are truly
   empty rather than padding them.
4. **Run the ambiguity lint** (below). Rewrite any line that fails.
5. **Show the brief** and note any judgment calls you left open on purpose.

## Ambiguity lint

Flag and rewrite these — they force the executor to guess:

- **Vague verbs**: "improve", "clean up", "handle properly", "make robust",
  "support" → replace with information-dense verbs + a target:
  CREATE <path>, UPDATE <path>, ADD <function> to <file>, REMOVE, RENAME,
  MIRROR <existing pattern>, REPLACE X with Y.
- **Unbounded quantifiers**: "some", "a few", "etc.", "as needed", "and so on"
  → enumerate or give a count.
- **Described-not-named resources**: "the config file", "the sprite sheet"
  → exact path/filename, plus internal layout if it matters
  (e.g. "32x32 grid: row 0 = idle, row 5 = attack").
- **Quality without a check**: "should work well", "make sure it's correct"
  → name a check the executor can run: a test command, a build, a script,
  a screenshot to compare. Pass/fail, readable by the agent.
- **Implicit effort level**: say "throwaway/sandbox" or "production" outright;
  the executor calibrates polish, tests, and edge-case handling from it.

## Rules of thumb

- Conditionals need a decision rule: not "reuse the auth module if possible"
  but "reuse it IF it drops in without refactoring; otherwise stub it".
- Negative constraints (don't touch, don't rebuild) prevent more damage than
  positive ones; spend words there.
- For unattended runs, add a BOUNDARIES block: always do / ask first / never do.
- The stop condition is mandatory. An eager agent without one keeps going.

See [EXAMPLES.md](EXAMPLES.md) for a worked example with annotations.
