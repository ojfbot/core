# ADR-0041: Convoy orchestration via bead-emit.mjs

Date: 2026-04-10
Status: Accepted
OKR: 2026-Q1 / O1 / KR3
Commands affected: /orchestrate, /frame-standup
Repos affected: core, gastown-pilot

---

## Context

Session beads (ADR-0040) track individual Claude Code sessions — one session bead per skill invocation, with task and PR beads as children. This gives per-session visibility but no cross-session coordination.

The `/orchestrate` skill spawns multiple parallel agents in git worktrees, each implementing a discrete task from a decomposed priority. Without a coordination primitive, there is no way to:

- Track which tasks are pending, active, done, or failed across a single orchestration run
- Correlate task beads back to the orchestration that spawned them
- Display aggregate progress in GasTownPilot's ConvoyTracker panel
- Know when an orchestration run is fully settled (all tasks resolved)

The TypeScript `convoy.ts` module in `@core/workflows` provides the domain logic (createConvoy, addToConvoy, updateSlotStatus, finalizeConvoy) but requires a built package and module import. Claude Code hooks need a faster path — raw CLI calls that complete in ~200ms without a build step.

## Decision

Add convoy bead type with slot-based progress tracking, exposed through 6 new CLI commands in `bead-emit.mjs`. The `/orchestrate` skill creates a convoy bead at pipeline start, registers each Layer 3 agent's task bead as a slot, updates slot status as agents complete, and finalizes the convoy when all tasks are settled.

### Convoy bead structure

A convoy bead is a standard FrameBead with `type: 'convoy'` and coordination state stored in `labels`:

```json
{
  "id": "hq-convoy-3dda847b",
  "type": "convoy",
  "status": "live",
  "title": "orchestrate: plan+execute TripPlanner",
  "labels": {
    "convoy_status": "active",
    "slots": "[{\"beadId\":\"trip-task-abc\",\"agentId\":\"worktree-1\",\"status\":\"done\"}, ...]"
  },
  "refs": ["hq-session-xyz"]
}
```

### CLI commands (bead-emit.mjs)

| Command | Purpose | Key args |
|---------|---------|----------|
| `convoy-create` | Create convoy bead, link to session | `--title`, `--session-bead-id` (optional) |
| `convoy-add-slot` | Register a task bead as a convoy slot | `--convoy-id`, `--bead-id`, `--agent-id` |
| `convoy-update-slot` | Update a slot's status | `--convoy-id`, `--bead-id`, `--slot-status` |
| `convoy-finalize` | Compute final status, close if settled | `--convoy-id` |
| `convoy-status` | Display visual progress (ASCII bar) | `--convoy-id` (optional, shows all if omitted) |
| `task-create` | Create a live task bead (for slot registration) | `--title`, `--repo`, `--convoy-id` (optional) |

### CONVOY_ID persistence

Shell state does not persist between Claude Code Bash tool calls. The convoy ID is written to `/tmp/convoy-orchestrate-current` after creation, then read back in subsequent commands:

```bash
# After convoy-create:
echo "$CONVOY_ID" > /tmp/convoy-orchestrate-current

# In later steps:
CONVOY_ID=$(cat /tmp/convoy-orchestrate-current 2>/dev/null || echo "")
```

This mirrors the existing `/tmp/claude-bead-session-*` pattern from ADR-0040.

### Bead relationship chain

```
session bead (hq-session-*)
  └── convoy bead (hq-convoy-*) — refs: [session-id]
        ├── task bead (repo-task-*) — slot: pending → active → done
        ├── task bead (repo-task-*) — slot: pending → active → done
        └── task bead (repo-task-*) — slot: pending → active → failed
```

### Slot lifecycle

1. `task-create` creates a live task bead
2. `convoy-add-slot` registers it as a pending slot (idempotent — second add returns `already_exists`)
3. `convoy-update-slot --slot-status=active` when the agent starts
4. `convoy-update-slot --slot-status=done` or `--slot-status=failed` when the agent finishes
5. `convoy-finalize` computes final convoy status:
   - All slots `done` → `completed`, bead closed
   - Any slot `failed` → `failed`, bead closed
   - Any slot still `active`/`pending` → stays `active`, bead remains live

### Integration points

- **`/orchestrate` skill** (Step 1, 5, 6): Creates convoy at pipeline start, tracks each Layer 3 agent, finalizes at end
- **GasTownPilot ConvoyTracker**: `DoltSqlClient.getConvoys()` reads convoy beads from Dolt, parses `labels.slots` for per-slot progress display
- **`convoy-status` CLI**: Human-readable progress with `█▓░` bar and per-slot `✓▶·✗` icons

## Consequences

### Gains
- End-to-end visibility for multi-agent orchestration runs — from "4 tasks pending" to "3 done, 1 failed"
- GasTownPilot dashboard shows real convoy progress instead of stubs
- Convoy beads persist in Dolt — full audit trail of orchestration history via `dolt log`
- `convoy-status` provides immediate CLI feedback during long orchestration runs
- Graceful degradation — all convoy commands silently fail when Dolt is unreachable

### Costs
- Raw SQL in bead-emit.mjs duplicates logic from convoy.ts — two implementations to keep in sync
- Slots stored as JSON string in labels column — not individually queryable via SQL
- Temp file pattern (`/tmp/convoy-*`) is fragile — stale files from crashed sessions can mislead
- 6 additional CLI commands increase bead-emit.mjs surface area (490 LOC → ~570 LOC)

### Neutral
- convoy.ts remains the authoritative TypeScript API for programmatic convoy operations
- bead-emit.mjs is the CLI shim optimized for hook speed — both produce identical bead structures
- Sub-app `/api/beads` projections are unaffected — they don't expose convoy data

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Use convoy.ts directly from hooks | Requires `pnpm build` before each hook call. ~2s overhead vs ~200ms for raw SQL. Hooks must be fast. |
| Store slots in a separate `convoy_slots` table | More queryable, but adds schema migration complexity. JSON-in-labels is sufficient for current scale (<100 slots per convoy). |
| Use filesystem for convoy state | No transaction safety for concurrent slot updates. Dolt provides MySQL-level isolation. |
| Skip convoy tracking, rely on /orchestrate output | No persistence. If the session crashes mid-orchestration, all progress state is lost. Convoy beads survive crashes. |
