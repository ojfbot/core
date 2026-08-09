# diagram-conventions.md — the fleet diagram idiom

The shared visual language for every diagram the fleet emits, whatever produced it. Both tracks
follow it: `/opm` renders (the formal committed system model, ADR opm-inspectability-layer) and
`/diagram` explainers (lightweight "what did this session build / what is this repo" diagrams).
Promoted from the idiom established in `personal-knowledge/mermaid.md` (2026-08-02) by wayfinder
ticket *What is the fleet diagram convention?* (map `decisions/wayfinder/diagram-first-output.md`).

## Format

- **Mermaid is the canonical committed format.** Text-native, git-diffable, renders on GitHub,
  Obsidian, and Claude Artifacts without tooling. Canvas surfaces (tldraw or otherwise — see the
  wayfinder map) are viewers/editors over the canon, never the store.
- **Compatibility floor:** Mermaid v10/v11 with `securityLevel: 'strict'` and
  `flowchart.htmlLabels: false`. Plain-text labels only; `<br/>` is the one permitted tag. No
  other HTML, no CSS classes that require loose security.

## Shape idiom (OPM-derived)

- **Objects** are rectangles: `OBJ["Corpus pack"]`.
- **Processes** are stadiums: `Proc(["Publishing"])`.
- **States** live inside the object's label, not as separate nodes.
- **Edge labels** draw from the OPL verb set when modeling a system: `consumes`, `yields`,
  `requires`, `handles`, `affects`. Ad-hoc explainers may use freeform labels, but reach for the
  verb set first — a shared verb set is what makes two diagrams comparable.
- Dotted edges (`-.->`)  mean "claimed/partial/never" relationships; say which in the caption.

## Every diagram carries

1. An embedded **`title:`** in the fence's YAML frontmatter — the rendered SVG is self-titled
   wherever it travels.
2. A prose **`**Caption:**`** paragraph immediately before the fence. Node labels stay terse;
   **the caption carries the detail**. A diagram whose meaning needs the surrounding doc is fine;
   a diagram whose meaning needs the author is not.
3. A scope small enough to comprehend: **≤ ~15 nodes**. Two small diagrams beat one mural.

## Placement

- Diagrams live **beside the work they explain**: an ADR body, a PR description, a bead, or
  `docs/diagrams/<slug>.md` in the owning repo.
- Career/strategy lenses (job targets, revenue framing) go to `core/personal-knowledge/`
  (gitignored) — never public git.
- A repo's durable, lintable system model is `/opm`'s job (`opm/system.opl` → rendered
  `opm/system.md`); don't hand-maintain a parallel formal model with `/diagram`.

## Update discipline

- Standing diagram files **append** new diagrams; corrections edit in place with a dated note.
- Verification today is the preview-harness pattern (`personal-knowledge/mermaid-preview.html`:
  `mermaid.parse()` + render per fence, pass/fail badges). A fleet staleness/render lint is
  charted fog on the wayfinder map — do not assume it exists.
