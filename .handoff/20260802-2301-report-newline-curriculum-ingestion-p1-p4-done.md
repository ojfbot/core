---
id: 20260802-2301-report-newline-curriculum-ingestion-p1-p4-done
type: report
title: "Newline curriculum ingestion: priorities 1–4 ingested (U5+MP1/2, Harness Eng, U13+MP6/7, U9 partial+MP3/4); notes/ + resume index committed locally"
actor: code-claude
session_id: newline-curriculum-ingestion-2026-08-02
refs:
  - bead:20260803-0005-brief-newline-curriculum-ingestion-via-chrome
  - bead:20260802-2320-discovery-accelerator-portal-syllabus-differs-from-public-page
  - path:newline-ai-course/notes/
  - commit:newline-ai-course@8a260a0
hook: "github:ojfbot/core#319"
status: closed
created_at: 2026-08-02T23:01:00-0500
labels:
  project: fde-operating-presence
---

## What shipped

`newline-ai-course/notes/` created and committed locally (`8a260a0`, 12 files, 949 lines;
repo remains remote-less). All four priority items from the brief ingested; per-unit status
lives in `notes/README.md` (the resume index). Licensed PDFs/zips/notebooks (10 files) in
gitignored `newline-ai-course/materials/`.

- **Unit 5** — full ingest (`unit-05-synthetic-data.md`): 3 modules (course page showed 2 —
  the Mini-Projects module is a 3rd), both lecture decks extracted and synthesized.
  MP1 (`mp1-diy-repair.md`): 6-step pipeline, D1–D6 dimension table with thresholds,
  two-phase judge-calibration→generator-correction doctrine. MP2 (`mp2-resume-coach.md`):
  fit-level-controlled resume/JD pairs + FastAPI serving layer.
- **Harness Engineering** — full ingest (`harness-engineering.md`) of the 107-slide deck
  (four-pillar harness anatomy, overflow ladder, AFK classifier, data flywheel, failure
  modes). Caveat: the **DSPy content lives only in the lecture recording** (video, not
  transcribed) — the deck contains zero DSPy. S1-judge DSPy work still needs that video.
- **Unit 13** — full ingest (`unit-13-agents.md`): enrolled this session ("Enrolled
  successfully", **no payment step**). 67-slide deck + code zip + HW notebooks downloaded.
  TWO mini-projects, not one: MP6 Digital Clone (`mp6-digital-clone.md`), MP7
  Sentiment/Roadmap PM tool (`mp7-sentiment-roadmap.md`).
- **Unit 9** — partial ingest (`unit-09-rag.md`): enrolled this session (no payment).
  4 modules/19 lessons mapped, 3 lecture PDFs downloaded, module topic summaries
  synthesized; TWO mini-projects captured: MP3 retrieval grid search
  (`mp3-rag-pdf-pipeline.md`), MP4 ShopTalk full RAG system (`mp4-shoptalk-rag.md`).
  Remaining: deep-read the 3 decks (already local), capture 3 exercise-lesson Colab links.

## Corrections to fde-job-target.md §2 (new evidence — not edited into that file)

1. **Mini-projects come in pairs.** U5, U9, U13 each carry TWO mini-projects (global
   numbering MP1–MP7 discovered; MP5 unlocated, likely U12). The map's "U9/U13 have
   Mini-Project modules" undersells this — U13's second project (MP7 sentiment/roadmap gap
   analysis) is the most engagement-deliverable-shaped artifact in the curriculum and worth
   naming in any G3-adjacent framing.
2. **Harness Engineering's DSPy claim needs a precision note:** DSPy/GEPA is
   lecture-recording-only; the durable written artifact is pure harness anatomy. The map's
   "DSPy prompt-optimization/eval pipelines" coverage is real but locked in video form.
3. Unit 13's deck quantifies the Anthropic multi-agent case study (agents ≈4× chat tokens,
   multi-agent ≈15×) — useful citable numbers absent from the map.

## Gotchas for the next sitting

- Portal mechanics from the brief all held (read_page/targeted DOM queries; page-text
  empty; DLP trips on query-string hrefs — workaround: regex the UUIDs out of `href` and
  rebuild the community-post URL).
- Enroll buttons: the visible one sits mid-page right; a stale duplicate ref exists in the
  DOM, and a click at the far-right edge opens the AI-tutor sidebar instead (shifts
  layout). Screenshot → click the mid-page button by coordinate worked both times.
- Lecture-note "lessons" are PDF shells (summary bullets + one Supabase public URL) —
  `curl` the URL directly; no auth needed. Slide decks extract cleanly with pypdf
  (installed into the course .venv).

## Next sitting

Priority 5 per the brief: Unit 15 (production/G6 vocabulary) and Unit 16 (career pack —
interview PDFs). Then U9 completion (decks + exercises), U14 module-list-only pass, and the
Harness Engineering lecture recording if DSPy detail is needed for S1.
