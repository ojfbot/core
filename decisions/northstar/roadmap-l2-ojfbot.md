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
  - id: PH3
    name: "Audit hardening program (2026-07-04) — make the fleet's work self-measuring"
    goal: "The tranche-1 slices of MULTIAGENT-SDLC-AUDIT / AGENTIC-INTEGRATION-PLAN / FLEET-COORDINATION-EXTENSIONS are merged, verified DELIVERED by scripts/audit-delivery-check.mjs, and the program shows movement at least every 14 days (the verifier's staleness gate)."
slices:
  - id: S1
    phase: PH1
    title: "Repair l1-cv-builder — registered northstar absent from the working copy"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 20
    moves_to: 22
    deliverable: "cv-builder working copy carries .claude/northstar.md; northstar-lint 0 errors. FINDING (2026-07-03): the file was never missing from origin/main — its tip IS the northstar commit (2a88ec1). The lint ERROR is a working-copy artifact: the checkout sits on docs/claude-md-routing (ADR-0081 rollout WIP, uncommitted changes, cut before the northstar landed). Remaining action: land/rebase that branch or switch the checkout to main — owner's call, do not touch the dirty branch."
    entrance: "northstar-lint currently ERRORs: registered-but-absent l1-cv-builder (working-copy artifact per the 2026-07-03 finding; self-heals when the rollout branch lands)."
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
  - id: S10
    phase: PH3
    title: "H0 ground truth — commit the OPAV master plan into core"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 20
    moves_to: 21
    deliverable: "OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md committed to core (root or decisions/) so the program constitution survives the laptop; referenced beads stop pointing at a file that exists nowhere."
    entrance: "The file exists on the operator's Mac (referenced by 3+ beads and the DeepStack evaluation). Copy it in — do not reconstruct it."
    success: "node scripts/audit-delivery-check.mjs shows H0.1 DELIVERED."
    autonomy: gate-0
    claimable_by: human_only
    kind: s
    repo: core
    status: merged
  - id: S11
    phase: PH3
    title: "daily-logger truth pipeline — repoint dead telemetry consumer + deterministic fact-check"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 21
    moves_to: 22
    deliverable: "collect-telemetry.ts reads skill-dispositions.jsonl (frozen stream demoted to labeled legacy fallback); verifyFileExistenceClaims() built per TD-001 and wired post-generation; build-api.ts stops treating missing article status as implicitly accepted; CLAUDE.md purged of the phantom bead-store.ts claim."
    entrance: "Audit findings T1, P4, P7, T11 confirmed current (re-run the verifier: H2.1, I5.1, I5.2, H0.3 all MISSING)."
    success: "audit-delivery-check.mjs shows H2.1, I5.1, I5.2, H0.3 DELIVERED; pnpm test green in daily-logger."
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: daily-logger
    status: merged
  - id: S12
    phase: PH3
    title: "cockpit honesty pass — stale seeded chain, adapter doc claims, problems-view states"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 22
    moves_to: 23
    deliverable: "fleet-config.ts stale 'bead_events empty log' critical chain removed or seeded-badged in the UI; CLAUDE.md marks github/standup adapters NOT BUILT (or builds github.ts from daily-logger's collectors); deriveAgentLiveness extended with Stalled/Zombie states per the Gas Town problems-view taxonomy."
    entrance: "Audit findings P1, P2, F5 confirmed current (verifier: H0.4, F5.1, F5.2 MISSING)."
    success: "audit-delivery-check.mjs shows H0.4 (at least PARTIAL), F5.1, F5.2 DELIVERED; pnpm test green in morning-cockpit."
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: morning-cockpit
    status: merged
  - id: S13
    phase: PH3
    title: "Re-measurement cadence — weekly measurement routine with the delivery oracle inside"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 23
    moves_to: 24
    deliverable: "A scheduled weekly routine (launchd/cron/frame-standup extension) that runs skill-metrics.mjs to docs/skill-metrics-YYYY-MM-DD.md, runs audit-delivery-check.mjs --json and files the diff vs last week, and nags on vault-sync age. First run produces the cluster's second-ever metrics snapshot."
    entrance: "audit-delivery-check.mjs merged (this PR); skill-metrics.mjs runs clean against live telemetry."
    success: "audit-delivery-check.mjs shows H7.1 DELIVERED (>1 snapshot); two consecutive weekly artifacts exist after 14 days."
    autonomy: gate-0
    claimable_by: either
    kind: m
    repo: core
    status: merged
  - id: S14
    phase: PH3
    title: "day-runner verification stage (SHADOW) + record-movement manual-path guard"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 24
    moves_to: 25
    deliverable: "Post-session, day-runner runs the target repo's check command in the worktree and records checks:{tests,success_criterion} on the pr-created bead + PR body (record only, never blocks — promotion to blocking is a later RIDM decision after ~20 shadow runs); record-movement's --northstar manual path requires --override-reason and stamps source:manual-unverified."
    entrance: "S13 merged (the weekly routine is what will surface shadow-agreement data for the eventual promotion decision)."
    success: "audit-delivery-check.mjs shows H4.1, H4.2 DELIVERED; next overnight run's beads carry the checks field."
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: delivered
    depends_on: "rm:rm-l2-ojfbot#S13"
  - id: S15
    phase: PH3
    title: "Verifiability-sorted dispatch — autonomy_fit + machine check field in the roadmap schema"
    advances: "ns:l2-ojfbot#P2"
    moves_from: 25
    moves_to: 26
    deliverable: "Roadmap schema v1.x adds an optional check: field (machine-runnable success command) and autonomy_fit derived from its presence; roadmap-compile only queues agent_eligible slices that carry check:; /triage refreshed toward the ready-for-agent/ready-for-human state machine (Pocock upstream, June 2026)."
    entrance: "S14 merged (the verification stage is what makes check: enforceable at the slice boundary)."
    success: "audit-delivery-check.mjs shows F1.1 DELIVERED; roadmap-lint clean; a compiled bead carries the field."
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l2-ojfbot#S14"
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

