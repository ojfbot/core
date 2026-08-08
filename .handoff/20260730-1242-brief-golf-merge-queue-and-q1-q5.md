---
id: 20260730-1242-brief-golf-merge-queue-and-q1-q5
type: brief
title: "OPERATOR SITTING: merge the 7 golf PRs in order + rule Q1–Q5 (all human-gated; no agent may merge)"
actor: code-claude
to: yuri
session_id: golf-umbrella-northstar-landing-2026-07-30
refs:
  - 20260730-1240-report-golf-umbrella-landed-7-prs
hook: "github:ojfbot/mirrorworld#11"
status: live
created_at: 2026-07-30T12:42:00-0500
labels:
  project: cluster-golf
  autonomy: human_only
---

## The ask (one sitting, ~30 min)

1. **Merge order:** gcgcca#5 → fairway#1 → core#297 → mirrorworld#11 → core#298. daily-logger#259 + morning-cockpit#41 any time after gcgcca#5 (sooner is better — sweep/cards are stale until then).
2. **Rule the queue** (each question sits in its PR body):
   - **Q1** (gcgcca#5): `gh repo rename` ojfbot/gcgcca → capture-agent? Renaming preserves redirects; not renaming mints a permanent dir/remote mismatch.
   - **Q2** (fairway#1): fairway ladder #P1 vs #P2 — landed PROVISIONAL #P1; ratify or flip.
   - **Q3** (mirrorworld#11): mirrorworld P6/PH5 (S18–S23 classification) vs capture-agent P1 — who owns the segmentation-model mission?
   - **Q4** (core#298): golf-platform-scripts — itinerary row 8 as the P3 anchor, or a new consolidated row?
   - **Q5** (core#297): ladder-stress verdicts are actor=code-relay-proposed (the sitting briefs carried none) — ratify, replace, or re-run chat-side.
3. **Also unratified:** all fairway axes, all seed pull conditions, capture-agent numeric targets.
4. **Chat-side follow-up:** Notion golf pages ("golf classifier" row, Contract golf addendum, F1-cluster card) still carry the dead property-subset framing; no mirrorworld itinerary row exists. Route the refresh chat-side (constraint 6.3).

## Not for agents

Every merge gate is gate-0 (human merges) and every question is an operator ruling — an agent picking this bead up may only *prepare* (re-verify lint, rebase a stale PR), never merge or rule.
