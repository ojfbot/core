---
# Northstar registry — the authoritative list of every northstar and where it lives.
# read-northstar.mjs and northstar-lint.mjs parse this frontmatter. Paths resolve relative
# to the CORE root (the repo containing decisions/), so they work identically from the
# installed core or an isolated worktree. ~ expands to home; absolute paths pass through.
# In-tree L2/L3 sit under decisions/northstar/; L1 apps live in ../<app>/.claude/northstar.md;
# the L2 selfco northstar lives in the selfco vault (outside ojfbot), referenced by ~ path.
registry:
  - slug: l3-shared
    tier: L3
    path: decisions/northstar/l3-shared.md
    ladders_up_to: null
  - slug: l2-ojfbot
    tier: L2
    path: decisions/northstar/l2-ojfbot.md
    ladders_up_to: l3-shared
  - slug: l1-cv-builder
    tier: L1
    app: cv-builder
    path: ../cv-builder/.claude/northstar.md
    ladders_up_to: l2-ojfbot
  - slug: l1-morning-cockpit
    tier: L1
    app: morning-cockpit
    path: ../morning-cockpit/.claude/northstar.md
    ladders_up_to: l2-ojfbot
  # Reconciled 2026-06-28 from on-disk L1s that worker agents authored but never registered.
  # (Two further on-disk copies — mc-perf, mc-motion — are duplicate l1-morning-cockpit scratch
  #  worktrees, NOT distinct apps, so they are intentionally excluded.)
  - slug: l1-f1-pit-wall
    tier: L1
    app: f1-pit-wall
    path: ../f1-pit-wall/.claude/northstar.md
    ladders_up_to: l2-ojfbot
  - slug: l1-f1-substrate
    tier: L1
    app: f1-substrate
    path: ../f1-substrate/.claude/northstar.md
    ladders_up_to: l2-ojfbot
  - slug: buddy-check                         # NB: shipped with a bare slug (no l1- prefix); slug is
    tier: L1                                   # immutable identity (ADR-0087), so it is registered as-is.
    app: buddy-check
    path: ../buddy-check/.claude/northstar.md
    ladders_up_to: l2-ojfbot
  # f1-press-room: teaching/content studio consuming the f1 pair's export seam (bootstrapped
  # 2026-07-03, rm:rm-l1-f1-press-room#S1).
  - slug: l1-f1-press-room
    tier: L1
    app: f1-press-room
    path: ../f1-press-room/.claude/northstar.md
    ladders_up_to: l2-ojfbot
  # silicon-empires: AoE-style RTS of the AI-infrastructure complex (queues, capital,
  # energy, silicon); SPEC-canon repo, Phase 0+1 delivered 2026-07-03 (PRs #1-#6).
  - slug: l1-silicon-empires
    tier: L1
    app: silicon-empires
    path: ../silicon-empires/.claude/northstar.md
    ladders_up_to: l2-ojfbot
  # Roadtrip leg-5 landings (voice-CONFIRMED 2026-06-28, files merged 2026-07-13:
  # shell#79 + BlogEngine#58). NB: a local checkout on another branch (e.g. blogengine's
  # ADR-0081 rollout WIP) shows these as registered-but-absent — a working-copy artifact,
  # same class as the 2026-07-03 cv-builder finding; the files ARE on origin/main.
  - slug: l1-shell
    tier: L1
    app: shell
    path: ../shell/.claude/northstar.md
    ladders_up_to: l2-ojfbot
  - slug: l1-blogengine
    tier: L1
    app: blogengine
    path: ../blogengine/.claude/northstar.md
    ladders_up_to: l2-ojfbot
  # core itself: the skill loop (honest follow-rate metric -> frozen suggester eval -> eager
  # discovery) IS core's product surface. Bootstrapped 2026-07-17, rm:rm-l1-core#S1, from the
  # skill-loop RCA + SOTA pass (decisions/research/2026-07-17-skill-loop-sota.md).
  - slug: l1-core
    tier: L1
    app: core
    path: .claude/northstar.md
    ladders_up_to: l2-ojfbot
  # Portfolio-first gap-closers (operator sitting 2026-07-22; context in
  # decisions/research/2026-07-22-hired-projects-gap-analysis.md): dive-briefing = the public
  # RAG service (buddy-check's lab machinery served + corpus-governed), switchboard = the fleet
  # LLM gateway. Third sibling agent-anatomy registers once its article is outlined.
  - slug: l1-dive-briefing
    tier: L1
    app: dive-briefing
    path: ../dive-briefing/.claude/northstar.md
    ladders_up_to: l2-ojfbot
  - slug: l1-switchboard
    tier: L1
    app: switchboard
    path: ../switchboard/.claude/northstar.md
    ladders_up_to: l2-ojfbot
  # virtualLight revived 2026-07-23 (operator sitting; Garage Kubrick D3/D4 decided —
  # pipeline-is-the-product, Gibson packs private; ADR in-repo).
  - slug: l1-virtuallight
    tier: L1
    app: virtualLight
    path: ../virtualLight/.claude/northstar.md
    ladders_up_to: l2-ojfbot
  # mirrorworld: geospatial intelligence track (operator sitting 2026-07-23) — real places as
  # explorable three.js scenes; golf digital twin (apps/fairway) revives the firstTxGolf ->
  # txGolf -> gcgcca lineage; mentor corpus = Bilawal Sidhu (selfco constellation).
  - slug: l1-mirrorworld
    tier: L1
    app: mirrorworld
    path: ../mirrorworld/.claude/northstar.md
    ladders_up_to: l2-ojfbot
  # f1-doctrine: RAQG question layer for the F1 stack (S0 design record 2026-07-24) — suggests WHICH
  # strategist questions to ask, each bound to an f1-substrate call; never computes a number.
  - slug: l1-f1-doctrine
    tier: L1
    app: f1-doctrine
    path: ../f1-doctrine/.claude/northstar.md
    ladders_up_to: l2-ojfbot
  # Deferred to a later slice (declared here so lint/standup know the intended shape):
  # - slug: l2-selfco
  #   tier: L2
  #   path: ~/selfco/tracking/northstar-selfco.md   # in the vault, OUTSIDE wiki/ (lint scope)
  #   ladders_up_to: l3-shared
