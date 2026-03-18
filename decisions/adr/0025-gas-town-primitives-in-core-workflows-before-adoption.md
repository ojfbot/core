# ADR-0025: Gas Town execution + governance primitives in @core/workflows before shell/cv-builder adoption

Date: 2026-03-18
Status: Accepted
OKR: 2026-Q1 / O3 / KR1 (Gas Town adoption)
Repos affected: core, shell (pending), cv-builder (pending)
Shipped: [core] #22 (`3d17faa`)

---

## Context

Gas Town A2–A8 (execution plane: atom registration, dependency resolution, reactive invalidation,
memoised selectors, async effect scheduling, error boundary propagation, cross-atom transactions)
and G2–G5 (governance plane: budget tracking, spend approval gates, audit-log emission, policy
enforcement hooks) were ready to implement. The question was where to implement them: directly
inside the shell repo (the first consumer), or in the `@core/workflows` package with shell and
cv-builder importing as dependencies.

## Decision

All Gas Town primitives are implemented in `@core/workflows` and exported from the package
barrel. Shell ([shell] #21) and cv-builder ([cv-builder] #111) consume them as package
dependencies. The primitives ship before either consumer; adoption follows the primitives.

## Consequences

### Gains
- **The package boundary is the durability guarantee.** If Gas Town had been implemented inside
  the shell, cv-builder would need its own copy. Two copies of a dependency graph protocol will
  eventually drift. One package, referenced many times, enforces a single contract.
- Defining the contract once before adoption means both consumers implement against a stable
  API rather than reverse-engineering each other's implementations.
- `@core/workflows` tests cover the primitives in isolation: unit tests on individual atoms,
  integration tests on the dependency graph under cross-atom transactions, spend-gate tests
  verifying G3 fires mid-transaction. These tests run on every core PR, not on shell or
  cv-builder PRs.

### Costs
- **Coordination risk on breaking changes.** If `@core/workflows` requires a breaking change
  while shell and cv-builder are at different adoption stages, both consumers must coordinate
  upgrades together. That coordination cost is real. Mitigation: semantic versioning and
  explicit deprecation windows — neither of which is currently documented. This is a known gap
  to address before both consumers are deep in adoption.
- The governance plane (G2–G5) only works as a control surface if the enforcement hook (G5)
  actually stops execution. G5 has unit test coverage but has **not been exercised end-to-end
  with a live shell consumer**. The primitives are shipped; the integration is not. [shell] #21
  is the first real test of G5 under a live consumer.

### Neutral
- "Unblocked" ([cv-builder] #111 is now unblocked) is not the same as "in motion." No owner
  or sprint assignment has been confirmed for cv-builder adoption as of this writing.

## Samir pillar

**Tooling for fast iteration** — shared primitives in a package rather than duplicated
implementations. The package boundary makes iteration fast because there is one place to change,
one test suite to green, and all consumers pick up the improvement.
