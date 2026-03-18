# Wasteland Technical Spec

Reference for `/gastown --mode=pilot` when working on the Wasteland tab, and for planning W-series adoption phases. Covers the Wasteland's concrete data model, Frame integration approach, and risk constraints.

---

## What the Wasteland is (technically)

Three concrete things:

### 1. A Dolt database schema (the Commons)

A set of SQL tables in a Dolt database on DoltHub. Dolt = MySQL-compatible SQL with Git semantics (fork, branch, commit, PR, merge on structured data).

**Known schema tables:**

| Table | Purpose |
|-------|---------|
| `towns` | Registry of participating Gas Town instances. handle, DoltHub org, trust level, metadata |
| `wanted_items` | The Wanted Board. title, description, effort, tags, status, poster_id, claimant_id |
| `completions` | Evidence of finished work. wanted_item_id, rig handle, commit URL, description, timestamps |
| `stamps` | Multi-dimensional attestations. quality, reliability, creativity scores; confidence, severity; completion_id, validator |
| `character_sheets` | Aggregated rig profiles. skills, stamp history, trust tier, total score. Pre-seeded from top ~10k GitHub contributors |

**Schema contract:** Append-only. No edits, no deletions. Permanent ledger. Every stamp, completion, and registration is a Dolt commit.

**Stability warning:** Schema is "v1, early days." Yegge explicitly says they expect to rebuild it twice. Frame's Dolt client must version its queries; schema changes are absorbed at the client layer, not propagated into FrameBead types.

### 2. A federation protocol

**Joining:** `gt wl join <upstream>`
1. Forks Commons Dolt DB to your DoltHub org
2. Clones fork locally to `.wasteland/` in Gas Town HQ
3. Registers your town in `towns` table
4. Saves config to `mayor/wasteland.json`

**Write flow:** All writes go through your local Dolt fork → push to DoltHub fork → Dolt PR → merge into upstream Commons. The PR model inherits Git's tooling.

**Read flow:** `gt wl sync` pulls latest from upstream. The local `.wasteland/` database is always queryable. No DoltHub dependency for reads.

**Wanted item lifecycle:**
```
open → claimed → in_review → completed
```

**`gt wl` CLI commands:**

```bash
gt wl browse           # read Wanted Board (from local clone)
gt wl post             # create a wanted item (write via Dolt)
gt wl claim <id>       # claim a wanted item
gt wl done <id>        # submit completion evidence
gt wl sync             # pull from upstream, push local changes
gt wl stamps           # view your stamp history
gt wl sheet            # view character sheet
```

**Flag verification required:** Exact flags for `gt wl post` and `gt wl done` must be confirmed via `gt wl --help` before implementing the CLI proxy. Research assumes `--title`, `--description`, `--effort`, `--tags`, `--evidence`, `--commit` but these are unverified.

### 3. A reputation system (stamps + trust ladder + character sheets)

**Trust levels:**
- Level 1 (Registered): browse, claim, submit
- Level 2 (Contributor): earned enough validated stamps
- Level 3 (Maintainer): can validate others' work, issue stamps

**Stamps are multi-dimensional:**
- quality score, reliability score, creativity score (each independent)
- confidence level, severity (leaf task vs. architectural decision)
- anchored to a specific completion → wanted item chain

**Anti-cheating:** Yearbook rule — cannot stamp your own work. Collusion rings have a distinctive graph topology (mutual stamping, sharp boundaries). Fraud detection is theoretical, not battle-tested.

---

## What the Wasteland is NOT

- **Not a marketplace** — no payment, no bidding. Currency is reputation.
- **Not Gas Town-specific** — any agent with Dolt and a DoltHub account can participate. The Wasteland Claude Skill teaches the protocol to any Claude Code instance.
- **Not centralized** — anyone can fork the Commons or create their own Wasteland with the same schema.
- **Not mature** — launched March 4, 2026. Leveling system was scrapped before launch. Building Frame features against this schema means tracking upstream changes actively.

---

## W-series: Wasteland integration phases

W-series maps onto GasTownPilot Phases 5–6 and beyond.

### W0 — Learn and observe (before any code)

**Goal:** Firsthand experience before building. This is not optional.

- [ ] Install Dolt, create DoltHub account
- [ ] Run `gt wl join` from a Gas Town instance (or use the Wasteland Claude Skill standalone)
- [ ] Browse Wanted Board at wasteland.gastownhall.ai
- [ ] Claim one small wanted item and complete the full lifecycle
- [ ] Read the Wasteland Claude Skill source (the most complete protocol documentation)
- [ ] Confirm actual `gt wl post` and `gt wl done` flag syntax via `gt wl --help`
- [ ] Confirm the actual Dolt database name by inspecting `.wasteland/` after `gt wl join`
- [ ] Join Gas Town Discord #wasteland channel

