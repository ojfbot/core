# Captured cluster block — cluster-golf (DESIGN EVIDENCE)

> **Design evidence, NOT a registered node.** The cluster tier is **designed, not built**
> (ITERATION 6 + its updates in `../schema-evolution-log.md`): no cluster node exists in the
> registry, no `ladders_up_to` anywhere carries a cluster ref, and per-app L1s ladder to
> `l2-ojfbot` directly (topology Option A — thin cluster node; the cluster is a
> membership/coordination overlay, not a ladder parent). Intended cluster refs live in SYNTHESIS
> lines only. This file is the formatted capture of the 2026-07-27 GOLF UMBRELLA voice sitting's
> cluster brief, landed 2026-07-30 by the Code side of the relay — the six prose briefs arrived
> chat-side; Code formatted them (an inversion of the usual chat-writes-the-block flow, flagged).
> ⚑ = operator-verbatim ruling (CONFIRMED). Everything marked PROPOSED/UNRATIFIED awaits an
> operator pass.

```
CLUSTER BLOCK (pending schema build — ITERATION 6 lineage)
app: cluster-golf
tier: cluster (pending schema build)
schema: none — cluster syntax (ns:cluster-<name>#P<n>) is designed-not-built; this block is evidence for the build slice
umbrella: golf course management — product · tools · hardware integrations · publication · go-to-market · research
vision: The cluster behaves like a functioning startup being built in public. Wedge: the 50/50 raffle product on edge hardware — revenue-generating from day one, zero capex for course operators (revenue-share sale). Expansion: operational-intelligence upsell (course conditions, player behavior, maintenance prediction) once hardware is installed and trusted. Moat: the cross-course data network — pattern recognition no incumbent workforce-management product has. Public build: golf-press documents the build as claims-checked articles AND generates the formal artifacts (SE docs, business plan/investor, sales & team enablement) via blogengine instances. Precedent frame (operator-supplied): Instacart/Caper smart carts (customer touchpoint = the sensor; retail-media layer on captured attention) and Walmart's ambient IoT + shelf-scanning CV (continuous audit of physical state) — course sensors = the Walmart move; golfer-facing device/app = the Instacart move; retail-media layer = lessons/club-fitting/raffle offers at the moment of attention.
SYNTHESIS: capture-agent's model is the cluster's first principle — everything else consumes or amplifies it. First consumer/producer decomposition of the roadtrip (fairway out of mirrorworld); first depends_on edge of the cluster (ns:l1-fairway#P1 -> ns:l1-capture-agent#P1). Membership ruling dissolves 11b sharp edge 4 for golf. Intended cluster refs: capture-agent=cluster-golf#P1, fairway=#P2, golf-platform-scripts=#P3, hardware=#P4, golf-press=#P5, golf-runner=#P6, golf-research=#P7.
```

## ⚑ Structural rulings (operator-verbatim, 2026-07-27 sitting; rename dated 2026-07-30)

1. **Cluster members are REPOS, uniformly.** The property-subset question (itinerary 11b sharp
   edge 4) is **dissolved for golf by decomposition**, not answered by exception — the
   property-subset branch (fairway ≈ `ns:l1-mirrorworld#P2+#P5`, floated in the RFI Addendum A)
   is **DEAD**. f1/gameworld ratification of the all-cluster ruling still pends the 11b sitting.
2. **⚑ fairway decomposes OUT of mirrorworld** — own repo, own L1 (`l1-fairway`). fairway =
   consumer, mirrorworld = producer (the foundry-recipes → asset-foundry shape). **mirrorworld is
   NOT a member** — it is a producer with a `depends_on` edge from fairway.
3. **⚑ gcgcca renames to `capture-agent`** (long form: golf course capture agent; slug
   `l1-capture-agent`). gcgcca was never registered, so this landed as a fresh registration with
   the rename recorded in a registry comment — no retirement entry exists.

## Members (7 — 3 repos today, 4 seeded)

| P | Member | Kind | Slug | Posture (sitting) | State at land |
|---|---|---|---|---|---|
| P1 | capture-agent | repo (renamed from gcgcca) | `l1-capture-agent` | active | REGISTERED 2026-07-30 — the cluster's first principle (below) |
| P2 | fairway | repo (decomposed from mirrorworld) | `l1-fairway` | active | REGISTERED 2026-07-30 — axes PROPOSED, ladder PROVISIONAL |
| P3 | golf-platform-scripts (+ loose non-repo dirs `build-golf`, `mcp-golf`) | repo(s) | — (unregistered; itinerary Leg 3 row 8 binds all three as ONE card) | reviving | coldest active-claim repo (lc 2025-07). OPEN OD: row 8 = the P3 anchor, or a new consolidated row — operator call |
| P4 | hardware integrations | seed | — | seeded | no repo; edge AI devices (on-device video + radar ball detection) |
| P5 | golf-press | seed → repo (blogengine instance) | — | seeded | publication pipeline, f1-press-room shape PLUS formal doc generation |
| P6 | golf-runner | seed → repo | — | seeded ⚑ | GTM motion. Born-named (⚑ renamed from golf-sales 2026-07-30 BEFORE anything registered — no pointer needed anywhere) |
| P7 | golf-research | seed → repo (lean-canvas framework) | — | seeded | ONE northstar covering competitor-analysis + customer-research (operator kept unified; split only under strain) |

