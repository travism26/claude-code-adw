# Agent-friendly codebases: the field, the mechanics, and an audit

**Date:** 2026-10-28. **Question:** how do you design a codebase and dev environment so agents can create, verify and merge PRs on their own? **Method:**
- Primary vendor and practitioner sources, fetched 2026-10-28. openai.com returned 403, so every OpenAI detail is from digests and marked [S].
- Boundary tools were run on toy projects under `/tmp` (versions in §3). Configs marked **[verified]** ran and produced the output described; **[docs]** means the config was taken from the docs and not run.

**Companion:** [the Dune contract dissection](../dissections/poteto/dune-contract-agent-friendly-codebase.md) covers Lauren Tan's five rules in depth. This note puts them in the wider field and turns them into an audit you can run on any repo.

Tags: **[P]** primary, **[S]** secondary, **[I]** inference.

---

## 1. The short answer

Every serious source makes the same move. **Stop asking the agent to be careful, and make the repo shape decide.** An agent sees a few files, copies the nearest pattern and takes the shortest path that compiles. So the repo has to be one where:
- that nearest pattern is the right one;
- the shortest wrong path fails a check with a message that names the right path;
- independent work lands in independent files.

| Lever | Dune rule | Also said by |
|---|---|---|
| One obvious way to do each thing | 1. Conventional path needs fewer decisions | Rails doctrine, "pit of success", Pocock deep modules, Cursor "point at canonical examples" |
| Forbidden edges fail a check, with remediation in the error | 2. Forbidden dependencies fail mechanically | OpenAI layering linters [S], Anthropic "hooks over prose" and "actionable errors", Factory "Style & Validation" |
| One writer per piece of durable state | 3. One obvious writer | Redux, event sourcing; Cursor's failed lock experiment |
| New work adds files; discovery by convention, not by registry | 4. Isolated files, not branches in shared roots | Vertical slices (Bogard), Next.js/SvelteKit, Anthropic C-compiler lock files |
| Exceptions are rare, local and reviewed | 5. Narrow, explicit, reviewed | Claude Code "a hook is for a rule with *zero* exceptions"; Pocock's ADRs |

Dune's five rules are about **code shape**. The field adds a second half about **environment**, which Dune takes for granted:
- one-command boot per worktree;
- fast, quiet feedback;
- a short map file;
- an oracle the agent can't edit;
- observability the agent can query;
- a gardening loop.

The audit in §5 covers both halves.

## 2. The field, source by source

### OpenAI, "Harness engineering" (Ryan Lopopolo, 2026-02-11) [S]
URL: https://openai.com/index/harness-engineering/ (403 to fetch). Digests used: [ericfode wiki](https://ericfode.github.io/agent-harness-wiki/raw/articles/openai-harness-engineering) and [ai-playbooks review](https://ai-playbooks.pages.dev/reviews/harness-engineering-leveraging-codex-in-an-agent-first-world). Check the wording against the primary page before quoting it.
- **AGENTS.md is a table of contents** (about 100 lines) pointing into `docs/`. One giant AGENTS.md crowded out the task.
- **The repo is the system of record.** Decisions made in Slack or in design docs get written into the repo as Markdown, or the agent can't see them.
- **Layering is enforced mechanically.** Types → Config → Repo → Service → Runtime → UI, with cross-cutting concerns entering through "Providers". Custom linters and structural tests block illegal edges, and "linter error messages are written specifically to provide 'remediation instructions'".
- **"Taste invariants"** (naming, file size, structured logging) are enforced statically.
- **Garbage collection:** background agents scan for drift and open small refactor PRs on a schedule.
- **Agent legibility:** each worktree boots its own app, Chrome DevTools is wired in, and logs, metrics and traces can be queried from ephemeral local stacks.
- **The outside critique** is primary: "This approach puts a lot of faith into the AI-generated tests, that's not good enough yet" ([P, Böckeler](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html)).

