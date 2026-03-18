# Paperclip Governance Patterns

Reference for `/gastown` audit mode. Defines what Frame should adopt from Paperclip's governance model and how those patterns layer on top of the Gas Town execution patterns.

---

## What Paperclip is

Paperclip (github.com/paperclip-ai/paperclip) treats a company as a first-order object. Every employee is an agent. The user is the board of directors. It launched in early March 2026 — days before this analysis. Stack: Node.js + React, PGlite for local dev, Express REST, pnpm monorepo.

**Key philosophical distinction from Gas Town:** Paperclip is a *control plane*, not an execution plane. It orchestrates organizational context around agents — it doesn't run them or tell you how to build them. "We handle governance; you handle execution."

**Maturity caveat:** Paperclip is extremely young compared to Gas Town (2,400 PRs, 450+ contributors). Adopt patterns, not packages. No `npm install paperclip-*` in Frame.

---

## The three-layer model

```
┌─────────────────────────────────────────────────────────────┐
│              FRAME SHELL (governance plane)                  │
│  Paperclip patterns: goal hierarchy, budget, approval gates, │
│  audit trail, org-chart agent reporting                      │
├──────┬──────────┬───────────┬───────────┬──────────┬────────┤
│Core  │Resume    │BlogEngine │TripPlanner│ Purefoy  │GasTown │
│Reader│Builder   │           │           │          │ Pilot  │
│              (execution plane per sub-app)                  │
│  Gas Town patterns: FrameBeads, Hooks, GUPP, Molecules,     │
│  Handoff, Agent identity, NDI, Mail                         │
└─────────────────────────────────────────────────────────────┘
             ↑
      Frame = experience plane
      React + Carbon, Module Federation, human interaction
```

Each layer has exactly one owner:
- **Governance → shell** (`hq-` prefix beads, settings, Approval Queue)
- **Execution → agent-graph packages** in each sub-app
- **Experience → browser-app packages** in each sub-app

---

## G-series: Governance adoptions (overlay on A-series)

G-series adoptions require A1 (FrameBead) and A2 (AgentBead) to be in place first.

### G1 — Goal parent field (Sprint 1 addition)

Every FrameBead carries a `labels.goal_parent` pointing to its parent bead (an OKR or Roadmap item). Goal ancestry is computed by traversal, not stored as a full chain.

**NOT:** `goal_chain: string[]` (array on every bead — redundant, breaks on chain changes)
**YES:** `labels: { goal_parent: string }` (single parent ID; chain = follow refs up)

Frame already has OKRs and Roadmap items as FrameBead types. This makes the link mandatory and automatic. An ADR bead's `goal_parent` points to the Roadmap item it implements. A task bead's `goal_parent` points to an OKR or Roadmap item.

**Implementation:** Add `goal_parent` as a reserved label key in `BeadStore` validation. The `prime` node should warn (not block) if a bead on the hook has no `goal_parent`.

**Acceptance criteria:**
- [ ] `goal_parent` label key documented and validated in `BeadStore`
- [ ] CoreReader shows goal ancestry breadcrumb in bead detail view
- [ ] `/gastown audit` reports what % of live beads have a goal_parent (governance coverage metric)

---

### G2 — AgentBead budget fields (Sprint 2 addition)

Add four governance fields to `AgentBead.labels`:

```typescript
labels: {
  // ... existing role, app, status, last_session ...
  budget_limit: string;        // e.g. "50000" (tokens/month)
  budget_spent: string;        // e.g. "12400"
  budget_warning_pct: string;  // e.g. "80" (warn at 80%)
  reports_to: string;          // parent agent ID (org-chart)
}
```

**`reports_to` enables the org chart:**
- `core/worker-001.reports_to = "core/witness-001"`
- `core/witness-001.reports_to = "shell/mayor-001"`
- `shell/mayor-001.reports_to = "user"` (terminal node)

This gives the shell a traversable org chart of all agents — who reports to whom, what budget each has consumed.

