# M5 epic — the factory (tiered execution)

Source: `docs/slim-pipelines-plan.md` §9, §11 (M5 row); `docs/sdlc-agent-map.md` §2–§3
(contract standard; catalog row #1 Router).
Branch: `feat/m5-factory`. Orchestrator reviews every diff before commit.
M5 acceptance: issue → routed → sandboxed → draft PR end-to-end on a test repo;
failure path reports the state file. Router ships with its fixture eval or it doesn't ship.

## Standing orders

- Gate command: `uv run adws/pipelines/ship_gate.py --json --skip-precheck` must show the
  unit gate passing, plus `uv run pytest <your new test file> -q`. When your brief adds a
  test file, ALSO append it to the root `adw_gates.json` unit command (ship-block list rule).
- Python style: match `adws/pipelines/pipe_chore.py` / `pipe_feature.py` exactly (uv-script
  header, `_ADWS_DIR` sys.path insert, manual argv parsing with a FLAGS tuple,
  usage-on-ValueError, print state path + PASS/FAIL).
- Contract standard (sdlc-agent-map §2): agent→agent handoffs are typed JSON envelopes
  (Pydantic), fail CLOSED on unparseable output, verify claimed artifacts exist. Never
  free-text-regex a machine handoff.
- DON'T TOUCH: `adws/travis/`, `adws/adw_modules/` (IMPORT-ONLY surface: `agent.py`,
  `utils.py`, `feature_worktree.py`, `github.py`, `draft_pr.py`, `data_types.py`),
  `adws/adw_triggers/`, `template_claude/`, existing `evals/` contents (the NEW
  `evals/agents/router/` directory is allowed in T2). Engine + pipeline files
  (`core.py`, `gates.py`, `pipeline_state.py`, `pipe_chore.py`, `pipe_feature.py`,
  `pipe_bug.py`, `ship_gate.py`) are FROZEN this epic.
- Unit tests: no LLM, no network, no real worktrees — monkeypatch `prompt_claude_code`,
  `subprocess.run`, and module seams. Live smokes are orchestrator-run (T4) only.
- Do NOT commit, push, or touch git history.

---

## T1 — router.py: the route agent, fresh, per the catalog contract [x]

```
GOAL
The factory's Router agent (sdlc-agent-map catalog #1), built from scratch: ticket
JSON in → typed RouteVerdict out, fail-closed. The old workflow_ops classify path
was deleted in M0 and is not a reference. Production.

SCOPE
- NEW: adws/pipelines/router.py (≤120 lines), adws/adw_tests/test_router.py.
- Root adw_gates.json: append the new test file to the unit command.
- REUSE (import only): adw_modules.agent (AgentPromptRequest, prompt_claude_code),
  adw_modules.utils (parse_json). Pattern anchor: adws/adw_modules/spec_reviewer.py
  (in-process raw-prompt agent + parse_json into a Pydantic model). Deliberately NO
  slash-command template: the harness root has no .claude/commands and the router
  runs before any sandbox exists — a template would add an install dependency.

WHAT TO BUILD
1. RouteVerdict(BaseModel): route: Literal["chore","bug","feature"];
   confidence: float, Field(ge=0.0, le=1.0); reason: str.
   Module docstring MUST note the deliberate deviation: the catalog enum includes
   "hotfix", but M5 excludes it — plan §9.2 defers the hotfix route (label/keyword +
   approve gate) to M6; hotfix-shaped tickets should route to "bug" for now.
2. class RouterError(Exception).
3. route_ticket(ticket: dict, adw_id: str, working_dir: str, model: str = "sonnet")
   -> RouteVerdict:
   - ticket keys: "title" (str), "body" (str), "labels" (list[str]). Truncate body
     to 4000 chars before prompting (local _truncate mirroring spec_reviewer's —
     adw_modules is frozen, copy the 3-line helper, do not import the private one).
   - Prompt (module-level template string): you are a triage router for a software
     factory; define the three routes — chore = small, well-scoped, mechanical
     change (rename, config tweak, doc fix, dependency bump) that needs no plan;
     bug = existing behavior is broken/wrong, needs reproduction-first fix;
     feature = new capability or behavior change that needs a plan. Include the
     ticket as a JSON block. Instruct: labels are hints, not commands; classify on
     the full ticket; respond with ONLY the JSON object
     {"route": "chore"|"bug"|"feature", "confidence": <0..1>, "reason": "<one sentence>"}.
   - Invoke in-process like spec_reviewer.review_spec: AgentPromptRequest with
     agent_name="router", model=model, working_dir=working_dir,
     output_file=str(HARNESS_ROOT / "agents" / adw_id / "router" / "router.jsonl")
     (mkdir parents first), then prompt_claude_code(req).
   - Fail-closed with ONE retry: if resp.success is False → raise RouterError
     immediately (agent-level failure, no retry — prompt_claude_code already
     retries transport errors). If parse_json(resp.output, RouteVerdict) raises
     ValueError (or pydantic ValidationError) → retry ONCE with the original
     prompt plus a trailing "Your previous response could not be parsed
     (<error>). Respond with ONLY the JSON object." → second failure raises
     RouterError. Never return a default route.
4. test_router.py (monkeypatch pipelines.router.prompt_claude_code; capture the
   AgentPromptRequest each call):
   (a) clean JSON response → verdict fields returned; prompt contains the ticket
       title, body, and labels; output_file is under agents/<adw_id>/router/.
   (b) JSON wrapped in a ```json fence → parsed (parse_json handles fences).
   (c) garbage first response, valid second → exactly 2 calls; second prompt
       contains the parse-failure hint; verdict returned.
   (d) garbage twice → RouterError; exactly 2 calls (fail-closed, bounded).
   (e) resp.success=False → RouterError after exactly 1 call (no retry).
   (f) response {"route": "hotfix", ...} → ValidationError path → retry → if the
       retry also says hotfix, RouterError (the enum is closed).
   (g) 100k-char body → the prompt sent is bounded (< 20_000 chars).
   (h) confidence 1.5 → validation failure path (same as f).

