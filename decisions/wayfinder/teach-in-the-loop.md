---
type: wayfinder-map
slug: teach-in-the-loop
northstar: l1-core
tracker_issue: 379
status: charting
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

Anchor: serves `ns:l2-ojfbot#P2` (work is legible and traces to a measurable property) today;
the frontmatter names `l1-core` because the map's anchor **bid** — carried by the
operator-competence property ticket — is that l1-core earns a fifth property for this. If that
ticket closes "no", the anchor falls back to `ns:l2-ojfbot#P2` and the frontmatter is corrected.

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

## Decisions so far

*(none — charting session closed zero tickets)*

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| Adopt-stack pass: mattpocock/skills teach (#380) | grilling | — | open |
| Does l1-core earn an operator-competence property? (#381) | grilling | Adopt-stack pass | open |
| Where does the teach corpus live? (#382) | grilling | — | open |
| Field evidence: /teach in the wild + interactive-HTML lesson patterns (#383) | research | — | open |
| ZPD sensor: can the merge-quiz heatmap place lessons? (#384) | grilling | — | open |
| Retention boundary ruling (#385) | grilling | ZPD sensor | open |
| HTML lesson pattern spike (#386) | prototype | Adopt-stack pass | open |

## Not yet specified

- **Second-surface HTML probe target** — which non-lesson surface gets the one probe (merge-quiz
  as an interactive HTML page? standup brief?). Graduates when the HTML lesson pattern spike
  closes; one probe at a time keeps the scope ruling honest.
- **Teach-session trigger points** — where in the build loop workspaces spawn (standup drip,
  post-merge suggestion, prototype disposition, /investigate postflight): the "ambient drip".
  Statable only after the corpus-location and ZPD-sensor tickets close.
- **Agent-side co-learning** — the `se-competency-engine` lockstep bet: the same lessons doubling
  as agent evals so operator and fleet competence rise together.
- **Lesson staleness** — what happens to a lesson when the code it teaches moves (cousin of the
  diagram-staleness fog on #366).
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
