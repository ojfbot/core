---
type: defect-report
slug: selfco-skill-count-six-values
class: false-assertion
severity: low
status: open
disposition: repair-doc
location: "selfco:wiki/synthesis/skill-architecture-improvement-plan.md:30"
claim: "First audit pass — findings (core, 58 skills, 2026-06-18)"
actual: "67 skill directories. The vault states the fleet skill count as six mutually inconsistent values: 47, 52, 55, 56, 57, 58."
claim_probe: "grep -rqE '(47|52|55|56|57|58) skills' ~/selfco/wiki/synthesis/"
truth_probe: "ls -d ~/ojfbot/core/.claude/skills/*/ | wc -l | tr -d ' '"
filed: 2026-07-29
filed_by: "agent:claude-fable-5"
evidence: "session-2026-07-29-selfco-ontology-audit"
---

# The fleet skill count exists as six different numbers

Across six synthesis pages the vault asserts 47, 52, 55, 56, 57, and 58 skills. Disk says
**67**. The same pattern holds for repo count — **26** in eight places including
`index.md`, against **46** on disk — and for ADRs, where `entities/core.md` asserts both
"the 69-ADR decision record" (line 19) and "85 numbered ADRs" (line 52) on the same page,
against 93 numbered on disk.

## Why it matters

Low severity individually; diagnostic in aggregate. Every one of these is a
`ls | wc -l` away from truth, which makes them the cleanest possible demonstration of the
GENERATE quadrant: auto-derivable and addressable, therefore a generated block, not prose.

The distinction that matters for repair: a count in `log.md` ("created 7 concepts") is a
**historical event record** — permanently true, must never be refreshed. A count in a
synthesis page is a **standing assertion** and rots. They look identical to a linter.
Repair must not touch the ledger.

## Repair

Do not update the numbers — that re-arms the same defect with fresher values. Replace with
a reference to the generated fleet registry, or delete where the count is incidental to
the argument. Same treatment for the 26-repo and ADR-count claims.

## Closure

Broad probe: exits non-zero when no synthesis page states any of the six stale values. It
will false-positive if a page legitimately quotes a historical count in a dated context —
review before accepting the close.
