# ADR-0059: tmux topology and visual status language

Date: 2026-04-30
Status: Proposed
OKR: 2026-Q2 / O2 (developer ergonomics) / KR2 (the morning ritual ships repeatable executable plans)
Commands affected: /workbench
Repos affected: core (.claude/skills/workbench, scripts/launcher)

---

## Context

The launcher from [ADR-0057](0057-launcher-mechanism-core-scripts-launcher.md) builds one tmux session per Developer Day. That session is the developer's home for the next eight hours. A glance at it must answer four questions in one second: what is running, what am I working on, what needs me, what is broken. Without a deliberate visual language, the answer to each question is "scan every window and read every log." With one, the answer is the tmux status line.

Sub-app registrations from [ADR-0058](0058-sub-app-registration-schema.md) declare the windows, the panes inside each window, and the ready signals. This ADR fixes the visual surface those registrations land on: window naming, glyph and color set, status-line format, key bindings.

The five-state status language in this ADR is the same surface the workbench skill describes in prose. The two must not drift. Drift between the runtime renderer and the documentation is the failure mode that turns the status line into noise.

This ADR sequences after [ADR-0056](0056-developer-day-orchestration-master.md) (the orchestration master), [ADR-0057](0057-launcher-mechanism-core-scripts-launcher.md) (the launcher mechanism), [ADR-0058](0058-sub-app-registration-schema.md) (the registration schema), and [ADR-0051](0051-rigprofile-workbench-partition.md) (the original `/workbench` partition that this slice operationalizes).

Originally drafted as ADR-004 in the 2026-04-30 handoff; renumbered to fit core/decisions/adr/ flat numbering.

## Decision

### Single source of truth

The glyph, color, and state-name definitions live at one file: `core/.claude/skills/workbench/knowledge/status-language.md`. The launcher's `tmux/status.sh` script reads its tables from that file. The `/workbench` skill prose includes the same tables by reference. One file, two consumers, zero drift.

### Topology

One tmux session named `ojfbot`. One window per registration. Window names follow the pattern `[<status-glyph>] <id>:<priority-tier>`, where `<id>` is a `BEAD_PREFIX_MAP` key from ADR-0052 (`core`, `cv`, `blog`, `trip`, `pure`, `seh`, `lean`, `gt`, `hq`) or the on-disk repo name when no prefix is registered.

Examples drawn from the on-disk tree:

    [●] shell:active
    [○] core-reader:active
    [▪] daily-logger:infra
    [!] purefoy:active
    [✗] beavergame:active

Within each window, panes follow the registration's `panes` array. The default split for the canonical three-pane registration (`dev` / `claude-headless` / `tests`) is:

- `dev` occupies the top row at 60% height.
- `claude-headless` occupies the left half of the bottom row.
- `tests` occupies the right half of the bottom row.

### Status language

Five states. Each maps to one glyph, one 256-color border color, and one tmux `window-status-format`. The canonical table below is reproduced from `core/.claude/skills/workbench/knowledge/status-language.md`.

| State | Glyph | Color (256) | Hex | Meaning |
| --- | --- | --- | --- | --- |
| Healthy infrastructure | ▪ | 240 | #585858 | Process running, no active work expected |
| Healthy active | ● | 33 | #0087ff | Process running, today's focus |
| Idle active | ○ | 39 | #00afff | Registered as active for today but no current work item |
| Needs attention | ! (yellow bg) | 220 | #ffd700 | Awaiting review, awaiting prompt response, ready signal not received |
| Broken | ✗ (red bg) | 196 | #ff0000 | Process exited non-zero, ready signal failed |

### Status transitions

- Launch: every window starts in `idle active` or `healthy infrastructure` per its priority tier (ADR-0058 `priority` field).
- Ready: once all of the registration's `ready_signals` (ADR-0058) report success, the window settles to its base state.
- Active work: when the headless Claude session (ADR-0060) picks up a bead, the window transitions from `idle active` to `healthy active`.
- Recovery: a `broken` window does not auto-restart. The developer runs `core/scripts/launcher/scripts/launch.sh --window <id>` to restart that window's processes.

