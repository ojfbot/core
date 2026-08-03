# Deliverable tracking — the spine this skill feeds

Reference for `/gated-slice`, moved verbatim from SKILL.md: gate-event emission, canvas/ledger rules, and evidence requirements.

A gated-slice effort is exactly the **scope-appropriate** case (TD-006 scope gate) that the
deliverable-tracking spine exists for. As slices and gates transition, emit them onto the append-only
ledger so the roadmap **canvas is a live projection**, not a stale hand-edited drawing:

- **On entering a slice / gate:** `node scripts/gate-event.mjs <program> <slice> <gate> entered`
- **During validation:** `/validate` and `/tdd` emit `validating` → `passed`/`failed` (see those skills).
- **On delivery:** `node scripts/gate-event.mjs <program> <slice> <gate> delivered --evidence=<pr>`

**Emit-not-magic:** there is no Claude Code tool event for a semantic gate pass — you emit it. The
canvas node id **must equal the slice id**; the projector owns each node's color + its
`<!--gate-status-->` block and nothing else (prose is yours). The reconciler hook (`reconcile-tracking.mjs`,
SHADOW) audits canvas==ledger + evidence-on-pass + validating-staleness; **auto-repair is OFF**. No
`passed`/`delivered` without resolvable evidence. See `adr:deliverable-tracking-spine`.
