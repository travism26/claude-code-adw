---
name: install-agentic-stack
description: Install the terminal-native agentic developer workflow stack (WezTerm, tmux, Neovim, OpenSuperWhisper, treehouse, gnhf, lavish, firstmate). Use when the user wants to set up, install, or bootstrap the agentic workflow stack, or says "install the stack", "set up my agentic workflow", or references docs/agentic-workflow-stack.md.
---

# Install Agentic Stack

Bootstrap the workflow described in `docs/agentic-workflow-stack.md`. Install **bottom-up**:
prerequisites → terminal foundation → input → isolation → autonomy → review →
orchestration. Each layer is independently useful; you can stop at any step.

## Operating rules

- **Confirm before destructive or outward-facing steps.** `gh auth login`, `*-init` commands
  that add git remotes (`treehouse init`), and the `firstmate` clone all
  change state — show what you're about to run and proceed once the user is OK with it.
- **Detect before installing.** Check each tool with the verify command below; skip anything
  already present and report it. Never reinstall over an existing config without asking.
- **One layer at a time.** Run a step, confirm it succeeded (run the verify command), then move
  on. Stop and report if a step fails — do not power through.
- **macOS assumed** (Homebrew). On Linux, swap `brew` for the project's documented Linux method
  (most have a `curl | sh` installer or `go install`/`npm`). OpenSuperWhisper is Apple-Silicon
  only — skip it elsewhere and say so.
- **Repo-scoped steps** (`treehouse init`) must run inside the target git
  repo. Ask which repo if it's ambiguous.

## Workflow

1. **Pre-flight detect.** Run the detection block and report what's already installed vs. missing.
2. **Confirm scope.** Ask whether to install the full stack or a subset (e.g. "just the
   terminal tools", "skip voice"). Default to full.
3. **Install per missing layer**, in the order below, verifying each.
4. **Summarize** what was installed, what was skipped (and why), and the manual follow-ups
   (model download + shortcut for OpenSuperWhisper; launching firstmate from inside tmux).
5. **Point to the tutorial** — `docs/terminal-foundation-tutorial.md` — for WezTerm/tmux/Neovim.

## Detection block

```bash
for t in brew git gh node go wezterm tmux nvim treehouse gnhf; do
  printf '%-14s ' "$t"; command -v "$t" >/dev/null 2>&1 && echo "OK ($(command -v $t))" || echo "MISSING"
done
echo -n "opensuperwhisper "; brew list --cask 2>/dev/null | grep -q opensuperwhisper && echo OK || echo "MISSING/n-a"
```

## Install commands by layer

**Step 0 — prerequisites**
```bash
brew install git gh node go
gh auth login                      # CONFIRM: opens browser auth
```

**Step 1 — terminal foundation**
```bash
brew install --cask wezterm
brew install tmux neovim
```

**Step 2 — input (Apple Silicon only)**
```bash
brew install opensuperwhisper
```
Manual after install: open the app → download a Whisper/Parakeet model → set a global
hold-to-record shortcut.

**Step 3 — isolation (run inside the target repo)**
```bash
curl -fsSL https://kunchenguid.github.io/treehouse/install.sh | sh   # or: go install github.com/kunchenguid/treehouse@latest
treehouse init                     # CONFIRM: writes treehouse.toml in repo root
```

**Step 4 — overnight autonomy**
```bash
npm install -g gnhf
```

**Step 5 — artifact review (skill; no install needed to use)**
```bash
npx skills add kunchenguid/lavish-axi --skill lavish
# optional: npm install -g lavish-axi && lavish-axi setup hooks
```

**Step 6 — orchestration (last)**
```bash
gh auth login                      # if not already done
git clone https://github.com/kunchenguid/firstmate
# then: cd firstmate && claude   — launch the agent FROM INSIDE tmux
```

## Notes

- treehouse, gnhf, lavish, and firstmate are all by `kunchenguid` and built to the
  AXI spec — agent-agnostic, so they work with Claude Code, Codex, Copilot CLI, etc.
- `curl | sh` installers: offer to show the script first for anyone who wants to inspect it
  before piping to a shell.
- Full architecture and per-tool rationale live in `docs/agentic-workflow-stack.md`.
