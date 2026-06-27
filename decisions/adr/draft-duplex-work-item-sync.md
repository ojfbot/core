# ADR (draft): Duplex work-item sync — beads canonical, GitHub issues mirrored, safe under full-duplex concurrency

slug: duplex-work-item-sync
serial: (unassigned — draft; serial assigned at accept per ADR-0087)
domain: agent-graph
type: architecture

- **Status:** Proposed (draft) — hardened against a 2026-06-13 adversarial red-team (4 reviewers)
- **Related:** ADR-0016 (framebead work primitive), ADR-0041 (convoy), ADR-0043 (AgentBead), ADR-0002 / Cockpit Track-R (unassigned queue, accepted-unbuilt), ADR-0087 (slug-as-identity → immutable correlation_id), `draft-repo-scoped-skill-relevance` (sibling)
- **Program:** Slice 4 of the "autonomous multiagent task loops" gated-slice effort. The single-claim-**with-fencing** invariant here is the entrance criterion for the autonomy slice.

---

## Context

The prioritized agent task queue is a **hybrid**: **beads are canonical**, GitHub **issues are a mirror**
(for assignability + autonomous execution via the Claude GitHub App). This is a **full-duplex
communication channel** — both endpoints can originate work and both mutate concurrently. The user
flagged it as risky/complex and directed significant stress-testing. Four adversarial reviewers each
broke a different invariant; the failures below are the rationale for the decision.

### Failure catalog (what a naive hybrid does — all confirmed by red-team)
1. **Double-execution (zombie).** The lease (CAS `claimed_by`) gates *who starts*, not *who commits*.
   TTL expiry while an executor is slow-but-alive (GC pause, clock skew) yields **two valid
   leaseholders**; both emit external side effects. Outbox idempotency (`correlation_id`) dedupes
   *issue projections*, NOT the *task's own* side effect.
2. **Resurrection / split-brain.** At-least-once + out-of-order webhooks deliver a **stale human edit
   after completion**; arbitration that resolves by content-equality (not causal order) folds it into
   canonical → a **done task reopens at P0 and re-runs**. This also falsifies "pull-from-canonical
   prevents priority skew" — arbitration is a path by which lagged issue state *writes* canonical.
3. **Duplicate intake (echo).** Projector creates an issue; GitHub `issues.opened` fires **before
   `mirror_ref` is durably written**; intake sees an "unknown" issue → mints a **second bead** → two
   beads / one issue → double-run or mirror storm. Echo suppression is only as strong as "dedup key
   written *before* the suppressible event can arrive."
4. **Lease/liveness pathologies.** Heartbeat outliving work → permanent lease (TTL never fires);
   non-atomic completion → open+done split or claimable+not-done re-execution; poison task →
   claim/crash/reclaim starvation; client-clock TTL comparison → premature zombie.

## Decision

**Bidirectional intake, unidirectional authority — made safe by fencing + causal versioning.**

1. **Beads canonical; issues a projection.** Both sides may *originate*; after creation, all
   authoritative state lives on the bead. Issue-side edits are **proposals** reconciled in, never
   applied to canonical directly.
2. **Fencing tokens (the load-bearing fix).** Each lease grant returns a strictly-monotonic per-bead
   `fence`. **Completion-release is a fenced CAS** (`WHERE claimed_by=me AND fence=my_fence`) so a
   zombie cannot evict a live holder. **Every side-effecting write carries its fence and the sink
   rejects stale fences.** Safety moves from time (TTL/clock) to order (token). Un-fenceable
   third-party sinks must be made idempotent on `(bead, fence)` **or must not run under an
   expiry-reclaimable lease at all** — a *requirement* constraint, not a design detail.
3. **Monotonic `rev` (or HLC) per bead, projected into the issue.** Every proposal carries the `rev`
   the human observed; **arbiter rejects any proposal with base-rev < bead.rev.** Causal order, not
   arrival order or content equality.
4. **Tombstones for terminal states.** `done`/`deleted` are absorbing; **no proposal resurrects a
   tombstoned bead** — a reopen is *new-item intake* (fresh bead+issue, `supersedes` link), never a
   revival.
5. **Client-minted `op_id`, transactional outbox.** A client `op_id` is committed in the **same
   transaction** as the bead + outbox row, stamped into the create call (idempotency key) **and** the
   issue body. Intake dedupes on `op_id` (always present before any webhook can arrive). **Single
   projector with a lease.** `correlation_id`/`mirror_ref` are **immutable identity** (ADR-0087) —
   never reassigned to "resolve" a conflict (that manufactures orphans); collapse duplicates by `op_id`.
6. **Liveness:** server-side TTL only (agents never compare local clocks); heartbeat bounded by
   absolute `MAX_LEASE` and gated on observed work-progress; **dead-letter after N attempts**;
   completion + outbox enqueue atomic.
7. **Reconciler converges *before* autonomy.** A bead with an unreconciled pending proposal is
   **non-claimable** (the claim CAS includes `rev`). The reconciler's *auto-repair* is an
   action-taking control → matures through a **Brassboard/shadow** stage (emits divergence / orphan /
   double-claim-blocked / sync-lag TPMs); but its *detection* must be live during the damage window —
   observe-only-and-absent is the wrong default.

## Consequences

- **Gains:** safe autonomous pickup across a duplex channel; double-execution and resurrection are
  structurally prevented, not hoped-against.
- **Costs:** fencing + `rev` + `op_id` + transactional outbox + single-projector-lease are real
  plumbing; arbitration becomes causal (more than a content diff).
- **Hard boundary (accept explicitly):** tasks whose side effect is an **un-fenceable, non-idempotent
  third-party action** cannot be made safe by this model — they must be wrapped in an idempotency
  gateway or excluded from expiry-reclaimable autonomous execution. Name such tasks at intake.

## Verification (the invariants to test)
No double-completion under TTL-expiry-mid-flight (fenced sink). No resurrection of a tombstoned bead
under late/out-of-order webhook (rev-gate). No duplicate bead under create-before-ref webhook
(`op_id`). No permanent lease under wedged-but-alive process (`MAX_LEASE`). These become the Slice-4
Success Criteria TPMs in the gated-slice plan.

## Red-team addenda (2026-06-13 workflow — fold in before implementing)
- **New intake gate (before fencing): task autonomy-safety classification** — fenceable/idempotent vs
  human-gated, **fail-closed**; 0 un-fenceable-non-idempotent tasks admitted to a reclaimable lease.
- **Split completion TPM into bead-side AND instrumented-sink-side:** an external side effect can
  double-fire while the bead row reads green — the catastrophic case under S5 autonomous load. Promotion
  requires both; run an **S4×S5 contention game-day** before autonomous delivery.
- Reconciler **detection-recall** TPM (injected divergences detected = 1.00), separate from repair correctness.
- Validate against a **real GitHub sandbox replaying captured webhook traces** (at-least-once, multi-hour
  redelivery, reorder), not only the synthetic injector; tombstone-retention ≥ max-redelivery-horizon.
- Borrow the S1 honesty contract for **completion** (independent side-effect trace, not a bead row alone).
- `op_id` here **MUST be** the S0 `SUGGESTION_ID`/work-item identity (cross-slice invariant #1).
- This is Slice 4 of `OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md`.
