---
name: deepen
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "deepen", "improve
  codebase architecture", "find shallow modules", "reduce module sprawl",
  "consolidate utilities", "audit module depth". Ousterhout-style depth
  analysis. No code edits — proposals only.
---

# /deepen — Module-depth audit

**Status: scaffold — full implementation lands in Phase 3 of the Pocock skills foundation work (see plan file at `/Users/yuri/.claude/plans/with-a-browser-agent-compressed-castle.md` and ADR-0047 once written).**

For now, when invoked: tell the user this skill is scaffolded and recommend running `/recon` or `/sweep` for the closest existing analysis.

## Principle (preview)

Depth = (interface simplicity × implementation richness). Shallow modules — many tiny files with thin public surface — increase cognitive load. Few deep modules with simple stable APIs and rich internal implementations are easier to understand, test, and change.

When the full skill ships, it will measure depth via `scripts/measure-depth.mjs` and propose refactor candidates with cost/benefit per move.

## Constraints

- Read-only by default. `--apply` flag will require explicit user approval and route through `/scaffold` or manual edits.
- ADR required for any consolidation crossing package boundaries.

---

$ARGUMENTS
