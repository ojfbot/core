# Audits & surveys (attic)

Dated, point-in-time audit and survey documents. They are **historical records** — read
them for the reasoning that was current on their date, not as a description of the repo
today. Nothing here is maintained after its date.

Moved out of the repo root on 2026-08-08 by core decomposition **S2**. Every file kept
its original name, so a citation like `MULTIAGENT-SDLC-AUDIT-2026-07-04.md:127` still
resolves — just under `docs/audits/`.

| Document | Date | What it is |
|---|---|---|
| [HARDENING-AUDIT-2026-03-30.md](HARDENING-AUDIT-2026-03-30.md) | 2026-03-30 | App-level security + resilience audit |
| [DEEPSTACK-ARCHITECTURE-EVALUATION-2026-06-13.md](DEEPSTACK-ARCHITECTURE-EVALUATION-2026-06-13.md) | 2026-06-13 | Evaluation of the DeepStack harness against ours |
| [OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md](OPAV-LOOP-GATED-SLICE-PLAN-2026-06-13.md) | 2026-06-13 | OPAV gated-slice program plan (the program's constitution) |
| [MULTIAGENT-SDLC-AUDIT-2026-07-04.md](MULTIAGENT-SDLC-AUDIT-2026-07-04.md) | 2026-07-04 | Audit cycle 2 — multi-agent SDLC. Source of finding **P9** |
| [AGENTIC-INTEGRATION-PLAN-2026-07-04.md](AGENTIC-INTEGRATION-PLAN-2026-07-04.md) | 2026-07-04 | Audit cycle 3 — agentic integration plan |
| [FLEET-COORDINATION-EXTENSIONS-2026-07-04.md](FLEET-COORDINATION-EXTENSIONS-2026-07-04.md) | 2026-07-04 | Audit cycle 3 — fleet coordination extensions |
| [DIA-CROSSCHECK-2026-07-08.md](DIA-CROSSCHECK-2026-07-08.md) | 2026-07-08 | Audit cycle 4 — external DIA survey reconciled, 4 verdicts |
| [LOOP-ENGINEERING-CROSSCHECK-2026-07-09.md](LOOP-ENGINEERING-CROSSCHECK-2026-07-09.md) | 2026-07-09 | Audit cycle 5 — loop engineering + Advisor tool, 5 verdicts |
| [SURVEY.md](SURVEY.md) | 2026-06-28 | Phase-1 evidence survey of core (ground truth for the decomposition) |

## Still-live references

Two `check:` expressions in `decisions/northstar/roadmap-l2-ojfbot.md` (slices S27 and
S28) still `test -f` these files at the old repo-root path. Both slices are already
`merged`, so the checks are post-hoc verification of delivered work rather than live
gates. They were deliberately **not** edited — `decisions/northstar/` is out of bounds
for a slice session under the movement contract. Retargeting them needs an operator pass.
