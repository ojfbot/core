# ADR-0057: Launcher mechanism under core/scripts/launcher

Date: 2026-04-30
Status: Proposed
OKR: 2026-Q2 / O2 (developer ergonomics) / KR2 (the morning ritual ships repeatable executable plans)
Commands affected: /workbench, /frame-dev
Repos affected: core (scripts, .claude/skills/workbench)

---

## Context

[ADR-0056](0056-developer-day-orchestration-master.md) names the launcher as the first missing piece of the morning ritual: the single command that brings up tmux, dev servers, and per-rig Claude sessions. [ADR-0051](0051-rigprofile-workbench-partition.md) defined `RigProfile` and the `frame` / `non-frame` workbench partition, and bound the `/workbench` skill to that partition — but stopped short of an implementation. The skill at `core/.claude/skills/workbench/` exists; the mechanism behind it does not.

The original handoff proposed a new top-level repo, `ojfbot/daily-launcher`, with its own `package.json`, `bootstrap.sh`, and Hammerspoon Lua. That layout duplicates `/workbench` (which already lives in core) and adds a repo to clone for every fresh laptop. Co-locating the implementation under `core/scripts/launcher/` keeps one bootstrap path, reuses core's vitest + tsc + lint pipeline, and lets the launcher reference `BEAD_PREFIX_MAP` and `RigProfile` directly without a published-package boundary. See also [ADR-0052](0052-bead-prefix-reservations-non-frame.md), which reserves the bead prefixes that registration `id`s draw from.

Originally drafted as ADR-002 in the 2026-04-30 handoff; renumbered to fit core/decisions/adr/ flat numbering.

## Decision

The mechanism behind `/workbench` ships at `core/scripts/launcher/`. The skill at `core/.claude/skills/workbench/workbench.md` becomes the user-facing entry point; this ADR's `launch.sh` is its implementation.

```
core/scripts/launcher/
├── README.md
├── schema/
│   └── registration.schema.json
├── registrations/
│   ├── shell.json
│   ├── core-reader.json
│   ├── cv-builder.json
│   ├── ... (one JSON per registered rig; see ADR-0058 for schema)
│   └── _examples/new-app-template.json
├── tmux/
│   ├── builder.sh
│   └── status.sh
├── scripts/
│   ├── register.sh
│   └── launch.sh
└── tests/
    └── registrations.test.ts
```

### Behavioral contract

`scripts/launch.sh` does this on invocation:

1. Read `registrations/**/*.json`. Validate every file against `schema/registration.schema.json`. Fail loudly on any invalid registration.
2. Sort registrations by `priority_tier` and `display.order`.
3. Create a single named tmux session — `ojfbot` — with one window per registration matching the active `RigProfile` (`frame` or `non-frame`).
4. Inside each window, create panes per the registration's `panes` array.
5. Apply visual status glyphs per `tmux/status.sh` (the language lives in [ADR-0059](0059-tmux-topology-and-visual-status-language.md), once it lands).
6. Exit. The tmux session stays resident.

Hammerspoon orchestration (macOS Spaces, displays, key bindings) defers to [ADR-0064](0064-hammerspoon-workspace-orchestration.md). The first slice is tmux-only.

### Registration as the unit of extension

A new rig does not require code changes to the launcher. It drops a JSON file in `registrations/`, validates against the schema, and the launcher picks it up on next invocation. The schema and its extension fields are specified in [ADR-0058](0058-sub-app-registration-schema.md).

### Reuse, not parallel substrate

- Registration `id` values draw from `BEAD_PREFIX_MAP` at `core/packages/workflows/src/types/bead.ts:95-105`. No parallel id space.
- `RigProfile` from [ADR-0051](0051-rigprofile-workbench-partition.md) is the parent type for registrations. The schema in ADR-0058 extends it.
- `tests/registrations.test.ts` runs under core's existing vitest. No standalone `package.json`, no `bootstrap.sh`. The launcher inherits core's tooling.

### Two layers, one tree

- Mechanism: shell, JSON schema, validator. Deterministic. Pinned at `tmux/builder.sh` and `scripts/launch.sh`.
- Configuration: `registrations/`. Per-rig. Edited frequently.

## Consequences

### Gains
- One bootstrap path for the morning ritual. A fresh laptop clones core and runs `scripts/launcher/scripts/launch.sh`.
- Adding a rig is a JSON edit, validated in CI by `tests/registrations.test.ts`.
- `RigProfile` and `BEAD_PREFIX_MAP` stay single-source. The launcher does not invent a registration id namespace.
- The `/workbench` skill gets a real implementation it currently lacks; ADR-0051's partition becomes executable.

### Costs
- `core/scripts/launcher/` adds a sub-tree under core that is shell- and JSON-heavy. Reviewers need to look outside `packages/` for launcher changes.
- Cross-repo drift risk: a registration file references rig paths that live outside core. A renamed rig directory breaks `launch.sh` until the JSON updates.
- The first slice ships without Hammerspoon. Display arrangement is manual until [ADR-0064](0064-hammerspoon-workspace-orchestration.md) lands.

### Neutral
- `register.sh` is a convenience wrapper around schema validation; it does not write code on the user's behalf.
- `tmux/status.sh` is a stub in the first slice; the visual status language ships in [ADR-0059](0059-tmux-topology-and-visual-status-language.md).

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Build the launcher as a new `ojfbot/daily-launcher` repo. | Duplicates `/workbench` (ADR-0051), adds a repo to clone, and forces a `package.json` parallel to core's tooling. |
| Land the launcher inline in `core/.claude/skills/workbench/scripts/`. | Mixes skill prompt content with executable mechanism; the skill directory should describe behavior, not host the implementation tree. |
| Skip the JSON schema and let `launch.sh` parse rig directories directly. | Loses the validation gate; a malformed rig silently breaks the morning ritual. The schema is the contract. |
| Ship Hammerspoon in the same slice. | Couples a tmux change to macOS Accessibility / Screen Recording permissions. ADR-0064 isolates the OS-permission surface. |

## Acceptance criteria

- `core/scripts/launcher/` exists with the directory tree shown.
- `core/scripts/launcher/schema/registration.schema.json` validates against itself.
- `core/scripts/launcher/scripts/launch.sh --dry-run` prints the tmux plan it would build, without executing.
- `core/.claude/skills/workbench/workbench.md` references the launcher's `launch.sh` as its implementation.
- `tests/registrations.test.ts` runs in CI under core's existing vitest and fails on any invalid registration.
- The first slice ships tmux-only. Hammerspoon defers to [ADR-0064](0064-hammerspoon-workspace-orchestration.md).

## Provenance

| Field | Value |
| --- | --- |
| Zero-point SHA | `5c2b13225c500af82431ea1a2c810951f9f8e895` (parent orchestration zero-point; this slice's own zero-point is `_pending_`) |
| Inspection commit | _pending — none required for this slice; greenfield_ |
| Implementation start commit | _pending_ |
| Implementation end commit | _pending_ |
| PR number | _pending_ |
| Originally drafted as | ADR-002 (handoff message, 2026-04-30) |
