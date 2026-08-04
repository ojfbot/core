Reference for `/wayfinder`: the five core principles in full.

1. **Plan, don't do.** A wayfinder session either charts the map or works exactly one ticket. Resolving tickets during charting is the signature failure.
2. **The map is file-canonical; issues are the projection.** In full mode the map lives at `<core_root>/decisions/wayfinder/<slug>.md` — one library, so any surface can enumerate every open frontier in a single read; tickets are GitHub child issues with native blocking edges so the frontier renders in the tracker. Fix the map by editing the file (same posture as roadmap files vs compiled beads). In lite mode it lives at `<cwd>/decisions/wayfinder/<slug>.md` with no tracker projection (`knowledge/fleet-substrate.md`).
3. **Placement litmus** (`adr:wayfinder-decision-maps`): can you state `success` + a machine-runnable `check`? → it's a roadmap slice, not a ticket here. Can you state only the question precisely? → wayfinder ticket. Can't state the question yet? → `## Not yet specified` fog. Fog graduates to a ticket when the question — not the answer — becomes statable.
4. **Facts are gathered; decisions are the user's.** Charting may explore the repo freely, but every ticket's decision belongs to the user (grilling tickets are HITL by definition — an agent answering its own ticket has broken the loop).
5. **Refer by name.** Tickets are referenced by title in prose, never bare issue numbers.

Governing decision: `decisions/adr/0101-wayfinder-decision-maps.md` (adapted from mattpocock/skills v1.1, verdicts D11–D13).
