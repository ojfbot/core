---
id: 20260803-0230-brief-fde-skills-audit-newline-curriculum-map-k-offer-ro
type: brief
title: "FDE skills audit + newline curriculum map + $300k-offer roadmap"
actor: chat-claude
to: code-claude
session_id: 2026-08-03T02:30:43Z
refs:
  - github:ojfbot/core#319
  - github:ojfbot/core#320
  - file:decisions/research/2026-08-01-fde-deliverables-audit.md
  - file:decisions/wayfinder/fde-operating-presence.md
  - file:personal-knowledge/jim-green-profile.md
  - file:personal-knowledge/tbcony-job-target.md
  - path:newline-ai-course/
hook: github:ojfbot/core#319
status: live
created_at: 2026-08-03T02:30:43Z
labels:
  project: fde-operating-presence
  new_thread: true
---

## Context

`fde-operating-presence` (wayfinder map, github:ojfbot/core#319) charts building a public, FDE-legible
operating presence; its Destination explicitly treats offers as a **lagging indicator, not the
success object** — the flywheel and dossier artifacts are the target, an offer is what falls out.
The operator's framing for *this* thread ("$300k offer-ready FDE") reintroduces the offer as an
explicit target. **Do not silently reconcile these** — see Flag back.

Ground truth already exists and should be read, not re-derived:

- `decisions/research/2026-08-01-fde-deliverables-audit.md` (github:ojfbot/core#320, closed) is the
  hiring-bar ruler: 6 deliverable genres (G1 customer-tailored eval frameworks — the strongest
  evidenced genre and a hiring gate; G2 harness artifacts in customer production; G3 the full
  deployment arc — **the fleet's confirmed #1 gap**; G4 organizational plumbing narrative; G5
  vendor-ward pattern capture; G6 production quality surface) plus a fleet/TeamBot scorecard
  against each genre, and three tested hypotheses (H1 cost-aware orchestration REFUTED as a
  deliverable, H2 eval/gating harnesses MIXED, H3 the consultative core SUPPORTED). Read its
  "Fleet + TeamBot scorecard" table first — it already names the per-genre gaps.
- `personal-knowledge/jim-green-profile.md` is the existing skills/career-history inventory
  (agent-ready, used for cover letters and application artifacts). `personal-knowledge/
  tbcony-job-target.md` is the precedent *format* for a job-target gap analysis (requirement ×
  evidence × strength table, critical-gaps list) — built for a different role (TBCoNY Design
  Engineer, $225–310K), reusable as a template shape, not as content.
- No FDE-specific job-target file exists yet in `personal-knowledge/`. This thread is where one
  would be created, if the receiving session and operator agree that's the right artifact.
- `newline-ai-course/` (sibling repo, not core) is currently thin: `jupyter-basics/sandbox.ipynb`
  (setup verification only, no real curriculum content yet) and `resume-builder/` (a 9-doc
  follow-along prep kit + a working FastAPI MVP, offline-verified, live-wired-not-exercised, per
  prior session notes — see `bead:` there isn't one, check `newline-ai-course/resume-builder/
  CLAUDE.md` and README directly). There is no curriculum document to parse yet — "map curriculum
  coverage" may mean auditing what modules/lessons the Newline program itself lists (check for a
  syllabus, possibly external to this repo) against the G1–G6 gaps, not just this repo's contents.
- The employer boundary (`adr:employer-evidence-boundary`, github:ojfbot/core#321, closed) governs
  how day-job material (the strongest G1/G2 evidence — buddy-check, dive-briefing, the F1 stack,
  the AI advisory platform in the profile) can be used publicly: de-identified, pattern-level,
  stranger test, enforced by a gitignored denylist. Any public-facing audit output must respect it.
- The texas-rr-engagement map (`ns:l1-fieldwork-1`, github:ojfbot/core#344) is the fleet's actual
  G3 full-arc proof-of-work vehicle — the audit names G3 as the #1 gap, and that engagement is
  already the plan to close it. This thread's roadmap should reference it, not duplicate it.

## Goal

Produce three linked artifacts, in this order (each depends on the one before it):

1. **Skills audit** — score Jim Green's current, evidenced capability against each of the six
   deliverable genres in the fde-deliverables audit, using the existing scorecard as the starting
   point (verify it, don't just restate it — it's five weeks old). Distinguish *privately proven*
   (exists, undisclosed pending #321-cleared publication) from *publicly evidenced* (a stranger can
   already verify it) from *absent*. G3 (full arc) is very likely still the headline gap even after
   texas-rr-engagement starts, until it produces a closed loop with measured before/after numbers.
2. **Curriculum map** — find the actual Newline AI Accelerator / Power AI Course syllabus (external
   source — check for a URL, PDF, or portal login; it is not fully contained in this repo) and map
   its modules against the audit's named gaps. Output: which lessons close which genre gaps, which
   genre gaps the course does not touch at all (name them explicitly — don't let an untouched gap
   go unmentioned because no lesson maps to it).
3. **Roadmap to $300k-offer-ready** — sequence of concrete moves (not a research report) with
   target dates, each move tagged to the genre(s) it closes and to whether it's public (subject to
   #321) or private. Ground the $300k figure: TBCoNY's $225–310K comp band is the one hard
   comparable already in the repo; note whether a comparable FDE-specific band exists or needs
   sourcing (Anthropic/OpenAI FDE postings cited in the audit had one removed comp datapoint,
   $220–280K — cite it, don't invent a new number).

## Acceptance criteria

- [ ] Skills audit exists as a written artifact (new file under `personal-knowledge/` or an update
      to `jim-green-profile.md` — receiving session's call, flag if ambiguous) scoring all six
      genres with evidence citations (file paths, repo names), not vibes.
- [ ] Curriculum map identifies the actual Newline syllabus (external source located and cited) and
      produces a gap table: genre × covered-by-course (yes/no/partial) × which lesson.
- [ ] Roadmap is dated and sequenced, each item tagged to a genre and a public/private disclosure
      status, and explicitly cites texas-rr-engagement as the G3 vehicle rather than re-scoping it.
- [ ] The offer-vs-lagging-indicator tension (see Flag back) has been surfaced to the operator and
      resolved one way or the other before the roadmap is presented as final — not quietly assumed.
- [ ] No day-job specifics (employer name, team, internal system names) appear in any artifact
      that isn't already de-identified per `adr:employer-evidence-boundary`.

## References

- github:ojfbot/core#319 (fde-operating-presence map) — github:ojfbot/core#320 (deliverables audit,
  closed) — github:ojfbot/core#321 (employer boundary, closed) — github:ojfbot/core#327
  (hired-projects disposition — newly unblocked, adjacent) — github:ojfbot/core#344
  (texas-rr-engagement, the G3 vehicle)
- file:decisions/research/2026-08-01-fde-deliverables-audit.md
- file:decisions/wayfinder/fde-operating-presence.md
- file:personal-knowledge/jim-green-profile.md
- file:personal-knowledge/tbcony-job-target.md (format precedent only)
- path:newline-ai-course/ (README.md, resume-builder/)
- adr:employer-evidence-boundary — adr:boundary-enforced-by-construction

## Flag back

- **The offer-vs-lagging-indicator tension.** The map's charted Destination deliberately
  de-emphasizes offers ("offers are a lagging indicator, not the success object" — Yuri,
  2026-08-01 charting). The operator's request for this thread names a $300k offer as the explicit
  goal. These may not actually conflict (a roadmap can target offer-readiness as a *milestone*
  without making the offer the map's Destination) — but do not resolve that quietly. Ask the
  operator directly whether this thread's roadmap should be filed as a new wayfinder ticket on
  #319 (formal, grilled, becomes part of the charted map) or kept as an out-of-band personal-track
  artifact in `personal-knowledge/` (informal, faster, not part of the wayfinder ledger).
- **Do not fabricate the $300k comparable.** If no primary source names $300k specifically for an
  FDE role, say so and cite the nearest verified comparables (TBCoNY $225–310K for a different
  role; the removed $220–280K OpenAI FDE datapoint) rather than presenting $300k as
  market-evidenced when it may be an operator target, not a market fact.
- **Do not re-decide the texas-rr-engagement roadmap or its northstar properties from here.**
  `ns:l1-fieldwork-1` and its properties are settled (github:ojfbot/core#345, closed); this
  thread's roadmap should reference the engagement's progress as input, never write its `current:`
  values or restate its movement contract (see `feedback_movement_contract_discipline` — slice/audit
  sessions never write northstar `current:`).
- **If this becomes a new wayfinder ticket:** one ticket per session still applies — do not chart
  and resolve it in the same sitting.

## Constraints (optional)

- No client outreach, no publishing to any public surface, from this thread — research and
  drafting only, same standing constraint as the rest of the fde-operating-presence map.
- Respect `adr:employer-evidence-boundary` in every artifact this thread produces, not just ones
  explicitly marked public — a private draft that later gets copied into a public file is the
  documented failure mode (the cycle-2 audit doc shipped with the employer name and needed a
  post-merge scrub, github:ojfbot/core#354).
- Match `tbcony-job-target.md`'s table format (requirement × evidence × strength) for the skills
  audit if a comparable job-description-shaped target exists to grill against; if the FDE "job
  description" is really a genre checklist rather than a single posting, adapt the format rather
  than forcing the fit.

## Time-box (optional)

None set — this is a multi-artifact thread, not a spike. If the receiving session estimates more
than one sitting, say so explicitly rather than producing a rushed partial roadmap.
