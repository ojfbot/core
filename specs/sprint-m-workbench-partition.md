# Spec: Sprint M — workbench partition + frame-dev.sh extension

Date: 2026-04-28
Status: Draft (post-grill, pre-/spec-review)
Owner: TBD (likely solo)
Predecessor: ADR-0051 (RigProfile + workbench partition)
Related ADRs: ADR-0052 (bead-prefix reservations), ADR-0053 (bead-aware /frame-standup)

---

## Problem statement

The active fleet has grown to 15+ rigs. The workbench has a hard `max_slots`=9 cap (tmux's `tiled` layout becomes unreadable past 9 panes). Two new rigs — `asset-foundry` (build-time LangGraph + bpy) and `beaverGame` (runtime Vite + Three.js) — sit explicitly outside Frame OS conventions per ADR-0051 and are not currently registered in `scripts/frame-dev.sh`. The script knows the 9 Frame web apps and hard-codes them; CONTEXT.md §1 claims it reads from the app registry but this is currently aspirational.

Without this sprint:
- Starting a games-side dev session means manually `cd`-ing into `asset-foundry` and `beaverGame` and running their dev commands by hand.
- The workbench either rotates panes (losing the persistence that makes tmux useful) or exceeds its tile cap.
- `/frame-standup` and `/frame-dev` cannot give an honest "what's running" answer for the games rigs.

This spec is the ADR-0051 implementation: extend `frame-dev.sh` to register asset-foundry, beaverGame, and the local Blender MCP server lifecycle; partition the workbench into `wb-frame` (Frame web apps) and `wb-games` (games + asset pipeline); centralize the per-app log status.

## Architecture sketch

```
~/.tmux/workbench/
  frame.json          # 6 tiles: shell, cv-builder, blogengine, tripplanner, lean-canvas, purefoy/gastown-pilot
  games.json          # 3-4 tiles: asset-foundry, beaverGame, [+ 1-2 spare]
  workbench.py        # unchanged; reads --config <path>

~/.zshrc additions
  alias wb-frame='~/.tmux/workbench/workbench.py start --config ~/.tmux/workbench/frame.json'
  alias wb-games='~/.tmux/workbench/workbench.py start --config ~/.tmux/workbench/games.json'

scripts/frame-dev.sh (refactored)
  start_shell                        # unchanged
  start_subapp <name> ... <port>     # frame-profile rigs (existing)
  start_non_frame <name> ... <port>  # NEW: profile=non-frame rigs with custom start_cmd
  start_blender_mcp <port>           # NEW: lifecycle for the local Blender MCP server

  start case adds:
    start_non_frame  "asset-foundry"  asset-foundry  "<port>"  "<start_cmd>"
    start_non_frame  "beaverGame"     beaverGame     5173      "pnpm dev"
    start_blender_mcp                                9876
```

The two configs use distinct `socket` values (`workbench-frame`, `workbench-games`) so they can run simultaneously in two tmux sockets without collision.

## Scope

### S1 — Refactor `scripts/frame-dev.sh`

**File:** `/Users/yuri/ojfbot/core/scripts/frame-dev.sh`

**Note on existing patterns:** the script today mixes `start_subapp` calls with **inline (non-helperized) port blocks** for purefoy-api (lines 88-94), gastown-api (97-103), seh-study-api (106-112), and core-reader-api (125-132). The spec adds a third style — `start_non_frame` — for non-Frame rigs. Sprint M does NOT refactor the existing inline blocks; only adds the new dispatch path.

Add:
- `start_non_frame()` helper. Args: `name`, `repo_dir`, `port`, `start_cmd`. Idempotent port check before launch (mirror `start_subapp` pattern). Multi-port apps follow the inline-block convention rather than overloading the helper.
- `start_blender_mcp()` helper. Args: `port`. Starts the Blender MCP server (mechanism: reference `asset-foundry/scripts/install-blender-mcp.sh` which already detects Blender via `BLENDER_BIN` / `.blender-version`; pick a server-start command compatible with that detection). Verifies Blender is installed via `which blender` precondition.
- Registrations in `start` case:
  - **asset-foundry: deferred to R1 v0.1's Sprint A.** `asset-foundry` does NOT have a `pnpm dev` script today — `package.json` only exposes `gen-asset` / `validate` / `validate-manifest`. Hard-coding `start_non_frame "asset-foundry" 3035 "pnpm dev"` would fail. Add a commented-out registration line as a TODO, activated by R1 v0.1 once the browser-app + API packages are scaffolded.
  - `start_non_frame "beaverGame" "beaverGame" 5173 "pnpm dev"` (verified: beaverGame's vite.config.ts uses 5173).
  - `start_blender_mcp 9876` (or whatever port verification lands on).
- Matching `stop_port` / `status_port` calls in `stop` and `status` cases (only for the active registrations — beaverGame + Blender MCP in v0.1).

### S2 — Workbench partition configs

**Files (new):**
- `~/.tmux/workbench/frame.json`
- `~/.tmux/workbench/games.json`

**Partition rule (recommendation):** include in `frame.json` the rigs you actively edit day-to-day (currently shell + 4 sub-apps). gastown-pilot, seh-study, and core-reader join `games.json` as "support tooling" — they're frame-profile structurally but their workflow is not the active product surface. Adjust the partition as your day-to-day focus shifts (configs are user-local).

`frame.json` schema (per `workbench-architecture.md`):
```json
{
  "socket": "workbench-frame",
  "session": "workbench-frame",
  "max_slots": 6,
  "repos": [
    { "name": "shell",         "path": "/Users/yuri/ojfbot/shell",         "service_cmd": "pnpm dev" },
    { "name": "cv-builder",    "path": "/Users/yuri/ojfbot/cv-builder",    "service_cmd": "pnpm dev:all" },
    { "name": "blogengine",    "path": "/Users/yuri/ojfbot/blogengine",    "service_cmd": "pnpm dev:all" },
    { "name": "tripplanner",   "path": "/Users/yuri/ojfbot/TripPlanner",   "service_cmd": "pnpm dev:all" },
    { "name": "lean-canvas",   "path": "/Users/yuri/ojfbot/lean-canvas",   "service_cmd": "pnpm dev:all" },
    { "name": "purefoy",       "path": "/Users/yuri/ojfbot/purefoy",       "service_cmd": "pnpm dev:all" }
  ]
}
```

`games.json`:
```json
{
  "socket": "workbench-games",
  "session": "workbench-games",
  "max_slots": 5,
  "repos": [
    { "name": "asset-foundry", "path": "/Users/yuri/ojfbot/asset-foundry", "service_cmd": "echo 'no dev server until R1 v0.1 scaffold'" },
    { "name": "beaverGame",    "path": "/Users/yuri/ojfbot/beaverGame",    "service_cmd": "pnpm dev" },
    { "name": "core-reader",   "path": "/Users/yuri/ojfbot/core-reader",   "service_cmd": "pnpm dev:all" },
    { "name": "gastown-pilot", "path": "/Users/yuri/ojfbot/gastown-pilot", "service_cmd": "pnpm dev:all" },
    { "name": "seh-study",     "path": "/Users/yuri/ojfbot/seh-study",     "service_cmd": "pnpm dev:all" }
  ]
}
```

asset-foundry's `service_cmd` is a placeholder until R1 v0.1's Sprint A scaffolds its dev script.

### S3 — Centralized log status

**File:** `/Users/yuri/ojfbot/core/scripts/frame-dev.sh`

Extend `status_port()` (or add `status_app()`) to also print:
- Last log line tail (1 line) per app from `$LOGDIR/<name>.log`
- Log file size (so the user can see "was this just started or has it been running for hours")
- Last-modified timestamp

Output shape:
```
  ✓  shell+agent     :4000 + :4001  RUNNING
       └─ 2.4MB · 2m ago · "VITE v5.4.10  ready in 312 ms"
```

### S4 — Doc reconcile

**File:** `/Users/yuri/ojfbot/core/domain-knowledge/CONTEXT.md`

CONTEXT.md is currently inconsistent on its own:
- §1 line 35 invariant: "App registry is the only source of truth for which apps exist; `frame-dev.sh` reads from it." (False — script hard-codes.)
- §3 line 70 (the FrameDev aggregate already added in this PR): correctly describes `RigProfile`-based dispatch.

Single-line edit to §1 line 35:
> "App registry is the only source of truth for which apps exist at runtime. `frame-dev.sh` currently hard-codes its dispatch table by `RigProfile` (frame vs non-frame); see §3 `FrameDev` aggregate and ADR-0055 (TBD) for the deliberate decision to defer app-registry reading until shell's registry shape stabilizes."

Add ADR-0055 (next free in core after 0054 standup-funnel-measurement) to `decisions/adr/` documenting the deferral.

### S5 — Skill body update

**File:** `/Users/yuri/ojfbot/core/.claude/skills/frame-dev/frame-dev.md`

Update the dispatch table description to reflect new entries; make sure `/frame-dev start | stop | status` mentions the new `wb-frame` / `wb-games` aliases as the recommended morning launcher.

## Acceptance criteria

- [ ] **S1.1:** `./scripts/frame-dev.sh start` from a clean shell starts all 9 Frame web apps + asset-foundry + beaverGame + Blender MCP server, idempotent.
- [ ] **S1.2:** Re-running `./scripts/frame-dev.sh start` is a no-op for already-running apps (each prints `✓ already running`).
- [ ] **S1.3:** `./scripts/frame-dev.sh stop` cleanly stops every app started by S1.1.
- [ ] **S1.4:** `./scripts/frame-dev.sh status` reports each app with port + last-log-tail + size + age.
- [ ] **S2.1:** `wb-frame` alias starts a workbench with 6 panes, one per Frame web app, persistent.
- [ ] **S2.2:** `wb-games` alias starts a separate workbench (different tmux socket) with 3+ panes for asset-foundry, beaverGame, and a spare.
- [ ] **S2.3:** Both workbenches run simultaneously without socket collision.
- [ ] **S2.4:** `wbk` (kill) closes both workbenches' tmux servers.
- [ ] **S3.1:** Status output for a running app includes last-log-tail; for a stopped app, no tail (only port-down message).
- [ ] **S4.1:** CONTEXT.md §1 invariants are accurate against current code.
- [ ] **S5.1:** `/frame-dev` skill output mentions `wb-frame` / `wb-games` and the new dispatch table.

## Test matrix

| Scenario | Expected | Verified by |
|----------|----------|-------------|
| `start` from clean shell | All 11+ apps start; ports listening | `lsof -i :PORT` per app |
| `start` when all running | All `✓ already running` | Output inspection |
| `start` when half running | Started apps stay; missing apps start | Output + `lsof` |
| `stop` from full state | All ports cleared | `lsof -i :PORT` per app shows none |
| `status` from full state | All apps `RUNNING` with log tails | Visual + `wc -l <log>` |
| `wb-frame` solo | 6 panes, persistent; outer socket = workbench-frame | `tmux -L workbench-frame ls` |
| `wb-games` solo | 3+ panes, persistent; outer socket = workbench-games | `tmux -L workbench-games ls` |
| Both running concurrently | Both attachable; no error | Two terminals, both attach |
| Blender MCP not installed | `start_blender_mcp` warns + skips, doesn't fail other rigs | `which blender` returns empty; output check |
| asset-foundry repo missing | `start_non_frame` warns + skips | Rename repo dir; rerun |

## Security section

Low blast radius for this sprint:
- `frame-dev.sh` runs user-owned processes with user privilege; no escalation.
- Workbench config files are user-local; no network exposure.
- Blender MCP server (when started) listens on localhost only; verify no `0.0.0.0` bind.
- Log files in `/tmp/frame-dev-logs/` are user-owned, no PII risk; existing `frame-dev.sh` has been doing this; no new exposure.

No auth changes. No new external dependencies (Blender is already a developer-machine assumption per asset-foundry-architecture.md).

## Open questions

1. **Blender MCP port + start mechanism.** Default port for community bpy-MCP servers? If no convention, pick 9876 (low collision risk with 30xx/40xx/50xx). Reference `asset-foundry/scripts/install-blender-mcp.sh` for existing Blender detection (`BLENDER_BIN` / `.blender-version`). Start mechanism: subprocess `blender --background --python <mcp-server-script>.py` or a separate package (e.g. `blender-mcp` from npm if such exists)? Verify before spec-review.
2. **Partition placement (RESOLVED in S2):** core-reader, gastown-pilot, seh-study go in `games.json` as "support tooling." User adjusts as workflow shifts.
3. **Partition enforcement.** Should config validation reject a `frame.json` entry pointing to a non-frame repo (and vice versa)? Recommend: comment-only convention; no machine enforcement until/unless an `RIG_PROFILE` manifest file lands per ADR-0051.
4. **`start_non_frame` flag for non-MF builds.** beaverGame uses `vite build` for prod but `vite dev` for development; asset-foundry's future browser-app will follow the MF `build && preview` pattern. Right now `start_non_frame` assumes a single `start_cmd`. If asset-foundry-ui (post-R1) needs MF-style build + preview, it stays a Frame profile rig — not a problem here.
5. **App registry wiring (deferred).** Should this sprint actually wire app-registry reading instead of just doc-fixing the lie? Recommend: defer; shell's registry format is still evolving and a wire-up would be premature.
6. **Multi-port apps in `start_non_frame`.** Existing `start_subapp` handles a single port; the inline blocks (purefoy-api, gastown-api, seh-study-api, core-reader-api) handle their second port manually. Should `start_non_frame` accept an optional second port + start_cmd, or follow the inline-block convention? Recommend: inline-block convention for consistency; revisit only if many non-frame rigs end up needing multi-port.
7. **Relationship to existing `wb` alias.** The current `wb` alias starts whatever's in `~/.tmux/workbench/config.json`. Three options: (a) keep `wb` as a third alias pointing to a generic config, (b) deprecate `wb` in favor of `wb-frame`/`wb-games`, (c) make `wb` an alias for `wb-frame` since that's the most common case. Recommend (c).

## ADR stubs likely

- **ADR-0055** (next available in core after 0054 standup-funnel-measurement): "frame-dev.sh dispatches by RigProfile, not app registry, by deliberate choice for now." Captures the doc reconcile from S4.

(One ADR; spec is otherwise straightforward implementation.)

## Verification

End-to-end smoke test (post-implementation):

1. Fresh shell. `./scripts/frame-dev.sh stop` (idempotent cleanup).
2. `./scripts/frame-dev.sh start`. Wait ~30s for builds.
3. `./scripts/frame-dev.sh status`. All apps `RUNNING` with tails.
4. `wb-frame` in terminal 1. 6 persistent panes, each in its repo's worktree.
5. `wb-games` in terminal 2 (separate window). 3+ persistent panes.
6. `Cmd-Tab` between the two; both attach.
7. Edit a file in `cv-builder` from `wb-frame`'s pane. Save. Vite HMR should fire (visible in shell:4000).
8. Edit a file in `beaverGame` from `wb-games`'s pane. Save. Vite HMR should fire (visible at `:5173`).
9. `wbk`. Both workbenches close.
10. `./scripts/frame-dev.sh stop`. All ports clear.

## Effort estimate

S/M — 1–3 days for an attentive engineer. Bash + JSON config; no new abstractions; the two big unknowns (Blender MCP server start mechanism, core-reader placement) are quick discoveries.

## Out of scope

- Implementing Frame app-registry reading (deferred per S4).
- Adding rigs beyond the two new ones (mrplug, landing, frame-ui-components are non-frame but rarely actively edited; out of scope for v0.1).
- Per-game spawning of Blender MCP if multiple games need concurrent MCP servers (assume one per dev session).
- Hot-reloading workbench config (rebuild via `wbr` is acceptable).
- Status integration with `/frame-standup` (handled by ADR-0053 separately).

## Predecessor / successor

- **Predecessor:** ADR-0051 (RigProfile + workbench partition).
- **Successor:** R1 v0.1 (asset-foundry editor) depends on this sprint registering asset-foundry's port + Blender MCP lifecycle.
