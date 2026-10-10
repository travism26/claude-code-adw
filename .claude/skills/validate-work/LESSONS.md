# Validation lessons

Read top-to-bottom before every validation; apply every applicable Rule.
Append new entries at the top (format in SKILL.md). Merge duplicate rules;
consolidate when past ~30 rules.

## 2026-08-04 — `--help` on a hand-rolled CLI can start a real run
Context: validating the .ports.env leak fix; smoke-tested the entrypoint with
`uv run adws/travis/travis_sdlc.py --help`
Miss: travis_sdlc has no argparse --help — the flag was swallowed and a LIVE
run started in the harness cwd (it only died because the harness has no
.claude/commands/; against a real target it would have burned agent calls and
mutated state). agents/<id>/ noise had to be cleaned up.
Rule: never smoke-test a harness entrypoint by invoking it; confirm boot via
import/py_compile, and check how the script parses argv before passing any
flag to it.

## 2026-07-22 — a round-trip test must use the writer, not hand-written fixtures
Context: validating travis_sdlc --resume rehydration (run_env in travis_state.json)
Miss: the e2e test wrote the state file with json.dump and proved resume READS
run_env correctly — but the production WRITE path went through
TravisState.update(), which silently drops keys absent from a loaded legacy
state, so real runs never persisted run_env at all. The fix validated green
while its persistence half was a no-op; a real paused run exposed it.
Rule: when validating a persist→restore feature, produce the artifact with the
actual writer code path (ideally a live first-segment run), then restore from
it; a fixture you authored yourself only validates the reader. Check
setter-style helpers for silent key filtering before trusting them.

## 2026-06-10 — git/gh resolve against ambient cwd, not the target
Context: validating the draft-PR loop (operates on a --working-dir target)
Miss: the module test mocked the remote lookup, so it never exercised the
real `git remote get-url` / `gh` path; the live end-to-end revealed it was
resolving the HARNESS repo's origin (ambient cwd) and trying to push the
target's branch there. Mocks hid the exact bug the feature could have.
Rule: when validating code that operates on a target dir, run at least one
real end-to-end from the harness cwd — don't let mocks stand in for the
cwd-sensitive calls (git/gh/subprocess); confirm every such call is scoped
to working_dir.

## 2026-06-10 — solvable is not discriminating; run the cheap failing arm first
Context: validating the hard-mode eval tier (tasks 10-12)
Miss: validated solvability with the expensive strong arm (opus) first, then
discovered via the weak arm (sonnet low) that every task passes both arms —
the tier doesn't discriminate. The weak arm was the cheaper gate and the one
that could actually reject the design; it should have run first.
Rule: when validating an eval/test/benchmark, run the arm that is SUPPOSED
to fail before the arm that is supposed to pass; a check nothing can fail
validates nothing, and the failing arm is usually the cheaper experiment.

## 2026-06-09 — exit code 0 is not proof tests ran
Context: building grader self-tests for evals/graders.py
Miss: nearly trusted "command exited 0" as a passing-tests signal; the
tests_pass grader's exit-code fallback mints a 1.0 when a misconfigured
command runs zero tests (audit finding 3, evals/audits/2026-06-09-audit.md).
Rule: when validating via a test command, read the pass/fail counts in the
output; treat "exit 0, no summary" as unvalidated, not as a pass.

## 2026-06-09 — state files can lag the work they describe
Context: harness history — travis_sdlc.py hang recovery exists because a
phase's JSONL showed success while travis_state.json was never saved.
Rule: when validating against a recorded artifact (state JSON, snapshot,
index), also check the primary evidence it summarizes; the two can disagree.

## 2026-06-09 — nested uv runs inherit the wrong environment
Context: harness history — evals/graders.py needs clean_subprocess_env()
because `uv run` exports VIRTUAL_ENV/PYTHONPATH and nested `uv run pytest`
in a target app resolves against the harness env instead of the target's.
Rule: when validating anything that shells into another project, run it the
way a user would (fresh shell, target cwd), not from inside the harness's
own uv/venv context.
