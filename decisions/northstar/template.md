---
type: northstar
slug: kebab-stable-id            # immutable identity (ADR-0087 convention). Never renumber.
tier: L1                         # L1 (per-app) | L2 (ojfbot | selfco) | L3 (shared apex)
app:                             # L1 only: the repo this northstar belongs to. Omit for L2/L3.
ladders_up_to:                   # parent northstar SLUG (L1→L2, L2→L3). Omit for L3 (the root).
status: active                   # active | paused | retired
properties:
  - id: P1                       # stable property id (the KR# analog). Assigned once, never reused.
    name: "Short property name — the named axis of progress"
    target: "What 'done' looks like, concretely and verifiably."
    current: 0                   # 0–100, the scoreboard. Hand-asserted in Slice 1.
    verification: "How you'd prove the current %."
    ladders_up_to: "ns:<parent-slug>#P<n>"   # which PARENT property this advances. Must resolve on disk.
    okr_drivers: []              # optional: quarterly OKRs currently moving this, e.g. ["2026-Q2/O1/KR3"]
---

# Northstar — <name> (<tier>)

**Vision.** <One paragraph: where this is going and why it matters. The compass every day's
work is measured against.>

## P1 — <property name>

<Prose: what "done" looks like, what the current % means today, the next increment that would
move it. A property at a lower tier should explain how advancing it advances its parent.>
