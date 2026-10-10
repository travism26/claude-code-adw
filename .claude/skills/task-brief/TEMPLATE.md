# Task Brief Template

Copy, fill, delete what's empty. Comments in (parens) are guidance — remove them.

```
GOAL
(One or two sentences: WHAT to build + the DECISION it serves. The "so we
can..." clause is load-bearing — it tells the executor where quality matters
and where it doesn't. Include the effort calibration: throwaway | spike |
production.)

SCOPE (keep it tight)
- (Isolation: where this work lives, what it must not leak into.)
- DON'T TOUCH: (files/systems that must not change.)
- REUSE: (existing systems to reuse, each with a decision rule —
  "reuse X IF it drops in cheaply; otherwise stub/skip".)
- DON'T REBUILD: (things adjacent to the task that are explicitly out of
  scope, especially ones the executor might assume are wanted.)

WHAT TO BUILD
1. (Numbered, independently verifiable items. Each names its exact
   resources: paths, commands, formats, magic numbers.)
2. ...
3. ...

KNOWN GAPS — flag, don't fix
(Anything that will look broken but is expected. State the symptom, the
workaround to use now, and the real fix for later. This stops the executor
from burning time on it AND stops the reviewer from reading it as failure.)

VERIFICATION
(A check the executor can run and read: test command, build, script, fixture
diff, screenshot comparison. "Run X; it must print/return Y.")

DECISION GATE
- Deliverable: (what to report back — output, screenshot, diff, a written
  read on specific questions.)
- Questions the output must answer: (the judgment calls reserved for the
  human, phrased as questions.)
- STOP: (the explicit boundary — "do NOT start <next phase> until reviewed".)

BOUNDARIES (for unattended runs only)
- Always OK: (safe actions, no approval needed.)
- Ask first: (high-impact changes needing human review.)
- Never: (hard stops — secrets, force-push, deleting data, prod.)
```
