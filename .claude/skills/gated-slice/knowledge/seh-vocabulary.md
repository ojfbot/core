# SEH vocabulary — the full SEH ↔ harness term mapping

Reference for `/gated-slice`, moved verbatim from SKILL.md: the NASA SEH nomenclature table and where the full definitions live.

| Concept | Term to use | Source | Note |
|---|---|---|---|
| Checkpoint with entry + exit | **Control Gate** / **Key Decision Point (KDP)** | NASA SEH | — |
| Minimum to *start* a gate | **Entrance Criteria** | NASA SEH | — |
| What must be *demonstrated to pass* | **Success Criteria** | NASA SEH | formerly "exit criteria" — use the current term |
| Qualitative stakeholder goal | **Measure of Effectiveness (MOE)** | NASA SEH | not a design-to number |
| Quantitative measure ensuring the MOE | **Measure of Performance (MOP)** | NASA SEH | 2+ per MOE typical |
| MOP tracked vs a baseline; deviation → corrective action | **Technical Performance Measure (TPM)** | NASA SEH | **our "metrics" ARE TPMs serving MOEs** |
| Observe-only / simulated stage before enforcing | **Brassboard / shadow stage** | Brassboard + TRL (SEH); **"shadow mode" is a harness extension** | runs, emits TPMs, takes NO action |
| Actually enforcing | **Operational** | — | promoted-to state |
| Data-gated promotion decision | **RIDM** (Risk-Informed Decision Making) | NASA SEH | promote on TPM thresholds, not a hunch |
| "Did I build it right?" (meets spec) | **Verification** | NASA SEH | proof of compliance with specification |
| "Am I building the right thing?" (meets intent) | **Validation** | NASA SEH | proof it accomplishes the intended purpose |
| Thin end-to-end shippable unit | **Vertical Slice** | **harness extension** (closest SEH: life-cycle phase / Product Baseline / WBS) | flag the gap |

The full definitions are in `domain-knowledge/GLOSSARY.md` and `knowledge/seh-mapping.md`.
