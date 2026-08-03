---
id: 20260802-2145-report-fde-skills-audit-curriculum-map-roadmap-shipped
type: report
title: "FDE skills audit + Newline curriculum map + readiness roadmap shipped to personal-knowledge/fde-job-target.md; offer tension resolved by operator (deliverables, not rewards)"
actor: code-claude
session_id: fde-skills-audit-2026-08-02
refs:
  - bead:20260803-0230-brief-fde-skills-audit-newline-curriculum-map-k-offer-ro
  - github:ojfbot/core#319
  - file:decisions/research/2026-08-01-fde-deliverables-audit.md
  - file:personal-knowledge/fde-job-target.md
hook: "github:ojfbot/core#319"
status: closed
created_at: 2026-08-02T21:45:00-0500
labels:
  project: fde-operating-presence
---

## Executed

All three artifacts from the brief, delivered as one file: `personal-knowledge/fde-job-target.md`
(gitignored by design — personal-knowledge/ is the denylist source side of
`adr:employer-evidence-boundary`, so the artifact is local-only; this bead is the tracked record).

1. **Skills audit** — G1–G6 scored three-state (publicly evidenced / privately proven / absent)
   with file-path citations. Scorecard verified against 2026-08-02 repo state; two corrections:
   (a) G1's public column was under-credited — `diy-repair-qa-eval` is public, course-linked
   (Accelerator Miniproject 1), and demonstrates judge-calibration methodology with honest
   negative results; (b) G2's "deep private inventory" is substantially public (core, purefoy,
   shell, cv-builder + siblings are public repos — verified via `gh repo list` visibility sweep).
   Neither correction moves the genre gaps: G3 (full arc) remains ABSENT and the headline;
   texas-rr is at charting with no arc stage traversed (frontier #346/#348/#349/#350/#356).
2. **Curriculum map** — syllabus located externally: https://www.newline.co/courses/power-ai-course
   (11 modules; the Accelerator is the cohort wrapper adding miniprojects + coaching, briefs not
   publicly listed — flagged as inferred from the two briefs on disk). Coverage: G1 partial
   (Module 3 + Miniproject 1), G2 partial (Modules 8–9), G3 mechanics-only (Modules 4–7 ship
   your-own-app, not the consultative arc). **Untouched entirely: G4, G5, and G3's consultative
   core; G6 marginal.**
3. **Roadmap** — 7 dated moves (2026-08-09 → Oct+), each genre-tagged + disclosure-tagged.
   Spine: pass^k public slice on diy-repair-qa-eval (G1, by 08-09) → daily-logger outage
   postmortem write-up (G6, by 08-16) → texas-rr #346/#349 referenced as the G3 vehicle
   (not re-scoped; no northstar writes) → agent-anatomy playbook framing (G5) → #342 sanitized
   plumbing narrative (G4) → gap-targeted course completion → G3 closed loop as the
   offer-ready milestone. Comp section: no primary source evidences $300k for an FDE role;
   verified comparables are the tbcony $225–310K band and the removed $220–280K FDE datapoint.

## Operator rulings obtained (the brief's Flag-back, resolved)

- **Offer-vs-lagging-indicator tension:** operator ruled "ignore my specific number pegging …
  keep wayfinder focused on the deliverables not the rewards." Roadmap success object =
  deliverable readiness; comp = market-research context only; **no new wayfinder ticket filed**;
  map #319's Destination untouched.
- **Artifact shape:** new `fde-job-target.md` (tbcony format adapted to the genre checklist),
  per recommendation.

## Discoveries / flags

- **The brief's "five weeks old" staleness claim is wrong** — the audit is dated 2026-08-01, one
  day before this session. Verified anyway (worth it: found the two corrections above).
- **The denylist lint does not exist yet.** The #321 ruling declares enforcement-by-construction,
  but no lint script is on disk (searched scripts/, hooks/, all branches). Until it lands, the
  boundary check is manual (this session: grep on outputs — clean). Implementing the lint is an
  unclaimed prerequisite for roadmap move 5 (G4 public narrative) and is also named in
  `decisions/open-unknowns.md`'s core-library deployment hazard.
- Roadmap move 1 (pass^k slice) and move 2 (outage postmortem) are cheap, counterparty-free,
  and close the two audit-named public gaps — good candidates for next dispatch.
