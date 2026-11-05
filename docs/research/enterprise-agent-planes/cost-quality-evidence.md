# Cost, latency, and quality: what has actually been measured

**Research date:** 2026-11-05. Pages below were fetched that day unless a paper's own date is the citation.
**Question:** For each learned box on slide 26, what do primary sources report about cost, latency, and quality, under which conditions, and where is there no reproducible number?
**Rule:** A number is quoted only with the population, the metric, and the comparison. A vendor price is a price, not a task result. A retrieval-failure rate is not an answer-accuracy rate. A benchmark score for a model is not the reliability of a multi-step system.

The five photos state no numeric gain. The user reports that the presenter claimed lower cost, greater efficiency, and improved model accuracy. This page collects the public evidence those claims would have to point at. It does not find a study of that presentation.

## 0. Three quantities that get collapsed

| Quantity | What it measures | What it does not measure |
|---|---|---|
| **Component score** | A model or router on a frozen set (MMLU accuracy, execution accuracy, recall@20) | Whether a user task finished, or what it cost to get one success |
| **System task reliability** | Fraction of trials in which the whole system met an oracle it did not write. This repo uses pass@k (at least one success in k) and pass^k (all k succeed). See [EVAL_PRACTICES.md](../../../evals/EVAL_PRACTICES.md). | The intrinsic accuracy of whichever model sat in one stage |
| **Cost per successful task** | Total spend, including failed and infra-error trials, divided by the number of trials that met the oracle | The mean cost of the trials that happened to pass |

Anthropic's multi-agent research write-up is the cleanest public illustration that token spend and task score move together inside one system and still are not "the model got more accurate." On their BrowseComp analysis, token use alone explained 80% of performance variance, and three factors (tokens, tool calls, model choice) explained 95%. In the same post, agents used about 4× the tokens of a chat and multi-agent systems about 15× the tokens of a chat. A separate internal research eval — protocol not published beyond the description — had an Opus 4 lead plus Sonnet 4 subagents outperform a single Opus 4 agent by 90.2%. The same post says most coding tasks are a poor fit because they are less parallel than research. Upgrading to Claude Sonnet 4 beat doubling the token budget on Claude Sonnet 3.7, again on their internal comparison, with the task list unpublished ([Anthropic, 2025-06-13](https://www.anthropic.com/engineering/multi-agent-research-system) [vendor]).

Google's controlled study is the other half: more stages can lower the score. Across 260 configurations, five architectures, three vendor families, and six agent benchmarks, with tools, prompts, and budgets matched, independent multi-agent runs amplified trace-level errors 17.2× relative to a single agent. Centralized coordination, which inserts a validation bottleneck, held that factor to 4.4×. Relative task performance ran from +80.8% (finance, centralized) to −70.0% (sequential planning, independent). On SWE-bench Verified the single-agent mean was 0.522 and every multi-agent topology was slightly worse (independent −14.9%, to 0.444). Their regression predicts the best architecture on 87% of held-out configurations; that figure is architecture selection, not a quality gain from adding models. Cross-validated R² of the performance model is 0.373 (0.413 with a task-grounded capability term), so most variance is still unexplained ([Kim et al., arXiv:2512.08296](https://arxiv.org/abs/2512.08296); summary [Google Research blog](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/)).

**Absence.** No source located here reports cost per successful task, a latency distribution, and a safety constraint on the architecture drawn in the October 13 photos.

## 1. Routing

