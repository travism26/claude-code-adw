# Terminal Foundation Tutorial — WezTerm, tmux & Neovim

A practical, get-productive-fast guide to the three terminal tools the agentic workflow stack
sits on. Read top to bottom the first time; after that, treat the cheat sheets as reference.

**How they relate (this trips everyone up at first):**

- **WezTerm** is the *window* — the actual terminal application drawing pixels on screen.
- **tmux** runs *inside* WezTerm and splits one window into many persistent panes/windows that
  survive disconnects. This is what makes a crew of agents visible at once.
- **Neovim** runs *inside* a tmux pane — it's your text editor for code and config.

You can use any one without the others, but in this workflow they nest:
`WezTerm → tmux → (shell | nvim | agent crewmates)`.

> WezTerm also has its *own* pane/tab multiplexing. So why also run tmux? Because tmux sessions
> **persist** (detach/reattach, survive SSH drops and terminal restarts) and firstmate spawns
> each crewmate into its own **tmux window**. Rule of thumb: let WezTerm be the app, let tmux
> own the panes.

---

## 1. WezTerm

A fast, GPU-accelerated terminal configured entirely in **Lua**. No clicking through settings —
your whole setup is one version-controllable file.

### First run
Launch it like any app. You get a normal shell. That's it — it works out of the box.

### Configuration
WezTerm reads `~/.wezterm.lua` (or `~/.config/wezterm/wezterm.lua`). Create it:

```lua
-- ~/.wezterm.lua
local wezterm = require("wezterm")
local config = wezterm.config_builder()

config.font = wezterm.font("JetBrains Mono")   -- brew install --cask font-jetbrains-mono
config.font_size = 14
config.color_scheme = "Catppuccin Mocha"        -- hundreds built in
config.enable_tab_bar = true
config.window_decorations = "RESIZE"            -- thin title bar
config.scrollback_lines = 10000

return config
```

Save and WezTerm **hot-reloads** — no restart needed. If the config has an error, WezTerm shows
it in a banner instead of crashing.

### Essential key bindings (defaults, macOS)
| Action | Keys |
|--------|------|
| New tab | `Cmd+T` |
| Next / prev tab | `Cmd+Shift+]` / `Cmd+Shift+[` |
| Split pane vertical / horizontal | `Cmd+Shift+D` / `Cmd+Shift+Shift+D` (often remapped) |
| Navigate panes | `Cmd+Opt+Arrow` |
| Zoom pane | `Cmd+Shift+Z` |
| Copy mode (scroll/search) | `Cmd+Shift+X` |
| Command palette | `Cmd+Shift+P` |
| Font bigger / smaller / reset | `Cmd+=` / `Cmd+-` / `Cmd+0` |

> **In this workflow you'll lean on tmux for splits, not WezTerm's.** Use WezTerm tabs for
> top-level contexts (e.g. one tab per repo) and let tmux handle panes inside.

### Handy config additions
```lua
-- Bigger scrollback + a key to clear it
config.keys = {
  { key = "k", mods = "CMD", action = wezterm.action.ClearScrollback("ScrollbackAndViewport") },
}
-- Slight transparency
config.window_background_opacity = 0.95
```

---

## 2. tmux

A **terminal multiplexer**: many windows and panes in one session, and — critically —
**sessions that persist**. Close the terminal, reboot, lose your SSH connection: reattach and
everything is exactly where you left it.

### Vocabulary
- **Session** — a named workspace (e.g. `myapp`). Contains windows.
- **Window** — like a tab. Contains panes. (firstmate puts each crewmate in its own window.)
- **Pane** — a split within a window.
- **Prefix** — the key you press *before* any tmux command. Default `Ctrl+b`. Many people
  remap it to `Ctrl+a` (shown below). In the cheat sheet, `prefix` means "press Ctrl+b, release,
  then the next key."

