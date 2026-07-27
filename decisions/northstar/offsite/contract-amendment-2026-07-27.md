# Contract amendment — growth posture (PROPOSED)

> **Status: PROPOSED — not in force.** Drafted 2026-07-27 by the Code side of the relay, against
> the operator's stated strategy: *revive stubs growing in parallel with emergent synergies and
> shared tooling / domain concerns — no demote decisions.* The relay loop applies: the voice
> conversation refines this, chat writes the confirmed form, Code lands the schema/lint changes as
> slices. Until confirmed, `contract.md` and the current lever vocabulary stand.
>
> Evidence base: the 2026-07-25 fleet census + reconciliation reply
> (`~/.claude/plans/output-a-full-report-sequential-prism.md`, Documents 1–3), the
> schema-evolution log in this directory, `ladder-stress.jsonl`, and the wayfinder sitting
> #272–#285 (2026-07-23).

---

## A1 — Lever set v2 (replaces demote/archive)

The census walk's verdict vocabulary, revised for a growth posture. `demote` and `archive` are
removed as verdicts; their honest job — keeping `ns:l2-ojfbot#P2` truthful about what will never
be worked — moves into accounting (A2), not into cuts.

| Lever | Means | Registry effect |
|---|---|---|
| **push** | actively worked now | `posture: active`, roadmap slices flowing |
| **revive** | dormant by intent, queue position declared | `posture: reviving` + queue position |
| **seed** | declared intent, little/no code; grows when a synergy pulls it | `posture: seeded` + one-line pull condition |
| **hold** | target stands, nothing scheduled, no queue claim | `posture: active`, no ready slices |
| **fold → X** | consolidation, not cutting: code or ambition merges into X | X's entry absorbs it; recorded |
| **reclass** | substrate or cluster member, not an app | `posture: substrate`, or ladder into a cluster node (A3) |
| **retire** | the *target* is no longer wanted (rare; about the target, not the repo) | entry removed deliberately, recorded |

Rules carried over from the census walk, unchanged: one pass per cluster, not per repo; no row
leaves a sitting unmarked; a `revive` without a queue position and a `seed` without a pull
condition are invalid verdicts.

Ground-truth instances at draft time: `seed` — CarrierPigeon (declared inside the GameWorld
cluster, pre-code), basecamp-20 (vault gap G-03, no repo yet), agent-anatomy (awaiting article
outline). `fold` candidates — core-library → asset-foundry (stale extraction, 15 uncommitted, no
consumer); gcgcca's geospatial core → mirrorworld (preserving the 2026-07-23 USGS login-token M2M
auth work).

## A2 — `posture:` registry field + two-mean rollup (the denominator fix)

Additive optional field on registry entries in `decisions/northstar/README.md` frontmatter —
the schema's preferred change class ("additive optional fields are the default change"):

```yaml
posture: active | reviving | seeded | substrate   # optional; absent = active
```

- `substrate` — measured by consumers; exempt from the "usable surface in its natural venue"
  P1 rollup; health = consumer count + consumer-cited evidence. First assignees:
  frame-ui-components, github-actions.
- `reviving` / `seeded` — **inventory, not debt.** Excluded from the L2 P1/P2 denominator;
  reported as their own line. A declared queue of revivals is a legitimate portfolio position;
  the same rows undeclared are drift. This field is the difference.
- Lint change: `northstar-lint` rollup-drift WARNs compute **two means** — active-only and all —
  and report both. The standing `l2-ojfbot#P1` 55%-vs-28% drift becomes decidable (which
  denominator was the 55% a claim about?) instead of arguable.

**WIP limit (operator-confirmable number):** proposed **2 revivals in flight** alongside the
always-on tracks. Parallel revival without a WIP number reproduces the Legs-2–6 failure — five
registration slices queued for a month. Everything past the limit holds `reviving`/`seeded`
posture with its queue position, visibly.

## A3 — Cluster tier: build it, don't invent a substrate tier

