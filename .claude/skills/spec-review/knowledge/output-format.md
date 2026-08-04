# Output format

Reference for `/spec-review` Step 9, moved verbatim from SKILL.md: the exact review output template.

```
## Spec Review: <title>

### Verdict: PASS | PASS WITH NOTES | BLOCKED

---

### CRITICAL ERRORS
<numbered list — each entry: claim made → evidence contradicting it → required correction>

### SIGNIFICANT GAPS
<numbered list — each entry: what's missing or wrong → why it matters → recommended fix>

### MINOR ISSUES
<numbered list — each entry: inaccuracy → one-line correction>

### What the spec gets right
<bulleted list>

### Summary table
| # | Severity | Issue |
|---|----------|-------|
...

### Suggested fixes before /scaffold
<ordered by priority — only items that affect implementation correctness>
```