# Roadmap registry (roadmap-schema.md) — one delivery roadmap per northstar, same path rules.
# roadmap-lint.mjs and roadmap-compile.mjs parse this list.
roadmaps:
  - slug: rm-l1-morning-cockpit
    northstar: l1-morning-cockpit
    path: ../morning-cockpit/.claude/roadmap.md
  - slug: rm-l2-ojfbot
    northstar: l2-ojfbot
    path: decisions/northstar/roadmap-l2-ojfbot.md
  # f1 stack (2026-07-03): substrate and pit-wall registered before press-room so the
  # cross-roadmap depends_on refs (rm:<slug>#S<n>) resolve.
  - slug: rm-l1-f1-substrate
    northstar: l1-f1-substrate
    path: ../f1-substrate/.claude/roadmap.md
  - slug: rm-l1-f1-pit-wall
    northstar: l1-f1-pit-wall
    path: ../f1-pit-wall/.claude/roadmap.md
  - slug: rm-l1-f1-press-room
    northstar: l1-f1-press-room
    path: ../f1-press-room/.claude/roadmap.md
  - slug: rm-l1-silicon-empires
    northstar: l1-silicon-empires
    path: ../silicon-empires/.claude/roadmap.md
  # the skill loop (2026-07-17): measurement -> eval -> discovery, doctrine-ordered.
  - slug: rm-l1-core
    northstar: l1-core
    path: .claude/roadmap.md
  # Portfolio-first gap-closers (2026-07-22): registered together with their northstars.
  # rm-l1-dive-briefing S9 lands in bldgblog-corpus, rm-l1-switchboard S3/S9 land in
  # daily-logger / morning-cockpit (per-slice repo: override, schema v1.1).
  - slug: rm-l1-dive-briefing
    northstar: l1-dive-briefing
    path: ../dive-briefing/.claude/roadmap.md
  - slug: rm-l1-switchboard
    northstar: l1-switchboard
    path: ../switchboard/.claude/roadmap.md
  - slug: rm-l1-virtuallight
    northstar: l1-virtuallight
    path: ../virtualLight/.claude/roadmap.md
  # geospatial track (2026-07-23): PH1-PH3 run on existing assets; PH4 slices are entrance-gated
  # on the mentor-corpus selfco synthesis. S11 lands in asset-foundry (per-slice repo:, v1.1).
  - slug: rm-l1-mirrorworld
    northstar: l1-mirrorworld
    path: ../mirrorworld/.claude/roadmap.md
  # f1-doctrine (2026-07-24): S0-S5 in 3 phases; S0 = design record (this session); S2 consumes/
  # re-ports dive-briefing's retriever; S5 learned suggester registered-not-built (fine-tune hold).
  - slug: rm-l1-f1-doctrine
    northstar: l1-f1-doctrine
    path: ../f1-doctrine/.claude/roadmap.md
