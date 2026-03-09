# Gas Town Adoption Plan

Reference for `/gastown` all modes. Defines the eight adoptions, their dependency order, per-repo scope, sprint mapping, and acceptance criteria.

---

## Dependency order

Two series run in parallel after Sprint 1. A-series = Gas Town execution patterns. G-series = Paperclip governance patterns. Both require A1.

```
A1. FrameBead ─────────────── Foundation for everything
    │
    ├── A2. AgentBead ──────── Identity + attribution
    │       │
    │       ├── A3. Hooks + GUPP ── Crash recovery + autonomous work
    │       │       │
    │       │       └── A4. Molecules ── Declarative checkpointable workflows
    │       │
    │       └── A5. Mail + Handoff ── Inter-agent communication
    │
    ├── A6. Data Lifecycle ─── Maintenance automation
    │
    ├── A7. Activity Feed ──── Unified observability (required by G5)
    │
    ├── A8. Convoys ────────── Batched work tracking
    │
    │  ── G-series: Paperclip governance (overlaid on A-series) ──
    │
    ├── G1. Goal parent ─────── links every bead to an OKR/Roadmap item
    │       (Sprint 1 addition, minimal — single label field)
    │
    ├── G2. Agent budget ─────── token budget + org-chart `reports_to`
    │       (Sprint 2 addition, requires A2)
    │
    ├── G3. Hook approval gate ── user sign-off before agent runs work
    │       (Sprint 2–3 addition, requires A3)
    │
    ├── G4. Audit trail ─────── append-only events + bead locking
    │       (Sprint 4 addition, requires A7)
    │
    ├── G5. Heartbeat events ─── agent:heartbeat on FrameEvent bus
    │       (Sprint 4 addition, requires A7)
    │       links Gas Town nudge ↔ Paperclip budget-gate
    │
    │  ── W-series: Wasteland federation (GasTownPilot Phases 5–6+) ──
    │
    ├── W0. Learn + observe ──── install Dolt, do the lifecycle firsthand
    │       (before any code; verify CLI flags and DB names)
    │
    ├── W1. Read-only viewer ─── WastelandBoard panel reads from local Dolt clone
    │       (GasTownPilot Phase 5; requires W0)
    │
    ├── W2. Write actions ─────── claim/post/submit via gt CLI proxy
    │       (GasTownPilot Phase 6; requires W1)
    │
    ├── W3. Wasteland FrameBeads ─ wanted items become local FrameBeads
    │       (requires W2 + A3 hooks; enables Mayor sling + molecule attachment)
    │
    ├── W4. Frame publishes ───── CoreReader "Post to Wasteland" on roadmap beads
    │       (requires W3)
    │
    ├── W5. Multi-Wasteland ───── multiple Wastelands in settings
    │       (requires W4)
    │
    └── W6. Frame's own Wasteland (exploratory; defer until schema stabilizes)
```

**Rule:** Never implement A(N+1) in a repo until A(N) is ADOPTED in `core`.
**Rule:** Never implement G-series until A1+A2 are ADOPTED in `core`.

> See `knowledge/paperclip-patterns.md` for full G-series spec, field definitions, and corrections to the original Paperclip research.

---

## Sprint mapping

| Sprint | Weeks | A-series (Gas Town) | G-series (Paperclip) | Primary repo |
|--------|-------|---------------------|----------------------|-------------|
| 1 | 1–2 | A1 — FrameBead foundation | G1 — goal_parent label (free add-on to A1) | `core` + `core-reader` |
| 2 | 3–4 | A2 + A3 — AgentBead + hooks | G2 — budget fields; G3 — hook approval gate | `core`, then sub-apps |
| 3 | 5–6 | A4 — Molecules + formula parser | — | `core`, first: `blogengine` |
| 4 | 7–8 | A5 + A7 — Mail + handoff + activity feed | G4 — audit trail; G5 — heartbeat events | `core`, shell Approval Queue |
| 5 | 9–10 | A6 + A8 — Data lifecycle + convoys | — | `core` + `core-reader` |
| 6–7 | 11–14 | GasTownPilot phases 1–2 (Town view + Convoy/Bead mgmt) | — | `gastown-pilot` |
| 8–9 | 15–18 | GasTownPilot phases 3–4 (Mayor Chat + Formulas/DAG) | — | `gastown-pilot` |
| 10 | 19–20 | GasTownPilot phase 5: Rigs + Merge Queue + **W0+W1** (Wasteland read-only viewer) | W0 learn; W1 viewer | `gastown-pilot` |
| 11 | 21–22 | GasTownPilot phase 6 polish + **W2** (Wasteland write actions) | W2 CLI proxy | `gastown-pilot` |
| 12 | 23–24 | **W3** — Wasteland-native FrameBeads + CoreReader integration | W3 | `gastown-pilot` + `core-reader` |
| 13+ | 25+ | **W4** publisher; **W5** multi-wasteland; **W6** Frame's own Wasteland (exploratory) | W4–W6 | TBD |

