---
type: defect-report
slug: selfco-entity-status-overloaded
class: schema-drift
severity: medium
status: open
disposition: needs-investigation
location: "selfco:wiki/entities"
claim: "status: unstarted | active | paused | shipped | archived"
actual: "9 values in use across two orthogonal axes (lifecycle + relationship-to-fleet), plus 7 empty"
claim_probe: "test $(grep -h '^status:' ~/selfco/wiki/entities/*.md | sed 's/status: *//' | sort -u | grep -c .) -gt 5"
truth_probe: "grep -h '^status:' ~/selfco/wiki/entities/*.md | sed 's/status: *//' | sort -u | paste -sd' ' -"
filed: 2026-07-30
filed_by: "agent:claude-opus-5"
evidence: "S1 schema-as-data; audit 2026-07-29"
---

# `status:` on entity pages carries two orthogonal axes

Nine distinct values are in use where the prose schema declares five:

| Axis | Values | n |
|---|---|---|
| Lifecycle | `unstarted` `active` `paused` `shipped` `archived` `scaffold` | 113 |
| Relationship-to-fleet | `referenced` (we point at it, don't own it) · `tracking` (external repo we watch) · `incoming` (hardware not yet arrived) | 4 |
| — | *(empty)* | 7 |

## Why it matters

The two axes are independent, so the key cannot express both: a repo that is `referenced`
is silently also un-described as to whether it is active. This is the same overloading
disease as `tags:` (five semantics in one field) and `last_synced:` (two facts in one
date) — one key asked to answer two questions.

It also breaks derivation. `status` is the field a freshness mechanism would most want to
check against git activity, and it cannot: `gcgcca` is `paused` with a commit yesterday
because pause is *intent*, while `referenced` isn't a lifecycle claim at all.

`schema.yaml` declares all nine as observed so the linter stops reporting legitimate
values as errors. That is deliberate — declaring reality is S1's job. Splitting the key
is not.

## Repair

`needs-investigation`: the split is an operator call, not a mechanical one. Candidate
shape — keep `status` for lifecycle only, add `ownership: owned | referenced | tracking`,
and move `incoming` to the hardware pages' existing `acquired:`/`location:` pair. Fill the
7 empties in the same pass.

Do not repair before S3: the fleet registry may make entity `status` a rendered value
rather than an authored one, which would settle the question by removing the field.

## Closure

`claim_probe` exits 0 while more than 5 distinct status values are in use — so it closes
when the vocabulary is actually narrowed, not when the schema file is edited to describe
the sprawl.
