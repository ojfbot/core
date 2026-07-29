---
type: defect-report
slug: selfco-adr-0071-0072-phantom
class: phantom-reference
severity: medium
status: open
disposition: repair-doc
location: "selfco:CLAUDE.md:209"
claim: "See core/.claude/skills/vault/knowledge/connectors.md + ADR-0070/0071/0072/0073."
actual: "ADR-0071 and ADR-0072 do not exist. Numbering gaps confirm they were never accepted: 0070 then 0073."
claim_probe: "grep -q 'ADR-0070/0071/0072/0073' ~/selfco/CLAUDE.md"
truth_probe: "ls ~/ojfbot/core/decisions/adr/ | grep -cE '^007[12]-' || true"
filed: 2026-07-29
filed_by: "agent:claude-fable-5"
evidence: "session-2026-07-29-selfco-ontology-audit (F-01)"
---

# The schema cites two ADRs that were never accepted

`selfco/CLAUDE.md` cites ADR-0070/0071/0072/0073 twice, and `wiki/index.md:47` attributes
the selfco-box to "ADR-0071". Only 0070 and 0073 exist. The gaps in the sequence
(`0070 → 0073`) confirm these numbers were referenced before assignment and never landed.

## Why it matters

This is the exact failure ADR-0087 (`stable-identity-and-facet-tags`) was written to
prevent: serials are display-only and assigned at accept, so a pre-assigned number is a
dangling pointer. The vault has not adopted that decision — it carries **669 numeric
`ADR-NNNN` references against 3 `adr:<slug>` references**, and 27 of those numeric refs
point at six numbers with no file (0074, 0071, 0075, 0092, 0031, 0072).

Fixing these two citations treats a symptom. The class fix is migrating vault ADR
references to slug form, which is a prerequisite for the change-impact index — impact
routing built on unstable identifiers silently misses rather than loudly failing.

## Repair

Replace the two citations with the ADRs that actually cover the material
(`adr:selfco-vault-and-skill`, `adr:vault-multi-surface-access`,
`adr:selfco-ingest-removes-draft-gate`) in slug form. Fix `index.md:47` in the same pass.

## Closure

`claim_probe` exits non-zero once the `ADR-0070/0071/0072/0073` string is gone.
