Reference for `/wayfinder` charting Step 3: the four ticket types and how each is resolved.

- `research` (AFK) — resolved via the **deep-research harness, ONE cycle at a time** (sequential-research rule; a charting session that fans research out in parallel is a bug, not a speedup); findings filed to `decisions/research/`, never throwaway branches.
- `grilling` (HITL, the default) — resolved via `/grill-with-docs`; its in-loop ADR stubs give `## Decisions so far` real `decisions/adr/` entries to index.
- `prototype` (HITL) — resolved via `/prototype`; artifact linked from the ticket (disposition per `/prototype`, incl. the kept-branch primary-source option).
- `task` (either) — manual unblocking work: provisioning, access, data moves.
