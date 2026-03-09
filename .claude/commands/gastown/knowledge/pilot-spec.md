# GasTownPilot — Panel Spec

Reference for `/gastown --mode=pilot`. Defines all 12 panels, the 6-tab layout, data sources, Carbon component conventions, and acceptance criteria per panel.

---

## Port assignment

| Service | Port |
|---------|------|
| GasTownPilot frontend | 3017 |
| GasTownPilot API | 3018 |
| gt dashboard (SSE source) | 8080 (configurable) |
| Dolt server (SQL source) | 3306 (configurable) |

---

## Layout conventions (inherit from Frame)

- 48px shell header (handled by shell host)
- 72px side margins on full-width views
- 24px panel padding
- Carbon `Tile` for panels
- Carbon `Tabs` for the 6-tab navigation
- Carbon `Tag` for status indicators (InlineNotification for alerts)
- Carbon `ProgressBar` for convoy progress
- Carbon `DataTable` for lists
- Carbon `TreeView` for Agent Tree
- Real-time updates via WebSocket (Frame convention — NOT polling)
- Expandable chat panel (bottom-right, matches cv-builder/blogengine convention)

---

## Six tabs

| Tab | Slug | Default view |
|-----|------|-------------|
| Town | `town` | Overview: AgentTree + ConvoyTracker + EventStream + ProblemsView |
| Rigs | `rigs` | RigOverview card grid → per-rig drill-down |
| Convoys | `convoys` | Full convoy management table |
| Beads | `beads` | BeadExplorer master-detail |
| Formulas | `formulas` | FormulaLibrary + MoleculeDAG |
| Wasteland | `wasteland` | WastelandBoard (conditional on settings) |

---

## Panel specifications

### AgentTree
**File:** `src/panels/AgentTree.tsx`
**Tab:** Town (left column, always visible)
**Data source:** SSE relay (`useAgents` hook)

Structure:
- Carbon `TreeView` with two levels: rig → agent
- Town-level agents (Mayor, Deacon) at the root
- Each agent node: `StatusIndicator` + name + current task (truncated to 40 chars)
- Click agent → slide-over with full agent detail (hook, mail count, session ID, molecule step)

Status indicators (Carbon `Tag` variants):
| Status | Color | Label |
|--------|-------|-------|
| active/working | green | WORKING |
| idle | gray | IDLE |
| stalled | yellow | STALLED |
| error | red | ERROR |
| dead | red-inverse | DEAD |

**Acceptance criteria:**
- [ ] Renders all agents grouped by rig
- [ ] Status updates in real-time via SSE (no manual refresh needed)
- [ ] Stalled agents trigger a yellow highlight on the rig node too
- [ ] Click agent → slide-over shows hook bead title, mail count, molecule step

---

### ConvoyTracker
**File:** `src/panels/ConvoyTracker.tsx`
**Tab:** Town (top-right)
**Data source:** SSE relay + `useConvoys` hook

Structure:
- List of active convoys (max 8, scroll for more)
- Per convoy: title + Carbon `ProgressBar` (done/total) + status tag
- Click convoy → expand to bead list with per-bead assignee and status

**Acceptance criteria:**
- [ ] Progress bars update in real-time as beads complete
- [ ] Completed convoys move to bottom / grey out
- [ ] Clicking a convoy shows inline bead list (no navigation away from Town tab)
- [ ] "New Convoy" button → opens CreateConvoyModal

---

### EventStream
**File:** `src/panels/EventStream.tsx`
**Tab:** Town (bottom-right)
**Data source:** SSE relay (`useGasTown` hook)

Structure:
- Chronological feed (newest at top)
- Each event: timestamp (relative, e.g. "2m ago") + event type tag + summary text
- Filterable: rig selector dropdown + event type multi-select
- Max 200 events retained in view (configurable in settings)

Carbon components: `DataTable` (virtualized) or custom scroll list

