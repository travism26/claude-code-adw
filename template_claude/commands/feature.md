# Feature Planning

Create a plan to implement the feature using the specified markdown `Plan Format`. Research the codebase and create a thorough plan.

## Variables

adw_id: $1
prompt: $2

## Instructions

- If the adw_id or prompt is not provided, stop and ask the user to provide them.
- Create a plan to implement the feature described in the `prompt`: comprehensive, well-designed, following existing patterns and conventions.
- Create the plan in the `specs/` directory with filename: `feature-{adw_id}-{descriptive-name}.md` (short descriptive name, e.g. "add-user-auth", "implement-caching")
- Research the codebase starting with `README.md` and `DESIGN.md`
- Replace every <placeholder> in the `Plan Format` with the requested value. Keep each section tight — every sentence should help the implementer; do not pad.
- Use your reasoning model: THINK HARD about the feature requirements, design, and implementation approach
- {{LANGUAGE_SPECIFIC_PATTERNS}}

## Relevant Files

- `README.md` - Project overview and instructions (start here)
- `DESIGN.md` - Architecture and design patterns (required reading)
{{RELEVANT_DIRS}}
- `specs/` - Specification and plan documents

**Documentation to Check**:

- Read `.claude/commands/conditional_docs.md` to check if your task requires additional documentation
- If your task matches any of the conditions listed, include those documentation files in the `Plan Format: Relevant Files` section of your plan

## Plan Format

```md
# Feature: <feature name>

## Metadata

adw_id: `{adw_id}`
prompt: `{prompt}`

## Description

<what the feature does and for whom, the problem it solves, and the proposed approach — one tight section, not separate user-story/problem/solution essays>

## Relevant Files

Use these files to implement the feature:

<list files relevant to the feature with bullet points explaining why. Include new files to be created under an h3 'New Files' section if needed>

## Step by Step Tasks

IMPORTANT: Execute every step in order, top to bottom.

<list step by step tasks as h3 headers with bullet points. Start with foundational changes then move to specific changes. Include creating tests throughout the implementation process>

### 1. <First Task Name>

- <specific action>

<continue with additional tasks as needed>

## Testing Strategy

<bullets covering: unit tests ({{LANGUAGE}}'s testing framework: {{TEST_FRAMEWORK}}), integration tests, and the edge cases that must be covered>

## Acceptance Criteria

<list specific, measurable criteria that must be met for the feature to be considered complete>

## Validation Commands

Execute these commands to validate the feature is complete:

- `{{BUILD_COMMAND}}` - Ensure the code compiles / type-checks
- `{{TEST_COMMAND}}` - Run all tests
- `{{STATIC_ANALYSIS_COMMAND}}` - Run static analysis
- `{{LINT_COMMAND}}` - Run linter (if configured)
- <specific application command to test the feature>

## Notes

<optional additional context, future considerations, or dependencies. If new dependencies are needed, specify them for {{PACKAGE_FILE}}>
```

## Feature

Use the feature description from the `prompt` variable.

## Report

Return ONLY the relative path to the plan file created (e.g., `specs/feature-9dfe4a36-description.md`).

IMPORTANT: Do NOT include any summary, explanation, or additional text. Return only the file path.