**Output:** Verified CLI flags, verified DB name, firsthand lifecycle knowledge.

---

### W1 — Read-only viewer in GasTownPilot (GasTownPilot Phase 5)

**Goal:** WastelandBoard panel shows live Wasteland data from the local Dolt clone.

**Data connector (`packages/gastown-pilot/api/src/connectors/wasteland-dolt.ts`):**

```typescript
class WastelandDoltClient {
  // Connects to LOCAL .wasteland/ Dolt server (not DoltHub directly)
  // Database name: confirm after gt wl join (assumed 'wasteland_commons')

  async getWantedItems(status?: string): Promise<WantedItem[]>
  async getCharacterSheet(rigHandle: string): Promise<CharacterSheet | null>
  async getStampsForRig(rigHandle: string): Promise<Stamp[]>
  async getLeaderboard(limit?: number): Promise<CharacterSheetRow[]>
}
```

**API routes:** `GET /api/wasteland/wanted`, `GET /api/wasteland/sheet/:handle`, `GET /api/wasteland/stamps/:handle`, `GET /api/wasteland/leaderboard`

**WastelandBoard panel — sub-tabs:**
1. Wanted Board — filterable table (status, effort, tags)
2. My Character Sheet — skill breakdown + stamp history
3. Leaderboard — top rigs by score
4. Recent Activity — latest completions + stamps across Commons

**This phase is purely read-only. No write operations.**

**Acceptance criteria:**
- [ ] WastelandBoard panel renders live data from local Dolt clone
- [ ] Sync button triggers `gt wl sync` via CLI proxy and refreshes UI
- [ ] Tab hidden when `settings.gastown-pilot.showWasteland = false`
- [ ] Graceful degradation when `.wasteland/` doesn't exist (not joined): shows "Join the Wasteland" setup card

---

### W2 — Actions via gt CLI proxy

**Goal:** Claim work, post wanted items, submit completions from GasTownPilot.

**All writes go through `gt wl` CLI.** Never write to Dolt directly. Gas Town owns validation and the fork/PR flow.

```typescript
// API route pattern — flags must be verified in W0
POST /api/wasteland/claim   → gt wl claim <id>
POST /api/wasteland/post    → gt wl post [flags]
POST /api/wasteland/done    → gt wl done <id> [flags]
POST /api/wasteland/sync    → gt wl sync
```

**UI additions to WastelandBoard:**
- "Claim" button on each `open` wanted item
- "Post Wanted Item" form (title, description, effort estimate, tags)
- "Submit Completion" form on `claimed` items (evidence text, commit URL)
- "Sync" button in tab header with last-sync timestamp

**Acceptance criteria:**
- [ ] Claiming an item updates its status in the local Dolt clone after sync
- [ ] Posting creates a new row visible after next sync
- [ ] Completing updates status to `in_review`
- [ ] All write errors surfaced as Carbon `InlineNotification` (not silent failure)

---

### W3 — Wasteland-native FrameBeads (interoperability layer)

**Goal:** Wasteland wanted items become FrameBeads. Frame's agents can work on them using hooks, GUPP, and molecules.

**New bead types** (add to `BeadType` union in `packages/core/src/types/bead.ts`):

```typescript
type BeadType = /* ... existing ... */
  | 'wasteland-wanted'   // mirrors a Wasteland wanted item
  | 'wasteland-stamp'    // mirrors a received stamp
```

```typescript
interface WastelandWantedBead extends FrameBead {
  type: 'wasteland-wanted';
  labels: {
    wasteland_id: string;       // ID in the Commons database
    wasteland_status: string;   // 'open' | 'claimed' | 'in_review' | 'completed'
    effort: string;
    poster: string;
    tags: string;               // comma-separated
    commons_url: string;        // DoltHub URL
    goal_parent?: string;       // link up to a Frame OKR if applicable (G1)
  };
}

interface WastelandStampBead extends FrameBead {
  type: 'wasteland-stamp';
  labels: {
    quality: string;
    reliability: string;
    creativity: string;
    confidence: string;
    severity: string;
    validator: string;
    completion_id: string;
  };
}
```

**Lifecycle:** When user claims a Wasteland item:
1. GasTownPilot creates a local `WastelandWantedBead` with prefix `hq-`
2. Shell Mayor agent can sling it to a sub-app witness (e.g., core-reader witness to work on it)
3. Agent works using hooks, GUPP, and molecules — all standard patterns
4. On completion: `gt wl done` submits evidence; bead status transitions to `in_review`

