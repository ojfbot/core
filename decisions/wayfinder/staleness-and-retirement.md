---
type: wayfinder-map
slug: staleness-and-retirement
northstar: l3-shared
tracker_issue: "#732"
status: working
---

# Wayfinder — staleness and retirement

## Destination

For every surface an agent reads at start or retrieves on demand, three things are ruled:
what signal marks an item stale, who may retire or refresh it, and what that costs. The
surfaces are rules files, hooks, skills, loops, memory files, beads and vault wiki pages.
The map hands off when each surface has all three rulings or has been ruled out of scope.

It serves `ns:l3-shared#P2` (work is legible and self-measuring). An agent that acts on a
stale instruction or an outdated claim reports state that is not true.

The owner fixed this Destination on 2026-11-24, choosing retirement rulings over a broad
survey of the problem.

## Notes

**Why this map exists.** Several public talks on running agent factories report the same
failure: standing instructions and records pile up until agents can no longer work. A check of
this fleet on 2026-11-24 found designs that detect staleness on three surfaces and nothing,
on any surface, that retires an item.

**Prior decisions found on `main` (2026-11-24).** The search covered `decisions/adr` and
`decisions/wayfinder` by keyword, so it can have missed some.

| Surface | Prior decision | State |
|---|---|---|
| Vault wiki | [adr:vault-page-lifecycle-policy](../adr/0079-vault-page-lifecycle-policy.md), [adr:vault-staleness-scanner](../adr/0080-vault-staleness-scanner.md) | Both Proposed. The scanner is built (`lint.py --stale`). It reports and never removes. |
| Skills | [draft-repo-scoped-skill-relevance](../adr/draft-repo-scoped-skill-relevance.md) | Draft |
| Loops | Census, overlap and retirement tickets in the `control-plane-conductor` map | Open |
| Rules files, hooks, memory files, beads | None found | — |

**Facts gathered at charting (vantage: Yuri Mac, 2026-11-24).**
- The vault scanner's test is: no independent inbound links, no tracked edit in 90 days, no
  later log mention. That finds pages nothing uses. It does not find claims that are no
  longer true. The scanner ADR defers the currency of source pages to a later decision.
- The vault holds 1,011 wiki pages. 50 carry an inline stamp in the schema's form,
  `(as of YYYY-MM`; 96 carry "as of" with a date in any form. 3 carry `superseded_by`, and
  3 carry a scanner exemption.
- Two facts were not checked at charting. The census answered both: on this Mac the
  vault is not a Git repository, so the scanner's 90-day test can flag no page; and no
  live process reads the scanner's report.

**Kinds of staleness.** Ruled on 2026-11-24: four kinds, each a condition bound to one
signal. They are *unused*, *broken*, *untrue* and *superseded*. The ruling, the signal per
surface and what it does not detect are in
[adr:staleness-kinds-and-signals](../adr/draft-staleness-kinds-and-signals.md) (draft). The
terms are in `domain-knowledge/GLOSSARY.md`.

**What the kinds ruling changes for open tickets.**
- "What marks a wiki claim untrue, as distinct from a page unused?" and "What happens to a
  retired item?" are no longer blocked.
- "Who may retire or refresh an item on each surface?" is still blocked by "How do the prior
  staleness decisions relate to this map?". It now rules per kind: who may flag an item
  untrue, mark it superseded, repair a broken reference, or retire an unused item.
- "What happens to a retired item?" inherits the largest gap. Rules files, hooks, skills and
  loops have no convention for a reader's flag or for a successor mark, so *untrue* and
  *superseded* have no signal there until one exists.
- "What marks a wiki claim untrue, as distinct from a page unused?" now asks what the
  reader's flag is on the wiki. Dated claims are not a signal for any kind in the ruling,
  and that ticket may still use them.
- "Is there a budget on what every session loads, and what happens past it?" carries the
  pile-up problem alone. *Unused* never marks an item that loads in every session.
