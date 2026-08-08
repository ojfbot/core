---
type: wayfinder-map
slug: teach-persistence
northstar: l1-core
tracker_issue: 412
status: charting
---

# Wayfinder — teach persistence

## Destination

Teaching survives across sessions. A lightweight persistent surface where a lesson is taken, its
outcome is recorded **reliably**, and the next lesson is **placed from that record** rather than
cold-starting every time. Files stay canonical (`~/selfco/teach/`); the app is a **view that
appends**, never the store. It runs on the Pi (`selfco-box`). Arrived = a second session that
demonstrably picks up where the first left off, with the outcome evidence to prove it did.

Anchor: `ns:l1-core#P5` — "The harness raises operator competence," whose target states that **no
uplift may be published before the instrument's capture quality is green** (P1 discipline). This map
is that capture-quality fix. Resolved via `resolve-anchor.mjs`, 2026-08-04.

## Notes

- **Why this map exists.** `/teach` shipped 2026-08-04 and was used three times the same day. The
  write half is mechanized — `deposit.mjs` emits `harness:lesson-deposited`, and
  `reconcile-teach-deposits.mjs` audits for its absence. The **read half is a paragraph in
  `SKILL.md`**: zero scripts read the corpus, nothing checks that any were read, and the reconciler
  structurally cannot catch a session that ignored every prior record, because such a session still
  deposits cleanly. That is the TD-006 shape reproduced inside an architecture built to prevent it.
- **The motivating evidence.** The corpus's first real comprehension data was a **0/3** on
  `prompt-ablation` lesson 0001, reported by the operator. It had nowhere durable to go — learning
  records are authored by the agent at author-time with no path to update after the learner engages,
  so D21's evidence gate currently closes on the author's *predictions* rather than the learner's
  *results*. The 0/3 was hand-written into the record; that is not a mechanism.
- **The 0/3 was a placement failure, not a comprehension one** — three questions, three unearned
  leaps (a taxonomy applied two paragraphs after introduction with no worked example; an obstacle
  question resting on a subordinate clause; a distinction carried by one adverb). Recorded because it
  shapes what an outcome record must be able to say: an aggregate score renders this as "failed,"
  which is the wrong diagnosis and would misplace the next lesson.
- **Host state, measured 2026-08-04 — the Destination's biggest exposed risk.** The Pi's vault is at
  `ff9c94a` while the Mac is at `02515a1`; there is **no `teach/` directory** on the Pi; and
  `systemctl --user list-timers` shows **0 timers**, though the transport was believed to poll every
  15 minutes. A third writer exists: Obsidian Sync binds `~/selfco` on the Mac. "Files canonical" and
  "app on the Pi" are only compatible once this is ruled.
- **A tension this map inherits from two correct rulings.** #386 plus the 2026-08-04 fix made lesson
  quizzes **zero-JavaScript** (radio inputs + `:checked`) because the side panel renders lessons as
  static snapshots where scripts never run. Recording an outcome needs JS and a real origin. Both
  rulings are right in isolation; the map has to rule the seam.
- **Reference layer (vault, read-only):** `~/selfco/wiki/synthesis/se-competency-engine.md` — the
  prior design for an ambient competency drip, whose "measured uplift" guardrail is what P5 now
  carries; and `wiki/concepts/ai-augmentation-evidence.md` (tutoring gains are real, deskilling is
  real, measure uplift). Neither treats capture reliability, which is this map's contribution.
- **Boundaries — owned elsewhere, not decided here:** pedagogy, corpus location, and the ZPD sensor's
  authority all belong to `teach-in-the-loop` (#379), which is `status: working` with five open
  tickets. Retention and spaced repetition are #385 there. The comprehension-**gate** question stays
  parked in `diagram-first-output` (#366) fog. This map owns **persistence and capture**, nothing
  about what should be taught.

## Decisions so far

*(none — charting session closed zero tickets)*

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|-------------------------------|------|------------|--------|
| Which vault checkout is canonical when the app writes? (#413) | grilling | — | open |
| What does "writes reliably" mean — the write contract (#414) | grilling | — | open |
| How does a zero-JS lesson report an outcome? (#415) | grilling | — | open |
| What does an outcome record carry? (#416) | grilling | — | open |
| Does teach's quiz feed the merge-quiz heatmap, or a separate instrument? (#417) | grilling | outcome record shape | open |
| Read path: how does placement consume records, mechanically? (#418) | grilling | outcome record shape | open |
| Smallest thing that serves a lesson and records an outcome from the Pi (#419) | prototype | canonical vault checkout | open |
| Provision the Pi to host the teach surface (#420) | task | canonical vault checkout | open |

**Frontier** (open + unblocked): canonical vault checkout · the write contract · zero-JS outcome
reporting · outcome record shape.

Suggested order: **outcome record shape first** — it unblocks two tickets and its answer constrains
the prototype. **Canonical checkout** is the other high-leverage one; it blocks all the
infrastructure work and its answer may still invalidate the Pi as the host.

## Not yet specified

- **Multi-device access** — the Destination names the Pi partly because a phone could reach it on the
  LAN, but nothing about mobile lesson-taking has been thought through. Graduates once the prototype
  says whether LAN access is trivial or fiddly.
- **Scheduling and spaced repetition** — when a topic should resurface. Genuinely adjacent to
  `teach-in-the-loop` #385 (retention boundary), and charting it here would consume that ticket.
  Statable only after outcome records exist to schedule against.
- **Does the app ever author?** Today authoring is a worktree plus an agent session. Whether the
  surface eventually takes lesson-authoring is out of the Destination as ruled, but the question will
  return once the app exists.
- **Corpus migration** — two topics already deposited with records containing no outcome data. What
  happens to them when the record shape changes.
- **Failure of the whole premise** — if the Pi proves the wrong host and the answer is "local server
  on the Mac," most of this map survives but the Destination sentence changes. Not a ticket until the
  prototype reports.

## Out of scope

- **The app as canonical store.** Files stay the source of truth; the app appends. (Operator,
  2026-08-04 — the deposit spine, reconciler, Obsidian browsability, and git history all depend on
  it.)
- **The app as the lesson surface**, replacing deposited self-contained HTML. (Operator, 2026-08-04 —
  it would reopen #386/D23, which are settled.)
- **Replacing the deposit architecture.** This map extends it toward the read half; it never
  supersedes `adr:teach-corpus-deposit-architecture`.
- **Deciding what should be taught.** Pedagogy, ZPD authority, and corpus rulings belong to
  `teach-in-the-loop` (#379).
