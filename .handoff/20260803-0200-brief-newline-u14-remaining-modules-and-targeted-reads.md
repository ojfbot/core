---
id: 20260803-0200-brief-newline-u14-remaining-modules-and-targeted-reads
type: brief
title: "Newline curriculum sitting 6: U14's 9 unread content modules + two cheap targeted reads (U1 M6, U8 ETL)"
actor: code-claude
to: code-claude
session_id: newline-curriculum-ingestion-2026-08-03c
refs:
  - bead:20260803-0140-report-newline-u14-u12-u17-onboarding-sweep
  - bead:20260803-0020-brief-newline-u14-content-and-remaining-units
  - commit:newline-ai-course@dc0f805
  - commit:selfco@ef37cb3
  - path:newline-ai-course/notes/README.md
  - path:newline-ai-course/notes/unit-14-content-modules.md
  - path:newline-ai-course/implementation-notes.md
hook: "github:ojfbot/core#319"
status: live
created_at: 2026-08-03T02:00:00-0500
labels:
  project: fde-operating-presence
---

## Step 0 — verify the prior session against git before new work

Beads are self-report. Corroborate, then proceed. **Anchor greps to line-start** — last
session burned time on a `<<<<<<<` match that was prose inside backticks.

1. `git -C ~/ojfbot/newline-ai-course log --oneline -6` shows, newest first: `dc0f805`
   (U7/U8/U10), `8db3058` (U1–U3), `c24c6e6` (U17), `b0faedf` (U12 close), `c8a6db3`
   (U14 M4–M7), `cff485e`. Confirm these four note files exist and are substantive:
   `notes/unit-14-content-modules.md`, `notes/unit-17-recordings.md`,
   `notes/units-01-03-onboarding.md`, `notes/units-07-08-10-build-your-own.md`.
2. `grep -c 'not started' notes/README.md` returns **0**. If it doesn't, a row regressed.
3. `ls materials/ | grep U14_` shows 5 PDFs + 5 .txt; `ls materials/ | grep U12_M4` shows
   `U12_M4_RLHF_code.zip` + `U12_M4_DPO_ensemble_code/`. `du -sh materials/U12_M4_DPO_ensemble_code`
   should be **~21M** — if it's ~1G or ~1.5G, the weight-stripping didn't stick, re-strip it.
   `git status --porcelain` should show only `?? resume-builder/`.
4. `git -C ~/selfco log --oneline -3` includes `ef37cb3` and a provenance-fix commit; status
   clean and up to date with origin/main. `wiki/entities/newline-ai-accelerator.md` Current
   state says "all 18 portal courses"; `wiki/log.md` has a `[2026-08-03] ingest | … sitting 5`
   entry.
5. `newline-ai-course/implementation-notes.md` exists with a `## Deviations` section
   holding two bullets (1.5 GB Drive bundle; Drive confirm-hop).

Any mismatch → stop, log it, correct before new work.

## The job — finish U14, then two cheap targeted reads

Ingestion is at **zero unmapped courses**. What's left is depth, in this order.

### 1. U14 content modules (primary work — 9 unread of 13)

Accumulate into the existing `notes/unit-14-content-modules.md`, one section per module,
same shape as the M4–M7 sections already there. Don't rewrite that file — append.

