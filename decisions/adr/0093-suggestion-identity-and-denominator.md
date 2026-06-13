# ADR-0093: Suggestion identity + denominator repair — the keystone for any skill-loop metric

slug: suggestion-identity-and-denominator
serial: 0093
domain: workflow-engine
type: architecture

- **Status:** Accepted — Slice 0 of the OPAV-loop gated-slice plan (the keystone every other slice joins on)
- **Date accepted:** 2026-06-13
- **Related:** ADR-0092 (availability-aware suggestions — its inline-bypass is the root of the broken join), ADR-0068 (0.8% follow-rate), ADR-0037 (skill telemetry), `OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md`
- **Verified (2026-06-13, from live telemetry):** `suggestion-telemetry.jsonl` = 1,279 lines; **0** carry a stable suggestion id; events: skill:suggested 411 / suggestion-ignored 575 / no-match 253 / suggested-uninstalled 15 / suggested-init 25.

---

## Context

Every downstream metric in the skill self-improvement loop (action-rate, queue dedup, fencing,
feedback) assumes a stable identity for "the same suggestion/work item." **It does not exist.** Three
confirmed defects:

1. **No durable suggestion identity.** Joins from suggestion→follow are fuzzy temporal windows
   (`log-skill.sh:46-48` = session_id+skill+last-30min; `suggest-skill.sh:54-84` = a `/tmp` dedup file +
   300s). S1 `skill:acted`, S3's action-rate join, and S4's outbox/fencing `op_id` would each invent a
   different key and silently disagree.
2. **Poisoned denominator.** `suggest-skill.sh:57-84` marks a suggestion `ignored` unless it sees a
   `skill:suggestion-followed` — which **ADR-0092 killed for inline follows** (they bypass the Skill
   tool, so `log-skill.sh` never fires). Result: **all 575 `suggestion-ignored` events are inflated by
   genuine-but-uninstrumented follows.**
3. **False baseline.** The lone historical "follow" is `skill:init` (beaverGame, 2026-04-27) — `/init`
   acceptance, **not** a skill action. The 0.8% (ADR-0068) never measured the thing the loop gates on.

## Decision

1. **Mint a `SUGGESTION_ID`** (uuid/op_id) at suggestion time in `suggest-skill.sh` and **echo it on
   every downstream event** (`skill:acted`, queue work-item, fence, delivery). This is the single join
   key for the whole loop (cross-slice invariant #1).
2. **Fix ignored-detection** to recognize an inline funnel-close. The corroborating signal **exists
   today, dependency-free**: the catch-all `tool-telemetry.jsonl` (`log-tool-use.sh`) already records
   every `Read` of `.../skills/<slug>/SKILL.md`. Before emitting `skill:suggestion-ignored`,
   `suggest-skill.sh` now consults a single-source-of-truth predicate
   (`scripts/hooks/corroborate-follow.mjs`, exit 0 = corroborated) that treats the suggestion as
   followed if a SKILL.md Read for that skill+session occurred at/after the suggestion **or** (forward
   compat, no-op until S1) a `skill:acted` carrying the `SUGGESTION_ID` exists. The same predicate
   backs the historical replay, so the live detector and the proof can never drift. Fail-open: a
   missing/unreadable feed preserves the prior behavior (still emit `ignored`); it never swallows an
   event or crashes the hot-path hook.
3. **Discard the 0.8% baseline in writing**; mark AR0 "to be re-derived under the corroborated definition
   after S1 lands" (S3-C0).

## Consequences

- **Gains:** every downstream slice joins on real identity, not a guess; the denominator stops lying;
  no autonomy gate is anchored to a number (0.8%) that measured `/init`.
- **Costs:** a schema touch to `suggest-skill.sh` + every emitter; a historical-replay to quantify the
  ignored-count correction.
- **Sequencing:** this is **slice-zero** — ~1 PR, blocks S1/S3/S4. Do it first.

## Verification
Pass when: 100% of new `skill:suggested` carry a unique `SUGGESTION_ID`; a historical-window replay shows
the `ignored` count drop by the count of corroborated inline follows with zero regressions; and the 0.8%
figure is struck from the S3 baseline-of-record.

**Result (2026-06-13, live telemetry replay — `scripts/hooks/replay-ignored-correction.mjs`):**
`ignored_before = 581 → ignored_after = 561` (20 corroborated inline follows, **3.4%** of ignored),
**0 regressions**, full window (0 ignored events predate tool-telemetry coverage). New `skill:suggested`
/ `-uninstalled` / `-ignored` / `-followed` events now carry `suggestion_id` (verified by hook tests).
0.8% struck in ADR-0068 (correction banner + lines 21/83).

**Scope honesty / what S0 does NOT claim.** The SKILL.md-Read signal corroborates only the subset of
follows where the agent literally opened the file; it cannot see follows acted on from already-loaded
context, nor Skill-tool follows on `-uninstalled` suggestions. So 3.4% is a **floor on the correction**,
not the full inflation — the larger re-baseline genuinely awaits S1's richer, two-source `skill:acted`.
S0's job is the **identity** that makes S1's correction joinable, plus a real, zero-regression first cut.

**Deliverables:** `suggest-skill.sh` (mint + thread id, inline-follow OR-clause), `log-skill.sh` (id on
funnel-close), `corroborate-follow.mjs` (shared predicate + CLI), `replay-ignored-correction.mjs`
(verification artifact), hook tests under `scripts/hooks/__tests__/`. Untouched (forward-compat only):
`skill-metrics.mjs` — upgrading its temporal join to prefer `suggestion_id` is deferred to S1/S3.
