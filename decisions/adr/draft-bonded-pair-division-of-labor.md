# ADR-XXXX: Bonded-pair division of labor (ojfbot ⊕ selfco)
slug: bonded-pair-division-of-labor
serial: draft
rev:
Date: 2026-07-23
Status: Proposed
domain: meta
type: architecture
OKR:
Commands affected: /vault, /bead, /day-run, /frame-standup
Repos affected: core, morning-cockpit, selfco-box, all fleet apps; ~/selfco vault
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [operating-surface-tiered-composition]
  parent:
  part-of-series:

---

## Context

The apex northstar `l3-shared` names the pair "ojfbot ⊕ selfco" but no decision defined the seam
between them. Two forces pulled opposite directions: the bldgblog deposit-library plan ("selfco
IS the knowledge base — closed loop") pulled toward the vault as a live backend, while the
vault's curation ethos, append-only raw layer, and enforceable sensitive-register exclusions
(e.g. the Hal archive §6 rule) pulled against machine-write throughput. Meanwhile the
operational artifacts — beads, roadmap slices, instance/thread records — needed a declared home
as Tier C of the operating surface.

## Decision

Split by object kind, with one-way curated seams:

- **Selfco is the reference layer** — *understanding objects* (knowledge-about): lens corpora,
  research, syntheses, entity pages for every repo and managed endpoint. Apps and the launchpad
  **read it at design/generation time**. Runtime processes never write it. It must hold current
  fundamental knowledge of everything ojfbot builds, kept "relatively up to date" exclusively
  through the curated seams: `/vault sync`, session stubs, daily-logger.
- **The operational spine is the state layer** — *work objects* (state-of): beads, northstar
  registry, roadmap slices, decompositions, instance/thread records, drift reports. Live,
  machine-actionable, human-inspectable; runtime read + write. Never stored in the vault.

Discriminator: work objects are *acted on*; understanding objects are *consulted*. Selfco knows
about beads; it is never the bead store.

## Consequences

### Gains
- Sensitive-register exclusions stay enforceable — no runtime write path into the vault.
- Cockpit/bead/registry schema work proceeds independently of vault schema.
- The vault's freshness obligation becomes an explicit, measurable contract (entity-page
  currency via the sync seams).
- The launchpad can consult vault judgment (design lenses, precedent surveys) without coupling
  runtime state to it.

### Costs
- The deposit-library framing is narrowed: selfco is the KB for *knowledge*, not a universal
  backend; ephemeral/live data needs spine schema work instead of reusing the vault.
- Entity-page staleness becomes a real failure mode that the sync seams must be measured on.

### Neutral
- Existing seams (vault-session.sh stubs, /vault sync, daily-logger) are unchanged — they are
  now the *only* sanctioned write path, which is what they already were in practice.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Selfco as live runtime backend (closed loop) | Machine-write throughput inside a human-curated vault; sensitive-register rules unenforceable |
| Fully separate systems, no freshness contract | Vault drifts stale; bonded pair degrades to two strangers; l3-shared apex becomes fiction |
| Everything in the spine, vault absorbed | Loses the curated, append-only knowledge layer and its judgment corpora |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-07-23 operating-surface alignment grill (/grill-with-docs session) |
| Implementation start | _pending_ |
| Implementation end | _pending_ |
