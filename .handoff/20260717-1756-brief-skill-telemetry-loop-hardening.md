---
id: 20260717-1756-brief-skill-telemetry-loop-hardening
type: brief
title: "Harden + deliver the skill-telemetry loop: S16 → PH2 (S8/S9) → reliability slice"
actor: code-claude
to: code-claude
session_id: d92e3b15-2271-45da-88c6-80d4250d2e25
status: live
created_at: 2026-07-17T22:56:00Z
refs:
  - rm:rm-l1-core#S16
  - rm:rm-l1-core#S8
  - rm:rm-l1-core#S9
  - adr:two-track-skill-telemetry
labels:
  project: core
  emitted_by: code-claude
---

## Context

PH1 of rm-l1-core is delivered (2026-07-17, P1 at 60): path-independent capture, population
split, single writer, gold set GREEN (capture 9/9, false-emit 0/10, agreement 9/13 — the 4
misses are the named `missing-authoring-discriminator` finding). Spec of record:
`.claude/roadmap.md` + `.claude/northstar.md`; canon: ADR-0095 Rev A,
`decisions/adr/draft-two-track-skill-telemetry.md`, `decisions/research/2026-07-17-skill-loop-sota.md`,
`decisions/opav/{gold-set-v0.jsonl, capture-quality-report.json, gold-set-v0-README.md}`,
`decisions/loops/loops.md` (reconciler STANDING INVARIANT).

## Goal

Sequence per Karpathy-loop doctrine (ruler before program): (1) **S16** (ready) —
skill-authoring terminal in the reconciler + product-near-definition refinement + shadow
skill:authoring stream + one outcome join; success = gold agreement 13/13, draft ADR
accepted. (2) **S8+S9** (flip ready in first data PR — operator authorized 2026-07-17) —
suggester gold eval (pre-limit scoring, chance-corrected, frozen holdout) + trigger-precision
report (summarize 62×/0 is the live evidence). (3) **Register a hardening slice** for the
verified reliability gaps: silent no-op on unbuilt dist (loops.md invariant — add a loud
guard); log-skill.sh repo-scope-only under-firing; /tmp dedup default-fallback cross-wiring;
--json 64KiB stdout truncation; script-exec path uncounted; 414 pre-ADR-0093 unjoinable
events (era boundary — document, don't fudge); northstar current-vs-ledger drift WARNs.

## Acceptance criteria

- [ ] S16 merged: gold-mode verifier 13/13, zero regressions on the other 9; capture-quality-report.json regenerated (the cockpit Loop pane suppression keys on it)
- [ ] S8/S9 delivered with baselines committed and holdout named out-of-bounds
- [ ] Hardening slice registered with evidence-cited entrance before any fix lands
- [ ] Every rate published is gold-verified; eras never blended; acted stays evidence-mandatory; movement lines only at merge via record-movement.mjs

## References

- Concurrency: other sessions work this fleet — pull before branching; after any pull touching
  packages/workflows run `pnpm install --frozen-lockfile && pnpm --filter @core/workflows build`
  or the live Stop hook goes silently dead (gap (a) above).
- Parallel-safe with the morning-cockpit S8 bead (different repos; shared surface is only
  capture-quality-report.json, which this session owns).

## Flag back

Meet the acceptance criteria to close the bead; surface blockers rather than redefining scope.
