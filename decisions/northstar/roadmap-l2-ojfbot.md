---
type: roadmap
slug: rm-l2-ojfbot
northstar: l2-ojfbot
status: active
phases:
  - id: PH1
    name: "Skill-ify the northstar relay"
    goal: "The roadtrip's brief → voice-confirm → land loop is a repeatable skill pair (CC-side /northstar-leg + chat-side voice skill), not a hand-driven runbook."
  - id: PH2
    name: "Land the remaining legs"
    goal: "All 26 itinerary apps have a registered, lint-clean L1 northstar with ladder-stress verdicts logged; northstar-lint reports 0 missing files."
slices:
  - id: S1
    phase: PH1
    title: "Repair l1-cv-builder — registered northstar file missing on disk"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 20
    moves_to: 22
    deliverable: "PR in cv-builder restoring .claude/northstar.md (recover from git history or re-land from the offsite record); northstar-lint 0 errors."
    entrance: "northstar-lint currently ERRORs: registered-but-absent l1-cv-builder (pre-existing, observed 2026-07-02)."
    success: "node core/scripts/northstar-lint.mjs shows 7/7 files present, 0 errors."
    autonomy: gate-0
    claimable_by: either
    kind: s
    repo: cv-builder
    status: ready
  - id: S2
    phase: PH1
    title: "CC-side /northstar-leg skill — survey, brief, land"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 20
    moves_to: 24
    deliverable: "core/.claude/skills/northstar-leg/ + catalog entry: picks next queued itinerary apps, runs the evidence survey, writes briefing cards to the Notion relay; on --land, writes confirmed .claude/northstar.md files, registers, lints, logs ladder-stress verdicts, marks the itinerary cursor, appends the synthesis ledger."
    entrance: "Offsite harness + Notion relay exist (itinerary.md, schema-evolution-log.md, relay contract page); leg-1 transcript available as the worked example."
    success: "A dry run against one queued app produces a briefing card matching the leg-1 format; --land applied to the already-CONFIRMED Frame block lands lint-clean files."
    autonomy: gate-0
    claimable_by: either
    kind: m
    repo: core
    status: ready
  - id: S3
    phase: PH1
    title: "Chat-side voice skill for the northstar conversation"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 24
    moves_to: 28
    deliverable: "Chat skill canonical at core/.claude/skills/northstar-voice/ (selfco-ingest precedent: git canonical in core, RE-UPLOAD to claude.ai to go live): reads a leg's briefing cards from Notion, runs the Socratic vision conversation voice-first, writes the CONFIRMED block + ladder-stress verdicts back to Notion. Chat stays above the evidence line — it never asserts repo facts, only refines the staged brief."
    entrance: "S2 merged (the briefing-card contract it consumes is fixed by /northstar-leg)."
    success: "One leg conversation run end-to-end from a phone in voice mode produces a CONFIRMED block that /northstar-leg --land accepts without manual repair."
    autonomy: gate-0
    claimable_by: either
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S2"
  - id: S4
    phase: PH2
    title: "Land the Frame leg (shell) — already voice-CONFIRMED"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 20
    moves_to: 23
    deliverable: "shell/.claude/northstar.md landed from the existing CONFIRMED relay block (instance-federation framing: shell=authorizing surface, core=spawn), registered, lint clean, ladder-stress verdicts appended."
    entrance: "The Frame leg CONFIRMED block exists in the Notion relay (confirmed in voice 2026-06-28/29); no new conversation needed."
    success: "Registry gains l1-shell (or the confirmed slug); northstar-lint 0 errors; ladder-stress.jsonl gains the leg's verdicts; itinerary cursor → landed."
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: shell
    status: ready
  - id: S5
    phase: PH2
    title: "Leg 2 — purefoy, daily-logger, seh-study, bldgblog-corpus"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 28
    moves_to: 40
    deliverable: "4 landed L1 northstars via the skill pair (brief → voice confirm → land); ledger + verdicts appended; itinerary cursor advanced."
    entrance: "PH1 skills merged; leg-2 briefing cards written and voice-CONFIRMED in the relay."
    success: "4 new registry entries, lint clean, ladder-stress logged per parent property."
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: core
    status: queued
  - id: S6
    phase: PH2
    title: "Leg 3 — golf platform cluster, jocdive-sdi-mcp, dms-core"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 40
    moves_to: 48
    deliverable: "Leg-3 L1s landed via the skill pair; first candidate for the designed-but-unbuilt cluster tier (golf) — if the leg needs it, that is the evidence gate the schema-evolution log is waiting on."
    entrance: "Leg 2 landed; leg-3 briefing cards voice-CONFIRMED."
    success: "Registry entries + lint clean + verdicts; any cluster-tier need logged as a schema-evolution iteration, not improvised."
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: core
    status: queued
  - id: S7
    phase: PH2
    title: "Leg 4 — asset-foundry, beaverGame, lofi-beaver, foundry-recipes"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 48
    moves_to: 56
    deliverable: "Leg-4 L1s landed via the skill pair; ledger + verdicts appended."
    entrance: "Leg 3 landed; leg-4 briefing cards voice-CONFIRMED."
    success: "Registry entries + lint clean + verdicts logged."
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: core
    status: queued
  - id: S8
    phase: PH2
    title: "Leg 5 — blogengine, lean-canvas, core-reader, frame-ui-components, landing"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 56
    moves_to: 64
    deliverable: "Leg-5 L1s landed via the skill pair; ledger + verdicts appended."
    entrance: "Leg 4 landed; leg-5 briefing cards voice-CONFIRMED."
    success: "Registry entries + lint clean + verdicts logged."
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: core
    status: queued
  - id: S9
    phase: PH2
    title: "Leg 6 — gastown-pilot, workstation-yuri, github-actions (+ l2-selfco decision)"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 64
    moves_to: 72
    deliverable: "Final leg landed; decide and record whether l2-selfco graduates from deferred (it lives in the vault at ~/selfco/tracking/, never in core) — a decision line in the synthesis ledger either way."
    entrance: "Leg 5 landed; leg-6 briefing cards voice-CONFIRMED."
    success: "Itinerary shows 26/26 landed or explicitly retired; registry + lint clean; l2-selfco decision recorded."
    autonomy: gate-0
    claimable_by: human_only
    kind: l
    repo: core
    status: queued