**Producer (not member):** mirrorworld — supplies terrain rendering + earth bundles to fairway.
`depends_on` edge territory, not membership.

**Seeds rule applied:** registry entries require a resolvable path, so the four seeds get NO
registry entry — they live here, in the itinerary rows (CarrierPigeon 14a precedent), and in
offsite notes. **All seed pull conditions below are UNRATIFIED proposals.**

## ⚑ Cluster first principle (P1, operator verbatim)

> Scrape satellite data of all golf courses in Texas; use it as the initial training set for
> robust image classification, segmentation, and feature detection — mapping golf courses across
> seasons and drought conditions; produce ground-cover maps (tree coverage, turf, all site-survey
> layers); **publish the fine-tuned model to Hugging Face as a portfolio artifact** supporting the
> forward-deployed engineer goal; then bring outputs into mirrorworld/fairway for 3D terrain.

Prior vault research binds: NAIP-CHM = fastest path to canopy masks; NDVI is a poor tree-vs-turf
discriminator on golf courses. Licensing review before HF upload is in scope.
⚠ Open operator question (Q3, flagged in mirrorworld PR): mirrorworld P6/PH5 (added 2026-07-27)
overlaps this mission — ownership of the segmentation-model work needs a ruling.

## Dependency graph (depends_on edge candidates; only fairway→capture-agent is landed)

```
capture-agent (P1 model) ──► fairway (P2 twin renders model outputs)   [LANDED: ns:l1-fairway#P1 depends_on ns:l1-capture-agent#P1]
capture-agent ──► golf-research (corpus + deployed-course comparison)
mirrorworld (producer) ──► fairway (terrain rendering)
hardware (P4, seeded) ──► capture-agent (future: edge inference ground truth)
golf-research (P7) ──► golf-runner (positioning, market sizing)
golf-research (P7) ──► fairway + golf-platform (feature prioritization)
golf-runner (P6) ──► golf-press (case studies, GTM materials published)
ALL members ──► golf-press (self-documentation surface)
blogengine (reviving) ──► golf-press (engine dependency — ingest path currently BLOCKED; pull condition accounts for it)
lean-canvas (reviving) ──► golf-research (framework dependency)
```

## Seed pull conditions (PROPOSED — operator to ratify; a seed without a pull condition is invalid per A1)

- **golf-press:** first capture-agent milestone worth publishing (corpus v1 or first model eval)
  AND blogengine ingest unblocked or a static-first workaround chosen (plain markdown in-repo,
  blogengine rendering later). Copy f1-press-room's claims-check *shape*, not its channel (that
  channel is dead, AMBIG posture). Ruling made in-sitting: SE docs / business plan / enablement
  are sub-sections of ONE golf-press northstar (doc classes as properties), not three seeds.
- **golf-runner:** fairway hero demo renders a real course (demo-able) OR a warm course-operator
  lead materializes (the sales-guy contact from the original 50/50 conversation is the obvious
  first door — that provenance is the cluster's origin story and a live warm lead; belongs in the
  vault entry).
- **golf-research:** golf-runner's first real operator conversation scheduled (research before the
  pitch) OR capture-agent corpus v1 lands (Axis-1 work starts from the data side). Post-deployment
  feedback-loop axis is explicitly later-phase, not a v1 blocker.
- **hardware:** (from RFI Addendum A / A1) the umbrella northstar authoring pulled it as declared
  scope; a signed 50/50 pilot pulls it hard.

## Success criteria (cluster level, from the sitting brief)

1. capture-agent model live on Hugging Face with eval card (the portfolio artifact exists).
2. fairway renders a real Texas course from model outputs, seasonal variants toggleable.
3. First 50/50 pilot conversation with a real course operator (golf-runner motion started).
4. golf-press publishing cadence: every cluster milestone has a claims-checked artifact.
5. Two-mean rollup: cluster members report into `l2-ojfbot#P1/#P2` like any L1 (no cluster-level
   rollup in v1).

## Open questions Code did NOT resolve (operator queue)

- Q1 gh repo rename gcgcca→capture-agent (asked in ojfbot/gcgcca#5).
- Q2 fairway ladder target #P1 vs #P2 (asked in ojfbot/fairway#1; landed provisional #P1).
- Q3 mirrorworld P6/PH5 vs capture-agent P1 overlap (asked in ojfbot/mirrorworld#11).
- Q4 golf-platform-scripts: row 8 as P3 anchor vs new consolidated row.
- Q5 LADDER_STRESS provenance: code-proposed verdicts in ladder-stress.jsonl await ratification.
- All seed pull conditions + capture-agent numeric targets (UNRATIFIED).
