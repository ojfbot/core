# ADR-0107: Fleet-level out-of-scope knowledge base at decisions/out-of-scope/
slug: out-of-scope-knowledge-base
serial: 0107
domain: workflow-engine
type: convention
Date: 2026-08-11
Status: Accepted
Commands affected: /triage (reads + writes), /grill-with-docs, /plan-feature, /roadmap (read-aware)
Repos affected: all (via the decisions/ symlink)

---

## Context

When a feature request is rejected, the issue closes with a comment and the reasoning
evaporates. The next time the same idea arrives — months later, differently worded, in a
different repo — it gets re-litigated from scratch. The fleet has institutional memory for
*decisions taken* (ADRs) and *work shipped* (movement records, beads), but none for
*requests refused*.

Pocock's triage skill solves this with a per-repo `.out-of-scope/` directory (D44 in
`decisions/adopt-stack/pocock-triage-refresh.md`): one markdown file per rejected
**concept**, written as a short design document, checked during every triage pass and
matched by concept rather than keyword.

Adopting it per-repo would fragment rejection memory across 30+ repos (most with tiny
backlogs) and bypass the fleet's single-source-of-truth architecture, where `decisions/`
lives in core and is symlinked into every sibling. Adopting it as selfco wiki pages would
make `/triage` depend on `~/selfco` existing and move the record into LLM-owned prose
rather than a committed, diffable artifact.

## Decision

Create **`core/decisions/out-of-scope/`** — automatically visible in every repo through
the existing `decisions/` symlink; no installer change.

Rules (upstream's, kept; relocation is the only delta):

1. **One file per rejected concept, not per issue.** Kebab-case name recognizable from the
   directory listing (`dark-mode.md`, `plugin-system.md`). Multiple requests for the same
   thing accumulate in one file's Prior-requests list.
2. **Design-doc style, not database rows.** What was rejected, why it is out of scope
   (substantive: scope/philosophy, technical constraint, or strategic choice — never
   "too busy right now", which is a deferral, not a rejection), code samples where they
   make the reasoning concrete, and every request that has asked for it
   (`owner/repo#N` links).
3. **Fleet addition: a `repos:` line** in each file — which repo(s) the rejection applies
   to, or `fleet` for universal rejections.
4. **Only rejected *enhancements* enter.** A `wontfix` closed because the thing is
   *already implemented* must NOT be recorded here — that is a built feature, and filing
   it would poison the dedup check with false rejections. The closing comment points to
   where the feature lives instead. Rejected bugs get a polite closing comment, no file.
5. **Read wholesale before evaluating inbound requests; match by concept, not keyword**
   ("night theme" matches `dark-mode.md`). On a match, surface the prior decision and ask
   whether the maintainer still agrees — confirm (append + close), reconsider (delete or
   update the file, triage normally), or distinct (triage normally).
6. **Reconsideration deletes or updates the file; old issues stay closed** — they are
   historical records.

`/triage` is the primary writer (its `wontfix` route, D50) and reader (its
prior-rejection check, D47). Other skills that field ideas (`/grill-with-docs`,
`/plan-feature`, `/roadmap`) should treat a matching out-of-scope file the same way they
treat a contradicting ADR: surface it before proceeding.

The selfco vault MAY cite these files as sources on concept pages; the reference is
one-way and the committed KB remains the system of record.

## Consequences

- A rejection argued once stays argued. Re-requests get the recorded reason quoted back
  instead of a fresh debate — or a genuine reconsideration when the maintainer's view has
  changed.
- The directory doubles as a scope statement: browsing it tells a newcomer (or an agent)
  what this fleet has deliberately declined to become.
- Cost: discipline. The value depends on `/triage`'s wontfix route actually writing files
  and on rule 4 being respected; a polluted KB (built features recorded as rejections)
  is worse than none. The already-implemented exclusion is restated in the skill's
  knowledge file and in the directory README.
- Concept files may go stale if a rejection is silently reversed by shipping the feature
  anyway. Mitigation: the redundancy check (D47) runs *before* the prior-rejection check,
  so an implemented feature short-circuits to already-implemented and the contradiction
  surfaces as an anomaly.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Per-repo `.out-of-scope/` (upstream literal) | Fragments memory across 30+ repos; bypasses the decisions/ symlink architecture; most repos would hold zero or one file. |
| selfco wiki concept pages | Couples /triage to ~/selfco existing; vault is LLM-owned prose, not a committed diffable KB; vault may cite, not own. |
| ADRs for rejections | ADRs record architecture decisions with consequences; "we won't build dark mode" is scope memory, not architecture. Serial-numbered ADRs are also the wrong granularity for accumulating prior-request lists. |
| GitHub labels/comments only | The status quo this fixes — closed-issue archaeology doesn't compose across repos and gets worse as backlogs grow. |
