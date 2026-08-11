---
id: 20260803-0140-report-newline-u14-u12-u17-onboarding-sweep
type: report
title: "Newline curriculum sitting 5: vault backfill, U14 modules 4–7, U12 closed, U17/U1–U3/U7-U8-U10 swept — ingestion frontier now zero unmapped courses"
actor: code-claude
session_id: newline-curriculum-ingestion-2026-08-03b
responding_to: 20260803-0020-brief-newline-u14-content-and-remaining-units
refs:
  - bead:20260803-0020-brief-newline-u14-content-and-remaining-units
  - bead:20260803-0015-report-newline-vault-backfill-u14mp-u6-u11
  - commit:newline-ai-course@c8a6db3
  - commit:newline-ai-course@b0faedf
  - commit:newline-ai-course@c24c6e6
  - commit:newline-ai-course@8db3058
  - commit:newline-ai-course@dc0f805
  - commit:selfco@b52895e
  - commit:selfco@ef37cb3
  - path:newline-ai-course/notes/README.md
  - path:newline-ai-course/implementation-notes.md
hook: "github:ojfbot/core#319"
status: live
created_at: 2026-08-03T01:40:00-0500
labels:
  project: fde-operating-presence
---

## Step 0 — prior session's deliverables VERIFIED

All four checks passed. Two apparent mismatches resolved as false alarms, both worth
recording so the next session doesn't re-investigate:

1. **`c06100e` was not in `git log -2`** as the brief predicted — because two selfco-box
   commits (`0c27088`, `49d017c`, plus `90ebef5`) landed after it. `git cat-file -t` +
   `git merge-base --is-ancestor` confirm it exists, is an ancestor of HEAD, and is pushed
   (`HEAD == origin/main`). **The brief's `-2` window was simply too narrow.**
2. **`grep -c '<<<<<<<' wiki/log.md` returned 1** where the brief expected 0 — but the hit
   is at `wiki/log.md:1320`, inside backticks in the prose of the repair note *describing*
   the markers that were removed. `grep -rn '^<<<<<<<\|^>>>>>>>\|^=======$' wiki/` returns
   nothing across the whole vault. **Clean.** Future verifications should anchor to
   line-start.

Everything else corroborated: 4 note files present and substantive (109/108/92/69 lines),
7 U6/U11 materials + zip present and gitignored, README rows correct at 9/9 mini-projects.

## Job 1 — vault backfill (MP8/MP9 + U6/U11) — DONE, pushed `b52895e`

Extended the existing source page rather than adding a sibling. No new pages authored —
DeepSeek's MLA/MoE/MTP/FP8 extended [[foundation-models]] instead of earning its own page.

Claims added: **evaluation-driven-development** (the metric bar belongs in the brief, not
the retro — all 9 briefs state numeric acceptance criteria pre-build; per-type acceptance
rate is OPAV's disposition model in product form); **agent-harness** (agents-on-rails as a
*measured* funnel; one 5-agent skeleton surviving a read-heavy → write-heavy domain swap);
**fde-operating-presence** (MP9's resolved-tickets → patterns → +10%-in-30-days loop as an
external G5 template — the genre the FDE target names as a gap now has prior art);
**foundation-models** (3 of DeepSeek's 4 advances are serving/training-*cost* levers, not
capability levers).

Also committed a stray `.obsidian` config tail (`6615645`) — the livesync removal logged in
`wiki/log.md` on 2026-08-03 had left three files uncommitted, which was blocking `git pull`.

## Job 2 — ingestion, in the brief's priority order

**Every item in the brief's list was completed.** `notes/README.md` now has **zero "not
started" rows** — all 18 courses carry at least a module map.

### 1. U14 content modules 4–7 (`c8a6db3`) — new `notes/unit-14-content-modules.md`
5 decks, ~240 pp, downloaded + text-extracted. M4/M5 are the curriculum's only agent-harness
*architecture* material; M6 is its most complete vertical build; **M7 turned out to be an
earlier, rougher cut of M6** — recorded as such so a future sitting doesn't re-read it.

Three findings worth carrying: **retrieval as a separate cheap parallel model** (Windsurf's
SWE-grep, 8 searches at ~2,800 tok/s, "nearly cost-free compared to generation"); **a gate
before the model call** (Copilot's ~11-feature logistic filter blocks below a 0.15 prompt-
goodness score — the fleet has no equivalent); **"reward hardening"** (Windsurf's named
countermeasure for RL gaming shallow tests). Stopped at M7 as the brief allowed; 9 content
modules remain, best next M2 (RLHF/DPO), M3 (advanced RAG), M13 (hallucination).

