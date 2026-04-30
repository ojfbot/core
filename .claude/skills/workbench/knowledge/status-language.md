# Workbench visual status language

Single source for the launcher's window-name glyph and the tmux border color it pairs with. Read by:

- `core/scripts/launcher/scripts/lib.sh` — the bash arrays `STATE_GLYPH` and `STATE_COLOR` mirror this table.
- `core/scripts/launcher/tmux/status.sh` — applies the values when transitioning state.
- This skill — for explaining the language to a user reading at a workbench glance.

See ADR-0059 (`core/decisions/adr/0059-tmux-topology-and-visual-status-language.md`).

## States

Five states. Every registered window is in exactly one at any moment.

| State | Glyph | tmux 256-color | Hex | Meaning |
| --- | --- | --- | --- | --- |
| `healthy_infra` | `▪` | `colour240` | `#585858` | Process running. No active work expected. Daemons, watchers. |
| `healthy_active` | `●` | `colour33` | `#0087ff` | Process running. This window is today's focus. |
| `idle_active` | `○` | `colour39` | `#00afff` | Registered as active for today, no work item picked up yet. |
| `needs_attention` | `!` | `colour220` | `#ffd700` | Awaiting review, awaiting prompt response, ready signal not received. |
| `broken` | `✗` | `colour196` | `#ff0000` | Process exited non-zero, ready signal failed, deacon flagged a quality issue. |

## Window naming

Format: `[<glyph>] <id>:<priority_tier>`

Examples that should appear in a healthy launch:

```
[●] shell:active
[●] gastown-pilot:active
[▪] core:infrastructure
[▪] daily-logger:infrastructure
[○] core-reader:active
```

If the morning ritual touches `shell` and `gastown-pilot` and they pick up beads, both go blue. If `daily-logger`'s 09:00 UTC run produces a critical item, it transitions from grey to yellow until the user acknowledges. If a dev server crashes, that window flips to red until `launch.sh --window <id>` rebuilds it.

## Transitions

- **Launch sequence**: every window starts in `idle_active` (cyan) or `healthy_infra` (grey) depending on `priority_tier`. Once all `ready_signal` patterns match within their timeouts, the window moves to its base state (`healthy_active` for active, stays at `healthy_infra` for infrastructure). Failure to receive a ready signal within the configured timeout transitions to `needs_attention`.
- **Active work**: the headless AgentBead worker (per ADR-0060) picking up a bead transitions the window from `idle_active` to `healthy_active`.
- **Attention**: a bead reaching `awaiting_review` or a `nudge` event from the headless pane transitions the window to `needs_attention`.
- **Recovery**: a `broken` window does not auto-restart. The user runs `core/scripts/launcher/scripts/launch.sh --window <id>` to rebuild it.

## Key bindings

- `prefix + a` — split a new pane in the focused window and start an interactive Claude Code session in the rig's `repo.local_path`. The session inherits the rig's environment.
- `prefix + n` — cycle to the next window in `needs_attention` state. The "what needs me right now" jump.
- `Alt-N` (no prefix) — switch directly to the rig declared with `claude_sessions.interactive.key_binding: "M-N"`.

## Why these glyphs

Plain BMP characters that render in any 256-color terminal, including SSH sessions. No emoji. The yellow-on-yellow `!` and red-on-red `✗` work even on terminals that don't honor background colors — the glyph stays distinct.

## Constraints

- 256-color terminals required. The launcher refuses to start on a terminal that cannot render `colour33`.
- Adding a sixth state requires an ADR amendment to ADR-0059 and corresponding edits to `core/scripts/launcher/scripts/lib.sh`.
- Tweaking glyphs is fine in this file alone; bash and the skill both read this same table.
