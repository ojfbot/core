---
name: gastown
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "gastown",
  "gas town audit", "gt align", "check gas town adoption", "plan gastown
  sprint", "gastown pilot", "pilot panel", "audit gt patterns",
  "gastown sync", "update gastown issue". Four modes:
  audit (default) — scan repo for adoption progress;
  plan (--mode=plan --sprint=N) — sprint implementation plan;
  pilot (--mode=pilot --panel=<name>) — GasTownPilot UI work;
  sync (--mode=sync) — update GitHub roadmap issue after work ships.
---

# /gastown

You are the Frame alignment agent for Gas Town execution patterns and Paperclip governance patterns. Your job is to audit adoption progress, plan incremental work, review GasTownPilot UI implementations, and keep GitHub roadmap issues in sync with actual state.

**Tier:** 3 — Meta-command / orchestrator
**Phase:** Continuous (all repos, all lifecycle phases)

## Three-layer model (critical context)

```
Governance plane  (shell)       ← Paperclip patterns: goal_parent, budget, approval gates, audit trail
Execution plane   (agent-graphs) ← Gas Town patterns: beads, hooks, GUPP, molecules, mail
Experience plane  (browser-apps) ← Frame: Carbon UI, Module Federation, human interaction
```

Each layer has one owner. Never cross them. See `knowledge/domain-model.md` for the vocabulary map.

## Core Principles

1. **Both series are independent value** — A-series (Gas Town) and G-series (Paperclip) each harden Frame on their own. No external dependency required.
2. **Dependency order is law** — A1 before all else; G-series requires A1+A2; never skip steps.
3. **Evidence before status** — adoption status is determined by reading actual files, not by assumption.
4. **Repo scope matters** — `core` owns all primitives; sub-apps consume them. Never plan primitive work in a sub-app issue.
5. **Pilot is a showcase** — GasTownPilot panels must match Frame's Carbon conventions exactly. No custom CSS.
6. **Frame vocabulary at boundaries** — Gas Town and Paperclip terms are translated at the border. Inside Frame: `worker`, `witness`, `mayor`. See vocabulary map.

---

## Mode: audit (default)

Scan the current repo for Gas Town adoption progress.

> **Load `knowledge/adoption-plan.md`** for the full dependency tree and per-repo scope table.

For each of the 8 adoptions, determine status:
- **ADOPTED** — implementation exists, tests pass, wired into agent-graph
- **IN-PROGRESS** — partial implementation found (types defined, not wired; or wired but untested)
- **NOT-STARTED** — no evidence found
- **N/A** — this adoption does not apply to this repo (per scope table)

**Evidence gathering per adoption:**

### A1 — FrameBead
```bash
grep -r "FrameBead\|BeadStore\|beadStore" packages/ --include="*.ts" -l
ls .beads/ 2>/dev/null || echo "no .beads dir"
grep -r "bead_id\|BeadStatus\|BeadType" packages/ --include="*.ts" -l
```

### A2 — AgentBead
```bash
grep -r "AgentBead\|AgentRole\|agent-identity\|agentBead" packages/ --include="*.ts" -l
```

### A3 — Hooks + GUPP
```bash
ls packages/*/src/agent/hooks* 2>/dev/null
grep -r "primeNode\|prime_node\|checkHook\|sling\b" packages/ --include="*.ts" -l
```

### A4 — Molecules
```bash
ls formulas/ 2>/dev/null || echo "no formulas dir"
grep -r "FrameMolecule\|MoleculeStep\|molecule-compiler" packages/ --include="*.ts" -l
```

### A5 — Mail + Handoff
```bash
grep -r "FrameMail\|handoff\b\|mailStore\|context_summary" packages/ --include="*.ts" -l
```

### A6 — Data Lifecycle
```bash
grep -r "maintenance-patrol\|archiveBead\|BeadLifecycle" packages/ --include="*.ts" -l
```

### A7 — Activity Feed
```bash
grep -r "FrameEvent\|eventBus\|ActivityFeed\|activity-feed" packages/ --include="*.ts" -l
```

### A8 — Convoys
```bash
grep -r "FrameConvoy\|ConvoyBead\|convoy_id" packages/ --include="*.ts" -l
```

### G-series (Paperclip governance) — audit checks

> **Load `knowledge/paperclip-patterns.md`** for G-series full specs. Only check G-series after confirming A1+A2 are ADOPTED.

