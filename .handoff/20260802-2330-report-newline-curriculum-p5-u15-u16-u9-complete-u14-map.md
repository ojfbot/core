---
id: 20260802-2330-report-newline-curriculum-p5-u15-u16-u9-complete-u14-map
type: report
title: "Newline curriculum sitting 2: U15 + U16 (incl. interview pack) ingested, U9 completed, U14 module map + 2 MP links; brief's full priority list now covered"
actor: code-claude
session_id: newline-curriculum-ingestion-2026-08-02
refs:
  - bead:20260803-0005-brief-newline-curriculum-ingestion-via-chrome
  - bead:20260802-2301-report-newline-curriculum-ingestion-p1-p4-done
  - path:newline-ai-course/notes/
  - commit:newline-ai-course@267cd61
hook: "github:ojfbot/core#319"
status: closed
created_at: 2026-08-02T23:30:00-0500
labels:
  project: fde-operating-presence
---

## What shipped (commit `267cd61`, continuing same session as the p1–p4 report)

- **Unit 15 — full ingest** (`unit-15-production.md`): 46-slide "Production-Grade AI" deck
  extracted + synthesized; exercise notebook downloaded. G6 vocabulary source — semantic
  observability, fail-closed guardrails, canary thresholds, autoscale-on-queue-depth,
  decoder-only technique ladder + playbooks. Deck names essentially every switchboard
  feature; note frames switchboard as "the fleet's implementation of the U15 production
  chain."
- **Unit 16 — full ingest** (`unit-16-career.md`): 37-slide career deck + the interview
  pack: 8 files downloaded (50-questions, GenAI Qs, LLM Qs, cheat sheet, LLM+Agent guide,
  AI-resume.tex + rendered example, Leetcode patterns). The 8 full reference books (Chip
  Huyen, Raschka, Alammar, …) were deliberately NOT downloaded — large; links live in the
  lesson + note. ATS Google-dork template captured verbatim (directly usable for FDE-role
  scanning). Portfolio doctrine confirmed as presentation-gap for the fleet (artifact count
  already exceeds 8+1; pinned-repo/diagram/demo-link packaging is what's missing).
- **Unit 9 — completed**: all 7 exercise Colab links captured across 3 modules (incl. a
  vision-based document-parsing prerequisite and a multi-modal retrieval-comparison
  exercise); M3 case-studies deck (23pp) read and folded into the note — key additions:
  Arize Phoenix chunking finding (500–1k tokens, k=4 max MRR), the high-MRR/low-faithfulness
  gap + RAGAS component eval, doc2query pitfalls, Notion AI Cohere-Rerank example. M1/M2
  deck text extracted alongside PDFs for on-demand deep-read.
- **Unit 14 — module map** (`unit-14-case-studies.md`): enrolled (free, no payment step —
  third enrollment this session, same behavior). 14 modules / 69 lessons listed; TWO
  mini-projects discovered and links captured: **AI-Powered Jira Assistant** and
  **AI-Powered DevOps Assistant** (both multi-agent). Content pass deferred per brief.

## Brief status after this sitting

All acceptance criteria met and the entire priority list (1–5 + U14 structure) is covered.
Ingested: U5, U9, U13, U15, U16, Harness Eng (6 of 18 courses) + 6 MP briefs + U14 map.
Not started: U1–U4, U6–U8, U10–U12, U17. Enrollments now: U1, U3, U5, U9, U13, U14, U15,
U16, Harness Eng.

## New evidence for the curriculum map

- U14's mini-projects are enterprise-ops-shaped (Jira copilot, DevOps automation) — with
  U13's MP7, that makes three artifacts in the curriculum aimed at internal-tooling
  deliverables; strengthens the "mini-project cadence produces public artifacts" leverage
  claim in fde-job-target §2.
- U16 pack includes an Amazon-specific LP eval doc (Google Drive link, not downloaded) —
  suggests cohort members target Amazon loops; minor but useful for interview-prep context.

## Next sitting

Opportunistic tier only: U4 prompt engineering / U12 finetuning (locate MP5) / U6 or U11
foundations, or begin U14 module passes (modules 4/5 IDE-architecture overlap Harness Eng;
modules 6/7 insurance builds). Also outstanding: Harness Eng DSPy lecture recording if S1
needs it.
