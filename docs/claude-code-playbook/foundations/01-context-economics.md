# 01 — Context economics

> **Foundations** · Next: [The context diet](02-context-diet.md)

Everything else in this playbook follows from one observation: **an agent's output quality
depends on how much is already in its context window.** Not on whether the window is full — on
how much is in it.

That sentence sounds unremarkable and has substantial consequences. It is the reason work gets
decomposed into tickets, the reason sessions get cleared instead of continued, the reason
delegation matters, and the reason a bigger context window is not the upgrade it appears to be.

This chapter states what is actually established, what is a reasonable extrapolation, and what is
not supported. The distinction matters — the popular version of this argument routinely outruns
its evidence, and practices built on the overclaimed version tend to be the first ones dropped
when the claim is questioned.

---

## What is well established

**Performance degrades as absolute input length grows, well before the advertised limit.**

This is one of the more consistently replicated findings in the long-context literature, across
methodologically distinct studies:

- **NVIDIA's RULER** evaluated 17 long-context models at identical absolute lengths — 4K, 8K,
  16K, 32K, 64K, 128K — regardless of each model's claimed maximum. Its headline result: *"while
  these models all claim effective context of 32K tokens or greater, only half of them can
  maintain satisfactory performance at the length of 32K."* (arXiv:2404.06654)

- **NoLiMa** (ICML 2025) removed literal string overlap between the question and the target,
  forcing genuine semantic retrieval. Across 13 models all claiming 128K+ support, *11 dropped
  below 50% of their short-context baseline by 32K tokens.* GPT-4o fell from 99.3% to 69.7%.
  (arXiv:2502.05167)

- **Chroma's "Context Rot"** report tested 18 models across several task families and found
  performance *"consistently degrades across all models"* as context length increases — including
  on tasks with no retrieval difficulty at all. (Industry technical report, not peer-reviewed.)

The strongest single result, and the one worth knowing by name:

- **Du et al., "Context Length Alone Hurts LLM Performance Despite Perfect Retrieval"**
  (Findings of EMNLP 2025, arXiv:2510.05381). Across five models on math, QA, **and coding**
  tasks, performance degraded **13.9–85%** as absolute input length grew — *even under verified
  perfect retrieval*, including conditions where all irrelevant tokens were masked so the model
  could only attend to relevant ones, and where the evidence sat immediately before the question.
  Their conclusion: *"the sheer length of the input alone can hurt LLM performance, independent of
  retrieval quality and without any distraction."*

  Every length tested was well within the models' claimed limits. This is the paper that rules out
  the comfortable explanation — that degradation is just retrieval getting harder in a bigger
  haystack. It isn't. **Length itself does damage.**

**And it is a gradient, not a cliff.** Anthropic's own Claude Code documentation states this
directly, describing model performance degrading as context grows *"because attention gets spread
across more tokens, and older, irrelevant content starts to distract from the current task"* —
and characterizes the underlying mechanism as producing *"a performance gradient rather than a
hard cliff."*

That is the practically important part. There is no alarm. Nothing announces that you have
crossed a line. The quality falls off continuously while the session continues to feel
productive.

---

## The finding that changes how you think about context

Chroma's report contains a result that is worth more than its headline: models performed **worse
when the surrounding content preserved a logical flow of ideas.** Shuffling the sentences
*improved* performance.

The implication is that a meaningful part of degradation is not driven by length as such, but by
the accumulation of **plausible, coherent, related-but-wrong content** competing for attention.

Which reframes the whole problem. Context is not a bucket that fills. It is a signal-to-noise
ratio, and every irrelevant-but-plausible thing you put in front of the model — the file it
didn't need, the abandoned approach from earlier in the session, the stale instruction that no
longer applies — is not merely occupying space. It is actively competing with the thing you
wanted attention on.

This is the strongest argument for [the context diet](02-context-diet.md), and it says something
specific: the goal is not "use fewer tokens." It is **keep the context relevant.** A session
carrying 80,000 tokens of exactly-the-right material is in better shape than one carrying 40,000
tokens of half-relevant background.

---

## The smart zone

The working vocabulary:

- The **smart zone** is the early part of a context window, where output quality is at its best.
- The **dumb zone** is everything after. Not broken — degraded, invisibly.

Neither term is from the literature. They are practitioner shorthand for the measured gradient
above, and they are useful precisely because they are blunt enough to change behavior. "Am I
still in the smart zone?" is a question people actually ask themselves. "What is my expected
degradation at current context length?" is not.

**Where the boundary sits is not a published number, and anyone who gives you a precise one is
overreaching.** The evidence shows substantial model-to-model variation in where degradation
begins and how steep it is, even between models with similar advertised windows. It shifts with
model generation, and it depends on what kind of work you are doing.

What the evidence supports is the *shape*: quality is best early, degrades continuously, and the
degradation starts far below the advertised limit. What it does not supply is your number.

**So calibrate your own.** A practical working threshold that many practitioners converge on sits
somewhere in the low hundreds of thousands of tokens — a common personal rule is to treat
roughly 160,000–190,000 as the band where you should be wrapping up rather than starting
something new. Treat that as a starting hypothesis to test against your own work, not as a
finding.