## PH3 — Audit hardening program (2026-07-04)

Tranche 1 of the three-document audit program (`MULTIAGENT-SDLC-AUDIT-2026-07-04.md`,
`AGENTIC-INTEGRATION-PLAN-2026-07-04.md`, `FLEET-COORDINATION-EXTENSIONS-2026-07-04.md`), encoded
on these rails precisely because the audit's own headline finding is that plans in this cluster
rot when they live outside the delivery machinery.

**The delivery oracle.** Every PH3 slice's `success:` is a named check in
`scripts/audit-delivery-check.mjs` — a deterministic verifier (no LLM, no network) with one
predicate per promised artifact, three baseline regression guards protecting what already works
(suggestion identity, CAS claims, the merge-gated odometer), and a staleness gate: `--check`
exits 1 if a baseline truth regresses OR if >14 days pass with undelivered slices and no commit
touching program files. Run it any time to answer "is the audit program actually being
delivered?" with evidence, from zero context. S13 wires it into a weekly cadence so the answer
arrives without anyone remembering to ask.

**Ordering.** S10–S13 are independent and `ready` (S10 is human-only — the OPAV plan file exists
only on the operator's Mac). S14 depends on S13 (the weekly routine surfaces the
shadow-agreement data that will justify promoting the verification stage to blocking); S15
depends on S14 (a `check:` field is only honest once something enforces it at the slice
boundary). Later tranches (I4 golden suites, I5 judge calibration, F2 hooks/GUPP, F3 escalation,
F8 stamps) get their own slices only after tranche 1 is `merged` — six open slices is the
attention budget; the rest of the program waits in the documents, not in the queue.

**Movement-band note.** PH3 slices advance `ns:l2-ojfbot#P2` in a 20→26 band that runs parallel
to the PH1/PH2 legs band (also baselined at 20) — the parent `current:` is hand-asserted and
rollup is shadow (audit finding P5). Treat each band's deltas as honest within itself; the
parent number reconciles when `northstar-rollup.mjs` exists.
