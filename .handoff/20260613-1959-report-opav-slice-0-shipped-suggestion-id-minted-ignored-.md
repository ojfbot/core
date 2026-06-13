---
id: 20260613-1959-report-opav-slice-0-shipped-suggestion-id-minted-ignored-
type: report
title: "OPAV Slice 0 shipped — SUGGESTION_ID minted + ignored-denominator repaired (ADR-0093)"
actor: code-claude
responding_to: 20260613-1900-brief-opav-loop-program
session_id: 2026-06-13T19:59:15Z
refs:
  - adr:suggestion-identity-and-denominator
  - file:core/OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md
  - file:core/scripts/hooks/corroborate-follow.mjs
  - file:core/scripts/hooks/replay-ignored-correction.mjs
hook: null
status: live
created_at: 2026-06-13T19:59:15Z
labels:
  domain: workflow-engine
  project: opav-loop
  slice: S0
---

## What got done

S0 (the keystone) is built, tested, and verified on live telemetry. **Not committed by request** —
staged on branch `adr/suggestion-identity-and-denominator` for review; nothing pushed.

- **C0 — identity.** `scripts/hooks/suggest-skill.sh` mints a durable `SUGGESTION_ID` (`uuidgen` +
  portable fallback) at suggestion time and threads it onto `skill:suggested` / `-uninstalled` /
  `-ignored`. The `/tmp` dedup file is now a 3-line record (skill / epoch-ts / id). `log-skill.sh`
  echoes the matching id onto `skill:suggestion-followed`. (Also fixed a latent bug the 3-line format
  exposed: the dedup-window check was `tail -1`-ing the file — would have read the id as the ts.)
- **C1 — denominator repair.** The ignored-detector now consults `corroborate-follow.mjs` — a single
  source of truth (the live hook **and** the historical replay call the same predicate, so they cannot
  drift) — and skips `suggestion-ignored` when an inline follow is corroborated: a `SKILL.md` Read in
  `tool-telemetry.jsonl` for that skill+session after the suggestion, or (forward-compat, no-op until
  S1) a `skill:acted` carrying the id. Fail-open throughout (missing feed ⇒ prior behavior).
- **C2 — 0.8% struck.** Correction banner on `decisions/adr/0068-follow-skill-suggestions.md` + both
  cited lines (21, 83) annotated struck; AR0 marked for re-derivation post-S1. S0 ADR accepted as
  **ADR-0093** (`decisions/adr/0093-suggestion-identity-and-denominator.md`).
- **Verification artifact:** `scripts/hooks/replay-ignored-correction.mjs` (run it to reproduce).
- **Tests:** 5 files under `scripts/hooks/__tests__/` (15 tests, all green); full repo suite 258 pass / 0 fail.

## Exit-gate evidence (reproduce before trusting)

`node scripts/hooks/replay-ignored-correction.mjs` against live telemetry:
```
ignored_before 581 → ignored_after 561   (20 corroborated inline follows, 3.4%)   regressions 0   PASS
```
Full window (0 ignored events predate tool-telemetry coverage); spot-checked genuine
(vault / session adf7f66c has a real SKILL.md Read at 01:37 after its 23:30 suggestion).
C0: a fresh emit carries `"suggestion_id"` (hook tests + manual E2E).

## What's open / what surprised

- **The correction is 3.4%, NOT the "all 575 inflated" the program brief hypothesized.** The
  SKILL.md-Read signal only sees follows where the agent literally opened the file — not follows acted
  on from already-loaded context, nor Skill-tool follows on `-uninstalled` suggestions. So **20 is a
  floor**; S0's real value is the *identity* that makes S1's two-source correction joinable. This is
  written into ADR-0093's Verification section so the number can't be over-read.
- **`skill-metrics.mjs` deliberately untouched.** Upgrading its 5-min temporal join to prefer
  `suggestion_id` is S1/S3 work — flagged as a known deferral, not an oversight.
- **Files staged are S0-only.** The repo working tree also carries another agent's
  `deliverable-tracking-spine` work (`packages/workflows/src/tracking/`, `index.ts`, `tracking-*.test.ts`)
  and several prior-session untracked drafts/handoffs — explicitly **excluded** from the S0 commit.

## Decisions made

- bead:adr:suggestion-identity-and-denominator (ADR-0093, Accepted) — minted identity + corroboration
  source = existing `tool-telemetry` SKILL.md-Read (no S1 dependency); fail-open.

## Recommended next session

S1 — skill-action instrumentation. **Do not start cold.** See the paired brief
(`20260613-1959-brief-pickup-opav-slice-1-...`): it must first independently re-verify S0's exit gate
and S1's entrance gate, and S1 carries honesty-contract + autonomy-fencing design choices the user
wants to be in the loop on (per the program brief's closing caveat).
