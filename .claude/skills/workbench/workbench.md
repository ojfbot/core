---
name: workbench
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "workbench", "start the
  workbench", "launch the dev environment", "open all repos". Start, stop, or inspect
  the tmux multi-repo development workbench. Uses
  core/scripts/launcher/scripts/launch.sh per ADR-0057. Commands: start (default),
  kill, status, dry-run.
---

You are a workbench launch assistant. Start, stop, or inspect a tmux multi-repo development workbench using the launcher at `core/scripts/launcher/scripts/launch.sh`.

**Tier:** 1 — Direct shell invocation (no LLM generation step)
**Phase:** Any time you need a multi-repo dev environment

## What the workbench is

A tmux session named `ojfbot` (override per invocation) with one window per registered rig. Each window has 1–4 panes per the rig's registration JSON. Five-state colored window tags surface state at a glance — see `knowledge/status-language.md` for the glyph + color table (ADR-0059).

The launcher reads JSON registrations from `core/scripts/launcher/registrations/`. Adding a rig is a JSON edit per `core/scripts/launcher/REGISTRATION_GUIDE.md`. The skill does not author registrations; it invokes the launcher.

The python predecessor at `~/.tmux/workbench/workbench.py` is preserved on disk as a fallback during the migration.

## Input

Parse `$ARGUMENTS`:

```
/workbench [start|kill|status|dry-run] [SESSION_NAME] [--include-dormant] [--window ID]
```

### Form A — start
```
/workbench start                       # default session 'ojfbot'
/workbench start my-session
/workbench start --include-dormant
```

### Form B — restart one window
```
/workbench start --window shell        # rebuild just the 'shell' window in the existing session
```

### Form C — dry-run
```
/workbench dry-run                     # print the plan; do not create the session
```

### Form D — status / kill
```
/workbench status                      # tmux ls output, plus per-window state from @rig_state options
/workbench kill                        # tmux kill-session -t ojfbot
```

## Steps

### 1. Parse arguments
- `command` — `start` (default), `kill`, `status`, `dry-run`
- positional `session_name` — defaults to `ojfbot`
- `--include-dormant` — include `priority_tier: dormant` registrations
- `--window ID` — rebuild a single window in the existing session

### 2. Validate prereqs
- Confirm `tmux`, `jq`, and `node` are on PATH.
- Confirm `core/scripts/launcher/scripts/launch.sh` exists and is executable.
- Optional: confirm Dolt sql-server is up on `127.0.0.1:3307` for the headless AgentBead worker (ADR-0043). If not, the headless pane reports the failure and stays idle.

### 3. Execute

For `start`:
```bash
core/scripts/launcher/scripts/launch.sh [SESSION] [--include-dormant] [--window ID]
```
This is non-blocking — the launcher creates the detached session and returns. The user runs `tmux attach -t <session>` to view.

For `dry-run`:
```bash
core/scripts/launcher/scripts/launch.sh [SESSION] --dry-run
```

For `kill`:
```bash
tmux kill-session -t <session>
```

For `status`:
```bash
tmux ls
tmux list-windows -t <session> -F '#{window_name}\t#{@rig_state}'
```

### 4. Output navigation summary

After `start`, surface the key bindings:

- `tmux attach -t <session>` to enter
- `prefix + a` opens an interactive Claude pane in the focused window (ADR-0060)
- `prefix + n` cycles needs-attention windows (ADR-0059)
- `Alt-N` switches to the rig with that key binding declared

## Constraints

- Do not modify any repo files.
- Do not run package installs.
- Do not edit `core/scripts/launcher/` files unless the user asks; registrations live in `core/scripts/launcher/registrations/` and follow the schema at `core/scripts/launcher/schema/registration.schema.json`.

---

$ARGUMENTS

## See Also
- `core/scripts/launcher/REGISTRATION_GUIDE.md` to author a new registration.
- `core/.claude/skills/workbench/knowledge/status-language.md` for the visual status table.
- ADR-0057, ADR-0058, ADR-0059, ADR-0060 in `core/decisions/adr/` for the design.
