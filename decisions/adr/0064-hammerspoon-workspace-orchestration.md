# ADR-0064: Hammerspoon workspace orchestration

Date: 2026-04-30
Status: Proposed
OKR: 2026-Q2 / O2 (developer ergonomics) / KR2 (the morning ritual ships repeatable executable plans)
Commands affected: /workbench
Repos affected: core (scripts/launcher/hammerspoon, scripts/bootstrap.sh)

---

## Context

[ADR-0056](0056-developer-day-orchestration-master.md) sequences the launcher work across two slices. [ADR-0057](0057-launcher-mechanism-core-scripts-launcher.md) ships slice one: tmux only, no macOS automation. This ADR covers slice two — the macOS surface that arranges windows, walks Spaces, and binds keys — and lands after slice one runs cleanly. The first slice produces a single tmux session and stops. Display arrangement is manual until this ADR ships.

The launcher arranges more than tmux. It positions windows on the right displays, walks Spaces, opens supporting apps (browser windows for each Frame federated route, Blender for the asset foundry, the menubar status item), and survives the daily disconnect-reconnect of external monitors without re-tiling everything. Slice one cannot reach those surfaces; tmux owns its panes and nothing else.

The status substrate is `~/.claude/skill-telemetry.jsonl` per [ADR-0037](0037-skill-telemetry-and-intent-matching.md), with `daily-logger`'s `/api/per-rig.json` (proposed in [ADR-0063](0063-daily-logger-perrig-digest-extension.md)) as a fallback when the JSONL store is missing or stale. No OTLP, no VictoriaMetrics. The `/api/per-rig.json` endpoint serves the digests written by [ADR-0063](0063-daily-logger-perrig-digest-extension.md).

Window placement reads `display.screen` and `display.space` from the registration schema proposed for v1.1 in [ADR-0058](0058-sub-app-registration-schema.md). Rigs registered against v1.0 (no display fields) fall back to the single-screen profile.

Originally drafted as ADR-009 in the 2026-04-30 handoff; renumbered to fit core/decisions/adr/ flat numbering.

## Decision

### Tool stack

- Hammerspoon (Lua) — primary mechanism. Owns window positioning, Spaces, key bindings, menubar item, telemetry-driven status logic, and shell-out to tmux and `displayplacer`.
- `displayplacer` — command-line utility for display configuration. Hammerspoon shells out for arrangement changes.
- No AppleScript fallback in this slice. A future registration that needs `osascript` reaches it through the `pre_launch` shell hook proposed in [ADR-0058](0058-sub-app-registration-schema.md).

### What Hammerspoon owns

1. Display arrangement — reads the active `displayplacer` profile, matches against `core/scripts/launcher/hammerspoon/displays/<profile-name>.lua`, and applies it.
2. Spaces — Space 1: terminal/tmux; Space 2: browsers; Space 3: Blender; Space 4: documents and reading.
3. Window placement — reads `display.screen` and `display.space` from each registration (v1.1, per [ADR-0058](0058-sub-app-registration-schema.md)). v1.0 registrations route to the single-screen profile.
4. Key bindings:
   - `cmd+alt+1..9` — focus the rig in window N of the `ojfbot` tmux session.
   - `cmd+alt+m` — open `http://localhost:3017/intake` in the default browser if `gastown-pilot` is running on Space 2; otherwise post a notification telling the user to start it.
   - `cmd+alt+f` — split a tmux pane in the focused rig's window and run `tail -f ~/.claude/skill-telemetry.jsonl` (matches `prefix + g` per [ADR-0059](0059-tmux-topology-and-visual-status-language.md)).
   - `cmd+alt+g` — split a tmux pane in the focused rig's window and run an interactive Claude Code session with the rig's working directory as cwd (matches `prefix + a` per [ADR-0059](0059-tmux-topology-and-visual-status-language.md)).
5. Menubar status item — aggregates per-rig state from the five-state language in [ADR-0059](0059-tmux-topology-and-visual-status-language.md).
6. Reconnect handling — listens for `screensDidChange`, re-applies the matching display profile, and re-tiles within three seconds.

### What Hammerspoon does not own

- Process supervision. Dev servers run under tmux per [ADR-0057](0057-launcher-mechanism-core-scripts-launcher.md).
- File watching and tests. CI handles those.
- Network calls beyond reading `~/.claude/skill-telemetry.jsonl` and (fallback) polling `http://localhost:<daily-logger-port>/api/per-rig.json`.
- Anything that writes to a project repo.

### Telemetry source

`telemetry.lua` tails `~/.claude/skill-telemetry.jsonl` ([ADR-0037](0037-skill-telemetry-and-intent-matching.md)) using `hs.pathwatcher`. On every append it parses the new lines, updates per-rig state, and feeds the menubar item. If the JSONL file is missing or older than five minutes, it polls `daily-logger`'s `/api/per-rig.json` ([ADR-0063](0063-daily-logger-perrig-digest-extension.md)) every thirty seconds as a fallback.

### Lua module layout

```
core/scripts/launcher/hammerspoon/
├── init.lua
├── launcher.lua
├── displays.lua
├── spaces.lua
├── windows.lua
├── tmux.lua
├── status.lua
├── telemetry.lua
└── util/
    ├── shell.lua
    └── log.lua
```

`init.lua` loads the seven submodules in `launcher.lua`, `displays.lua`, `spaces.lua`, `windows.lua`, `tmux.lua`, `status.lua`, `telemetry.lua`. The `util/` files are leaf helpers.

