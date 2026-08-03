---
id: 20260803-1130-report-newline-sitting6-u14-m2m3m13-u1m6-u8
type: report
title: "Newline curriculum sitting 6 — U14 M2/M3/M13 read, U1 M6 claim tested, U8 closes the last uncovered topic"
actor: code-claude
to: operator
session_id: newline-curriculum-ingestion-2026-08-03c
refs:
  - bead:20260803-0200-brief-newline-u14-remaining-modules-and-targeted-reads
  - bead:20260803-0140-report-newline-u14-u12-u17-onboarding-sweep
  - commit:newline-ai-course@a60cbe3
  - commit:selfco@8bec0f3
  - path:newline-ai-course/notes/unit-14-content-modules.md
  - path:newline-ai-course/implementation-notes.md
hook: "github:ojfbot/core#319"
status: done
created_at: 2026-08-03T11:30:00-0500
labels:
  project: fde-operating-presence
---

## Step 0 — prior session verified against git before any new work

All ground-truth checks in the brief **passed**: the `dc3d64a`→`dc0f805` commit chain matched
exactly in order; the four note files exist and are substantive; `grep -c 'not started'
notes/README.md` = 0; `materials/U12_M4_DPO_ensemble_code` = **21M** (the weight-strip held);
`git status --porcelain` showed only `?? resume-builder/`; selfco carried `ef37cb3` plus the
provenance fix `3ccf96c`; `implementation-notes.md` had exactly two deviation bullets. Greps
were line-anchored (`^<<<<<<<`) — no false positives this time.

Two cosmetic drifts from the brief's description, neither blocking, both left alone:
`~/selfco` is not bare-clean (untracked `.handoff/2026-08-03-pi00-transport-deploy.md` from
the unrelated Pi transport session), and `wiki/log.md` uses `- updated …` bullets rather than
the `[date] ingest |` line-start form the brief described.

## Delivered

Sequencing was changed by operator decision before work began: the two cheap reads were
banked **ahead of** U14's low-value tail, because U8 was worth more per token than
M1/M8/M9/M11-music and would otherwise have been the first thing cut. All five targets landed.

**U14: 4 → 7 of 13 content modules** (`a60cbe3`, three decks in gitignored `materials/`)

- **M2 (RL/DPO/RLHF)** answers the brief's question by containing *both* rungs: vanilla DPO is
  gold-labelled (GSM8K exact match, fallback to numeric proximity); ensemble DPO is pure
  majority-vote self-consistency, no gold and no judge. It does not add a rung to
  `[[ruler-grpo]]` — it *is* the majority-vote rung, now with its lecture-side rationale. It
  does add a tier **below** the judge: a deterministic SymPy verifier, domain-gated to
  checkable outputs.
- **M3 (Advanced RAG)**: the Arize chunking claim is the **same citation** as U9 M3, not
  independent corroboration — recorded as a repeat so the vault doesn't double-count it. Real
  contribution is the MRR-vs-faithfulness split and a strong synthetic-query limitations list.
- **M13 (Enterprise + Hallucination)**: richest of the three, and the closest external material
  to `[[grounded-annotation]]`.

**U1 Module 6** read in full — the sitting-5 claim was inferred from lesson titles; it is now
tested against content and **confirmed verbatim**, then upgraded.

**U8 promoted mapped → ingested** — enrolled free ("Enrolled successfully", no payment step),
both substantive lessons read. Closes the curriculum's last genuinely uncovered topic.

## What is worth your attention

1. **Small and medium models hallucinate *more* when given tools** — M13's finding, cause
   given as "complexity outstrips capacity." This cuts against a live assumption in the
   bldgblog-corpus deposit-library plan (Opus=teacher / Haiku=volume / local-fine-tune=goal),
   where the premise has been that a small model plus scaffolding substitutes for a large one.
   The scaffolding is itself a capacity demand. Worth a look before the fine-tune step.
