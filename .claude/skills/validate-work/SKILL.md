---
name: validate-work
description: Validate completed work in this repo by executing it for real — run the script, the eval, the test, the failure path — never by reading code alone, and record validation misses in LESSONS.md so each validation is sharper than the last. Use when work is declared complete, before marking a task done, when the user says "validate", "verify this", "is it actually done", or after porting/refactoring harness, eval, or grader code.
---

# Validate work

Validation means executing the deliverable and observing behavior. Reading
the code and concluding "looks right" is review, not validation. A deliverable
is validated only when its claims have been demonstrated against reality —
including at least one path where it is supposed to fail.

## Procedure

1. **Read [LESSONS.md](LESSONS.md) first.** Apply every applicable rule as an
   extra check in step 3. This file is why validation improves over time —
   skipping it repeats old misses.

2. **List the claims.** Write down what the work asserts, explicitly or
   implicitly: "script X passes", "grader Y rejects bad input", "doc Z matches
   the code it describes". Each claim gets validated or marked not-validated;
   no silent gaps.

3. **Execute each claim.**
   - Scripts/tools: run them with the documented invocation (`uv run …`),
     from a clean shell, in the directory a user would use.
   - Tests/selftests: run them and read the actual counts — "exit 0" alone is
     not proof anything ran.
   - Docs/checklists: spot-check every file path, flag, and number cited
     against the current code (`evals/AUDIT.md` citing `graders.py:199` means
     line 199 must say what the doc claims).
   - Negative path: break one input on purpose and confirm the work fails
     loudly (a validator that cannot fail validates nothing).

4. **Report.** Per claim: validated (with the command + observed output),
   or not validated (with why). Failures are reported verbatim, never
   smoothed over. If a step was skipped (cost, missing service), say so.

5. **Learn.** Append a lesson to [LESSONS.md](LESSONS.md) when any of these
   happen, including later in the session:
   - a claim you marked validated turns out broken (a **miss** — most valuable),
   - a check you ran was wasteful or checked the wrong thing,
   - a check not in the procedure caught something (promote it to a rule),
   - the user corrects your validation verdict.

   Entry format (newest first, keep the Rule line imperative and general):

   ```
   ## YYYY-MM-DD — short title
   Context: what was being validated
   Miss: what validation got wrong or almost missed
   Rule: the one-line check to run next time
   ```

   Housekeeping: if two rules say the same thing, merge them. If the file
   exceeds ~30 rules, consolidate the oldest into general rules. Never delete
   a rule just because it's old — only because it's wrong or absorbed.

## Verdicts

End with exactly one of:
- **VALIDATED** — every claim executed and observed; negative path fired.
- **VALIDATED WITH GAPS** — core claims executed; named checks skipped, with reasons.
- **NOT VALIDATED** — a claim failed or could not be executed; list what must change.

Never report VALIDATED on the strength of code reading alone.