The renderer is `core/scripts/launcher/scripts/tmux/status.sh`. It calls `tmux set-option -t ojfbot -w pane-border-style fg=colour<n>` per window and rewrites the window-status format on each transition. No Lua, no external daemon. Hammerspoon arrives in [ADR-0064](0064-hammerspoon-workspace-orchestration.md); this slice does not depend on it.

### Key bindings

- `prefix + g` opens a popup pane tailing `~/.claude/skill-telemetry.jsonl` (ADR-0037).
- `prefix + ?` shows a cheat sheet listing every registered window with its current status.
- `prefix + a` attaches the user-facing Claude Code session for the current window in a tmux pane (ADR-0060).
- `prefix + n` cycles to the next window in `needs attention` state.

### Terminal capability gate

The launcher refuses to start the session when `tput colors` reports fewer than 256. The error message names the terminal emulator and links to the iTerm2 / Ghostty / WezTerm settings that enable 256-color mode.

## Consequences

### Gains

- One glance answers what is running, what is mine today, what needs me, what is broken.
- The status table is one file, used by both the renderer and the documentation. Drift requires editing one file.
- New rigs slot in by adding a registration (ADR-0058); the visual language applies without further configuration.
- Recovery is a single command (`launch.sh --window <id>`) that shows the transition through `broken` to `healthy active`.

### Costs

- Five states is a vocabulary the developer learns once.
- 256-color terminals are a hard requirement; macOS Terminal.app default profile fails the gate.
- The launcher and the workbench skill prose both depend on `status-language.md`; renaming that file breaks both consumers.

### Neutral

- The Gas City vocabulary (Mayor, Polecat, Witness) does not appear on the status line. ADR-0056's naming map keeps user-facing surfaces on `worker` / `witness` / `mayor`.
- Multi-monitor placement of the terminal window is out of scope here; ADR-0064 addresses Hammerspoon-driven Spaces and display assignment.

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Three-state language (running / stopped / broken) | Collapses `idle active` and `needs attention` into `running`; loses the "what wants me right now" signal that drives `prefix + n`. |
| Seven-state language adding `starting` and `degraded` | `starting` is a sub-second transition the eye does not catch; `degraded` has no clear renderer signal distinct from `needs attention`. |
| tmux plugin (`tmux-resurrect` + custom theme plugin) | Adds a runtime dependency outside `core/scripts/launcher`; the renderer is 50 lines of `tmux set-option` shell. |
| Lua via Hammerspoon for borders | Couples the first slice to ADR-0064; this slice ships before Hammerspoon lands. |
| Place the status table inside the launcher script | Forces the workbench skill prose to duplicate it; drift is then inevitable. |

## Acceptance criteria

- `core/.claude/skills/workbench/knowledge/status-language.md` exists and contains the five-state table.
- A tmux session launched by `core/scripts/launcher/scripts/launch.sh` displays the five states correctly across at least three test registrations covering at least two priority tiers.
- `prefix + n` cycles through windows in `needs attention` state and skips windows in any other state.
- A break-and-recover scenario (kill a dev server, restart with `launch.sh --window <id>`) shows the window passing through `broken` and settling on `healthy active`.
- The launcher refuses to start the session when `tput colors` reports fewer than 256, and the error names the terminal emulator's settings page.
- The workbench skill prose references `status-language.md` rather than restating the table inline.

## Provenance

| Field | Value |
| --- | --- |
| Zero-point SHA | `5c2b13225c500af82431ea1a2c810951f9f8e895` (parent); slice zero-point `_pending_` |
| Originally drafted as | ADR-004 (handoff message, 2026-04-30) |
| Renderer | `core/scripts/launcher/scripts/tmux/status.sh` |
| Source-of-truth file | `core/.claude/skills/workbench/knowledge/status-language.md` |
| Terminal emulator chosen | `_pending_ — first ship targets iTerm2; Ghostty/WezTerm validation later_ |
| tmux version pinned | `_pending_` |
| Manifest | `core/decisions/orchestration/DD-2026-04-30.md` |
