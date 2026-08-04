# Lesson format + learning-record format

The authoring spec for `/teach`. D23 (HTML lessons) as amended by the #386 spike, and D21
(learning records). Source: `decisions/adopt-stack/pocock-skills-teach.md`.

## HTML lesson

One numbered file per lesson: `NNNN-<slug>.html`, four-digit ordinal, within the topic folder.
Lessons and records number independently.

### Self-containment — the amended rule

Author against `assets/lesson.css`. **Ship with the CSS inlined.**

D23 said both "self-contained lesson" and "shared stylesheet in `./assets/`". #386 measured those as
conflicting at the render boundary and the map amended D23: strip the sibling stylesheet and the
lesson falls back to Times at an 8px body margin — 0 rules loaded, every Tufte and printability
opinion gone — while the inline quiz JS survives intact. **Presentation is the fragile part, not
interactivity.**

So `assets/lesson.css` is the *authoring* source (N lessons inheriting one stylesheet is the right
instinct for authoring) and the *shipped* lesson is build output:

```bash
node ../scripts/inline-css.mjs 0001-<slug>.html          # inline
node ../scripts/inline-css.mjs 0001-<slug>.html --check   # verify before deposit
```

This matters because a deposited lesson is opened **standalone**, as an Obsidian attachment in a
browser. There is no `assets/` directory at the other end.

### Structure

- **Short.** One lesson, one tangible win, inside working-memory limits. If it needs two wins, it is
  two lessons.
- **Knowledge before skill.** The concept, then the thing they can now do with it.
- **Tufte-beautiful and printable.** Generous margins, a measure around 34em, sidenotes rather than
  footnotes, real typography. It should print without a stylesheet argument.
- **Littered with citations** back to `RESOURCES.md` entries, at the claim, not in a bibliography.
- **Recommend exactly one primary source** for going deeper. A list of ten is a way of not choosing.
- **Close with a follow-up-questions reminder** — the lesson is a turn in a conversation, not a
  broadcast.

### The quiz

**Zero JavaScript. Radio inputs and `:checked` selectors, never a click handler.**

This is not a style preference, it is a delivery constraint measured on 2026-08-04. #386 tested a
lesson in a browser and concluded "presentation is the fragile part, not interactivity — the inline
quiz JS survives." In the **side panel** that is exactly inverted: a lesson renders as a static
snapshot, so the inlined CSS applies and the script never runs. Lesson 0001 shipped with JS buttons
and the operator reported they did nothing. Since the map's Destination is lessons "rendering in the
side panel as routinely as SVG diagrams do today," a JS quiz is broken in the surface that matters
most.

The CSS-only pattern works in the side panel, in a browser, in an Obsidian attachment, and in print:

```html
<div class="quiz">
  <p><strong>1.</strong> Question text?</p>
  <input class="opt ok" type="radio" name="q1" id="q1a"><label for="q1a">The correct option</label>
  <input class="opt"    type="radio" name="q1" id="q1b"><label for="q1b">A distractor option</label>
  <div class="explain"><strong>Answer.</strong> Why, and the mechanism.</div>
</div>
```

Rules the markup must hold: `class="ok"` marks the correct input; every input in one question shares
a `name`; each `<label for>` immediately follows its input (the `+` selectors depend on it); and the
`.explain` div comes last so `:checked ~ .explain` can reveal it. The explanation is hidden until an
answer is given — effort before answers — and print shows it unconditionally.

It exists to create retrieval effort, not to score.

**Answers must be length-matched.** This is the rule that is hardest to hold by hand and the one
#386 flagged as wanting a checker. If the correct option is the longest, the most hedged, or the
most precisely worded, the formatting has already given it away. Check every option set: swap the
correct answer's position, and read the four options as a stranger.

Explain the mechanism **after every answer**, right and wrong alike. "Correct" teaches nothing.

## Learning record

`learning-records/NNNN-<slug>.md`, ADR-style, lazily created.

**Evidence-gated: coverage is not learning.** A record is written when there is evidence of what
landed — an answer given, a misconception corrected, a prior-knowledge disclosure — not because a
lesson was delivered. A lesson that produced no evidence produces no record, and that absence is
itself honest signal.

**Supersession over deletion.** A later record supersedes an earlier one by naming it. Nothing is
edited away; the trajectory is the value.

```markdown
# NNNN — <what was learned>

Date: YYYY-MM-DD
Lesson: 0001-<slug>.html
Supersedes:            # slug of an earlier record, if any
Status: recorded

## Prior knowledge disclosed
What they said they already knew, in their words where possible.

## Evidence
What they actually did — answers given, the shape of the wrong ones, questions asked back.

## Corrected misconception
What they believed, what is true, and what made the difference.

## Still open
What they cannot yet do. This is the input to the next lesson's ZPD placement.
```

The `## Still open` section is the load-bearing one: it is what the next session reads to place the
next lesson, and it is the thing most easily filled with wishful summary. Write what they could not
do, not what the lesson covered.

## Reference documents

`reference/*.md` — **markdown by default**, the compressed essence of a topic.

Lessons are rarely revisited; references are (D24). A reference is not a lesson transcript — it is
what the learner keeps on the desk afterwards.

**This is where the fleet diverges from D24, and the reason is D24's own argument.** Because a
reference is the artifact most likely to be reopened, its format is decided by where it gets
reopened: the vault. Obsidian will not render a standalone `.html` as a page — the same finding that
put `teach/index.md` in markdown — so an HTML reference is an attachment you must bounce out to a
browser to read. That is the worst possible handling for a desk copy. Markdown renders natively and
stays browsable where it is kept, and it links into the rest of the vault with `[[wikilinks]]`.

`reference/*.html` is still accepted and still right for one case: a genuinely print-quality
cheat-sheet, where layout carries meaning. Inline the CSS if you write one, same as a lesson.

Deliberate divergence, same class as D25 (`NOTES.md` rejected). Found by the second `/teach`
invocation, whose markdown reference silently failed to deposit.