- "Would the owner accept what a pruning pass proposes?" has two computable inputs on rules
  files today: broken references, and files no session loaded.
- No ticket is invalidated.

**Load records found after the census (2026-11-24).** The census reported that use could
not be measured for rules files, hooks or memory files. That holds for reliance on a single
item. Loading is recorded: the Claude Code tool ledger stamps repo and working directory on
every tool call, Codex session files store the merged instruction text and its directory,
and session transcripts keep run records for some hooks. The census counted hooks and skills
on the Claude Code side only.

**What the research found that the open tickets must weigh.** Three research tickets
closed on 2026-11-24. Their files are indexed under "Decisions so far". Nothing below is a
decision.
- Nothing, here or in published practice, detects a claim that is untrue in general.
  Published systems detect narrower things: a newer item contradicts an older one, a source
  changed or vanished, a cited link died, or nobody has vouched for the item within a
  period.
- "Unused" cannot be measured here for rules files, hooks or memory files, because no
  ledger records their use. Two ledgers that did exist stopped being written. Published
  practice has six signals that need no usage ledger: size, content checks, contradiction
  at read time, contradiction at write time, replay against transcripts, and a mistake a
  person notices.
- Only agent memory is removed without a person in published practice. For rules files
  and skills a tool proposes and a person removes. Demoting an item, so that it stays
  installed but stops loading in full, is more common than removing it.
- Knowledge stores mostly keep a superseded item and mark or rank it. They delete only
  items derived from a source that changed. No source measures one choice against another.
- Measured harm exists on both sides. In one benchmark, outdated documents retrieved
  alongside current ones cut accuracy by at least 20%, with dates shown and recency
  ranking on. In another, the best of 20 models followed 68% of 500 simultaneous
  instructions. Both are benchmarks, not agent work.
- Published practice is silent on: retiring hooks; an approval path specific to removal;
  what becomes of a retired rule or skill; a source that stays in an append-only layer but
  has aged; finding and refreshing summary pages built on a superseded source; and
  anything measured about wikis that a model maintains.

**Four defects found so far.** They are deliveries, not decisions, so they are not
tickets on this map. They are recorded here so that they reach their owners.
- The vault scanner returns "not stale" for every page when the vault has no Git history
  (owner: the scanner ADR).
- The loops registry lists `selfco-vault-hygiene` as `live` while its automation file
  says `PAUSED` (owner: the `control-plane-conductor` map).
- Six `.Codex/...` paths named in `AGENTS.md` files resolve to nothing, even ignoring
  letter case, and `install-agents.sh` has no Codex handling (owner: not assigned).
- `log-skill.sh` is wired per repo. Work moved to directories where it is not wired, and
  `skill-telemetry.jsonl` has not been written since 2026-10-20 (owner: not assigned).

