---
id: 20260808-2150-brief-canon-wayfinder-closeouts-and-token-vocabulary
type: brief
title: "Canon regeneration, wayfinder closeouts, and the chat token vocabulary (core side of cockpit v2)"
actor: claude-design-session
to: code-claude
session_id: 2026-08-08T21:50:00Z
refs:
  - file:decisions/wayfinder/cockpit-northstar-conversation.md
  - file:decisions/wayfinder/diagram-first-output.md
  - file:.claude/skills/fleet-onboard/knowledge/surface-matrix.md
  - path:~/selfco/diagrams/fleet-map.md
status: closed
created_at: 2026-08-08T21:50:00Z
labels:
  - canon
  - wayfinder
  - cockpit-v2
---

# Brief — pick up: canon regeneration, wayfinder closeouts, token vocabulary

## Context

The cockpit v2 design pass (see package README + audit) produced verdicts and asks that land
on core's side of the fence.

## The work

1. **Record prototype verdicts on open wayfinder tickets** (evidence, operator ratifies):
   - **#338 (372px rail):** verdict — the canvas does not survive 372px (needs ≥560, ideal
     ≥700; RFI response E30). The pattern that DOES fit the rail is the inspector + threaded
     chat, which the v2 design adopts. Record and close or re-scope.
   - **#340 (thread keying):** recommended answer implemented cockpit-side (S-c): keyed
     threads `{global | repo}` + per-thread share-to-global toggle; focus-change mid-thread
     keeps the thread pinned to its scope (selection changes the INSPECTOR, not the thread).
     Needs operator ratification + the map's Decisions section updated.
   - **#368/#372 (diagram-first, tldraw):** evidence — a hand-rolled ~200-line SVG viewer was
     sufficient for a 66-node interactive constellation; tldraw remains a research candidate
     for EDITABLE canvases only. The navigator stays a viewer per diagram-conventions.
2. **Canon slice — regenerate D5 from the registry.** `registry → mermaid source → dark-theme
   render`, output appended to `~/selfco/diagrams/fleet-map.md` per the standing file's update
   discipline; the cockpit consumes the rendered artifact. D6–D8 stay authored. Never ship a
   light-theme render into a dark surface (prototype vol.3 defect).
3. **TD-007 follow-through.** The cockpit's new fleet-structure pane joins membership to the
   registry and renders census/registry disagreement. Add the pane to the fleet-onboard
   surface matrix as REGISTRY-GENERATED (so it never becomes hand-list #15), and note the
   reconcile mode covers it.
4. **Token vocabulary (design-time registration).** The cockpit chat gains UI-executed
   command tokens: `/explain` `/ladder` `/gap` `/open` `/draft-handoff` (spec in package
   README "Chat"). Phase 1 is read-only + the existing ADR-0005 emit flow. If/when core verbs
   (queue-claim etc.) are exposed as tokens, that is a NEW decision — flag it to the operator,
   do not infer it from this brief.

## Measured / tested / documented

Wayfinder map updated (verdict lines + Decisions), D5 generator has a golden-file test
(registry fixture → expected mermaid), fleet-onboard matrix row added, one `### Updated`
bullet per landed item in the next sync note.

## Out of scope

Switchboard S9 adoption (own roadmap), cluster-tier schema (RFQ-004, still blocking #341),
any write into `decisions/northstar/`.
