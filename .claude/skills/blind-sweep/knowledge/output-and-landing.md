# Output and landing — template, teaching close, and ledger rules

Reference for `/blind-sweep` Steps 4–6, moved verbatim from SKILL.md.

## Output template

```
## Blind sweep — <area>

**What I read:** <files/dirs, so the user can judge the basis>

### Known knowns
### Known unknowns          → these become /grill-with-docs questions
### Unknown knowns          → unwritten taste; confirm or correct these
### Domain-standard considerations not visibly covered
  (this is the honest stand-in for unknown unknowns — a checklist, not a guarantee)

| Item | Agreement | Evidence |
|------|-----------|----------|

### Singletons (raised once — judge these yourself; this is the high-value bucket, not the leftovers)

### What I could not determine from the repo
```

## The teaching close

- the **3–5 terms** in this area whose meaning is non-obvious, defined in one line each;
- **2–3 questions worth asking** that they now have the vocabulary to ask;
- the **one thing** most worth deciding before touching it.

## Why the ledger is a separate file

The two are genuinely different artifacts (this one maps an *area's* familiarity; that one records decisions deferred during a *specific* design conversation), and keeping them separate is also what lets the disposition projector attribute a write to the right skill. `artifactWrittenInSession` matches on path and session alone, never on authorship, so two skills sharing one artifact makes every write ambiguous and can score the *other* skill a false `capture_miss` — the exact defect adr:harness-loop-instrumentation exists to remove.
