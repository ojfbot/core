---
name: teach
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "teach", "teach me",
  "teach me this", "spawn a teach workspace", "build a lesson", "make me a lesson
  on X", "I want to learn X", "teach session". Spawns a standalone teach workspace
  in a per-repo git worktree, interrogates a MISSION, vets RESOURCES, authors
  self-contained interactive HTML lessons calibrated to the zone of proximal
  development, and deposits them to the fleet corpus at ~/selfco/teach/ with
  evidence. Distinct from /merge-quiz (tests comprehension of one diff).
---

# /teach

You build a **teach workspace**: a standalone, mission-grounded, source-vetted place that produces
interactive HTML lessons and accumulates into a fleet corpus. Adapted from `mattpocock/skills`
`productivity/teach` (D18–D25, `decisions/adopt-stack/pocock-skills-teach.md`).

**Tier:** 2 — Multi-step procedure
**Phase:** Continuous
**Input:** `$ARGUMENTS` — a topic (`ewma heatmaps`), or empty to derive one from the session.

## Core principles

1. **Effort before answers.** Teaching that hands over conclusions produces fluency, not storage
   strength. Ask, let them try, *then* explain — whether they got it right or wrong. Formative only:
   nothing here grades a person.
2. **Never trust your parametric knowledge.** The first job on any topic is finding high-trust
   sources. **Fleet-internal artifacts are first-class primary sources** — ADRs, repo docs, the
   wayfinder maps, vault synthesis pages. For a system-internal topic they *are* the sources; a
   subreddit link inside a lesson about this fleet's own code is noise (D19/D20).
3. **Teach at the zone of proximal development.** Placement reads the workspace's own
   `learning-records/` plus its `MISSION.md` — that is the floor and it works from zero
   (D22). The cross-workspace heatmap may *nominate* a topic, never override the mission, and only
   for cells at n ≥ k (`adr:comprehension-heatmap-zpd-role` R1). Today it has zero cells; the floor
   is the whole mechanism.
4. **A lesson that never deposits did not happen.** The worktree is disposable by definition. See
   "Deposit" — it is a script, not a good intention, and this is the load-bearing step.
5. **Working trees stay clean.** Lessons are never committed into a repo's working tree. The
   authoring branch is pushed and never merged.

## Workflow

### 1. Spawn the workspace

A per-repo `git worktree` on a branch named `teach/<topic-slug>`:

```bash
git worktree add ../teach-<topic-slug> -b teach/<topic-slug> origin/main
```

The workspace sits next to the code and the diffs the lesson cites — that adjacency is the point of
authoring in a worktree rather than anywhere else.

**Inject teaching preferences from fleet memory at spawn** (D25). Do not create a `NOTES.md`: the
fleet already has memory surfaces, and a per-workspace preference file is a fourth one. Read what
the operator's memory and prior `learning-records/` say about how they like to be taught, and carry
it in context.

### 2. Interrogate the MISSION — before anything else

Write `MISSION.md` by asking, one question at a time: what do they want to *do* that they cannot do
now? What have they already tried? What is the deadline or the forcing function? Where is their
current model likely wrong?

A mission is a capability, not a subject. "Understand EWMA" is a subject. "Read the merge-quiz
heatmap and say whether a cell's score means I should worry" is a mission — and it tells you exactly
which lesson to build.

### 3. Vet RESOURCES

`RESOURCES.md`: every entry annotated with what it covers and when to reach for it. Prune ruthlessly
— five sharp sources beat thirty mediocre ones. Keep an explicit `## Gaps` section; it drives the
next search and it is honest about what you could not source. See
`knowledge/mission-and-resources.md`.

### 4. Place the lesson (ZPD)

Read `learning-records/` + `MISSION.md` and teach the most relevant thing that fits in their zone —
just past what they can already do, reachable with effort. Knowledge before skill, within
working-memory limits: one lesson, one tangible win.

If a cross-workspace nomination exists and clears its min-n gate, treat it as a weak prior that can
break a tie between two candidate lessons. It never outranks the mission.

### 5. Author the lesson

One numbered, self-contained HTML file per lesson. Full authoring spec in
`knowledge/lesson-format.md` — read it before writing any HTML. In brief: Tufte-beautiful and
printable, littered with citations back to vetted sources, one recommended primary source, an
interactive quiz whose answers are **length-matched** (formatting must leak no clue), and a
follow-up-questions reminder at the end.

Author against `assets/lesson.css`; **ship with the CSS inlined**:

```bash
node .claude/skills/teach/scripts/inline-css.mjs 0001-<slug>.html
```

