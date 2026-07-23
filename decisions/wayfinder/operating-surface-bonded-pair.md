---
type: wayfinder-map
slug: operating-surface-bonded-pair
northstar: l2-ojfbot
tracker_issue: "#272"
status: working
---

# Wayfinder — operating surface over the bonded pair

## Destination

The fleet's original vision, de-fogged and re-anchored: a **GUI with chat/CLI baked in** that
switches between named instances of agentic apps across composition tiers (A in-process, B
process-federation, any stack), and a **launchpad** where describing a new agentic app assembles
it from three shelves — substrates, headless components, composable skills. It rests on the
**operational spine** (work objects: beads, registry, slices, instances) and reads the **selfco
reference layer** (understanding objects: lenses, entity pages, syntheses) at design time only,
with the **estate layer** (devices, endpoints, capture surfaces) inventoried and drift-linted
underneath. Arrived means: any registered app — pit-wall, a mirrorworld-built geospatial app, a
game, cockpit — can be launched, fronted, and talked to from one surface; instances respect
declared cardinality; and the surface can be reskinned across design languages en route to a
native design system. Serves `ns:l2-ojfbot#P1` (demoable surfaces — wording under revision via
this map) and `ns:l2-ojfbot#P2` (work traces to measurable properties — extended to the estate).

## Notes

- Charted 2026-07-23 from the operating-surface alignment grill (same session).
- Three draft ADRs staged and committed with this map: `adr:operating-surface-tiered-composition`,
  `adr:bonded-pair-division-of-labor`, `adr:headless-components-with-design-language-adapters`.
  CONTEXT.md and GLOSSARY.md carry the proposed vocabulary.
- The estate posture is resolved (inventory-first, shadow-first) but its ADR is staged by the
  estate-charter ticket, keeping this session at the 3-stub cap.
- Vault instrument: the selfco `precedent-survey-methodology` corpus (lens pages + synthesis
  recipes, e.g. `honest-but-loud-about-it`) is the design-judgment source for the native system.
- Frame OS remains the name of the Tier-A cluster. **Demo-track targeting (TBC pitch, Track A/B,
  hero demo) retired by Yuri 2026-07-23** — `frame-os-context.md`'s framing is out of date; doc
  surgery rides with the L2 P1 rewording.

## Decisions so far

Grill-resolved before charting (recorded here as pre-map decisions, not closed tickets):

- Tiered composition; registry taxonomy role/tier/cardinality/built_on — → adr:operating-surface-tiered-composition
- Spine/vault split: work objects vs understanding objects, one-way curated seams — → adr:bonded-pair-division-of-labor
- Headless contract + design-language adapters converging on a native system — → adr:headless-components-with-design-language-adapters
- Estate posture: inventory-first, shadow-first, per-endpoint promotion — ADR staged by the estate-charter ticket

Closed tickets:

- The surface is named **Arcade** (Benjamin's *Arcades Project* register: one passage, many worlds; the operator as flâneur) — name the operating surface (#273)
- Demo-track targeting retired (TBC pitch, Track A/B, hero demo no longer goals) — ruled by Yuri in the #273 session, 2026-07-23
- Headless contract precedent verified (statechart core + connect/anatomy seam + data-part/data-state hooks + DTCG·Material token layering; functional-vs-design-language style split mandatory) — headless component contract precedent survey (#276) → decisions/research/2026-07-23-headless-component-contract-survey.md

## Tickets

| Ticket (refer by name) | Type | Blocked by | Status |
|------------------------|------|------------|--------|
| name the operating surface — successor framing for "Frame OS" (#273) | grilling | — | closed |
| reword L2 P1 venue-neutral — demoable surfaces beyond Frame (#274) | grilling | name the operating surface | open |
| registry schema home for role/tier/cardinality/built_on (#275) | grilling | — | open |
| headless component contract precedent survey (#276) | research | — | closed |
| frame-ui-components headless refactor path (#277) | grilling | precedent survey | open |
| native design system bootstrap strategy (#278) | grilling | precedent survey; refactor path | open |
| estate layer charter — repo home, endpoint schema, first TPMs (#279) | grilling | — | open |
| launchpad mechanism — describe, scaffold, register, appear (#280) | grilling | registry schema home | open |
| tier B talk seam — the launch/front/talk protocol contract (#281) | grilling | — | open |

## Not yet specified

- Arcade's home — evolution of `shell` vs its own repo; statable after the tier B talk seam
  (#281) and L2 P1 rewording (#274) settle what Arcade must be.
- Multi-user identity model (other humans, shared estates) — question not precisely statable
  until a concrete second-user scenario exists.
- Tier A admission criteria — when does an app *need* shared in-process state; statable only
  after the tier B talk seam is defined (contrast makes the criterion).
- Reskin demo scope — which surface, which three languages, judged when the headless refactor
  path is decided.
- Estate enforcement promotion gates — per-endpoint RIDM criteria; statable after the charter
  ticket fixes the inventory schema and first TPMs.

## Out of scope

- selfco as live runtime backend — ruled out by Yuri 2026-07-23 (adr:bonded-pair-division-of-labor).
- Module Federation as the operating-surface membership rule — ruled out by Yuri 2026-07-23
  (adr:operating-surface-tiered-composition); Tier A survives as a technique.
- Renaming the `shell-host-composition` ADR domain vocab — deferred deliberately; controlled
  vocabulary churn is not worth it until the successor name (#273) lands.
