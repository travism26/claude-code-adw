# <Component name>

**Source workflow:** <Poteto | Pocock | StrongDM | ...>  **Stages:** <from the shared taxonomy>
**Primary sources:** <file paths / URLs read for this dissection>

## 1. What it is
One paragraph: the job it does and the problem it removes.

## 2. Where it lives
The files that define it, and the role each one plays.

## 3. How it works, step by step
The mechanism in execution order: inputs, state written, scripts, exit codes, gates. Quote rules briefly and cite each one.

## 4. Why it works
For each key rule: the failure mode it prevents. Name the rules that do the heavy lifting.

## 5. Edge cases and failure handling
What happens when an input is missing, a step fails, state is stale, or the agent lies.

## 6. Conflicts with other workflows
Where Pocock, StrongDM, Ralph, Anthropic or ADW choose differently, and when each choice wins.

## 7. Porting to Claude Code and ADW
What maps directly, what has no equivalent, and a concrete design sketch for ADW (files, hooks, scripts, CLI flags) sized S/M/L.

## 8. Stack adaptation
Java Spring Boot, Rust, Node/TS: what changes for each.

## 9. Decisions for you
Choices this component forces. Link to the matching item in `../../decisions-to-grill.md` or propose a new one.

## 10. Unknowns
What the sources don't say, and what would settle it.
