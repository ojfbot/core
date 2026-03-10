# ADR-0016: FrameBead — foundational work primitive for Frame Gas Town adoption

Date: 2026-03-09
Status: Proposed
OKR: 2026-Q1 / O1 / KR3 (cross-domain hero demo)
Commands affected: /gastown, /scaffold, /adr
Repos affected: core, core-reader, cv-builder, blogengine, tripplanner, purefoy, shell

---

## Context

Frame is adopting Gas Town's multi-agent coordination patterns. Every subsequent adoption (AgentBead, Hooks + GUPP, Molecules, Mail, Convoys) requires a common work primitive that agents can create, route, persist, and query across the cluster. Without it, each adoption invents its own shape and the cluster has no shared language for work items.

The current state: work items are flat markdown files (ADRs, OKRs, TODOs). They have no shared type, no lifecycle, no routing key, and no programmatic interface. Agents cannot create, query, or hand off work items — they can only read text.

[cv-builder] #111 (Gas Town adoption Sprint 1) is blocked on this ADR. No sub-app adoption can begin until the interface is defined and owned in `core`.

---

## Decision

Define `FrameBead` as the universal typed work primitive for the Frame cluster. Export it from `@core/workflows`. Implement `FilesystemBeadStore` as the reference storage adapter writing JSON to `~/.beads/<prefix>/`. All subsequent Gas Town adoptions (A2–A8, G-series) extend or compose `FrameBead`.

---

## Interface definitions

### `FrameBead` (`packages/workflows/src/types/bead.ts`)

```typescript
type BeadType =
  | 'adr' | 'okr' | 'roadmap' | 'command'
  | 'draft' | 'cv' | 'task' | 'agent'
  | 'hook' | 'mail' | 'molecule' | 'convoy';

type BeadStatus = 'created' | 'live' | 'closed' | 'archived';

interface FrameBead {
  id: string;            // prefixed: "core-abc12", "cv-x7k2m"
  type: BeadType;
  status: BeadStatus;
  title: string;
  body: string;          // markdown content
  labels: Record<string, string>;
  actor: string;         // who created or last modified
  hook?: string;         // id of bead on the agent's hook (A3)
  molecule?: string;     // id of molecule this bead belongs to (A4)
  refs: string[];        // related bead ids
  created_at: string;    // ISO 8601
  updated_at: string;
  closed_at?: string;
}
```

**Lifecycle (4-stage simplification of Gas Town's 6):**

| Stage | Meaning |
|-------|---------|
| `created` | Filed, not yet picked up |
| `live` | Actively being worked |
| `closed` | Done or deliberately finished |
| `archived` | Compacted / no longer queryable by default |

### `BeadStore` (`packages/workflows/src/types/bead-store.ts`)

```typescript
interface BeadFilter {
  type?: BeadType | BeadType[];
  status?: BeadStatus | BeadStatus[];
  prefix?: string;       // e.g. "cv-" to scope to cv-builder beads
  labels?: Record<string, string>;
}

interface BeadEvent {
  op: 'create' | 'update' | 'close';
  bead: FrameBead;
}

interface BeadStore {
  get(id: string): Promise<FrameBead | null>;
  create(bead: FrameBead): Promise<void>;
  update(id: string, patch: Partial<FrameBead>): Promise<void>;
  close(id: string): Promise<void>;
  query(filter: BeadFilter): Promise<FrameBead[]>;
  watch(filter: BeadFilter, cb: (event: BeadEvent) => void): () => void;
}
```

### Prefix routing

| Prefix | Sub-app | Storage path |
|--------|---------|--------------|
| `core-` | core / core-reader | `~/.beads/core/` |
| `cv-` | cv-builder | `~/.beads/cv/` |
| `blog-` | blogengine | `~/.beads/blog/` |
| `trip-` | tripplanner | `~/.beads/trip/` |
| `pure-` | purefoy | `~/.beads/pure/` |
| `hq-` | shell (cross-app) | `~/.beads/hq/` |

The prefix is the routing key. `resolvePrefix(id)` returns the owning sub-app. Cross-app beads use `hq-`.

### `hooks.json` schema (session resume contract — A3 preview)

Hook-based session resume is an A3 concern, but the contract must be named here so sub-apps know what to reserve. Each agent has exactly one hook at a time.

```json
{
  "agentId": "cv-agent-abc12",
  "hookId": "cv-x7k2m",
  "updated_at": "2026-03-09T04:00:00Z"
}
```

GUPP (Gas Town Universal Propulsion Principle) applied to Frame: at agent startup, if `hooks.json` exists and `hookId` is set, the agent loads that bead and resumes work before accepting new input. Implementation lives in A3.

---

## Sprint 1 acceptance criteria

- [ ] `FrameBead`, `BeadType`, `BeadStatus`, `BeadStore`, `BeadFilter`, `BeadEvent` exported from `@core/workflows`
- [ ] `FilesystemBeadStore` implemented: reads/writes JSON to `~/.beads/<prefix>/`, creates directories on first write
- [ ] `BeadStore` unit tests: CRUD, query by type/status/prefix, watch callback fires on create/update/close
- [ ] CoreReader ADR parser migrated: each ADR file loaded as a `FrameBead` of type `adr`
- [ ] CoreReader API: `GET /api/beads?type=adr&status=live` replaces `GET /api/adrs`

---

## Consequences

### Gains
- All subsequent Gas Town adoptions have a shared interface to extend — no per-adoption reinvention.
- Agents can create, route, and hand off work items programmatically.
- `core-reader` gains a queryable bead API; the ADR library becomes the first bead corpus.
- `hooks.json` contract is named early, so sub-apps can reserve the field without implementing A3.

### Costs
- `@core/workflows` gains a new module boundary (`types/bead.ts`). All consumers must import from the new path.
- `FilesystemBeadStore` has no transaction semantics — concurrent writes to the same bead file are last-write-wins. Acceptable for Sprint 1 (single-process); A6 (data lifecycle) addresses compaction and conflict resolution.
- CoreReader migration from flat ADR files to bead API is a breaking change for any caller using `GET /api/adrs`.

### Neutral
- Bead IDs use a short random suffix (e.g. `cv-abc12`). There is no global ID registry — uniqueness within a prefix is probabilistic at low volume. Collision risk is negligible for the current corpus size.

---

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Continue with flat markdown files | No programmatic interface. Agents can read text but cannot create, close, or query work items. Blocks every subsequent Gas Town adoption. |
| Adopt Gas Town's Dolt database directly | Dolt requires a running server, has no Node SDK, and introduces a new infrastructure dependency. `FilesystemBeadStore` gives the same interface with no new infra — Dolt can replace it later if volume demands it. |
| Per-repo bead formats (each sub-app defines its own shape) | Defeats the purpose of adoption A1. Cross-app coordination (Mayor sling, Convoy membership) requires a shared shape the Mayor can read without per-repo parsing logic. |
| Use GitHub Issues as the bead store | Network-dependent, rate-limited, no watch API, authentication required. Good for human-visible tracking (see MrPlug Phase 5B); wrong for agent-to-agent work routing. |
