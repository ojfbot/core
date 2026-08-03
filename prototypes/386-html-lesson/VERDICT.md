# PROTOTYPE — #386 HTML lesson pattern spike

Throwaway. Kept on this branch as a primary source (never merged) because the D23 authoring
shape is encoded more precisely by the files than by prose. Driving ticket: ojfbot/core#386.

## Question

Does a lesson authored to the D23 spec render in the side panel the way SVG diagrams do —
and does the `./assets/` shared-stylesheet opinion survive that render path?

## What was built

One lesson, `01-the-placement-litmus.html` (the wayfinder placement litmus — a real topic
with real in-fleet sources, per D19's internal-artifacts-first rule). Every D23 element is
present: numbered self-contained file, shared stylesheet in `./assets/`, interactive quiz
with length-matched answers, citations throughout, one recommended primary source,
follow-up-questions reminder, Tufte-leaning print block, one tangible win.

`inline.py` generates `01-the-placement-litmus.inlined.html` — the same lesson with the
stylesheet folded in. Two variants differing in exactly the dimension under test.

## Measurements

Served over HTTP, probed via real iframe navigation (not `srcdoc` — `srcdoc` inherits the
parent's base URL and silently passes a test it should fail):

| Render condition | Sheet rules | Body font | Body bg | Styled |
|---|---|---|---|---|
| A, `assets/` reachable | 35 | Iowan Old Style | `#16150f` | yes |
| A, `assets/` absent (404) | **0** | **Times** | **transparent** | **no** |
| B, inlined | 35 | Iowan Old Style | `#16150f` | yes |

Other findings:
- Inline `<script>` survives every path — the quiz stayed functional even in the unstyled
  variant A. Interactivity is not the fragile part; **presentation is**.
- Zero external references in variant B (checked for `link`/`script src`/`img`/`@import`/
  `url()`). Cost of self-containment: 6.7 KB → 10.8 KB per lesson.
- Dark mode works via `prefers-color-scheme`; no horizontal overflow; the one wide table is
  wrapped in its own `overflow-x` container.
- Length-matching quiz answers by hand is error-prone: the first draft's Q2 correct answer
  was the longest option by 4 characters. A checker caught it; a human would not have.

## Verdict

**HTML earns its keep — but "self-contained" and "shared stylesheet in `./assets/`" are in
conflict, and self-contained wins at the render boundary.**

A lesson that loses its stylesheet does not degrade gracefully. It degrades to Times New
Roman with an 8px body margin — every Tufte/printability opinion in D23 is the *first*
casualty, while the quiz keeps working. So the artifact that reaches a reader must carry
its own CSS.

D23 is not wrong about `./assets/` — stylesheet-as-first-shared-component is right for
**authoring** (one place to edit, N lessons inherit). It is wrong as the **shipping** shape.
Resolution: `assets/lesson.css` stays canonical source; the rendered lesson is build output
with the CSS inlined. `inline.py` is 8 lines — this is a trivial step, not a build system.

## Disposition

Kept on branch `wayfinder/386-html-lesson-spike`, never merged. Not deleted: the D23
authoring shape and the inline step are reproduced more exactly here than in prose, and the
spec that follows should inline snippets from these files with attribution.
