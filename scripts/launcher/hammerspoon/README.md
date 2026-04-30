# Hammerspoon launcher (ADR-0064)

Lua modules that wrap `core/scripts/launcher/scripts/launch.sh` with macOS-native automation: a Spotlight-launchable URL handler, a menubar status item, and global hotkeys.

`bootstrap.sh` symlinks `~/.hammerspoon` to this directory. Hammerspoon picks up `init.lua` automatically and watches the tree for live reload.

## Modules

| File | Role |
| --- | --- |
| `init.lua` | Entry. Binds `hammerspoon://ojfbot-launch` URL event, starts menubar, registers global hotkeys. |
| `launcher.lua` | The orchestrator. Brings up tmux, opens Terminal.app, attaches, focuses by rig. |
| `status.lua` | Menubar item. Polls tmux session every 5s; aggregates state per ADR-0059. |
| `telemetry.lua` | `tail -f ~/.claude/skill-telemetry.jsonl` in Terminal. |
| `util/log.lua` | File logger at `~/Library/Logs/ojfbot-launcher.log`. |

## Hotkeys (global)

- `Cmd-Alt-1` — focus shell
- `Cmd-Alt-2` — focus core
- `Cmd-Alt-3` — focus daily-logger
- `Cmd-Alt-4` — focus gastown-pilot
- `Cmd-Alt-l` — re-run launch.sh (idempotent)
- `Cmd-Alt-m` — open gastown-pilot Intake (http://localhost:3017/intake)
- `Cmd-Alt-f` — tail skill-telemetry JSONL

## Spotlight launch

`~/Applications/ojfbot.app` is a minimal app bundle whose `Contents/MacOS/ojfbot` script invokes `hammerspoon://ojfbot-launch`. Type "ojfbot" in Spotlight, hit return, the URL fires, the orchestrator runs.

## Permissions

Hammerspoon needs three macOS permissions:

1. **Accessibility** — required for `hs.hotkey`, window focus, `hs.application:activate`.
2. **Screen Recording** — required for some window-position introspection.
3. **Automation** — required for AppleScript shell-out to Terminal.

`bootstrap.sh` walks you through granting each.

## Out of scope (this slice)

- Dynamic Space management. macOS Spaces are not safely scriptable; this slice does not move windows between Spaces. The terminal launches on whichever Space the user is on.
- displayplacer profiles. Manual display arrangement until a follow-up ADR formalizes a profile schema.
- Watchdog launchd job for Hammerspoon crashes.

## Live reload

`init.lua` registers an `hs.pathwatcher` over `~/.hammerspoon/`. Edits to any `.lua` file under it trigger `hs.reload()`. Edit, save, the menubar item disappears and reappears within a second.
