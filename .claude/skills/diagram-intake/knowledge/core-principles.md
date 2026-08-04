# Core principles

The interpretation posture for `/diagram-intake`. Load before parsing the image.

1. **Map before interpreting** — identify app labels in the diagram first,
   resolve them to canonical repo names using `context-map.md`,
   then interpret goals within each app's context.
2. **Cross-reference, don't assume** — every goal should be checked against
   the app's roadmap phase and known blockers from its architecture doc.
3. **Preserve the human's framing** — the diagram represents JFO's mental
   model. Don't rewrite goals into engineering jargon unless the mapping is
   obvious. Preserve intent and phrasing.
4. **Category goals are real** — if the diagram shows cross-cutting themes
   (arrows connecting apps, circled groups, top-level labels), capture them
   as category goals that affect multiple repos.
