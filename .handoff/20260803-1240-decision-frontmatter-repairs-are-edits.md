---
id: 20260803-1240-decision-frontmatter-repairs-are-edits
type: decision
title: "Frontmatter-only conformance repairs on unchanged prose are edits, not supersessions"
actor: code-claude
session_id: vantage-gap-execution-2026-08-03
refs:
  - bead:20260803-1200-brief-untracked-bead-ledger-vantage-gap
  - path:core/scripts/bead-lint.mjs
  - path:core/.claude/skills/bead/references/bead-schemas.md
hook: "rm:rm-l2-ojfbot#S33"
status: live
created_at: 2026-08-03T12:40:00-0500
labels:
  project: bead-queue-wiring
---

## Context

bead-lint reports 32 schema errors fleet-wide: invalid status enums (`done`, `open`,
`delivered`, prose sentences), `id` ≠ filename stem, missing frontmatter blocks, and
`responding_to: null` on reports whose brief↔report pairing is evidenced. The bead
protocol says corrections are new beads, not edits — the append-only rule protects the
ledger's auditability. Repairing 32 errors under that reading means 32 superseding beads
and a doubled ledger. The vantage-gap brief
(`20260803-1200-brief-untracked-bead-ledger-vantage-gap`) required this ruling before any
bead is touched (plan step A).

## Options considered

1. **Every correction is a supersession** — strict append-only. Preserves the letter of
   the protocol but doubles the ledger with content-free shadow beads and makes the
   schema sweep worse than the disease.
2. **Frontmatter-only repairs are edits** — a schema fix on a bead whose prose is
   unchanged is a conformance repair, not a claim revision. Supersession stays reserved
   for changes to what a bead *says*.

## Decision

Option 2, ruled by the operator 2026-08-03: **frontmatter-only conformance repairs on
unchanged prose are edits, not supersessions.** This covers: normalizing status enums to
the nearest valid value (`done`→`closed`, prose→`live` with prose moved to body),
rewriting `id` to match the filename stem (replay.py invariant — never rename the file),
authoring minimal frontmatter blocks for beads that lack one, and wiring `responding_to`
where the brief↔report pairing is evidenced in the same directory.

## Consequences

- The class-2/3/4 mechanical sweep (brief plan step C) may proceed as in-place edits,
  PR-gated and hand-checked, with prose never changing.
- Supersession remains mandatory for any change to a bead's claims, scope, or prose.
- Closing a hook (`status: live`→`closed` on a brief with an unretired hook) remains a
  truth claim and stays human-only (S33) — this ruling does not authorize it. Status
  repairs under this ruling only normalize *invalid* enum values, never flip valid ones.
