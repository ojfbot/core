# ADR-XXXX: The comprehension heatmap augments ZPD placement and never rules on its own uplift
slug: comprehension-heatmap-zpd-role
serial: draft
rev:
Date: 2026-08-03
Status: Proposed
domain: observation
type: policy
OKR:
Commands affected: [/merge-quiz, /wayfinder]
Repos affected: [core]
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [l1-core-operator-competence-property, harness-loop-instrumentation, wayfinder-decision-maps, wrap-absorb-reject]
  parent:
  part-of-series:

---

## Context

The `teach-in-the-loop` wayfinder map (#379) sets a Destination in which "the merge-quiz heatmap
grows into the fleet's ZPD sensor so lesson placement is computed, not guessed." Ticket #384 asked
the load-bearing question: **can it?** — and what is it missing.

Two things make this urgent rather than academic.

**First, P5 landed naming this instrument.** `ns:l1-core#P5` ("The harness raises operator
competence") was ratified the same day (#381, `adr:l1-core-operator-competence-property`,
Accepted), with taught-vs-cold movement on the merge-quiz EWMA heatmap as its **primary measure**.
A ratified property whose primary instrument is unvalidated is precisely the failure mode P1's
measurement-first discipline exists to prevent.

**Second, D22 already set a floor.** The teach adopt-stack pass
(`decisions/adopt-stack/pocock-skills-teach.md:44`) ABSORBED upstream's ZPD computation — read
learning-records + mission, teach the most relevant thing inside the zone — **as a per-workspace
floor**, explicitly recording that whether the cross-workspace heatmap augments or overrides that
floor was #384's to decide, not the adopt-stack pass's.

### What the instrument actually is, measured 2026-08-03

| Finding | Evidence |
|---|---|
| The heatmap is **empty**: 0 `harness:quiz-taken` rows, 0 cells, 0 `domain` values ever written | 89 rows in `~/selfco/tracking/merge-observations.jsonl`, all `harness:merge-observed`, `quizzed: false`; `--report` prints "no quizzes taken yet" |
| The quiz has **never been invoked** — 5 days, 25 qualifying merges, including PR #404 at 4,137 lines on this map's own branch | `would_quiz: true` × 25 vs `quizzed: false` × 89 |
| Per-question `difficulty` (1–3) and `facet` are generated, then **discarded** — only the aggregate `score` persists | `.claude/skills/merge-quiz/SKILL.md:131` vs `scripts/hooks/merge-quiz.mjs:285-303` |
| `domain` is unvalidated free text with no vocabulary anywhere in the fleet | `scripts/hooks/merge-quiz.mjs:292` — `args.domain ?? 'general'` |
| Cell key is `repo\|domain\|mode`; EWMA α=0.4 hardcoded, **no time decay**, not reachable from the CLI | `scripts/hooks/merge-quiz.mjs:110-131` |
| `repo` is a `cwd` basename and is already dirty — 42/89 rows labelled `ojfbot`, a parent directory that is not a repo | `scripts/hooks/merge-quiz.mjs:353` |
| `mode` (taught/cold) is an unverifiable self-report, yet is a mandatory third component of the cell key | `SKILL.md:238`; invariant #4, `adr:harness-loop-instrumentation` |
| **No path → bounded-context mapping exists** — the six ADR-0044 contexts are drawn by concern, not by repo | `domain-knowledge/CONTEXT.md` |
| Stage A reads `promote-candidate` (44 usable merges, 25 would-have-fired) — the H8 retirement rule has not fired | `node scripts/hooks/merge-quiz.mjs --report` |

Two conceptual problems sit on top of those measurements.

**ZPD is a proximal signal; the heatmap is a deficit signal.** A low EWMA cell says "you did not
understand this" — it does not say *where the frontier is*. A 60 earned by missing the hard
questions (at the frontier, the ideal target) is indistinguishable from a 60 earned by missing the
easy ones (a foundational gap). Those want opposite lessons, and the emission that would separate
them is generated at quiz time and thrown away at record time.

**Selector and ruler are the same instrument.** P5 measures uplift as taught-vs-cold divergence on
this heatmap. If lessons are also *placed* by this heatmap's worst cells, then selecting the extreme
and measuring movement at that extreme produces divergence from regression to the mean alone. The
instrument would flatter itself by construction — a validity problem, not a tuning problem.

## Decision

**The heatmap augments ZPD placement. It never places on its own, and it never rules on the uplift
of lessons it selected.** Six rulings (operator, 2026-08-03, wayfinder #384):

**R1 — Authority: augment only, min-n gated.** D22's records+mission mechanism *is* the placement
mechanism. The heatmap contributes a cross-workspace topic **nomination** only for cells at
n ≥ k observations, and never outranks the workspace's own mission. Placement remains
workspace-local. This degrades cleanly: at zero cells the heatmap contributes nothing and the floor
still works.

**R2 — Circularity: selector ≠ ruler.** P5's uplift claim is read only from cells the placement did
**not** select — a pre-registered holdout. Coverage is the price; a ruler that cannot flatter itself
is what is bought. This inherits the P1 measurement-first discipline `adr:l1-core-operator-competence-property`
already carries.

**R3 — Grain: bounded context × mode. Repo is demoted to record metadata.** Six ADR-0044 bounded
contexts × 2 modes = 12 cells that can actually fill, pooling evidence across repos.
`repo × domain` fragments across 43 repos and an unbounded free-text axis and will never reach n on
any cell. `mode` stays in the key — invariant #4 of `adr:harness-loop-instrumentation` is untouched.
The required path → bounded-context mapping does not exist today and becomes the concrete
deliverable.

**R4 — Learning records: files canonical, ledger event as the machine index.** Teach workspaces
write `learning-records/*.md` per D21, and additionally emit a lesson-served event into the tracking
ledger the sensor already reads. Files stay the human-readable canon; the ledger is the index the
sensor queries. No new work-item surface is created — the D6 precedent is respected via the
shadow-space ruling (`pocock-skills-teach.md:8-10`). **Where those files live is #382's ruling, not
this one.**

**R5 — Cold start: min-n gate only. No backfill, no seeding run.** Cells accrue naturally or they do
not. If they never accrue, that is the H8 retirement rule working as designed — a harness that is
never invoked is theatre with a log file, and retiring it is the loop working.

**R6 — P5 reconciliation is deferred, not skipped.** P5's ratified target text names "repo × domain
cells"; R3 re-keys and R2 holds out. The divergence is recorded now (map Notes, this ADR) and the
northstar amendment rides with the slice that actually builds the re-keyed sensor, rather than
spending a second human-gated registry PR against numbers that are still uncalibrated proposals.

### Explicitly not decided here

- **Whether a low comprehension score should GATE a merge.** Parked in `diagram-first-output` (#366)
  fog. Untouched.
- **Where the teach corpus and learning records live** — #382.
- **Who owns retention and spaced retrieval** — #385, which R1 unblocks by fixing the altitude
  placement operates at.
- **The value of k**, and which cells form the holdout — see Consequences.

## Consequences

**The Destination line is qualified.** "Lesson placement is computed, not guessed" now reads: the
*floor* is computed from the workspace's own mission and records; the heatmap makes the choice
*better-informed across workspaces*, not *authoritative*.

**Three emissions must change before the heatmap can nominate anything.** In dependency order:

1. **Persist the difficulty/facet profile at `--record`.** Without it the sensor cannot distinguish
   proximal from foundational, which is the whole ZPD question. This is the single blocking gap.
2. **A path → bounded-context classifier.** Passes the wayfinder placement litmus as a **roadmap
   slice**, not a decision ticket: success and a machine-runnable check are both statable ("given a
   diff, emit exactly one of six contexts; check = agrees with hand-labels on N cases"). It is a
   delivery and belongs on a roadmap.
3. **The lesson-served ledger event** (R4), so served lessons are attributable to cells.

**Standing risks this ADR records rather than resolves:**

- **Zero invocations.** The instrument P5 depends on has produced no data in five days across 25
  qualifying merges. R5 deliberately declines to paper over this; the H8 retirement rule is the
  thing that catches it, and it should be allowed to.
- **`mode` is an unverifiable self-report** and a mandatory key component. A mislabelled `--cold`
  silently forks a cell — and under R2 it also corrupts the holdout.
- **`repo` is a `cwd` basename.** Demoting it to metadata (R3) reduces but does not remove the
  problem; 42/89 existing rows are labelled with a directory that is not a repo.
- **No time decay in the EWMA.** Ten quizzes in an afternoon and ten across ten months weight
  identically. A stale cell never ages, which matters more for a placement prior than for a score.
- **No deskilling counter-metric.** Already recorded against P5 in `decisions/open-unknowns.md`;
  R2's holdout does not address it.
- **Comprehension-as-competence is itself unvalidated.** `.claude/skills/merge-quiz/SKILL.md:32`
  says so plainly, and neither vault page (`ai-augmentation-evidence`, `se-competency-engine`)
  treats the validity question. This ADR does not upgrade the instrument's evidentiary standing; it
  constrains how far a decision may lean on it.

**What stays untouched.** `/merge-quiz` remains advisory and never blocks a merge
(`adr:harness-loop-instrumentation` invariant #3, four code sites). Stage A observe-only is
unchanged. Nothing in this ADR is implemented by the session that wrote it — it is a ruling, and the
building is a roadmap slice.
