# Screenshot Classification Guide

Detailed examples and detection signals for each classification category.

## `regression`

Element is broken, missing, or visually degraded compared to baseline.

**Detection signals:**
- Component is absent in current but present in baseline
- Text is truncated, overflowing, or invisible
- Layout is broken (elements overlapping, wrong position, wrong size)
- Color/contrast change that reduces readability
- Interactive element is unclickable or inaccessible
- Error state shown where content should be

**Examples:**
- Baseline: button with label "Submit" | Current: button with no label (empty)
- Baseline: card with image | Current: card with broken image placeholder
- Baseline: properly spaced form | Current: form with overlapping labels

**Action:** BLOCKING — investigate before approving. Check `git log` for changes to the component.

---

## `enhancement`

Existing element is visibly improved. No degradation.

**Detection signals:**
- Spacing improved (more consistent, better alignment)
- Typography improved (better contrast, better hierarchy)
- Component is more polished than baseline
- Animation added that improves UX (not just decorative)
- Color updated to match design system (closer to design intent)

**Examples:**
- Baseline: uneven padding in cards | Current: consistent padding
- Baseline: low-contrast text | Current: better contrast ratio

**Action:** No code investigation needed. Approve and optionally update baseline.

---

## `new-feature`

New UI element present in current screenshot, absent from baseline.

**Detection signals:**
- Entirely new component in current that has no counterpart in baseline
- New section, panel, or modal appears
- New navigation item or menu option
- New data visualization element

**Examples:**
- Baseline: page without footer | Current: page with footer added
- Baseline: form with 3 fields | Current: form with 4 fields

**Action:** Verify it was intentional (matches PR intent). If yes, approve and update baseline.

---

## `intentional-change`

Known change consistent with the PR intent. Diff is expected.

**Detection signals:**
- Change matches the PR description or commit message
- Design updated to match a ticket or design spec
- Theme, brand, or color palette update
- Copy/text update

**Examples:**
- PR: "Update button color to match new brand guide" | Screenshot: button color changed
- PR: "Add dark mode support" | Screenshot: inverted colors in dark mode test

**Action:** Verify the change matches PR intent, then approve and update baseline.

---

## `false-positive`

Dynamic content causing a diff that has no product meaning.

**Detection signals:**
- Timestamp or date visible in the screenshot
- Loading spinner captured mid-animation
- Random avatar or image content
- Network-dependent content (ad, embed)
- Cursor or focus ring position differs
- Anti-aliasing or subpixel rendering difference

**Examples:**
- Baseline: "Last updated: Jan 15 2025" | Current: "Last updated: Jan 16 2025"
- Baseline: spinner at frame 0 | Current: spinner at frame 3
- Baseline: avatar A | Current: avatar B (random assignment)

**Action:** Mark as false positive. Do not update baseline. Fix the test to mask dynamic content.

---

## `no-change`

Pixel-identical or within noise tolerance.

**Detection signals:**
- Diff tool reports 0% difference
- Diff is below configured pixel tolerance (typically <0.1%)
- Any visible diff is subpixel noise with no semantic meaning

**Action:** No action required.

---

## How to determine category when ambiguous

1. Read the PR description — does the change match intent? → `intentional-change`
2. Check if a dynamic element is in the diff region → `false-positive`
3. Does the change improve clarity/polish with no degradation? → `enhancement`
4. Is something missing or broken that was present in baseline? → `regression`
5. Is something entirely new? → `new-feature`

When in doubt between `regression` and `intentional-change`: treat as `regression` until confirmed.
