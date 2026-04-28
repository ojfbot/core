---
name: triage
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "triage", "triage
  these issues", "label this backlog", "prioritize the issues", "apply triage
  labels". Severity/effort/domain rubric. Output: label set + ordered backlog.
---

# /triage — Backlog rubric

**Status: scaffold — full implementation lands in Phase 4 of the Pocock skills foundation work (see plan file at `/Users/yuri/.claude/plans/with-a-browser-agent-compressed-castle.md` and ADR-0048 once written).**

For now, when invoked: tell the user this skill is scaffolded and offer to run `gh issue list` so they can triage manually with the rubric below.

## Rubric (preview)

- **Severity:** p0 (data loss, prod outage) | p1 (broken core flow) | p2 (degraded experience) | p3 (polish, nice-to-have)
- **Effort:** xs (<1h) | s (<1d) | m (1–3d) | l (1w) | xl (>1w — consider splitting)
- **Domain:** auth | agent-graph | ui | infra | docs | ops
- **Type:** bug | feature | refactor | architecture | docs | chore

Backlog order = severity × (1 / effort). p0/xs always first; p3/xl always last.

---

$ARGUMENTS
