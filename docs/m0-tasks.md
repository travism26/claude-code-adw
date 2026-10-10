# M0 epic — defect fixes + Java eval target (tiered execution)

Source: `docs/sdlc-agent-map.md` §4 (confirmed defects) + Java target decision.
Branch: `feat/m0-defect-fixes`. Orchestrator reviews every diff before commit.

## Standing orders

- Gate command: `uv run pytest adws/adw_tests/test_model_selection.py adws/adw_tests/test_webhook_simplified.py -q` (plus any new test file your brief adds). Do NOT run pytest on the whole `adw_tests/` dir — some files there are manual live-LLM scripts.
- Python style: match the surrounding file — these scripts use manual `sys.argv` parsing, stdlib + pydantic/dotenv only; no new dependencies, no argparse/click conversions.
- Prompt templates (`template_claude/commands/*.md`): keep the existing section structure (`# Title`, `## Variables`, `## Instructions`, `## Report`); positional variables are `$1`/`$2`/`$3`.
- Fail-closed pattern to mirror wherever parse-failure must not look like success: `adws/travis/travis_validate.py:181-209`.
- DON'T TOUCH (epic-wide): `adws/travis/travis_sdlc.py`, `adws/adw_triggers/`, `evals/` (except T4's `evals/target_java/`), `agents/`, `trees/`, `logs/`.
- Do NOT commit; leave all changes in the working tree.
- Keep diffs minimal — no drive-by refactors, no explanatory comment noise.

---

## T1 — Test phase fails closed [x]

```
GOAL
Make the travis test phase fail closed when /test agent output is unparseable, and stop
advertising test-selection flags /test ignores — so a malformed test response can never
report as a passing phase. Production.

SCOPE
- Files: adws/travis/travis_test.py, adws/README.md, NEW adws/adw_tests/test_travis_test_parsing.py
- DON'T TOUCH: template_claude/commands/test.md and test_e2e.md (selector wiring is future
  slim-pipelines work), everything in the epic-wide list.
- REUSE: the synthetic-failure pattern from travis_validate.py:181-209.

WHAT TO BUILD
1. parse_test_results (travis_test.py:54-65): on parse exception return None (not ([], 0, 0)).
   Update all callers: None ⇒ the /test attempt failed — reuse the existing retry loop (retry
   the /test agent up to max retries; do NOT enter per-test resolution when nothing parsed),
   and after final retry set phase_result {"success": False, "error": "test output unparseable"}.
   An EMPTY parsed list stays a legitimate ([], 0, 0) success — distinguish the two.
2. travis_test.py:90-94: stop forwarding --run-all-tests/--diff-base into the /test template
   args. Keep accepting the CLI flags; when given, log a warning that selection is not wired
   for /test and the flag is ignored.
3. adws/README.md:267-280: correct the claim that /test uses the test selector (only
   /test_e2e documents it).
4. NEW pytest adws/adw_tests/test_travis_test_parsing.py, no LLM calls, import the function
   directly: (a) garbage input → None; (b) valid JSON array of TestResult objects → correct
   pass/fail counts; (c) valid empty JSON array → ([], 0, 0).

KNOWN GAPS — flag, don't fix
/test still runs the full {{TEST_COMMAND}} every time (selector unwired) — slim-pipelines
work, not this task.

VERIFICATION
uv run pytest adws/adw_tests/test_travis_test_parsing.py -q  → all pass
Standing-orders gate → green.

DECISION GATE
- Deliverable: diff summary + real gate output.
- Question: does anything else in adws/ rely on ([], 0, 0) meaning success? (grep callers)
- STOP: do not start T2.
```

## T2 — Planner/reviewer/patch contract fixes [x]

```
GOAL
Give /bug and /review one canonical numbered-arg contract matching their live callers, and
existence-verify the /patch artifact — so no phase agent contract is ambiguous and no
hallucinated path flows downstream. Production.

SCOPE
- Files: template_claude/commands/bug.md, template_claude/commands/review.md,
  adws/travis/travis_review.py, adws/travis/travis_patch.py,
  adws/adw_prompt_plan_build_test_review.py
- DON'T TOUCH: travis_plan.py (its call convention [adw_id, prompt] is the one we're
  standardizing ON), feature.md, chore.md, workflow_ops.py, epic-wide list.

WHAT TO BUILD
1. bug.md Variables → `adw_id: $1`, `prompt: $2` (drop issue_number/issue_json — the flow
   that produced them is dead). Plan filename convention → specs/bug-{adw_id}-{name}.md
   (matches travis_plan.py:112's primary regex). Rewrite Instructions accordingly: bug
   details come from `prompt`.
2. adw_prompt_plan_build_test_review.py bug branch (~:292): send [adw_id, prompt]; when
   --issue-number is set, embed it in the prompt text ("Issue #N: ..."). Extend its
   extract_plan_path patterns (~:94-99) to accept bug- filenames (keep issue- for legacy
   spec files).
3. review.md Variables → `adw_id: $1`, `spec_file: $2`, `agent_name: $3 (optional, default
   'review_agent')`. travis_review.py:59 currently passes [spec_file, adw_id] — swap to
   [adw_id, spec_file]. The flagship's [adw_id, plan_path, reviewer_name] already matches —
   verify, don't change.
4. travis_patch.py (~:154): after stripping the returned path, os.path check it exists
   (resolve relative to the working dir the agent ran in) before reporting success; missing
   file ⇒ phase failure with a clear error (mirror travis_plan.py:286-293).

KNOWN GAPS — flag, don't fix
/bug loses structured issue_json input; the factory milestone reintroduces structured
ticket intake under a new contract.

VERIFICATION
grep -rn "issue_json" template_claude/ adws/travis/ adws/adw_prompt_plan_build_test_review.py
→ no live references remain (workflow_ops/docs don't count).
Standing-orders gate → green. Report before/after arg orders for both templates.

DECISION GATE
- Deliverable: diff + the arg-order table.
- Question: any OTHER caller of /bug or /review found beyond the named files?
- STOP: do not start T3.
```

