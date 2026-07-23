# ADR-XXXX: Headless components with design-language adapters
slug: headless-components-with-design-language-adapters
serial: draft
rev:
Date: 2026-07-23
Status: Proposed
domain: ui-components
type: architecture
OKR:
Commands affected: /scaffold-frame-app, /screenshot-audit, /prototype
Repos affected: frame-ui-components, shell, all surface apps
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [operating-surface-tiered-composition]
  parent:
  part-of-series:

---

## Context

Fleet-wide Carbon uniformity (the MF shared-singleton mandate plus ADR-0030's shared component
library) delivered consistency but proved needlessly restrictive: per-app identity is accidental
rather than deliberate, and non-React/any-stack Tier B apps cannot participate at all. Two
ambitions coexist: (1) demonstrating design-engineering range by rapidly reskinning the same
surface across major design languages (IBM Carbon / Apple HIG / Google Material), and (2)
converging on a native, own design system with full enterprise maturity (tokens, a11y,
documentation, versioning, testing), derived from the selfco precedent-survey lens corpus
(Rams, Sachs, Lois, Rand, Neistat, Koolhaas — dialable axes with synthesis recipes) and matured
through agentic test/refine loops. Honest constraint: reskinning across design languages only
reads as authentic if the shared layer is headless — behavior, anatomy, and neutral tokens
defined system-neutrally — because component idioms differ across systems; token-swapping alone
under-delivers.

## Decision

The shared UI layer becomes a **headless contract** (behavior + anatomy + neutral tokens), with
**design-language adapters** (Carbon, HIG, Material) as swappable skins, converging on a
**native design system** as the house identity. The native system is derived from the selfco
lens corpus (apps may declare per-app lens-dial profiles) and is developed with the fleet's
existing agentic quality loops: visual-regression CI, /screenshot-audit classification, and
/prototype N-variants-by-URL-param exploration. Carbon becomes the Tier-A cluster's current
adapter, not a fleet mandate.

## Consequences

### Gains
- Per-app identity becomes deliberate and recorded (lens-dial profiles) instead of accidental.
- The reskin demo becomes a first-class portfolio artifact for the design-engineer story.
- Tier B any-stack apps can adopt the house identity via tokens/idioms without adopting React.
- The design system itself becomes an agentic-loop showcase: components tested and refined by
  the same machinery that tests the fleet's code.

### Costs
- frame-ui-components must refactor toward the headless contract or be superseded — a real
  migration for 9 consuming apps.
- Building enterprise maturity (a11y, docs, versioning, testing) for a native system is a
  long-haul effort; the adapters multiply the test matrix.
- True cross-system reskinning requires per-system component skins, not just token swaps.

### Neutral
- Existing Carbon surfaces keep working unchanged as adapter consumers.
- The selfco lens corpus gains a consumer but is not modified by this decision.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep Carbon as fleet mandate | Restrictive; identity accidental; excludes Tier B stacks; weak portfolio story |
| Theming/token swap only | Doesn't read as Apple vs Google vs IBM; component idioms differ; demo under-delivers |
| Jump straight to native system, no adapters | Loses the range demonstration; no migration bridge for existing Carbon surfaces |

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-07-23 operating-surface alignment grill (/grill-with-docs session) |
| Implementation start | _pending_ |
| Implementation end | _pending_ |
