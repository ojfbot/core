# 0001 — sorting instructions into deficiency patches and house rules

Date: 2026-08-04
Lesson: 0001-keep-or-cut.html
Supersedes:
Status: recorded

## Prior knowledge disclosed

- The operator chose **"large"** from three explicitly-costed options. They took the most expensive
  scope with the trade-offs visible — a disclosure about appetite, not about knowledge.
- Earlier in the same session they asked, plainly, *"can you access this url?"* — checking the
  sourcing before authorising work built on it. That is the same instinct the previous topic's
  lesson was about, applied unprompted to a live decision.
- Standing context, not disclosed this round: the fleet is mid-flight on skill-hardening Wave 2,
  which optimizes sprawl **within** skills. This lesson's argument runs at a different level (the
  aggregate always-loaded surface, and the *kind* of line rather than the count), so the two are not
  the same program even though both look like "make it smaller."

## Evidence

**What the scope choice shows.** "Large" included a second lesson aimed at their own 7,350-token
surface — that is, they opted into being taught something with an implication for work already
dispatched. Someone protecting a program in flight picks "small."

**What the URL question shows.** They did not ask me to proceed on the secondary sources a second
time. Having been told once that the sourcing was thin, they went after the primary. Small moment,
but it is the discriminator behaviour from the previous topic showing up in the wild rather than in a
quiz.

**QUIZ EVIDENCE — 0 of 3, reported by the operator 2026-08-04.** The first real comprehension data
this corpus has held.

*Scope caveat:* they said "i missed all 3" directly after this lesson was delivered, so it is read as
this lesson's quiz. Not disambiguated against the other two lessons delivered the same session. If a
later session finds otherwise, supersede this record rather than editing it.

**Read this as a placement failure, not a comprehension one.** Reviewing the three questions against
the lesson body:

- **Q1** (which line is the best deletion candidate) required *applying* the
  deficiency-patch/house-rule taxonomy two paragraphs after it was introduced, with **no worked
  example in between**. The lesson asserted the distinction and immediately tested transfer.
- **Q3** (what is the real obstacle) required connecting "ablation step 3 needs evals" to "the
  comprehension heatmap has zero cells" — a fact that appears **once, in a subordinate clause**, and
  which is fleet trivia rather than anything the lesson taught.
- **Q2** (what follows from one clean run) turned on the word *repeatedly* in the restoration bar —
  a single adverb carrying the whole distinction, never drawn out.

Three questions, three different unearned leaps. The lesson also opened with a striking measurement
(~7,350 tokens) that pulls attention toward the *number*, then quizzed on the *taxonomy* — attention
and assessment aimed at different things.

## Corrected misconception

**Confirmed, and it was mine.** The anticipated misconception below was about the operator; the
evidence says the defect was in the teaching. Recorded as a correction to the author's model:

> The lesson assumed a distinction stated clearly is a distinction usable. It is not. Knowledge
> before skill (D23) was violated: the concept arrived and the application was demanded in the same
> breath, with no modelled instance of the sort being performed. The fix is not a gentler quiz — it
> is a worked example between the two, and probably splitting this into two lessons.

The original anticipation, left for a later record to confirm or refute:

> Anticipated, unconfirmed: that the 80% headline implies their own instruction set is bloated and
> should shrink toward Anthropic's ~2.5k. The lesson argues the comparison is category-invalid —
> Anthropic's prompt serves millions across unknown tasks, while this fleet's serves one operator
> with strong stated preferences, so the house-rule fraction should be far higher here. If this
> lands, the tell is the operator asking *which kind* of line something is before asking how long
> the file is.

## Still open

- **The sort is untested on real lines.** The quiz uses four constructed examples. Whether they can
  sort ambiguous *actual* lines from `core/CLAUDE.md` is unknown, and the ambiguous ones are the only
  reason the method matters.
- **The taxonomy is mine, not Boris's.** He states the qualifier (some prompts kept for product
  behavior); the two-category split is my reading of it. Defensible, but a learner repeating it as
  his framework would be overstating the source. Recorded in `RESOURCES.md` gaps too.
- **The blocker may be the real lesson.** Step 3 of the ablation loop needs evals, and the fleet has
  none — the comprehension heatmap has zero cells. If the operator's takeaway is "build the ruler
  first" rather than "sort the lines," the placement was arguably one step too far downstream.
- **Nothing was cut, deliberately.** The mission scoped application out. Whether the sort survives
  contact with a real deletion decision is untested and is the natural next lesson.
- **The two topics may want merging later.** `agent-algebra-dynamic-workflows` and `prompt-ablation`
  come from one talk and are cross-linked, but the corpus is topic-keyed and nothing yet models "one
  source, several topics." Not a problem at n=2; would be at n=10.