---

# Roadmap — l2-ojfbot (northstar coverage via the voice relay)

**Route.** `ns:l2-ojfbot#P2` says every app's daily work traces to a measurable property — which
requires every app to *have* one. 8 of 26 itinerary stops are landed; the flow that landed them
(the offsite roadtrip's two-agent Notion relay: CC stages evidence briefs → voice conversation
refines → CC lands) worked but ran as a hand-driven runbook and stalled after leg 1. PH1 turns
that runbook into a repeatable skill pair — the CC half (`/northstar-leg`) owns evidence and
landing; the chat half (`northstar-voice`, re-uploaded to claude.ai) owns the car-friendly voice
conversation, staying above the evidence line. PH2 drives the remaining legs through it, starting
free: the Frame leg is already voice-CONFIRMED and just needs landing (S4), and the registered-but-
missing l1-cv-builder file is a lint ERROR today (S1). Leg slices are `claimable_by: human_only` —
they contain a conversation; the day-runner never grabs them.

## PH1 — Skill-ify the northstar relay

S1 repairs the one broken registry entry. S2 builds the CC-side skill against the leg-1 worked
example. S3 builds the chat-side voice skill against S2's fixed briefing-card contract — canonical
in core, live only after re-upload to claude.ai (the selfco-ingest lesson).

## PH2 — Land the remaining legs

S4 lands the already-confirmed Frame leg immediately (no conversation needed). S5–S9 run legs 2–6
through the skill pair, one voice session each. Leg 3 (S6) is the standing evidence-gate for the
designed-but-unbuilt cluster tier: if the golf cluster genuinely needs `ns:cluster-*` refs, that
gets logged as a schema-evolution iteration — built on evidence, not imagination.
