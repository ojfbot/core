# Schema evolution log

The running record of schema *pressure* surfaced by the roadtrip — the framework hardening that is the
offsite's actual product (the northstars are the deliverable; the line that builds them is the asset).
Each entry: what pressure, from which leg, and its disposition — `logged` (recorded, not built),
`designed` (spec'd, build deferred), or `built` (in `schema.md` + enforced/shadow). Discipline:
build-on-evidence, never build-on-imagination.

---

## [SCHEMA ITERATION 1] — `LADDER_STRESS` kickback channel · BUILT (relay-channel, shadow)
- **Pressure:** the roadtrip stress-tests the L2 parent; without a mandatory fit signal, a forced-fit
  property passes silently ("absence masquerading as confirmation").
- **From:** framework design, pre-leg-1 (chat).
- **Disposition:** built into the Contract + `schema.md` (Kickback section). Per-parent verdict
  `clean|strain|break`, mandatory, reason required unless clean. **Semantic judgment is chat's**; the
  linter only enforces presence/well-formedness at land + emits structural hints. Gate: 1 break or N
  strains (N≈3, calibratable) against the *same* parent freezes the roadtrip.

## [SCHEMA ITERATION 2] — parent revision / `@v2` re-validation · LOGGED (deferred)
- **Pressure:** if a parent property is found wrong (via the gate), it must be revised without silently
  re-pointing every child that keeps its `ns:<slug>#Pn` ref.
- **From:** framework design (chat proposed building it now).
- **Disposition:** **logged, not built.** Zero observed defects; building the revision machine ahead of a
  real break is build-on-imagination. The freeze is the *trigger to design* v2, shaped by the actual
  defect. Revisit when the kickback gate first trips.

## [SCHEMA ITERATION 3] — third L2 parent property · LOGGED (deferred)
- **Pressure:** apps may have axes that fit neither `l2#P1` (delivery) nor `l2#P2` (legibility).
- **From:** framework design.
- **Disposition:** **logged, not built.** No confirmed `break` yet. A third parent is the kind of change
  the kickback gate exists to justify — wait for the evidence.

## [SCHEMA ITERATION 4] — `depends_on` horizontal peer edge · BUILT (resolve-check real; cap shadow) — v1.1
- **Pressure:** f1-substrate and f1-pit-wall are mutually defining — pit-wall's "never render an
  unsupported number" is meaningless except relative to substrate's "truth-or-NULL." The pair can't be
  authored without recording the edge. **First instance is blocking the current leg**, so this clears the
  build-on-evidence bar that `@v2` and the third parent did not.
- **From:** leg 1 (f1 pair), chat.
- **Disposition:** **built** as an optional per-property field (v1.1). Linter owns the *syntactic* half
  (resolve-or-fail) — the division of labor that failed for `LADDER_STRESS` genuinely holds here.
  **The cap (`current(dependent) ≤ current(dependency)`) is SHADOW, not a hard block** — Code's correction:
  hand-asserted numbers across non-commensurable axes (substrate's correctness-vs-coverage ≠ pit-wall's
  render-guarantee) must not hard-fail a land. Reported as a "dependency inversion" warning; hard
  enforcement is a later data-gated promotion. **Lint code lands when the pair lands** (a real instance to
  verify against), not before.

---
_Next pressures land here as legs surface them._

## [SCHEMA ITERATION 5] — semver pins on refs (`ns:<slug>@<semver>#P<n>`) · DESIGNED (Frame leg)
- **Pressure:** the `@v2` re-point concern (ITERATION 2) needs a non-silent mechanism; the Frame leg's
  CONFIRMED block pinned every ref `@0.1.0` (pre-1.0 = free to break; a child pinned against a
  MAJOR-bumped target is flagged for re-validation).
- **From:** leg 5 (Frame), chat — FRAMEWORK FLAGS in the confirmed block.
- **Disposition:** **designed, not built.** Landed files strip the pins (schema v1.1 has no pin
  syntax; the lint index would fail to resolve them); pins are recorded here + in the relay. Build
  when the first re-validation event actually occurs.

## [SCHEMA ITERATION 6] — cluster tier (`ns:cluster-<name>@<semver>#P<n>`) · DESIGNED (Frame leg)
- **Pressure:** shell P4 (runtime cluster management) and the F1 stack want the cluster as a unit;
  an optional rung between L1 and L2 (apps may ladder to a cluster property OR directly to L2).
- **From:** leg 5 (Frame), chat.
- **Disposition:** **designed, not built.** Evidence gates: leg 3's golf cluster (is it one app or
  a cluster?) and any leg that needs a cluster ref in an actual `ladders_up_to`/`depends_on`.

## [PRESSURE COUNTER] — L2-P1 widening: 2 of 3
- "Ships demoable **Frame OS** surfaces" strains against standalone-instance surfaces.
  Instances: (1) f1-substrate leg 1; (2) shell leg 5 (landed 2026-07-02, 3 property verdicts share
  the one strain). Candidate 3rd: the `landing` card (leg 5, briefed 2026-07-02 — flagged in-card).
  At 3, the roadtrip freezes for a deliberate parent-revision session (never hot-patched mid-leg).

## [ITERATION 6 UPDATE] — cluster tier: EVIDENCE GATE TRIPPED (GameWorld, 2026-07-02)
- **Pressure became real:** James declared the **GameWorld cluster** pre-drive — an agentic/
  multi-agent game-development cluster (rendered environments, game-state management, engine
  interactions, playtester-chat feedback loop with real-time changes in some modes) spanning
  lofi-beaver, beaverGame (CozyBeaver), asset-foundry, foundry-recipes, and CarrierPigeon (new,
  pre-code). This is the first genuine cluster instance — not the golf repo-split hypothesis.
- **Disposition:** still **not hot-built mid-trip.** The Leg-4 voice conversation authors the
  cluster's vision + candidate properties as a CONFIRMED block (`app: gameworld`, `tier: cluster
  (pending schema build)`); per-app L1s ladder to L2 with intended cluster refs named in
  SYNTHESIS only. Building `ns:cluster-<name>#P<n>` into schema/lint/loaders is now a justified
  post-drive slice (candidate home: rm-l2-ojfbot). Shell's P4 (runtime cluster management) is the
  consumer-side pull for the same tier.

## [ITINERARY DECISIONS] — 2026-07-02 pre-drive (James)
- **jocdive-sdi-mcp → RETIRED**, folded into buddy-check's roadmap (SDI portal access becomes a
  buddy-check data-source concern; session-persistence auth pattern noted as reusable).
- **dms-core → ARCHIVED (temporary)** — membership inactive; reactivation re-enters as queued.
- Leg 3 is now golf-only; Leg 4 is the GameWorld cluster leg (cluster card runs first).

## [AUDIT FINDING] — the f1 `depends_on` edge is schema-doc-only (2026-07-02)
- **Observed:** `depends_on` exists in schema.md (v1.1) but (a) f1-pit-wall's on-disk northstar
  carries NO depends_on field, and (b) `northstar-lint.mjs` never received the resolve-check —
  ITERATION 4 said "lint code lands when the pair lands"; the pair landed, the lint didn't.
- **Disposition:** retrofit both (the pit-wall edge + the lint check) inside the cluster-tier
  build slice, alongside cluster node syntax/loader/lint, `cluster-f1` (pre-drafted card 11b,
  quick-confirm in voice), and `cluster-gameworld`. One slice, four artifacts, all evidence-backed.
