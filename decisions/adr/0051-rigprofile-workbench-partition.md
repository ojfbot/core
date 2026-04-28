# ADR-0051: RigProfile + workbench partition by profile

Date: 2026-04-28
Status: Proposed
OKR: 2026-Q2 / O2 (developer ergonomics) / KR1 (stable workbench across the fleet)
Commands affected: /workbench, /frame-dev, /frame-standup, /install-agents
Repos affected: core (workbench config, frame-dev.sh), shell, every active sibling rig

---

## Context

The fleet has grown to 15+ active repos. The workbench's `tiled` layout has a hard `max_slots` cap of 9 (driven by tmux's `tiled` arrangement; see `workbench-architecture.md`). Two new rigs sit explicitly outside Frame OS conventions:

- `asset-foundry` — build-time only (LangGraph + Anthropic + Blender + bpy). No runtime AI ships, no MF, no frame-agent. Outputs validated `.glb` artifacts auto-synced to beaverGame's `public/assets/`.
- `beaverGame` — runtime Vite + Three.js + vanilla TS on port 5173. No React, no Carbon, no Module Federation. Standalone repo per its ADR-0006.

Today, `frame-dev.sh` only knows about Frame web apps (shell, cv-builder, blogengine, tripplanner). asset-foundry has no dev-server entry; beaverGame is unregistered. Mixing all rigs in a single workbench config either rotates (loses persistent panes) or exceeds the 9-tile cap. There is no concept distinguishing "rigs that follow Frame conventions" from "rigs that share the skill tree but deliberately diverge."

We need a vocabulary for that distinction and a workbench layout that respects the cap.

## Decision

Introduce a `RigProfile` taxonomy with two values:
- `frame` — MF remote, Carbon DS, frame-agent gateway, follows Frame sub-app patterns. cv-builder, blogengine, tripplanner, purefoy, lean-canvas, gastown-pilot, seh-study, core-reader, future Game Library.
- `non-frame` — standalone, deliberately outside Frame conventions. asset-foundry (build-time), beaverGame (Three.js client).

Partition the workbench into two profile-aligned configs:
- `~/.tmux/workbench/frame.json` — shell + 4–5 Frame web apps (rotate which ones based on the day's focus). Cap ~6 tiles.
- `~/.tmux/workbench/games.json` — asset-foundry + beaverGame + future game library + 1 spare. Cap ~3–4 tiles.

Aliases: `wb-frame`, `wb-games` (in addition to the existing `wb`/`wbr`/`wbs`/`wbk`).

Extend `frame-dev.sh` to dispatch start commands per `RigProfile`:
- `frame` rigs → `pnpm dev:all` (web + API), per existing convention.
- `non-frame` rigs → declarative `start_cmd` per rig (e.g. `pnpm dev` Vite for beaverGame, `pnpm gen-asset --watch`-equivalent for asset-foundry build pipeline).

`install-agents.sh` reads `RigProfile` from a per-repo manifest (`.claude/RIG_PROFILE` or inferred from the existing `.claude/SKILLS.md`'s "applicable / not-applicable" classification) so non-Frame rigs cleanly skip Frame-shaped skills.

## Consequences

### Gains
- 9-tile cap respected by partition rather than rotation. Each profile's panes persist.
- Per-profile log group makes `frame-dev status` actionable instead of dumping 15 entries.
- Adding a new rig is a config edit (add to one of two JSON files + declare `start_cmd`).
- `RigProfile` becomes a first-class type that other tools (install-agents, skill applicability filters, CONTEXT.md) can read.

### Costs
- Two `wb*` aliases instead of one. Cross-profile work means switching workbenches (`wb-games` ↔ `wb-frame`).
- A small refactor of `frame-dev.sh` to dispatch by profile.
- New per-repo manifest field (`RIG_PROFILE`); requires one-time write across all 15 rigs.

### Neutral
- The future Game Library, when scaffolded, slots into `wb-games` initially; when it goes live as a Frame MF remote it migrates to `wb-frame`.
- `mrplug` (browser extension) and `landing` (static portfolio) are non-frame in this taxonomy too — they become valid `wb-games` candidates if they're being actively edited, otherwise they live outside the workbench like today.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Increase `max_slots` past 9 | tmux `tiled` produces unreadable layouts past 9; no win even with 4K display. |
| Single workbench with rotation | Loses per-pane persistence (Claude conversations, log scrollback). User workflow assumes panes stick. |
| Treat asset-foundry + beaverGame as Frame sub-apps | Violates beaverGame ADR-0006 (deliberate non-Frame), and asset-foundry is build-time only with no UI surface today. |
| Drop `RigProfile` and just use ad-hoc per-repo flags | No vocabulary handle; install-agents and frame-dev would each invent their own filters. CONTEXT.md needs the type to talk about non-Frame rigs precisely. |
