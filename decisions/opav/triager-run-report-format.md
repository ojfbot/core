# Triager run report — agreed format (rm-l2-ojfbot#S26 entrance criterion)

Every triager run — proposal or empty — produces exactly this report. Operator agreement
with this format = merge of the PR that adds this file; changing the format later is a PR
to this file, never an in-run improvisation.

```markdown
# Triager run — YYYY-MM-DD

## Denominator (§4.6)
- sampled: <n> of <m> available (traces: x/y · beads: x/y · articles: x/y)
- not examined: <what and why — time, vantage, out-of-bounds>

## Failures open-coded
| item (trace_id / bead / article) | failure observed | cluster | new-cluster? |
|---|---|---|---|

## Taxonomy-coverage % (I3 TPM)
<assignable to existing cluster> / <total failures> = <pct>%   (new-cluster rate should fall over time)

## Proposed taxonomy deltas (0..n — each cited to >=2 items)
1. ...

## Golden-task candidates (0..n — fixture + expected assertion, 1 para each)
1. ...

## Outcome
one of: `proposal-pr-opened <url>` | `empty-run (nothing above threshold — §4.1 success)`
```

Rules the format encodes:
- The **denominator section is mandatory** even when empty-run — a report without it is
  malformed and the run does not count toward the S26 success criterion.
- **Coverage % is reported every run** (the I3 TPM), not only when proposals exist.
- Deltas cite ≥2 sampled items; single-occurrence failures stay `failure:unclassified`
  until they recur.
- An empty run opens **no PR** (§4.1); the report goes to stdout/launchd log and the
  wrapper's `~/.claude/trace-triager.jsonl` line records it.
