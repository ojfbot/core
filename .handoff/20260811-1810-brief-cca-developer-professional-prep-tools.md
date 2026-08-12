---
type: brief
date: 2026-08-11
author: claude-code (session 21f1d7ae)
topic: Extend the CCA-F prep stack to Claude Certified Developer–Foundations and Architect–Professional
status: open
---

# Brief: prep campaigns for the next two Claude certifications

## Mission
Build research + drill-prep campaigns for **Claude Certified Developer – Foundations** and
**Claude Certified Architect – Professional**, reusing the CCA-F stack shipped 2026-08-11.
Operator goal: **reach Architect–Professional ASAP**. Reported prerequisite (verify against the
official guide): Architect–Professional requires a passing Architect–Foundations — so the CCA-F
campaign (in flight, sit ~2026-09-08) is the critical path; Professional prep can be *built* in
parallel and drilled the moment -F is passed. Developer–Foundations is a sibling track ($125,
no reported prerequisite) — treat as an optional quick win unless the operator says otherwise.

## What already exists (reuse, don't rebuild)
- **The app**: `~/selfco/teach/cca-foundations-prep/app/` — zero-dependency Node server
  (`node:http` + `node:sqlite`, port 8630), `bank.json` question format
  (`{id, d, s, task, trap, multi, q, opts[], a[], why, fleet}`), Leitner 5-box, timed mocks on
  the 100–1,000 scale, notes → `progress/study-notes.md`, snapshot → `progress/progress.json`
  (git-synced). **Extend with a deck selector** (`bank-ccar-f.json`, `bank-ccd-f.json`,
  `bank-ccar-p.json` + per-deck SQLite tables or a `deck` column) rather than forking the app.
- **The method** (proven this campaign):
  1. Obtain the **official Exam Guide PDF** from the Anthropic Partner Academy / Skilljar listing
     (the -F guide was at anthropic-partners.skilljar.com; sibling pages exist per cert). The
     guide's task statements, sample questions, and in/out-of-scope lists are the only
     authoritative blueprint — third-party sites got -F facts wrong (e.g. taught prompt caching,
     which is out of scope).
  2. **Ingest into the vault** per /vault conventions: PDF → `~/selfco/raw/assets/`, source page
     in `wiki/sources/`, synthesis update, log entry.
  3. **Gap-analyze vs the fleet with evidence, not vibes** — the 2026-08-11 audit refuted 5 of 6
     cold-spot claims in a cowork gap analysis by grepping the fleet
     (see `wiki/sources/cca-f-gap-analysis-cowork.md`). Repeat that discipline.
  4. **Author original questions only** (exam NDA), one per task-statement bullet where possible,
     style-matched to official samples: root-cause stems, "most effective first step",
     length-matched distractors each encoding a real misconception.
  5. **Divergence-trap deck**: fleet-vs-canon collisions (known so far: permission posture,
     @import ban ADR-0081, subagent default-deny ADR-0082, commands→skills, tool-count canon).
     Expect Professional-level ones around orchestration and evals.
- **State locations**: campaign memory at
  `~/.claude/projects/-Users-yuri-ojfbot-core/memory/project_cca_prep.md`; mastery snapshot at
  `~/selfco/teach/cca-foundations-prep/progress/progress.json`; study plan v2 at
  `.../reference/study-plan.md`.

## Steps
1. Research the two certs: official listings, exam guides (download PDFs), prerequisite chain,
   scenario banks, domain weights, in/out-of-scope lists. Confirm the Professional guide's
   format (it may use case-study or multi-part items — verify, don't assume 60-MCQ).
2. Vault-ingest both guides; write `wiki/synthesis/` updates extending
   [[cca-foundations-prep]] into a certification-ladder page.
3. Gap-analyze the fleet against each blueprint (evidence-first; reuse the audit greps).
4. Extend the app to multi-deck; author the Professional bank first (operator priority),
   Developer second. Deposit per teach-corpus conventions (index.md + `harness:lesson-deposited`
   emit to `tracking/teach-sessions.jsonl`).
5. Update `project_cca_prep.md` memory with the ladder plan and any booking constraints
   (Professional $175; all exams: Pearson VUE, 720/1000, 12-mo validity, free on-time renewal).

## Constraints
- Original questions only — never reproduce exam content (NDA; also program policy).
- Zero-dependency app (Node 24 built-ins); pnpm-never-npm is moot but stands.
- Vault git discipline: pull --rebase --autostash before writes, push after.
- Don't disturb the in-flight -F campaign state (SQLite `app/data/`, progress files).

## Open questions for the operator
- Sit Developer–Foundations at all, or go -F → Professional directly?
- Professional exam guide availability — if not yet downloadable pre-registration, decide
  whether to author a provisional bank from the public blueprint page and mark it unverified.