**Acceptance criteria:**
- [ ] New events appear at top without page reload
- [ ] Filter by rig updates in real-time (no re-fetch)
- [ ] Clicking an event with a `bead_id` → opens BeadDetail slide-over
- [ ] Performance: 200 events rendered without jank (virtualized if needed)

---

### ProblemsView
**File:** `src/panels/ProblemsView.tsx`
**Tab:** Town (bottom-left)
**Data source:** SSE relay, filtered to `agent:stalled` + `agent:error` events

Structure:
- Empty state: Carbon `Tile` with "No problems detected"
- Problem card per agent: agent name + rig + stall duration + last activity
- Three action buttons per card: **Nudge** / **Handoff** / **Escalate**

Actions (all call `POST /api/commands`):
```
Nudge    → { cmd: "gt nudge <agent_id>" }
Handoff  → { cmd: "gt handoff <agent_id>" }
Escalate → opens Mayor chat pre-filled with escalation context
```

**Acceptance criteria:**
- [ ] Empty state shown when no stalled agents
- [ ] Stalled agents surface within 5s of `agent:stalled` event
- [ ] Nudge action shows success/failure inline notification
- [ ] Problem card auto-dismisses when agent returns to `active` or `idle`

---

### MergeQueue
**File:** `src/panels/MergeQueue.tsx`
**Tab:** Town (middle-right) / also in Rigs tab per-rig view
**Data source:** Dolt SQL (`useAgents` — refinery state)

Structure:
- Per-rig section headers
- Each queue item: branch name + agent assignee + status tag + queued duration
- Status: `queued` (gray) / `merging` (blue) / `conflicted` (red) / `merged` (green) / `failed` (red-inverse)

**Acceptance criteria:**
- [ ] Conflicted items highlighted red immediately on SSE event
- [ ] "merged" items fade out after 10s
- [ ] Clicking a conflicted item → BeadDetail with conflict diff (if available)

---

### MoleculeDAG
**File:** `src/panels/MoleculeDAG.tsx`
**Tab:** Formulas (right panel when formula selected)
**Data source:** Dolt SQL (`useBeads` — molecule beads)

Renders: directed acyclic graph of formula steps using `dagre-d3` or `@visx/hierarchy`.

Nodes:
- Circle: step ID
- Color: pending (gray) / active (blue) / done (green) / failed (red)
- Label: step title (truncated)

Edges: `needs` dependencies

**Acceptance criteria:**
- [ ] All formula steps rendered as nodes
- [ ] `needs` edges drawn correctly (no cycles possible in valid formula)
- [ ] Active step has pulsing blue border
- [ ] Clicking a node → shows step detail: title, description, acceptance_criteria, output (if done)
- [ ] Re-renders when molecule state updates via SSE

---

### MailInbox
**File:** `src/panels/MailInbox.tsx`
**Tab:** Part of agent slide-over (not a primary tab panel)
**Data source:** Dolt SQL — beads of type `mail` for the selected agent

Structure: Carbon `DataTable` — from, subject (title), delivery mode, read status, timestamp

**Acceptance criteria:**
- [ ] Unread count badge on agent node in AgentTree
- [ ] Mark as read on open
- [ ] Handoff mails highlighted differently (mail_type=handoff)

---

### RigOverview
**File:** `src/panels/RigOverview.tsx`
**Tab:** Rigs
**Data source:** Dolt SQL + SSE relay

Card grid (4-column): per-rig card showing:
- Rig name + git URL (truncated)
- Agent count + health indicator (healthy / degraded / unhealthy)
- Active convoys count
- Merge queue depth
- Carbon `OverflowMenu` → "View details", "Configure", "Doctor output"

Drill-down view (click card → full rig detail):
- Rig-specific AgentTree
- Rig-level ConvoyTracker
- Rig configuration (read-only JSON viewer)
- Git status: branch, last commit, remote sync

