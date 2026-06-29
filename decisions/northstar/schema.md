# Northstar schema — v1.1

The canonical, versioned schema for the three-tier northstar system. Authoritative for the field
shape; `template.md` is the copy-me starting point, `README.md` is the registry + prose overview, and
`scripts/northstar-lint.mjs` is the executable enforcement of everything below. Governing decision:
`decisions/adr/draft-three-tier-northstar.md`.

> **Why a versioned schema doc.** Generated artifacts (an L1 northstar, an offsite briefing) are
> measured against this. The gap between a draft and what the schema requires is the progress signal.
> The schema sharpens through use — see *Versioning* at the bottom.

## What a northstar is

A project's **compass**: a one-paragraph vision plus a fixed set of named **properties**, each a
named axis of progress with a concrete target, an honest current %, and a verification. A northstar is
a compass, not a destination — it does not move; our *understanding* of it sharpens. Daily work traces
to a property; movement is **recorded** (in `status.jsonl`), never asserted from memory.

## Tiers

| Tier | What | Lives in | Ladders to |
|------|------|----------|------------|
| **L3** | the shared `ojfbot ⊕ selfco` apex (exactly one) | `core/decisions/northstar/l3-shared.md` | — (root) |
| **L2** | a venture: `l2-ojfbot`; (deferred) `l2-selfco` | `core/decisions/northstar/l2-ojfbot.md`; `~/selfco/tracking/` | an L3 property |
| **L1** | one per fleet app | `<app>/.claude/northstar.md` | an L2 property |

## File fields

### Frontmatter (top-level scalars)

| Field | Req? | Type / values | Rule |
|-------|------|---------------|------|
| `type` | required | `northstar` | literal discriminator |
| `slug` | required | kebab-case | **immutable identity** (ADR-0087). Assigned once, never renamed or renumbered. Convention: `l1-<app>`, `l2-<venture>`, `l3-shared` — but a shipped slug is identity, so an off-convention slug already on disk is kept, not "fixed". |
| `tier` | required | `L1` \| `L2` \| `L3` | — |
| `app` | L1 only | repo name | omit for L2/L3 |
| `ladders_up_to` | required for L1/L2; **forbidden for L3** | parent **slug** (not a property ref) | the file-level parent northstar; must exist in the registry/on disk |
| `status` | required | `active` \| `paused` \| `retired` | — |
| `properties` | required | list of property maps (≥1) | see below |

### Per-property fields

| Field | Req? | Type / values | Rule |
|-------|------|---------------|------|
| `id` | required | `P1`…`Pn` | stable; **assigned once, never reused** even if a property is retired |
| `name` | required | string | the named axis of progress |
| `target` | required | string | what "done" looks like — concrete and verifiable |
| `current` | required | integer `0`–`100` | the scoreboard. **Hand-asserted in Slice 1**, evidence-derived, never aspirational |
| `verification` | required | string | how you'd *prove* the current % |
| `ladders_up_to` | required for L1/L2 properties; **forbidden for L3** | typed ref `ns:<parent-slug>#P<n>` | **resolve-or-fail**: must resolve to a real property on disk, and that property must live inside the file's declared parent northstar (the ADR-0087 `traces:` invariant) |
| `okr_drivers` | optional | list of OKR refs, e.g. `["2026-Q2/O1/KR3"]` | quarterly OKRs currently moving this property |
| `depends_on` | optional | typed ref `ns:<other-app>#P<n>` | **horizontal peer edge** (v1.1): a sibling property in *another* app this property is contingent on. Orthogonal to `ladders_up_to` (vertical). **Resolve-or-fail** (linter owns this). The "dependent ≤ dependency" cap is a **shadow warning**, not a block — see *Horizontal dependencies* below |

### Body (markdown, after frontmatter)

`# Northstar — <name> (<tier>)`, a **`**Vision.**`** paragraph, then one `## P<n> — <name>` section per
property. A lower-tier property's section should state *how advancing it advances its parent*.

## Composition rules across tiers

1. **Ladder completeness.** L1 and L2 must declare both a file-level `ladders_up_to` (parent slug) and
   a per-property `ladders_up_to` (parent property ref). L3 must declare neither.
2. **Parent-containment.** A property's `ns:<slug>#Pn` ref must point into the *same* northstar named by
   the file's `ladders_up_to`. (You cannot ladder a property to a parent your file doesn't ladder to.)
3. **Rollup is shadow, not authoritative (Slice 1).** Each `current` is hand-written. `northstar-lint`
   computes what each parent % *would* be from the mean of its children and reports drift beyond ±5pp —
   it never overwrites. A computed/authoritative rollup is a later, data-gated promotion.
4. **Movement is recorded.** `status.jsonl` (created on first movement) holds one append-only line per
   change: `{date, northstar, property, from, to, evidence, actor, source}`.
