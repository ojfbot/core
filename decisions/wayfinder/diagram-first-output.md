---
type: wayfinder-map
slug: diagram-first-output
northstar: l2-ojfbot
tracker_issue: "#366"
status: charting
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
  ([tweet](https://x.com/mattpocockuk/status/1983942609891467605)); the operator ruled tldraw the
  core bet regardless.
- **Existing substrate.** `core/personal-knowledge/mermaid.md` (2026-08-02, gitignored): 7
  diagrams in the OPM/OJF-OPL idiom (OPL verb-labeled edges, embedded titles, captions,
  `securityLevel: strict`, `htmlLabels: false`) plus `mermaid-preview.html`, an ad-hoc render-test
  harness — effectively a one-off of what the convention + skill tickets systematize. `/opm`
  (ADR-0102) owns the formal OPL→Mermaid model in 7 repos. Fleet census: 43 mermaid fences in 4
  repos; zero in ADRs, beads, roadmaps, or READMEs. Artifacts render mermaid natively;
  `agent-anatomy` is a natural consumer repo.
- **Grilled 2026-08-03** (this map's charting session): Destination includes all four elements
  (standing skill · automatic · tldraw surface · comprehension gate); **two-track** vs `/opm`;
  **tldraw = core bet** for the surface with Mermaid as the canonical committed text layer;
  **Adobe Express** rejected as canonical layer, charted as downstream publish endpoint only.
- tldraw SDK licensing/watermark terms flagged for the research ticket.

## Decisions so far

_None yet — charting session closes zero tickets._

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| What is the fleet diagram convention? (#367) | grilling | — | open |
| tldraw agent ecosystem deep-research (#368) | research | — | open |
| Where do diagrams live and when are they required? (#369) | grilling | What is the fleet diagram convention? | open |
| /diagram skill design (#370) | grilling | What is the fleet diagram convention? | open |
| Automation design — diagrams without asking (#371) | grilling | /diagram skill design | open |
| tldraw Diagram Playground spike (#372) | prototype | tldraw agent ecosystem deep-research | open |
| Does an Adobe Express publish endpoint belong? (#373) | grilling | What is the fleet diagram convention?, /diagram skill design | open |

## Not yet specified

- Staleness lint for committed diagrams (an opm-lint analog for the lightweight track).
- Snapshot-lineage ↔ bead mapping — is a bead the "Clip" a DiagramSnapshot pins to?
- Diagrams feeding daily-logger articles.
- Comprehension-gate ↔ `/merge-quiz` relationship (graduates once Where-do-diagrams-live closes).

## Out of scope

- Replacing `/opm` — ruled two-track by the operator, 2026-08-03.
- Mermaid-only initiative (no interactive surface) — ruled out by the operator (tldraw core bet), 2026-08-03.
- Adobe Express as the canonical diagram store — ruled out by the operator, 2026-08-03.
