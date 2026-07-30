---
type: defect-report
slug: core-adr-dangling-traces
class: phantom-reference
severity: medium
status: open
disposition: needs-investigation
location: "core:decisions/adr"
claim: "traces: every value a slug that must resolve to a file on disk"
actual: "11 dangling trace values across 11 ADRs: 10x part-of-series: developer-day (no such ADR) + 1x relates-to: catalog-scoped-user-skills-and-availability-aware-suggestions"
claim_probe: "test $(cd ~/ojfbot/core && grep -h \"part-of-series: developer-day\" decisions/adr/*.md | wc -l | tr -d \" \") -gt 0"
truth_probe: "cd ~/ojfbot/core && echo \"developer-day refs=$(grep -lh \"part-of-series: developer-day\" decisions/adr/*.md | wc -l | tr -d \" \") file-exists=$(ls decisions/adr/*developer-day*.md 2>/dev/null | wc -l | tr -d \" \")\""
filed: 2026-07-30
filed_by: "agent:claude-opus-5"
evidence: "blocked /adr publish during ADR-0103..0105 accept, 2026-07-30"
---

# `/adr publish` is blocked by 11 dangling traces, all pre-existing

ADR-0087 states the rule plainly: `traces:` carries "every value a slug that **must resolve
to a file on disk**. `/adr publish` lints this; a dangling trace fails the lint — the
structural cure for phantom reservations."

Eleven values do not resolve:

- **`part-of-series: developer-day`** on ADRs 0056–0065 (ten of them). There is no
  `developer-day` ADR.
- **`relates-to: catalog-scoped-user-skills-and-availability-aware-suggestions`** on
  ADR-0096.

## Why it matters

`publish` halts before rebuilding `decisions/README.md`, so **the ADR index cannot be
regenerated at all** until this is resolved — including for newly accepted ADRs. It was hit
while accepting ADR-0103/0104/0105; those accepts are valid and complete, but the index
they belong in is stale and cannot be refreshed.

The `developer-day` cluster is probably not a mistake in the ordinary sense. Ten ADRs
consistently name a *series* that has no ADR of its own, which reads like deliberate
authoring intent — grouping a body of work under a label — colliding with 0087's rule that
every trace value resolve to a file. Either the rule is stricter than practice needs, or the
ten ADRs should point at a real umbrella ADR. That is an operator call, hence
`needs-investigation`.

## Repair

Three candidate paths, in rough order of preference:

1. **Write the missing umbrella ADR** (`developer-day`) and let the ten point at it. Matches
   how `selfco-ontology-program` works for ADR-0104/0105, and is the option that keeps
   0087's rule intact.
2. **Amend ADR-0087** to allow `part-of-series` to hold a free-text series label while
   `parent`/`supersedes`/`amends`/`relates-to` stay slug-resolving. Narrower rule, no new
   ADR — but it weakens the "every value resolves" invariant that makes the lint valuable.
3. **Drop the `part-of-series` values** from the ten. Cheapest, and loses real grouping
   information.

ADR-0096's dangling `relates-to` is separate and simpler: either the target was never
written or it was renamed. Resolve independently.

## Closure

`claim_probe` exits 0 while any ADR still carries `part-of-series: developer-day` with no
matching file. It deliberately tracks the ten-ADR cluster rather than the ADR-0096 case,
which is a different problem with a different repair; file that separately if it outlives
this one.
