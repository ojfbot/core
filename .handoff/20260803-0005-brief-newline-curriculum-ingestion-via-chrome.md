---
id: 20260803-0005-brief-newline-curriculum-ingestion-via-chrome
type: brief
title: "Newline Accelerator curriculum ingestion via Chrome — structured unit notes, gap-targeted priority order"
actor: code-claude
to: code-claude
session_id: fde-skills-audit-2026-08-02
refs:
  - bead:20260802-2320-discovery-accelerator-portal-syllabus-differs-from-public-page
  - bead:20260802-2145-report-fde-skills-audit-curriculum-map-roadmap-shipped
  - file:personal-knowledge/fde-job-target.md
  - file:personal-knowledge/fde-gap-simulators-roadmap.md
  - path:newline-ai-course/
hook: "github:ojfbot/core#319"
status: live
created_at: 2026-08-03T00:05:00-0500
labels:
  project: fde-operating-presence
  new_thread: true
---

## Context

The 2026-08-02 session mapped the real Accelerator syllabus from the authenticated portal
(https://community.newline.co/ai-bootcamp-7342/courses): **17 units + a standalone "Harness
Engineering" course**; full unit/module/lesson enumeration is in the discovery bead and
`personal-knowledge/fde-job-target.md` §2. What does NOT exist yet is *ingested content* —
structured notes a session can work from without the portal open. That is this thread's job.

**Portal mechanics (learned the hard way — do not re-derive):**

- Use the **claude-in-chrome** tools (user's real Chrome, logged-in session). Course pages are a
  SPA: `get_page_text` and `innerText` return empty; raw `textContent` dumps trip the DLP filter.
  **What works:** `read_page` (accessibility tree) and targeted DOM queries via `javascript_tool`
  (e.g. map over `h1,h2,h3,h4,li,p` textContent, or `a[aria-label^="Open lesson"]` for lesson
  lists — never dump whole-body text).
- Lesson bodies are **enrollment-gated**. Enrolling is free within the membership ("Enrolled
  successfully" toast, no payment step). Already enrolled: Units 1, 3, 5, 15, 16, Harness
  Engineering. If any enroll click ever shows a payment step, STOP and flag.
- Lesson URL pattern: `/ai-bootcamp-7342/courses/<slug>?lesson=<uuid>`. Course slugs:
  U1 `tutorials-onboarding-debugging-environment-a14b` · U2 `coaching-copy-8e3f` ·
  U3 `introduction-8105` · U4 `prompt-engineering-49a5` · U5 `synthetic-data-generation-cf8f` ·
  U6 `foundational-ai-concepts-e699` · U7 `building-your-own-shakespearian-llm-model-a1ca` ·
  U8 `document-processor-copy-ebe1` · U9 `rag-2c2e` ·
  U10 `building-the-transformer-based-language-model-69a7` ·
  U11 `advance-foundation-llm-concepts-c9b1` · U12 `finetuning-7b0f` ·
  U13 `ai-agents-and-patterns-copy-f36f` · U14 `case-study-f133` · U15 `ai-in-production-b885` ·
  U16 `ai-career-path-d711` · U17 `recordings-lectures-q-a-project-coaching-ai-accelerator-ac58` ·
  Harness Eng `harness-engineering-9deb`.
- Deep content often lives in **downloadable PDFs** ("How to Access → click title"), e.g.
  `AI Engineer Career Paths.pdf`, `Unit_2.1.1_Harness_engineering_progressive_diagrams.pdf`,
  and the Unit 16 interview pack. Downloading is authorized by this brief for course materials
  only — state filename + destination as you go; keep downloads in `newline-ai-course/materials/`
  (gitignore them; they are licensed course content).
- Mini-project briefs are **community posts**, not lessons. Unit 5's two:
  MP1 (DIY repair) `community?space=c20ca4d0-a37b-4357-af54-0783c8a9d65c&post=f6bbc75d-3aa4-4452-9037-270f81406760`;
  MP2 (resume coach) `community?space=f61e15b1-8a29-45a1-a1bd-9ccb6efa9724&post=63564592-944e-459f-9299-b8095e75c024`.
  U9/U12/U13/U14 also have Mini-Project modules — capture their brief links too.

## Goal

Produce `newline-ai-course/notes/` — one structured markdown note per ingested unit:

- Frontmatter: unit number, slug, modules, lesson count, genre tags (G1–G6 per
  `fde-job-target.md` §2), roadmap moves it feeds (parent moves 1–7, simulators S1–S4).
- Body: **synthesis in your own words** — key concepts, techniques, tools named, exercise list,
  what the quiz probes; a "what this feeds in the fleet" section mapping content to concrete
  repos/moves (e.g. U5 → pass^k slice on diy-repair-qa-eval; Harness Eng DSPy → S1 judge).
- A materials inventory per unit: PDFs/files available, which were downloaded to `materials/`.
- An index note (`notes/README.md`): ingestion status per unit (ingested / partial / not started),
  so later sittings resume cleanly.

**Priority order (gap-targeted, from the roadmap — do not ingest 1→17 linearly):**
1. Unit 5 (feeds S1–S4 method + the two existing mini-projects) + its MP1/MP2 community briefs
2. Harness Engineering (feeds S1 judge via DSPy + G2 positioning language)
3. Unit 13 agents + its mini-project brief (feeds S2/S3 + next public artifact)
4. Unit 9 RAG + mini-project brief
5. Unit 15 production (G6 vocabulary) · Unit 16 career pack (application-time assets)
6. Everything else opportunistically; Unit 14's 69 case-study lessons are a later pass — capture
   its module list + mini-project links only, unless time remains.

## Acceptance criteria

- [ ] `notes/README.md` index exists with per-unit status; at least priority items 1–4 ingested.
- [ ] Every note is synthesis, not transcription (see Constraints); materials inventoried.
- [ ] Mini-project briefs for U5/U9/U13 captured as their own notes (these gate builds).
- [ ] Enrollments performed as needed, each confirmed no-payment; any payment prompt = stop+flag.
- [ ] A report bead closes the session, noting per-unit status and anything the curriculum map in
      `fde-job-target.md` §2 got wrong (corrections are new evidence, flag them — don't silently
      edit that file's verdicts).

## Constraints

- **Copyright:** course content is licensed material. Notes are compressed synthesis in your own
  words — no verbatim lecture transcripts, no wholesale copying of lecture-note text, quotes
  ≤1 short attributed line each. Downloaded PDFs stay local in gitignored `materials/`, never
  committed, never republished.
- **newline-ai-course is local-only** (no GitHub remote observed) — commits are local; do not
  create a remote.
- No changes to `personal-knowledge/` verdicts from this thread (corrections go in the report
  bead); no publishing to any public surface; employer/client boundary applies as always.
- One sitting will not cover 17 units — that is expected. The index note is the resume point;
  do not rush unit 14.
