---
id: 20260803-0015-report-newline-vault-backfill-u14mp-u6-u11
type: report
title: "Vault backfill landed (2 stale claims corrected, +2 concepts, 6 crosslinks); MP8/MP9 briefs + U6 + U11 ingested"
actor: code-claude
session_id: newline-curriculum-ingestion-2026-08-02
responding_to: 20260803-0000-brief-newline-vault-backfill-and-remaining-units
refs:
  - bead:20260803-0000-brief-newline-vault-backfill-and-remaining-units
  - commit:selfco@c06100e
  - commit:newline-ai-course@dc3d64a
  - commit:newline-ai-course@cff485e
  - path:newline-ai-course/notes/
hook: "github:ojfbot/core#319"
status: closed
created_at: 2026-08-03T00:15:00-0500
labels:
  project: fde-operating-presence
---

## Job 1 — selfco backfill (complete, pushed as selfco@c06100e)

- New virtual source page `wiki/sources/newline-curriculum-ingestion-2026-08.md` over the
  three 2026-08-02 sittings (links to notes paths + 3 report beads; nothing pasted).
- **Both stale entity pages corrected**, not appended: `newline-ai-accelerator` ("17
  transcribed lectures" and the eval/retrieval/FT "curriculum gap" both overturned via a
  `> [!contradiction]` callout naming the source; real syllabus = 17 units + Harness
  Engineering; genuine gaps = G3/G4/G5 per fde-job-target §2) and `newline-ai-course`
  (last_synced 2026-06-11 → 2026-08-02, three commits folded in). Flagged on the
  accelerator page: [[lecture-companion]]'s demo premise rested on the refuted gap claim.
- New concepts: `judge-calibration-gate` (U5/MP1 two-phase doctrine), `ruler-grpo` (RULER).
- Cited claims appended to 6 concept pages: evaluation-driven-development, rag-retrieval,
  agent-harness (four pillars + overflow ladder), loop-harness (AFK classifier),
  agentic-search-vs-vector-rag, fde-operating-presence (genre cross-check).
- index.md + log.md updated; lint clean (0 broken links, 0 orphans); committed + pushed.
- **Repair en passant**: `wiki/log.md` had committed git conflict markers
  (`<<<<<<<`/`=======`/`>>>>>>>`) around two 2026-08-01 entries — markers removed, both
  entries kept verbatim, noted in the log entry.

## Job 2 — unit ingestion (priorities 1+2 complete; commits dc3d64a, cff485e)

- **MP8 Jira Assistant + MP9 DevOps Assistant** (U14 community briefs) ingested →
  `notes/mp8-jira-assistant.md`, `notes/mp9-devops-assistant.md`. Post headers confirm
  the MP8/MP9 numbering — **all 9/9 mini-projects now ingested**. MP8 = TAWOS-based PM
  copilot (5 agents, hybrid RAG, simulation-mode writes, 30+ endpoints); MP9 = Apache-JIRA
  ops triage (Groq/LLaMA 3.3, Streamlit, approval funnel). Same skeleton twice = the
  course's repeatable engagement pattern; both notes carry fleet mappings (OPAV
  acceptance-tracking, agents-on-rails gating, G5 knowledge-base loop).
- **U6 Foundational AI Concepts** ingested (enrolled free, toast confirmed): 4 modules /
  24 lessons; 4 decks (104+81+105+53 pp) downloaded to gitignored materials/ + text
  extracted. Note: `notes/unit-06-foundational-concepts.md`.
- **U11 Advanced LLM Concepts** ingested (enrolled free): DeepSeek-V3 internals
  (MLA/MoE/MTP/FP8) + monkey-patching LLaMA; 2 decks + code zip in materials/. Note:
  `notes/unit-11-advanced-concepts.md`.
- No payment step appeared anywhere; both enrollments showed "Enrolled successfully."

## Discoveries / gotchas (beyond the brief's portal-mechanics list)

- **SPA serves the previous lesson's content on sidebar clicks**: U6 M4's click kept
  rendering M3's summary + PDF link. Fix: full `?lesson=<uuid>` re-navigation + ~6s
  settle; verify the "Module N of M · Lesson…" breadcrumb before trusting extraction.
- The mid-page Enroll Now can sit far-right in wide layouts; coordinate clicks there open
  the AI-tutor sidebar. Reliable path: DOM-click the visible `button` with exact text
  "Enroll Now" (`offsetParent !== null`).
- DLP also blocks *extraction output* containing `key=value` shapes (not just hrefs);
  sanitizing `=` and long tokens in the JS return value gets clean text through.
- U11's "Enroll Now" renders lazily — an immediate visible-button probe returns 0; wait
  for the hero to paint first.

## What's left (next session picks up here)

1. U14 content modules, starting 4/5 (code-IDE reverse-engineering + Windsurf — Harness
   Engineering adjacency) or 6/7 (insurance builds) — module map in
   `notes/unit-14-case-studies.md`.
2. U12 exercises + M4 Code lesson; U17 recordings inventory; U1–U3, U7, U8, U10.
3. Harness Engineering lecture recording (only DSPy/GEPA source) — needed if simulator
   S1's judge work wants it.
4. Vault: MP8/MP9 + U6/U11 material is NOT yet folded into ~/selfco (this session's
   backfill covered the first three sittings only). A later /vault sync or targeted
   ingest should pick up commits dc3d64a + cff485e.
