---
type: wayfinder-map
slug: diagram-first-output
northstar: l2-ojfbot
tracker_issue: "#366"
status: working
---

# Wayfinder — diagram-first output

## Destination

Diagrams are a regular, mostly-automatic output of fleet work. Any substantive session leaves
behind a Mermaid diagram explaining what it built, committed beside the work; hooks make this
happen without being asked; a tldraw-based Diagram Playground fronts fleet diagrams as named
lineages with per-session snapshots (the course-video-manager pattern); and at chosen boundaries
the diagram is a gate, not decoration. Serves `ns:l2-ojfbot#P2` (every app's daily work traces to
a measurable property — work is legible): the initiative exists because the operator is regularly
overwhelmed by LLM output and cannot see what is being built.

## Notes

- **Research (2026-08-03).** Matt Pocock's diagramming is not a standalone tool: it is the
  **Diagram Playground** inside [mattpocock/course-video-manager](https://github.com/mattpocock/course-video-manager)
  (`app/features/diagrams/`) — a tldraw canvas where a *Diagram* is a named persistent lineage and
  a *DiagramSnapshot* is an immutable capture pinned to each Clip it was filmed against (their
  CONTEXT.md reserves "Scene" for tldraw's scene JSON). The durable pattern is
  **snapshot-per-unit-of-work lineage**. Caveat on record: Matt has publicly experimented with
  building diagrams in React instead of tldraw for speed and a consistent visual language
  ([tweet](https://x.com/mattpocockuk/status/1983942609891467605)).
- **Existing substrate.** `core/personal-knowledge/mermaid.md` (2026-08-02, gitignored): 7
  diagrams in the OPM/OJF-OPL idiom (OPL verb-labeled edges, embedded titles, captions,
  `securityLevel: strict`, `htmlLabels: false`) plus `mermaid-preview.html`, an ad-hoc render-test
  harness — effectively a one-off of what the convention + skill tickets systematize. `/opm`
  (ADR-0102) owns the formal OPL→Mermaid model in 7 repos. Fleet census: 43 mermaid fences in 4
  repos; zero in ADRs, beads, roadmaps, or READMEs. Artifacts render mermaid natively;
  `agent-anatomy` is a natural consumer repo.
- **Grilled 2026-08-03** (this map's charting session): Destination includes all four elements
  (standing skill · automatic · canvas surface · comprehension gate); **two-track** vs `/opm`;
  Mermaid = the canonical committed text layer; **Adobe Express** rejected as canonical layer,
  charted as downstream publish endpoint only.
- **Revised 2026-08-03 (same day, post-charting):** the operator initially ruled tldraw the core
  bet, then softened it — **the canvas UI is the requirement; tldraw is the leading candidate,
  not a marriage.** Matt Pocock's own diagram experiments (tldraw vs React) are tracked as
  evidence via a weekly watch that posts deltas as comments on the deep-research ticket; the
  spike weighs both directions.
- tldraw SDK licensing/watermark terms flagged for the research ticket.
- **Process note (2026-08-03):** #367 and #370 were both resolved in one session, operator present and
  deciding in-loop — a deliberate fast-track of the one-ticket-per-session cadence, not a drift.
- **Prototype evidence, 2026-08-08 — a hand-rolled SVG viewer carried 66 nodes (#368/#372).**
  `~/selfco/diagrams/fleet-navigator.html`, built beside the D5–D8 constellation refresh, is
  **~200 lines of vanilla JS building SVG DOM** with zero dependencies: static layout constants
  (cluster-box grid flow for tiers, polar layout for the constellation), `viewBox` pan/zoom, native
  SVG event delegation, and an invisible 16px twin line so thin edges are clickable. It carries ~66
  nodes and ~66 edges across two modes with node/edge popovers, a query bar (`cluster:`, `status:`,
  `kind:`, `tier:`, free text) that dims non-matches rather than removing them, and a chat hook.
  Integration cost into the cockpit is "one React component that renders SVG" (RFI response A8;
  audit §4). **What this is evidence for:** for a *viewer* over the Mermaid canon — the only thing
  `diagram-conventions.md` asks a canvas to be — no library was needed, and the no-new-deps posture
  held at 66 nodes. **What it is not evidence for:** editing. Nothing in the prototype creates,
  moves, or persists a shape, which is the entire reason tldraw was a candidate. So the honest
  scoping is: **tldraw remains a live research candidate for EDITABLE canvases only**, and #372's
  spike question narrows from "do we need a canvas library" to "what does an *authoring* surface
  need that hand-rolled SVG cannot give". Ratified 2026-08-11 as D3 — asymmetrically: the *spike*
  narrows, the *research* keeps its wide aperture. See Decisions.
- **The first fleet canvas ships as a viewer** — status, not a ruling. The cockpit's Fleet section
  renders the registry-generated D5 and its siblings while `~/selfco/diagrams/fleet-map.md` stays
  the canon. This was drafted as a decision ("D4") and **demoted to a note on 2026-08-11**:
  `diagram-conventions.md` already says canvas surfaces are *"viewers/editors over the canon, never
  the store"* — it permits editing and forbids only ownership — so "this one is read-only" describes
  what was built rather than constraining what gets built next. A Decisions section that fills with
  observations stops being where future work gets bounded, and a later session would have cited
  "D4" as a fleet prohibition on editable canvases that nobody actually ruled.

## Decisions so far

- Fleet convention = promoted mermaid.md idiom (OPM shapes, OPL verbs, title+caption, strict
  floor, ≤15 nodes) → `domain-knowledge/diagram-conventions.md` — What is the fleet diagram
  convention? (#367, PR #375)
- Tier-1 user-scoped `/diagram` skill; modes explain/orient/fleet; two-track boundary with /opm
  kept — /diagram skill design (#370, PR #375)

Operator ruling, 2026-08-11:

- **D3 — the canvas-library question splits in two, and the two halves get *opposite* treatment.**
  Viewing has a measured answer (hand-rolled SVG, no dependency — evidence in Notes). Editing does
  not. So:
  - **#372 (the spike) narrows, hard** — to "author a diagram on a canvas and round-trip it back to
    the Mermaid canon." A spike with a vague question burns build time producing something nobody
    can call pass or fail; the rendering half of its original question is already answered, so what
    is left is authoring and persistence.
  - **#368 (the research) keeps its wide aperture** — deliberately *not* re-scoped to "tldraw for
    editing." Its weekly watch exists to catch a mentor changing direction, and the tracked caveat
    is that Pocock has experimented with React-authored diagrams *instead of* tldraw. A ticket
    framed narrowly around tldraw would point the watch away from exactly the signal worth having.
  - **The asymmetry is the ruling.** Spikes want a narrow question; research wants a wide aperture.
    The earlier draft of this decision narrowed both, which would have been wrong on the research
    half.

  *Scope limit, recorded so this ruling cannot be over-cited:* the viewing answer rests on **one
  prototype, ~66 nodes, static generated layout, no persistence**. It does not establish that
  viewers never need a library. Untested at any scale: incremental re-layout, hit-testing past a
  few hundred nodes, text reflow, undo, selection groups, trackpad/touch gesture parity, focus
  management and a11y on a raw SVG DOM, and persistence of user-arranged view state. If a future
  viewer hits any of those, this ruling is evidence about the fleet-navigator prototype, not a
  standing prohibition on dependencies.

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| What is the fleet diagram convention? (#367) | grilling | — | closed |
| tldraw agent ecosystem deep-research (#368) | research | — | open — aperture kept wide (D3) |
| Where do diagrams live and when are they required? (#369) | grilling | — | open |
| /diagram skill design (#370) | grilling | — | closed |
| Automation design — diagrams without asking (#371) | grilling | — | open |
| Canvas playground spike (#372) | prototype | tldraw agent ecosystem deep-research | open — narrowed to authoring (D3) |
| Does an Adobe Express publish endpoint belong? (#373) | grilling | — | open |

## Not yet specified

- **Whether view and edit are actually separable** — the seam D3 assumes. The moment a canvas
  wants "drag a node, keep the position", it is editing, and a hand-rolled viewer has no
  persistence model, no undo, and no conflict story. This Destination's own target — named
  persistent lineages with per-session snapshots — is a *persistence-and-lineage* problem that
  neither "viewer" nor "editor" cleanly owns. Flagged at ratification 2026-08-11 as the way D3
  could turn out to have frozen the wrong seam; #372's round-trip spike is what would surface it.
- Staleness lint for committed diagrams (an opm-lint analog for the lightweight track).
- Snapshot-lineage ↔ bead mapping — is a bead the "Clip" a DiagramSnapshot pins to?
- Diagrams feeding daily-logger articles.
- Comprehension-gate ↔ `/merge-quiz` relationship (graduates once Where-do-diagrams-live closes).
- ICOM extension to the convention — drawing IDEF0 Controls (constraints governing a process:
  rulings, ADR rows, charting rules) and Mechanisms (skills/agents performing it) distinctly from
  consumed Inputs; operator-endorsed candidate 2026-08-03, from the SE-pattern learning note on
  teach-in-the-loop PR #387.

## Out of scope

- Replacing `/opm` — ruled two-track by the operator, 2026-08-03.
- Mermaid-only initiative (no interactive surface) — ruled out by the operator (canvas surface required), 2026-08-03.
- Adobe Express as the canonical diagram store — ruled out by the operator, 2026-08-03.