This is not optional polish. #386 measured it: strip the sibling stylesheet and the lesson falls
back to Times at an 8px body margin — every Tufte opinion lost, while the inline quiz JS survives.
A deposited lesson is opened standalone from an Obsidian attachment; there is no sibling stylesheet
at the other end.

### 6. Write the learning record

Evidence-gated, lazily created: `learning-records/NNNN-<slug>.md`. **Coverage is not learning —
wait for evidence.** Record prior-knowledge disclosures and corrected misconceptions, in the
learner's own words where you have them. Supersede, never delete. Format:
`knowledge/lesson-format.md`.

### 7. Deposit — the step that must not be skipped

```bash
node .claude/skills/teach/scripts/deposit.mjs --topic=<slug> --workspace=. \
  --repo=<repo> --session=<session-id> [--bead=<id>] [--refs=github:ojfbot/core#382]
```

Three acts that ship together: copies durable artifacts to `~/selfco/teach/<topic-slug>/`, appends
`harness:lesson-deposited` to `~/selfco/tracking/teach-sessions.jsonl`, and appends the
`teach/index.md` entry. It refuses to emit when there is nothing to deposit — an empty deposit is a
failure, and a row claiming otherwise would launder it into evidence of success.

Then **push the branch and never merge it**:

```bash
git push -u origin teach/<topic-slug>
```

That is what makes a missed deposit recoverable instead of fatal, and it is the reconciler's
left-hand side.

### 8. Report

Tell the user what was deposited, where, and what the record says they still do not know. Send the
lesson to their side panel — never make them hunt for a file path.

## Reading from the corpus

Future sessions draw from `~/selfco/teach/index.md` (the browsable hub — Obsidian will not render a
standalone `.html` as a page, so lessons are attachments opened in a browser) and from
`~/selfco/teach/<topic>/learning-records/` for what the operator already knows.

Check the corpus **before** authoring: a lesson on a topic already taught should supersede and build
on its record, not restart from zero.

## Constraints

- Never commit a lesson into a repo's working tree. The branch is pushed, never merged.
- Never grade summatively, and never report a score as a verdict on the person.
- `~/selfco/teach/` is an **artifact sink, not a work-item surface** — nothing in it is ever open,
  assigned, or closed (`adr:teach-corpus-deposit-architecture` R1, answering ADR-0097 row D6).
  Work items about teaching live in GitHub issues and roadmap slices, as they already do.
- Emit `harness:lesson-deposited` only. `harness:lesson-served` belongs to the ZPD sensor
  (`adr:comprehension-heatmap-zpd-role` R4) — depositing is not serving, and collapsing them would
  let corpus growth read as teaching delivered.
- Do not fabricate a citation. If you could not source a claim, it goes in `## Gaps`.

## Gotchas

- **The deposit is where this fails silently.** A worktree is disposable; if the deposit does not
  fire, the lesson dies with it and nothing notices. That is why `reconcile-teach-deposits.mjs`
  exists — measured precedent: `/diagram`'s deposit is a prose principle, and `~/selfco/diagrams/`
  holds 2 files, untracked, with 0 ledger rows, against 540/194/90/60 rows in the four hook-emitted
  channels. Run the script; do not "remember to copy the files".
- **The corpus is empty until this skill runs.** Placement degrades to mission-only, which is the
  designed floor — not a degraded mode to apologize for or to work around by inventing history.
- **Length-matched quiz answers are error-prone by hand** (#386 finding). Check every option set:
  if the correct answer is the longest or the most precisely worded, you have leaked it.
- **Don't reach for `/merge-quiz`'s heatmap to pick the topic.** It has zero cells, and even full it
  only nominates. The mission decides.

## See Also

- `knowledge/lesson-format.md` — HTML lesson spec (D23 as amended by #386) + learning-record format (D21)
- `knowledge/mission-and-resources.md` — MISSION interrogation, RESOURCES vetting, reference/glossary split (D18–D20, D24)
- `scripts/deposit.mjs` · `scripts/inline-css.mjs` · `../../../scripts/hooks/reconcile-teach-deposits.mjs`
- `decisions/adr/draft-teach-corpus-deposit-architecture.md` — where the corpus lives and why the deposit emits
- `decisions/adr/draft-comprehension-heatmap-zpd-role.md` — what the heatmap may and may not decide
- `decisions/wayfinder/teach-in-the-loop.md` — the map; open questions live there
- `/merge-quiz` — tests comprehension of one diff; this skill teaches a topic. Same philosophy
  ("teaching is the product"), different unit.
