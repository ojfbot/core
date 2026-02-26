# Workbench Architecture

The **workbench** is a tmux-based multi-repo development environment that displays up to 9 repo tiles on a single full-screen terminal. Each tile contains three windows switchable via keyboard: a Claude CLI session, a running service, and an interactive shell.

---

## Layout

The number of tiles is determined by how many repos are in your config (capped by `max_slots`, 1–9). tmux's `tiled` layout auto-arranges panes into a balanced grid.

**6 repos (3×2, default)**
```
┌──────────────┬──────────────┬──────────────┐
│  repo-1      │  repo-2      │  repo-3      │
│  [inner tmux]│  [inner tmux]│  [inner tmux]│
├──────────────┼──────────────┼──────────────┤
│  repo-4      │  repo-5      │  repo-6      │
│  [inner tmux]│  [inner tmux]│  [inner tmux]│
└──────────────┴──────────────┴──────────────┘
```

**9 repos (3×3)**
```
┌──────────────┬──────────────┬──────────────┐
│  repo-1      │  repo-2      │  repo-3      │
├──────────────┼──────────────┼──────────────┤
│  repo-4      │  repo-5      │  repo-6      │
├──────────────┼──────────────┼──────────────┤
│  repo-7      │  repo-8      │  repo-9      │
└──────────────┴──────────────┴──────────────┘
```

```
 C-a h/j/k/l  move between tiles
 C-a 1-9      jump directly to tile
 M-1/M-2/M-3  switch window inside active tile
```

### Two-tier tmux

| Layer | Socket | Purpose |
|-------|--------|---------|
| Outer | `workbench` | Manages the N-pane grid (1–9); uses `~/.tmux/workbench/outer.conf` |
| Inner | `wb_<name>` (one per repo) | Manages 3 windows per repo; uses `~/.tmux/workbench/inner.conf` |

The outer panes each attach an inner tmux client, giving the appearance of nested layouts. Outer and inner use different prefix keys to avoid conflicts.

---

## Files

| File | Purpose |
|------|---------|
| `~/.tmux/workbench/outer.conf` | Outer tmux config — prefix `C-a`, grid nav, status bar hint |
| `~/.tmux/workbench/inner.conf` | Inner tmux config — prefix `C-g`, `M-1/2/3` window switch |
| `~/.tmux/workbench/workbench.py` | Python launcher (start / kill / status) |
| `~/.tmux/workbench/config.json` | Active config (create from example below) |
| `~/.tmux/workbench/example-config.json` | Schema reference |
| `.claude/commands/workbench.md` | `/workbench` Claude Code slash command |
| `packages/workflows/src/workflows/workbench.ts` | TypeScript handler for CLI/MCP invocation |

---

## Keybindings

### Outer tmux (tile navigation)

| Key | Action |
|-----|--------|
| `C-a` | Outer prefix |
| `C-a h/j/k/l` | Move left/down/up/right between tiles |
| `C-a 1` – `C-a 9` | Jump directly to tile 1–9 |
| `C-a z` | Zoom / unzoom current tile |
| `C-a R` | Reload `outer.conf` |

### Inner tmux (window switching, no prefix needed)

| Key | Action |
|-----|--------|
| `M-1` (Alt-1) | Switch to Claude window |
| `M-2` (Alt-2) | Switch to Service window |
| `M-3` (Alt-3) | Switch to Shell window |
| `C-g` | Inner prefix |
| `C-g d` | Detach inner tmux (returns to raw pane shell) |
| `C-g R` | Reload `inner.conf` |

---

## Config schema

`~/.tmux/workbench/config.json`:

