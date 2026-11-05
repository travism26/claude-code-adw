# Planes, harness, and what stays deterministic

**Date:** 2026-11-05.
**Sources:** five user-provided presentation photos, October 13, 2026 leadership session, slides 20, 21, 22, 23, and 26. Paraphrase, not a transcript. Speaker and vendor unknown. Companion measurements are in [cost-quality-evidence.md](cost-quality-evidence.md). The repo mapping is in [adw-comparison.md](adw-comparison.md).

Labels used below: **Presentation** is what the photo shows. **Recommendation** is this note's proposal. **Repo** is this codebase, cited in the comparison doc so it is not repeated as if the slides described it.

## 1. Pattern versus implementation

**Presentation.** Slide 20 states three equations. An agent is a model plus a harness, and the harness is what turns a model into an agent. Control is governance plus security, and it decides what an agent may see and do. Intelligence is control multiplied by knowledge, memory, and learning. The caption says that with zero control nothing ships in a bank, and that control alone leaves the agent knowing nothing about the business.

**Presentation.** Slides 21–23 draw one reference architecture, marked "v1" on slide 21, as three bands:

- A **request path** (slide 21's agent runtime and data platform; slides 22–23 label the bottom band the data plane, "the request path that does the work"): agent harness (plans, loops, calls tools), tools and sandbox (MCP servers, code execution), context assembly (prompt from memory), cache (prompt cache and semantic cache), model inference (LLMs, SLMs, rerankers), enterprise data (tables, documents, events).
- A **control plane** ("what an agent may do"): identity for the agent and the end user (OAuth2); policy and guardrails (prompt and output rules, rate and cost limits); tool permissions (least privilege on every tool call); audit (who did what, with which data). Slide 22's caption: the control plane governs who the agent is, what it may call, how much it may spend, and a record of what it did. An "authorised call" is drawn from this band down into the request path. "Every request carries an identity."
- An **intelligence plane** ("what it knows, remembers, may see, and learns"): memory manager (extract and forget), memory store (governed rows), retrieval (embeddings, hybrid search, rerank), semantic layer (governed definitions), ontology (entities and relationships), data entitlements (row, column, and cell policies), lineage (from source row to answer), model registry (versions and approvals), continual learning (fine-tune small models), evaluation (offline and online), traces (outcomes, corrections, feedback).

Slide 21 numbers a request: (1) request with identity, (2) recall, (3) entitled data only, (4) write back to memory, (5) traces, (6) tuned model, and a G marking that the call was checked and logged. Users drawn on the left are analysts, apps, and agents.

**How to read the drawing.** This is the old control-plane / data-plane split from networked systems, with a third band for knowledge and learning. The boxes are roles. MCP, OAuth2, an embedder, a reranker, an LLM, and an SLM are categories many products implement. A slide that composes them is a reference sketch. It does not identify a product, and it does not show that the presenter built a custom framework. A coding harness, a vendor platform, or a bank's own services can fill the same boxes with different code. This repo fills the harness box with `adws/` and leaves the enterprise-data boxes empty. That is an implementation, not a confirmation of the drawing.

**Vocabulary collision, on purpose.** This repo's software-factory glossary defines **Orchestrator** as the component that receives triggers, starts runs, and records run state, and it lists "control plane" as a word to avoid for that component ([GLOSSARY.md](../software-factory/GLOSSARY.md)). The slides use "control plane" for identity, policy, spend, and audit. Those are different objects. This note keeps the slide term inside quotation marks when it means the slides, and it does not rename the Orchestrator.

## 2. Where the three slides disagree with each other

**Presentation.** Slide 22 grays out the intelligence plane and captions it "what is missing": what the agent knows, remembers, may see, and learns. Arrows labeled "context and memories" point down, and "traces and corrections" point up. Slide 23 then draws that plane as the top band and states that it "contains the control plane."

**Recommendation.** Treat "contains" as a diagram choice, not a design rule. A learning loop that owns the policy engine can rewrite the constraint it is supposed to obey: a fine-tune, a memory write, or a registry approval performed by the same model that is being constrained. The safer composition is the one slide 22 draws with the authorised-call arrow. Enforcement sits on the path of every call and does not depend on a learned component having agreed. The learning loop may propose a memory row, a metric definition, or a model version. A deterministic check accepts it, rejects it, or sends it to a person.

Slide 20's product, "control × (knowledge + memory + learning)," says the same thing in arithmetic: a zero control term zeros the product. It does not say the control term should be implemented as another model.

## 3. Slide 26, read against that rule

**Presentation.** Slide 26 is titled "Intelligence is spreading through the system." It draws one request, left to right, ten steps. "A few years ago," 2 of 10 steps use a model: retrieval (embedder, reranker) and reasoning (LLM). The other eight are hand-written: routing by static rules, an input guard of regex lists, an exact-match cache, a fixed query, an if-else decision, memory that appends everything, an output check by manual review, and a data layer of rows only. "Now," 10 of 10 steps use a model: a router model, an input classifier, a semantic cache, the same embedder and reranker, a planner model, an LLM, a decision model, a memory manager, a judge model, and in-database inference. The legend splits "code written by hand" from "a learned model makes the call."

**Presentation, reported only.** The user reports claims of lower cost, greater efficiency, and improved model accuracy alongside this picture. The five photos contain no cost, latency, throughput, or accuracy figure. There is nothing on the photos to reproduce.

**Recommendation.** A learned caller is a reasonable hypothesis for steps whose job is to rank, draft, or retrieve text. It is a bad default for steps whose job is to allow or refuse. The literature in the companion note measures both sides. The split this repo should keep:

| Step on slide 26 | A model can help | Stays deterministic |
|---|---|---|
| Routing | Choosing a cheaper model, or a pipeline, when the labels are stable and the router is tested on that distribution | Who the caller is, which tools exist, and whether the call is allowed. A router confidence score is not an authorization decision. |
| Input guard | A classifier as one filter, with a measured false-negative rate | Allow-lists, schemas, and tool scope. OWASP states that prompt injection has no established foolproof prevention because the model is stochastic ([LLM01:2025](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)). |
| Cache | An exact-prefix prompt cache, which is a price and latency mechanism for identical prefixes | The cache key. A semantic hit that ignores the caller, the entitlement version, or the source version returns someone else's answer or a stale one. |
| Retrieval | Embeddings, lexical search, and a reranker, scored as retrieval failure and as answer failure separately | The candidate set. Authorization constrains retrieval before a learned ranker sees unauthorized chunks. |
| Query plan | Drafting a query when execution accuracy is measured against an oracle the planner cannot edit | Row, column, and cell predicates enforced by the database engine. A model-written `WHERE` clause is not an entitlement. |
| Reasoning | The generation step. This one is a model. | The tools and rows that step is allowed to see, which were fixed before the call. |
| Decision | A recommendation, logged, when the cost of a wrong label is reversible | Allow, deny, merge, spend, and release. If-else here is the product, not leftover code. |
| Memory | Extracting a candidate lesson | The write. Forget is an explicit, attributable delete, not a missing line in a regenerated file. |
| Output judge | A second opinion on prose quality, preferably from a different model family, with the bias measured | Whether tests passed, whether a policy held, whether a path exists. |
| Data layer | Optional scoring inside the database if a measured workload shows a gain under the same entitlements | The enforcement of those entitlements. In-database inference does not replace them. No public result located for this note shows a joint gain. |

Putting a model in all ten boxes raises a second cost the slide does not draw: each learned step adds a failure probability and a bill. Independent multi-agent layouts amplify trace-level errors; extra stages do not commute. See [cost-quality-evidence.md](cost-quality-evidence.md) §1 and §8.

## 4. Trust boundaries the drawing implies

These follow from the boxes on slides 21–23. They are recommendations for anyone building the pattern, including a coding harness that later grows a data plane.

1. **Two identities, one call.** Slide 21 separates the end user from the agent and says every request carries an identity. The agent is a confused deputy when it uses its own credentials to read data the user must not see, or the user's credentials to take an action the agent was not granted. The check is the intersection, computed outside the model.
2. **Least privilege is per call, not per deployment.** Slide 21's tool band says least privilege for every tool call. A process that starts with a broad credential and asks the model to behave is a prompt, not a permission.
3. **Entitlements bind retrieval, cache, and memory to the same policy.** A chunk, a cache entry, and a memory row each need the principal, the policy version, and a source identifier. Slide 23 puts entitlements, lineage, the memory store, and retrieval in one band because a leak in any one of them bypasses the others. [Authorization-first retrieval](https://aclanthology.org/2026.trustnlp-main.15/) is the published version of this argument for RAG. A position paper makes the same demand for fine-tunes: a model trained on a document is itself a channel ([arXiv:2509.14608](https://arxiv.org/abs/2509.14608)).
4. **Lineage is an evidence record, not a citation the model volunteers.** "From source row to answer" is checkable when the system logs the rows the engine actually returned. A model-written footnote is a claim.
5. **Traces are not a learning mandate.** Outcomes and corrections are useful when a later eval can replay them. They are not, by themselves, a reason to fine-tune. Unsupervised fine-tuning has lost to retrieval on knowledge-injection tests (companion note §6).
6. **The registry is a release gate.** "Versions and approvals" means a named model identity, an eval on a frozen set, a person or a deterministic check that promotes it, and a way back to the previous identity. A floating alias (`sonnet`, `gpt-4o`) is not a version.
7. **Rollback is a gate, not a hope.** Promoting a model, a memory store, or a prompt that fails the same baseline the previous version passed is a release defect. The previous artifact has to be restorable and the comparison has to include failed trials in the cost.

## 5. What this does not claim

- The photos do not show a measured cost, latency, or accuracy delta. The reported verbal claims are unquantified.
- The photos do not show source code, a repository, or a benchmark. Comparing them to ADW is a gap analysis, not a finding that the presenter implemented ADW or the reverse.
- "Improved model accuracy" and "the task succeeds more often" are different quantities. A router can hold a fraction of a strong model's benchmark score while the system around it gets more expensive or less reliable. The companion note keeps those columns apart.
