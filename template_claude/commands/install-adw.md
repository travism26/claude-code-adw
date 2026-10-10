---
description: Detect this project's language/tooling and populate placeholders in the .claude/commands templates
---

# Install ADW

Inspect the current project, detect its language and tooling, then rewrite every placeholder (`{{...}}`) in the sibling `.claude/commands/*.md` files with concrete, project-specific values.

This command is meant to be run **once**, immediately after the user copies the `adws/` folder and `.claude/commands/` template into their repo. After it finishes the slash commands (`/implement`, `/test`, `/validate`, etc.) will be tailored to this project.

## Variables

force_overwrite: $1 if provided (default: false) — when true, re-populate even files that no longer contain `{{` placeholders

## Instructions

Follow these steps in order. Do not skip any.

### 1. Detect the project root and target directory

- Use the current working directory as the project root.
- The target directory is `.claude/commands/` relative to the project root.
- If `.claude/commands/` does not exist, STOP and report:
  > "No .claude/commands/ directory found. Copy the template_claude/commands/ folder into .claude/commands/ first, then re-run /install-adw."

### 2. Inspect the repository to detect the language and tooling

Run `git ls-files` (or `ls -la` if not a git repo) to see the top-level layout. Then look for the **manifest files** below — the first one found determines the primary language. If multiple are present, ask the user which one to target.

| Manifest                     | Language     |
| ---------------------------- | ------------ |
| `go.mod`                     | Go           |
| `package.json`               | TypeScript / JavaScript (check `tsconfig.json` for TS) |
| `Cargo.toml`                 | Rust         |
| `pyproject.toml`, `setup.py`, `requirements.txt` | Python |
| `pom.xml`, `build.gradle`    | Java / Kotlin |
| `Gemfile`                    | Ruby         |
| `composer.json`              | PHP          |
| `mix.exs`                    | Elixir       |
| `*.csproj`, `*.sln`          | C#           |

For the chosen language:

- **Read the manifest file** to learn the actual scripts/tasks defined (e.g., `package.json` → `scripts` object; `pyproject.toml` → `[tool.poetry.scripts]` or `[tool.pdm.scripts]`).
- **Detect the package manager** from lockfiles: `package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun, `poetry.lock` → poetry, `uv.lock` → uv, `Cargo.lock` → cargo, etc.
- **Detect the linter / formatter / type-checker** from config files in the repo (e.g., `.golangci.yml`, `.eslintrc*`, `biome.json`, `ruff.toml`, `.flake8`, `mypy.ini`, `tsconfig.json`, `rustfmt.toml`).
- **Detect the test framework** from dependencies and config (e.g., `jest.config.*`, `vitest.config.*`, `pytest.ini`, `cargo test`).
- **Detect the entry point** by reading the manifest (`main` field, `[[bin]]` table, `cmd/*/main.go`, `src/main.*`, etc.).
- **Read README.md and DESIGN.md** if they exist for additional clues about how the project is built and run.

If something can't be detected from files alone, **ask the user** rather than guess.

### 3. Build the placeholder substitution map

Construct a map of `{{PLACEHOLDER}} → concrete value`. Below are the placeholders used by the templates and how to fill them. Some are language-specific — fill them with idiomatic values for the detected language.

**Identity**
- `{{LANGUAGE}}` — display name, e.g. `Go`, `TypeScript`, `Rust`, `Python`
- `{{LANGUAGE_LOWER}}` — lowercase, e.g. `go`, `typescript`, `rust`, `python`

**Build / type-check**
- `{{BUILD_COMMAND}}` — e.g. `go build ./...`, `npm run build`, `cargo build`, `mypy .`
- `{{VERIFY_BUILD_COMMAND}}` — quick smoke check, e.g. `./app --help`, `node dist/index.js --help`

**Tests**
- `{{TEST_COMMAND}}` — full unit test suite, e.g. `go test ./... -v -race -coverprofile=coverage.out`, `npm test`, `pytest`, `cargo test`
- `{{TEST_COMMAND_VERBOSE}}` — verbose variant
- `{{TEST_COMMAND_SINGLE}}` — run a specific test, e.g. `go test ./pkg/specific/... -v -run TestName`, `npx vitest run -t "<name>"`, `pytest path/to/test.py::TestClass::test_name`
- `{{TEST_COMMAND_SPECIFIC}}` — run tests for a specific package/dir
- `{{TEST_COMMAND_COVERAGE}}` — with coverage flags
- `{{TEST_NAME}}` — short identifier for the test command, e.g. `go_test`, `npm_test`
- `{{TEST_PURPOSE}}` — one-line description, e.g. `Runs all unit tests with race detection and coverage reporting`
- `{{TEST_FRAMEWORK}}` — e.g. `Go's built-in testing package`, `Vitest`, `Jest`, `pytest`
- `{{TEST_EXTRA_FEATURES}}` — extras the test command enables (race detection, coverage, snapshot updates, etc.)

**Lint / static analysis / format**
- `{{LINT_COMMAND}}` — e.g. `golangci-lint run`, `npm run lint`, `ruff check .`, `cargo clippy`
- `{{LINT_TOOL_NAME}}` — display name, e.g. `golangci-lint`, `ESLint`, `Ruff`, `Clippy`
- `{{STATIC_ANALYSIS_COMMAND}}` — e.g. `go vet ./...`, `tsc --noEmit`, `mypy .`, `cargo check`
- `{{FORMAT_CHECK_COMMAND}}` — e.g. `gofmt -l .`, `prettier --check .`, `ruff format --check .`, `cargo fmt --check`
- `{{LINTER_DESCRIPTION}}` — short bullet-list summary of which linters/checks are enabled in this project
- `{{COMMON_VIOLATIONS_GUIDE}}` — short language-specific "before/after" examples of common violations and fixes

**Install / run**
- `{{INSTALL_DEPS_COMMAND}}` — e.g. `go mod download`, `npm install`, `pip install -r requirements.txt`, `cargo fetch`
- `{{RUN_COMMAND}}` — primary way to run the app, e.g. `go run cmd/app/main.go --help`, `npm run dev`, `python -m app`
- `{{RUN_BUILT_COMMAND}}` — run the built artifact, e.g. `./app --help`, `node dist/index.js`
- `{{RUN_SUBCOMMAND_EXAMPLE}}` — example of running a specific subcommand or mode

**Project metadata**
- `{{PACKAGE_FILE}}` — manifest filename, e.g. `go.mod`, `package.json`, `Cargo.toml`, `pyproject.toml`
- `{{ENTRY_POINT}}` — main entry file path
- `{{SRC_DIR}}` — primary source dir (e.g. `cmd/`, `src/`, `lib/`)
- `{{PROJECT_STRUCTURE}}` — short bullet-list of the most important top-level directories with one-line descriptions
- `{{PROJECT_STRUCTURE_TREE}}` — ascii tree of the project layout
- `{{RELEVANT_DIRS}}` — bullet list (markdown) of relevant source directories with descriptions, formatted like `- \`<path>\` - <description>`
- `{{ARCHITECTURE_DESCRIPTION}}` — short phrase describing architecture, e.g. `CLI structure, module organization`, `React component tree, service layer`
- `{{DEVELOPMENT_PATTERNS}}` — bullet list of language-specific guidance on where to add things (CLI commands, modules, models, configs)
- `{{LANGUAGE_SPECIFIC_PATTERNS}}` — language-specific implementation guidance for the feature planner (e.g. "For CLI commands, follow the cobra patterns in `internal/cli/`")
- `{{USAGE_TYPE}}` — what kind of interface this is, e.g. `CLI`, `HTTP API`, `library`
- `{{USAGE_EXAMPLE}}` — short code example showing how a consumer uses the feature
- `{{EXAMPLE_RULE}}` — example linter rule name for the validate.md sample, e.g. `golangci-lint/errcheck`
- `{{EXAMPLE_FILE}}` — example file path used in the validate.md sample, e.g. `pkg/service/handler.go`
- `{{VERBOSE_FLAG}}` — verbose flag for the application, e.g. `--verbose`, `-v`, `DEBUG=1`

If any placeholder is genuinely not applicable, replace it with a sensible no-op string (`N/A`) or remove the surrounding sentence — never leave a `{{...}}` token behind.

### 4. Show the user the detected configuration BEFORE writing

Print a compact summary of:
- Detected language and package manager
- The full substitution map
- The list of files that will be modified

Then ask the user: **"Apply these substitutions? (yes/no)"**

If the user says no, ask what to change and rebuild the map. Do not write files until the user confirms.

### 5. Apply the substitutions

For each `*.md` file in `.claude/commands/`:

- Skip `install-adw.md` itself (this file).
- If `force_overwrite` is false and the file contains no `{{` tokens, skip it (already populated).
- For every entry in the substitution map, replace **all** occurrences of `{{KEY}}` with its value.
- Use the Edit tool with `replace_all: true` (or rewrite the file with Write if there are many substitutions).
- After processing each file, scan for any remaining `{{...}}` tokens and warn the user about them — those represent placeholders that weren't in the substitution map and need manual attention.

### 6. Verify the result

- List every file that was modified.
- Run `grep -rn "{{" .claude/commands/` (excluding `install-adw.md`) and report any leftover placeholders.
- If `adws/` exists in the project, remind the user that the ADW Python modules expect the slash commands to be present and now they are.

### 7. Final report

Report in this format:

```markdown
## Install ADW Complete

**Detected language:** <language>
**Package manager:** <pm>
**Test framework:** <framework>
**Linter:** <linter>

**Files populated:** <count>
- .claude/commands/<file1>
- .claude/commands/<file2>
- ...

**Leftover placeholders:** <count>
<list any {{KEY}} tokens that were not substituted, with file:line>

**Next steps:**
- Run `/prime` to verify the slash commands work against this project
- Review the populated files and tweak any wording that doesn't match your conventions
- Commit the populated `.claude/commands/` and `adws/` directories
```

## Notes

- This command rewrites files in place. Recommend the user commit or stash any uncommitted work before running it.
- Be conservative: if you're not sure about a value, ask rather than fill in something wrong.
- The goal is to leave **zero `{{` tokens** in `.claude/commands/` (excluding `install-adw.md` itself).
