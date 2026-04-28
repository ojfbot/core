# ADR-0053: Bead-aware /frame-standup; informal-bead spine until A1 FrameBead is blocked

Date: 2026-04-28
Status: Proposed
OKR: 2026-Q2 / O3 (continuity) / KR2 (cross-rig coordination signal in the morning ritual)
Commands affected: /frame-standup, /bead, /orchestrate (downstream)
Repos affected: core (skill bodies + audit checklist), all sibling rigs (`.handoff/` discipline)

---

## Context

The full Gas Town adoption plan (A1 FrameBead → A8 Convoys; A1 alone is multi-week TS work in `@core/workflows`) is not on the critical path for "stable + productive local dev." The `/bead` skill already produces dated markdown beads with structured frontmatter that is forward-compatible with A1 FrameBead — `id`, `type`, `status`, `labels`, `refs`, `actor` map cleanly.

`/frame-standup` today syncs repos and audits the daily-logger, but does **not** read beads. Substantial coordination signal living in each rig's `.handoff/` directory is invisible to the morning ritual. A user starting their day sees yesterday's daily-logger article and `git log` output — not the open decisions, in-flight work, or producer/consumer artifact-blockages captured in beads.

We also need a free precursor to gastown G1 governance (`goal_parent` label linking each work item to an OKR/Roadmap item) without waiting for the formal schema.

## Decision

The coordination spine for the next 4+ weeks is **informal markdown beads + a bead-aware `/frame-standup`**:

1. **Extend `/frame-standup`** to walk every rig's `.handoff/` directory. Group open beads by `goal_parent` frontmatter (OKR linkage). Surface artifact-producer/consumer relationships explicitly (e.g. asset-foundry `bead status: blocked-on:bvr-asset-spec` → highlights cross-rig dependency). Include bead summary in the day plan alongside the existing daily-logger audit.

2. **Add `goal_parent` field** to `/bead` frontmatter. Soft-typed string referencing an OKR ID or Roadmap item (e.g. `goal_parent: 2026-Q2/O3/KR2`). Free precursor to G1 — no schema change required.

3. **Defer formal A1 FrameBead** until a concrete consumer forces typed access. Most likely candidates:
   - The future Game Library sub-app needing typed bead reads to render its catalog.
   - `/frame-standup` cross-rig queries that become too slow or too ugly with markdown grep.
   - GasTownPilot Phase 1 panels needing a Bead API.

When A1 lands, the existing markdown beads parse cleanly (the `/bead` schema is forward-compatible). `/frame-standup` swaps grep for typed reads in one PR.

## Consequences

### Gains
- Sprint X (coordinative) delivers value in days, not months.
- `/frame-standup` becomes the unified entry point — beads stop being a parallel-track artifact invisible at session start.
- Habit-builds gastown vocabulary (`goal_parent`, prefix routing, status lifecycle) without locking schema early.
- Clean migration path: when A1 lands, the existing markdown beads parse cleanly; `/frame-standup` swaps grep for typed reads in one PR.

### Costs
- No typed bead reads yet — cross-rig queries grep markdown frontmatter (slow at >100 beads per rig).
- `goal_parent` is a soft label; OKR linkage is by convention, not enforced.
- `/frame-standup` skill body grows; needs careful work to keep audit-checklist + bead-summary readable in one go.

### Neutral
- The "blocked until forced" trigger is fuzzy; we may underestimate the inflection point. Mitigated by ADR-0052 reserving prefixes today so no migration when A1 lands.
- The producer/consumer surfacing (foundry → beaverGame) initially handles one explicit pair; the pattern generalizes when more cross-rig pipelines emerge.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Ship A1 FrameBead now (full Sprint 1 of adoption-plan) | Multi-week TS work that doesn't unblock local-dev pain. Timing is wrong — informal beads deliver 80% of value at 5% of the build cost. |
| Skip beads in `/frame-standup`; use GitHub Issues only | Loses inter-session continuity (the `/bead` use case). GH Issues are too heavyweight for "the gotcha I learned in last session." |
| `/frame-standup` only reads beads, drops daily-logger audit | The daily-logger is the public-facing record; the audit is also a quality gate. Both are needed. |
| Use Dolt-backed BeadStore from the start (W0 pattern) | Premature; no other rig is ready to consume Dolt. Adds operational surface (Dolt server, branch management) for no near-term gain. |
