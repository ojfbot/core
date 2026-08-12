---
id: 20260811-report-pocock-triage-sandcastle-cycle
type: report
title: "Pocock cycle: /triage refreshed to upstream state machine (F7 triage half closed); sandcastle adjudicated D54–D59"
actor: code-claude
session_id: 2026-08-11
refs:
  - file:decisions/adopt-stack/pocock-triage-refresh.md
  - file:decisions/adopt-stack/sandcastle.md
  - file:decisions/adr/0048-triage-skill.md
  - file:decisions/adr/0107-out-of-scope-knowledge-base.md
  - file:decisions/out-of-scope/README.md
  - github:ojfbot/core#432
status: closed
created_at: 2026-08-11T00:00:00Z
labels:
  project: pocock-adoption
---

## What shipped

Operator-prompted cycle (studying Pocock's triage + sandcastle). Upstream pins:
mattpocock/skills `84fdeff` (same as v1-2 — unmoved; #432 watch note), sandcastle
`e99f832` / npm 0.12.0.

**Triage refresh (D44–D53, closes the F7 triage half):** `/triage` absorbed the upstream
state machine around its protected rubric — full 4-route vocabulary + `needs-triage`
entry/exit, verify-before-brief (3 outcomes), agent-brief emission
(`knowledge/agent-brief.md`, no-paths durability rule), redundancy + prior-rejection
checks, needs-info Triage Notes + resume, opt-in `--prs` surface, AI disclaimer on
posted comments. New fleet convention: `decisions/out-of-scope/` rejected-concept KB
(ADR-0107, rides the decisions/ symlink). ADR-0048 Rev A records all calls incl. the
reverse-delta (upstream's missing blocked/implemented states — fleet already ahead).
Knowledge consolidated 10 files → 5 (Wave-1b over-fragmentation fix); skill stays
Aligned at 790 body words; catalog v1.24 adds routing triggers — holdout κ held at
0.603 exactly (gate pass, G13 unchanged).

**Sandcastle (D54–D59, decision-only):** REJECT as harness (ADR-0082
fourth-mechanism; day-runner incumbent) and REJECT session-resume in the unattended
rail (F6 fresh-context doctrine). Four ABSORBs routed as roadmap-slice suggestions
into prior art: Docker bind-mount sandboxing → gate-1 (draft-dispatch-queue),
implement-then-review stronger-model split → F4, completion signals + hanging-child
grace → runner hardening (F10 orphan fix), `ready-for-agent`-issue ingest →
draft-duplex-work-item-sync. Zero packages, zero code.

## Open items

- F7 `/deepen` half still unrun (deletion test, pick-and-grill, rejection-ADRs).
- The four D55–D58 slices need roadmap entry (they enter `needs-triage` like any inbound).
- Waves 2–4 remain unexecuted; description words 4,637 vs Wave-2 target 3,500; extended
  J-audit overdue (4 skills never J-passed).
- Deviation logged: Gate-0 shape vs role distinction (implementation-notes.md).