**CoreReader integration:**
- Wasteland beads appear in CoreReader's search and Activity tab
- Cross-linking: `goal_parent` label links Wasteland work up to Frame OKRs (G1 from Paperclip)

**Acceptance criteria:**
- [ ] `wasteland-wanted` and `wasteland-stamp` types in `BeadType` union
- [ ] Claiming a Wasteland item creates a local FrameBead
- [ ] Shell Mayor can sling claimed Wasteland bead to any sub-app agent
- [ ] Molecule can be attached to a Wasteland bead (same as any other work bead)
- [ ] CoreReader Activity tab shows Wasteland bead events

---

### W4 — Frame as Wasteland publisher

**Goal:** Frame can post its own roadmap items to the Wasteland.

**Use case:** CoreReader Roadmap tab → any roadmap item → "Post to Wasteland" button. Creates a `wanted_items` row in the Commons with Frame roadmap context. Community members can claim it.

**This is how Frame builds community** — not marketing, but posting work where contributors earn portable reputation for building Frame features.

**UI:** "Post to Wasteland" action in CoreReader's bead detail panel (for `type: 'roadmap'` beads). Maps roadmap item fields to `gt wl post` fields.

**Acceptance criteria:**
- [ ] "Post to Wasteland" action on roadmap beads in CoreReader
- [ ] Posted items appear on the Wanted Board after sync
- [ ] Claimed/completed items surfaced back in CoreReader as linked Wasteland beads

---

### W5 — Multi-Wasteland support

**Goal:** Participate in multiple Wastelands simultaneously.

Settings schema extension:

```typescript
'gastown-pilot': {
  // ... existing ...
  wastelands: Array<{
    name: string;
    upstream: string;       // e.g. "dolthub://gastownhall/commons"
    localPath: string;      // e.g. "~/.wasteland/commons"
    active: boolean;
  }>;
}
```

**UI:** Wasteland selector dropdown in the tab header. Each Wasteland has its own Wanted Board, leaderboard, and character sheet view.

**Acceptance criteria:**
- [ ] Multiple Wastelands configured in settings
- [ ] Wasteland tab selector switches between them
- [ ] Each Wasteland's data is isolated (separate Dolt databases, separate sync)

---

### W6 — Frame's own Wasteland (exploratory, Month 4+)

**Goal:** Frame hosts a Wasteland for its own contributor coordination.

**Status:** Aspirational. Do not sprint on this until the upstream Wasteland schema has stabilized through at least one major revision cycle.

**When the time comes:**
1. Create a Dolt database with the Wasteland schema on DoltHub under `ojfbot/wasteland`
2. Seed with Frame roadmap items as wanted items
3. Frame contributes onboarding: browse work → claim → get stamped
4. Stamps become a portable CV for Frame contributors

---

## Risk register

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Schema changes in Commons | HIGH (early stage) | Absorb at WastelandDoltClient query layer; never couple FrameBead types to column names |
| CLI flags unverified | MEDIUM | Verify all `gt wl` flags in W0 before writing proxy routes |
| Dolt DB name assumed | LOW | Confirm after first `gt wl join` |
| DoltHub outage | LOW | Local Dolt clone continues working; only sync pauses |
| Trust/reputation gaming | MEDIUM (theoretical) | Treat stamps as advisory metadata only; no authorization based on stamps |
| Leveling system instability | MEDIUM | Don't build Frame UI against the leveling/RPG layer |
| Validator UX not stabilized | HIGH | Defer validator UI (issuing stamps) entirely in W1-W4 |

---

## Full stack diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      THE WASTELAND                           │
│  Federation: Wanted Board, Stamps, Character Sheets, Trust  │
│  Storage: Dolt (SQL + Git) on DoltHub                       │
│  Protocol: Fork → branch → write → PR → merge              │
├─────────────────────────────────────────────────────────────┤
│                       GAS TOWN                              │
│  Execution: Agents, Hooks, GUPP, Molecules, NDI             │
│  Storage: Dolt (local per Gas Town instance)                │
├─────────────────────────────────────────────────────────────┤
│                        FRAME                                │
│  Experience: Browser dashboards, Module Federation, Carbon  │
│  Storage: FrameBeads (filesystem → Dolt migration path)     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Governance layer (Paperclip): budget, approval, audit  │ │
│  │ Execution layer (Gas Town): beads, hooks, molecules    │ │
│  │ GasTownPilot: Town│Rigs│Convoys│Beads│Formulas│Wasteld│ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```
