# Eval practices — what we adopt, and why

Distilled from a 2026-06-16 survey of how leading coding-agent teams do
eval-driven development (Cognition/Devin, Cursor, Anthropic, OpenAI) plus the
academic benchmark literature (SWE-bench Pro, SWE-bench-Live, UTBoost,
Web-Bench). Each practice is tagged by how it applies **to this harness**:

- ✅ **Adopted** — implemented here.
- 🟢 **Already satisfied** — we got it for free from an existing design choice.
- 🟡 **Candidate** — valuable, not yet built; worth doing.
- ⛔ **Ignored** — not valuable for a solo, no-production-telemetry project (with the reason).

This is opinionated and project-specific. The companion `AUDIT.md` is the
pre-flight checklist; this file is the rationale for the methodology.

---

## ✅ Adopted

### pass@k vs pass^k (Anthropic)
A mean over N trials hides flakiness. We report both **pass@k** (≥1 trial solves
= capability ceiling) and **pass^k** (all trials solve = reliability) in
`compare.py`. For an unattended dev workflow, reliability matters more than the
ceiling — a task that solves 2-of-3 is not "done."
*Source: <https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents>*

### Behavioral oracles over interface-name checks (SWE-bench Pro)
The #1 false-negative in deterministic grading is a *correct* solution that uses
different function/class names than the test expected. `/capture_eval_task`
harvests the human's fix into **behavioral** `acceptance` shell checks (assert
observable behavior), never `grep for functionName`.
*Source: <https://arxiv.org/pdf/2509.16941> (removing interface specs ~halved resolve rates)*

### Fresh tasks from real failures (SWE-bench-Live, in spirit)
SWE-bench-Live adds 50 fresh GitHub issues/month to beat saturation. Our
`/capture_eval_task` is the manual analog: real agent misses on the vendored
target become new tasks (14+), keeping the gate discriminating.
*Source: <https://github.com/microsoft/SWE-bench-Live>*

### Combine grader types (Anthropic)
We run **code-based** graders (acceptance + test_command) **and** an **LLM
judge** (spec quality, implementation fidelity). The third type — human — is the
operator's review step. We never trust a single grader.
*Source: <https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents>*

---

## 🟢 Already satisfied

### No git-history / remote leakage (Cognition)
Cognition prunes git history to base+ancestors and removes the remote so the
agent can't `git pull` future/leaked code. `prepare_target` already copies the
target **without `.git`** and does a fresh `git init` + single baseline commit —
so there is no history and no remote by construction. Nothing to do.
*Source: <https://cognition.ai/blog/swe-bench-technical-report>*

### Contamination-resistant target (SWE-bench Pro)
Frontier benchmarks pay for private repos to dodge training-set contamination.
Our `target_backend` is a real-world app backend, vendored and frozen
— the same property, for free. Keep targets vendored; never point at a live repo.
*Source: <https://arxiv.org/pdf/2509.16941>*

### Clean baseline = honest diff (general)
`setup:` bug-planting runs *before* the baseline commit, so a planted regression
is part of the diff base and never counted as the agent's churn; the agent starts
from a clean working tree. Verified in `run_eval.py`.

---

## 🟡 Candidate (valuable, not yet built)

### Reset test files before grading (Cognition)
The agent can edit the target's tests; a weakened test would let a bad patch
score `tests_pass=1.0`. Our `acceptance` checks live in the task YAML (outside
the target, untouchable), which mitigates this — but the `tests_pass` grader
still runs agent-written tests. **Candidate:** before grading, reset any
golden/planted test file to its baseline version so the agent can't grade itself.
*Source: <https://cognition.ai/blog/swe-bench-technical-report>*

### Flag weak-oracle tasks (UTBoost)
Weak test coverage made deterministic graders mislabel 345 patches as "passed,"
reshuffling leaderboards. Our saturation check rejects tasks the harness *aces*;
it does **not** yet detect tasks that pass for the *wrong* reason (thin oracle).
**Candidate:** when capturing a task, also confirm the oracle *fails* on the
unfixed baseline (a coverage sanity check), not just that it passes when fixed.
*Source: <https://arxiv.org/pdf/2506.09289>*

### Held-out task split (SWE-bench Pro)
SWE-bench Pro keeps a private split purely to detect overfitting against the
public set. We have baseline snapshots; a **held-out set of tasks we never tune
the harness against** would catch us optimizing to the visible suite. Worth it
once the captured-task count grows.
*Source: <https://arxiv.org/pdf/2509.16941>*

---

## ⛔ Ignored (not valuable here)

### Online A/B + production behavioral metrics — Keep Rate (Cursor)
Cursor deploys harness variants side-by-side on real traffic and measures "Keep
Rate" (fraction of agent changes the user keeps) + an LLM judge reading user
replies. This needs a production user base and telemetry we don't have. Our
ceiling is **offline** A/B via `--variant`. Skip unless this harness ever ships
to real users.
*Source: <https://cursor.com/blog/continually-improving-agent-harness>*

### Buying private commercial repos (SWE-bench Pro)
A contamination defense for public leaderboards. We already have a vendored,
frozen target (`target_backend`); purchasing repos is irrelevant at this scale.

### Large expert-authored benchmarks — GDPval (OpenAI)
Holistic human grading across 44 occupations. Out of scope for a solo coding
harness; our human-grading is the operator's review, not a panel.
*Source: <https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/>*

---

## One meta-lesson

OpenAI **retired SWE-bench Verified** (and told other labs to) because 59.4% of
audited problems had flawed tests and every frontier model could reproduce the
gold patch. The takeaway for us isn't a specific technique — it's the discipline:
**treat your own suite as suspect.** Re-run `AUDIT.md`, watch for saturation via
pass^k, and keep capturing fresh hard tasks. A clean-looking number from a broken
eval points confidently in the wrong direction.
*Source: <https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/>*