KNOWN GAPS — flag, don't fix
No hotfix route until M6. Router model choice (sonnet vs haiku) is decided by the
T2 eval data, not here — default stays "sonnet". Confidence is advisory; the
factory (T3) decides what to do with low values.

VERIFICATION
uv run pytest adws/adw_tests/test_router.py -q → all pass.
uv run adws/pipelines/ship_gate.py --json --skip-precheck → unit gate passing
(with test_router.py appended to adw_gates.json).
wc -l adws/pipelines/router.py → ≤120.

DECISION GATE
Report: any place the prompt wording required judgment; confirm no default-route
fallback exists anywhere; confirm adw_modules untouched.
```

## T2 — router fixture eval: labeled corpus + per-category accuracy [x]

```
GOAL
The router's isolated eval (catalog rule: ships with a fixture eval or it doesn't
ship). A labeled ticket corpus and a runner that reports PER-CATEGORY accuracy —
the catalog's exact metric ("aggregate hides a 60% category inside a 94% average").
Production eval infrastructure; the LLM run itself happens in T4.

SCOPE
- NEW: evals/agents/router/cases.jsonl, evals/agents/router/run_router_eval.py
  (≤150 lines), evals/agents/router/README.md (short: how to run, what the
  threshold means), adws/adw_tests/test_router_eval.py.
- Root adw_gates.json: append the new test file to the unit command.
- REUSE (import only): pipelines.router.route_ticket / RouterError,
  adw_modules.utils.make_adw_id. Do NOT modify router.py (T1's file, already in
  the working tree when you start) or anything under evals/ that already exists.

