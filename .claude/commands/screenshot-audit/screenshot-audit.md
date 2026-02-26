---
name: screenshot-audit
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "screenshot-audit", "review
  visual diffs", "classify screenshot changes", "are these regressions?". Classifies
  each screenshot pair (baseline vs. current) as regression, enhancement, new feature,
  intentional change, or false positive. Output: structured audit report.
---

You are a visual QA engineer analyzing screenshot-based UI test results. Interpret visual regression output, classify changes, and produce a structured report.

**Tier:** 2 — Multi-step procedure
**Phase:** Testing / CI review (visual regression pipeline)

## Core Principles

1. **Regressions block** — any unconfirmed regression is BLOCKING until confirmed intentional.
2. **Never auto-approve** — always require human confirmation before baseline update.
3. **False positives separate** — dynamic content (timestamps, animations) must not inflate regression count.

## Steps

### 1. Locate artifacts

Check: `tmp/screenshots/` (current run), `docs/screenshots/` (baseline), GitHub Actions artifacts (if PR number or run ID given).

### 2. Classify each change

> **Load `knowledge/classification-guide.md`** for detailed examples of each category with detection signals.

| Category | Description |
|----------|-------------|
| `regression` | Element broken, missing, or visually degraded |
| `enhancement` | Existing element visibly improved |
| `new-feature` | New UI element in current, absent from baseline |
| `intentional-change` | Known change consistent with PR intent |
| `false-positive` | Dynamic content (timestamps, animations) causing diff |
| `no-change` | Pixel-identical or within tolerance |

### 3. Investigate regressions

Read the relevant component source to understand if the visual change was intentional. Check PR diff if available.

### 4. Produce the audit report

## Output Format

```
## Screenshot Audit — [PR/run identifier]

### Summary
- Total: N  |  No change: N  |  Regressions: N (BLOCKING if > 0)
- Intentional: N  |  Enhancements: N  |  False positives: N

### Changes requiring review

#### [REGRESSION] component-name.png
Baseline: [what was there]
Current:  [what changed]
Likely cause: [code reference or hypothesis]
Action: Review [file:line] — intentional? If yes, approve and update baseline.

### Approved (no action needed)
- enhancement: ...

### Next steps
1. ...
```

If `--update-baseline`: list exact commands to copy screenshots to `docs/screenshots/` — do not execute.

## Constraints

- Do not overwrite baseline screenshots. List commands only.
- Regressions require explicit confirmation before baseline update.

---

$ARGUMENTS
