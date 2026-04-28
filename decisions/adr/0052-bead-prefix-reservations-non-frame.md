# ADR-0052: Bead prefix reservations for non-Frame rigs

Date: 2026-04-28
Status: Proposed
OKR: 2026-Q2 / O3 (continuity) / KR1 (universal `/bead` adoption across rigs)
Commands affected: /bead, /frame-standup, future BeadStore implementations
Repos affected: core (CONTEXT.md, /bead skill), asset-foundry, beaverGame, future Game Library

---

## Context

`gastown/knowledge/adoption-plan.md` (A1 FrameBead) defines a bead prefix routing table mapping each rig to a namespace: `core-`, `cv-`, `blog-`, `trip-`, `pure-`, `hq-`. The two new rigs (`asset-foundry`, `beaverGame`) and the planned Game Library sub-app need prefixes for their `.handoff/` beads, but the current adoption-plan list omits them.

Reserving the prefixes now — before the formal A1 FrameBead schema lands — costs nothing (it's a convention enforced by the `/bead` skill via markdown frontmatter) and lets `/frame-standup`, future BeadStore implementations, and any cross-rig query tooling route correctly without retrofit.

## Decision

Reserve the following bead prefixes, extending the adoption-plan A1 routing table:

| Prefix | Rig | RigProfile | Status |
|--------|-----|-----------|--------|
| `fnd-` | asset-foundry | non-frame | reserved |
| `bvr-` | beaverGame | non-frame | reserved |
| `lib-` | Game Library (TBD name) | frame (future) | reserved; may be superseded if final name dictates a different prefix |
| `lean-` | lean-canvas | frame | reserved (was implicit; now explicit) |
| `seh-` | seh-study | frame | reserved (was implicit; now explicit) |

The prefixes work today via `/bead` markdown frontmatter (`prefix: fnd-`). When A1 FrameBead lands, the `FilesystemBeadStore` reads the same prefixes; no migration needed.

Update `domain-knowledge/CONTEXT.md` §4 to include the full table (done in this ADR's companion change).

## Consequences

### Gains
- Universal prefix discipline now, A1 deferral has zero cost.
- `/frame-standup` aggregating beads across rigs has a stable identifier per rig from day one.
- `lean-` and `seh-` prefixes (previously implicit) become explicit, removing ambiguity for new contributors.

### Costs
- If the Game Library is renamed at scaffold time, `lib-` may need to be superseded with a project-specific prefix. A future ADR can supersede this one for that prefix only.
- Three prefixes added to the table any tool now needs to keep current.

### Neutral
- Prefix collision risk is tiny (single 3–4 char namespaces); none of the reserved prefixes overlap.
- `mrplug` and `landing` are not currently bead-producing; if they start, they'll need their own ADR-superseding entry (`plug-`, `lnd-` proposed).

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Wait for A1 FrameBead before reserving | Adoption is months out; meanwhile beads in non-Frame rigs would land under ad-hoc prefixes and require migration. |
| Use the repo name as the prefix (`asset-foundry-`, `beaverGame-`) | Long, ugly, breaks tab-completion; existing prefixes are short on purpose. |
| Reserve only the active rigs (skip `lib-` until scaffolded) | Game Library is on roadmap with concrete shape; reserving early avoids racing on prefix at scaffold time. |