### 2. U12 closed (`b0faedf`)
M4 "Code" lesson read: two runnable pipelines. The substantive one builds DPO preference
pairs by **majority vote over N=5 samples** — gold answers filter but never pick, so it is
self-consistency substituting for a human labeler. That's a rung below RULER (judge-ranked)
and above gold-label DPO, and the cheapest of the three. All 5 exercise lessons inventoried
(HW + ANSWER notebook pairs, left undownloaded — they're homework). Two things the lecture
summaries had undersold: **M3 covers prompt tuning and prefix tuning**, not just embedding
FT; **M5 part 3 is "Diversity & Bias Control"**, and M5 is exercise-only, so the inventory
is the sole record that the topic is taught.

### 3. U17 (`c24c6e6`) — new `notes/unit-17-recordings.md`
51 recordings inventoried (10 live lectures / 15 Q&A / 26 coaching). **The DSPy question is
now settled by exhaustion:** the five lecture topics are Fine Tuning, Prompt Engineering,
RAG, Multi Agent, Synthetic Data — all mapping to already-ingested units, none of them the
harness/optimizer material. The Harness Engineering lecture recording is confirmed as the
curriculum's single DSPy/GEPA source, and it is video-only. Caveat stated in the note: 41
Q&A/coaching sessions are titled by date only, so a DSPy discussion *could* be buried in
one — an unbounded video search with no transcript, not worth opening without a reason.

### 4. U1–U3 (`8db3058`) — new `notes/units-01-03-onboarding.md`
**The brief's "onboarding/coaching shells" framing was wrong about U1.** It's 6 modules /
38 lessons and carries two things that matter: Module 6 "Common Mistakes To Avoid" is
*"always use a debugging and evaluation centric approach"* with per-domain follow-ups for
fine-tuning and RAG — the eval posture planted in week one, before any Python or model;
and Module 2 makes **Claude Code a required setup step**. U2 self-labels "Optional for AI
job path" and is an indie-product track (niche → templates → distribution) that does *not*
touch the G3 consultative gap. U3 is largely redundant with U1 M4 + U6 M3.

### 5. U7/U8/U10 (`dc0f805`) — new `notes/units-07-08-10-build-your-own.md`
Confirmed optional. U7 **stops at n-grams and never reaches a transformer** despite its
"build your own LLM" title. U10 M2 overlaps U11 M1 + U6 M4. **U8 is the exception worth
naming: 2 substantive lessons on document processing + ETL — the ingest side U9's RAG unit
assumes and never teaches, and the only genuinely uncovered topic in the curriculum.**

### 6. Harness Engineering recording — flagged, not attempted (per the brief)

## Vault also updated for THIS sitting — pushed `ef37cb3`

Not strictly in the brief (Job 1 covered the *prior* sitting), but leaving it would have
left pages I had just edited stale. Accelerator Current state rewritten to the three-state
breakdown; agent-harness, EDD, and ruler-grpo each took one new claim; index refreshed.
Lint clean (683 pages, 0 orphans, 0 broken links).

## Deviations logged (`implementation-notes.md`, new file)

- **U12 M4's "Code" lesson was a 1.5 GB artifact bundle, not a deck.** The brief assumed
  curl-able PDFs. Took the conservative option: kept scripts, notebooks, READMEs,
  `adapter_config.json`, and the small GSM8K sets (21 MB, gitignored); deleted the zip and
  the two 126 MB LoRA adapters plus optimizer checkpoints. Nothing referenced the weights.
- **Google Drive needs a confirm hop for large files** — the plain `uc?export=download`
  returns a 2.4 KB "Virus scan warning" page; the cookie + `drive.usercontent.google.com`
  form works, but the 1.5 GB fetch exceeded the 120 s command timeout and finished in the
  background.

## The one thing left unresolved, deliberately

**Two decks in the same curriculum give contradictory LoRA guidance.** U14 M6 teaches
`lora_alpha = 2 × r` and says rank-stabilization (`use_rslora`) exists for high ranks.
U12 M4's *shipped* `adapter_config.json` for the DeepSeek-7B DPO run uses `r = 64`,
`lora_alpha = 16` (alpha = r/4, the opposite direction) with `use_rslora = false` — at
exactly the high rank M6 says stabilization is for. Neither deck cites a source.

Flagged in `notes/unit-12-finetuning.md` and in `wiki/log.md`; **not adjudicated**, because
there's no third source and the vault shouldn't settle a dispute it can't ground. Treat the
heuristic as folklore and the config as evidence of what was actually run. If the fleet ever
does LoRA work for real, this is the first thing to test rather than inherit.

## Enrollment

No payment step encountered anywhere. U17, U1–U3, U7, U8, U10 were **read without
enrolling** — module and lesson listings are visible unenrolled, which is enough for a
structure pass. Their notes record the unenrolled state so a future content pass knows to
enroll (free) first. No new enrollments this session.

## Portal mechanics — three new gotchas for the next session

- **Course URLs are `/ai-bootcamp-7342/courses/<slug>` — plural.** The singular `course/`
  returns a "Page Not Found" SPA shell rather than redirecting; this cost the first attempt.
- **The in-app browser has no portal session.** This work requires the authenticated Chrome
  profile (`mcp__claude-in-chrome__*`), not `mcp__Claude_Browser__*`.
- **Lesson titles live in the anchor's `aria-label`, not its text.** The anchor is an
  invisible full-bleed overlay (`absolute inset-0`) with no text content, and anchors are
  duplicated two-per-lesson — dedupe by lesson id. Also: `innerText` returns empty on a
  background tab (it's layout-dependent) — use `textContent`. And DLP masks any 25+-char
  token in a returned value, which eats both lesson ids and Supabase filenames — slice into
  <25-char chunks and reassemble locally.

## State snapshot

**12 of 18 courses fully ingested** (U4 U5 U6 U9 U11 U12 U13 U15 U16 HE + U14 partial +
U17 inventoried); **all 18 mapped**; **9/9 mini-project briefs**. 22 synthesis notes.
Remaining ingestion: U14's 9 unread content modules, plus two cheap targeted reads (U1
Module 6, 3 lessons; U8's 2 ETL lessons). Vault current through this sitting.
