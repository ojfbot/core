---
type: wayfinder-map
slug: teach-in-the-loop
northstar: l1-core
tracker_issue: 379
status: working
---

# Wayfinder — teach in the loop

## Destination

Teaching is a standing output of fleet work, calibrated to the operator's **zone of proximal
development**. Any session can spawn a standalone teach workspace in a shadow space —
mission-grounded, source-vetted, emitting self-contained interactive HTML lessons — and those
workspaces accumulate into a corpus future sessions draw from. The merge-quiz heatmap grows into
the fleet's ZPD sensor so lesson placement is computed, not guessed. Arrived = an accepted
l1-core operator-competence property with the teach loop as its instrument, a live teach-session
corpus, and HTML lessons rendering in the side panel as routinely as SVG diagrams do today.
Guardrails inherited from the `se-competency-engine` vault synthesis: effort-first,
feedback-not-answers, formative-only grading, measured uplift.

Anchor: **ratified `ns:l1-core#P5`** — the anchor bid closed "yes" at the operator-competence
ticket (2026-08-03): l1-core earns a fifth property, "The harness raises operator competence,"
with the teach loop as its instrument. The amendment is staged via the registry's own PR path
(core PR #389, human-gated: numeric current/target are proposals for operator calibration); until
it merges, the frontmatter `northstar: l1-core` resolves at slug level and P5 serves
`ns:l2-ojfbot#P2` through its ladder.

## Notes

- **Source under study:** `mattpocock/skills` `productivity/teach`
  (https://github.com/mattpocock/skills/tree/main/skills/productivity/teach;
  https://www.aihero.dev/skills-teach). Shape: `MISSION.md` interrogated first; vetted
  `RESOURCES.md` (never trust parametric knowledge); numbered self-contained HTML lessons
  (shared stylesheet in `./assets/`, interactive quizzes with length-matched answers, Tufte
  printability, citations back to sources); `./reference/*.html` cheat-sheets; ADR-style
  `./learning-records/*.md` used to compute next-lesson ZPD placement. Pedagogy: storage
  strength over fluency, desirable difficulty, knowledge-then-skill within working-memory limits.
- **Operator scope rulings (Destination grilling, 2026-08-03):** (1) anchor bid = new l1-core
  operator-competence property; (2) **standalone teach workspaces are the way**, written to
  shadow sessions (worktree/prototype-style scaffolding) so a corpus of teach sessions
  accumulates while working trees stay clean; (3) HTML canonical for lessons plus exactly one
  second-surface probe — evidence before any wider bet. **ZPD is the core organizing principle.**
- **Existing instruments:** `/merge-quiz` ("teaching is the product, the score is a by-product")
  with its EWMA comprehension heatmap (`~/selfco/tracking/merge-observations.jsonl`, repo ×
  domain cells, taught/cold never merged) and vault deposit seam — the proto-ZPD-sensor. H8
  loop is Stage A shadow with a retirement rule; this map extends, never replaces.
- **Reference layer (vault, read-only):** `~/selfco/wiki/synthesis/se-competency-engine.md` —
  prior design for an "ambient competency drip wired into the fleet via core skills/hooks…
  *(design later)*"; this map is that later. Its evidence-backed guardrails are adopted in the
  Destination. Also `wiki/concepts/ai-augmentation-evidence.md` (tutoring gains are real;
  deskilling is real; measure uplift) and `wiki/concepts/teaching-programming-hackclass.md`
  (the operator has built rubric-based teaching systems twice before — this is the third
  documented iteration of the urge, not a novelty).
- **Boundaries — owned elsewhere, ruled here only by named tickets:** comprehension-gate ↔
  `/merge-quiz` relationship → parked in `diagram-first-output` (#366) fog; retention /
  spaced-repetition machinery → `f1-learning-studio` (#257) "unit of learning practice" (#262),
  seam ruled by the Retention boundary ticket; SE-domain competency corpus →
  `se-competency-engine` orbit.
- **Adoption precedent:** `decisions/adopt-stack/pocock-skills-v1-1.md` (ADR-0097 framework).
  Row D6 rejected a fourth work-item surface — the shadow-space ruling is this map's answer to
  that precedent, made explicit in the corpus-location ticket.
- **Destination qualified by the ZPD-sensor ruling (#384, 2026-08-03):** "lesson placement is
  computed, not guessed" now reads — the *floor* is computed per-workspace from mission and
  learning records (D22); the heatmap makes that choice better-informed **across** workspaces, but
  never authoritative. The Destination sentence stands as written; its authority claim does not.
- **P5 text diverges from the ZPD-sensor ruling — amendment deferred, not skipped.** `ns:l1-core#P5`
  names "repo × domain cells" as the primary measure; #384 re-keys to **bounded context × mode**
  (repo demoted to record metadata) and holds out the cells placement selected, so P5's
  `verification` string is not runnable as written. Ruled: record the divergence here and in
  `adr:comprehension-heatmap-zpd-role`, and let the northstar amendment ride with the slice that
  builds the re-keyed sensor — rather than spend a second human-gated registry PR against numbers
  that are still uncalibrated proposals. (Operator, 2026-08-03.)
- **Standing risk against P5 — the instrument has never fired.** Measured 2026-08-03: 89 rows in
  `~/selfco/tracking/merge-observations.jsonl`, **all** Stage-A `harness:merge-observed`,
  `quizzed: false` on every one; **0 `harness:quiz-taken` records, 0 cells, 0 `domain` values ever
  written** — across 5 days and 25 qualifying merges, including PR #404 (4,137 lines) on this map's
  own branch. P5's primary measure currently reads an empty file. #384 ruled **no backfill and no
  seeding** (min-n gate only): if cells never accrue, the H8 retirement rule is the thing that
  catches it, and it is allowed to.

## Decisions so far

- **Adopt-stack pass: mattpocock/skills teach (#380, 2026-08-03)** — Gate 0 LIBRARY (0/6) at pin
  `2ab95809`; seven opinions ABSORBED (mission interrogation; vetted resources with internal fleet
  artifacts first-class; community delegation external-domains-only; evidence-gated learning records;
  records+mission ZPD placement as per-workspace floor; HTML lesson + assets shape with #386 as
  verifier; reference/glossary split with understanding-gate), one REJECTED (NOTES.md — teaching
  preferences live in fleet memory, injected at workspace spawn). Record:
  `decisions/adopt-stack/pocock-skills-teach.md` (D18–D25, extends `pocock-skills-v1-1.md`).

- **Does l1-core earn an operator-competence property? (#381, 2026-08-03)** — **YES**: l1-core
  gains P5 "The harness raises operator competence," teach loop as instrument. Measure =
  uplift-primary, ZPD-rate staged: taught-vs-cold movement on the merge-quiz EWMA heatmap is the
  primary measure; lessons-served-at-ZPD activates only per the #384/#382 rulings.
  Measurement-first (P1 discipline): no uplift published before the instrument is green.
  Amendment staged via registry PR path (core PR #389, human-gated, numbers = proposals); ADR
  draft `adr:l1-core-operator-competence-property`. #384/#382 inherit the pre-registration duty
  for the staged metric's activation criteria.

- **HTML lesson pattern spike (#386, 2026-08-03)** — HTML earns its keep, and D23's `./assets/`
  opinion is **amended**: "self-contained" and "shared stylesheet in `./assets/`" conflict at the
  render boundary, and self-contained wins. Measured on one lesson built to the full D23 spec —
  strip the sibling stylesheet and the page falls back to Times at an 8px body margin (0 rules
  loaded), so every Tufte/printability opinion is the first casualty, while the inline quiz JS
  keeps working. Presentation is the fragile part, not interactivity. Ruling: `assets/lesson.css`
  stays the **authoring** source (D23's shared-first-component instinct is right for authoring);
  the **shipped** lesson is build output with the CSS inlined (~6.7 KB → 10.8 KB, an 8-line
  inliner — a step, not a build system). Also found: hand length-matching quiz answers is
  error-prone and wants a checker. Primary source: branch `wayfinder/386-html-lesson-spike`
  (never merged), `prototypes/386-html-lesson/VERDICT.md`. Narrows #383 — the interactive-HTML
  half of that research question now has in-fleet evidence to check field findings against.

- **ZPD sensor: can the merge-quiz heatmap place lessons? (#384, 2026-08-03)** — **NOT AS-IS.** The
  heatmap **augments** D22's records+mission floor and never overrides it: it contributes a
  cross-workspace topic *nomination* only for cells at n ≥ k, never outranking the workspace's own
  mission (R1). **Selector ≠ ruler** (R2): P5's uplift is read only from a pre-registered holdout of
  cells placement did *not* select, because selecting the worst cell and then measuring its movement
  manufactures taught-vs-cold divergence from regression to the mean alone. **Re-keyed to bounded
  context × mode**, repo demoted to record metadata (R3) — `repo × domain` fragments across 43 repos
  and an unbounded free-text axis and never reaches n; six ADR-0044 contexts × 2 modes = 12 cells
  that fill. Learning records stay **files-canonical** with a lesson-served ledger event as the
  machine index (R4; location is #382's). **Cold start: min-n gate only, no backfill** (R5). P5-text
  divergence noted, amendment deferred to the building slice (R6). Three emissions must change
  first, in order: persist the per-question difficulty/facet profile that `--record` currently
  discards (the blocking one — without it a 60 from missing the *hard* questions is
  indistinguishable from a 60 from missing the *easy* ones, and those want opposite lessons); a
  path → bounded-context classifier (a **roadmap slice**, not a ticket — success and check are both
  statable); the lesson-served event. Record: `adr:comprehension-heatmap-zpd-role` (draft). Did
  **not** touch the comprehension-GATE question (#366 fog). Unblocks #385.

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| Adopt-stack pass: mattpocock/skills teach (#380) | grilling | — | **closed 2026-08-03** |
| Does l1-core earn an operator-competence property? (#381) | grilling | Adopt-stack pass | **closed 2026-08-03** |
| Where does the teach corpus live? (#382) | grilling | — | open |
| Field evidence: /teach in the wild + interactive-HTML lesson patterns (#383) | research | — | open |
| ZPD sensor: can the merge-quiz heatmap place lessons? (#384) | grilling | — | **closed 2026-08-03** |
| Retention boundary ruling (#385) | grilling | — | open — unblocked by #384 |
| HTML lesson pattern spike (#386) | prototype | Adopt-stack pass | **closed 2026-08-03** |
| Second-surface HTML probe: /merge-quiz as an interactive page (#391) | prototype | — | open — unblocked |
| Design-system inheritance: how do lessons wear the ojfbot brand? (#393) | grilling | — | open — unblocked, informs #391 |

## Not yet specified

- **Holdout policy for the P5 ruler** — #384's R2 ruled that uplift is read only from cells
  placement did *not* select, but not *which* cells form the holdout, how the pre-registration is
  recorded, or what happens when a cell crosses from holdout into selected. **Graduation candidate**
  once the sensor re-key (bounded context × mode) lands — the question is only fully statable
  against a real cell population. Until then P5 must not publish an uplift number.
- **Teach-session trigger points** — where in the build loop workspaces spawn (standup drip,
  post-merge suggestion, prototype disposition, /investigate postflight): the "ambient drip".
  Statable only after the corpus-location and ZPD-sensor tickets close. The D25 ruling (teach
  adopt-stack pass) adds one requirement to whatever spawn mechanism emerges: it injects teaching
  preferences from fleet memory at spawn.
- **Agent-side co-learning** — the `se-competency-engine` lockstep bet: the same lessons doubling
  as agent evals so operator and fleet competence rise together.
- **Lesson staleness** — what happens to a lesson when the code it teaches moves (cousin of the
  diagram-staleness fog on #366). #393 touches one face of this: an inlined copy of the fleet's
  design tokens drifts when the brand moves, which is the same staleness with a different source.
- **daily-logger articles ↔ lessons** — whether the chronological blog and the lesson corpus
  feed each other.
- **Voice capture as mission input** — PLAUD → MISSION.md refinement.

## Out of scope

- Replacing `/merge-quiz` — it is extended as the ZPD sensor, never replaced. (Operator,
  2026-08-03.)
- Lessons committed inside working trees — ruled out by the shadow-space decision. (Operator,
  2026-08-03.)
- Forking `diagram-first-output`'s parked comprehension-gate question. (Operator, 2026-08-03.)
- Rebuilding seh-study's Leitner engine inside this map — the Retention boundary ruling may
  *point* at it, not rebuild it. (Operator, 2026-08-03.)
- Adobe Express as lesson store — mirrors the #373-adjacent ruling on #366. (Operator,
  2026-08-03.)
- `NOTES.md` per-workspace preference scratchpad — rejected D25 of the teach adopt-stack pass;
  teaching preferences live in fleet memory and are injected at workspace spawn. (Operator,
  2026-08-03.)
- The heatmap as placement **authority** — a sufficiently-observed low cell overriding
  records+mission was ruled out by #384's R1. It augments; it never outranks the workspace mission.
  (Operator, 2026-08-03.)
- Backfilling or seeding the heatmap to escape cold start — #384's R5. Cells accrue naturally or the
  H8 retirement rule fires. (Operator, 2026-08-03.)
