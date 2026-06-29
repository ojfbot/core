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