The user's `~/.hammerspoon` is a symlink into this directory, written by `core/scripts/bootstrap.sh`. Edits in the repo land in the running config; no copy step.

### Bootstrap additions

`core/scripts/bootstrap.sh` gains:

1. `brew install hammerspoon displayplacer`.
2. `ln -sfn /Users/yuri/ojfbot/core/scripts/launcher/hammerspoon ~/.hammerspoon`.
3. An interactive walkthrough for the three macOS permissions Hammerspoon needs: Accessibility, Screen Recording, Automation. The script prints the System Settings deep link for each pane and pauses for the user.
4. No launchd login item in this slice. The user starts Hammerspoon by hand the first time and grants permissions; subsequent logins start it through the standard "Open at Login" toggle the user sets in System Settings.

### Failure modes and recovery

- Hammerspoon not running — user restarts manually. A watchdog launchd job ships in a follow-up ADR if crashes prove material.
- Display profile mismatch — falls back to the `single-screen` profile defined in `core/scripts/launcher/hammerspoon/displays/single-screen.lua`.
- Spaces missing — Hammerspoon posts a `hs.alert` with a one-click open of System Settings → Desktop & Dock → Mission Control.

## Consequences

### Gains

- The morning ritual reaches the macOS surface: the `ojfbot` tmux session lands on Space 1, browsers on Space 2, Blender on Space 3, all without the user dragging windows.
- One source of truth for display arrangement: `displayplacer` profiles live in-repo at `core/scripts/launcher/hammerspoon/displays/`.
- The five-state status language ([ADR-0059](0059-tmux-topology-and-visual-status-language.md)) reaches the menubar; the user reads system state without focusing tmux.
- Reuses the existing telemetry substrate. No new event bus.

### Costs

- Hammerspoon adds three macOS permissions (Accessibility, Screen Recording, Automation) the user has to grant on first install.
- Lua is a second runtime under `core/scripts/launcher/`; reviewers track shell, JSON, and Lua in the same tree.
- `displayplacer` is a brew dependency the user maintains; a Homebrew rename or removal blocks display arrangement.
- The bindings collide with any existing user `cmd+alt+1..9` or `cmd+alt+m/f/g` bindings; the user audits before installing.

### Risks

- Hammerspoon crashes silently. Without a watchdog, the user notices only when a binding fails. Mitigation: the menubar item turns red after thirty seconds of telemetry staleness — a visible signal Hammerspoon is alive even when no rig is firing.
- `displayplacer` profiles drift from the user's actual hardware. A new monitor changes the profile id and the Lua falls back to single-screen. Mitigation: the bootstrap walks the user through capturing a new profile snapshot on first run.
- The `cmd+alt+m` binding assumes `gastown-pilot` runs on port 3017. If the port changes (registration edit), the binding breaks until `windows.lua` re-reads the registration. Mitigation: `cmd+alt+m` reads the port from `core/scripts/launcher/registrations/gastown-pilot.json` at trigger time, not at load.

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Skip Hammerspoon and accept manual window placement. | Loses the "single command to morning ritual" promise of [ADR-0056](0056-developer-day-orchestration-master.md). The user re-tiles every reconnect. |
| Use Yabai instead of Hammerspoon. | Yabai requires SIP partial-disable on recent macOS; Hammerspoon runs with Accessibility only. Lower install friction. |
| Use AppleScript end-to-end. | AppleScript has no menubar API and no telemetry tail. Would still need a host process. |
| Ship Hammerspoon in slice one alongside tmux. | [ADR-0057](0057-launcher-mechanism-core-scripts-launcher.md) rejected this: couples a tmux change to macOS permission surface and blocks the tmux-only validation. |
| Tail OTLP / VictoriaMetrics for status. | The cluster does not run either. The skill-telemetry JSONL is the existing event surface. |
| Add a watchdog launchd job in this slice. | No data yet on Hammerspoon crash frequency. Defer to a follow-up ADR if crashes prove material. |

## Acceptance criteria

- `core/scripts/launcher/hammerspoon/init.lua` exists and loads the seven submodules listed.
- A fresh user runs `core/scripts/bootstrap.sh`, grants Accessibility / Screen Recording / Automation, and sees the launcher come up on next login with the saved layout.
- Disconnecting the primary external display triggers re-tiling within three seconds.
- All declared key bindings (`cmd+alt+1..9`, `cmd+alt+m`, `cmd+alt+f`, `cmd+alt+g`) work as specified.
- The status menubar item updates within two seconds of a state transition (per [ADR-0059](0059-tmux-topology-and-visual-status-language.md)).
- A registration's `display.screen` and `display.space` fields (v1.1, [ADR-0058](0058-sub-app-registration-schema.md)) drive window placement; v1.0 registrations without these fields fall back to the single-screen profile.
- `core/scripts/launcher/hammerspoon/displays/single-screen.lua` exists and serves as the fallback profile.

## Provenance

| Field | Value |
| --- | --- |
| Zero-point SHA | `5c2b13225c500af82431ea1a2c810951f9f8e895` (parent); slice zero-point `_pending_` |
| Hammerspoon version pinned | `_pending_` (record at brew install time) |
| displayplacer version pinned | `_pending_` (record at brew install time) |
| Display profile snapshot | `_pending_` (taken at first run; saved to `core/scripts/launcher/hammerspoon/displays/<profile-name>.lua`) |
| Originally drafted as | ADR-009 (handoff message, 2026-04-30) |
