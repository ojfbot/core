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

## Gotchas

- **`start` returns instantly because it detaches — a clean exit is not a healthy session.** The launcher creates the session and returns non-blocking before any `ready_signal` has matched. Reporting "started" off the script's exit code masks windows still in `idle_active` or already flipped to `broken`. Confirm state with `tmux list-windows -F '#{@rig_state}'`, not the launch command's return.
- **`start` without `--window` against a live session is the rebuild-everything trap.** Bare `start` rebuilds the whole topology; to restart one crashed rig you must pass `--window <id>`. Omitting it tears down healthy windows the user was working in. A `broken` window never auto-restarts by design — target it explicitly.
- **`kill` takes a session name, and the default is shared.** `tmux kill-session -t ojfbot` with no arg destroys the default `ojfbot` session — which may not be the one the user meant if they launched under a custom name. Echo the exact session being killed and confirm it's the intended one; there is no undo on a kill.
- **Prereqs are environmental, not code — a missing `jq`/`node`/256-color terminal fails opaquely.** The launcher refuses to start on a terminal that can't render `colour33`, and panes silently idle if Dolt isn't up on `127.0.0.1:3307`. Run Step 2's prereq checks first; a launch that "did nothing" is usually an unmet prereq, not a bug.
- **A red (`✗`) window means a real failure to surface, not noise to restart past.** `broken` is set on non-zero exit, a failed ready signal, or a deacon quality flag — blindly re-running `launch.sh --window <id>` without reading that window's `/tmp/frame-dev-logs/*.log` just re-triggers the same failure. Investigate the log before rebuilding.

---

$ARGUMENTS

## See Also
- `core/scripts/launcher/REGISTRATION_GUIDE.md` to author a new registration.
- `core/.claude/skills/workbench/knowledge/status-language.md` for the visual status table.
- ADR-0057, ADR-0058, ADR-0059, ADR-0060 in `core/decisions/adr/` for the design.