**Acceptance criteria:**
- [ ] All registered rigs appear as cards
- [ ] Health indicator updates in real-time
- [ ] Drill-down shows rig-scoped data (not all-rig data)
- [ ] "Configure" opens settings for that rig (hqPath, prefix, etc.)

---

### BeadExplorer
**File:** `src/panels/BeadExplorer.tsx`
**Tab:** Beads
**Data source:** Dolt SQL + `useBeads` hook

Master-detail layout (matches CoreReader convention):
- **Master:** search input + filter chips (type, status, rig, assignee) + scrollable list
- **Detail:** selected bead full view — title, body (markdown rendered), status lifecycle, labels, refs, molecule attachment

Actions (in detail panel):
- Sling to agent (dropdown of available agents)
- Add to convoy (dropdown of active convoys)
- Close bead
- Create bead (FAB in master)

**Acceptance criteria:**
- [ ] Search by prefix, title, label value
- [ ] Filter chips stack (AND logic)
- [ ] Body rendered as markdown (Carbon `StructuredList` or react-markdown)
- [ ] Sling action calls `POST /api/beads/:id/sling` → updates agent hook
- [ ] Created beads appear in list without refresh

---

### FormulaLibrary
**File:** `src/panels/FormulaLibrary.tsx`
**Tab:** Formulas (left panel)
**Data source:** API — `GET /api/formulas` (reads formula TOML files)

Structure:
- Two sections: "Embedded" (Gas Town built-in) + "Custom" (rig-local)
- Card per formula: name, type badge (workflow/patrol/aspect/expansion), description, step count
- Click → detail view showing TOML source (read-only, syntax-highlighted) + MoleculeDAG

**Acceptance criteria:**
- [ ] Both embedded and custom formulas listed
- [ ] TOML source displayed with syntax highlighting (Prism or similar, no runtime deps bloat)
- [ ] "Instantiate" button → opens modal to fill in formula vars → pours molecule
- [ ] Active molecules using this formula shown as a count badge on the card

---

### HealthDashboard
**File:** `src/panels/HealthDashboard.tsx`
**Tab:** Rigs (doctor view within rig drill-down)
**Data source:** API → `GET /api/rigs/:name/health` → runs `gt doctor`

Displays `gt doctor` output formatted as a Carbon `StructuredList`:
- Section per check (agents, mail, hooks, Dolt connectivity, merge queue)
- Pass / Warn / Fail per check
- Last run timestamp + "Run again" button