### Start here
```bash
tmux new -s work      # start a new session named "work"
# ... do stuff ...
# detach: prefix then d   →   session keeps running in the background
tmux ls               # list sessions
tmux attach -t work   # reattach
```

### Daily cheat sheet (default prefix = `Ctrl+b`)
| Action | Keys |
|--------|------|
| **Sessions** | |
| New named session | `tmux new -s name` |
| Detach (leave it running) | `prefix d` |
| List / switch sessions | `prefix s` |
| Rename session | `prefix $` |
| **Windows (tabs)** | |
| New window | `prefix c` |
| Next / prev window | `prefix n` / `prefix p` |
| Go to window N | `prefix 0`…`9` |
| Rename window | `prefix ,` |
| List windows | `prefix w` |
| Close window | `prefix &` |
| **Panes (splits)** | |
| Split vertical (left/right) | `prefix %` |
| Split horizontal (top/bottom) | `prefix "` |
| Move between panes | `prefix` then arrow keys |
| Zoom pane (toggle fullscreen) | `prefix z` |
| Close pane | `prefix x` |
| Cycle pane layouts | `prefix space` |
| **Copy / scroll** | |
| Enter copy mode (then scroll/search) | `prefix [` |
| Search up in copy mode | `Ctrl+s` (or `?`) then type |
| Quit copy mode | `q` |

### Recommended `~/.tmux.conf`
```bash
# Remap prefix to Ctrl+a (easier reach)
unbind C-b
set -g prefix C-a
bind C-a send-prefix

set -g mouse on                 # click panes, drag to resize, scroll naturally
set -g base-index 1             # windows start at 1, not 0
setw -g pane-base-index 1
set -g history-limit 50000      # big scrollback
set -sg escape-time 0           # no delay after Esc (matters for Neovim)
set -g renumber-windows on      # keep window numbers sequential

# Intuitive split keys that remember the current directory
bind | split-window -h -c "#{pane_current_path}"
bind - split-window -v -c "#{pane_current_path}"

# Reload config without restarting
bind r source-file ~/.tmux.conf \; display "reloaded"

# Vim-style pane navigation
bind h select-pane -L
bind j select-pane -D
bind k select-pane -U
bind l select-pane -R
```
Apply it: inside tmux run `prefix r` (with the binding above), or `tmux source-file ~/.tmux.conf`.

### How firstmate uses tmux
When you launch your agent **from inside a tmux session**, firstmate spawns each crewmate into
a new **window** of *that* session. So:
- `prefix w` → see all crewmate windows.
- `prefix 1/2/3…` → jump to a specific crewmate and watch it work live.
- `prefix d` → detach and let the whole crew keep running; `tmux attach` later to check in.

This is the single most important reason to start your agent inside tmux.

---

## 3. Neovim

A hyper-extensible, keyboard-driven editor. The learning curve is the **modal editing** model —
once it clicks, you edit at the speed of thought.

### The one concept that matters: modes
- **Normal mode** (the default — `Esc` always returns here): keys are *commands*, not text.
  `j`/`k` move down/up, `dd` deletes a line, etc.
- **Insert mode** (`i`): type text like a normal editor. `Esc` to leave.
- **Visual mode** (`v`): select text. `V` selects whole lines.
- **Command-line mode** (`:`): run commands like `:w` (save), `:q` (quit).

> Mantra: **press `Esc` first** whenever you're unsure where you are.

### Survival kit — enough to actually use it today
| Goal | Keys |
|------|------|
| Quit (and stop being trapped 😄) | `Esc` then `:q!` (quit, discard) |
| Save | `:w` |
| Save and quit | `:wq` or `ZZ` |
| Enter insert mode | `i` (before cursor), `a` (after), `o` (new line below) |
| Back to normal | `Esc` |
| Move | `h j k l` (left/down/up/right) or arrow keys |
| Word forward / back | `w` / `b` |
| Line start / end | `0` / `$` |
| Top / bottom of file | `gg` / `G` |
| Go to line 42 | `:42` |
| Delete line | `dd` |
| Delete word | `dw` |
| Undo / redo | `u` / `Ctrl+r` |
| Copy line / paste | `yy` / `p` |
| Search | `/text` then `Enter`; `n`/`N` for next/prev |
| Find & replace all | `:%s/old/new/g` |
| Open a file | `:e path/to/file` |

