---
type: defect-report
slug: selfco-core-entity-no-open-prs
class: false-assertion
severity: medium
status: open
disposition: repair-doc
location: "selfco:wiki/entities/core.md:31"
claim: "No open PRs, no milestones."
actual: "3 open PRs on ojfbot/core (#291, #292, #294) as of 2026-07-29"
claim_probe: "grep -q 'No open PRs' ~/selfco/wiki/entities/core.md"
truth_probe: "gh pr list --repo ojfbot/core --state open --json number --jq 'length'"
filed: 2026-07-29
filed_by: "agent:claude-fable-5"
evidence: "session-2026-07-29-selfco-ontology-audit"
---

# `entities/core.md` asserts zero open PRs; there are three

The page states "GH open issues: #77 … #91 … #93/#95 … #15 … #7 … **No open PRs, no
milestones**". The issue list is still accurate — all six verified open. The PR claim is
not: `ojfbot/core` has three open PRs (#291 odometer/techdebt, #292 stale-docs sweep,
#294 offsite relay).

## Why it matters

This is the highest-volatility class of claim in the vault and the most mechanically
checkable — a one-line `gh` call. Four such PR-state claims were verified false in the
same audit (`asset-foundry` #30, `landing` #23, `daily-logger` #191/#195/#198, and this
one), against zero PR-state claims that were still true. The class has a **0% accuracy
rate** at 25–48 days of age.

The page also carries `last_synced: 2026-07-04` while its body contains a section headed
"Harness loop instrumentation, 2026-07-29" — so `last_synced` cannot be trusted as a
freshness signal for the body. That conflation is filed separately as
`dr-selfco-last-synced-conflates-check-and-edit`.

## Repair

Per the layering decision of 2026-07-29 (decision #7: **the vault never copies fleet
state**), the correct repair is **not** to update the number. It is to remove the
standing PR/issue assertion from the page and reference the generated registry instead.
The entity page keeps judgment — what `core` is, why it matters, open threads — and links
out for facts.

Interim repair if the registry does not yet exist: delete the sentence. A missing fact is
strictly better than a false one, and this page is not the right owner of that fact.

## Closure

`claim_probe` exits non-zero once the literal string "No open PRs" is gone from the page —
which is satisfied by either repair path, and is *not* satisfied by merely editing the
count (a count is the same defect with a different number).
