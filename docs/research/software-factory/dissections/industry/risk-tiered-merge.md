# Risk-tiered merge policy

**Source workflow:** Industry composite: Cursor, Factory, OpenAI, StrongDM, Anthropic, GitHub, Meta, Google, plus poteto (pstack) and Pocock as practitioner references. **Stages:** Merge, Human gates (with inputs from Review and Verify).
**Primary sources:** URLs and local paths are cited inline. Labels: **[primary]** means the organization describing its own practice or its product docs. **[vendor]** means a vendor describing practice that it also sells. **[secondary]** means a third party reporting on someone else. Fetched 2026-10-24.

Local files read:
- `adws/adw_modules/risk_gate.py`, `adws/adw_modules/agent.py:600`, `adws/adw_modules/draft_pr.py:344-366`
- `adws/pipelines/ship_gate.py`, `.claude/skills/ship-gate/SKILL.md`, `.claude/skills/verify/SKILL.md`
- `adw_gates.json`, `evals/target_java/adw_gates.json`, `CONTEXT.md`
- `~/.claude/plugins/cache/cursor-plugins/pstack/0.15.28/skills/blast-radius/SKILL.md`
- `.../pstack/0.15.28/skills/poteto-mode/SKILL.md`, `playbooks/{autopilot-full,autopilot-stack,shipping}.md`, `skills/principle-never-block-on-the-human/SKILL.md`
- `~/.claude/skills/pr/SKILL.md`

The input research was `../../concepts/software-factory-concept.md` §7 "Risk tiering", `../../workflow-map.md` §4.1, `../../decisions-to-grill.md` Tier 1 and `../../workflows/adw/overview.md`. This dissection replaces their vendor and secondary claims with primary reads where a primary source could be fetched.

---

## 1. What it is