---

## Per-repo scope

| Adoption | core | core-reader | shell | cv-builder | blogengine | tripplanner | purefoy |
|----------|------|-------------|-------|------------|------------|-------------|---------|
| A1 FrameBead | **OWNS** (primitives) | First consumer (ADRs→beads) | hq- prefix aggregation | cv- prefix | blog- prefix | trip- prefix | pure- prefix |
| A2 AgentBead | **OWNS** (type + role taxonomy) | core-reader witness bead | Mayor elevation | cv witness bead | blog witness bead | trip witness bead | pure witness bead |
| A3 Hooks+GUPP | **OWNS** (prime node pattern) | prime node wired | Mayor hook | cv prime node | blog prime node | trip prime node | pure prime node |
| A4 Molecules | **OWNS** (compiler + TOML parser) | formula library tab | cross-app molecule dispatch | CV-tailoring molecule | publish-workflow molecule | itinerary molecule | kb-expansion molecule |
| A5 Mail+Handoff | **OWNS** (FrameMail type) | N/A | shell mail broadcast | cv handoff | blog handoff | trip handoff | pure handoff |
| A6 Data Lifecycle | **OWNS** (maintenance-patrol formula) | trigger point | N/A | N/A | N/A | N/A | N/A |
| A7 Activity Feed | **OWNS** (FrameEvent bus) | Activity tab | Shell header badge | N/A | emit events | emit events | emit events |
| A8 Convoys | **OWNS** (FrameConvoy type) | Roadmap-as-convoy | N/A | N/A | content-sprint convoy | N/A | N/A |

---

## Adoption A1: FrameBead

**What:** Universal typed work item — replaces flat markdown files with a structured, routable, lifecycle-managed primitive.

**TypeScript interface (define in `packages/core/src/types/bead.ts`):**
```typescript
type BeadType = 'adr' | 'okr' | 'roadmap' | 'command' | 'draft' | 'cv' | 'task' | 'agent' | 'hook' | 'mail' | 'molecule' | 'convoy';
type BeadStatus = 'created' | 'live' | 'closed' | 'archived';

interface FrameBead {
  id: string;            // prefixed: "core-abc12", "cv-x7k2m"
  type: BeadType;
  status: BeadStatus;
  title: string;
  body: string;          // markdown content
  labels: Record<string, string>;
  actor: string;
  hook?: string;
  molecule?: string;
  refs: string[];
  created_at: string;
  updated_at: string;
  closed_at?: string;
}
```

**BeadStore interface (`packages/core/src/types/bead-store.ts`):**
```typescript
interface BeadStore {
  get(id: string): Promise<FrameBead | null>;
  create(bead: FrameBead): Promise<void>;
  update(id: string, patch: Partial<FrameBead>): Promise<void>;
  close(id: string): Promise<void>;
  query(filter: BeadFilter): Promise<FrameBead[]>;
  watch(filter: BeadFilter, cb: (event: BeadEvent) => void): () => void;
}
```

**Prefix routing:**
| Prefix | Sub-app | Path |
|--------|---------|------|
| `core-` | core / core-reader | `~/.beads/core/` |
| `cv-` | cv-builder | `~/.beads/cv/` |
| `blog-` | blogengine | `~/.beads/blog/` |
| `trip-` | tripplanner | `~/.beads/trip/` |
| `pure-` | purefoy | `~/.beads/pure/` |
| `hq-` | shell (cross-app) | `~/.beads/hq/` |

**Acceptance criteria (Sprint 1):**
- [ ] `FrameBead` type exported from `@core/workflows`
- [ ] `FilesystemBeadStore` implementation: reads/writes JSON to `.beads/<prefix>/` directories
- [ ] `BeadStore` unit tests: CRUD, query by type/status, watch via chokidar
- [ ] CoreReader ADR parser migrated: each ADR loaded as a `FrameBead` of type `adr`
- [ ] CoreReader API: `GET /api/beads?type=adr&status=live` replaces `GET /api/adrs`

---

## Adoption A2: AgentBead

**What:** Every Frame agent-graph has a persistent identity bead that survives browser close.

**Role taxonomy:**
| Frame Role | Maps to Gas Town | Lives in | Purpose |
|-----------|-----------------|----------|---------|
| `mayor` | Mayor | Shell agent-graph | Cross-app coordination |
| `witness` | Witness | Per-app agent-graph (default) | Domain supervision |
| `worker` | Polecat | Per-app ephemeral | Single task, discarded |
| `crew` | Crew | Per-app persistent | Long-running specialist |

**Acceptance criteria:**
- [ ] `AgentBead` type defined extending `FrameBead` with `role`, `app`, `status`, `last_session`, `hook?` labels
- [ ] On graph init: agent bead read from BeadStore (created if missing)
- [ ] On graph end/interrupt: agent bead updated with `last_session` timestamp and `status: idle`

