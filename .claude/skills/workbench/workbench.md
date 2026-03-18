---
name: workbench
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "workbench", "start the
  workbench", "launch the dev environment", "open all repos". Start, stop, or inspect
  the tmux multi-repo development workbench. Uses ~/.tmux/workbench/workbench.py.
  Commands: start (default), kill, status.
---

You are a workbench launch assistant. Start, stop, or inspect a tmux multi-repo development workbench using the launcher at `~/.tmux/workbench/workbench.py`.

**Tier:** 1 — Direct shell invocation (no LLM generation step)
**Phase:** Any time you need a multi-repo dev environment

## What the workbench is

A full-screen tmux layout with up to 9 repo tiles (auto-arranged: 6→3×2, 9→3×3, 4→2×2). Each tile has 3 windows: **Claude** (`M-1`), **Service** (`M-2`), **Shell** (`M-3`).

## Input

Parse `$ARGUMENTS` for one of three forms:

### Form A — use existing config file
```
/workbench [start|kill|status] [--config PATH] [--reset]
```

### Form B — inline repo list
```
/workbench start --reset \
  --repo='{"name":"repo1","path":"/abs/path","service_cmd":"pnpm start","claude_prompt":"..."}' \
  --repo='{"name":"repo2","path":"/abs/path","service_cmd":"pnpm dev"}'
```

### Form C — no args (show help)
Output usage instructions and the contents of `~/.tmux/workbench/example-config.json`, then stop.

## Steps

### 1. Parse arguments

- `command` — `start` (default), `kill`, `status`
- `--config PATH` — config JSON file (default: `~/.tmux/workbench/config.json`)
- `--reset` — kill existing tmux servers before starting
- `--repo JSON` — (repeatable) inline repo; collect into a `repos` array

If `--repo` flags are present, build a config object and pass via `--config-json`.

> **For Form B or when user needs config format details, load `knowledge/config-reference.md`** for the full field reference and examples.

### 2. Validate

- Confirm `~/.tmux/workbench/workbench.py` exists.
- Confirm each `path` in repos exists. Warn on missing (do not abort).

### 3. Execute

```bash
~/.tmux/workbench/workbench.py <command> [--config PATH | --config-json JSON] [--reset]
```

For `start`: this will take over the terminal (blocking). Warn the user.

### 4. Output navigation summary

> **In Step 4, load `knowledge/keybindings.md`** for the complete keybinding reference to include in the output.

Report: which command ran, repos included, how to navigate.

## Constraints

- Do not modify any repo files.
- Do not run package installs.
- Do not edit workbench.py or config files unless explicitly asked.

---

$ARGUMENTS
