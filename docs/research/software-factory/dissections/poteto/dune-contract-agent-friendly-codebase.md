# The Dune contract: designing a codebase for agents

**Source workflow:** Poteto (Dune, the closed-source client framework behind Grok Bot)  **Stages:** Build, Review, Learn, Memory
**Primary sources:** her X posts and talks, listed in §10. The contract text itself is **secondary**: see §2. Local reads were the pstack 0.15.28 skills `correct`, `architect` (and `references/design-red-flags.md`), `no-comments`, `typescript-best-practices`, and the `principle-*` leaves (paths under `~/.claude/plugins/cache/cursor-plugins/pstack/0.15.28/skills/`), plus Matt Pocock's `codebase-design` and `improve-codebase-architecture` skills.
**Builds on:** [../../workflows/poteto/public-workflow.md](../../workflows/poteto/public-workflow.md) §5 ("the codebase is the memory, so lock it down") and [../../workflows/poteto/repos-and-evolution.md](../../workflows/poteto/repos-and-evolution.md) (lint rule per correction). The field survey and the audit checklist are in [../../concepts/agent-friendly-codebase.md](../../concepts/agent-friendly-codebase.md).

Tags: **[P]** her own words, **[S]** a secondary source, **[I]** inference.

---

## 1. What it is

Dune is the framework Lauren Tan wrote so that agents "even the ones who have very little context" can "write high quality code by default" ([P, launch post, 2026-08-11](https://x.com/poteto/status/2087227636590465030)). The same day she wrote "because of Dune, my agents now merge their own PRs" ([P](https://x.com/poteto/status/2087244771849089270)). That is the reason to study it. Her autonomous merges don't come from a cleverer reviewer. They come from a codebase where the change that looks right from one file is usually right for the whole repo.

The **contract** is a one-page statement of Dune's design. It starts from a model of how agents behave, not from how humans should behave:

> A coding agent usually optimizes for what fits in its context: copy the nearest working pattern; edit the file already open; choose the shortest path that compiles; avoid deleting code whose callers are not visible; follow the requested implementation even when it conflicts with a system invariant.
>
> These behaviors are predictable inputs to the framework design.

It then answers those behaviours with five rules:

1. The conventional path requires fewer decisions than a shortcut.
2. Forbidden dependencies fail mechanically.
3. Every durable value has one obvious writer.
4. New product work adds isolated files rather than branches in shared roots.
5. Exceptions are narrow, explicit, and reviewed as architecture changes.

Five public nouns carry the rules:
- A **Feature** creates an owned folder.
- A Feature's **Entrypoints** and **Transcript cards** are discovered from reserved files, not registered in shared inventories.
- The **Client** gives durable laptop state one writer, behind named hooks and commands.
- **Host** behaviour stays in the box behind one typed contract.
- The package boundary repeats the lesson at the top level: Dune lives at `sand/dune`, the app under `sand/src`, and Dune never imports app code.

The problem it removes: an agent can't see the whole system, so it makes changes that are right locally and wrong globally. The contract does not ask the agent to look harder. It reshapes the repo so that whatever the agent can see is enough.

## 2. Where it lives

**Provenance matters here.** Dune is closed source. The contract text in circulation is not from a post of hers, and I found no public Dune docs page.
- The earliest public copy is a third-party gist titled "Dune", created 2026-08-12, the day after launch ([S, gist](https://gist.github.com/michaelaflores/5bfed43ea91f89f425be0915c025d2d6)). It matches the screenshot word for word and has a preamble the screenshot lacks. That preamble says Dune "assumes many contributors arrive with a narrow prompt, a few nearby files, and no complete model of Sand", and that "Unsafe shortcuts fail with an error that names the supported path".
- "Sand" is Grok Bot's codename. An app bundle ID `com.anysphere.sand` was shown publicly ([S](https://x.com/MarkVillacampa/status/2087458215386632229)), which explains the `sand/dune` and `sand/src` paths.
- She says she wrote Dune "readme driven", using pstack's `/technical-writing`, by having "my agent come up with a tutorial and guide on how to write a Dune app" ([P, 2026-08-26](https://x.com/poteto/status/2092512896408592713)). [I] So the contract is most likely a page from that agent-written guide. Treat the wording as reliable in substance and unverified in detail.

**Where the same ideas live in public code:**

| File (pstack 0.15.28) | Role |
|---|---|
| `skills/correct/SKILL.md` | The closest public encoding of the whole contract. "Assume every contributor is an agent that sees only the files it opened, copies the nearest example, and takes the shortest path that compiles. Design the repo so a change that looks right from one file is right for the whole repo." It also holds the enforcer ladder: architecture, then types or lint, then tests, then docs last. |
| `skills/architect/SKILL.md` | Repeats the same contributor model as a design input. |
| `skills/architect/references/design-red-flags.md` | The rules written as review checks: "Two ways to do one task", "Importable internals", "Split ownership", "Hand-synced list". |
| `skills/principle-encode-lessons-in-structure` | "Encode the rule as a lint, metadata flag, runtime check, or script instead of more text." |
| `skills/principle-separate-before-serializing-shared-state` | Rule 3: remove the shared write target, or use a single-writer actor. |
| `skills/no-comments` | The comment ban. Constraint comments become type, runtime, test or CI checks, or get deleted. |

A community template, [epistex-dev/poteto-kit](https://github.com/epistex-dev/poteto-kit) (`docs/07-agent-first-architecture.md`), restates the contract with a "design consequence" column. That is their reading, not hers [S].

## 3. How it works, step by step

The contract is not a runtime mechanism. It acts at three moments in a change's life.

**1. When the agent picks a pattern (rules 1 and 4).** The agent opens a file and copies the nearest example. In Dune the nearest example is another Feature folder, and there is only one approved way to do each thing: no `useEffect`, no comments, one state writer. So whatever it copies is the right pattern.
- A new screen is a new folder with reserved file names. The framework finds it, so no shared route table, command list or `switch` needs a new arm.
- "all of the code that contributes to that feature lives in one directory" ([P via S transcript](https://cho.sh/7D77B5)). She calls Dune "kind of like an internal Next.js for our Electron apps" ([P, stream 30:07](https://www.youtube.com/watch?v=MN9dGgmLyso&t=1807s)), and Next.js-style discovery by file convention is the model.

**2. When the agent takes a shortcut (rules 2 and 3).** The shortest path that compiles might import a main-process module into the renderer, write durable state from a component, or reach into another feature's internals. Each of these fails mechanically, at type check, lint or CI, not in review.
- The contract preamble says the error "names the supported path" [S]. `correct` step 2 says the same: "add a lint or CI check whose error names the file, type, or function to use instead."
- **The import-graph CI from her talk:** "we literally have a directory called electron-main, electron-renderer, [and import CI where] we actually check the dependency graph to make sure they're not accidentally importing code from one directory to another." The motive is frame budget: "if you want like 60 FPS, … every frame that gets drawn has to be done in 16 milliseconds" ([P via S transcript, Compile talk](https://cho.sh/7D77B5); [video](https://www.youtube.com/watch?v=NjoZoUm85x0&t=1652s)).
- Banned patterns fail CI the same way: "in Dune and in Grokbot we've banned useEffect … ci will fail"; "We have a lot of lints for bad patterns that we observe" ([P via S](https://cho.sh/7D77B5)).

**3. When a rule seems wrong (rule 5).** Sometimes an agent, or a request, needs to break an invariant. That should not happen quietly in a feature PR. The exception is narrow (one line or one edge), explicit (written where the check reads it), and reviewed as an architecture change. `correct` makes this concrete: "Exceptions go on the offending line with a reason, an expiry date, and a human's approval."

**The loop that feeds all three: the gardener.** In the morning she reviews main, then reverts or adds a lint rule ([P, stream 53:44](https://www.youtube.com/watch?v=MN9dGgmLyso&t=3224s)). "every nit … needs to turn into a constraint … until your codebase is locked down enough that even agents with little context can one shot a high quality PR" ([P, 2026-10-12](https://x.com/poteto/status/2109699980248408574)). "codebase is memory, that's why most of the volume of PRs i land are refactoring" ([P, 2026-10-11](https://x.com/poteto/status/2109361189071499640)). The five rules are the destination. The gardener loop is how a codebase gets there one correction at a time.

### A correction to the brief

The brief remembered the talk as "CI fails on cross-feature or cross-package imports to keep the render/request thread fast". The source is narrower. The check is **cross-process**: electron-main code must not end up in electron-renderer, to protect the **UI thread's** frame budget. Cross-package direction comes from the contract's `sand/dune` → never `sand/src` rule. No source I found says Dune's CI blocks cross-feature imports. It is plausible [I] but unsourced. The general lesson still holds and is stated in her words: **a narrow, fast CI job guards one mission-critical property** (frame time) by checking a structural proxy (the import graph), because measuring the property directly is slow and flaky.

## 4. Why it works

Each rule removes one predictable agent failure. The map below covers the five tendencies, the rules that counter them, and where pstack and Pocock encode the counter.

| Agent tendency | Countered by | pstack encoding | Pocock concept |
|---|---|---|---|
| Copies the nearest working pattern | 1, 4 (the nearest example is a clean Feature) | `correct`: "Delete old ways and dead code an agent would copy." Red flag "Two ways to do one task": "An agent copies whichever way it finds first … Keep one way." | Deletion test |
| Edits the file already open | 4 (the open file is the feature's own) | Red flag "Hand-synced list": "An agent that sees one list updates only that one. Keep one list and derive the others." | Locality |
| Takes the shortest path that compiles | 2, 1 (the shortcut doesn't compile) | Red flag "Importable internals": "Make internals unreachable from outside the module, so an import from outside fails the build." `principle-type-system-discipline`: "Make the compiler reject impossible states." | Interface (invariants are part of it) |
| Won't delete code whose callers it can't see | 4, 3 (callers are local and findable) | `principle-migrate-callers-then-delete-legacy-apis`; `principle-subtract-before-you-add`; `no-comments` (no "do not remove" comments guarding dead paths) | Deletion test |
| Follows the request even when it breaks an invariant | 2, 5 (the invariant fails mechanically; changing it is an architecture review) | `principle-encode-lessons-in-structure`: "If the fix is structural, only use the structural fix. The instruction is the symptom." | Interface includes "invariants, ordering constraints, error modes" |

**The rules that do the heavy lifting:**
- **Rule 2 is the one that makes autonomous merge possible.** Rules 1, 3 and 4 make the right path likely. Rule 2 makes the wrong path fail before review, so a reviewer, human or agent, doesn't have to catch it. This is the "Check" in the [glossary](../../GLOSSARY.md), applied to architecture.
- **Rule 4 is what makes parallel agents cheap.** A shared registry makes every new feature touch the same lines, so independent worktrees conflict at merge. Reserved-file discovery removes the shared line. Cursor saw "multiple agents touch the same file", and Anthropic's C-compiler run reported "Merge conflicts are frequent". Both are in [the concept note](../../concepts/agent-friendly-codebase.md).
- **Rule 1 is the cheapest one to start with.** Deleting the second way of doing something costs one PR and stops agents copying it forever.

**The five nouns as generic patterns** (so they transfer to stacks without Dune):

| Dune noun | Generic pattern | What it prevents |
|---|---|---|
| Feature | Vertical feature folder: UI, logic and tests together, one owner | God files (early Grok Bot had "like eight god files … at least 10,000 lines long", [P, in public-workflow.md](../../workflows/poteto/public-workflow.md)) and scattered edits |
| Entrypoint | Discovery by file convention (Next.js `page.tsx`, SvelteKit `+page`) | Edits to a shared inventory, merge conflicts, half-registered features |
| Transcript card | Plugin or extension-point discovery for the product's repeated UI noun | Growing `switch`/`if` chains in a shared renderer, the "branches in shared roots" of rule 4 |
| Client | Single-writer store: named commands write, hooks read | Split ownership and diverging write rules. One place to answer "what can change X". |
| Host | A typed port in front of the OS, filesystem, network and Electron main, crossed through one typed IPC interface | Renderer code doing I/O or heavy compute (frame drops), untyped IPC payloads |
| Package boundary | One-way rule: framework never imports app, checked on the import graph | Framework coupled to one feature, cycles, a framework you can't reuse |

[I] In Pocock's terms, Client and Host are deep modules at real seams. Host has two adapters: Electron main and a test fake. Feature, Entrypoint and Transcript card maximise locality.

## 5. Edge cases and failure handling

- **The agent writes an exception to get green.** Rule 5 only works if the exception list itself is guarded. Put boundary configs and baseline files under CODEOWNERS, with a required review. Otherwise "narrow, explicit" just becomes "added by the agent". Per-stack mechanics are in [the concept note §3](../../concepts/agent-friendly-codebase.md#3-making-forbidden-dependencies-fail-mechanically).
- **Brownfield repos already break the rules.** A new boundary check fails on day one. Freeze the existing violations as a baseline (dependency-cruiser known-violations, ArchUnit `FreezingArchRule`), fail only on new ones, and let the gardener shrink the baseline.
- **The check is a proxy, and the proxy can drift.** An import-graph check guards frame time only while "no main-process imports in the renderer" still implies "no heavy work on the UI thread". Dynamic imports, IPC calls that are secretly synchronous, or a heavy pure-JS library would get past it [I]. Pair the structural check with a coarse runtime measurement (a frame-time or bundle-size budget) that runs less often.
- **Too much structure.** Cursor warns "Too much structure creates fragility", and Claude Code's docs say a hook is "for a rule with *zero* exceptions". Rules that keep needing exceptions are preferences, not invariants. Demote them to prose or delete them.
- **Agents lie about the rules.** They can't, mechanically: rule 2 is enforced by a check the author can't edit. They can still route around a rule by restructuring code so the check doesn't see it, for example re-exporting through a shared module. Write rules against reachability (transitive), not only direct imports.

## 6. Conflicts with other workflows

- **Pocock agrees on substance, differs on tone.** "Your codebase, way more than your prompt or your AGENTS.md file, is the biggest influence on AI's output" ([P](https://www.aihero.dev/how-to-make-codebases-ai-agents-love)). His unit is the *deep module* with a human-owned interface. Dune's is the *feature folder* with framework-owned conventions. Many small isolated files (rule 4) only stay agent-friendly if each sits behind a deep interface. Otherwise you get the shallow-module sprawl Pocock warns about.
- **OpenAI harness engineering is the closest match.** They use enforced layers, custom linters whose messages carry remediation, and "taste invariants" ([S, digests; the primary page blocks fetching](https://openai.com/index/harness-engineering/)). Like Dune, they encode taste in checks. Unlike Dune, they lean on agent-to-agent review and retry flaky tests.
- **Cursor's scaling work and the Anthropic C compiler accept merge conflicts** and let agents resolve them. Dune prevents them structurally. Prevention wins when parallelism is high and features are independent. Tolerating them wins on greenfield work where the structure isn't known yet.
- **Claude Code's own guidance is more permissive:** "Almost every guideline has exceptions", so keep the enforced set small. That doesn't conflict with Dune, since Dune enforces few things hard, but it argues against copying Dune's full ban list (comments, `useEffect`) into a repo whose agents haven't shown those failures.
- **ADW** has no architecture checks at all today. Its `ship-gate` runs whatever the repo's own checks are.

## 7. Porting to Claude Code and ADW

What maps directly:
- **Rule 2:** a CI job, plus optionally a PostToolUse hook that runs the boundary check on edited files so the agent hears about it in seconds rather than at CI. (S)
- **Rule 5:** CODEOWNERS on the boundary config, plus inline-exception syntax with a reason. (S)
- **The gardener loop:** pstack's `correct` already exists. In Claude Code it is a skill run on a morning review, or a `/schedule` routine that scans for repeated review comments. (M)

What has no equivalent: Dune itself. There is no off-the-shelf framework that gives you reserved-file discovery for *your* app's nouns. You get it from Next.js, SvelteKit or Rails for routes, and you build it for anything else, such as commands, cards or handlers. (L per noun)

**Sketch for the pilot.** This is research, not a backlog. The checklist is in the [concept note](../../concepts/agent-friendly-codebase.md#5-agent-readiness-audit).
1. Run the agent-readiness audit on one pilot repo and record the scores in the local pilot log.
2. Pick the single most important invariant in that repo and write one boundary rule for it with a remediation message. Freeze the existing violations and wire it as a required CI job under one minute.
3. Find the registry file that most PRs touch (`git log --format= --name-only | sort | uniq -c | sort -rn | head`). Decide whether file-convention discovery could replace it.
4. After two weeks of agent PRs, count the review comments that should have been lint rules.

## 8. Stack adaptation

Details and configs are in [the concept note §3](../../concepts/agent-friendly-codebase.md#3-making-forbidden-dependencies-fail-mechanically).
- **Node/TS:**
  - Rule 2: dependency-cruiser (`forbidden` with `reachable` for transitive hot-path rules) or eslint-plugin-boundaries; Nx `enforce-module-boundaries` in an Nx monorepo.
  - Rule 4: Next.js-style routing; `import.meta.glob` for your own reserved files.
  - Rule 3: one store module whose setters aren't exported.
- **Java/Spring Boot:**
  - Rule 2: Spring Modulith `ApplicationModules.verify()`, where top-level packages under the app package are modules and internals are hidden by default. Or ArchUnit `slices().should().notDependOnEachOther()`. Gradle or Maven modules for hard boundaries.
  - Rule 4: Spring's component scanning already does discovery by convention. Use a feature package per module, not a central `@Configuration` list.
  - Rule 3: one `@Service` owns each aggregate's writes (jMolecules `@AggregateRoot` makes it explicit).
- **Rust:**
  - Rule 2 comes nearly free. The crate graph is the boundary, since a crate can't use what it doesn't depend on.
  - Make the framework crate never depend on app crates. To stop a heavy crate entering a hot-path crate's tree, use a `cargo tree -p <hot> -i <heavy>` script. `cargo-deny`'s `wrappers` only limits direct parents. `clippy` `disallowed_methods`/`disallowed_types`, scoped by a per-crate `clippy.toml`, handle in-crate bans.
  - Rule 3: ownership helps. One `&mut` owner, or an actor task owning the state behind a channel.

## 9. Decisions for you

- **First boundary: which invariant gets the first mechanical boundary in each pilot repo?** Pick one property whose breakage is expensive and that a structural check can serve as a proxy for (her example: frame time ⇐ no main-process imports in the renderer). Default if unanswered: "framework/shared code never imports feature code".
- **Boundary-config tier: are boundary-config changes T2/T3 in the [risk tiers](../industry/risk-tiered-merge.md)?** Rule 5 says they are architecture changes, so they should not auto-merge. Default: yes, human review required, enforced by CODEOWNERS.
- Still open from the last session (**R16**): is the pilot the local "day shift" with remote stateless Runs as the later target? This contract doesn't depend on the answer. Boundary checks help in both modes.

## 10. Unknowns

- **The contract's provenance.** No primary copy exists. A public Dune doc, or a post of hers quoting it, would settle it.
- **Whether Dune's CI checks cross-feature imports**, or only main/renderer and framework/app.
- **Which tools Dune uses** for the import-graph check (dependency-cruiser, a custom script or ESLint) and how fast it runs.
- **How reserved-file discovery is implemented** (build-time codegen or runtime glob) and how it handles typing.
- **Evidence.** No controlled study tests any of these architectural rules on agent success (see [the concept note §6](../../concepts/agent-friendly-codebase.md#6-evidence)). The support is practitioner experience, hers included, and it is self-reported.

**Sources.**
- **Her own words [P]:**
  - [launch](https://x.com/poteto/status/2087227636590465030)
  - [agents merge their own PRs](https://x.com/poteto/status/2087244771849089270)
  - [readme-driven design](https://x.com/poteto/status/2092512896408592713)
  - [2,500 PRs talk](https://x.com/poteto/status/2102050467505430555)
  - [codebase is memory](https://x.com/poteto/status/2109699980248408574)
  - [most PRs are refactoring](https://x.com/poteto/status/2109361189071499640)
  - [Compile talk](https://www.youtube.com/watch?v=NjoZoUm85x0)
- **Secondary [S]:**
  - [contract gist](https://gist.github.com/michaelaflores/5bfed43ea91f89f425be0915c025d2d6)
  - [Sand codename](https://x.com/MarkVillacampa/status/2087458215386632229)
  - [talk transcript](https://cho.sh/7D77B5)
  - [redreamality summary](https://redreamality.com/blog/lauren-tan-poteto-trust-before-parallel/)
  - [poteto-kit](https://github.com/epistex-dev/poteto-kit)
- YouTube captions could not be fetched directly, so talk quotes go through the transcript page.