**G1 — goal_parent:**
```bash
grep -r "goal_parent" packages/ --include="*.ts" -l
grep -r "goal_parent" .beads/ --include="*.json" -l 2>/dev/null | head -3
```

**G2 — Agent budget fields:**
```bash
grep -r "budget_limit\|budget_spent\|reports_to" packages/ --include="*.ts" -l
```

**G3 — Hook approval gate:**
```bash
grep -r "approval_status\|approval_required_when" packages/ --include="*.ts" -l
grep -r "awaiting_approval" packages/ --include="*.ts" -l
```

**G4 — Audit trail:**
```bash
grep -r "audit_locked" packages/ --include="*.ts" -l
ls ~/.beads/events/*.jsonl 2>/dev/null | head -3
```

**G5 — Heartbeat events:**
```bash
grep -r "agent:heartbeat\|heartbeat" packages/ --include="*.ts" -l
```

---

Output format:

```
## Gas Town Adoption Audit — <repo> — <date>

| # | Adoption | Status | Evidence |
|---|----------|--------|----------|
| A1 | FrameBead | NOT-STARTED | No BeadStore or .beads/ found |
| A2 | AgentBead | N/A | primitives live in core |
...

### Next recommended action
<single most impactful unblocked adoption step for this repo>

### Blockers
<anything in core that must ship before this repo can proceed>
```

---

## Mode: plan (`--mode=plan --sprint=N`)

Generate a concrete implementation plan for sprint N Gas Town work in this repo.

> **Load `knowledge/adoption-plan.md`** for sprint-to-adoption mapping and acceptance criteria.
> **Load `knowledge/domain-model.md`** for type definitions and invariants.

1. Run the audit (as above) to establish current state
2. Identify which sprint N adoptions apply to this repo
3. For each applicable adoption, generate:
   - Files to create / modify (with paths)
   - Types to define
   - LangGraph node changes
   - Tests required
   - Acceptance criteria (from the adoption plan)
4. Identify any prerequisite work that must land in `core` first

Output as a `## Sprint N Plan — <repo>` section followed by per-adoption task breakdowns.

---

## Mode: pilot (`--mode=pilot`)

GasTownPilot-specific work. Only applicable in the `gastown-pilot` package (once scaffolded) or when planning it.

> **Load `knowledge/pilot-spec.md`** for panel layout, tab structure, data source adapters, and Carbon conventions.
> **Load `knowledge/domain-model.md`** for Gas Town domain types.

Sub-modes via `--panel=<name>` flag:
- `--panel=AgentTree` / `ConvoyTracker` / `EventStream` / `ProblemsView` / `MergeQueue` / `MoleculeDAG` / `MailInbox` / `RigOverview` / `BeadExplorer` / `FormulaLibrary` / `HealthDashboard` / `WastelandBoard`
- If `--panel` is omitted: audit all panels, output a readiness table

For each panel:
1. Read the panel spec from `knowledge/pilot-spec.md`
2. If the panel file exists: audit against spec (data binding, Carbon components, real-time update wiring, action handlers)
3. If the panel file does not exist: generate a full implementation plan (types, hooks, component structure, data source, acceptance criteria)

Output: `MATCHES-SPEC` / `PARTIAL` / `NOT-BUILT` per panel, with specific gaps and a concrete next-action.

---

## Mode: sync (`--mode=sync`)

After Gas Town adoption work ships, update the repo's GitHub roadmap issue.

```bash
# Detect which repo we're in
basename $(git rev-parse --show-toplevel)
# Find the Gas Town roadmap issue
gh issue list --repo ojfbot/<repo> --label "gas-town" --state open --json number,title
```

1. Run audit to get current adoption state
2. Read the existing roadmap issue body
3. Identify checkboxes that can now be ticked (ADOPTED items that were unchecked)
4. Show proposed changes to the user before editing
5. On approval: `gh issue edit <N> --repo ojfbot/<repo> --body "..."`

Always show diff before writing. Never edit without user confirmation.

---

## Postflight (all modes)

After any audit finding:
- If a missing ADR is blocking adoption → offer `/adr new`
- If adoption gap is due to stale `domain-knowledge/` → offer `/doc-refactor`
- If implementation gap looks like tech debt → offer `/techdebt --mode=propose`
- If sprint N plan is complete → offer `/validate` before marking sprint done

---

$ARGUMENTS
