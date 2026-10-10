# task-brief

A Claude Code skill that turns a rough task description into an unambiguous,
information-dense task brief — the input contract for handing work to a coding
agent (or a teammate) without it going sideways on guesses.

Format: **GOAL / SCOPE / WHAT TO BUILD / KNOWN GAPS / VERIFICATION / DECISION GATE**,
plus an ambiguity lint that catches vague verbs ("improve", "clean up"),
unbounded quantifiers ("some", "etc."), unnamed resources, and quality claims
with no runnable check.

## Files

| File | Audience | Purpose |
|---|---|---|
| `SKILL.md` | Claude | The workflow + ambiguity lint (loaded on invocation) |
| `TEMPLATE.md` | Claude + you | The fill-in brief template |
| `EXAMPLES.md` | Claude + you | An annotated real-world brief + before/after lint table |
| `README.md` | You | This file — install and usage |

## Install

**Option A — user-level (all repos at user level):**

```sh
cp -r task-brief ~/.claude/skills/
```

If you're reading this inside `~/.claude/skills/task-brief/`, it's already
installed and active everywhere — nothing to do.

**Option B — project-level (this repo only, shared with the team via git):**

```sh
mkdir -p .claude/skills
cp -r ~/.claude/skills/task-brief .claude/skills/
git add .claude/skills/task-brief
```

Project-level wins for teams: anyone who clones the repo and uses Claude Code
gets the skill automatically. User-level wins for personal use across repos.
If both exist, that's fine — they're the same skill.

**Option C — one-liner from a repo that has it:**

```sh
cp -r /path/to/repo/.claude/skills/task-brief ~/.claude/skills/
```

No build step, no dependencies — a skill is just markdown files. Restarting
the Claude Code session (or starting a new one) picks it up.

## Usage

Invoke it directly:

```
/task-brief add rate limiting to the public API
```

Or just describe the intent in conversation — these all trigger it:

- "turn this into a task brief"
- "write me a prompt for an agent to do X"
- "de-ambiguate this ticket before I kick off a run"

Claude fills in what it can infer from the conversation/repo, asks you only
for load-bearing facts it can't (the *why*, the don't-touch list, the stop
condition), then outputs the brief and flags any judgment calls left open.

Use the output as: the kickoff prompt for an autonomous run, a PR/issue
description, or the spec you hand a teammate.

## Customizing

- Edit `TEMPLATE.md` to add house sections (e.g. a SECURITY block, a
  cost-budget line). Keep sections that are empty deletable — padding is noise.
- Add domain-specific lint rules to the table in `SKILL.md` (e.g. "described-
  not-named Jira tickets → exact ticket ID").
- The frontmatter `description` in `SKILL.md` controls when Claude auto-loads
  the skill — tune its trigger phrases if it fires too often or too rarely.