## T3 — Verified dead-code removal [x]

> Executor follow-up flag (2026-07-19): `create_or_find_branch`, `ensure_plan_exists`,
> `ensure_adw_id`, `find_existing_branch_for_issue`, `find_plan_for_issue`, `find_spec_file`,
> `format_issue_message` (workflow_ops) and `commit_changes`, `get_pr_number`, `approve_pr`,
> `merge_pr` (git_ops) also have zero external callers but weren't authorized in this packet.
> A future pass may remove them — which would then also unlock deleting classify_issue /
> generate_branch_name and their map entries (kept this round because create_or_find_branch
> still calls them).

```
GOAL
Delete provably-dead agent plumbing so the harness surface matches reality. Production;
conservative — grep-verify before EVERY deletion.

SCOPE
- Files: adws/adw_modules/data_types_validate.py (delete), workflow_ops.py, data_types.py,
  agent.py (map entries only), git_ops.py.
- DON'T TOUCH: adw_triggers/ and ANYTHING it imports — even if broken, trigger rewiring is
  the factory milestone. travis/, template_claude/, epic-wide list.
- Rule: for each candidate symbol, grep -rn across adws/ and evals/; delete ONLY
  zero-reference symbols (references from other candidates being deleted don't count as
  keep-votes). If adw_triggers imports it, KEEP it and note that.

WHAT TO BUILD
1. Delete adws/adw_modules/data_types_validate.py (verify zero imports first).
2. workflow_ops.py: delete after verification — classify_issue, build_plan, implement_plan,
   generate_branch_name, create_commit, create_pull_request + imports only they used.
   KEEP extract_adw_info (webhook imports it). create_and_implement_patch: verify callers,
   keep if referenced.
3. git_ops.py finalize_git_operations: verify zero callers → delete with helpers only it used.
4. data_types.py SlashCommand Literal + agent.py SLASH_COMMAND_MODEL_MAP: drop entries for
   templates that don't exist (/classify_issue, /generate_branch_name, /commit,
   /pull_request, /track_agentic_kpis, /install_worktree) ONLY where the entry isn't used by
   a kept function. KEEP /classify_adw (extract_adw_info uses it).
5. Produce a table: symbol → deleted | kept (reason: referenced by X at file:line).

KNOWN GAPS — flag, don't fix
Both triggers remain non-functional (they dispatch to nonexistent adw_*_iso.py scripts) —
factory-milestone work, deliberately untouched here.

VERIFICATION
Standing-orders gate → green, plus:
uv run python -c "import sys; sys.path.insert(0,'adws'); import adw_modules.workflow_ops,
adw_modules.git_ops, adw_modules.data_types, adw_modules.agent" → clean.
grep shows zero dangling references to deleted names.

DECISION GATE
- Deliverable: the deletion table + gate output.
- Question: list any symbol whose deadness was ambiguous (default to KEEP).
- STOP: epic ends here pending orchestrator review.
```

## T4 — Java eval target (parallel-safe: new directory only) [x]

```
GOAL
Vendor a minimal-but-realistic Java 17 / Spring Boot 3 / Maven service into
evals/target_java/ with a fast/slow gate split — so slim pipelines can validate pom.xml
gate resolution and slow-gate (Testcontainers) economics on a real JVM app. Production
scaffold, minimal size.

SCOPE
- evals/target_java/ ONLY. Zero edits outside it.
- Mirror the vendoring spirit of evals/target_backend (self-contained, no external refs).
- DON'T REBUILD: no CI config, no Dockerfile for the app itself, no multi-module split.

WHAT TO BUILD
1. Toolchain check FIRST: java -version, mvn -version, docker info. If JDK/Maven missing:
   still write every file, skip execution, and say so plainly in the report. Do NOT install
   anything (no brew/sdkman).
2. Spring Boot 3.x single-module Maven app, Java 17: one entity (Note), Spring Data JPA
   repository, REST controller (create/get/list), Postgres driver. ~6-10 source files.
3. Unit tests (JUnit 5, mockito or slice tests, NO Docker/Spring context where avoidable)
   for service/controller logic — the FAST gate, runnable via `mvn -q test`.
4. One Testcontainers-Postgres integration test (@SpringBootTest), named *IT with
   maven-failsafe so `mvn test` excludes it and `mvn verify` runs it — the SLOW gate.
5. evals/target_java/adw_gates.json matching docs/slim-pipelines-plan.md §6.3:
   compile → "mvn -q -DskipTests compile"; unit → "mvn -q test";
   integration → "mvn -q verify", slow: true, timeout_s: 1800.
6. evals/target_java/README.md: purpose (one line), prereqs (JDK 17, Maven, Docker for the
   slow gate only), the three gate commands.

KNOWN GAPS — flag, don't fix
Not wired into eval task YAMLs / run_eval.py — deliberate; eval-task minting is a later
milestone.

VERIFICATION (only what the toolchain allows)
cd evals/target_java && mvn -q test → green without Docker.
If Docker running: mvn -q verify → green. Paste real output tails; if toolchain absent,
report exactly which check stopped you.

DECISION GATE
- Deliverable: file tree + toolchain report + which gates were executed vs written-only.
- STOP: do not touch eval runner configs.
```
