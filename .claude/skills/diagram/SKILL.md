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

## Modes

### `explain` (default) — what did this session/branch build?

1. Establish what changed: `git diff` / `git log` against the base branch, plus conversation
   context. New files, new edges, changed flows.
2. Draw the delta: what now exists that didn't, and how it connects to what already existed.
   Distinguish pre-existing nodes from new ones (e.g. new nodes carry `*` in the label, or a
   subgraph "new this session" — say which convention you used in the caption).
3. Place it — ask the user which (default: inline in conversation, then their pick):
   - the PR description (edit via `gh pr edit`),
   - the ADR body being drafted,
   - the session's bead,
   - `docs/diagrams/<slug>.md` in the repo (committed).

### `orient <target>` — what IS this repo/module?

1. Read entry points, package layout, key data flows (reuse `/recon`-grade evidence gathering,
   scaled down; check `domain-knowledge/CONTEXT.md` for the repo's own vocabulary).
2. Draw at most: one structure diagram (what contains what), one flow diagram (how the main
   unit of value moves through it). Inline by default; offer `docs/diagrams/`.
3. If the repo has `opm/system.md`, start from it and say so — don't contradict the formal model.

### `fleet` — where does all of it stand?

1. Read the northstar registry (`core/decisions/northstar/README.md`), the roadmaps it lists,
   and open wayfinder maps (`core/decisions/wayfinder/*.md`).
2. Draw altitude views: clusters → northstars → what's active/missing; wayfinder frontiers as
   the "how to get there" layer. Respect the registry's own tier language (L1/L2/L3).
3. **Placement rule:** fleet views that carry career/strategy lenses (job targets, revenue
   framing, client work) go to `core/personal-knowledge/` (gitignored) — never public git.
   Pure-structure fleet views may be committed if asked.
4. Never write northstar files, roadmap files, or `status.jsonl` — this mode reads the delivery
   ledger, it does not touch it.

## Gotchas

- **The tempting failure is the mural** — one 40-node diagram nobody can read. Split it.
- **Freeform verbs drift.** Two diagrams are only comparable if edges speak the same verb set;
  reach for consumes/yields/requires/handles/affects before inventing a label.
- **Don't re-diagram the unchanged.** In `explain` mode the delta is the subject; redrawing the
  whole system hides what happened (and `/opm` already owns the whole system).
- **Render floor is strict.** No HTML labels beyond `<br/>`, no theme-dependent tricks — the
  diagram must survive GitHub, Obsidian, and Artifacts unchanged.