Per ITERATION 6 + its 2026-07-02 UPDATE in `schema-evolution-log.md`: the cluster-tier evidence
gate is **tripped** (GameWorld declared: lofi-beaver, beaverGame, asset-foundry, foundry-recipes,
CarrierPigeon) and the build is already scoped as *"a justified post-drive slice (candidate home:
rm-l2-ojfbot) — one slice, four artifacts"*: cluster node syntax/loader/lint, `cluster-gameworld`,
`cluster-f1` (pre-drafted card 11b, quick-confirm in voice), and the deferred pit-wall
`depends_on` lint retrofit (ITERATION 4 debt).

No separate substrate *tier* is needed: switchboard and dive-briefing already demonstrate that
consumer-phrased L1 properties work ("the retriever is a fleet library" is dive-briefing P5);
asset-foundry's accounting is covered by the GameWorld cluster; the remaining library/CI repos
take `posture: substrate` (A2). This amendment therefore **commits the cluster-tier build slice**
into `rm-l2-ojfbot` and closes the substrate question with field + tier-build, not a new tier.

Sequencing commitment (substrate before revival): (1) `check:` backfill chore — ~57 slices are
compile-demoted to `human_only` for want of a one-line check command; (2) TD-006 → S32/S33 (bead
closure loop) — reviving stubs onto a fake closure loop mints open loops; (3) the load-bearing
zeroes — switchboard S2→S3, dive-briefing S2 (both `ready`); (4) this cluster-tier slice;
(5) the A2 field + lint; (6) author `l2-selfco`. Then the walk proper.

## A4 — Close the L2-P1-widening counter (RESOLVED-BY wayfinder #274)

`ladder-stress.jsonl` + the PRESSURE COUNTER hold the widening gate at **2 of 3** (f1-substrate
leg 1; shell leg 5), with the `landing` card flagged as the candidate third strain and the rule
*"at 3, the roadtrip freezes for a deliberate parent-revision session — the L2 parent is never
hot-patched mid-leg."*

The deliberate parent revision **has happened**: the wayfinder sitting (#272–#285, merged
2026-07-23) reworded P1 venue-neutral — *"value shown where the app lives, not gated on one
cross-domain hero demo"* — retired demo-track targeting (#273), and added P3 (*"The Arcade fronts
the fleet"*). It honored the spirit of the freeze rule (deliberate, operator-driven, not
hot-patched mid-leg) but ran outside the roadtrip's process, so the Contract still counts strains
against wording that no longer exists.

Disposition: mark the counter **RESOLVED-BY ns:l2-ojfbot rev 2026-07-23 (wayfinder #274)**; quote
the current P1/P2/P3 text into the Contract; reset strain-counting against the new wording. The
`landing` card is un-strained until re-assessed against venue-neutral P1. Restart the counter at
0 of 3.

## Companion item (not part of this amendment): `l2-selfco`

Authoring `l2-selfco` is a voice conversation, not a schema change — but this amendment records
the grounding so it isn't authored from the wrong picture: the vault's apex node is the **Camera
Program** (art-and-engineering practice; the ojfbot fleet is *"the practice's technical substrate
— not the practice itself"*). Draft property shape for the conversation: P1 the vault answers real
queries from real sources; P2 the Camera Program advances its mission ladder (Playhouse →
Basecamp 20); P3 the deposit-library loop closes (currently operator-held). Repo reassignment,
stress-tested: purefoy, bldgblog-corpus, selfco-box, seh-study plausibly ladder here;
**daily-logger stays under `l2-ojfbot#P2`** (three roadmaps land slices in it);
diy-repair-qa-eval stays with the buddy-check eval lineage. Registry mechanics are unblocked:
the deferred entry's path (`~/selfco/tracking/`) is outside wiki lint scope by design.

---

*Notion writes (Itinerary corrections, Contract page, counter closure) are pending Notion MCP
authorization on both relay sides; this file is the durable copy of record until then, per the
existing `offsite/` convention.*
