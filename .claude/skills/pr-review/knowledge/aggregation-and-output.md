Reference for `/pr-review` Step 4: the verbatim-aggregation rules and the exact output block format.

## Aggregate — verbatim, never reranked

Present the two reports under `### Standards` and `### Spec` headings **verbatim** — formatting fixes only, never reword, reorder, or rerank. The `### Acceptance criteria` table is lifted as-is from the Spec report, not reconstructed. Do **not** merge the axes into one ranked findings list — a change can pass one axis and fail the other, and reporting them separately stops one axis from masking the other. The verdict still follows the blocking rules (auth/ownership/secrets → BLOCKED regardless of axis); end with per-axis totals and the worst finding *within each axis*, never a single cross-axis winner.

## Output Format

```
## PR Review: [title or PR number]
Fixed point: <ref> (<sha>) · <N> commits · <M> files

### Verdict: APPROVE | REQUEST CHANGES | BLOCKED (security)

### Standards
[Standards sub-agent report, verbatim: violations w/ cited rules; smells named as judgement calls]

### Spec
[Spec sub-agent report, verbatim — or "no spec available"]

### Acceptance criteria
| Criterion | Status |
|-----------|--------|

### Per-axis summary
Standards: <n> findings, worst: <...> · Spec: <n> findings, worst: <...>

### Summary
[One paragraph for GitHub PR comment]
```

If `--comment`: output only the Summary section as a standalone GitHub PR comment.