**What was measured.** RouteLLM trains a router to send each query to a strong model or a cheap one ([Ong et al., ICLR 2025, arXiv:2406.18665](https://arxiv.org/abs/2406.18665)). The pair in the main tables is `gpt-4-1106-preview` and Mixtral 8x7B. They price those at $24.7 and $0.24 per million tokens (Appendix D of the paper) and define the savings ratio from the fraction of strong-model calls against a random router, because the strong model's price dominates.

| Benchmark | Condition | Result they report |
|---|---|---|
| MT-Bench | Best router, call-performance threshold 50% | 3.66× cost-saving ratio at 95% of GPT-4 quality |
| MMLU | 5-shot, CPT 50% | 1.41×, score 75 versus GPT-4's 81 (92% of GPT-4) |
| GSM8K | 8-shot, CPT 50% | 1.49×, score 75 versus GPT-4's 86 (87% of GPT-4) |

Routers trained only on Chatbot Arena preference data sit near the random router on MMLU and GSM8K. Augmenting with about 1,500 golden MMLU labels (under 2% of training data) or with LLM-judge labels on GSM8K is what moves them. The same routers, not retrained, were then pointed at Claude 3 Opus / Sonnet and at Llama 3.1 70B / 8B and still beat random on MT-Bench. The paper's own reading is that the router is only as good as the overlap between its training distribution and the queries.

**What was not measured.** Tool-using agents, authorization decisions, coding tickets, latency distributions, or cost per successful agent task. A 95% MT-Bench figure is a preference score against GPT-4 on chat questions at a chosen call threshold. It is not a statement that a router model raises accuracy.

FrugalGPT is a cascade rather than a single router ([Chen, Zaharia, and Zou, arXiv:2305.05176](https://arxiv.org/abs/2305.05176), TMLR version [author PDF](https://lingjiaochen.com/papers/2024_FrugalGPT_TMLR.pdf)). A cheap model answers first; a scorer either accepts or escalates. The abstract says the cascade can match the best individual LLM with up to 98% cost reduction, or improve on GPT-4 by up to 4% at the same cost. The TMLR table of cost to match the best single model: HEADLINES 98.3% ($33.1 to $0.6, GPT-4 was the best single), OVERRULING 73.3% ($9.7 to $2.6), COQA 59.2% ($72.5 to $29.6, best single was GPT-3), plus later rows AGNEWS 75.4% and SCIQ 52.3%. The HEADLINES case study sets a budget of $6.5, one fifth of that GPT-4 bill, learns the order GPT-J then J1-Large then GPT-4 with score thresholds 0.96 and 0.37 and a DistilBERT scorer, and reports +1.5 percentage points of accuracy against GPT-4 at 80% lower cost. The paper states that the cascade needs labeled data from the same distribution, and that latency, fairness, privacy, and energy were not in the objective.

**Reading for slide 26.** A learned router can cut spend on a distribution it was trained for, and it gives the savings back when the queries move. The quality column is "fraction of the strong model's score," which is a ceiling the router is trying not to fall through. That is the opposite of a claim that routing makes the model more accurate.

## 2. Caching

Two mechanisms share the word "cache" on slides 21 and 26. They do not share a failure mode.

### Exact-prefix prompt cache

**Vendor price, not a benchmark.** Anthropic's pricing doc, fetched 2026-11-05, bills a 5-minute cache write at 1.25× the base input price, a 1-hour cache write at 2×, and a cache read at 0.1× for most models. Stated exceptions: cache reads at 0.025× on Claude Fable 5.1 and Mythos 5.1, and at 0.05× on Claude Opus 5.5 and Sonnet 5.5 ([prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) [vendor]). A December 17, 2024 product article says caching can reduce costs by up to 90% and latency by up to 85% for long prompts ([product article](https://claude.com/resources/articles/prompt-caching) [vendor]). The 90% matches the 0.1× read price on the cached prefix. The 85% latency figure is the article's claim; the pricing page does not publish the workload, the prompt length, or the percentile. A cache hit requires the same prefix. Editing a token in front of the breakpoint invalidates it. The mechanism does not decide that two different questions deserve the same answer, so it does not create a semantic false hit. It also does not know about entitlements: a cached prefix that contains another user's data will replay it to anyone who sends that prefix.

### Semantic cache

**What was measured.** GPTCache, at cosine threshold 0.7, served 1,160 queries built as 50% related and 50% unrelated. It recorded 570 hits and 590 misses, of which 21 hits were negative, at 0.17 s hit latency. "Positive" was itself a ChatGPT similarity score of at least 0.7, not a downstream grade. The authors write that hit rates did not exceed 90% with the embeddings they tried, and that a 99% positive-hit target was unlikely without giving up hits. A separate, coarser comparison in the same paper says a cache hit took about 0.3 s on one laptop against an assumed 3 s ChatGPT call, and the abstract says a hit can be 2–10× faster. That speedup is not the mixed-query table ([Fu and Feng, Zilliz, NLP-OSS 2023](https://aclanthology.org/2023.nlposs-1.24.pdf) [vendor]).

MeanCache re-scored that style of decision on 1,000 queries: GPTCache precision 0.52, F-score 0.56, 233 false hits; MeanCache with MPNet precision 0.72, F-score 0.73, 89 false hits ([Gill et al., arXiv:2403.02694](https://arxiv.org/abs/2403.02694)). Precision here is "was this hit the right cache decision," still not task accuracy, and not an access-control test.

A separate paper shows why embedding similarity is the wrong default for a cache. On a hard Natural-Questions-derived set, an off-the-shelf embedding scored AUC 0.51 for "these two prompts may share an answer" (chance). Distilling the embedding raised AUC to 0.81. A streaming simulation moved cache efficiency from 46.0% to 54.0% (BCE) and 52.4% (SLD) ([Zhu et al., arXiv:2402.01173](https://arxiv.org/abs/2402.01173)).

**Absence.** No primary result located here measures a semantic cache under per-user entitlements, with invalidation when a source row or a policy version changes, reporting both false-hit rate and cost per successful task. Until that exists, a semantic cache in front of governed data is an unmeasured leak and staleness channel. The exact-prefix price discount does not transfer to it.

## 3. Retrieval and context

**Retrieval failure, vendor blog.** Anthropic's contextual-retrieval post (2024-09-19) defines failure as 1 − recall@20, averaged across codebases, fiction, arXiv papers, and science papers, using Gemini Text 004 as the top embedding they tried. Contextual embeddings: 5.7% → 3.7% (35% relative). Adding contextual BM25: 5.7% → 2.9% (49% relative). Reranking the top 150 with a Cohere reranker down to 20: 5.7% → 1.9% (67% relative) ([Anthropic](https://www.anthropic.com/engineering/contextual-retrieval) [vendor]). The post does not publish query counts, corpus sizes, or intervals. It asserts that fewer failed retrievals "directly translate" to better downstream answers and does not report that downstream number. The 49% and 67% figures are retrieval figures.

**Using the context once it is retrieved.** On multi-document QA, moving the single relevant passage into the middle of the prompt drops accuracy. GPT-3.5-Turbo fell by more than 20 percentage points in the worst placement; in the 20- and 30-document settings the middle placement scored below the closed-book baseline of 56.1%. Models with extended context windows did not remove the U-shape ([Liu et al., arXiv:2307.03172](https://arxiv.org/abs/2307.03172), TACL 2024). More retrieved tokens can make the answer worse. A reranker that stuffs a longer prompt is not a free accuracy win.

**Entitlements.** Authorization-first retrieval (AFR) states the ordering constraint: the authorized candidate set is fixed before any learned ranker or generator sees text. On their controlled corpus — 247 chunks, 232 documents, 431 base queries, 12 roles, 9 domains, 584 queries once negation and parametric probes are included — retrieve-then-filter exposed unauthorized context on 86.1% of queries. AFR removed that structural leak by construction. Under retrieve-then-filter, answer leakage was 41.3% for Gemini 2.0 Flash and 29.5% for GPT-4o-mini, so the behavioral failure depends on the model and the structural failure does not ([TrustNLP 2026 abstract](https://aclanthology.org/2026.trustnlp-main.15/)). This note did not re-run that corpus. The abstract is the evidence, and the corpus is synthetic relative to a bank's warehouse. The direction matches slide 23's "entitled data only" arrow and contradicts a pipeline that embeds first and filters in the prompt.

## 4. Query planning and the data layer

**Text-to-SQL execution, not entitlements.** BIRD has 12,751 question-SQL pairs, 95 databases, 33.4 GB, 37 domains. Execution accuracy means the predicted query and the gold query return the same result set. On the test set with the benchmark's external-knowledge hints, GPT-4 scored 54.89% and GPT-4 plus DIN-SQL scored 55.90%. Humans scored 92.96% with that knowledge and 72.37% without it. GPT-4 without the hints scored 34.88% ([Li et al., arXiv:2305.03111v3, 2023-11-15](https://arxiv.org/abs/2305.03111)). Those numbers are from 2023 models. Later leaderboard rows are a different population and are not quoted here. The paper's point that still binds: a planner model on realistic schemas is far from a careful person, and execution equality does not test whether the rows were permitted.

**In-database inference.** Slide 26's last box replaces "rows only" with "in-DB inference." No primary benchmark located for this note measures answer accuracy under row, column, and cell policies with and without in-database model execution, on a published workload, with cost and latency. Product docs for warehouse ML features are vendor descriptions of a capability. They are not that measurement. **Absence recorded.** A database can enforce a policy the planner never sees; a model running inside the database still has to run as a subject the policy engine recognizes. The enforcement stays in the engine.

## 5. Memory

**Long-horizon recall is a system problem.** LongMemEval has 500 questions over five abilities, including knowledge updates and abstention. LongMemEval-S histories are about 115k tokens. Reading the full history versus an oracle that supplies only the evidence sessions: GPT-4o 0.606 versus 0.870 (30.3% relative drop) without chain-of-note, and 0.640 versus 0.924 with it. Llama 3.1 70B Instruct dropped 55.1% relative (0.334 versus 0.744). Scores are assigned by a GPT-4o judge; on a 30-question-per-type sample the judge agreed with expert labels at 90% or better, and less so on preference and abstention items ([Wu et al., arXiv:2410.10813](https://arxiv.org/abs/2410.10813)).

A separate manual trial, first two weeks of August 2024, used 97 questions and histories of 3–6 sessions, about ten times shorter than LongMemEval-S. Offline GPT-4o reading the whole short history scored 0.9184. The same model behind ChatGPT's product memory scored 0.5773 (the paper's 37% drop) and behind Coze scored 0.3299 (the paper's 64% drop). The authors' note on ChatGPT is that it overwrote facts as the chat continued. That is a deletion bug in a memory product, measured on a short, non-public slice, with a judge in the loop.

**Reading.** A memory manager can raise recall above "stuff the transcript in the prompt," and the paper's indexing ablations (round-level values, fact-expanded keys) move both recall and QA. The same paper shows extraction can destroy the fact it was meant to keep. Forget-by-overwrite is the failure mode slide 23 names and does not measure. Provenance — which session, which statement — is what makes a later delete checkable. The commercial numbers are not a license to claim a memory model improves accuracy in general: the offline reader with the same LLM beat the memory product.

## 6. Continual learning versus memory

**Knowledge injection.** Ovadia et al. compare unsupervised fine-tuning with RAG on MMLU slices chosen to be factual (anatomy, astronomy, college biology, college chemistry, prehistory) and on a current-events set built from US events in August–November 2023, after the models' cutoffs ([arXiv:2312.05934](https://arxiv.org/abs/2312.05934), EMNLP 2024). Generator models are Llama-2-7B, Mistral-7B, and Orca-2-7B. The embedder is `bge-large-en`. Current-events accuracy:

| Model | Base | Base + RAG | Fine-tune | Fine-tune, paraphrases | Fine-tune + RAG | Paraphrase fine-tune + RAG |
|---|---|---|---|---|---|---|
| Mistral-7B | 0.481 | 0.875 | 0.504 | 0.588 | 0.810 | 0.830 |
| Llama-2-7B | 0.353 | 0.585 | 0.219 | 0.392 | 0.326 | 0.520 |
| Orca-2-7B | 0.456 | 0.876 | 0.511 | 0.566 | 0.820 | 0.826 |

Llama-2-7B's plain fine-tune fell below the base model (0.219 versus 0.353). On every row, RAG on the base model beat fine-tuning, and on the current-events set RAG alone beat fine-tune plus RAG. The paper's scope is unsupervised fine-tuning of 7B models on Wikipedia-scale text, multiple choice, not a supervised skill tune and not an agent. Within that scope the result is stable: new facts landed more reliably in a retrieved passage than in the weights, and writing them into the weights could erase capability.

A position paper argues the security consequence: a fine-tune on a document is a channel, so the training set has to obey the same participant-aware ACL as retrieval ([arXiv:2509.14608](https://arxiv.org/abs/2509.14608)). That paper is an argument with a threat sketch, not a leak-rate measurement.

**Reading for slide 23's "tuned model" arrow.** Fine-tuning small models is a hypothesis that needs a frozen eval the previous model already has a score on, a forgetting check, and an entitlement story for the training rows. It is not the next step after "we have traces." Memory and retrieval are the interventions the knowledge-injection evidence actually supports, and they carry their own overwrite and leakage failures (§3, §5).

## 7. Output judges

**Preference agreement, with known biases.** Zheng et al. study GPT-4 as a judge of chat answers ([arXiv:2306.05685](https://arxiv.org/abs/2306.05685)). On MT-Bench, agreement with expert humans on non-tie votes reached 85%, against 81% agreement among the humans (about 3,000 expert votes and 3,000 arena votes). The same paper documents the ways that number moves:

- **Position.** Two similar GPT-3.5 answers at temperature 0.7. Only GPT-4 was consistent across a swap in more than 60% of cases. Other judges preferred the first position. Their mitigation is to swap and require agreement.
- **Verbosity.** A "repetitive list" attack that adds no facts. Every judge they tried could be moved; GPT-4 less than the others. The paper does not claim the bias is gone.
- **Self-preference.** GPT-4's win rate for itself sat about 10 points above the human judges' win rate; Claude-v1's sat about 25 points above. The authors say the data cannot settle whether that is self-enhancement, because they could not restyle an answer without changing its quality.

MT-Bench agreement is agreement about which chat answer a person prefers. It is not agreement with a unit test. A judge correlated with the author (same model family, same verbosity taste) will rubber-stamp the failure mode it shares.

**A detector is a judge with a security label.** On AgentDojo's published results table, `gpt-4o-2024-05-13` with no defense, under the "important instructions" attack, scored 69.07% benign utility and 47.69% targeted attack success (row dated 2024-06-05). Adding the `transformers_pi_detector` defense cut targeted success to 7.95% and cut utility to 41.24%. A tool-filter defense on the same attack cut targeted success to 6.84% while utility stayed at 72.16% ([results table](https://agentdojo.spylab.ai/results/)). The paper's abstract, on the initial suite of 97 tasks and 629 security cases, reports a different aggregation: models solved under 66% of tasks with no attack, attacks succeeded against the best agents in under 25% of cases, and a secondary detector brought attack success to about 8% ([Debenedetti et al., arXiv:2406.13352](https://arxiv.org/abs/2406.13352)). Both are cited because they answer different questions. The abstract is the authors' summary across models. The table is one model, one attack, one day. Neither says a classifier can replace a permission check. The tool filter, which removes tools rather than asking a model to notice the attack, kept more of the utility in that one row. The paper estimates about $35 to run the 629 cases on GPT-4o and about $4 for the 97 utility cases, so even the measurement is a bill.

OWASP's 2025 prompt-injection entry states the limitation directly: because the model is stochastic, foolproof prevention is not established, and the mitigations they list put least privilege and human approval outside the model ([LLM01:2025](https://genai.owasp.org/llmrisk/llm01-prompt-injection/), document version 2025, dated 2024-11-18 in the PDF).

## 8. Registries, evals, and rollback

A model registry, in the slide's words, is versions and approvals. The public artifact that corresponds to an approval is a named identity plus a score on a set that was frozen before the run.

What the measurements above imply for that gate:

- Report **pass^k** and **cost per successful task**, not a component accuracy and a mean cost of successes. Google's trace-amplification factors and Anthropic's 15× token multiple are both invisible to a dashboard that shows only the strong model's benchmark.
- Keep a **deterministic grader** next to any judge. RouteLLM's GSM8K gains depended on judge-labeled augmentation; Zheng's judge shares position and verbosity biases; LongMemEval's QA numbers are judge-mediated even though the judge was calibrated. A judge-only promotion will track the judge.
- Pin the **served model identity** (a dated snapshot), not a floating alias. Otherwise the registry entry does not name an artifact and a later run is not a comparison.
- Store the **previous artifact**. Rollback is re-running the same tasks, the same graders, and the same budget policy against that artifact. A registry without a reversible pointer is a log.
- Split **offline** and **online**. Offline is the frozen set. Online — production keep-rate, incident rate — needs traffic this coding harness does not have. [EVAL_PRACTICES.md](../../../evals/EVAL_PRACTICES.md) already marks production A/B as out of scope here, with the reason. Slide 23's "offline and online evals" box should not be copied in as if both existed.
- Do not promote on a **saturated** set. A router or a judge that scores perfectly on a tiny labeled file can no longer see a regression.

**Absence.** No source located here is a controlled study of "model registry plus continual fine-tune" against "memory plus retrieval plus a deterministic gate" on an enterprise agent, with entitlements held constant. The component papers point at the second design until such a study exists.

## 9. How the reported claims sit against this table

| Reported claim | Closest public evidence | Limit |
|---|---|---|
| Lower cost | RouteLLM 1.41×–3.66× fewer strong-model calls on three 2024 benchmarks, at 87–95% of GPT-4's score. FrugalGPT up to 98% cheaper than the best single API on HEADLINES, matching that API's accuracy, with labeled in-distribution data. Prompt-cache reads at 0.1× input price for an unchanged prefix. | Each number is a specific pair of models, a specific set, and a specific metric. Multi-agent systems in Anthropic's data used far more tokens than chat. Semantic caches were not part of these savings. |
| Greater efficiency | Prompt-cache vendor claim of up to 85% latency on long prompts, protocol unpublished. GPTCache hit latency 0.17 s is the cache probe, not end-to-end task latency. Google's study finds a tool-coordination penalty for multi-agent layouts on tool-heavy work. | No latency distribution (p50/p95) for the ten-step pipeline. Extra learned stages add serial waits and error amplification. |
| Improved model accuracy | Not supported as a general effect. Routers are scored as a fraction of the strong model. RAG beat unsupervised fine-tuning on Ovadia's current-events items. Contextual retrieval improved recall@20, not a published answer score. Memory products scored below an offline reader using the same LLM. | System reliability can rise because the harness changed (a better oracle, a shorter pipeline, a pinned prompt) while every model stayed the same. That is the quantity a coding harness can actually move. |

The ten-step diagram is a hypothesis generator. The measurements say which boxes have a published tradeoff, which boxes move a different metric than the slide implies, and which boxes — entitlements, authorization, release, rollback — have their evidence on the deterministic side of the line.