**Budget enforcement in prime node:**
```typescript
// primeNode additions
const budgetPct = (spent / limit) * 100;
if (budgetPct >= 100) return { ...state, route: 'budget_exhausted' };
if (budgetPct >= warningPct) eventBus.emit({ type: 'agent:budget_warning', ... });
```

At 100% utilization: agent auto-pauses (doesn't pick up new work from hook), posts `agent:budget_warning` event to activity feed. Shell surfaces an Approval action to reset or extend budget.

**Acceptance criteria:**
- [ ] Four budget/org labels on `AgentBead`
- [ ] `prime` node enforces budget gate: at 100% → route to `budget_exhausted`, emit event
- [ ] At 80% → emit `agent:budget_warning` event (soft warning only)
- [ ] Shell activity feed shows budget warning notifications
- [ ] CoreReader can render an org chart from `reports_to` traversal

---

### G3 — Hook approval gate (Sprint 2-3 addition)

Extend the `Hook` type with approval state. Approval gates fire at **sling time** (work assignment), not at bead creation.

**NOT:** `approval_status` on `FrameBead` (wrong — beads don't need approval, work assignment does)
**YES:** `approval_status` on `Hook`

```typescript
interface Hook {
  agent_id: string;
  bead_id?: string;
  molecule_id?: string;
  step_index?: number;
  slung_at?: string;
  slung_by?: string;
  approval_status: 'none' | 'pending' | 'approved' | 'rejected';
  approval_required_when: 'never' | 'budget_gt_X' | 'spawning_new_agent' | 'cross_app';
}
```

**GUPP extended rule:** "If there is work on your hook AND `hook.approval_status !== 'rejected'` AND (approval is 'none' or 'approved') → YOU MUST RUN IT."

If `approval_status === 'pending'`: agent waits and emits `agent:awaiting_approval` event. Shell surfaces approval card in Approval Queue.

**When approval is required (configurable in settings):**
- Spawning a new `worker` agent (Gas Town polecat equivalent)
- Cross-app sling (Mayor → sub-app witness)
- Budget impact > N tokens estimated

**Acceptance criteria:**
- [ ] `approval_status` and `approval_required_when` fields on `Hook` type
- [ ] `prime` node: if `pending` → emit `agent:awaiting_approval`, route to `await_approval` (not `await_input`)
- [ ] Shell Approval Queue: lists all hooks in `pending` state with Approve/Reject buttons
- [ ] Approve → `hook.approval_status = 'approved'` → nudge event → agent proceeds
- [ ] Reject → `hook.approval_status = 'rejected'` → bead remains closed, agent returns to idle

---

### G4 — Audit trail: append-only events (Sprint 4 addition)

The `FrameEvent` stream is already planned (A7). G4 makes it append-only and immutable once emitted.

**`audit_locked` flag on FrameBead:** Once a bead transitions to `closed` status, `audit_locked = true`. No mutations allowed. BeadStore throws on attempt to edit a locked bead.

This is almost free given the bead lifecycle already has `closed` status. It's a one-line enforcement in BeadStore's `update()` method.

```typescript
// BeadStore.update() guard
if (existing.status === 'closed' && existing.labels.audit_locked === 'true') {
  throw new Error(`Bead ${id} is audit-locked. Create a new bead to supersede it.`);
}
```

**Event stream immutability:** Events are never deleted or edited — only appended. The activity feed's storage is append-only by design (filesystem: one JSONL file per day per prefix).

**Acceptance criteria:**
- [ ] `audit_locked` label set to `'true'` when bead transitions to `closed`
- [ ] `BeadStore.update()` throws on locked beads
- [ ] Event stream stored as append-only JSONL (`~/.beads/events/YYYY-MM-DD.jsonl`)
- [ ] `/gastown audit` reports event store integrity (no gaps, no corrupt entries)

---

### G5 — Heartbeat as FrameEvent (Sprint 4 addition)

Paperclip's heartbeat POST becomes an `agent:heartbeat` FrameEvent. This is NOT a silent health ping — it's a first-class event on the activity bus.

```typescript
// New event type in FrameEvent
type: 'agent:heartbeat'  // agent is alive, last activity timestamp updated
```

**Emitted by:** each agent's LangGraph `checkpointNode` (after each molecule step) and by a background `setInterval` in the agent-graph's initialization (every 30s while graph is running).

**Consumed by:** Shell Deacon health monitor. If `agent:heartbeat` is absent for `autoNudgeTimeout` seconds → shell emits `agent:stalled` event → ProblemsView surfaces it (Gas Town) → Approval Queue optionally shows nudge action (Paperclip).

This is where Gas Town's nudge pattern and Paperclip's budget-gate pattern converge: a stalled agent might be stalled *because* it hit a budget gate, not because it crashed.

**Acceptance criteria:**
- [ ] `agent:heartbeat` event type in `FrameEvent` union
- [ ] Each agent emits heartbeat every 30s (configurable)
- [ ] Shell Deacon: missing heartbeat after `autoNudgeTimeout` → `agent:stalled` event
- [ ] `agent:stalled` events distinguish "crash" from "awaiting_approval" in their `details` field

---

## Shell Approval Queue (Sprint 4-5 feature)

The unified surface for all governance actions. Lives in the shell activity feed as a distinct "Needs action" section.

**What appears here:**
1. `hook.approval_status === 'pending'` — agent wants to start work, needs sign-off
2. `agent:budget_warning` at 80% — agent approaching limit (informational, no action required)
3. `agent:budget_exhausted` at 100% — agent paused, user must extend or reset budget
4. `agent:stalled` without an `awaiting_approval` reason — might need a nudge

**UI:** Carbon `ActionableNotification` per item, grouped under "Needs action" at the top of the activity feed slide-out.

**Per-item actions:**
- Budget warning: [Dismiss] [Extend budget]
- Budget exhausted: [Reset month] [Extend by N tokens] [Shut down agent]
- Hook pending: [Approve] [Reject] [View bead]
- Agent stalled: [Nudge] [Handoff] (Gas Town actions, already planned in ProblemsView)

---

## Vocabulary consolidation (critical)

All three systems have strong vocabularies. Frame's vocabulary wins at the boundary.

| Gas Town term | Paperclip term | Frame term |
|---------------|---------------|-----------|
| polecat | employee (ephemeral) | `worker` agent |
| crew | employee (permanent) | `crew` agent |
| mayor | CEO | `mayor` agent |
| witness | department head | `witness` agent |
| rig | department / team | sub-app domain |
| convoy | project | `FrameConvoy` |
| molecule | task sequence | `FrameMolecule` |
| formula | template | `Formula` (TOML) |
| bead | task / work item | `FrameBead` |
| hook | assignment | agent hook |
| GUPP | autonomous execution | propulsion rule |
| sling | hire / assign | `sling()` |
| nudge | n/a | `nudge()` |
| handoff | offboard | `handoff()` |
| company | workspace | workspace (future) |
| board / operator | user | user |
| heartbeat | heartbeat | `agent:heartbeat` event |
| budget | budget | `budget_limit` / `budget_spent` labels |
| goal hierarchy | n/a (implicit in org) | `goal_parent` label |

**Rule:** Internal Frame code and documentation use Frame terms. Domain-model.md explains the mapping. The vocabulary map is the Rosetta Stone — agents reading it can understand Paperclip and Gas Town references without needing to know either system's internal vocabulary.

---

## What NOT to do

1. **Don't MF-wrap Paperclip** — it has its own React UI and Express server. Wrapping it as a Module Federation remote fights its architecture. Adopt patterns, not runtime.
2. **Don't adopt Paperclip's company/CEO metaphors** in Frame's codebase — use Frame's vocabulary exclusively.
3. **Don't add `goal_chain: string[]` to every bead** — single `goal_parent` label + traversal is the right data model.
4. **Don't sequence G-series before A1+A2** — you need FrameBeads and AgentBeads before you can add governance fields to them.
5. **Don't conflate budget (tokens) with time** — budget tracks token spend, not time spent. These are different constraints.
