---
name: diagram
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "diagram", "diagram this", "draw the
  architecture", "diagram what we built", "explain with a diagram", "show me a diagram",
  "fleet map", "draw the fleet", "I don't understand what I'm building", "map what this session
  did". Lightweight Mermaid explainer diagrams per domain-knowledge/diagram-conventions.md.
  Three modes: explain (default — diagram what this session/branch built), orient <target>
  (what a repo/module IS and how data flows through it), fleet (altitude view over northstars,
  roadmaps, and wayfinder frontiers). Output: 1–3 small captioned diagrams placed beside the
  work. Distinct from /opm (formal committed system model, opm/system.opl) and /doc-refactor
  (docs normalization) — /diagram is the fast comprehension layer.
---

# /diagram

The fleet's comprehension layer: small, captioned Mermaid diagrams that explain work while it is
happening, so the operator never has to hold a session's output in their head as prose. Serves
`ns:l2-ojfbot#P2` (work is legible). Born from the wayfinder map
`decisions/wayfinder/diagram-first-output.md`.

**Input:** $ARGUMENTS — optional mode (`explain` | `orient <target>` | `fleet`) plus a focus hint.
No mode given: `explain` if the session has built something, else `orient` on the cwd repo.

**Tier:** 1 — Lightweight
**Phase:** continuous (not phase-locked)

## Core principles

1. **Conventions are law.** Read `domain-knowledge/diagram-conventions.md` (core, or via the
   installed copy) and follow it: OPM shapes (objects = rectangles, processes = stadiums), OPL
   verb-labeled edges, embedded `title:`, prose `**Caption:**` before every fence, plain-text
   labels (`htmlLabels: false` floor), ≤ ~15 nodes per diagram.
2. **Trace real edges.** Every arrow corresponds to something you verified in the diff, the code,
   or the registry — an import, a call, a data hand-off, a declared `ladders_up_to`. No invented
   architecture. If you didn't look, don't draw it.
3. **Comprehension over completeness.** 1–3 diagrams per invocation. The caption carries the
   detail; the diagram carries the shape. If the territory needs more, say what you left out.
4. **Two-track boundary.** If the user wants a durable, lintable model of a repo's system,
   hand off to `/opm` — never hand-maintain a parallel formal model here.
5. **Diagrams land beside the work.** A diagram that lives nowhere is decoration.
6. **Always deliver rendered.** Chat shows fences as code — end every invocation by rendering
   the SVG(s) locally (`pnpm dlx @mermaid-js/mermaid-cli`, which doubles as the parse check),
   then assembling them into **one self-contained HTML page**: each SVG inlined into a styled
   card with its title and prose caption, dark-mode-aware (`prefers-color-scheme`), no external
   assets. Send that HTML page to the user's side panel — not the bare SVGs, which render as
   raw attachments in file delivery (operator-verified 2026-08-08). Never make the operator
   read raw Mermaid.
7. **Obsidian is the norm for standing diagrams.** Operator-facing mental-model diagrams also
   land in the vault at `~/selfco/diagrams/` (Obsidian renders Mermaid natively). Outside
   `wiki/`, same as `bases/` and `canvas/`, so the wiki lint invariant is never touched.
   Session-delta explainers skip this unless the operator asks; standing files (fleet maps,
   repo orientations) default to it.

## Modes

> **Load `knowledge/mode-procedures.md`** after picking the mode — the full per-mode procedure for `explain`, `orient <target>`, and `fleet` (steps, placement options, and the fleet-mode personal-knowledge placement rule).

## Gotchas

- **The tempting failure is the mural** — one 40-node diagram nobody can read. Split it.
- **Freeform verbs drift.** Two diagrams are only comparable if edges speak the same verb set;
  reach for consumes/yields/requires/handles/affects before inventing a label.
- **Don't re-diagram the unchanged.** In `explain` mode the delta is the subject; redrawing the
  whole system hides what happened (and `/opm` already owns the whole system).
- **Render floor is strict.** No HTML labels beyond `<br/>`, no theme-dependent tricks — the
  diagram must survive GitHub, Obsidian, and Artifacts unchanged.
