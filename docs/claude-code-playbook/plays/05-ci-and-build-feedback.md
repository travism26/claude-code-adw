# Play 05 — CI and build feedback

> **Plays** · Previous: [Debugging](04-debugging.md) · Foundations: [The access principle](../foundations/06-access-principle.md)

**When to reach for it:** continuously. This is the least glamorous play and usually the first
one to install.

**Access needed:** read access to pipeline runs, job logs, and build artifacts for the
repositories the team owns.

**Human stays in the loop at:** merge, and any change to the pipeline itself.

---

## The smallest possible version of the access principle

A build fails. The engineer opens the pipeline in a browser, scrolls through a few thousand lines
of output, finds the error, copies it, pastes it into a chat with the agent, and asks what is
wrong.

They paste the error. They do not paste the twelve lines before it that would have made the cause
obvious, or the earlier job that failed first and caused this one, or the warning three steps up
that explains why the dependency resolved differently.

**Give the agent pipeline read access and that entire round trip disappears.** It reads the run
itself, including everything the human would not have thought to copy.

This is the cheapest possible demonstration of [the access principle](../foundations/06-access-principle.md),
which is exactly why it is the right first thing to install: build logs are rarely sensitive, the
setup is a scoped read token, and the benefit is visible the first time anyone uses it.

---

## What it does

**Explains failures properly.** Not "the test failed" — which job failed first, what the actual
error was, whether it is related to the current change, and whether the same failure appears in
other recent runs. Cross-run visibility is the part a human almost never checks, because
comparing six pipeline runs by hand is miserable.

**Distinguishes real failures from flakes — with evidence.** "This test has failed in four of the
last thirty runs, on unrelated changes" is a claim backed by data rather than a feeling.

That said: **a flake is a bug with better PR.** Identifying one is the beginning of the work, not
a reason to re-run. A test that fails intermittently is telling you something about ordering,
shared state, or timing, and treating it as noise trains everybody to ignore red. If the agent
identifies a flake, that becomes a ticket.

**Never lets work start on a red baseline.** Check the pipeline before beginning, not after
finishing. If the branch was already broken, every verdict from here is unattributable — you
cannot tell what you broke from what was already broken. This is worth stating as a hard rule
because the temptation to work through it is high and the cost is paid later, confusingly.

**Reconstructs environment differences.** "Passes locally, fails in CI" is mostly an
archaeology problem: which versions, which environment variables, which cache state, what
ordering. The agent can read both sides and diff them.

---

## Speed is a feature of the loop, not a nicety

Multiple independent sources — Fowler's writing on continuous integration, DORA's research on CI
and test automation — converge on roughly **ten minutes** as the point past which feedback stops
functioning as feedback.

That bound bites harder with agents than with humans. A human waiting on a slow pipeline context
switches and comes back. An agent may iterate dozens of times within a single task, so a slow
check multiplies through the whole session.

The practical consequence is a tiered structure:

| Tier | What runs | Where | Speed |
| --- | --- | --- | --- |
| Local, constant | Typecheck, lint, the one relevant test file | Every few edits | Seconds |
| Local, pre-push | Full fast suite | Before pushing | A minute or two |
| CI | Everything, including the slow and integration-heavy | On push | Under ten minutes if possible |

If your pipeline takes forty minutes, this play still helps, but the loop it is feeding is
already broken and fixing the pipeline is the higher-value work.

---

## Read-only, with one exception worth arguing about

Same rule as everywhere: the agent reads the pipeline and proposes; a human merges.

The obvious extension is letting the agent push a fix when CI fails on its own change. That is
defensible in a narrow case — the change is small, the failure is unambiguous, the fix is
mechanical, and a human reviews before merge regardless.

It is not defensible as a general capability. An agent that can push to make builds go green has
an incentive gradient pointing at *making builds go green*, and the shortest path there is not
always fixing the code. Skipping a test, widening a matcher, and adding a retry all make CI
green.

Keep the pressure on the human side of the merge boundary.

---

## Where the pipeline itself gets better

Once an agent is reading pipeline output routinely, its complaints are a decent audit of your CI.

Unclear failure messages, jobs that fail without saying which assertion, output buried under
thousands of lines of noise, missing artifacts — all of these slow an agent down in the same way
they slow a human down, but the agent hits them dozens of times a day and does not learn to route
around them.

**Write error messages for the machine reader.** An error that names the failing invariant and
the likely fix — *"port 5432 in use; is another dev database running? see docs/dev-setup.md"* —
closes the loop in one hop instead of sending someone on a research detour. The agent pastes
error text directly into its own reasoning, which makes it a new and quite demanding consumer of
your error strings.

Improvements made for the agent's benefit are improvements for every engineer who has ever
squinted at a red pipeline at 6pm.
