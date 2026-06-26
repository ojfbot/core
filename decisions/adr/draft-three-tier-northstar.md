# ADR: Three-tier northstar — distributed per-app vision tracking that ladders to a shared apex
slug: three-tier-northstar
serial: draft
rev:
Date: 2026-06-25
Status: Proposed
domain: workflow-engine
type: convention
OKR: 2026-Q2 / O-legibility / KR-northstar-coverage
Commands affected: /frame-standup (Step 4.6 + Step 5 framing + postflight), /adr (relationship), /orchestrate (future: slice→property binding)
Repos affected: core (decisions/northstar, scripts/northstar-lint, scripts/lib/northstar-fm, frame-standup binding); every fleet app (an L1 .claude/northstar.md); selfco vault (deferred L2)
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [stable-identity-and-facet-tags, control-gated-slices, lint-shadow-to-gate]
  parent:
  part-of-series:

---

## Context

ojfbot had no durable, measurable statement of *where each thing is going*. OKRs
(`decisions/okr/`) are quarterly and tactical; roadmap phases are sequencing; neither is a standing
compass that daily work can be measured against. The result is that priorities drift from the vision
and "progress" is asserted from memory rather than recorded. (Greenfield: a full-tree grep for
"northstar" returned nothing.)

The fleet is also not a single project. There are ~14 active apps under ojfbot **and** a separate
selfco knowledge system. A single northstar (the work-tool model these patterns came from) cannot
express "this app advances ojfbot, which advances the shared bet." The vision is inherently tiered.

This is the strategic half of the same effort as `session-provenance-hardening` (the `/resume` work):
that ADR makes *what happened* honest; this one makes *what we're aiming at* measurable. Together they
are the "work is legible and self-measuring" property (`ns:l3-shared#P2`).

## Decision

Introduce a **three-tier northstar**, a markdown-canonical artifact with ADR-0087-style identity:

- **Tiers.** L1 (one per fleet app, in `<app>/.claude/northstar.md`) → L2 (`l2-ojfbot` in core,
  `l2-selfco` in the selfco vault) → L3 (`l3-shared`, the apex, in core). Each L1 ladders to an L2;
  each L2 to L3.
- **Identity & laddering (reuses `stable-identity-and-facet-tags`).** A northstar has an immutable
  `slug`; properties have stable ids `P1…Pn` (assigned once, never reused). A property declares
  `ladders_up_to: ns:<parent-slug>#P<n>`, a typed ref that **must resolve to a property on disk** —
  the exact resolve-or-fail invariant ADR-0087 applies to `traces:`. `northstar-lint.mjs` enforces it.
- **File-canonical; bead mirror deferred.** The markdown file is the source of truth. A queryable
  bead mirror (reusing the existing `okr`/`roadmap` bead types + `goal_parent` chain, which are
  declared-but-unused today) is a Phase-2 slice, not this one.
- **selfco's L2 lives in the vault, never in core.** It sits in `~/selfco/tracking/` — *outside*
  `wiki/` — so it never enters the wiki lint scope (like `bases/`, `canvas/`, `skill-dispositions.jsonl`).
  Core references it by path; it is never mirrored.
- **Movement is recorded, not remembered.** An append-only `status.jsonl` holds one line per
  movement (`{date, northstar, property, from, to, evidence, actor, source}`) — the
  `Property #N: X% → Y%` record. `/frame-standup` Step 4.6 loads the active northstar(s), Step 5 frames
  each priority as `· advances ns:<slug>#P<n> (NN%)` (or `[no-northstar]`), and the postflight offers
  to record movement.
- **Rollup is hand-asserted in Slice 1; lint runs shadow-only.** Each `current` is hand-written;
  `northstar-lint` computes what each parent % *would* be from its children and reports drift without
  overwriting. A computed/authoritative rollup is a later, data-gated promotion — the shadow→gate
  discipline of `control-gated-slices` and `lint-shadow-to-gate`.

OKR relationship: a northstar is the durable parent of the quarterly OKRs; an OKR *advances* a
property (`okr_drivers` on the property, optional `advances: ns:<slug>#P<n>` on the Objective). They
are distinct nodes in one goal tree, not the same artifact.

## Consequences

### Gains
- Daily work traces to a measurable property at the right altitude; "does this advance the vision?"
  becomes a check the standup performs, not a hope.
- The tiered model expresses the real fleet + selfco structure, and movement rolls up — an L1 advance
  is visible at L3.
- Dependency-free: the loaders parse the constrained frontmatter with no YAML library, so lint /
  standup binding run in any repo with just `node`.
- Identity reuse means no new identity machinery — `slug` + `ns:<slug>#P<n>` + resolve-on-disk is the
  ADR-0087 pattern applied to a second artifact class.

### Costs
- A new artifact to maintain per app (an L1 file) and the discipline to record movement honestly — a
  fabricated bump is the very confabulation this is meant to prevent.
- Cross-repo coupling: L1 files live in app repos; lint reports a registered-but-absent L1 until that
  app's file lands. (This is honest, but means full-green lint spans repos.)
- Hand-asserted rollup can drift from its children; shadow lint surfaces it but does not reconcile it
  until the computed-rollup slice.

### Neutral
- Slice 1 ships L3 + `l2-ojfbot` + one L1 (`l1-cv-builder`) + manifest + template + lint (shadow) +
  the frame-standup binding. Deferred: `l2-selfco`, remaining L1s, computed rollup, bead mirror, Dolt
  `bead_events` replay, CI gate.
- `status.jsonl` is created on first recorded movement; until then staleness is unchecked.
