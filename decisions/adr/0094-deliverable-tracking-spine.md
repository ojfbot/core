# ADR-0094: Deliverable-tracking spine — gate-transition ledger → vault canvas projection (hook-audited)

slug: deliverable-tracking-spine
serial: 0094
domain: workflow-engine
type: architecture

- **Status:** Accepted — the robust form of TD-006 (canvas sync); applies to any scope-appropriate gated-slice effort. Shipped to `main` via PR #157.
- **Date accepted:** 2026-06-14
- **Related:** ADR-0086 (gated-slice), `skill-action-instrumentation` (the same emit-not-magic + honesty-contract pattern), `duplex-work-item-sync` (ledger-canonical / idempotent projection / no-drift), ADR-0085 (selfco vault), TD-006

---

## Context

Gated-slice canvases (TD-006) must stay in sync as slices/gates transition (enter slice, enter gate,
validating, passed/failed, delivered). The user requires this be **robust, hook-driven, and
auditable**. Two traps — both lessons from the OPAV session — must be designed around:

1. **Claude Code hooks fire on *tool* events (PostToolUse, Stop, PreToolUse), not on *semantic* gate
   transitions.** A hook wired to "observe" a gate pass captures nothing, silently — the exact failure
   that killed `skill-telemetry` (ADR-0092 / S1). "Hook-driven" cannot mean "hook-observed."
2. **A stale tracking canvas is worse than none** (and "passed" is self-report unless tied to evidence).

## Decision

1. **Append-only gate-transition LEDGER is the source of truth** (in the vault — `tracking/<program>.jsonl`
   and/or appended to `log.md`). One event per transition:
   `{program, slice, gate, to_state ∈ {entered, validating, passed, failed, delivered}, actor, ts,
   evidence_ref, op_id}`. Append-only, never rewritten — this is the audit trail.
2. **Emission is explicit, not magic.** At each transition the slice's `/validate` · `/tdd` · `/gated-slice`
   step calls a deterministic `gate-event` command that appends to the ledger AND **idempotently projects**
   to the canvas (op_id-keyed; same lesson as the agent-emitted `skill:acted` — there is no tool event for
   a semantic transition, so you emit it).
3. **The canvas is a derived PROJECTION**, regenerated from the ledger's latest event per gate (node
   status/color). Never hand-edited as truth → it cannot drift (mirror of beads-canonical / issue-mirror).
4. **Hooks do AUDIT + reconcile, not the primary write.** A Stop/PostToolUse hook runs a reconciler that:
   (a) verifies canvas == ledger (divergence alarm); (b) checks every `passed`/`delivered` event carries a
   **resolvable `evidence_ref`** (TPM readout / test output / PR — the honesty contract, invariant #2);
   (c) flags gates stuck in `validating` past an SLA (staleness — the silent-stale guard). The reconciler's
   *auto-repair* is an action-taking control → **shadow-first** (observe + alarm) before it may rewrite the canvas.
5. **One honesty contract, reused.** A `passed`/`delivered` with no independent `evidence_ref` is flagged,
   exactly as in S1/S4/S5. Not a new contract.
6. **Auditable by replay:** any canvas state is reconstructable from the append-only ledger.
7. **Owned-region-in-slice-nodes projection.** The projection target on a hand-curated canvas is a
   *bounded region* of each slice node — `node.color` (a status rollup) + the text between a
   `<!--gate-status-->` … `<!--/gate-status-->` fence — keyed `nodeId == slice`. Hand-authored prose
   outside the fence is **outside the projection contract**: never read, never written. This resolves
   the tension between "the canvas is fully derived" and "the canvas is hand-curated" — the projector
   still writes *only* from ledger events (the drift door stays shut), but to a delimited region, so
   curation survives. Replay-reproduces-exactly and hand-edit-divergence are therefore **scoped to the
   owned region**; a prose edit is not a divergence. Color ownership supersedes the canvas's
   hand-authored OPAV-phase coloring once a slice is live-tracked (a live tracker's job is status;
   phase stays documented in the title legend).
8. **One primitive, two event types.** The ledger/emit/projector/reconciler are a reusable spine.
   `gate-event` is the first consumer; `skill:acted` (OPAV-S1) is a second `event_type` on the *same*
   spine, with `correlation_id = SUGGESTION_ID` (adr:suggestion-identity-and-denominator). The honesty
   contract is shared (skill:acted also requires resolvable evidence). S1 adds a TYPE, not a system —
   two ledgers would reintroduce the duplex-drift hazard this ADR exists to kill.

## Consequences

- **Gains:** the canvas can't silently rot (it's derived, not authored); every gate transition is an
  auditable evidence-backed event; the tracking spine is the **same telemetry pattern as OPAV-S1** —
  reuse, not a new system. It's recursive in a good way: the loop that keeps deliverables honest is the
  loop the OPAV program is already building.
- **Costs:** the `gate-event` emit command + the canvas projector + the reconciler hook are real work;
  the emit must be wired into the slice lifecycle steps (`/gated-slice`, `/validate`, `/tdd`).
- **Scope gate (from TD-006):** only for efforts that warrant slices/gates — single-PR work skips this.

## Verification
A replay of the ledger reproduces the current canvas exactly; a seeded `passed`-without-evidence event is
flagged by the reconciler; a hand-edit to the canvas is detected as divergence and reverted to the
ledger-derived state; a gate left `validating` past SLA raises a staleness alarm.
