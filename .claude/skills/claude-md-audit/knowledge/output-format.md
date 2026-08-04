# Output format

Reference for `/claude-md-audit`, moved verbatim from SKILL.md: what the routing plan contains and the exact output template.

A table: `block (heading) | bucket | destination | why`. Then the before→projected-after footprint line, and an explicit "blocks moved to @import: 0" assertion. End with the per-file diff preview (what each new/edited file would contain) — but in `propose` mode do **not** write anything.

```
## /claude-md-audit <repo> (<mode>)

Baseline (M1): <N> always-loaded tokens / <L> lines

| Block | Bucket | Destination | Why |
|-------|--------|-------------|-----|
| ...   | L0/L1/L2/del | <file>[ paths: <glob>] | ... |

Projected after: <N'> always-loaded tokens  (Δ <N'-N>; @import blocks: 0)
Layer-1 files: <list with scopes>   Layer-2: <list>   Deleted (verified-duplicate only): <list, each with the existing file that holds it>

Findings (fix in same pass): <broken "see X" pointers, stale references, contradictions — or "none">

Verdict: <one line — e.g. "core is Layer-0-heavy; minimal routing, footprint ~unchanged, correct">
Next: <apply, or /grill-with-docs for contested blocks, or move to next repo>
```