A risk-tiered merge policy sorts each PR into a class before merge, then attaches a different evidence bar and a different merger to each class. The low classes merge on agent verification alone. The high classes still wait for a human. The problem it removes is the all-or-nothing choice between two bad options. Option one is to review every agent PR, which makes the human the throughput limit (OpenAI: "Most of the human review is post merge at this point", [Latent Space](https://www.latent.space/p/harness-eng) [secondary]). Option two is to review none, which is StrongDM's rule ("Code must not be reviewed by humans", [StrongDM](https://factory.strongdm.ai/) [primary]) and needs an oracle most teams don't have. Every source that publishes a policy ends up tiering. Anthropic says "We tier our codebase by risk, and make deliberate decisions on what parts to automate" ([Anthropic, Jul 2026](https://claude.com/blog/how-anthropic-secures-its-ai-native-software-development-lifecycle) [primary]).

**Key finding for ADW: its "risk gate" is not a merge-risk tier.** `adws/adw_modules/risk_gate.py` is a PreToolUse deny-list on *actions*, such as force push, `sudo` and `npm publish`. It does not look at the *diff*. Today ADW has no classification of changes at all, and every PR goes to the human (`draft_pr.py:360`: "human approval required before merge").

---

## 2. Where it lives

| Source | Artifact that defines the policy | Role |
|---|---|---|
| Cursor PR Routing & Approval | `APPROVAL_POLICY.md` per directory (nearest ancestor wins) and `.cursor/approval-policies/ROUTING.md` (a YAML list of `product`, `boundary`, `policies`) ([docs](https://cursor.com/docs/approval-agents) [primary/vendor]) | Policy the approval agent reads per changed file |
| Cursor "Assess PR risk and assign reviewers" template | Automation prompt with 5 risk levels ([template](https://cursor.com/workflows/autonomous-agents/assign-pr-reviewers) [vendor]) | LLM classifier plus approver |
| Cursor Bugbot | `.cursor/config/bugbot.yaml`: triggers, effort, PR summary, **risk score** ([release notes, wk of Sep 28 2026](https://cursor.com/docs/release-notes/bugbot) [primary/vendor]) | Finding source plus low/medium/high risk block in the PR summary |
| Factory | GitHub CODEOWNERS plus branch protection ([Factory, Sep 24 2026](https://factory.com/articles/reviewing-agent-generated-pull-requests) [vendor]) | Routes sensitive paths to owning teams |
| OpenAI | `$land` skill plus reviewer-agent instructions plus merge queue; release branch and smoke test ([Latent Space](https://www.latent.space/p/harness-eng) [secondary]). The primary post at openai.com/index/harness-engineering returned 403 and was **not read**. | Merges by agent; the human gate sits at release |
| StrongDM | Charter rules ([factory.strongdm.ai](https://factory.strongdm.ai/) [primary]) | No tiers. Holdout scenarios plus a satisfaction score stand in for review |
| Anthropic | Internal policy, described in prose only ([Clinton, Jul 21 2026](https://claude.com/blog/how-anthropic-secures-its-ai-native-software-development-lifecycle) [primary]) | Codebase tiered by risk; human review kept for "regulated or truly critical code" |
| GitHub | `CODEOWNERS`, rulesets (required approvals, code-owner review, **required reviewer rule by file pattern**, status checks, merge queue), auto-merge ([rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), [CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners), [changelog Feb 17 2026](https://github.blog/changelog/2026-02-17-required-reviewer-rule-is-now-generally-available/) [primary]) | The enforcement layer every other source sits on |
| Meta | Diff Risk Score (DRS): fine-tuned Llama, served through a "Risk Awareness Platform" ([Meta, Aug 2025](https://engineering.fb.com/2025/08/06/developer-tools/diff-risk-score-drs-ai-risk-aware-software-development-meta/) [primary]) | Learned incident-probability score per diff |
| Google | `OWNERS` files plus LGTM plus readability; "global approvers" for large-scale changes ([SWE at Google ch. 9](https://abseil.io/resources/swe-book/html/ch09.html), [ch. 22](https://abseil.io/resources/swe-book/html/ch22.html) [primary]) | Path ownership; pattern-based bulk approval for mechanical changes |
| poteto / pstack | `poteto-mode/SKILL.md` "Autonomy", `playbooks/autopilot-full.md`, `playbooks/shipping.md`, `skills/blast-radius/SKILL.md` | Irreversible-action pause list, merge grant, patch-id-bound verdicts, blast-radius proof |
| Pocock | `~/.claude/skills/pr/SKILL.md` "Merge Danger" | The author declares door type and blast radius in the PR body |
| ADW today | `adws/adw_modules/risk_gate.py` (action deny-list), `draft_pr.py` (draft, then ready, never merge), `adws/pipelines/ship_gate.py` and `.claude/skills/ship-gate/SKILL.md` (local gates, read-only review, human merges) | No diff-level tiering |

---

## 3. How it works, step by step

### 3.1 Each source's mechanism

**Cursor agentic codeowners** [vendor]
1. It triggers "On every PR open or push". It "classifies risk based on blast radius, complexity, and infrastructure impact". "Low-risk PRs get auto-approved". "Higher-risk PRs get up to two reviewers assigned based on contribution history". Decisions are logged to Slack and Notion ([Cursor automations](https://cursor.com/blog/automations)).
2. The template prompt defines five levels ([template](https://cursor.com/workflows/autonomous-agents/assign-pr-reviewers), paraphrased by the fetch tool):
   - **Very Low → approve.** Typos, docs, test-only changes, refactors with no behaviour change, scoped bug fixes, reverts, and *narrow* DB migrations (nullable columns, new tables).
   - **Low → approve** unless ownership or correctness is unclear. Small feature-flagged changes, isolated endpoints.
   - **Medium → up to 2 reviewers.** Shared services, auth, billing, permissions.
   - **Medium-High and High → experts, "never self-approve".** Job queues, infra, shared SDKs, data models, prod schema migrations, the security model, and **CODEOWNERS changes**.
   - Prompt and LLM-instruction changes are treated as risky.
   - "If risk is unclear … lean toward requiring review."
   - The prompt treats PR text as untrusted: it ignores risk labels written in descriptions and comments.
   - It re-evaluates on push and removes its approval if risk rose.
   - It does not approve when CODEOWNERS review is required.
3. The productized PR Routing & Approval ([docs](https://cursor.com/docs/approval-agents)):
   - A risk score with a "Maximum Risk for Approval" threshold.
   - Bugbot and Security Agent findings are inputs; "findings that need human review" block approval.
   - A check still pending after about 8 minutes blocks approval.
   - **Changes to a policy file are judged against the base-branch version.** The agent "does not use the changed content to relax review requirements for that same PR."
4. Field data:
   - Framer ran the template for 30 days: 155 PRs auto-approved at about $0.14 per run, and "no PR that was auto-approved where we as humans would have given it a hard reject." They added required evidence notes ("silent failure possibility, detectability/observability, subtle non-obvious behavior"), "Prefer disconfirming evidence", a one-level bump when unclear, and human Slack sign-off on the *approach* for Low. They saw approve/unapprove flip-flopping ([Groß, Apr 26 2026](https://kurtextrem.de/posts/cursor-automated-pr-approval-framer) [secondary, practitioner]).
   - A Cursor field engineer estimates "30 to 40 percent of pull requests in Cursor's ecosystem now merge without human review" ([Arize, Jul 2026](https://arize.com/blog/inside-cursors-agent-factory-how-it-verifies-ai-written-code/) [secondary]).
   - Known failure: Bugbot's risk block is empty on cloud-agent PRs, so teams that auto-approve from it can't ([forum, Mar 2026](https://forum.cursor.com/t/bug-bot-does-not-update-github-pr-description-with-risk-level-when-pr-is-created-via-cloud-agent/154445) [primary/vendor staff reply]).

**Factory** [vendor]: "Use ownership rules to identify the teams responsible for sensitive paths". "Apply stricter requirements to authentication, billing, deployment, and data migration paths". Automated review "does not replace ownership or approval". For production-facing changes, check "whether permissions became broader, whether a migration preserves compatibility, and whether operational evidence exists", plus rollback plans. Measure "review wait time, change-request rate, escaped defects, and revert rate by task class" ([Factory](https://factory.com/articles/reviewing-agent-generated-pull-requests)). There is no tier table, only a path list plus CODEOWNERS.

**OpenAI** [secondary; primary unread]
- Reviewer agents "bias toward merging … not to surface anything greater than a P two". P0 is the "don't merge this" level.
- The author agent may "defer or push back against review feedback" because it was "willing to be bullied by the PR reviewer".
- `$land` waits for "human and agent reviewers" and green CI, fixes flakes, and puts the PR in the merge queue.
- "Most of the human review is post merge". Lopopolo samples merged code instead of reviewing every PR.
- The human gate is the release: "a human in the loop for cutting the release branch" and "a blessed human approved smoke test of the app before we promote it to distribution" ([Latent Space](https://www.latent.space/p/harness-eng)).
- A survey paraphrases the post as "minimally blocking merge strategy", with "test flakes are handled in subsequent runs" and "Waiting is more expensive than correcting errors" ([yage.ai survey](https://yage.ai/share/harness-engineering-survey-en-20260312.html) [secondary]).
- OpenAI tiers by **severity of finding**, not by **class of change**.

**StrongDM** [primary]: "Code must not be written by humans" and "Code must not be reviewed by humans". The safeguard is holdout scenarios stored outside the codebase, because "A test, stored in the codebase, can be lazily rewritten to match the code", plus a probabilistic "satisfaction" score ([factory.strongdm.ai](https://factory.strongdm.ai/)). The principles page gates readiness on "the holdout scenarios pass (and stay passing)" ([principles](https://factory.strongdm.ai/principles)). StrongDM publishes **no risk classes and no merge rules.**

**Anthropic** [primary]
- "agents aren't merging code to production unchecked".
- "We tier our codebase by risk … reserving human review for regulated or truly critical code". "Entire codebases have strict human approval processes".
- "**Shadow mode** for all new AI reviewers. New agents post comments for human approval until trust is earned". New reviewers are red-teamed with planted malicious changes.
- Review agents must "write a proof that their finding is valid".
- The hard gate sits "at the test/CI stage" ([Clinton, Jul 21 2026](https://claude.com/blog/how-anthropic-secures-its-ai-native-software-development-lifecycle)).
- For the Code Review product: "It won't approve PRs — that's still a human call". Findings scale with size: PRs over 1,000 lines get findings 84% of the time, averaging 7.5 issues; PRs under 50 lines, 31% and 0.5 issues ([Anthropic, Mar 9 2026](https://claude.com/blog/code-review) [primary/vendor]).
- At the action level, Claude Code auto mode proceeds unless an action is "irreversible, destructive, or aimed outside your environment" ([TechCrunch, Mar 24 2026](https://techcrunch.com/2026/03/24/anthropic-hands-claude-code-more-control-but-keeps-it-on-a-leash/) [secondary]). That is the same split as ADW's `risk_gate.py`.

**GitHub native** [primary]
- **CODEOWNERS.** Owners are requested automatically, except on drafts, which wait until marked ready. "the last matching pattern takes the most precedence". Owners need explicit write access. Invalid lines "will be skipped". Give the CODEOWNERS file itself an owner ([docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)).
- **Rulesets** ([docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)):
  - Required approvals.
  - Code-owner review.
  - Stale-approval dismissal.
  - "approval from someone other than the last person to push".
  - **Required reviewers by file path**: "require review or approval from specific teams when a pull request changes certain files", with 0–10 approvals per team and `!` negation. GA Feb 17 2026. It "augments CODEOWNERS files but doesn't replace them" ([changelog](https://github.blog/changelog/2026-02-17-required-reviewer-rule-is-now-generally-available/)).
  - Required status checks. Note that "Any person or integration with write permissions … can set the state of any status check" unless the check is pinned to a source app.
  - Restricted file paths at push time.
  - A Copilot-authored PR needs one extra approval.
- **Merge queue.** It tests each PR on a temporary branch with the base plus the PRs ahead of it. CI "must use the `merge_group` event". Failing PRs are removed and the queue rebuilds ([docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)).
- **Auto-merge.** It "merges a pull request automatically after all required reviews and status checks pass". It turns off when someone without write access pushes ([docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request)).
- GitHub has **no notion of diff size, blast radius or reversibility**. It only knows paths, identities and checks.

**Meta DRS** [primary]: it "predicts the likelihood of a code change causing a production incident" from the diff and its metadata. It is used to relax code freezes ("10,000+ code changes" landed during a 2024 freeze "with minimal production impact"), and also for reviewer selection, test selection and release risk across 19 use cases. Meta says risk is understood "even imperfectly and at a statistical level" and publishes no accuracy numbers ([Meta](https://engineering.fb.com/2025/08/06/developer-tools/diff-risk-score-drs-ai-risk-aware-software-development-meta/)).

**Google** [primary]
- Every change needs LGTM, owner approval and readability ([ch. 9](https://abseil.io/resources/swe-book/html/ch09.html)). A "small" change is "about 200 lines of code".
- For large-scale mechanical changes, local owners see "only changes … for which their review is required for context". Everything else goes to a "global approver" who uses pattern tooling to "automatically approve ones that meet their expectations" and hand-checks the anomalies. Every shard first passes the full TAP run of transitive tests ([ch. 22](https://abseil.io/resources/swe-book/html/ch22.html)).
- This is the closest large-org precedent for "a mechanical class of change can skip local review if it is pattern-checked and fully tested."

**DORA** [primary]: AI adoption "negatively impacts software delivery stability and throughput". Fundamentals "like small batch sizes and robust testing remain crucial" ([2024 report](https://dora.dev/research/2024/dora-report/)). "working in small batches acts as a critical countermeasure to this risk", and "Any batch of code that takes longer than a week to complete and check is too big" ([capability](https://dora.dev/capabilities/working-in-small-batches/)). Secondary summaries give −7.2% stability per +25% AI adoption ([getdx](https://getdx.com/blog/2024-dora-report-summary-laura-tacho/) [secondary]). I did not verify that number against the PDF.

**poteto / pstack** [primary, practitioner]
- **Always pause** for "irreversible writes: force-push to shared branches, deploys, data deletion, customer messages" (`poteto-mode/SKILL.md` §Autonomy). The principle form is "Irreversible actions (force-push, delete production data, send external messages) still require confirmation. Reversible actions … proceed" (`principle-never-block-on-the-human/SKILL.md:13-14`).
- **Grant.** Autopilot-full covers only the queue's items: "items the operator names as theirs and PRs outside the queue stop at merge-ready" (`autopilot-full.md:7`).
- **Merge authority** is a non-author verdict on the exact patch: "Green CI alone never authorizes a merge" (`autopilot-full.md:17`). "Green CI and an approving bot review are not verdicts" (`shipping.md:5`). Use `git patch-id` to carry a verdict across rebases, then merge bottom-up and read back with `gh pr view --json state,mergedAt,baseRefName`, because "a requested auto-merge is not a merge" (`shipping.md:7-8`).
- **Gate loosening** ("a raised budget or an allowlist entry") needs a verifier's proof plus the root's countersign. "Never give or bypass an approval the forge enforces" (`autopilot-full.md:20`).
- **Autopilot-stack** is chosen "when the operator wants review before landing … or merge authority is withheld" (`autopilot-stack.md:10`).
- **blast-radius skill.** It rates the *proof* of safety, not the change: "Find the one fact it's safe because of", then prove it on a 5-rung ladder from "You said so. Worthless" up to "You reproduced it in the running app". It looks where grep stops: "a DB column, a wire format, another language reading the same bytes, a feature flag". It hands back a "Before you merge" cheapest repro (`blast-radius/SKILL.md`). It is `disable-model-invocation: true`, so it is a human-invoked review aid, not an automatic gate.

**Pocock** [primary, practitioner]: every PR body has a "Merge Danger" section. `**Door:** <one-way or two-way>` means "You can walk back through two-way doors, but not one-way doors. … Changes that involve destructive actions or hard-to-reverse decisions are one-way doors." `**Blast Radius:** <one-word description>` covers things like "layout shift, breakages for consumers" (`~/.claude/skills/pr/SKILL.md`). The author declares it and the human reader consumes it. It is not enforced.

### 3.2 Comparison: risk signals per source

✔ = explicit signal. ~ = implied or partial. — = not used or not stated.

| Signal | Cursor (template / product) | Factory | OpenAI | StrongDM | Anthropic | GitHub | Meta DRS | Google | pstack | Pocock |
|---|---|---|---|---|---|---|---|---|---|---|
| Paths / ownership | ✔ code ownership, policy per dir | ✔ CODEOWNERS | — | — | ✔ "tier our codebase" | ✔ CODEOWNERS, required reviewer by pattern | ~ metadata | ✔ OWNERS | ~ operator-named items | — |
| Diff size | ~ "small", "narrow" | — | — | — | ~ product data by size | — | ~ learned | ✔ ~200 lines | ~ "large new diff" re-swarm | — |
| Blast radius / complexity | ✔ named signal | — | — | — | — | — | ✔ learned | ~ "local context" | ✔ blast-radius skill | ✔ declared |
| Infra impact | ✔ named signal | ✔ deployment paths | — | — | — | — | ~ config risk (WIP) | — | ✔ deploys pause | — |
| Dependency changes | ~ "shared SDKs" | — | — | — | — | — | ~ | — | ✔ lockfile rule at merge | — |
| Migrations / data model | ✔ prod schema = High, *narrow = Very Low* | ✔ migration compatibility | — | — | — | — | — | — | ✔ data deletion pauses | ✔ destructive = one-way |
| Auth / billing / permissions | ✔ Medium→High | ✔ auth, billing, broadened permissions | — | — | ~ "regulated or truly critical" | ✔ example in changelog | — | — | — | — |
| Public API / consumers | ~ shared SDKs | — | — | — | — | — | — | — | ✔ wire format in blast-radius | ✔ "breakages for consumers" |
| Test-only / docs | ✔ Very Low | — | — | — | — | — | — | — | ✔ patch-id: tests/docs-only drift keeps verdict | — |
| Reversibility | ✔ reverts Very Low | ✔ rollback plan | ~ release gate | — | — | — | — | — | ✔ irreversible = pause | ✔ door type |
| Review findings severity | ✔ Bugbot / Security findings block | — | ✔ P0–P2 | — | ✔ proof-backed findings | — | — | — | ✔ non-author verdict | — |
| Policy / governance files | ✔ CODEOWNERS and policy changes = High, base-branch policy | — | — | — | — | ✔ own the CODEOWNERS file | — | — | ✔ gate loosening needs countersign | — |
| Prompt / agent-instruction files | ✔ risky | — | — | — | ✔ red-teamed reviewers | — | — | — | — | — |

### 3.3 What each tier gets

| Source | Low tier gets | High tier gets | Final backstop |
|---|---|---|---|
| Cursor | Auto-approve (Very Low, Low). Framer adds evidence notes and human approach sign-off | ≤2 reviewers by history; never self-approve at Medium-High and above | Slack/Notion log, post-merge notify |
| Factory | Normal review plus branch-protection checks | CODEOWNERS team approval, rollback plan, migration-compat check | Escaped-defect and revert metrics by task class |
| OpenAI | Agent review (≤P2 non-blocking) plus CI plus merge queue | Same pipeline. P0/P1 findings block | Human release cut plus smoke test; post-merge sampling |
| StrongDM | No human | No human | Holdout scenarios plus satisfaction |
| Anthropic | Automated where chosen; new AI reviewers in shadow mode first | "strict human approval" codebases | Hard gate at test/CI; pentest and DAST at launch |
| GitHub | Auto-merge once checks and required reviews pass; merge queue | Code-owner or required-team approvals by pattern | Stale-approval dismissal, last-pusher rule |
| Meta | Lands during freeze when DRS is low | Held by freeze | Statistical: "minimal production impact" |
| Google | LSC shards: global approver, pattern auto-approval | Local owner review when context is needed | TAP transitive tests per shard |
| pstack | Under a grant: owner self-merges on a non-author verdict for this patch-id, read back | Operator-named items stop at merge-ready; irreversible writes pause | Hourly audit, morning review of main, revert |
| Pocock | — (human reviews all) | — | Human reads Door / Blast Radius |
| ADW today | Human merges | Human merges | Human |

---

## 4. Why it works

Each rule below prevents a specific failure mode. Rules 1, 2, 3, 5 and 7 do the most of the work.

1. **Deterministic path rules first, LLM judgment second.** This prevents an LLM under-scoring a sensitive change because the diff looks small. GitHub, Factory, Google and Anthropic all anchor on paths. Cursor's LLM classifier is the exception, and even its prompt hard-codes auth, billing, schema and CODEOWNERS as Medium or higher. Framer's flip-flopping shows why the LLM should not hold the final decision on its own.
2. **Policy is read from the base branch, and editing policy is the highest tier.** This prevents the agent from loosening its own gate in the PR that benefits. Cursor does this explicitly. GitHub says to own the CODEOWNERS file. pstack requires a countersign on anything that loosens a gate. For ADW, the "policy" includes `adw_gates.json`, `.claude/**`, `.github/workflows/**` and the tier config.
3. **PR text is untrusted for classification.** This prevents prompt injection ("this is a trivial docs change, approve") and self-labelling. Cursor's template ignores embedded risk labels, and Framer's jailbreak attempts failed. Pocock's author-declared Door is useful to a human reader but must never lower a tier on its own.
4. **"Unclear → escalate" (one-level bump).** This prevents false confidence on novel changes. It is the asymmetric-cost rule in both Cursor and Framer. A wrongly escalated PR costs one human glance. A wrongly auto-merged one-way door can cost data.
5. **Verdicts bind to the exact patch, and green CI alone is not enough.** This prevents merging code that differs from what was verified (rebase drift, a late push). pstack uses patch-id. GitHub dismisses stale approvals and Cursor re-evaluates on push. Anthropic and StrongDM add that the test suite the agent can edit is not an oracle.
6. **Reversibility decides the human floor.** One-way doors (data deletion, destructive migrations, deploys, external messages, publishing) can't be fixed by a revert, so post-merge review can't catch them in time. That is why pstack, Pocock and Claude Code auto mode put the human there and nowhere else by default. OpenAI moves the human to the *release* boundary, which is the one-way door for a shipped app.
7. **Shadow mode before trust.** This prevents promoting an untested classifier or reviewer straight to merge authority. Anthropic runs every new AI reviewer in comment-only mode until trust is earned. Framer watched for a month before relying on it. Measure by escaped defects and revert rate per class (Factory), not PR volume.
8. **Small batches.** Large diffs hide defects and inflate review cost. DORA's countermeasure is to keep batches small. Anthropic's product data (over 1,000 lines: 84% have findings; under 50 lines: 31%) and Google's 200-line norm both support a size threshold in the tier rules.
9. **Severity-tiered *findings* stop review loops.** OpenAI's ≤P2-non-blocking rule plus author pushback prevents two agents ping-ponging forever. It is orthogonal to change tiers: it decides *which findings block*, not *which PRs need a human*.

---

## 5. Edge cases and failure handling

- **Classifier input missing.** Examples: base branch unknown, the diff fails, or the policy file is unreadable. Cursor's rule is to fall back to human review if the base policy "can't be determined". ADW should fail closed to the top tier.
- **A check never finishes.** Cursor does not approve after about 8 minutes pending. GitHub's merge queue treats a timeout as failure. Unattended, a hung check must not equal pass.
- **The head changes after classification or verdict.** Re-classify on every push (Cursor), dismiss stale approvals (GitHub), and compare patch-id (pstack). Auto-merge "lands whatever head is ready", so pstack arms `--auto` only when the verdict covers the current head.
- **The agent lies or games the oracle.** StrongDM: tests can be "lazily rewritten to match the code". Mitigations:
  - A test-only diff that *deletes or weakens* assertions is not low risk.
  - Keep holdout scenarios or a guarded verifier (ADW's `verify` plus `verify_guard.py`) outside the author's write path.
  - Anthropic requires reviewers to write proofs of findings.
- **The PR body tries to steer the classifier.** Ignore it and classify on the diff only (Cursor template).
- **Classifier flip-flop.** Framer saw approve/unapprove cycles. Fixes: deterministic rules, required evidence fields, and a rule that the LLM can only *raise* a tier.
- **Bot identity can't satisfy GitHub rules.** GitHub won't count an approval from the last pusher when "approval of most recent push" is on. Required-reviewer rules name *teams*, and members need write access. A solo user whose agent pushes with the user's own token **cannot approve that PR themselves**. The agent therefore needs its own identity (a machine user or GitHub App) for human-tier PRs to work. See §9.
- **Status checks can be spoofed.** Any writer can set a status unless the check is pinned to a source app (rulesets doc). An agent with a token could post its own "verified" status. Pin required checks to the CI app.
- **Merge reported but not landed.** pstack: a merge queue "only queued the PR", and "a requested auto-merge is not a merge". Read back `state, mergedAt, baseRefName`.
- **Flaky CI.** OpenAI fixes flakes or re-runs them. GitHub's "only merge non-failing pull requests" off lets a failing PR ride with a passing group. For auto-merge tiers, keep it **on**.
- **Post-merge defect in an auto tier.** The backstop is revert. That only works for two-way doors, which is why one-way doors must never be auto-tier.
- **Cursor's own bug.** The risk block is missing on cloud-agent PRs, which silently blocks auto-approval (forum). Any LLM-scored risk field can go missing, so treat absence as top tier.

---

## 6. Conflicts with other workflows

| Question | Choice A | Choice B | When each wins |
|---|---|---|---|
| Any human review at all? | StrongDM: none, with holdouts and satisfaction as the oracle | Anthropic: "agents aren't merging code to production unchecked"; human accountability "still central" | StrongDM wins only with an external scenario oracle and digital twins. Without those (ADW today), Anthropic's position holds. |
| Where does the human sit? | Per PR, by class (Cursor, Factory, GitHub) | At the release boundary (OpenAI smoke test) plus post-merge sampling | Release-gating fits apps with a release branch and no continuous deploy. Per-PR class gating fits services that deploy on merge, which is likely the user's Spring service. |
| Narrow migrations | Cursor template: Very Low, approve | Factory: stricter for "data migration paths"; pstack: data deletion pauses | Additive, nullable-column, new-table migrations are two-way doors only if rollback is proven. Default to Factory's stricter line until a migration rehearsal exists (§7). |
| Bias of reviewers | OpenAI: "bias toward merging", ≤P2 non-blocking | Cursor and Framer: "unclear → require review"; "Prefer disconfirming evidence" | OpenAI's bias applies to *findings within a class*. Cursor's applies to *class assignment*. Use both: escalate class when unsure, but don't let P2 nits block an auto-tier PR. |
| What authorizes a merge? | GitHub / OpenAI: required checks plus reviews, then the merge queue | pstack: only a non-author verdict on the patch; green CI never suffices | pstack's rule is stricter and suits agent self-merge. GitHub's suits human-reviewed tiers. ADW should require both for auto tiers. |
| Who declares risk? | Pocock: the author fills in Door and Blast Radius | Cursor: the classifier ignores author labels | The author declaration is a good *input to the human*. It never lowers a machine tier. |
| Merge by agent at all? | pstack Autopilot-full: owner merges under grant | ADW, Pocock, ship-gate: "Do not merge, do not enable auto-merge" (`.claude/skills/ship-gate/SKILL.md` step 4) | Today's ADW contract wins until CI, an in-pipeline verifier and a shadow period exist (`../../workflow-map.md` §merge adoption order). |
| Learned score vs rules | Meta DRS: learned incident probability | GitHub, Google, Factory: rules on paths | Learned scores need incident history. A solo developer has none, so rules first and LLM as a raise-only advisor. |

---

## 7. Porting to Claude Code and ADW

### 7.1 What ADW has today

- **`risk_gate.py`**:
  - A PreToolUse hook injected by `agent.py:600-602` when `ADW_RISK_GATE` is set (triggers, `travis_sdlc --risk-gate`).
  - It denies 13 Bash patterns (system `rm -rf`, `sudo`, force push, remote branch delete, `branch -D main`, global git config, `reset --hard origin/`, non-test `DROP`, curl-pipe-shell, credential paths, `npm/cargo publish`, `twine upload`, `gem push`, disk destruction, `chmod` on system paths) plus writes to `.ssh`, `.aws`, `.gnupg`, `.claude/settings*`, `/etc`, `/usr` and `authorized_keys`.
  - It logs denials to `ADW_RISK_LOG` and `ADW_PROGRESS_LOG`.
  - It is high-precision and low-recall by design. It has a `--selftest` fixture table.
  - **It gates actions during a run. It never looks at the resulting diff.** `factory.py` doesn't enable it (`../../workflows/adw/overview.md` §3.10).
- **`draft_pr.finish()`** (`draft_pr.py:344-366`) flips the PR to ready on success. It never merges. Travis-run review blockers keep the PR draft (`travis_sdlc.py:1522`).
- **`ship_gate.py`**: local preconditions plus the `adw_gates.json` gates, zero network, exit 0/1/2. The skill adds a read-only review, then push and PR, then "Human merges".
- **`verify` skill**: writes `.verify/<short-sha>/report.json` with `commit` and `verdict ∈ {VERIFIED, NOT VERIFIED, INCONCLUSIVE, FLAG}`. It is interactive only and not in the pipeline.
- **No CI** on this repo, no CODEOWNERS, no rulesets.

**What maps directly:**
- pstack's "always pause" list maps to `risk_gate.py`.
- Pocock's Door and Blast Radius map to the PR body that `draft_pr._render_body` writes.
- GitHub CODEOWNERS, required-reviewer rules and auto-merge are available to any repo.
- The verify verdict maps to pstack's verdict, but it needs patch-id binding.

**What has no equivalent:**
- A diff classifier.
- A merge step owned by the harness.
- Shadow logging.
- Post-merge revert automation.
- A tier policy file.

### 7.2 Proposed tier table for ADW

Tiers are computed as the **maximum** over all signals, so the highest signal wins. Detection is deterministic (globs over `git diff --name-status --find-renames base...head`, `--numstat`, and regexes over added and removed lines). An optional LLM pass (blast-radius style) may only **raise** the tier and must state the one fact it relies on.

| Tier | Name | Detection rule (deterministic unless noted) | Required evidence | Who merges | Rollback |
|---|---|---|---|---|---|
| **T0** | Inert | Every path matches `docs/**`, `*.md` (not `CLAUDE.md`, `AGENTS.md`, `SKILL.md`, `.claude/**`), comments-only diffs, or **added-only** test files. ≤200 changed lines. No deleted or modified assertions in existing tests. | Gates green on HEAD (`ship_gate.py` exit 0 or CI), review has no P0/P1. | Harness auto-merges (merge queue or `gh pr merge --squash`), then reads back. Shadow first. | `git revert` by agent on demand. |
| **T1** | Reversible internal | No T2/T3 match. Production code in non-sensitive paths. ≤400 changed lines and ≤15 files. No dependency, manifest, config or schema change. No public-API surface change (stack rules in §8). Modified tests allowed but flagged for hack check. | T0 evidence, **plus** an in-pipeline verify `VERIFIED` whose `patch_id` equals HEAD's `git patch-id`, **plus** a non-author reviewer with no blockers, plus the PR-body Door = two-way. | Harness auto-merges **after the shadow period**. Until then a human merges (one-click). | Agent opens a revert PR on any post-merge failure (CI on main, smoke, incident). The revert is itself T1. |
| **T2** | Contract or wiring | Any of: dependency or manifest changes (`pom.xml`, `build.gradle*`, `Cargo.toml`, `package.json` deps, lockfiles); config (`application*.yml`, `.env*`, feature-flag defaults); public API (controllers, OpenAPI, exported TS types, `pub` items in lib crates); transaction or concurrency semantics; >400 lines; LLM bump; any **missing or failed** classifier input. | T1 evidence, **plus** a blast-radius writeup with the one safety fact proven to rung ≥4 (a script or test run), plus a dependency diff summary (new transitive deps, licences). | **Human** approves. The harness may arm auto-merge after approval. | Revert PR. For config, the previous value is restored by a revert. |
| **T3** | One-way door / governance | Any of: DB migrations (create, modify, or **edit an applied migration**); authn/authz or security config; billing or payments paths; `unsafe`/FFI/`build.rs`; infra/deploy (`Dockerfile`, `k8s/**`, `terraform/**`, `helm/**`); CI and harness (`.github/**`, `adw_gates.json`, `.claude/**`, `CLAUDE.md`, the tier policy file, `CODEOWNERS`); secrets or credential handling; data deletion or backfills; anything that publishes or sends external messages. | T2 evidence, **plus** a written rollback or forward-fix plan in the PR body, plus for migrations a rehearsal on a prod-like snapshot (expand/contract proof, decision-to-grill #2), plus Door = one-way stated. | **Human**, enforced by GitHub: CODEOWNERS plus "require review from code owners" (or the required reviewer rule by pattern if the repo is in an org). The agent is never allowed to approve. | Pre-declared plan only. Revert may be impossible after data changes. |

Notes on the table:
- T0 and T1 thresholds (200 / 400 lines, 15 files) are proposals anchored on Google's "about 200 lines" and Anthropic's findings-by-size data. Calibrate them during shadow mode.
- Test-only is **T0 only when tests are added**. Edits that delete or loosen assertions go to T1 at least and trigger the verify skill's hack-flag check, because of StrongDM's reward-hacking warning.
- "Feature behind a flag" (DG Tier 1 #1) is T1 only if the flag *default* is unchanged. Flipping a default is T2 config.

### 7.3 Design sketch

**New: `adws/adw_modules/merge_tier.py`** (size M). This is the deterministic classifier.
- **Input:** `--base <ref> --head <ref> --repo <path>`.
- **Policy read:** `adw_merge_policy.json` from **the base ref** (`git show <base>:adw_merge_policy.json`). It never reads the working-tree copy (Cursor's rule).
- **Policy contents:** per-tier glob lists, `content_rules` (regexes applied to `+` and `-` lines with a path filter), and size thresholds. Ship stack presets for `spring`, `rust` and `node` (§8), selected by the same auto-detect `pipelines/gates.py` uses.
- **Output:** JSON `{tier, reasons:[{rule, path, line}], patch_id, base_sha, head_sha, policy_sha}` to `agents/<id>/merge_tier.json`.
- **Exit codes:** 0 to 3 = tier, 10 = classifier error (treated as T3 by callers).
- **`--selftest`** fixture table, mirroring `risk_gate.py`.
- **Fail closed:** unreadable policy, no merge-base, or binary-only files → T3 with reason `classifier-input-missing`.

**Wire into `draft_pr.finish()`** (size S):
- Call `merge_tier` after the final push.
- Render a "Merge Danger" section into the PR body: Door, Blast Radius and Tier with reasons, from Pocock's template, but **generated from the classifier**, not from the author agent.
- Add label `adw:tier-N`.
- The ready flip is unchanged.

**New: `adws/adw_modules/merge_step.py`** (size M). The harness merges; agents never do.
- Preconditions:
  - Tier ≤ `ADW_MERGE_GRANT` (default `-1`, meaning no merges).
  - CI required checks green on HEAD, pinned to the CI app.
  - For T1, `.verify/<sha>/report.json` `verdict == VERIFIED`, and `git patch-id` of the verified commit equals HEAD's.
  - No review blockers.
  - Shadow mode off for this tier.
- Action: `gh pr merge --squash --match-head-commit <sha>` (or enqueue), then read back `gh pr view --json state,mergedAt,baseRefName`, as in pstack `shipping.md:8`.
- Logs a row to `agents/merge-decisions.tsv`: date, PR, tier, reasons, evidence paths, action, shadow flag. This is the morning list (DG #14).

**Extend `risk_gate.py`** (size S). Add deny rules for `gh pr merge`, `gh pr review --approve`, `gh api .../merges`, `gh pr ready --undo` misuse, and `git push` to the default branch. With these rules, **merge authority lives only in `merge_step.py`**, not in any agent the hook covers. Also deny agent writes to `adw_merge_policy.json`, `CODEOWNERS` and `.github/workflows/**` during runs. This is the action-level complement to T3: the agent can't edit the gate it is judged by. A ticket that genuinely needs to change those files should be run with a human-acknowledged flag. Turn the risk gate on in `factory.py` (overview §5 item 4).

**Shadow mode** (size S). This is Anthropic's rule applied to the classifier. Run `merge_tier` plus `merge_step --dry-run` on every PR for N weeks while the human still merges everything. Record "would have auto-merged" next to what the human did (merged as-is, requested changes, reverted later). Promote a tier when its would-auto-merge PRs show zero human hard-rejects and zero reverts over the window. Framer's month with 0 hard rejects out of 155 is one data point for what "N" can look like.

**Ship-gate integration** (size S):
- `ship_gate.py --json` gains a `merge_tier` field by calling `merge_tier.py` locally (still zero network).
- `.claude/skills/ship-gate/SKILL.md` step 4 stays "Human merges" for this repo. The tier is printed in the PR body so the human can spend 10 seconds on T0 and real time on T3.
- For this repo specifically, `adws/**` is harness code that runs with `--dangerously-skip-permissions`, so most of it should be **T2 minimum**, and `risk_gate.py`, `merge_*.py` and `adw_gates.json` should be T3.

**GitHub configuration per target repo** (size S, one-time; a `wizard` candidate):
- A ruleset on the default branch: required status checks pinned to the CI app, stale-approval dismissal, require approval of most recent push, and "require review from code owners".
- `CODEOWNERS` listing only the T3 globs (plus `/.github/CODEOWNERS` itself) → the human.
- Merge queue (if available) with "only merge non-failing" on.
- A separate bot identity for ADW pushes, so the human's approval counts.

**Post-merge loop** (size L, later):
- A watcher on main CI and smoke (OpenAI's release smoke) that auto-opens revert PRs for T0/T1 merges inside a window.
- Per-tier metrics: revert rate, escaped defects, change-request rate (Factory's list), reported in the morning brief.
- A tier is demoted when its revert rate crosses a threshold.

**Order:**
1. CI on target repos.
2. `merge_tier.py` plus PR-body section plus label (no merging).
3. Shadow logging.
4. Risk-gate merge denies.
5. Verify in pipeline with patch-id.
6. Grant T0.
7. Grant T1 per project.

This matches the adoption order in `../../workflow-map.md`: self-merge comes last.

---

## 8. Stack adaptation

All patterns below are proposals for `adw_merge_policy.json` presets. "Content" rules match `+` and `-` diff lines in the given paths.

**Cross-stack (always T3):** `.github/**`, `CODEOWNERS`, `adw_gates.json`, `adw_merge_policy.json`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, `Dockerfile*`, `docker-compose*.yml`, `k8s/**`, `helm/**`, `terraform/**`, `*.tf`, `**/secrets/**`, and any `**/*billing*/**` or `**/*payment*/**`.

### Java / Spring Boot

| Pattern | Tier | Why |
|---|---|---|
| `**/db/migration/**` (Flyway `V*__*.sql`, `R__*.sql`, Java `V*__*.java`) | T3 | Schema is a one-way door once applied. Flyway validates checksums of applied migrations, so **modifying an existing `V` file** breaks every environment it already ran in. Flag modify/delete of existing migration files separately from adds. |
| `**/db/changelog/**`, `*changelog*.{xml,yaml,yml,sql}` (Liquibase) | T3 | Same. Changing an existing changeSet changes its checksum. |
| Content `spring.jpa.hibernate.ddl-auto`, `spring.flyway.*`, `spring.liquibase.*` in `application*.{yml,yaml,properties}` | T3 | Lets Hibernate or a migration tool mutate schema, or turns validation off. |
| `**/*Security*Config*.java`, content `SecurityFilterChain`, `@EnableWebSecurity`, `@EnableMethodSecurity`, `authorizeHttpRequests`, `permitAll`, `csrf(` | T3 | Authn/authz surface. Factory's "permissions became broader". |
| Content `@PreAuthorize`, `@PostAuthorize`, `@Secured`, `@RolesAllowed` added or removed | T3 | Method-level authorization. |
| Content `@Transactional` added, removed, or attribute changes (`propagation`, `isolation`, `readOnly`, `rollbackFor`) | T2 | Changes atomicity and locking, and is invisible in unit tests with mocks. Self-invocation and proxy rules mean a moved annotation can silently stop applying. Verify needs a real DB (Testcontainers). |
| `@Entity` classes, `**/domain/**` JPA mappings, `@Column`, `@Table` | T2 (T3 if `ddl-auto` is not `validate`/`none`) | Data model and mapping. |
| `@RestController` / `@*Mapping` path or signature changes, `**/openapi*.{yml,yaml,json}` | T2 | Public API for consumers. Pact contracts, if present, become required evidence. |
| `pom.xml`, `build.gradle*`, `gradle/libs.versions.toml`, `gradle-wrapper.properties` | T2 | Dependency and plugin changes; transitive CVEs. |
| `application*.{yml,properties}` (other keys), `@ConfigurationProperties` classes, `@Profile` | T2 | Config and wiring that fails at startup. A boot-smoke check is the cheap evidence (`../../concepts/software-factory-concept.md` §8). |
| Content `@Async`, `@Scheduled`, `@KafkaListener`, `@RabbitListener`, `@Cacheable` | T2 | Concurrency and side-effect timing. |
| `src/test/**` added only | T0 | — |

### Rust

| Pattern | Tier | Why |
|---|---|---|
| Content `^\+.*\bunsafe\b` (blocks, `unsafe fn`, `unsafe impl`) | T3 | Memory-safety guarantees move from the compiler to the author. |
| Content `extern "C"`, `#[no_mangle]`, `#[repr(C)]`, `bindgen`; paths `build.rs`, `*-sys/**`, `**/ffi/**`, `*.h`, `*.c` | T3 | FFI and ABI. `build.rs` runs arbitrary code at build time. |
| `Cargo.toml` `[features]`, `default = [...]` changes | T2 | Feature unification changes what downstream crates compile. Adding to `default` changes every consumer. |
| `Cargo.toml` `[dependencies]`, `[build-dependencies]`, `[patch]`, `[replace]`; `Cargo.lock` | T2 (T3 for `[patch]`/`[replace]` or git dependencies) | Supply chain. `cargo deny` / `cargo audit` output is the evidence. |
| `Cargo.toml` `[profile.*]` (`panic`, `overflow-checks`, `lto`, `opt-level`), `rust-toolchain*`, `.cargo/config.toml` | T2 | Changes runtime semantics, such as overflow checks and abort-vs-unwind. |
| `pub` item changes in a library crate (`src/lib.rs` and its public modules) | T2 | SemVer break for consumers. `cargo-semver-checks` is a deterministic detector (tool suggestion, not verified here). |
| Content `#[allow(`, `#![allow(`, `clippy::` allow additions, `.unwrap()`/`.expect(` added in non-test code | T1 → T2 when >N | Silences the compiler-as-reviewer. Worth a hack flag. |
| `migrations/**` (sqlx, diesel, refinery) | T3 | Schema. |
| `#[serde(...)]` attribute changes on types under `**/api/**`, `**/wire/**`, `**/proto/**`; `*.proto` | T2 | Wire format: pstack blast-radius's "another language reading the same bytes". |
| `tests/**`, `#[cfg(test)]` modules added only | T0 | — |

### Node / TypeScript

| Pattern | Tier | Why |
|---|---|---|
| `package.json` `dependencies`, `devDependencies`, `peerDependencies`, `overrides`, `resolutions`; `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`; `.npmrc` | T2 | Supply chain. A lockfile-only diff without a manifest change is still T2. |
| `package.json` `scripts.preinstall`, `install`, `postinstall`, `prepare` | T3 | Arbitrary code at install. |
| `package.json` `exports`, `main`, `types`, `bin`; `**/index.d.ts`; `src/index.ts` of a published package | T2 | Public API surface. |
| Auth middleware: `**/middleware/auth*`, `**/auth/**`, `middleware.{ts,js}` (Next.js), content `passport.`, `jsonwebtoken`, `jwt.verify`, `next-auth`, `getServerSession`, `cors(`, `helmet(`, `csrf` | T3 | Authn/authz and request-boundary security. |
| `.env*` (except `.env.example` → T2), `**/config/**`, env schema files (content `z.object` near `process.env`, `envalid`, `@t3-oss/env`) | T2 (T3 if secrets or URLs to prod services change) | Config. A missing env var fails at boot or, worse, silently in prod. |
| `prisma/schema.prisma`, `prisma/migrations/**`, `**/migrations/**` (knex, TypeORM, Drizzle `drizzle/**`) | T3 | Schema. |
| `tsconfig*.json` strictness changes (`strict`, `noImplicitAny`, `skipLibCheck`), content `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `as any` added | T1 → T2 when more than a few | Weakens the type checker the loop relies on. Hack flag. |
| Route handlers (`app/api/**`, `pages/api/**`, `routes/**`) signature changes | T2 | API consumers. |
| `**/*.test.{ts,tsx,js}`, `**/__tests__/**` added only | T0 | — |

---

## 9. Decisions for you

1. **Which tiers may merge without you, per project?** This is `../../decisions-to-grill.md` Tier 1 #1. Concrete form: set `ADW_MERGE_GRANT` per target repo (T0 only, T0+T1, or none). A plausible starting point:
   - This repo and personal Node apps: T0 after shadow, T1 later.
   - Spring service at work: none until CI plus an in-pipeline verify exist.
2. **What is a one-way door in your projects, and its contract?** This is DG Tier 1 #2. Are additive migrations (nullable column, new table) T3 like Factory, or demotable to T2 like Cursor's "narrow migrations"? If demoted, what rehearsal proves rollback?
3. **New: where is the human floor: per PR or per release?** OpenAI puts it at the release smoke test. Your Spring service probably deploys on merge, which makes per-PR the only boundary. Is there a release cut you could gate instead?
4. **New: may an LLM ever lower a tier?** Recommended: no. LLM is raise-only, rules decide the floor. Alternatively, allow an LLM to demote T2 → T1 only with a rung-4 blast-radius proof.
5. **New: shadow-mode length and promotion criteria.** How many weeks or PRs per tier, and what threshold (zero hard rejects? zero reverts?). What demotes a tier back?
6. **New: agent identity on GitHub.** A machine user or GitHub App for ADW pushes is needed so that your approval counts on T2/T3 and "approval of most recent push" works. Personal account or org (the required-reviewer-by-path rule is team-based)?
7. **New: who can edit the tier policy and CODEOWNERS?** Recommended: human only. The risk gate denies agent writes, and policy changes are T3 and read from base. Is there a ticket class that legitimately needs the agent to edit them?
8. **New: revert authority.** May the harness auto-open *and merge* a revert of an auto-merged T0/T1 PR when main breaks, or only open it?
9. **Thresholds:** 200 / 400 lines and 15 files, or your own? Count tests in the size?
10. **Severity policy for review findings.** Adopt OpenAI's "≤P2 never blocks" for auto tiers? It ties to DG #5 (what blocks a ship).

---

## 10. Unknowns

- **OpenAI primary text.** `openai.com/index/harness-engineering` returned 403. All OpenAI claims here come from the Latent Space transcript and a survey [secondary]. The exact wording about merge gates and P0–P2 needs a browser read of the post.
- **Cursor's scoring internals.** The blog names blast radius, complexity and infra impact, but not how they are computed or weighted. The product docs don't specify `APPROVAL_POLICY.md`'s format. The 30–40% no-human-review figure is an unofficial estimate.
- **Anthropic's actual tiers.** "We tier our codebase by risk" has no published table, thresholds or promotion criteria for shadow mode.
- **Escaped-defect data for auto-merge.** The only public numbers are Framer's (155 PRs, 0 hard rejects, 30 days, self-reported) and Meta's "minimal production impact" with no accuracy metrics. Nobody publishes revert rates per tier.
- **StrongDM.** No merge or risk rules are published. How their factory handles migrations or auth is unknown.
- **GitHub specifics not verified:**
  - Whether the required reviewer rule can name individual users or only teams in personal repos.
  - Whether a GitHub App's or `GITHUB_TOKEN`'s approval counts toward required approvals under current settings.
  - Merge-queue availability on personal or private plans.

  Settle these by testing against a scratch repo.
- **DORA numbers.** The −7.2% stability figure came from secondary summaries. The 2024 PDF wasn't read.
- **Stack patterns.** The §8 globs and regexes are untested proposals. Settle them by running `merge_tier.py --selftest` on fixtures, then by shadow-classifying the last ~100 merged PRs in each target repo and hand-labelling the misses.
