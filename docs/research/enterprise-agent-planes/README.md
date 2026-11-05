# Enterprise agent planes: a reading of five leadership-session photos

**Research date:** 2026-11-05.
**Status:** research only. Nothing here changes the harness.
**Scope:** how a three-plane enterprise-agent diagram relates to this repo's coding harness, and what published measurements say about the cost, latency, and quality claims that sit next to that diagram.

This note is a distinct topic from the [software-factory curriculum](../software-factory/README.md). That curriculum is about autonomous coding workflows (Poteto, Pocock, StrongDM, Ralph, Anthropic, ADW). These pages are about an enterprise question-answering agent drawn on a leadership-session slide: identity, entitlements, memory, and a learning loop around business data. The shared word is **harness**. The jobs are different. This folder exists so the comparison does not get copied into the workflow docs.

## What the sources are

| Kind | What it is here |
|---|---|
| **Presentation** | Claims paraphrased from five user-provided photos of an October 13, 2026 leadership session, slides 20, 21, 22, 23, and 26. The photos name no speaker and no vendor. A room label, "Sutton Room," appears on slides 21–23 and is not treated as an organization. The photos are reference data. They are not in the repo. |
| **Reported, not on the photos** | The user reports that the presenter also claimed lower cost, greater efficiency, and improved model accuracy. Those three claims do not appear as numbers, tables, or captions on the five photos. They are recorded as reported claims with no citable figure. |
| **Recommendation** | A change this note suggests for ADW, always as an experiment with a baseline. Not a backlog item and not a claim that the slides require it. |
| **Repo** | Behavior read from this repository's docs and code on 2026-11-05. A file path is the evidence. |
| **Literature** | A primary paper, doc, or project results page. Figures are copied with the benchmark conditions. **[vendor]** sells a related product. **[secondary]** reports someone else's measurement. |

## Reading order

| File | Read it for |
|---|---|
| [planes-and-harness.md](planes-and-harness.md) | The thesis and the three planes, in the slides' own terms, and where a learned step must stay outside authorization |
| [cost-quality-evidence.md](cost-quality-evidence.md) | Primary-source measurements for routing, caching, retrieval, memory, planners, judges, registries, and continual learning |
| [adw-comparison.md](adw-comparison.md) | What ADW already implements, the trust-boundary gaps, and the experiments worth running first |

## One-page finding

The photos describe an **architectural pattern**: a request path (harness, tools, context, cache, model, enterprise data), a governance shell (identity, per-call permissions, spend limits, audit), and a knowledge shell (memory, meaning, entitlements, lineage, evals). Component names on the slides — OAuth2, MCP, LLMs, SLMs, rerankers — are industry categories. The drawing is not evidence of one vendor's product and not evidence of a bespoke framework. This repo is one concrete harness: Python scripts under `adws/` that drive Claude Code through a ticket-to-draft-PR loop. It implements some of the same slots and leaves the enterprise-data slots empty on purpose.

Slide 26 draws a pipeline in which 10 of 10 steps "use a model." Published results support learned components for some of those steps, under named benchmarks, and they also show the failure modes: out-of-distribution routers, semantic-cache false hits, retrieval that misses entitlements, judges that share the author's biases, and fine-tunes that learn facts worse than retrieval. None of those papers is a measurement of this presentation. No public result found for this note shows that replacing deterministic authorization, row and cell enforcement, or a release gate with a model improves task reliability.

ADW already separates those jobs in the places that matter for a coding harness: a deterministic ticket resolver, a deny-list risk hook, code graders beside an LLM judge, and a human merge. The useful additions are measurements — cost per successful task, latency distributions, permission-keyed caches, explicit memory deletion, pinned model identities, and a rollback that re-runs the same baseline — not a model at every box.
