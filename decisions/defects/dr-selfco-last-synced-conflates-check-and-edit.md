---
type: defect-report
slug: selfco-last-synced-conflates-check-and-edit
class: schema-drift
severity: high
status: open
disposition: repair-mechanism
location: "selfco:CLAUDE.md:75"
claim: "last_synced: YYYY-MM-DD"
actual: "The key conflates 'when an agent last looked' with 'when this page was last correct'. 18 of 59 pages were hand-edited after their last_synced without bumping it; 12 of 40 repos have commits newer than theirs."
claim_probe: "test $(grep -rl '^last_verified:' ~/selfco/wiki/entities/ 2>/dev/null | wc -l | tr -d ' ') -eq 0"
truth_probe: "echo \"last_synced=$(grep -rl '^last_synced:' ~/selfco/wiki/entities/ | wc -l | tr -d ' ') last_verified=$(grep -rl '^last_verified:' ~/selfco/wiki/entities/ 2>/dev/null | wc -l | tr -d ' ')\""
filed: 2026-07-29
filed_by: "agent:claude-fable-5"
evidence: "session-2026-07-29-selfco-ontology-audit"
---

# `last_synced:` is an anti-signal, not a freshness signal

The field records **when the agent last looked**, not whether what it wrote is still true.
So a stale fact under a fresh timestamp reads as *more* trustworthy, not less — which is
the worst possible property for a freshness key.

Two independent failure modes measured:

- **12 of 40** repo entities have commits newer than their `last_synced` (worst: `gcgcca`
  +78d, `virtualLight` +73d, `shell` +63d; 194 unrecorded commits total).
- **18 of 59** pages have an mtime *later* than their own `last_synced` — hand-edited
  without bumping. `entities/core.md` carries a section headed "Harness loop
  instrumentation, 2026-07-29" under `last_synced: 2026-07-04`.

## Why it matters

Any re-derivation scheduler needs a trustworthy "when was this last checked against
reality" key, and this one cannot serve. It is the blocking dependency for the freshness
mechanism: without it, a sweep cannot distinguish *changed* from *not re-examined*.

## Repair

Split the concept:

- **`last_verified`** — when a claim was last checked against ground truth, written **only**
  by the verifying mechanism, never by hand.
- **`verified_against`** — the ref it was checked against (repo HEAD SHA, a run id). This is
  what makes "has anything changed since?" answerable without re-deriving everything.
- `last_synced` retires, or narrows to "when /vault sync last touched this page".

Schema change: `selfco/CLAUDE.md` and the canonical template
`core/.claude/skills/vault/templates/vault-claude-md.md` must both be updated (ADR-0088 —
they drift independently and already have).

## Closure

`claim_probe` is inverted: it exits 0 (defect present) while **no page carries
`last_verified`**, and non-zero once at least one does.

> **Probe revised 2026-07-30 (S1).** It originally grepped `~/selfco/CLAUDE.md` for the
> key's *declaration*. Two problems. First, S1 moved the schema to `schema.yaml`, so the
> probe was aimed at a file that no longer owns the fact — it would have gone on reporting
> `still-broken` forever regardless of any repair. Second, and worse, declaring a key is
> not fixing the problem: `last_verified` **is** now declared in `schema.yaml`, and the
> old probe would have flipped to `claim-gone` on that alone, closing a defect where not a
> single page had gained a trustworthy freshness stamp.
>
> A probe that closes on a declaration rather than on a change in the world is the
> ledger's own version of the disease it tracks. Probes get maintained when the thing they
> point at moves; that maintenance is recorded, not silent.
