# ADR-0026: CoreReader write-capability deferred to Phase 5, not Phase 1

Date: 2026-03-18
Status: Accepted
OKR: 2026-Q1 / O3 / KR2 (Observability surface)
Repos affected: core-reader
Shipped: [core-reader] #7 (`e554dfe`)

---

## Context

CoreReader is the observability dashboard for the Frame OS cluster. Phase 1 shipped three
read-only tabs (ADRs, OKRs, frame-os-context). The question was when to introduce the OKR edit
flow: immediately (Phase 1 write surface alongside the first read tabs) or deferred until the
read paths were validated against real data.

Writing to `frame-os-context.md` through a UI is a high-consequence operation: that file is the
metadata source for every daily-logger prompt. A malformed write corrupts the context that drives
all automated daily documentation.

## Decision

The OKR edit flow (PUT to the API that commits changes to `frame-os-context.md`) was deferred to
Phase 5. Phases 1–4 delivered read-only surfaces (OKRs tab, Docs tab, Changes tab, Activity tab).
Phase 5 introduced the write path with optimistic Redux state and rollback on network failure.

## Consequences

### Gains
- Phases 1–4 validated all GET paths against real data before any PUT surface was exposed.
  Schema assumptions, rendering edge cases, and API contract issues were caught in read-only mode
  — where errors are visible but harmless.
- The phased approach meant the write path was implemented with a known-good read baseline. The
  optimistic rollback logic was written knowing exactly what a "good" state looks like.

### Costs
- **Production gap now that the write surface is live.** Optimistic rollback reverts Redux state
  on network failure but does not undo a persisted write that completed before the failure was
  detected. If a bad write goes through, `frame-os-context.md` is corrupted. The first observable
  symptom: daily-logger produces incoherent or context-free prompts on the next run. Recovery
  path: manual `git revert` of `frame-os-context.md`.
- A formal **write-validation layer** (schema validation before the PUT fires) has not been
  scoped. The phase gate protected development; it does not protect production. This is the
  next action against [core-reader] #7: scope and implement a validation guard before the write
  surface is considered production-ready.

### Neutral
- The optimistic rollback handles the common failure case (network error, API down). The
  unhandled case is a write that succeeds at the API layer but produces invalid content — the
  rollback does not fire because the write was technically successful.

## Follow-on required

Scope a write-validation guard for the Phase 5 OKR edit path: JSON schema or structural
validation of the `frame-os-context.md` diff before the PUT is issued. Until this is in place,
the write surface carries a known production risk that is not mitigated by the optimistic
rollback.