---

## Adoption A3: Hooks + GUPP

**What:** Each agent has a persistent hook pointer. On startup, the `prime` node checks the hook and routes directly to work — no waiting for user input.

**GUPP rule:** If there is work on your hook, you MUST run it.

**Files:**
- `packages/<app>/agent-graph/nodes/prime.ts` — prime node implementation
- `packages/<app>/agent-graph/hooks.json` — persisted hook state

**prime node logic:**
1. Read agent bead → check `hook` field
2. If hook exists → read work bead → route to `execute_hook`
3. Check unread mail → if found → route to `process_mail`
4. Otherwise → route to `await_input`

**Acceptance criteria:**
- [ ] `primeNode` is the entry node in every agent-graph
- [ ] Closing browser with work on hook → reopening browser → agent resumes work without user prompt
- [ ] `sling(beadId, agentId)` function: assigns bead to agent hook, emits `hook:assigned` event
- [ ] If agent is active when slinging: nudge event emitted within 5s

---

## Adoption A4: Molecules

**What:** Multi-step workflows as TOML formulas that compile to LangGraph graphs. Each step is checkpointed.

**Formula directory:** `formulas/` in each sub-app repo.

**TOML format:**
```toml
formula = "blog-publish"
type = "workflow"
version = 1
description = "End-to-end blog post publishing"

[vars.topic]
description = "Blog post topic"
required = true

[[steps]]
id = "research"
title = "Research {{topic}}"
needs = []
acceptance_criteria = ["3+ sources found"]

[[steps]]
id = "draft"
title = "Write draft"
needs = ["research"]
```

**Acceptance criteria:**
- [ ] `parseTOMLFormula(path)` returns `Formula` type
- [ ] `compileMoleculeToGraph(molecule)` returns a LangGraph `StateGraph`
- [ ] `checkpointNode` records each completed step back to the molecule bead
- [ ] BlogEngine `blog-publish` formula: 5 steps, all nodes wired
- [ ] Crash between steps → restart → resumes at last completed step

---

## Adoption A5: Mail + Handoff

**What:** Agents communicate via `FrameMail` beads. On context limit or browser close, agents write a handoff summary to their own mailbox.

**Acceptance criteria:**
- [ ] `FrameMail` type: extends FrameBead, labels include `from`, `to`, `delivery`, `read`, `mail_type`
- [ ] `handoff(agentId, summary)`: writes handoff mail bead, updates agent status to `suspended`
- [ ] On next session: prime node reads unread handoff mail, uses as opening context
- [ ] Test: BlogEngine agent writes handoff → browser closed → reopened → agent greets with summary of prior work

---

## Adoption A6: Data Lifecycle

**What:** Automated bead maintenance via the `maintenance-patrol` formula (a wisp — ephemeral, not persisted to git).

**Lifecycle stages for Frame:**
`created → live → closed → archived`

- `live`: set automatically when a hook attaches
- `closed`: set when molecule completes or manually by agent
- `archived`: set after 30 days in `closed` state by maintenance patrol

**Acceptance criteria:**
- [ ] `maintenance-patrol.toml` formula exists in `core/formulas/`
- [ ] Steps: `archive-stale` (beads closed >30d), `orphan-check` (hooks pointing to missing beads), `index-rebuild`
- [ ] Runs as a wisp on `core-reader` witness agent on a configurable schedule

---

## Adoption A7: Activity Feed

**What:** Every bead mutation emits a typed `FrameEvent`. Shell aggregates all events into a unified feed.

**Event schema:**
```typescript
interface FrameEvent {
  id: string;
  timestamp: string;
  type: 'bead:created' | 'bead:updated' | 'bead:closed'
      | 'hook:assigned' | 'hook:cleared'
      | 'mail:sent' | 'mail:read'
      | 'molecule:started' | 'molecule:step_done' | 'molecule:completed'
      | 'agent:started' | 'agent:idle' | 'agent:error' | 'agent:handoff';
  actor: string;
  bead_id?: string;
  agent_id?: string;
  app: string;
  summary: string;
}
```

**Acceptance criteria:**
- [ ] `eventBus.emit(event: FrameEvent)` exported from `@core/workflows`
- [ ] All BeadStore mutations emit events
- [ ] CoreReader "Activity" tab renders a live event feed
- [ ] Shell header shows unread count badge

---

## Adoption A8: Convoys

**What:** A `FrameConvoy` bead groups related work items and tracks aggregate progress.

```typescript
interface FrameConvoy extends FrameBead {
  type: 'convoy';
  labels: { total: string; done: string; active: string; blocked: string; };
  refs: string[];  // bead IDs of work items
}
```

**Acceptance criteria:**
- [ ] `FrameConvoy` type exported from `@core/workflows`
- [ ] CoreReader Roadmap tab: roadmap milestones rendered as convoys with progress bars
- [ ] `GET /api/beads?type=convoy` returns all convoys for this prefix
