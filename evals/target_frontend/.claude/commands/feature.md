# Feature Planning

Create a plan to implement the feature using the specified markdown `Plan Format`. Research the codebase and create a thorough plan.

## Variables

adw_id: $1
prompt: $2

## Instructions

- If the adw_id or prompt is not provided, stop and ask the user to provide them.
- Create a plan to implement the feature described in the `prompt`: comprehensive, well-designed, following existing patterns and conventions.
- Create the plan in the `specs/` directory with filename: `feature-{adw_id}-{descriptive-name}.md` (short descriptive name, e.g. "add-user-auth", "implement-caching")
- Research the codebase starting with `README.md`
- Replace every <placeholder> in the `Plan Format` with the requested value. Keep each section tight — every sentence should help the implementer; do not pad.
- Use your reasoning model: THINK HARD about the feature requirements, design, and implementation approach
- This is a Next.js (App Router) + React + TypeScript app: Chakra UI components, TanStack Query hooks over a typed `ApiClient` (`utils/api.ts`), react-hook-form. Strict TypeScript. Backend calls are made through the `api/` client modules and `hooks/`; UI lives in `app/` (routes) and `components/`.

## Relevant Files

- `README.md` - Project overview and instructions (start here)
- `app/` - Next.js App Router routes (e.g. `app/grows/[id]/page.tsx`)
- `components/` - React components
- `hooks/` - TanStack Query data hooks
- `api/` - typed API client modules; `utils/api.ts` - the shared `ApiClient`
- `e2e/` - Playwright end-to-end specs
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

<list step by step tasks as h3 headers with bullet points. Start with foundational changes then move to specific changes. Include creating/updating tests throughout the implementation process>

### 1. <First Task Name>

- <specific action>

<continue with additional tasks as needed>

## Testing Strategy

<bullets covering: Playwright e2e specs under `e2e/` for user-facing behavior, component-level assertions, and the edge cases that must be covered. Prefer data-testid hooks for stable selectors.>

## Acceptance Criteria

<list specific, measurable criteria that must be met for the feature to be considered complete>

## Validation Commands

Execute these commands to validate the feature is complete:

- `npx tsc --noEmit` - Ensure the code type-checks
- `npm run build` - Ensure the Next.js app compiles (production build)
- `npm run lint` - Run the linter
- <specific Playwright spec or application command to test the feature>

## Notes

<optional additional context, future considerations, or dependencies. If new dependencies are needed, specify them for package.json>
```

## Feature

Use the feature description from the `prompt` variable.

## Report

Return ONLY the relative path to the plan file created (e.g., `specs/feature-9dfe4a36-description.md`).

IMPORTANT: Do NOT include any summary, explanation, or additional text. Return only the file path.
