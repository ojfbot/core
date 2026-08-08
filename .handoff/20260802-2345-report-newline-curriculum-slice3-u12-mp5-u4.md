---
id: 20260802-2345-report-newline-curriculum-slice3-u12-mp5-u4
type: report
title: "Newline curriculum slice 3: U12 finetuning + MP5 (numbering confirmed — 9 MPs total) + U4 prompt engineering; 8 of 18 courses now ingested"
actor: code-claude
session_id: newline-curriculum-ingestion-2026-08-02
refs:
  - bead:20260803-0005-brief-newline-curriculum-ingestion-via-chrome
  - bead:20260802-2330-report-newline-curriculum-p5-u15-u16-u9-complete-u14-map
  - path:newline-ai-course/notes/
  - commit:newline-ai-course@d6181eb
hook: "github:ojfbot/core#319"
status: closed
created_at: 2026-08-02T23:45:00-0500
labels:
  project: fde-operating-presence
---

## What shipped (commit `d6181eb`, same session, opportunistic tier)

- **Unit 12 Finetuning** (`unit-12-finetuning.md`): enrolled (free, no payment — 5th clean
  enrollment). 5 content modules synthesized from lesson summaries; 4 lecture decks
  downloaded (instruction FT w/ TRL/Axolotl/QLoRA/MergeKit + model merging; multimodal
  CLIP heads/LoRA/diffusion; embedding FT losses + operational trade-offs; **DPO/RLHF/PPO/
  GRPO/RULER alignment deck** — RULER = LLM-judge-ranked label-free GRPO, directly relevant
  if the fleet's calibrated judges ever feed distillation). Exercises/Code lesson deferred.
- **MP5 located and ingested** (`mp5-dating-embeddings.md`): Unit 12's mini-project =
  "Dating Compatibility Embedding System" — contrastive fine-tune of all-MiniLM-L6-v2 with
  statistical bars (Cohen's d ≥0.5, FPR ≤0.10, cluster purity ≥0.70, F1 ≥0.90). **MP
  numbering now confirmed: 9 mini-projects across 5 units** (U5: 1–2, U9: 3–4, U12: 5,
  U13: 6–7, U14: Jira + DevOps assistants). Direct rehearsal for the bldgblog/selfco
  local-fine-tune path (the "prompt levers don't lift light models" verdict now has its
  method toolbox).
- **Unit 4 Prompt Engineering** (`unit-04-prompt-engineering.md`): enrolled (free); deck
  ("Techniques, Jailbreaking, and Defense") downloaded; both exercise Colab pairs linked —
  second pair is defensive/jailbreak prompting (DAN, HackAPrompt, sandwich defense; Air
  Canada + Vercel-leak case studies). Relevant to mrplug's prompt-injection surface.

## Cumulative state

Ingested: U4, U5, U9, U12(partial), U13, U15, U16, Harness Eng = **8 of 18 courses**, plus
7 MP briefs and the U14 module map. Enrolled in 10 courses, all free. materials/ = 25MB /
21 files, all gitignored. Not started: U1–U3, U6–U8, U10–U11, U17; U14 content passes.

## Next slice candidates

U6/U11 (foundational + advanced LLM concepts), U14 module passes (start with modules 4/5
IDE-architecture — Harness Eng adjacency — or 6/7 insurance builds), U12 exercises + Code
lesson, U17 recordings inventory, or the two U14 MP briefs (Jira/DevOps assistants —
links already in `unit-14-case-studies.md`).