2. **Eval sets generated from the corpus they evaluate are self-flattering** — "MRR and
   Recall@k may increase on doc-generated eval sets, but degrade when exposed to
   out-of-distribution live questions." Supports f1-doctrine's FROZEN holdout; a caution for
   buddy-check and dive-briefing.
3. **"NEVER LOOK AT LLM-as-Judge results before labeling it yourself"** — U1 M6's rule, taught
   to beginners. It is the anchoring-bias guard buddy-check's judge calibration rests on,
   arriving as external corroboration that the strict form is standard practice.
4. **One rule the fleet has not written down**: *de-contextualize context-dependent sentences
   before judging them.* A sentence whose truth depends on an antecedent cannot be verified in
   isolation — reference resolution belongs inside verification, not before it. Directly
   applicable to dive-briefing's per-claim citation verification.
5. **A coverage dimension our eval sets lack**: U1 M6 specifies **"emotional-angry"** alongside
   factoid, multi-hop, and distractor-heavy as synthetic question types.

## Carried forward — NOT resolved

**The LoRA contradiction stands.** U14 M6's `alpha = 2 × r` still contradicts U12 M4's shipped
`adapter_config.json` (`r=64, lora_alpha=16, use_rslora=false`). Both plausible tiebreakers
this sitting were checked **directly**, not assumed: M2 reaches fine-tuning but names no `r` or
`lora_alpha` at all ("LoRA + 4-bit recommended" and nothing more), and U1 M6's fine-tuning
lesson contains no `lora`/`alpha`/`peft`/`rslora` token whatsoever. Still two decks, no third
source. **Not adjudicated.** U14 M8 is the last plausible source.

## Deviations logged (`implementation-notes.md`, now 5 bullets)

- **U1 was already enrolled** — 18/38 lessons, 47%, no "Enroll Now" button. The brief's
  unenrolled list (U1–U3, U7, U8, U10, U17) is unreliable; check enrollment by observation.
- **A payment-word grep false-positives on portal chrome.** `/\$|price|pay|purchase|…/` over
  `document.body.textContent` returned true on a page with no paywall. Screenshotted and
  confirmed visually rather than acting on the grep. Treat the grep as a prompt to look, never
  as the finding.
- **Video-only lessons have auto-generated transcripts — "not ingestible" was wrong.** U8's
  lecture was video-only *with a Transcript button* yielding ~7.7k chars. ASR mangles every
  product name ("do not" = Donut, "minor u" = MinerU, "doc link" = Docling) but is recoverable
  against a companion resources list. **Did not** retroactively re-open U17's 51 recordings or
  the Harness Engineering DSPy/GEPA lecture — transcript quality without a decoder list is
  unproven. The standing "video-only ⇒ not ingestible" rule in the brief chain should now be
  treated as **unverified, not true**. One probe next sitting settles it.

## Corrections to standing records

`fde-job-target.md` was not edited (per the brief, corrections go here). Nothing in this
sitting changes the G1–G6 audit. The one G-relevant note: U8's ETL material closes a *topical*
gap, not a capability gap — it is a tool tour with no parser-quality evaluation, no failure
taxonomy, and no hard cases (multi-column, scanned handwriting, tables spanning pages).

## State

18 of 18 courses mapped; **13 fully ingested**; U14 at **7 of 13** content modules; 9/9
mini-project briefs; ~38 licensed files in `materials/` (67M, up 3M — every download well
under the 50 MB inspect threshold). Vault current through sitting 6 (`8bec0f3`, pushed).

**Next sitting's best three U14 modules: M12** (vision-to-code & browser agents,
harness-adjacent), **M10** (text-to-SQL — M13 made the hybrid symbolic-query pattern
load-bearing, and M10 is where it's taught), **M8** (last plausible LoRA tiebreaker). M9 and
M11's music half remain skippable. Plus the one-probe transcript question above.
