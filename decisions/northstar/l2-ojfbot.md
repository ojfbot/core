---
type: northstar
slug: l2-ojfbot
tier: L2
ladders_up_to: l3-shared
status: active
properties:
  - id: P1
    name: "The fleet ships usable surfaces"
    target: "Each active app reaches a usable surface in its natural venue and is past scaffold — value shown where the app lives, not gated on one cross-domain hero demo."
    current: 55
    verification: "A recorded session per active app in its natural venue (cockpit dashboard, pit-wall telemetry, dive-briefing Q&A, shell composition, …); each is past scaffold."
    ladders_up_to: "ns:l3-shared#P1"
  - id: P2
    name: "Every app's daily work traces to a measurable property"
    target: "100% of active fleet apps have a northstar; the daily standup frames each priority against a property; movement is recorded as a time-series, not asserted from memory."
    current: 30
    verification: "northstar-lint: every tracked repo has a northstar that ladders here; standup output cites ns:<slug>#P refs; status.jsonl accrues movement lines."
    ladders_up_to: "ns:l3-shared#P2"
  - id: P3
    name: "The Arcade fronts the fleet"
    target: "The Arcade surface can launch, front, and talk to registered apps across both composition tiers; ≥5 apps reachable from one surface with declared cardinality respected."
    current: 10
    verification: "Arcade launches, fronts, and talks to ≥5 registered apps spanning Tier A and Tier B from a single surface; instances respect declared cardinality."
    ladders_up_to: "ns:l3-shared#P1"
---

# Northstar — ojfbot (L2)

**Vision.** ojfbot is the dev platform and app fleet that turns daily agentic work into shipped
product. It advances the shared apex by shipping usable surfaces (P1), fronting them through the
**Arcade** operating surface (P3), and making its own fleet-wide work legible (P2) — the local
instance of the cluster-wide "work is self-measuring" bet.

> Revised 2026-07-23 (wayfinder #274): venue-neutral rewording; demo-track targeting retired
> (#273). "Frame OS" now names the Tier-A (in-process) cluster only, not the whole fleet.

## P1 — The fleet ships usable surfaces

Ladders to `ns:l3-shared#P1` (a working product cluster). Rolls up from the L1 per-app northstars:
each app's delivery property feeds this. Value is shown where each app actually lives — a recorded
session in its natural venue — not gated on one cross-domain hero demo. Most active fleet apps
ladder here; selfco-venture surfaces ladder to `l2-selfco` instead.

## P2 — Every app's daily work traces to a measurable property

Ladders to `ns:l3-shared#P2` (work is legible). This is the property the three-tier-northstar +
session-provenance work advances directly: standup framing, per-app northstars, recorded movement.

## P3 — The Arcade fronts the fleet

Ladders to `ns:l3-shared#P1` (a working product cluster). Tracks the **Arcade** operating surface —
the GUI-with-chat/CLI-baked-in that launches, fronts, and talks to registered apps across both
composition tiers (A in-process, B process-federation). Baseline credits shell's existing Tier-A
switcher; arrival is ≥5 apps reachable from one surface with declared cardinality respected. See the
wayfinder map `decisions/wayfinder/operating-surface-bonded-pair.md` (#272).