```json
{
  "socket":    "workbench",
  "session":   "workbench",
  "max_slots": 6,
  "repos": [
    {
      "name":          "my-repo",
      "path":          "/absolute/path/to/repo",
      "init":          "export FOO=bar",
      "shell_init":    "source .venv/bin/activate",
      "service_cmd":   "pnpm start",
      "claude_cmd":    "claude",
      "claude_prompt": "help me continue the auth refactor"
    }
  ]
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | yes | — | Short label; shown in pane border and used as inner socket name (`wb_<name>`) |
| `path` | yes | — | Absolute path to repo root; must exist |
| `max_slots` | no | `6` | Cap on number of tiles shown (1–9); actual count = min(repos, max_slots) |
| `init` | no | `""` | Shell commands run at start of **all three** windows (env vars, direnv, etc.) |
| `shell_init` | no | `""` | Extra commands run only in the **shell** window (venv activation, etc.) |
| `service_cmd` | no | `""` | Command for the **service** window; falls back to a placeholder message |
| `claude_cmd` | no | `"claude"` | Base Claude CLI invocation (can include flags like `--model opus`) |
| `claude_prompt` | no | `""` | If set, appended as a quoted argument to `claude_cmd` |

---

## Installation & quick start

### Prerequisites

```bash
brew install tmux        # macOS
# or
sudo apt install tmux    # Debian/Ubuntu
```

Python 3.9+ is required (standard on macOS 12+ and modern Linux).

### One-time setup

The workbench files are installed by this repo. No further steps needed beyond creating your config:

```bash
cp ~/.tmux/workbench/example-config.json ~/.tmux/workbench/config.json
# Edit ~/.tmux/workbench/config.json — set your actual repo paths
```

### Shell alias (recommended)

Add to `~/.zshrc` or `~/.bashrc`:

```bash
alias wb='~/.tmux/workbench/workbench.py start'
alias wbr='~/.tmux/workbench/workbench.py start --reset'
alias wbs='~/.tmux/workbench/workbench.py status'
alias wbk='~/.tmux/workbench/workbench.py kill'
```

Then:

```bash
wb           # launch with default config
wbr          # hard reset + launch
wbs          # show session state
wbk          # kill everything
```

---

## Invocation methods

### 1. Direct CLI

```bash
# Use default config
~/.tmux/workbench/workbench.py start

# Use a named config
~/.tmux/workbench/workbench.py start --config ~/configs/project-x.json

# Hard reset (kills all servers first)
~/.tmux/workbench/workbench.py start --reset

# Inline JSON (no config file needed)
~/.tmux/workbench/workbench.py start --config-json '{"repos":[...]}'

# Stop all sessions
~/.tmux/workbench/workbench.py kill

# Check status without attaching
~/.tmux/workbench/workbench.py status
```

### 2. Claude Code slash command

```
/workbench start
/workbench status
/workbench kill --reset
/workbench start --repo='{"name":"api","path":"/code/api","service_cmd":"pnpm start"}'
```

### 3. CLI / MCP via `ojf-workflow`

```bash
ojf-workflow "/workbench start --config /path/to/config.json"
ojf-workflow "/workbench status"

# Inline repos (MCP use case — no file needed)
ojf-workflow '/workbench start --config-json {"socket":"workbench","session":"workbench","max_slots":6,"repos":[{"name":"api","path":"/code/api","service_cmd":"pnpm dev","claude_prompt":"help me with the auth bug"}]}'
```

For MCP callers that can't block on an interactive `tmux attach`, run `workbench.py` in the background and return the attach command:

```bash
~/.tmux/workbench/workbench.py start --config-json '...' &
echo "Attach with: tmux -L workbench attach -t workbench"
```

---

## Re-attaching after detach

If you detach from the outer session (`C-a d`) or get disconnected:

```bash
tmux -L workbench attach -t workbench
# or just:
wb   # the alias re-attaches to an existing session
```

The launcher checks `has-session` before creating new servers, so re-running `wb` without `--reset` is safe and idempotent — it simply reattaches.

---

## Adding a new repo mid-session

1. Edit `~/.tmux/workbench/config.json` to add the repo.
2. Run `wbr` (reset + relaunch) to rebuild the grid with the new slot populated.

(Partial hot-add without reset is not supported — reset takes ~2 seconds.)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Pane shows raw shell instead of inner tmux | Inner tmux attach command failed. Run `tmux -L wb_<name> attach -t wb_<name>` manually |
| `M-1/2/3` not switching windows | You may be in the outer pane — press `C-a` first to confirm you're in the inner session, then `M-1` |
| Inner session already exists on `--reset` | The `kill-server` may have taken a moment; run `wbk` then `wb` manually |
| `tmux: no server running` on status | No workbench is running — use `wb` to start one |
| Layout is not balanced | Run `C-a` `:select-layout tiled` to re-apply the tiled layout |
| `python3: command not found` | Install Python 3.9+ or adjust the shebang in `workbench.py` |
| `C-a 7/8/9` not working | Reload `outer.conf` with `C-a R` if config was updated since last start |

---

## Architecture decisions

**Why nested tmux instead of tmux windows/panes only?**
tmux panes within a single session share one layout; you cannot have independent "sub-layouts" per pane. Giving each repo its own inner tmux server provides full independence: separate prefix keys, separate window lists, separate scrollback history, and the ability to attach/detach individual repos independently.

**Why a Python script rather than a shell script?**
JSON config parsing, robust error handling, and the `--config-json` inline mode are much cleaner in Python. The script has zero dependencies beyond the Python standard library and tmux.

**Why `tiled` layout?**
`tiled` is the only tmux built-in that automatically arranges N panes into a balanced grid without manual coordinate math. Common configurations: 4 panes → 2×2, 6 panes → 3×2, 9 panes → 3×3. Any count 1–9 works; `tiled` handles the math.
