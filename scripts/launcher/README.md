# core/scripts/launcher

The implementation behind `/workbench`. Reads JSON registrations and brings up a tmux session with one window per rig, three or four panes per window, and a five-state colored status language.

See:
- [ADR-0056](../../decisions/adr/0056-developer-day-orchestration-master.md) — master
- [ADR-0057](../../decisions/adr/0057-launcher-mechanism-core-scripts-launcher.md) — this directory
- [ADR-0058](../../decisions/adr/0058-sub-app-registration-schema.md) — registration schema
- [ADR-0059](../../decisions/adr/0059-tmux-topology-and-visual-status-language.md) — visual status language
- [ADR-0060](../../decisions/adr/0060-dual-claude-session-model.md) — headless + interactive sessions
- [ADR-0064](../../decisions/adr/0064-hammerspoon-workspace-orchestration.md) — Hammerspoon (deferred)

## Quickstart

```bash
# Validate registrations
cd core/scripts/launcher/tests && pnpm install && pnpm test

# Dry run — print the plan, do not create tmux session
core/scripts/launcher/scripts/launch.sh --dry-run

# Real run
core/scripts/launcher/scripts/launch.sh

# Attach
tmux attach -t ojfbot

# Tear down
tmux kill-session -t ojfbot
```

## Layout

```
core/scripts/launcher/
├── README.md               # this file
├── REGISTRATION_GUIDE.md   # author-facing field walkthrough
├── schema/
│   └── registration.schema.json
├── registrations/
│   ├── shell.json
│   ├── core.json
│   ├── daily-logger.json
│   ├── gastown-pilot.json
│   ├── core-reader.json
│   └── _examples/
│       └── template.json
├── tmux/
│   ├── builder.sh          # creates session + windows + panes
│   └── status.sh           # applies glyph + color per state
├── scripts/
│   ├── launch.sh           # entry point (the /workbench skill calls this)
│   └── lib.sh              # shared helpers
└── tests/
    ├── package.json
    └── registrations.test.mjs
```

## Prereqs

- `tmux` (≥ 3.0) — `brew install tmux`
- `jq` — `brew install jq`
- `node` (≥ 18) — already on PATH for ojfbot dev work
- A running Dolt sql-server on `127.0.0.1:3307` for the headless AgentBead worker (see `core/scripts/sync-telemetry-launchd.plist` and ADR-0043). Without Dolt, the headless pane reports the failure and stays idle; the rest of the session still runs.

## Adding a rig

1. Copy `registrations/_examples/template.json` to `registrations/<id>.json`.
2. Replace fields per [REGISTRATION_GUIDE.md](REGISTRATION_GUIDE.md).
3. Run `pnpm test` from `tests/` — fails fast on schema violations.
4. `launch.sh --dry-run` to confirm the plan.
5. `launch.sh` to bring it up.
