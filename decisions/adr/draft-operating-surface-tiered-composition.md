# ADR-XXXX: Operating surface with tiered composition
slug: operating-surface-tiered-composition
serial: draft
rev:
Date: 2026-07-23
Status: Proposed
domain: shell-host-composition
type: architecture
OKR:
Commands affected: /frame-standup, /scaffold-frame-app, /fleet-onboard, /day-run
Repos affected: shell, core, all fleet apps
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [bonded-pair-division-of-labor, headless-components-with-design-language-adapters]
  parent:
  part-of-series:

---

## Context

The original vision was an operating surface: a GUI with chat/CLI baked in, switching between
named instances of agentic apps, plus a launchpad for describing new agentic apps assembled from
reusable components. Phase 0 made in-process Module Federation (shared React/Carbon/Redux
singletons) the de-facto membership rule for that surface. The conformance bar proved too high:
of 15 registered L1 northstars, only 3 are MF remotes, and every recent flagship
(silicon-empires, morning-cockpit, the F1 stack, mirrorworld, beaverGame) declined the bar and
was built outside the switcher. The vision stalled not because it was forgotten — the App →
Instance → Thread model, AppSwitcher, and NL instance spawning are all in canon — but because
its membership rule excluded its best members. The fleet also lacked vocabulary for two
distinctions the registry now needs: apps vs foundational layers, and singleton vs multi-instance
apps.

## Decision

Membership in the operating surface becomes tiered, and the registry gains a taxonomy:

- **Tier A — in-process composition** (Module Federation, shared singletons): retained as a
  *technique* for use-cases that need shared in-process state; no longer the membership rule.
- **Tier B — process federation**: the default membership. Any-stack apps that the surface can
  launch, front, and talk to via the registry and chat protocol.
- **Tier C — operational spine**: the durable context substrate (beads, registry, roadmap
  slices, instance/thread records) both tiers rest on. See `adr:bonded-pair-division-of-labor`.
- **Registry taxonomy**: every entry declares `role: app | substrate`, and apps declare
  `tier`, `cardinality: singleton | multi-instance`, and `built_on: [<substrate>...]`.
  Substrates (mirrorworld, asset-foundry, f1-substrate, switchboard, core) deliver
  assets/data/engine interactions, never appear in the switcher, and may ship a thin operator
  console app without becoming switcher citizens. Roles are not exclusive.

"Game switcher" generalizes to category-agnostic instance switching; "Frame OS" remains the name
of the Tier-A cluster and its demo track, not the fleet identity.

## Consequences

### Gains
- The switcher can span the whole fleet: F1 pit wall, geospatial apps on mirrorworld, games,
  cockpit — without stack conformance.
- The launchpad's "reusable components" gets a precise referent: substrates + headless
  components + composable skills.
- Cardinality and `built_on` make the App → Instance model and the substrate pattern
  (mirrorworld:fairway :: f1-substrate:pit-wall :: asset-foundry:beaverGame) explicit and
  machine-checkable.

### Costs
- L2 P1 ("the fleet ships demoable Frame OS surfaces") must be reworded — a northstar revision
  with its own ceremony.
- Launcher registrations / northstar registry schema migration (`role`, `tier`, `cardinality`,
  `built_on`).
- Phase 4 NL instance spawning re-targets the registry rather than MF internals.

### Neutral
- Existing MF remotes continue unchanged as Tier A members.
- The TBC-pitch demo track keeps in-process composition as its showcase technique.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep MF as the membership rule | Empirically failed: every recent flagship declined it; vision stalled at 9 conforming apps |
| Pure loose federation (drop Tier A) | Some use-cases genuinely need shared in-process state; demo track loses its showcase |
| Treat substrates as apps | Flattens the taxonomy; switcher would list non-switchable layers; `built_on` inexpressible |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-07-23 operating-surface alignment grill (/grill-with-docs session) |
| Implementation start | _pending_ |
| Implementation end | _pending_ |
