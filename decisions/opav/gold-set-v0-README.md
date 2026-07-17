# Gold set v0 — operator labeling sitting (rm:rm-l1-core#S6, human-only)

> **SITTING COMPLETE 2026-07-17** (operator + delivery session, walked live). 9 labels
> CONFIRMED, 4 CORRECTED to **`skill-authoring`** — a new expected label for sessions that
> edit the suggested skill's own files (improving/refactoring/extending it). Operator ruling:
> authoring is excluded from the *use* denominator but is a **core self-improvement signal to
> be tracked in its own right** — the two-track decision (use-funnel ∥ skill-evolution; see
> the draft ADR + rm:rm-l1-core P4/S16). Verifier verdict **GREEN**: capture 9/9, false-emit
> 0/10, agreement 9/13 with all 4 mismatches the named `missing-authoring-discriminator`
> finding (`capture-quality-report.json`) — the evolution slice's entrance evidence.

`gold-set-v0.draft.jsonl` holds **13 PROPOSED candidates selected from real telemetry**
(the rebuilt 364-row disposition ledger + tool-telemetry + suggestion-telemetry),
covering every category the slice requires:

| category | count | what it tests |
|---|---|---|
| Skill-tool follows (S2 flip class) | 4 | the widened predicate detects the dominant path |
| inline SKILL.md Reads | 2 | the original predicate path still works |
| acted (C2-valid) | 1 | the evidence-gated numerator (the ledger's first real acted) |
| capture_miss | 2 | work done, never self-reported — the real failure category |
| honest ignores | 2 | no engagement on any path (true negatives) |
| no-suggestion (skill:no-match) | 2 | nothing should enter the denominator (99%-Paradox guard) |

## Your ~30-minute sitting

1. For each line, confirm or correct `expected_disposition` (spot-check the session
   transcript under `~/.claude/projects/*/<session_id>.jsonl` if unsure), then flip
   `label_status: PROPOSED` → `CONFIRMED` (or edit + `CORRECTED`).
2. Rename the file to `gold-set-v0.jsonl` when every line is labeled.
3. Run `node scripts/opav-capture-quality.mjs` and commit its report as
   `decisions/opav/capture-quality-report.json` — that artifact is what un-suppresses
   rates on the cockpit Loop pane (`COCKPIT_CAPTURE_QUALITY_FILE`) and, per the
   ADR-0095 honesty contract, unlocks publishing any follow-rate.
4. Record movement: `node scripts/record-movement.mjs --ref rm:rm-l1-core#S6 --pr <this PR>`.

**Bars (ADR-0095):** capture ≥ 70%, false-emit ≤ 10%. Labels feed forward into
rm-l2-ojfbot#S22's 30-label set — do not double-count movement there.

Selection provenance: candidates drawn 2026-07-17 by the rm-l1-core delivery session;
selection logic mirrors `detectUse()` in `scripts/opav-capture-quality.mjs` (skill-tool /
inline-read / script-exec) plus the reconciler's artifact proxy. **The labels themselves
are yours** — the machine proposed, it must not confirm (two-source discipline).

## Era boundary (ADR-0093) — the unjoinable pre-era

414 installed + 16 uninstalled suggestion events predate ADR-0093's SUGGESTION_ID
(minted from 2026-06-13). They carry no join key and are **structurally unjoinable**
to dispositions or gold labels — counted, excluded from every denominator, never
fudged. Any funnel, rate, or gold comparison in this directory is scoped to the
joinable era; the trigger-precision report (`docs/trigger-precision-2026-07-17.md`,
`node scripts/skill-metrics.mjs --trigger-precision`) states the same boundary.