Signs you are past your own threshold, which are more reliable than any number:

- The agent re-reads files it already read this session
- It restates an earlier decision slightly differently, or contradicts one
- It proposes something you explicitly ruled out
- Fixing a small thing quietly breaks something it built earlier in the same session
- Its summaries of its own work start drifting from what it actually did

---

## The claim about window size — stated carefully

Here is the practically important version, and it is the one to be precise about:

> **A larger context window does not buy a proportionally larger smart zone. It mostly buys you
> more room to keep going after quality has already declined.**

**What supports this.** RULER is the closest direct evidence: because it tested every model at
the same absolute lengths regardless of claimed window, it can compare across window sizes. Its
finding points squarely this way — a model *trained for a 1M-token window* performed **worse than
a 4K-context Llama2-7B baseline even at 4K tokens.** Claimed window size did not predict quality
at a given length. Combined with Du et al.'s demonstration that absolute length alone degrades
performance well inside the claimed limit, the direction is consistent and the mechanism is
plausible.

**What does not support it.** No study found in this search independently varies *both* absolute
input length *and* maximum window size in a design built to isolate which one drives degradation
onset. That is the experiment this claim needs, and as far as public literature goes, it does not
appear to have been run. One small non-peer-reviewed preprint points the other way, toward a
percentage-of-window threshold.

**So state it as what it is:** a well-motivated extrapolation from strong adjacent evidence, not
a measured result. In practice it is the right operating assumption — the safe error is managing
context you did not need to manage; the expensive error is trusting a percentage-remaining
readout that says 85% while quality has already fallen off. But do not treat it as settled
science, because it isn't.

The practical consequence stands regardless of how the mechanism resolves: **the
percentage-remaining indicator is not a quality indicator.** On a very large window it is
actively misleading, because it reports plenty of room at exactly the point where the useful work
is behind you.

---

## Two things to avoid saying

**Do not cite "Lost in the Middle" as evidence that longer context degrades performance.** It is
the most-cited paper in this space and it is routinely miscited. Liu et al. (TACL 2024) held the
number of input documents roughly fixed and varied the **position** of the relevant one within
that context, finding a U-curve — best at the beginning and end, worst in the middle. It is a
finding about *position within* a context, not about *the size of* the context. It is a real and
useful result; it is not this result. Citing it for length degradation undermines the rest of
the argument for anyone who has read it.

**Do not present "context rot" as a peer-reviewed construct.** It is industry and practitioner
terminology, originating in Chroma's technical report. Anthropic's documentation uses the term
and attributes it to that report. Use it as vocabulary — it is good vocabulary — but attribute it
honestly.

One further honest limit worth carrying: nearly all of this evidence comes from **synthetic
retrieval and single-turn reasoning benchmarks.** Du et al. is the only source found that
includes coding tasks, and even there they are single-shot code-reasoning problems graded by an
automatic checker — not multi-turn agentic editing across files with accumulating tool output,
which is what an actual coding session is. **The specific claim "coding-agent output quality
degrades with accumulated session context" is widely reported by practitioners and is not, as far
as this search found, directly measured in public literature.**

That gap is worth naming rather than papering over. The mechanism is established, the extension
to agentic work is reasonable, and the practices in this playbook are cheap enough to be worth
adopting on that basis. But the honest position is *"strong evidence for the mechanism, thin
evidence for our exact application of it"* — and a team that says so is more credible than one
that claims certainty it does not have.

---

## What follows

If quality degrades with accumulated context, and the degradation is invisible, then:

- Cut what you carry into every session → [The context diet](02-context-diet.md)
- Make sessions end deliberately rather than drift → [Session lifecycle](03-session-lifecycle.md)
- Spend someone else's context on exploration → [Orchestration and delegation](04-orchestration-and-delegation.md)
- Load instructions only when relevant → [Where steering lives](05-where-steering-lives.md)
- Size work so it fits in one good session → [Feature delivery](../plays/01-feature-delivery.md)

Every one of those is the same move: **protect the early part of the context window, because that
is where the good work happens.**

---

### Sources

- Du et al., *Context Length Alone Hurts LLM Performance Despite Perfect Retrieval*, Findings of EMNLP 2025. [arXiv:2510.05381](https://arxiv.org/abs/2510.05381)
- Hsieh et al. (NVIDIA), *RULER: What's the Real Context Size of Your Long-Context Language Models?*, 2024. [arXiv:2404.06654](https://arxiv.org/abs/2404.06654)
- Modarressi et al. (Adobe Research), *NoLiMa: Long-Context Evaluation Beyond Literal Matching*, ICML 2025. [arXiv:2502.05167](https://arxiv.org/abs/2502.05167)
- Hong, Troynikov, Huber (Chroma), *Context Rot: How Increasing Input Tokens Impacts LLM Performance*, 2025. Industry technical report. [research.trychroma.com/context-rot](https://research.trychroma.com/context-rot)
- Liu et al., *Lost in the Middle: How Language Models Use Long Contexts*, TACL 2024. [arXiv:2307.03172](https://arxiv.org/abs/2307.03172) — cited here for the positional finding only.
- Anthropic, Claude Code documentation on context management.