**Constraints.**
- Instruction files are high risk under the guided-review ruling (slice CH-5a, #715), so
  removing a rule passes the same gate as adding one. A proposal that changes a ruled
  decision of the `agent-trust-and-factory-evaluation` map goes to that map's discovery log
  (#687), not into this map.
- Yojimbo owns the vault pipeline. The Yuri Mac reviews read-only. `raw/` stays append-only.
- Research tickets run one at a time.

**Vault reference layer.** `synthesis/` and `concepts/` were searched by keyword on
2026-11-24. No page on this subject was found.

**Tracker.** The umbrella issue is #732. Each ticket is a sub-issue of it with native
blocked-by links. The three research tickets were closed before the issues were created,
so their issues were opened and closed on the same day.

## Decisions so far

- **What is stale here today, and is any staleness report acted on?** (#733) Closed 2026-11-24. On this Mac the vault scanner flags 0 of 1,011 pages and cannot see edits (`~/selfco` has no `.git`); no live process reads its report (the hygiene heartbeat is paused). Skills: 66 of 77 unused in 90 days. Rules files, hooks and memory have no usage ledger. See [staleness-census-2026-11-24](../research/staleness-census-2026-11-24.md).
- **How do other teams retire standing agent instructions?** (#734) Closed 2026-11-24. Only agent memory has published removal mechanisms that act without a person (expiry unless re-validated, citation checks, model deletes, background consolidation). For rules files and skills, a model or tool proposes and a person removes; hooks have nothing beyond a slowness report. Six signals work without a usage ledger. No study measures pruning a rules file. See [retiring-agent-instructions-2026-11-24](../research/retiring-agent-instructions-2026-11-24.md).
- **How do other teams keep a retrieval knowledge store true over time?** (#735) Closed 2026-11-24. Published systems mostly detect *superseded* (a newer item contradicts an older one) or a moved source, not *untrue*; old items are usually kept and marked or ranked (Zep, Wikidata), and deleted only when derived from a changed source (LangChain). Outdated documents cut RAG accuracy by at least 20% even with dates in the prompt (HoH). No study covers LLM-maintained wikis, and nothing handles a kept source that has aged. See [keeping-a-knowledge-store-true-2026-11-24](../research/keeping-a-knowledge-store-true-2026-11-24.md).
- **What kinds of staleness are there, and what signal marks each?** (#737) Closed 2026-11-24. Four kinds, each a condition bound to one signal: *unused* (no load record in 90 days in either harness), *broken* (a named path, script or command does not resolve), *untrue* (a reader's flag) and *superseded* (a successor mark). Where a signal cannot be computed the record says "no signal": nothing marks an item that loads in every session, an unflagged false claim, or an unmarked replacement. → [adr:staleness-kinds-and-signals](../adr/draft-staleness-kinds-and-signals.md) (draft).

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|---|---|---|---|
| What is stale here today, and is any staleness report acted on? (#733) | research | — | closed |
| How do other teams retire standing agent instructions? (#734) | research | What is stale here today, and is any staleness report acted on? | closed |
| How do other teams keep a retrieval knowledge store true over time? (#735) | research | What is stale here today, and is any staleness report acted on? | closed |
| How do the prior staleness decisions relate to this map? (#736) | grilling | What is stale here today, and is any staleness report acted on? | open |
| What kinds of staleness are there, and what signal marks each? (#737) | grilling | All three research tickets | closed |
| What marks a wiki claim untrue, as distinct from a page unused? (#738) | grilling | How do other teams keep a retrieval knowledge store true over time?; What kinds of staleness are there, and what signal marks each? | open |
| When a source is superseded, how are the pages built on it found and refreshed? (#739) | grilling | What marks a wiki claim untrue, as distinct from a page unused? | open |
| Is there a budget on what every session loads, and what happens past it? (#740) | grilling | What is stale here today, and is any staleness report acted on?; How do other teams retire standing agent instructions? | open |
| Who may retire or refresh an item on each surface? (#741) | grilling | How do the prior staleness decisions relate to this map?; What kinds of staleness are there, and what signal marks each? | open |
| What happens to a retired item? (#742) | grilling | What kinds of staleness are there, and what signal marks each? | open |
| What does retiring an instruction cost under the high-risk review rule? (#743) | grilling | Who may retire or refresh an item on each surface? | open |
| Would the owner accept what a pruning pass proposes? (#744) | prototype | Who may retire or refresh an item on each surface?; What happens to a retired item? | open |
| Should each session record what it loaded, across both harnesses, and in what shape? (#746) | grilling | — | open |

**What each ticket asks.**

- **What is stale here today, and is any staleness report acted on?** A census of this
  fleet, per surface: how many items, how many are unused, untrue or superseded, with
  denominators, the commands used and the vantage. It also answers the two unchecked facts
  above. For loops it reads the `control-plane-conductor` census if one exists and does not
  repeat it. It fixes nothing.
- **How do other teams retire standing agent instructions?** Outside practice for rules
  files, hooks, skills and agent memory. The question is how an item gets removed and who
  decides, not only how staleness is detected. Each finding is marked measured or asserted.
- **How do other teams keep a retrieval knowledge store true over time?** Outside practice
  for retrieval stores and LLM-maintained wikis: dating claims, superseding sources,
  re-verifying, and removing. Same marking of measured against asserted.
- **How do the prior staleness decisions relate to this map?** For each prior decision in
  the table above: does this map adopt it, propose an amendment to its owner, or leave it
  alone? This includes whether loops stay wholly with `control-plane-conductor`, and
  where the two defects in the Notes go.
- **What kinds of staleness are there, and what signal marks each?** Tests the three
  working terms against the census and the outside practice, and names one signal per kind
  per surface. It must say what to do where no usage ledger exists, and whether "untrue"
  is narrowed to what can be detected.
- **What marks a wiki claim untrue, as distinct from a page unused?** The decision the
  scanner ADR deferred. It covers a source in `raw/` that stays, because the layer is
  append-only, but has aged. The research found no published answer for that case.
- **When a source is superseded, how are the pages built on it found and refreshed?**
  Added on 2026-11-24 from the knowledge-store research, which found no published
  practice. It asks how a synthesis, concept or entity page learns that one of its
  sources was replaced, and who refreshes it.
- **Is there a budget on what every session loads, and what happens past it?** Whether the
  always-loaded surface has a ceiling, in what unit, and who signs off past it.
- **Who may retire or refresh an item on each surface?** Who proposes, who approves and
  which host acts, per surface.
- **What happens to a retired item?** Deleted, archived or marked, and how it comes back.
- **What does retiring an instruction cost under the high-risk review rule?** Whether
  removal keeps the full high-risk gate. This touches a ruled decision, so its outcome is a
  proposal to #687.
- **Would the owner accept what a pruning pass proposes?** One run on one surface: a pass
  proposes removals as a diff, and the owner marks each accept or reject.
- **Should each session record what it loaded, across both harnesses, and in what shape?**
  Added on 2026-11-24 by the owner's ruling, from the kinds ticket. The *unused* signal
  rests on a proxy for Claude Code and on session files nothing reads for Codex. Both
  harnesses document a finer record (a hook event per instruction file loaded in Claude
  Code; OpenTelemetry export in both), and neither is switched on. The ticket asks whether
  to record loads, in which shape (the existing JSONL ledgers, or traces a tracing tool can
  ingest), and how that sits with `adr:harness-loop-instrumentation`, which rejects a second
  ledger. A record of loads cannot show reliance on an item that is in every session.
  Evidence gathered on 2026-11-24 is held outside the repo and needs a privacy pass before
  it is filed under `decisions/research/`.

## Not yet specified

- How an agent should treat an item that is marked stale but not yet retired. The question
  depends on what the marks turn out to be.
- How to tell whether retirement helped: which measure would show fewer wrong actions.
- Copies that fall behind their source, such as a checkout many commits behind `main` or a
  host copy of a config. It is unclear whether that is this map's "untrue" or a separate
  problem of synchronisation. The kinds ruling did not settle it. One more instance: the
  `AGENTS.md` files read as rewrites of `CLAUDE.md` files and name paths that do not exist.
- Whether an item in a dormant repo is *unused* or only paused. The "not loaded" signal
  marks both the same way: 26 of 51 repo rules files were loaded by neither harness in 90
  days, mostly because their repos are idle.
- Codex-side and plugin items. The census counted hooks and skills for Claude Code only.
  Codex has its own hook entries, skills, memory store and automations, and plugins add
  hooks in both harnesses. It is not yet stated whether these are items on the existing
  surfaces or need their own census.
- Instructions held in chat clients (project instructions generated from a contract).

## Out of scope

Nothing ruled yet.
