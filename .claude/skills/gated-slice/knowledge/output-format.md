# Output format

Reference for `/gated-slice` Step 6, moved verbatim from SKILL.md: the exact plan output template.

```
## /gated-slice — <effort>

Restatement: <one sentence>   ·   Warrants Control-Gated Slices: <yes/no + why>

### Slices (vertical, ordered by value-first)
| # | Slice | Layers traversed | Observable value shipped |
|---|-------|------------------|--------------------------|
| 1 | ...   | ...              | ...                      |

### Slice <N>: <name> — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0   | ...               | MOE: ... → MOP: ... → TPM: <metric> vs <baseline>, pass if <threshold> | Verif/Valid |

Enforcement control(s): <name> — **requires Brassboard/shadow stage at <gate>** (observe-only, emits <TPMs>, no action).
RIDM promotion: shadow → operational at <gate> is gated on <TPMs> clearing <thresholds>; on breach → stay shadow / roll back.

Harness extensions flagged: vertical slice (≈ life-cycle phase/WBS); shadow mode (≈ Brassboard + TRL).
Next: hand Slice 1 to /plan-feature → /tdd; revisit gates as TPM data arrives.
```
