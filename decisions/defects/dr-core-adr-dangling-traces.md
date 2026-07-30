---
type: defect-report
slug: core-adr-dangling-traces
class: phantom-reference
severity: medium
status: open
disposition: repair-doc
location: "core:decisions/adr"
claim: "traces: every value a slug that must resolve to a file on disk"
actual: "11 dangling trace values across 11 ADRs: 10x part-of-series: developer-day (no such ADR) + 1x relates-to: catalog-scoped-user-skills-and-availability-aware-suggestions"
claim_probe: "grep -q 'part-of-series: developer-day' decisions/adr/*.md"
truth_probe: "echo refs=$(grep -l 'part-of-series: developer-day$' decisions/adr/*.md | wc -l) exact-slug-exists=$(grep -lx 'slug: developer-day' decisions/adr/*.md | wc -l)"
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
ten ADRs should point at a real umbrella ADR. **See the corrected diagnosis below — the
umbrella exists and the references are simply truncated.**

## Repair

> **Diagnosis corrected 2026-07-30, and it is much simpler than first filed.** The umbrella
> ADR **exists**: `0056-developer-day-orchestration-master.md`, slug
> `developer-day-orchestration-master`. The ten ADRs point at **`developer-day`** — a
> *truncation* of that slug, not a reference to something missing. The first filing proposed
> writing a new ADR, amending 0087, or dropping the values; none was right, because nothing
> is missing and no rule needs weakening.
>
> The first `truth_probe` hid this by globbing `*developer-day*.md`, which matches the
> umbrella's filename by substring and reported `umbrella-adr=1` — technically true, and
> misleading. Now it tests for the exact slug.

**Mechanical, one token per file:** on ADRs 0056–0065, change
`part-of-series: developer-day` to `part-of-series: developer-day-orchestration-master`.
Ten files, no judgment required. Then `/adr publish` unblocks.

ADR-0096's dangling `relates-to:
catalog-scoped-user-skills-and-availability-aware-suggestions` is separate — a target that
was never written or was renamed — and needs its own look.

## Closure

`claim_probe` exits 0 while any ADR still carries `part-of-series: developer-day` with no
matching file. It deliberately tracks the ten-ADR cluster rather than the ADR-0096 case,
which is a different problem with a different repair; file that separately if it outlives
this one.
