---
id: 20260803-0020-brief-newline-u14-content-and-remaining-units
type: brief
title: "Newline curriculum: verify last session's deliverables, fold new material into vault, then U14 content modules + remaining units"
actor: code-claude
to: code-claude
session_id: newline-curriculum-ingestion-2026-08-03
refs:
  - bead:20260803-0015-report-newline-vault-backfill-u14mp-u6-u11
  - bead:20260803-0000-brief-newline-vault-backfill-and-remaining-units
  - commit:newline-ai-course@dc3d64a
  - commit:newline-ai-course@cff485e
  - commit:selfco@c06100e
  - path:newline-ai-course/notes/README.md
hook: "github:ojfbot/core#319"
status: live
created_at: 2026-08-03T00:20:00-0500
labels:
  project: fde-operating-presence
  new_thread: true
---

## Step 0 — verify the prior session's deliverables (before any new work)

The 2026-08-03 session self-reports the following; corroborate each against ground truth
before building on it (evidence-tier discipline — beads are self-report):

1. `git -C ~/ojfbot/newline-ai-course log --oneline -3` shows `cff485e` (U6+U11) and
   `dc3d64a` (MP8/MP9) on top of `d6181eb`. Confirm these note files exist and are
   non-trivial: `notes/mp8-jira-assistant.md`, `notes/mp9-devops-assistant.md`,
   `notes/unit-06-foundational-concepts.md`, `notes/unit-11-advanced-concepts.md`.
2. `ls ~/ojfbot/newline-ai-course/materials/ | grep -E 'Unit6_|Unit11_'` shows 4 U6 PDFs
   (+.txt), 2 U11 PDFs (+.txt), 1 U11 zip — all gitignored (confirm `git status` clean).
3. `git -C ~/selfco log --oneline -2` includes `c06100e` and it is pushed
   (`git -C ~/selfco status` shows up to date with origin/main). Spot-check:
   `wiki/sources/newline-curriculum-ingestion-2026-08.md` exists;
   `wiki/entities/newline-ai-accelerator.md` contains a `[!contradiction]` callout;
   `wiki/concepts/judge-calibration-gate.md` + `wiki/concepts/ruler-grpo.md` exist;
   `wiki/log.md` has NO `<<<<<<<` markers.
4. `notes/README.md` status table shows U6/U11/MP8/MP9 as ingested, 9/9 mini-projects.

Any mismatch → stop, log it, correct before proceeding.

## Job 1 — fold the new material into the vault (small, do first)

MP8/MP9 + U6/U11 (commits dc3d64a, cff485e) are NOT in ~/selfco yet. Extend the existing
source page `wiki/sources/newline-curriculum-ingestion-2026-08.md` (or add a sibling
dated source page — follow ~/selfco/CLAUDE.md; git pull before / push after):
- MP8/MP9: crosslink into [[evaluation-driven-development]] (metric-bar-driven briefs) and
  the agent/harness cluster (simulation-mode writes = agents-on-rails; MP9's
  knowledge-base loop is a G5 template — touch [[fde-operating-presence]] if warranted).
- U6/U11: light touch — update the accelerator entity's Current state (10/18 courses),
  and consider whether DeepSeek MLA/MoE/MTP/FP8 warrants a claim on an existing concept
  page (do NOT create a new page unless it earns it).
- index.md one-liners + log.md entry; lint; commit + push.

## Job 2 — continue ingestion, priority order

1. **U14 content modules** (`case-study-f133`, enrolled; map in
   `notes/unit-14-case-studies.md`): start with modules 4/5 (reverse-engineering a code
   IDE + Windsurf architecture — Harness Engineering adjacency), then 6/7 (insurance
   CLIP-LoRA + insurance agent — enterprise builds). Per-module: Lecture Notes lesson →
   summary bullets + Supabase PDF → curl to materials/ → pypdf text → synthesis note
   section. One note file `notes/unit-14-content-modules.md` accumulating module
   sections is fine; don't do all 13 in one sitting if quality drops — log where you
   stopped in README.
2. **U12 remainder**: M4 Code lesson + the 5 exercise lessons (slug `finetuning-7b0f`).
3. **U17 recordings inventory** (`recordings-lectures-q-a-project-coaching-ai-accelerator-ac58`):
   structure pass only — list what recordings exist; flag any DSPy/GEPA session beyond
   the Harness Engineering one.
4. **U1–U3** (tutorials/coaching/intro): quick thin passes, likely one combined note.
5. **U7, U8, U10** (Shakespearian LLM, document processor, transformer LM): with U6+U11
   ingested these are optional depth — module maps + deck downloads, deep-read only if
   they add beyond U6/U11.
6. Harness Engineering **lecture recording** (DSPy/GEPA) — video, not curl-able; only
   worth attempting if simulator S1's judge work asks for it. Flag, don't grind.

## Portal mechanics (carry-over + this session's additions)

All of the prior brief's mechanics hold (read_page + targeted `javascript_tool` DOM maps;
UUID-rebuild for community links; `h1,h2,h3,h4,li,p` textContent; tables for numeric
bars; Supabase PDFs curl directly, extract with
`/Users/yuri/ojfbot/newline-ai-course/.venv/bin/python` + pypdf). New this session:

- **SPA serves the previous lesson's content on sidebar clicks.** Verify the
  "Module N of M · Lesson…" breadcrumb before trusting extraction; fix = full
  `?lesson=<uuid>` re-navigation + ~6s settle.
- **Enroll via DOM, not coordinates**: click the visible `button` with exact text
  "Enroll Now" (`offsetParent !== null`); far-right coordinate clicks open the AI-tutor
  sidebar. The button renders lazily — wait for the hero to paint. Toast = "Enrolled
  successfully"; **any payment step = STOP and flag** (none seen in 12 enrollments).
- **DLP blocks extraction output** containing `key=value` shapes and 25+-char tokens,
  not just hrefs — sanitize `=` and long tokens in the JS return value.

## Constraints (unchanged)

- Notes = compressed synthesis, never transcripts; quotes ≤1 short attributed line.
- PDFs/zips stay in gitignored `materials/`; repo stays local-only, no remote.
- fde-job-target.md corrections go in report beads, never silent edits.
- `notes/README.md` is the resume index — update rows as you go.
- Close with a report bead.

## State snapshot (so the next session needn't re-derive)

10 of 18 courses ingested (U4 U5 U6 U9 U11 U13 U15 U16 HE full; U12 partial), 9/9
mini-project briefs done, U14 = module map only, U1–U3/U7/U8/U10/U17 untouched.
Vault backfill current through the first three sittings (c06100e); MP8/MP9+U6/U11
pending (Job 1 above).