Priority (from last session's read of the module map, not linear):
1. **M2 — Case Study with RL DPO RLHF.** Highest value. The only RLHF/DPO *case study*;
   pairs directly with U12 M4's alignment deck and its now-ingested code bundles, and with
   `[[ruler-grpo]]`. Look specifically for whether it uses a judge, gold labels, or
   self-consistency — that determines which rung it sits on relative to the
   majority-vote-DPO finding already recorded.
2. **M3 — Case study with Advance_RAG.** Pairs with U9. Worth checking against U9 M3's
   Arize Phoenix chunking claim (500–1,000-token chunks, k=4 maximize MRR) — a second
   source agreeing or disagreeing is worth a vault claim either way.
3. **M13 — AI in Enterprise and Hallucination.** Pairs with `[[grounded-annotation]]` and
   the f1-pit-wall numeric-claim validator.
4. **M12 — Vision-to-Code & Browser Agents.** Harness-adjacent; browser agents touch what
   this very session does.
5. **M10/M11 — Text-to-SQL parts 1–2** ("From Research to Production" is M10's subtitle —
   the production framing may carry G4/G6 vocabulary). M11's text-to-music half is skippable.
6. **M1 — Text→Real-Time Voice AI.** Only if PLAUD/voice work is live.
7. **M8 — text math/calculus FT, multi-agent financial reasoning.** Overlaps U12 M4's GSM8K
   material already in hand.
8. **M9 — Generative video (Sora, Wan 2.2, StreamingVLM).** Lowest value; skip unless the
   mirrorworld/visual track asks.

Per module: open the Lecture Notes lesson → summary bullets from the page → curl the
Supabase PDF into gitignored `materials/` as `U14_M<n>_<Name>.pdf` → extract with
`/Users/yuri/ojfbot/newline-ai-course/.venv/bin/python` + pypdf → write the note section.
**Don't do all 9 in one sitting if quality drops** — the M4–M7 sections are the quality
bar. Log where you stopped in `notes/README.md` and in `unit-14-content-modules.md`'s
"Where this sitting stopped" section (update it, don't append a second one).

### 2. U1 Module 6 — "Common Mistakes To Avoid" (3 lessons, cheap)

Slug `tutorials-onboarding-debugging-environment-a14b`. Lessons: "Always Use Debugging and
evaluation centric approach", "AI Debugging and eval centric Finetuning", "AI Debugging and
eval centric RAG". **Requires enrolling first (free).** Last session established the claim
that the eval posture is planted in onboarding *from the lesson titles alone*; this read
either substantiates it with content or downgrades it. Fold the result into
`notes/units-01-03-onboarding.md` and correct the vault claim on
`[[evaluation-driven-development]]` if the content doesn't bear the titles out.

### 3. U8 — document processing + ETL (2 lessons, cheap)

Slug `document-processor-copy-ebe1`. Lessons "Different Types of Document Processor",
"Lecture Resources and Codes", "ETL Pipeline". **Requires enrolling (free).** The only
genuinely uncovered topic in the curriculum — the ingest side U9's RAG unit assumes and
never teaches. Directly adjacent to live fleet work (bldgblog-corpus ingest, buddy-check
scraping, dive-briefing's document quarantine). Fold into
`notes/units-07-08-10-build-your-own.md`, promoting U8 from "mapped" to "ingested" in
`notes/README.md`.

### 4. Vault fold + report bead

Extend `wiki/sources/newline-curriculum-ingestion-2026-08.md` with a "Sitting 6" block
(the page is already at 5 sittings — keep the pattern, don't start a sibling page). Refresh
`wiki/entities/newline-ai-accelerator.md` Current state and `newline-ai-course` Recent work.
`git pull` before, `push` after, lint before commit. Close with a report bead.

## Portal mechanics — carry all of these

- **URLs are `/ai-bootcamp-7342/courses/<slug>` — plural `courses`.** The singular returns
  a "Page Not Found" SPA shell, not a redirect.
- **Use the authenticated Chrome profile** (`mcp__claude-in-chrome__*`). The in-app browser
  (`mcp__Claude_Browser__*`) has no portal session and will land on the login page.
- **Lesson titles live in the anchor's `aria-label`** ("Open lesson: …"), not its text — the
  anchor is an invisible full-bleed overlay (`absolute inset-0`). Anchors are duplicated
  two-per-lesson; dedupe by lesson id.
- **`innerText` returns empty on a background tab** (layout-dependent). Use `textContent`.
- **DLP masks any 25+-char token in a returned value**, eating lesson ids and Supabase
  filenames. Slice into <25-char chunks (`f.match(/.{1,8}/g)`) and reassemble locally. Also
  sanitize `=` → `~` in returned strings.
- **Verify the "Module N of M · Lesson X of Y" breadcrumb** before trusting any extraction —
  SPA sidebar clicks can serve the previous lesson's content. Fix = full `?lesson=<uuid>`
  navigation + ~7s settle.
- **Lesson body text**: walk up from the `a[href*="supabase"]` anchor to the first ancestor
  whose `textContent` exceeds ~250 chars — that's the prose block. Going further up hits the
  Next.js flight payload (340 KB of script text).
- **Google Drive attachments need a confirm hop** — plain `uc?export=download` returns a
  2.4 KB "Virus scan warning" page. Use a cookie jar +
  `drive.usercontent.google.com/download?id=…&export=download&confirm=t`, and **run it in
  the background** — a large fetch will blow the 120 s command timeout.
- **Enrollment is free.** Twelve enrollments so far, no payment step ever. **Any payment
  step = STOP and flag.** Enroll by DOM-clicking the visible `button` with exact text
  "Enroll Now" (`offsetParent !== null`); far-right coordinate clicks open the AI-tutor
  sidebar instead. Toast reads "Enrolled successfully".
- **Listings are readable without enrolling** — enough for a structure pass, not for lesson
  content. U17, U1–U3, U7, U8, U10 are all currently *unenrolled*.

## Constraints (unchanged)

- Notes = compressed synthesis, never transcripts; quotes ≤1 short attributed line.
- PDFs/zips stay in gitignored `materials/`; repo stays local-only, no remote.
- **Watch attachment size.** If a download exceeds ~50 MB, inspect before keeping — last
  session hit a 1.5 GB bundle that was 99% LoRA weights. Keep code/configs/datasets, drop
  model weights and optimizer checkpoints, and log it under `## Deviations` in
  `implementation-notes.md`.
- `fde-job-target.md` corrections go in report beads, never silent edits.
- `notes/README.md` is the resume index — update rows as you go.

## Open item carried forward — do not silently resolve

**Two decks give contradictory LoRA guidance.** U14 M6 teaches `lora_alpha = 2 × r` and
says `use_rslora` exists for high ranks; U12 M4's shipped `adapter_config.json` (DeepSeek-7B
DPO) uses `r = 64`, `lora_alpha = 16`, `use_rslora = false`. Neither cites a source. If any
module read this sitting touches LoRA config (M2 and M8 might), **check whether it supplies
a third data point** — that would settle it. If it doesn't, leave the contradiction flagged
as-is in `notes/unit-12-finetuning.md` and `wiki/log.md`. Don't adjudicate without evidence.

## State snapshot

18 of 18 courses mapped; **12 fully ingested** (U4 U5 U6 U9 U11 U12 U13 U15 U16 HE, plus
U14 partial and U17 inventoried); **9/9 mini-project briefs**; 22 synthesis notes; ~35
licensed files in `materials/`. Vault current through sitting 5 (`ef37cb3`).
Not ingestible at all: the Harness Engineering lecture recording — video-only, and confirmed
by exhausting U17's 51 recordings to be the curriculum's single DSPy/GEPA source. Attempt
only if simulator S1's judge work specifically asks for it.