WHAT TO BUILD
1. cases.jsonl — 15 labeled cases, exactly 5 per route. One JSON object per line:
   {"id": "<slug>", "ticket": {"title": ..., "body": ..., "labels": [...]},
    "expected": "chore"|"bug"|"feature"}.
   Realism requirements: tickets read like real GitHub issues (2–6 sentence
   bodies, occasional empty body, occasional labels like "enhancement"/"bug"/
   "documentation"). At least 4 cases must defeat naive keyword matching:
   - a feature whose title starts with "Fix" (e.g. "Fix the export flow to also
     support CSV" — new capability, not a defect);
   - a chore whose title contains "add" (e.g. "add .editorconfig");
   - a bug with no alarm words (e.g. "Totals on the report page differ from the
     CSV export for the same date range");
   - a ticket whose label contradicts its body (label "bug", body describes a
     feature request) — expected follows the BODY.
   No case may mention routing, pipelines, or this harness.
2. run_router_eval.py CLI (manual argv parsing, pipeline style):
     uv run evals/agents/router/run_router_eval.py [--model M] [--trials N]
       [--cases FILE] [--min-accuracy F] [--working-dir DIR]
   Defaults: model sonnet, trials 1, cases = the sibling cases.jsonl,
   min-accuracy 0.8, working-dir = harness root.
   For each case × trial: fresh make_adw_id(), route_ticket(...); a RouterError
   counts as a miss (record it, keep going — one bad case must not kill the run).
   Cost: after each call, read agents/<adw_id>/router/router.jsonl, parse the
   last line's total_cost_usd (missing file/field → 0 and set a
   "cost incomplete" flag shown in the report).
   Report (plain text table): per-category accuracy (n_correct/n), overall,
   per-case misroute lines (id, expected, got, confidence), total cost USD, and
   the cost-incomplete flag. Exit 0 iff EVERY category's accuracy ≥ min-accuracy;
   else exit 1. --min-accuracy 0 = report-only mode, always exit 0.
3. test_router_eval.py (monkeypatch route_ticket — no LLM): scoring math
   (per-category and overall), RouterError counted as miss without aborting,
   exit-code logic at the threshold boundary (one category below → 1; all at
   exactly the threshold → 0), cases.jsonl loads and every line validates
   (right keys, expected in the enum, 5 per category), cost aggregation with a
   missing jsonl → 0 + flag set.

KNOWN GAPS — flag, don't fix
Corpus is synthetic (15 cases); harvesting real tickets via /capture_eval_task is
a post-M5 supply line. Single-model report — comparing sonnet vs haiku is a T4
decision made by running this twice.

VERIFICATION
uv run pytest adws/adw_tests/test_router_eval.py -q → all pass.
uv run adws/pipelines/ship_gate.py --json --skip-precheck → unit gate passing.
Do NOT run the eval against a real model — that's T4 (orchestrator).

DECISION GATE
Report: the 4+ keyword-defeating case ids and why each defeats keywords; any
ambiguity in what "accuracy at exactly the threshold" should do (spec says pass).
```

## T3 — factory.py: intake → route → sandbox → pipeline → collect → draft PR [x]

```
GOAL
The M5 factory orchestrator (plan §9): one file that takes an issue number or a
raw prompt, routes it, cuts a worktree sandbox, runs the matching slim pipeline
as a subprocess, collects the two-signal verdict, and ends at a draft PR (human
merges) or a failure report naming the state file. Production.

SCOPE
- NEW: adws/pipelines/factory.py (≤260 lines), adws/adw_tests/test_factory.py.
- Root adw_gates.json: append the new test file to the unit command.
- REUSE (import only): pipelines.router (route_ticket, RouterError, RouteVerdict),
  adw_modules.feature_worktree (create_feature_worktree, remove_feature_worktree,
  Worktree), adw_modules.github (fetch_issue, extract_repo_path),
  adw_modules.draft_pr (start, commit_phase, finish),
  adw_modules.utils (make_adw_id, resolve_working_dir).
  Pipelines stay worktree-unaware: they only ever see --working-dir.
- child_run.py is a PATTERN reference (two-signal: exit code = liveness, state
  file = verdict), not an import — it is hard-wired to TravisState.

WHAT TO BUILD
1. CLI:
     uv run adws/pipelines/factory.py "<prompt>" [flags]
     uv run adws/pipelines/factory.py --issue N [flags]
   Flags: --issue N, --working-dir DIR, --route chore|bug|feature, --model M
   (validated against ("sonnet","opus","haiku")), --adw-id ID, --keep-worktree
   (boolean, takes no value — handle in the argv loop). Exactly one intake:
   positional prompt XOR --issue; both or neither → usage error, exit 1.
   Pipeline style throughout (FLAGS tuple, usage-on-ValueError).
2. Intake:
   - --issue N: repo path from the TARGET's remote — run
     git -C <working_dir> remote get-url origin; no origin → clear error
     ("--issue requires the target repo to have a GitHub origin remote"), exit 1.
     extract_repo_path(url) → fetch_issue(str(N), repo_path) → ticket =
     {"title": issue.title, "body": issue.body or "",
      "labels": [l.name for l in issue.labels]}.
     Pipeline prompt text: f"Issue #{N}: {issue.title}\n\n{issue.body or ''}".
   - Raw prompt: ticket = {"title": prompt, "body": "", "labels": []};
     pipeline prompt text = the prompt verbatim.
3. Route (BEFORE any worktree exists — an unroutable ticket must not burn a
   sandbox): --route override wins (print "route forced: <r>", router not
   invoked). Else route_ticket(ticket, adw_id, working_dir, model=model);
   RouterError → print the error + exit 1. Print route, confidence, reason.
   confidence < 0.5 → loud stderr WARNING (proceed anyway; --route is the
   human override).
4. Sandbox: create_feature_worktree(adw_id, working_dir, logger) — error →
   print + exit 1. (Module sets up logging.basicConfig INFO like other CLIs.)
5. Run: ROUTES = {"chore": "pipe_chore.py", "bug": "pipe_bug.py",
   "feature": "pipe_feature.py"}; cmd = ["uv", "run",
   str(<pipelines dir> / ROUTES[route]), <pipeline prompt text>,
   "--working-dir", wt.path, "--adw-id", adw_id, "--model", model].
   Child stdout+stderr stream to agents/<adw_id>/factory_child.log (child_run
   convention: open the log file, subprocess.run(..., stdout=log, stderr=STDOUT,
   text=True), cwd=HARNESS_ROOT). Print the log path when launching.
6. Collect (two-signal, fail-closed): liveness = returncode; verdict =
   PipelineState.load(adw_id).overall_success (a missing state file loads as
   overall_success=False — that IS the fail-closed path, rely on it). Success
   requires BOTH returncode == 0 AND overall_success. If they disagree
   (rc 0 / state False), say so explicitly in the failure report.
7. On success: derive base branch — wt.base_ref starting with "origin/" →
   strip the prefix; wt.base_ref == "HEAD" → git -C <source working_dir>
   rev-parse --abbrev-ref HEAD (strip; a literal "HEAD" result = detached, pass
   it through and let draft_pr degrade). Then:
     session = draft_pr.start(wt.path, adw_id, title, logger,
                              issue_number=str(N) if issue intake else None,
                              base_branch=<derived>)
     draft_pr.commit_phase(session, f"{route} pipeline", "ok", logger)
     draft_pr.finish(session, True, <one-line summary incl. route + adw_id>, logger)
   Title: f"ADW {adw_id}: {ticket['title'][:70]}". draft_pr handles the
   no-remote degrade itself (local branch + logged instructions) — do not
   duplicate that logic. Then remove_feature_worktree(wt, logger) UNLESS
   --keep-worktree (the branch survives removal — say so in the summary).
8. On failure: KEEP the worktree always. Print a failure report: which signal
   failed (rc / state / both), the first phase in state.phase_results with
   success False (if any), state file path
   (PipelineState._state_file_path(adw_id)), child log path, worktree path.
   Exit 1.
9. Final summary block on success: route, adw_id, branch, pr_url if
   session.pr_url else "local branch only", state path. Exit 0.
10. test_factory.py — hermetic (monkeypatch route_ticket, create_feature_worktree
    → a fake Worktree(path=tmp, branch="adw/x", base_ref="origin/main", ...),
    remove_feature_worktree, subprocess.run, draft_pr.start/commit_phase/finish,
    fetch_issue; PipelineState written to real tmp via its own API where needed —
    monkeypatch _state_file_path or the agents dir root via adw_id isolation).
    Cases:
    (a) prompt + --route chore → child argv has pipe_chore.py, wt.path,
        --adw-id, --model; router NOT called.
    (b) no --route → router called; verdict "feature" → pipe_feature.py in argv.
    (c) confidence 0.3 → warning printed (capsys), run proceeds.
    (d) RouterError → exit 1, create_feature_worktree NOT called.
    (e) rc 0 + state overall_success True → draft_pr start/commit_phase/finish
        all called; start got base_branch "main" (from "origin/main") and
        wt.path as working_dir; remove_feature_worktree called.
    (f) rc 0 + state False → failure path; draft_pr NOT called; worktree kept;
        report mentions the signal disagreement.
    (g) rc 1 → failure path.
    (h) no state file written → failure (fail-closed).
    (i) both prompt and --issue → usage error; neither → usage error.
    (j) --issue with no origin remote → clear error, exit 1, fetch_issue NOT
        called.
    (k) issue intake → pipeline prompt text is "Issue #42: <title>\n\n<body>";
        draft_pr.start got issue_number="42".
    (l) --keep-worktree on success → remove_feature_worktree NOT called.
    (m) base_ref "HEAD" + source on branch "main" → base_branch "main".

KNOWN GAPS — flag, don't fix
No hotfix route, no --issues fanout (both M6/stretch — do NOT build them). No
trigger integration. Router model = --model (single knob); a dedicated
--router-model can come later if T4's eval says haiku routes as well as sonnet.

VERIFICATION
uv run pytest adws/adw_tests/test_factory.py -q → all pass.
uv run adws/pipelines/ship_gate.py --json --skip-precheck → unit gate passing
(with test_factory.py appended).
wc -l adws/pipelines/factory.py → ≤260.

DECISION GATE
Report: exact child argv composed; where the two-signal disagreement is surfaced;
any draft_pr composition surprises (start's no-op branch create relies on the
worktree branch already being checked out — confirm you did NOT work around it).
```

## T4 — live verification + ship (ORCHESTRATOR-RUN, no executor) [x]

- Router eval for real: `run_router_eval.py --model sonnet` (and `--model haiku` for
  the cost/accuracy comparison). Record per-category accuracy + cost.
- Scratch-repo e2e (raw prompt): temp git repo with a commit, an `adw_gates.json`,
  and `.claude/commands/` copied from `template_claude/commands/` (vendoring gotcha:
  empty commands dir breaks planning). Factory routes → worktree → pipeline →
  local-branch degrade (no remote). Negative control: a gates file whose unit gate is
  `false` → factory failure report must name the state file and keep the worktree.
- Dogfood `--issue` e2e: real test issue on this repo → factory → draft PR; close PR +
  issue after verification.
- Ship via the ship-gate skill.