5. **Identity reuse, never invention.** New identity machinery is never added — `slug` +
   `ns:<slug>#P<n>` + resolve-on-disk is the ADR-0087 pattern applied to this artifact class.

## Horizontal dependencies (`depends_on`, v1.1)

`ladders_up_to` is vertical (child → L2 parent). `depends_on` is **horizontal** — a peer edge to a
sibling property in another app, for genuinely contingent properties. First instance: f1-pit-wall's
"every number is grounded" depends on f1-substrate's "computes truth or returns NULL" — the render
guarantee is only meaningful relative to the data guarantee.

- **Optional.** Most properties omit it. Only declare it when the property's done-state is genuinely gated
  by another app's property.
- **Resolve-or-fail (linter owns this).** The ref must resolve to a real property on disk — the same
  invariant as `ladders_up_to`. This half is purely syntactic, so the linter genuinely owns it.
- **Cap is shadow, never a block.** The instinct — a dependent should not claim more doneness than its
  foundation — is sound, but `current` is hand-asserted and the two properties frequently measure
  *different axes* (e.g. a render-guarantee vs a data-correctness-vs-coverage number). So
  `current(dependent) > current(dependency)` is reported as a WARNING ("dependency inversion — check
  whether these axes are comparable"), not a land-time rejection. Hard enforcement is a later data-gated
  promotion, the same shadow→authoritative path as rollup.
- **No transitivity yet.** The cap is pairwise only; transitive resolution is deferred until a leg needs it.

## Registry

The authoritative list of every northstar lives in `README.md` frontmatter under `registry:` — one
entry `{slug, tier, app?, path, ladders_up_to}` per northstar. Paths resolve relative to the core root
(`~` → home, absolute passes through). A registered-but-absent file is a lint **error**; an on-disk
file that is *not* registered is currently invisible to lint (known gap — reconcile by hand).

## Verification

`cd core && node scripts/northstar-lint.mjs` — ERRORs (registry/file mismatch, broken ladder, malformed
property, tier-completeness) must be 0; WARNs (rollup drift, staleness) are shadow signals, recorded not
silenced. `--format=summary` is the one-liner the standup surfaces; `--check` is the future CI gate.

## Kickback — ladder stress (framework self-test)

Authoring L1s is also a stress-test of the L2 parent. Every offsite leg emits a **ladder-stress** verdict
*per parent property it ladders to* — the fit is **asserted, not assumed** (the sibling discipline to
"movement is recorded, not remembered"). This is **relay-channel metadata, not a northstar file field** —
it is logged, never written into `.claude/northstar.md`.

- `clean` — laddered without strain. Confirms the parent.
- `strain` — it fit, but the parent's meaning had to stretch. A warning; logged, not acted on.
- `break` — an axis genuinely fit neither parent. A defect; the parent is provisionally suspect.

**Detection is single-class, not split.** clean/strain/break is a *semantic* judgment made in the voice
leg. The linter cannot see it: a forced-fit property resolves syntactically and lint greenlights it — that
is the buried failure the verdict exists to surface. The linter's orthogonal job is to (a) enforce the
verdict is *present and well-formed at land time* (absence → land rejected) and (b) optionally emit
structural *hints* (laddering-distribution skew). It never adjudicates fit. (A non-resolving ladder is a
different thing — a hard ERROR that blocks landing before any kickback state is reached.)

**Log:** `ladder-stress.jsonl`, append-only, one line per parent-property verdict —
`{date, app, northstar, parent, verdict, reason, actor}` (reason required unless `clean`). Mirrors the
`status.jsonl` pattern.

**Gate (data-gated, RIDM):** one `break`, or N `strain`s against the **same** parent property (N recorded
and calibratable — starts at 3), **freezes** the roadtrip for a deliberate parent-revision session. The L2
parent is never hot-patched mid-leg (that liquefies the ladder under every already-landed L1). The revision
mechanism itself — parent versioning + re-validation of landed L1s — is **designed when the gate first
trips**, shaped by the real defect, not pre-built (the `@v2` re-point silently changes meaning under every
child that keeps its `ns:<slug>#Pn` ref, so it needs deliberate design). The parent gets to be wrong; it
does not get to be *quietly* wrong, and it does not move while you stand on it.

## Versioning & evolution

- This doc carries a version (**v1**). The schema sharpens through use, not abstract design: when a repo
  conversation surfaces a structural need the current fields can't express, bump the version here and log
  the change (what changed + why) in the governing ADR's revision trail.
- A version bump must stay backward-compatible with on-disk files or ship a migration — `slug` and `P<n>`
  ids are immutable, so additive change (new optional field) is the default; never repurpose an existing
  field's meaning.
- `template.md` and `northstar-lint.mjs` move in lockstep with this doc; a field added here is only "real"
  once the lint enforces it (or explicitly defers it as shadow).