---

# Northstar — three-tier vision tracking

A **northstar** is a project's compass: a vision paragraph plus a fixed set of named **properties**,
each with a target, a current completion %, and a verification. Daily work traces to a property;
movement is recorded, not asserted from memory. (Draft ADR: `draft-three-tier-northstar`.)

## The three tiers

| Tier | What | Where it lives |
|------|------|----------------|
| **L3** | the shared `ojfbot ⊕ selfco` apex (one) | `core/decisions/northstar/l3-shared.md` |
| **L2** | a venture: `ojfbot`, and (deferred) `selfco` | `core/decisions/northstar/l2-ojfbot.md` · `~/selfco/tracking/northstar-selfco.md` |
| **L1** | one per fleet app | `<app>/.claude/northstar.md` |

Each L1 ladders to an L2; each L2 ladders to L3. A property declares its parent via
`ladders_up_to: ns:<parent-slug>#P<n>`, which **must resolve to a real property on disk** (the
ADR-0087 `traces:` invariant) — `northstar-lint.mjs` enforces this.

**Why selfco's L2 lives in the vault, not here:** selfco is a separate Obsidian vault/repo with its
own lint scope. Its northstar is owned by selfco and kept in `tracking/` — *outside* `wiki/` — so it
never touches the wiki lint, exactly like `bases/`, `canvas/`, and `skill-dispositions.jsonl`. Core
references it by path; it is never mirrored into core.

## Schema

See `template.md`. Frontmatter scalars (`slug`, `tier`, `app?`, `ladders_up_to?`, `status`,
`properties[]`); per-property `{id, name, target, current(0–100), verification, ladders_up_to?,
okr_drivers?}`. Identity is the immutable `slug` (ADR-0087); property ids `P1…Pn` are assigned once
and never reused.

## Rollup & movement

- **Slice 1: rollup is hand-asserted** — each property's `current` is written by a human; the standup
  postflight records movement to `status.jsonl` (one line per change). `northstar-lint.mjs` runs in
  **shadow mode**, computing what each parent % *would* be from its children and reporting drift,
  without overwriting the hand-asserted value.
- **Later: computed rollup** (`northstar-rollup.mjs --write`) promotes parent % = aggregate(children),
  a data-gated shadow→authoritative step (ADR-0089 discipline).

### Promotions (RIDM log)

- **2026-07-06 — lint ERRORs promoted shadow → operational** (rm-l2-ojfbot#S16; the cluster's
  first shadow-gate promotion, exercising ADR-0086 clause 5 end-to-end). `roadmap-lint --check`
  + `northstar-lint --check` now run in core CI (`.github/workflows/northstar-lint.yml`) on PRs
  touching `decisions/northstar/**` and **block on ERRORs only**; WARNs (drift, staleness,
  missing `check:`) stay shadow. *Evidence:* both linters shipped shadow-only 2026-06 (ADR-0089
  idiom) and have run in the standup + the S13 weekly cadence since; across tranche 1
  (S10–S15, 6 merged PRs rewriting this roadmap) the ERROR classes were stable and produced 0
  false positives on main — every ERROR raised was a real registry/ladder lie (the one
  standing ERROR, `l1-cv-builder`, is a confirmed working-copy artifact tracked as S1).
  *Scoping:* registry entries whose repo checkout is absent from the running vantage (CI
  checks out core alone) downgrade to shadow WARNs, so the gate only blocks on breakage it
  can see. *Verification (ADR-0086 clause 6):* this gate VERIFIES structural invariants
  (refs resolve, enums valid, files exist); it does not validate that the roadmap is the
  right plan. *Rollback:* delete the workflow file; the linters revert to pure shadow.

## Time-series

`status.jsonl` (created on first movement) — append-only, one JSON line per movement:
`{"date","northstar","property","from","to","evidence","actor","source"}`. This is the
`Property #N: X% → Y%` record. Mirrors the `standup-telemetry.jsonl` pattern; not daily-logger, not
Dolt (a later slice replays it into `bead_events`).

## OKR relationship

Northstar = durable strategic vision; an OKR (`decisions/okr/YYYY-qN.md`) is a quarterly tactical bet
that *advances* a property. A property lists its `okr_drivers`; an Objective may carry an optional
`advances: ns:<slug>#P<n>`. They are distinct objects in one goal tree — northstar is the parent.
