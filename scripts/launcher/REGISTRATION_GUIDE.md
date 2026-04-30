# Registration guide

A registration is one JSON file at `core/scripts/launcher/registrations/<id>.json` that tells the launcher how to bring up one rig in tmux. The schema is at [`schema/registration.schema.json`](schema/registration.schema.json). This guide is the prose companion. See [ADR-0058](../../decisions/adr/0058-sub-app-registration-schema.md) for the design.

## What a registration is and why it exists

The launcher mechanism is dumb on purpose. It does not parse package.json, scan for dev scripts, or guess at tmux layout. It reads a structured declaration and translates it into tmux calls. Registrations are how that declaration enters the system.

Adding a new rig is a JSON edit. Removing a rig is deleting a JSON. The launcher mechanism stays untouched in the common case, which means the morning ritual stays stable while the rig set evolves.

## Field walkthrough

### `schema_version` (required)

Pinned at `"1.0.0"`. The validator fails on any other value. Schema-breaking changes ship as a new ADR with a version bump.

### `id` (required)

Kebab-case rig identifier. Used in tmux window names, the `bd-emit agent-create --app=<id>` call (when no `bead_prefix` is set), and as the registration's filename stem. Pattern: `^[a-z][a-z0-9-]{0,31}$`.

The id is the rig's working name. It does not have to match a `BEAD_PREFIX_MAP` key — see `bead_prefix` for the bridge.

### `bead_prefix` (optional)

The bead prefix the headless AgentBead worker emits under (`<prefix>-agent-worker`). Defaults to `id` when omitted.

When the rig's directory name and its bead namespace differ, set this field. Example: `gastown-pilot` registers as `id: "gastown-pilot"` but its bead prefix is `gt` (per `BEAD_PREFIX_MAP` at `core/packages/workflows/src/types/bead.ts:95-105`). So `gastown-pilot.json` carries `"bead_prefix": "gt"`.

### `display_name` (required)

Human-friendly label. Surfaces in tmux status (when configured) and in `gastown-pilot` panels.

### `repo` (required)

```json
"repo": {
  "url": "https://github.com/ojfbot/<rig>",
  "local_path": "/Users/yuri/ojfbot/<rig>",
  "branch": "main"
}
```

`local_path` must be absolute. The validator warns if the path does not exist on disk but does not abort the launch — a fresh laptop may not have every rig cloned.

### `priority_tier` (required)

One of `infrastructure`, `active`, `dormant`. Drives default visual status (ADR-0059) and launch order:

- `infrastructure` — daemons, watchers, things you want running but not actively editing. Starts at the **healthy_infra** state (`▪`, dim grey). `daily-logger`, `core` watcher.
- `active` — today's focus. Starts at the **idle_active** state (`○`, cyan). `shell`, `gastown-pilot`.
- `dormant` — registered but skipped at launch unless `--include-dormant` is passed. `core-reader` when not actively edited.

### `rig_profile` (optional)

Per ADR-0051. Either `frame` (Frame conventions: MF, Carbon, frame-agent) or `non-frame` (deliberate divergence). Used to dispatch start commands and group windows.

### `order` (optional)

Integer, lower comes first. Defaults to 100. The launcher sorts registrations by `order` ascending, then by `id` for stability.

### `tags` (optional)

Free-form strings. The launcher does not interpret them; they exist for filtering in dashboards.

### `panes` (required)

Ordered array, 1–4 panes per window. The first pane is the window's primary; status colors derive from it.

```json
"panes": [
  {
    "name": "dev",
    "command": "pnpm dev",
    "size": "60%",
    "ready_signal": {
      "type": "stdout_match",
      "pattern": "Local:.*http://localhost:4000",
      "timeout_seconds": 90
    }
  },
  {
    "name": "claude-headless",
    "command": "node /Users/yuri/ojfbot/core/scripts/hooks/bead-emit.mjs agent-create --role=worker --app=shell --session-id=launcher && echo '✓ shell-agent-worker registered' && tail -f /dev/null",
    "size": "20%",
    "split": "horizontal"
  },
  {
    "name": "tests",
    "command": "pnpm test:watch || tail -f /dev/null",
    "size": "20%",
    "split": "vertical"
  }
]
```

- `name` — pane label, kebab-case, ≤16 chars.
- `command` — what runs in the pane. Falls back via `||` so the pane stays alive if the primary command fails (handy for rigs without a `test:watch`).
- `size` — percentage of the parent split.
- `split` — `horizontal` (stack below) or `vertical` (split right). Ignored for the first pane.
- `ready_signal` — optional. If the pane prints something matching `pattern` within `timeout_seconds`, the window transitions from `idle_active` to `healthy_active` (cyan → blue). Without a ready signal, the window stays in its initial state.

### `claude_sessions` (optional)

```json
"claude_sessions": {
  "headless": { "enabled": true, "role": "worker" },
  "interactive": { "key_binding": "M-1" }
}
```

- `headless.enabled` — toggles the AgentBead create call. Off if you don't want the rig participating in bead routing.
- `headless.role` — `worker`, `witness`, or `mayor`. Defaults to `worker`.
- `interactive.key_binding` — tmux key chord that selects this rig's window directly (no prefix needed). `M-1` is Alt-1; `M-2` is Alt-2; etc. Per ADR-0060, `prefix + a` always opens an interactive Claude pane in the currently-focused window — that's separate from this binding.

### `pre_launch` (optional)

Shell command run once before any panes start. Use for one-shot setup (clearing a temp dir, exporting an env var). Long-running processes belong in a pane, not here.

## Three worked examples

### Browser sub-app (Frame remote)

`registrations/shell.json` — port 4000, `pnpm dev` brings up shell host + frame-agent. Three panes (dev, claude-headless, tests). `priority_tier: active`, `rig_profile: frame`.

### Infrastructure daemon

`registrations/daily-logger.json` — runs the frontend dev server and emits an AgentBead. Two panes. `priority_tier: infrastructure`, `rig_profile: non-frame`.

### Dormant rig

`registrations/core-reader.json` — registered but skipped at launch unless `--include-dormant`. Two panes for when it does run.

## New-rig checklist

1. Copy `registrations/_examples/template.json` to `registrations/<id>.json`.
2. Replace `id`, `display_name`, `repo.local_path`, `bead_prefix` (if needed).
3. Set `priority_tier` deliberately.
4. Identify the dev command. Find a `ready_signal` regex.
5. Pick a Meta-N key binding that doesn't collide with another registration's.
6. Run `pnpm test` from `tests/` to validate the schema.
7. `launch.sh --dry-run` to see the plan.
8. `launch.sh` to bring it up.

## Anti-patterns

- One-shot scripts. The launcher does not run migrations, generators, or build steps. Those belong in the rig's own `pnpm` scripts or a separate cron.
- GUI apps. Hammerspoon (ADR-0064) handles browser windows, Blender, etc. The launcher owns tmux and tmux only.
- Cross-rig commands. A registration starts the rig, nothing else. If a flow depends on multiple rigs running, document it in `gastown-pilot` or a runbook, not in `pre_launch`.
- Hard-coded paths in `command`. Use `repo.local_path` as the working directory; commands run from that cwd. The exception is the `bead-emit.mjs` call, which is universal across rigs.