### Speak Vim: verbs + motions
The power is *composability* — a **verb** plus a **motion**:
- `d` delete, `c` change (delete + insert), `y` yank (copy), `v` select.
- `w` word, `$` end of line, `}` paragraph, `ip` "inner paragraph", `i"` "inside quotes".

So `ciw` = change inner word, `dap` = delete a paragraph, `yi(` = yank inside parentheses,
`d$` = delete to end of line. Learn the pieces, combine endlessly.

### Built-in tutor (do this once — 30 minutes)
```bash
nvim +Tutor
```
This is the single highest-leverage thing you can do. It's an interactive lesson inside Neovim.

### A minimal modern config
Neovim config lives in `~/.config/nvim/init.lua`. A tiny sane starting point:

```lua
-- ~/.config/nvim/init.lua
vim.g.mapleader = " "                 -- space as leader key
vim.opt.number = true                 -- line numbers
vim.opt.relativenumber = true         -- relative numbers (great for motions like 5j)
vim.opt.expandtab = true              -- spaces, not tabs
vim.opt.shiftwidth = 2
vim.opt.tabstop = 2
vim.opt.ignorecase = true
vim.opt.smartcase = true
vim.opt.termguicolors = true          -- full color (works well in WezTerm)
vim.opt.clipboard = "unnamedplus"     -- share clipboard with the OS
vim.opt.scrolloff = 8                 -- keep context around the cursor

-- quick saves/quits
vim.keymap.set("n", "<leader>w", ":w<CR>")
vim.keymap.set("n", "<leader>q", ":q<CR>")
```

### Going further (when ready, not now)
Most people eventually adopt a **distribution** instead of hand-rolling config:
- **kickstart.nvim** — a single, well-commented `init.lua` you own and grow. Best for learning.
- **LazyVim** / **NvChad** / **AstroNvim** — batteries-included setups with a plugin manager,
  LSP (autocomplete + go-to-definition), fuzzy file finder (Telescope), file tree, and git
  integration preconfigured.

Don't start here — get comfortable with motions first, then add a distribution once plain
editing feels natural.

---

## Putting it together — a typical session

```bash
# 1. Open WezTerm (your terminal app)

# 2. Start or attach a persistent tmux session for the repo
tmux new -s myapp            # or: tmux attach -t myapp

# 3. Split a pane for the editor, another for commands
#    prefix |   (editor on the left)   prefix -   (shell below)

# 4. Edit code in one pane
nvim src/app.ts

# 5. Run your agent in another pane/window — crewmates appear as new tmux windows
claude                           # firstmate orchestrates; prefix w to see the crew

# 6. Going to bed? detach and let it run
#    prefix d      → later: tmux attach -t myapp
```

---

## Cheat sheet of cheat sheets

| You want to… | Tool | Keys / command |
|--------------|------|----------------|
| Open a new terminal tab | WezTerm | `Cmd+T` |
| Reload terminal config | WezTerm | auto (save `~/.wezterm.lua`) |
| Keep work alive after closing terminal | tmux | `prefix d`, later `tmux attach` |
| See all agent crewmates | tmux | `prefix w` |
| Split the screen | tmux | `prefix \|` / `prefix -` |
| Jump between splits | tmux | `prefix h/j/k/l` |
| Get OUT of Neovim | Neovim | `Esc` `:q!` |
| Save in Neovim | Neovim | `:w` |
| Learn Neovim properly | Neovim | `nvim +Tutor` |

> First-week advice: don't try to memorize everything. Learn `prefix d` / `tmux attach`, the
> tmux split keys, and `nvim +Tutor`. The rest sticks through use.
