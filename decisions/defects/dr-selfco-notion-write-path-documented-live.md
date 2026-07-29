---
type: defect-report
slug: selfco-notion-write-path-documented-live
class: dead-mechanism
severity: high
status: open
disposition: retire-mechanism
location: "selfco:CLAUDE.md:202"
claim: "the `selfco-box` daemon polls it every 5 min and files matching rows into this folder, commits, and pushes"
actual: "the box has been paused since 2026-06-11 (operator decision, cost blowup) and the transport was formally superseded by self-hosted LiveSync on 2026-06-16"
claim_probe: "grep -q 'polls it every 5 min' ~/selfco/CLAUDE.md"
truth_probe: "launchctl list 2>/dev/null | grep -c 'selfco' | tr -d ' '"
filed: 2026-07-29
filed_by: "agent:claude-fable-5"
evidence: "session-2026-07-29-selfco-ontology-audit (F-05); selfco:wiki/synthesis/selfco-livesync-transport.md:9-11; selfco:wiki/log.md:1214"
---

# Six documents describe a write path that died 48 days ago

The vault records its own supersession twice —
`wiki/synthesis/selfco-livesync-transport.md:9-11`: *"Decided 2026-06-16: self-hosted
LiveSync — CouchDB on the Pi is the live authority… Notion and the always-on LLM are
gone"*, and `wiki/log.md:1214`: *"box paused by operator decision since 2026-06-11 …
44 rows accumulated 06-17→06-28 with no consumer"*.

Six surfaces still assert it as live: `selfco/CLAUDE.md:202,205,209`;
`core/.claude/skills/vault/consumer/SKILL.md:35-38,106`;
`core/.claude/skills/selfco-ingest/SKILL.md` (×3, including "watch for `status=promoted`"
— a transition that has not occurred since 2026-06-11);
`core/domain-knowledge/selfco-vault.md:75`. Corroborating evidence for LiveSync as the
real transport: `~/selfco/.obsidian/plugins/` contains `obsidian-livesync`, and
`log.md:1219` documents a LiveSync-specific failure mode.

## Why it matters

**The vault's analysis layer is 43 days ahead of its infrastructure layer, and nothing
reads across the boundary.** `/selfco-ingest` is the worst case: an entire skill whose only
deliverable is a Notion row that nothing consumes — an agent following it today produces
work that silently goes nowhere and then tells the operator it was filed.

One paused process froze four derived surfaces simultaneously (`_lint-report.md`,
`_hot.md`, `_suggested-links.md`'s "daily cultivate" cadence, and the experience-plane run
renderer) with zero alerts. That cascade is the argument for `dr-selfco-loops-unregistered`.

## Repair

`disposition: retire-mechanism` — not repair. The decision to move to LiveSync was made
and is recorded; the documentation simply never followed. Update all six surfaces to
describe LiveSync as the transport and mark the Notion path retired-2026-06-16, or
re-activate the box if the operator's intent has changed. **Do not** update the docs to
describe LiveSync as live without first confirming it is — that would refile this defect
under a new transport.

Blocked on an operator decision about `/selfco-ingest`'s future: retire the skill, or
repoint it at the live transport.

## Closure

`claim_probe` exits non-zero when `CLAUDE.md` no longer claims the 5-minute poll. Note
this probes the *primary* surface only; the other five are listed above and should be
repaired in the same pass — a follow-up sweep of those strings is warranted before closing.
