# Coding standards

<!--
  A seed file. Delete everything below the line and start with one rule.

  HOW THIS FILE WORKS

  This file is loaded during CODE REVIEW, not during implementation. That is
  deliberate and it is the point.

  The implementer is already carrying exploration, authorship and verification
  in one context window. The reviewer is handed the diff and carries almost
  nothing. Standards belong with the agent that has room for them, and review
  is a check with a verdict rather than an instruction that gets followed
  under load. See ../foundations/05-where-steering-lives.md.

  Because it only loads at review time, SIZE DOES NOT MATTER MUCH HERE. Let it
  grow. A mature standards file is long, loose, repetitive and slightly
  embarrassing to read. That is what a real one looks like.

  THE HABIT

  When the agent does something you don't like, do not correct it in chat.
  Write it here.

  A chat correction fixes one instance and evaporates when the session clears.
  A line here catches every future instance, in every session, forever.

  Every line in a good standards file arrived the same way: someone watched an
  agent get something wrong and wrote it down. Do not try to write this file
  upfront — you will produce a generic style guide describing problems you do
  not have, while the things that actually annoy you go uncaptured.

  WHAT YOU GET WITHOUT WRITING ANYTHING

  An empty file is not an empty review. A reviewing agent already knows the
  classical code smells — mysterious name, duplicated code, feature envy, data
  clumps, shotgun surgery, divergent change — because they are decades-old
  vocabulary.

  This file sits on top of that baseline and OVERRIDES it. Where your project
  deliberately does something the baseline would flag, writing it down here
  turns the flag off. That is a good reason to start reviewing before you have
  written a single rule.
-->

---

Prefer the boring solution.

<!--
  That single line is a legitimate starting point. Add to it as you go.

  ─────────────────────────────────────────────────────────────────────────────
  EXAMPLES OF THE SHAPE — from real files, illustrative only. Delete these.

  ## Naming and structure

  Prefer one well-named function over three tiny ones extracted "for
  testability." Extraction that exists only to create a test seam usually moves
  complexity rather than reducing it.

  Everything under `app/routes` is exposed publicly as a route. Never put test
  files, fixtures or utilities there.

  ## UI

  Context menu items always include a leading icon, matching the style of the
  surrounding items. When adding a menu item, pick an icon that conveys the
  action.

  ## Errors

  Never swallow an exception silently. If it is genuinely safe to ignore, log
  it at debug with the reason it is safe.

  Error messages name the failing invariant and the likely fix. Agents paste
  error text directly into their reasoning, so an error like "port 5432 in use
  — is another dev database running? see docs/dev-setup.md" closes the loop in
  one hop instead of starting a research detour.

  ## Tests

  Tests go at module interfaces, never against internals.

  Expected values come from an independent source — a known-good literal, a
  worked example, the spec. Never recompute the expected value the way the code
  computes it. `expect(add(a, b)).toBe(a + b)` passes by construction and can
  never disagree with the implementation.

  Never add a retry to make a flaky test pass. A test that passes on the third
  run did not pass. Intermittent failure is a bug report about ordering, shared
  state or timing.

  ## Dependencies

  Adding a dependency requires a comment explaining what it does that the
  standard library does not.
  ─────────────────────────────────────────────────────────────────────────────

  NOTE ON REVIEW FINDINGS

  A reviewer asked to find problems will usually report some, even when the
  work is sound. Treat findings as input to a judgment, not a task list to
  apply — particularly when one arrives confidently phrased with no specific
  evidence attached.
-->
