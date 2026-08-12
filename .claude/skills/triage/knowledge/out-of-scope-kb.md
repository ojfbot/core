# Out-of-scope KB — prior-rejection and redundancy checks

Reference for the context-checks step and the `wontfix` route. Convention:
`adr:out-of-scope-knowledge-base` (ADR-0107); KB lives at `decisions/out-of-scope/`
(fleet-level, reachable in every repo via the decisions/ symlink). Absorbed D44/D47.

## Check (during context-gathering, before classifying)

Run both checks per issue; both are cheap and both produce `wontfix` when they hit.
Redundancy runs **first** — an implemented feature short-circuits before the KB is
consulted.

1. **Redundancy** — is the requested behavior already implemented? Search by **domain
   concept**, not the reporter's wording (ground terms in `CONTEXT.md`/`GLOSSARY.md`,
   fallback `domain-knowledge/`). Report where you looked. Hit → route `wontfix`
   (already-implemented).
2. **Prior rejection** — read `decisions/out-of-scope/*.md` (skip README) and match by
   **concept, not keyword**: "night theme" matches `dark-mode.md`. Hit → surface it:
   "similar to `decisions/out-of-scope/<file>` — rejected because <reason>. Still feel
   the same way?" The maintainer confirms (append + close), reconsiders (delete/update
   the file, triage normally), or calls it distinct (triage normally).

## Write (the `wontfix` three-way split)

| Why closing | What happens |
|---|---|
| **Already implemented** | Comment pointing at where it lives. **Never** write to the KB — a built feature recorded as a rejection poisons the dedup check. |
| **Rejected bug** | Polite explanation, close. No file. |
| **Rejected enhancement** | Write/update the KB file, link it from the closing comment, close. |

KB file format is in `decisions/out-of-scope/README.md` — one file per concept,
design-doc style, `repos:` applicability line, Prior-requests list. If a matching file
exists, append the new request to its list instead of creating a duplicate.
