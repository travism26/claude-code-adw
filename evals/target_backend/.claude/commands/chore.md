# Chore Planning

Create a plan to complete the chore using the specified markdown `Plan Format`. Research the codebase and create a thorough plan.

## Variables

adw_id: $1
prompt: $2

## Instructions

- IMPORTANT: You're writing the plan to resolve the chore (not resolving it yet), using the `Plan Format` below. Keep it simple but thorough and precise, so nothing is missed and no second round of changes is needed.
- If the adw_id or prompt is not provided, stop and ask the user to provide them.
- Create a plan to complete the chore described in the `prompt`
- Create the plan in the `specs/` directory with filename: `chore-{adw_id}-{descriptive-name}.md`
  - Replace `{descriptive-name}` with a short, descriptive name based on the chore (e.g., "update-readme", "add-logging", "refactor-config")
- Research the codebase starting with `README.md` and `DESIGN.md`
- Replace every <placeholder> in the `Plan Format` with the requested value

## Codebase Structure

- `README.md` - Project overview and instructions (start here)
- `DESIGN.md` - Architecture and design patterns
src/routes/, src/services/, src/models/, src/tests/
- `.claude/commands/` - Claude command templates
- `specs/` - Specification and plan documents

- Read `.claude/commands/conditional_docs.md` to check if your task requires additional documentation
- If your task matches any of the conditions listed, include those documentation files in the `Plan Format: Relevant Files` section of your plan

Ignore all other files in the codebase.

## Plan Format

```md
# Chore: <chore name>

## Metadata

adw_id: `{adw_id}`
prompt: `{prompt}`

## Chore Description

<describe the chore in detail based on the prompt>

## Relevant Files

Use these files to complete the chore:

<list files relevant to the chore with bullet points explaining why. Include new files to be created under an h3 'New Files' section if needed>

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

<list step by step tasks as h3 headers with bullet points. Start with foundational changes then move to specific changes. Last step should validate the work>

### 1. <First Task Name>

- <specific action>
- <specific action>

### 2. <Second Task Name>

- <specific action>
- <specific action>

## Validation Commands

Execute these commands to validate the chore is complete:

<list specific commands to validate the work. Be precise about what to run>
- `npx tsc --noEmit` - Ensure the code compiles / type-checks
- `NODE_ENV=test TEST_QUIET=1 npx mocha --exit --timeout 10000 --reporter min --require ts-node/register --require tsconfig-paths/register --require src/tests/mocha.setup.ts 'src/tests/api/**/*.test.ts'` - Run all tests
- `npx tsc --noEmit` - Run static analysis

## Notes

<optional additional context or considerations>
```

## Chore

Use the chore description from the `prompt` variable.

## Report

Return ONLY the relative path to the plan file created (e.g., `specs/chore-9dfe4a36-description.md`).

IMPORTANT: Do NOT include any summary, explanation, or additional text. Return only the file path.