### Anthropic [P]
- **[Claude Code best practices](https://code.claude.com/docs/en/best-practices):**
  - Instructions are advisory; hooks are deterministic. "If you keep adding emphasis to a `CLAUDE.md` line and Claude still misses it, that's a sign the line belongs in a hook."
  - CLAUDE.md should hold only "what Claude couldn't work out from the code itself".
  - "the single most useful line in your `CLAUDE.md` is the command that runs [the tests]".
  - "a hook is for a rule with *zero* exceptions … If you ever find yourself at forty of them, most are probably preferences."
  - One worktree per parallel task; `.worktreeinclude` copies the gitignored files each worktree needs.
- **[Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)** (already in [software-factory-concept.md](software-factory-concept.md)):
  - an `init.sh` that boots the dev server;
  - one feature at a time, ending in a "clean state … appropriate for merging";
  - "It is unacceptable to remove or edit tests".
- **[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents):** "Poka-yoke your tools. Change the arguments so that it is harder to make mistakes." This is rule 1 applied to tools.
- **[Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents):** errors should "clearly communicate specific and actionable improvements, rather than opaque error codes or tracebacks". This is the same point as OpenAI's remediation messages.
- **[Building a C compiler with parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler):**
  - Agents claim a task by writing a **new file** to `current_tasks/`, not by editing a shared list. That is rule 4 applied to coordination.
  - "Merge conflicts are frequent".
  - "the task verifier is nearly perfect, otherwise Claude will solve the wrong problem".
  - "The test harness should not print thousands of useless bytes". A deterministic `--fast` sample exists because "Claude can't tell time".

### Factory, "Agent Readiness" [P, vendor]
https://factory.com/news/agent-readiness
- **Thesis:** "The agent is not broken. The environment is."
- **Eight pillars:** Style & Validation, Build System, Testing, Documentation, Dev Environment, Code Quality, Observability, Security & Governance.
- **Five levels:** Functional → Documented → Standardized → Optimized → Autonomous. "Level 3 is the target."
- **Scoring:** 60+ binary criteria, graded by an LLM. A level needs 80% of its criteria plus all lower levels.
- **Example criteria:** strict TypeScript, "Can tests run locally?", CODEOWNERS, branch protection, pre-commit hooks ("the agent waits ten minutes for CI feedback instead of five seconds").
- **Grader variance** was 7% (spikes to 14.5%), down to 0.6% after anchoring each run on the previous report.
- No link between readiness level and agent success is published [I]. Treat it as a good rubric, not a proven predictor.

### Cursor [P]
- **[Rules docs](https://cursor.com/docs/rules):**
  - "Keep rules under 500 lines", and "Reference files instead of copying their contents".
  - Nested AGENTS.md files apply to their subtree, with the more specific file taking precedence.
- **[Best practices](https://cursor.com/blog/agent-best-practices)** (Lee Robinson):
  - "Use typed languages, configure linters, and write tests."
  - "Add rules only when you notice the agent making the same mistake repeatedly."
  - Point at canonical files ("See `components/Button.tsx`").
- **[Scaling long-running autonomous coding](https://cursor.com/blog/scaling-agents)** (Wilson Lin):
  - Shared locks collapsed throughput: "Twenty agents would slow down to the effective throughput of two or three."
  - Optimistic concurrency didn't fix "the deeper problems".
  - "Too little structure and agents conflict, duplicate work, and drift. Too much structure creates fragility."
- **[Towards self-driving codebases](https://cursor.com/blog/self-driving-codebases):**
  - Splitting into "many self-contained crates" cut compile waits.
  - "project structure, architectural decisions, and developer experience can affect token and commit throughput".

### Matt Pocock and Ousterhout [P]
- "Your codebase, way more than your prompt or your `AGENTS.md` file, is the biggest influence on AI's output"; "a new starter with no memory" ([aihero.dev](https://www.aihero.dev/how-to-make-codebases-ai-agents-love)).
- **Deep, grey-box modules:** "You own the interface. AI owns the implementation. Tests keep it honest." Each module gets its own folder with a clear public interface, so the agent meets complexity one layer at a time.
- **His skills** (`codebase-design`, `improve-codebase-architecture`; public at github.com/mattpocock/skills):
  - the vocabulary module, interface, depth, seam, adapter, leverage, locality;
  - the **deletion test**;
  - "One adapter means a hypothetical seam. Two adapters means a real one."
  - architecture reviews scoped to churn hot spots, which never re-open settled ADRs.
- The idea comes from Ousterhout, *A Philosophy of Software Design* ([book page](https://web.stanford.edu/~ouster/cgi-bin/book.php)). Already covered in [workflows/matt-pocock/overview.md](../workflows/matt-pocock/overview.md).

### Lauren Tan (Dune)
See [the dissection](../dissections/poteto/dune-contract-agent-friendly-codebase.md). The one-line version: "refactor/rewrite your code such that agent anti-patterns become categorically impossible … use libraries/frameworks that reduce the architectural search space, or heck, create your own framework like we did for grok bot" ([P](https://x.com/poteto/status/2109699980248408574)).

## 3. Making forbidden dependencies fail mechanically

Rule 2 in practice. Three target rules, written once per stack:
- **(a) Features don't import each other,** only shared or core.
- **(b) Framework or core never imports app code.**
- **(c) A hot path never reaches a heavy module, even transitively.** This is her frame-budget check, generalised.

**Four principles that hold for every tool:**
1. **Resolver-based beats string-based.** dependency-cruiser, Nx, ArchUnit and cargo see resolved modules. `no-restricted-imports`, Semgrep and grep see the import string, so `../b/index` slips past a `features/*` ban. This failed in testing (§3.1).
2. **Direct or transitive is the key choice.** Most lint rules check direct edges only. Rule (c) needs a graph walk: dependency-cruiser `reachable`, ArchUnit `transitivelyDependOnClassesThat`, Nx `notDependOnLibsWithTags`, or `cargo tree`.
3. **The error names the fix.** Give each rule a name, a one-line reason, the fix and an ADR link. Every tool tested prints a custom reason.
4. **Brownfield: freeze, then ratchet.** Commit a baseline of existing violations and fail only on new ones. Put the baseline under CODEOWNERS, and fail CI if it grows.

Run each guard as **its own named CI job** (`arch:boundaries`, `arch:hot-path`), not buried inside `test`. A red check then names the property that broke, and each one finishes in seconds. Also wire the same command into a pre-commit hook or a Claude Code PostToolUse hook, so the agent finds out in seconds instead of at CI.

### 3.1 Node / TypeScript

**dependency-cruiser 18.7: the best general fit [verified].** Its rules run over the resolved graph, with capture groups and `reachable` for transitive checks.

```js
// .dependency-cruiser.cjs
module.exports = {
  forbidden: [
    { name: "no-cross-feature",                                   // (a)
      comment: "Features may not import each other. Move shared code to src/shared/ or expose it via src/core/. See docs/adr/0007.",
      severity: "error",
      from: { path: "^src/features/([^/]+)/" },
      to:   { path: "^src/features/([^/]+)/", pathNot: "^src/features/$1/" } },
    { name: "core-never-imports-app",                             // (b)
      comment: "src/core is framework code. Invert the dependency: core defines an interface, the feature implements it.",
      severity: "error",
      from: { path: "^src/core/" }, to: { path: "^src/features/" } },
    { name: "render-hot-path-no-heavy",                           // (c) transitive
      comment: "The render loop must not reach src/heavy, even transitively (frame budget). Send heavy work to a worker.",
      severity: "error",
      from: { path: "^src/render/loop\\.ts$" },
      to:   { path: "^src/heavy/", reachable: true } },
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
```

- **CI command:** `depcruise src --config .dependency-cruiser.cjs --ignore-known --output-type err-long`.
- **Observed:** about 0.5 s on a toy project; exit code = number of error violations. `err-long` prints each rule's `comment` under the violation, so put the fix there. The `reachable` rule printed the whole path (`loop.ts → mid.ts → heavy/big.ts`).
- **Baseline:** `npx depcruise-baseline src --config …` writes `.dependency-cruiser-known-violations.json`. After that, `--ignore-known` passed with "4 known violations ignored" and a new cross-feature import failed. `--baseline-mode shrink-only` lets a ratchet job only ever remove entries.
- **Gotcha: TypeScript 7 gives a silent false pass.** With TS 7 installed it cruised 0 modules, exited 0 and only warned (`missing-tsc-transpiler`, needs `>=2 <7`). Pin `typescript@^6`, or fail CI when the cruised-module count is 0.
- **Gotcha: type-only imports** count only with `tsPreCompilationDeps: true`. To exempt them from a rule, add `dependencyTypesNot: ["type-only"]` to its `to`. Dynamic imports are detected as `dynamic-import`.

**eslint-plugin-boundaries 7.4 [verified]** gives editor-speed feedback on **direct** imports. The v7 API is `boundaries/dependencies` with `policies`; `element-types` is deprecated.

```js
settings: { "boundaries/elements": [
  { type: "feature", pattern: "src/features/*", capture: ["feature"] },
  { type: "shared", pattern: "src/shared" }, { type: "core", pattern: "src/core" } ] },
rules: { "boundaries/dependencies": [2, { default: "disallow",
  message: "{{from.element.types}} may not import {{to.element.types}}. Features talk only to shared/core (ADR-0007).",
  policies: [
    { from: { element: { type: "feature" } }, allow: { to: { element: { types: { anyOf: ["shared", "core"] } } } } },
    { from: { element: { type: "feature" } },
      allow: { to: { element: { type: "feature", captured: { feature: "{{from.element.captured.feature}}" } } } } },
    { from: { element: { type: "core" } }, allow: { to: { element: { type: "shared" } } } } ] }] }
```

It does not catch a transitive reach through another layer. Pair it with dependency-cruiser.

**Nx `@nx/enforce-module-boundaries` [docs; source read].** It works on tags in `project.json` and `depConstraints` in the rule. `onlyDependOnLibsWithTags` checks direct edges. **`notDependOnLibsWithTags` is transitive.** The docs don't say so, but the source walks the project graph and prints `a -> b -> c`, so it covers rule (c): `{ sourceTag: "scope:render-thread", notDependOnLibsWithTags: ["weight:heavy"] }`. Leave the global `allow: []` empty, because it skips every check for the listed imports.

**`no-restricted-imports` [verified]** is fine for "nobody imports `moment` or `node:fs` here". Don't use it for feature boundaries: without a `"../*"` entry, `../b/index` **passed**, and it needs one config block per feature.

**TS project references [verified]:** with `composite: true` projects, an undeclared edge is a compile error (TS6307), and references must be acyclic, so (b) holds by construction. The errors aren't readable for agents, so wrap them with "you crossed a package boundary; see ADR".

### 3.2 Java / Spring Boot

**ArchUnit 1.5.1 [verified]:**

```java
@AnalyzeClasses(packages = "com.acme.app", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {
  @ArchTest static final ArchRule no_cross_feature = FreezingArchRule.freeze(            // (a)
      slices().matching("com.acme.app.features.(*)..").should().notDependOnEachOther()
        .because("features talk only via shared/core; move the type to shared (ADR-0007)"));

  @ArchTest static final ArchRule core_never_imports_app =                               // (b)
      noClasses().that().resideInAPackage("com.acme.app.core..")
        .should().dependOnClassesThat().resideInAPackage("com.acme.app.features..")
        .because("core is framework code; invert the dependency with an interface in core");

  @ArchTest static final ArchRule render_hot_path =                                      // (c)
      noClasses().that().haveSimpleName("FrameLoop")
        .should().transitivelyDependOnClassesThat().resideInAPackage("com.acme.app.heavy..")
        .because("frame budget: heavy work goes through the job queue (ADR-0012)");
}
```

- **Output names the path:** `Class <…render.FrameLoop> transitively depends on <…heavy.Pdf> by [render.Mid->heavy.Pdf]`.
- **CI:** run `./gradlew test --tests '*ArchitectureTest'` as its own job.
- **FreezingArchRule [verified]:** with `freeze.store.default.allowStoreCreation=true` set once, the first run writes `archunit_store/`, and later runs report **only new** violations. Commit the store, and leave store creation off in CI. Treat `freeze.refreeze=true` as an architecture change.
- **Gotchas:**
  - It reads bytecode, so reflection and Spring injection by interface are not edges.
  - Use `DoNotIncludeTests`.
  - `failOnEmptyShould` (on by default) catches a package rename that would silently empty a rule.

**Spring Modulith 2.1 [docs].**
- **What it checks:** every direct sub-package of the `@SpringBootApplication` package is a module. `ApplicationModules.of(App.class).verify()` fails on cycles between modules and on references into another module's internals. It also fails on edges outside a module's `@ApplicationModule(allowedDependencies = {"shared", "orders :: api"})`, with `@NamedInterface("api")` marking the only public door.
- **Cost:** it is a plain unit test with no Spring context, so it runs fast.
- **Brownfield:** `Type.OPEN` lets other modules reach in while you migrate.
- **Limits:** use ArchUnit for (c), and a separate Gradle module for (b) when core is the app root.
- **jMolecules:** annotations (`@DomainLayer`, `@Port`, `@Adapter`) put the architecture into the code, and `JMoleculesArchitectureRules.ensureHexagonal()` checks it.

**Gradle/Maven multi-module [docs]** is the hard boundary: an undeclared module is a compile error.
- Features depend only on `:shared`, and `:core` has no project dependencies.
- Use `implementation`, not `api`, so a heavy library doesn't leak onto a hot-path module's compile classpath.

### 3.3 Rust

**The crate graph is the boundary [verified].** A crate can only `use` what its `Cargo.toml` lists, and cargo rejects crate cycles.
- (a) Feature crates depend on `shared`, never on each other.
- (b) `core` lists no app crates, so the reverse edge is impossible.
- Inside a crate, `pub(crate)` hides internals, and `[lints.rust] unsafe_code = "forbid"` can't be overridden lower down.

**(c) needs a `cargo tree` guard [verified]:**

```bash
#!/usr/bin/env bash
# ci/hot-path.sh <root-crate> <banned-crate>
set -euo pipefail
root=$1 banned=$2
if cargo tree -p "$root" -e normal,build --all-features --prefix none --format '{p}' \
     | awk '{print $1}' | grep -qx "$banned"; then
  echo "error[hot-path]: '$root' transitively depends on '$banned'. Path:" >&2
  cargo tree -p "$root" -e normal,build --all-features -i "$banned" >&2
  echo "fix: move the call behind the job-queue crate; see docs/adr/0012" >&2
  exit 1
fi
```

It took about 0.45 s and printed the inverted path `heavy ← core ← render`. Keep `--all-features`, or a feature flag can sneak the dependency in.

**cargo-deny 0.20 `[bans]` [verified]** also works on workspace crates. Each entry can carry `reason`, `use-instead` and `wrappers`, for example `{ crate = "heavy", wrappers = ["core"], reason = "…ADR-0012" }`. **Gotcha:** `wrappers` limits **direct** parents only. `render → core → heavy` passed, and only a direct `render → heavy` failed. Use cargo-deny for "nobody but X may depend on this" and the tree script for "this root may never reach it".

**clippy `disallowed_methods` / `disallowed_types` / `disallowed_macros` [verified]**, each with a `reason`. Put a `clippy.toml` in the hot-path crate only, and set `[lints.clippy] disallowed_methods = "deny"` (the default is warn). Example: `{ path = "std::fs::read", reason = "render thread must not block on IO; use assets::Loader" }`. There is **no `disallowed_paths` lint** ("unknown lint" in clippy 0.1.94). It checks only the crate being linted, so the tree script covers dependencies.

### 3.4 Other stacks, one line each
- **Bazel `visibility`:** an undeclared edge fails the build. Strongest, but direct edges only.
- **Python `import-linter`:** `independence` (no cross-feature), `layers` and `forbidden` contracts. Transitive by default.
- **Semgrep / ast-grep:** for languages with no graph tool. Matches strings, so it has the same relative-path weakness as `no-restricted-imports`.

### 3.5 Rule 5: narrow exceptions, reviewed as architecture

| Tool | One-edge exception | Avoid |
|---|---|---|
| dependency-cruiser | `pathNot` for the one file in that rule's `from`, with a `comment` giving reason and expiry; or leave it in the baseline | disabling the rule, `severity: "warn"` |
| boundaries | an `allow` policy naming both elements, with its own `message` | `default: "allow"` |
| Nx | `// eslint-disable-next-line @nx/enforce-module-boundaries -- <reason, ticket>` plus `reportUnusedDisableDirectives: "error"` | the global `allow` list |
| ArchUnit | `.ignoreDependency(From.class, To.class)`, or leave it in the frozen store | `freeze.refreeze=true` in CI |
| Spring Modulith | `detectViolations().filter(…)` on one exact violation; `Type.OPEN` time-boxed | — |
| Rust | `#[expect(clippy::disallowed_methods, reason = "…")]` on one item, plus `clippy::allow_attributes_without_reason` | crate-wide `#![allow]` |
| cargo-deny | add one crate to `wrappers` | `skip-tree` |

**Make boundary changes architecture changes:**
1. Put CODEOWNERS on every file where edges are declared or excused: the boundary configs, baselines, `archunit_store/`, `package-info.java`, `deny.toml`, `clippy.toml`, the guard scripts, and also `Cargo.toml`, `project.json` and `tsconfig*.json`, because edges live there too.
2. Turn on "Require review from Code Owners" in branch protection.
3. Mark the boundary jobs as required checks.
4. Run a ratchet job that fails if a baseline grows.

In [risk-tier](../dissections/industry/risk-tiered-merge.md) terms, a diff that touches these files is never auto-merged.

## 4. The patterns behind rules 3 and 4

**Vertical slices and feature folders.** "Minimize coupling between slices, and maximize coupling in a slice … New features only add code, you're not changing shared code" ([P, Bogard 2018](https://www.jimmybogard.com/vertical-slice-architecture/)). That is rule 4 in 2018 wording. **Pocock's caveat:** many small files only help if each folder has a deep interface. Otherwise the agent wades through shallow pass-through modules.

**Discovery by convention versus central registries.**
- **Convention:** "A route becomes public when a `page` or `route` file exists" ([P, Next.js](https://nextjs.org/docs/app/getting-started/project-structure)). SvelteKit `+page` and Rails conventions work the same way. "Is this a decision that's worthy of recurrent deliberation? No" ([P, Rails doctrine](https://rubyonrails.org/doctrine)).
- **Registry:** a `routes.ts`, a DI module list, an `index.ts` barrel or a handler enum makes every feature edit the same lines [I]. Two agents in separate worktrees building unrelated features then conflict at merge. Cursor saw "multiple agents touch the same file", and Anthropic's C-compiler run saw "Merge conflicts are frequent". No study measures registry conflicts directly.
- **For your own nouns** (commands, cards, jobs, handlers), build the discovery yourself:
  - TS: `import.meta.glob("./features/*/command.ts")` or codegen;
  - Spring: component scanning of a per-feature package, plus `List<Handler>` injection;
  - Rust: `inventory`/`linkme`-style distributed slices, or a `build.rs` that globs. [I; not run]

**Single writer.**
- Redux: "The only way to change the state is to emit an action" ([P](https://redux.js.org/understanding/thinking-in-redux/three-principles)).
- Event sourcing: "Capture all changes to an application state as a sequence of events" ([P, Fowler](https://martinfowler.com/eaaDev/EventSourcing.html)).
- **For agents** [I], one writer means "what can change X?" has one grep answer, and an agent editing one writer can't silently leave a second writer with different rules (pstack red flag "Split ownership").
- **The negative evidence is Cursor's:** shared mutable coordination state with locks collapsed twenty agents to the throughput of two or three.
- **Per stack:**
  - TS: one store module whose setters aren't exported.
  - Spring: one `@Service` (or jMolecules `@AggregateRoot`) owns each aggregate's writes.
  - Rust: one `&mut` owner, or an actor task behind a channel.

## 5. Agent-readiness audit

Run this on a repo before letting agents merge in it. Score each line **0** (absent), **1** (partial or advisory only) or **2** (enforced or automated), and keep the evidence: a command output, a file path. The audit tells you which **one** thing to fix next, not whether the repo is "ready". Factory's rubric is the more complete vendor version. This one is shorter, weighted toward Dune's rules, and something you can run by hand in about an hour.

### A. Code shape (Dune rules 1–5)

| # | Check | How to measure | Node/TS | Spring | Rust |
|---|---|---|---|---|---|
| A1 | **One way per task.** For the 5 most common changes (add an endpoint, a screen, a job, a table, a config flag), is there exactly one pattern in the repo? | Grep for each pattern; count variants | two HTTP clients, two state libs | `RestTemplate` and `WebClient`; field and constructor injection | `anyhow` and custom errors mixed; two async runtimes |
| A2 | **Old ways deleted.** Deprecated patterns removed, not just marked | Grep `@deprecated`/`legacy`/`old_`; count live callers | | | |
| A3 | **Boundaries fail mechanically** (rule 2). Feature↔feature and framework→app are checked in CI | A required job exists; a planted bad import fails it | dependency-cruiser | Modulith `verify()` or ArchUnit | crate graph |
| A4 | **The most critical property has a fast structural guard** (her frame-budget lesson) | Name the property; the check runs in under 60 s as its own job | `reachable` rule | ArchUnit `transitively…` | `cargo tree` script |
| A5 | **Errors name the fix.** Every custom check prints what to do instead | Trigger each check and read the message | `comment` + `err-long` | `.because(…)` | `reason =` |
| A6 | **Escape hatches banned or counted** | Count `any`, `@ts-ignore`, `@SuppressWarnings`, `unsafe`, `#[allow]` without reason | `no-explicit-any`, `ban-ts-comment` | Error Prone / ArchUnit | `allow_attributes_without_reason` |
| A7 | **One writer per durable value** (rule 3). For the 3 most important pieces of state, "what can change X?" has one answer | Grep writers of each | store with unexported setters | one service per aggregate | one owner or actor |
| A8 | **New work adds files** (rule 4). The top 10 files by PR touch count are not registries, barrels, route tables or shared enums | `git log --since=90.days --format= --name-only \| sort \| uniq -c \| sort -rn \| head` | file routing, globbed discovery | component scan | distributed slice or `build.rs` |
| A9 | **Feature folders.** A feature's code, tests and UI live under one directory | Pick 3 features; count the directories each touches | | package-per-feature | crate- or module-per-feature |
| A10 | **Exceptions are narrow and reviewed** (rule 5). Boundary configs and baselines are under CODEOWNERS; baselines can only shrink | CODEOWNERS entries; a ratchet job | | | |

### B. Environment (what Dune assumes)

| # | Check | How to measure |
|---|---|---|
| B1 | **One-command boot in a fresh worktree.** `init.sh`, `make dev` or `just dev`, with gitignored needs in `.worktreeinclude` and a port per worktree | Create a worktree; time from `git worktree add` to the app answering |
| B2 | **Fast, quiet local checks.** Typecheck, lint and unit tests run locally in under ~2 min; a pre-commit hook exists; output is terse with detail in a log | Time each; count output lines on a pass |
| B3 | **A deterministic fast test subset** for the inner loop | A documented `test:fast` exists |
| B4 | **A short map file.** CLAUDE.md/AGENTS.md has the exact commands, the non-obvious practices only, and pointers into `docs/`; under ~100 lines; no repo overview | `wc -l`; read it |
| B5 | **Docs are the system of record.** ADRs, specs and plans are in the repo, and a stale-doc check or gardening run exists | `docs/adr/` exists; a scheduled job |
| B6 | **The oracle can't be edited by the author.** Tests, check configs and verification claims are protected from the implementing agent (hook, CODEOWNERS or a separate verifier) | Try it: have an agent weaken a test and see what stops it |
| B7 | **The agent can run the real app and see it.** An E2E/browser path or HTTP probes; a [verification recipe](../dissections/poteto/verification-skill-generator.md) | `verify` runs green on a trivial claim |
| B8 | **Observability the agent can query.** Local logs (and ideally traces) are readable by command, not only in a dashboard | Run one command that shows the last request's log |
| B9 | **Zero-exception rules live in hooks or CI; preferences live in prose.** Count the hooks; ~40 is a smell | List them |
| B10 | **Governance.** Branch protection, required checks, CODEOWNERS on auth, billing and migrations; [risk tiers](../dissections/industry/risk-tiered-merge.md) defined | `gh api repos/:o/:r/branches/main/protection` |
| B11 | **Parallel-safe.** N agents in N worktrees don't share a DB, port, lock or build cache that serialises them | Run 2 at once |
| B12 | **Lessons become checks.** Repeated review comments are turned into lint or CI rules, and you can count how many have been | Review the last 20 PR comments; how many were repeats? |

### C. Reading the score

- **Fix B1, B2 and B6 first.** Without boot, fast feedback and a protected oracle, nothing else can be verified. That matches the [verification findings](../verification/skills-comparison.md).
- **Then A3 + A4 + A5 as one PR:** a single boundary rule for the single most important property, with a fix-naming message, frozen baseline and required job. This is the cheapest thing that makes autonomous merges safer.
- **Then A8:** the registry that every PR touches is where parallel agents will collide.
- **Leave A1, A2, A6 and A7 to the gardening loop (B12).** Fix them as agents trip on them, not all at once.

### D. First pilot exercise

Run it on one pilot repo and record the scores in the local, uncommitted pilot log.
1. Score A and B with evidence; this takes about an hour.
2. Pick the lowest-scoring item in B1/B2/B6 and fix it.
3. Write **one** mechanical boundary (A3–A5) for the repo's most important invariant: baseline frozen, error names the fix, required CI job under 60 s. Plant a violation and confirm it fails.
4. Run the A8 churn command. Note the top registry-style file and whether convention-based discovery could replace it. Decide; don't build yet.
5. Re-score after two weeks of agent PRs. Count the review comments that a check would have caught.

## 6. Evidence

Roughly strongest to weakest:

| Finding | Source | Strength |
|---|---|---|
| Context files "[do] not generally improve task success rates" and add >20% inference cost. Repo overviews don't help; files are useful for "non-standard coding practices" | [Gloaguen et al., ICLR 2026](https://arxiv.org/abs/2602.11988) | Moderate: controlled, several agents, benchmark tasks |
| Type-constrained decoding halves compile errors and improves correctness | [Mündler et al., PLDI 2025](https://arxiv.org/abs/2504.09246) | Strong, but about decoding; supports "types as feedback" only by analogy |
| Including tests in the prompt solves more problems | [Mathews & Nagappan](https://arxiv.org/abs/2402.13521) | Moderate; function-level benchmarks |
| Higher code health goes with behaviour-preserving LLM refactors | [Borg et al.](https://arxiv.org/abs/2601.02200) | Moderate association; only healthy code (≥7) studied |
| Experienced devs were 19% slower with AI on mature repos with "many implicit requirements" | [METR 2025](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) | Moderate RCT, n=16; argues for making implicit requirements explicit and mechanical [I] |
| AGENTS.md associated with ~29% lower median runtime; completion roughly unchanged | [Lulla et al., 2026](https://arxiv.org/abs/2601.20404) | Weak: 10 repos, correlational |
| Splitting a monolith into crates cut compile waits | Cursor self-driving post | Anecdote, one project |

**Bottom line.** The evidence that fast mechanical feedback (tests, types, lint) helps agents is reasonably good. For any specific architecture (deep modules, slices, single writer, discovery by convention) it is practitioner experience only: Lauren's, OpenAI's and Cursor's, all self-reported. No controlled study tests them. The audit is a set of well-argued bets, not measured effects.

## 7. Where the sources disagree

- **How much the map file helps.** OpenAI, Anthropic, Cursor and Factory all recommend one; Factory even scores it. Gloaguen finds no success gain at a 20% cost. Pocock says the codebase matters "way more". **Where they meet:** keep it short, non-obvious and pointer-only (B4).
- **Prevent conflicts or tolerate them.** Dune prevents them structurally (rule 4). Cursor and the Anthropic C compiler let agents resolve them. Prevention pays off once parallelism is high and the structure is known. Tolerance is fine on greenfield work.
- **How much structure.** Dune and OpenAI favour rigid, enforced layering. Cursor warns "Too much structure creates fragility". Claude Code says to keep the enforced set small. **Reconciliation [I]:** enforce few things hard (A3/A4), and let the gardener add rules only for failures actually observed (B12). Don't copy Dune's whole ban list.
- **Who verifies.** OpenAI [S] leans on agent-to-agent review and retries flaky tests. Böckeler, the Anthropic harness post and the C compiler stress test quality ("nearly perfect verifier"). This repo's position is in [verification/skills-comparison.md](../verification/skills-comparison.md).
- **Many small files versus deep modules.** These fit only if each new file sits behind a deep folder interface [I].
- **Readiness scores.** Factory's rubric is LLM-graded, and its link to agent success is unpublished. Use levels as a heuristic.

## Sources

Listed inline. Tool versions verified on 2026-10-28:
- dependency-cruiser 18.7.0;
- eslint-plugin-boundaries 7.4.0 (ESLint 9.39);
- tsc 6.0.3;
- ArchUnit 1.5.1 (Java 21);
- clippy 0.1.94 (Rust 1.94);
- cargo-deny 0.20.2.

Versions from docs only: @nx/eslint-plugin 24.0.2, Spring Modulith 2.1.2, jmolecules-integrations 1.6.0, madge 8.0.0.