**Acceptance criteria:**
- [ ] Doctor output parsed and structured (not raw text dump)
- [ ] "Run again" triggers fresh `gt doctor` call, updates in real-time
- [ ] Failed checks show actionable suggestions (from doctor's output)

---

### WastelandBoard
**File:** `src/panels/WastelandBoard.tsx`
**Tab:** Wasteland (conditional: `settings.gastown-pilot.showWasteland = true`)
**Data source:** API reads local Dolt clone (`.wasteland/`). Writes go exclusively through `gt wl` CLI proxy.

> **Implementation note:** The panel connects to `WastelandDoltClient` in the API layer, which queries the *local* Dolt server (`localhost:3306`, separate DB from Gas Town's main Dolt). It does NOT call DoltHub directly. `gt wl sync` is the only path to pull from upstream Commons.

**Architecture:**
```
WastelandBoard (React)
  └── /api/wasteland/* (GasTownPilot API, port 3018)
        └── WastelandDoltClient (packages/gastown-pilot/api/src/connectors/wasteland-dolt.ts)
              └── Local Dolt server (.wasteland/ database, port configurable — default 3307)
```

Mutations only:
```
POST /api/wasteland/claim  → gt wl claim <id>
POST /api/wasteland/post   → gt wl post [--title --description --effort --tags]  (flags: verify in W0)
POST /api/wasteland/done   → gt wl done <id> [--evidence --commit]               (flags: verify in W0)
POST /api/wasteland/sync   → gt wl sync  (pulls upstream, pushes local changes)
```

**Degradation states:**
- `.wasteland/` directory missing → show "Join the Wasteland" setup card (not-joined state)
- Dolt server unreachable → show reconnect banner with `gt wl sync` suggestion
- Tab hidden when `settings.gastown-pilot.showWasteland = false` (default)

Four sub-tabs (Carbon `Tabs` within the Wasteland tab):

**1. Wanted Board**
- Carbon `DataTable` with columns: title, effort, tags, status, poster, claimed-by
- Filter row: status dropdown (`open` / `claimed` / `in_review` / `completed`) + tag multi-select
- Per `open` row: **Claim** button → `POST /api/wasteland/claim`
- Per `claimed` (by me) row: **Submit Completion** button → opens modal (evidence text + commit URL)

**2. My Character Sheet**
- Skill breakdown (quality / reliability / creativity scores, each as a `ProgressBar`)
- Trust tier badge (Registered / Contributor / Maintainer) as prominent Carbon `Tag`
- Stamp history as Carbon `DataTable`: validator, completion ID, quality/reliability/creativity scores, date

**3. Leaderboard**
- Carbon `DataTable`: rank, rig handle, total score, stamp count, completed items
- Top 50 rows. Highlight current rig's row if present.

**4. Recent Activity**
- Latest completions + stamps across Commons, newest-first
- Each row: rig handle + action type + wanted item title + timestamp (relative)

**Tab header:**
- "Sync" button with last-sync timestamp (calls `POST /api/wasteland/sync`)
- If multiple Wastelands configured (W5): selector dropdown

**Acceptance criteria:**
- [ ] Panel reads from local Dolt clone — no DoltHub dependency for display
- [ ] "Join the Wasteland" setup card shown when `.wasteland/` doesn't exist
- [ ] Graceful error banner when local Dolt server unreachable
- [ ] Sync button triggers `gt wl sync` and refreshes all sub-tab data on success
- [ ] Wanted Board `open` items show Claim button; `claimed-by-me` items show Submit Completion
- [ ] All write errors surfaced as Carbon `InlineNotification` (not silent failure)
- [ ] Character Sheet displays trust tier badge prominently
- [ ] Tab hidden when `showWasteland: false` (default false)

---

## Data hooks

| Hook | Data source | Updates |
|------|-------------|---------|
| `useGasTown()` | SSE relay | Push via WebSocket |
| `useAgents()` | SSE relay | Push via WebSocket |
| `useConvoys()` | SSE relay | Push via WebSocket |
| `useBeads(filter)` | Dolt SQL via API | React Query + SSE invalidation |
| `useFormulas()` | API (TOML files) | React Query (no SSE) |
| `useMolecule(id)` | Dolt SQL via API | React Query + SSE invalidation |
| `useWasteland(tab)` | API → local Dolt clone | React Query (manual; sync button invalidates) |

---

## Settings schema (shell `settingsSlice.apps['gastown-pilot']`)

```typescript
interface GasTownPilotSettings {
  hqPath: string;           // "~/gt" — Gas Town install path
  dashboardPort: number;    // 8080 — gt dashboard SSE port
  doltPort: number;         // 3306 — Dolt server MySQL port (Gas Town main DB)
  defaultRig: string;       // pre-selected rig in UI
  showWasteland: boolean;   // enable Wasteland tab (default: false)
  eventRetention: string;   // "24h" — how long to keep events
  autoNudgeTimeout: number; // 60 — seconds before suggesting nudge

  // W1: Wasteland (added when showWasteland = true)
  wastelandDoltPort: number;  // 3307 — local Dolt server port for .wasteland/ DB
                               // (separate from Gas Town's main Dolt instance)

  // W5: Multi-Wasteland (added when multiple Wastelands configured)
  wastelands: Array<{
    name: string;             // display name, e.g. "Gas Town Commons"
    upstream: string;         // e.g. "dolthub://gastownhall/commons"
    localPath: string;        // e.g. "~/.wasteland/commons"
    active: boolean;          // currently selected in tab selector
  }>;
}
```
