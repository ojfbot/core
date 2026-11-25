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
failure: standing instructions and records pile up until agents can no longer work. A check on
2026-11-24, of `main` and of one host, found designs that detect staleness on three surfaces
and nothing, on any surface it could see, that retires an item.

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
- Two facts were not checked at charting. On the Yuri Mac (2026-11-24, re-run 2026-11-25)
  the vault folder is not a Git repository, so the scanner's 90-day test can flag no page
  there. A private Git remote of the vault exists, with history to 2026-10-29. On the Yuri
  Mac no live process reads the scanner's report: launchd, cron, Codex automations and
  Claude scheduled tasks were checked. On Yojimbo (2026-11-25) no host scheduler names the
  report either: launchd, cron, its one Codex automation and its Claude scheduled tasks
  were checked, and FleetRunner's live job table was not. The vault on Yojimbo was not
  checked: the owner left it out on 2026-11-25, to be handled separately.

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
- "Would the owner accept what a pruning pass proposes?" has two inputs on rules files that
  compute on the Yuri Mac today: broken references, and files with no load record there,
  each file credited only to the harness that reads it.
- No ticket is invalidated.

**What the second vantage changes (2026-11-25).** The findings are in
[second-vantage-2026-11-25](../research/second-vantage-2026-11-25.md); its section 4 names
the open ticket each difference matters to. Nothing below is a decision.
- Five headline counts from the census were one-harness or one-path counts. Each is
  restated under "Decisions so far" with its vantage.
- Yojimbo keeps no usage ledger (2026-11-25). Every count read from a ledger is a Yuri Mac
  count with no second-host value. A load record has to be installed on each host, not only
  defined.
- Codex session files cover 68 of the 90 days on the Yuri Mac and 29 on Yojimbo. A run
  started in an ephemeral mode leaves no file on either.
- What a session loads at start differs by host as well as by harness: the user-scope
  rules file is 7,178 bytes on the Yuri Mac and 3,899 on Yojimbo, and Codex has a global
  file on the first and none on the second.
- The two hosts hold different sets: 51 repo rules files and 133 beads on the Yuri Mac, 46
  and 145 on Yojimbo. A retirement pass run on one host sees a different set from the
  other.
- **The *unused* signal was amended on 2026-11-25.** As first ruled it read "no load
  record in 90 days in either harness". A host that keeps no record and a host where the
  item never loaded gave the same answer under that wording. The owner ruled: *unused* is
  counted per host and per harness, only where a load record was kept; each result names
  the pairs it rests on and the days each record covers; a record that covers fewer than
  90 days counts, with its days stated; and where no record was kept the pair reads "no
  signal", never *unused*. On that day three pairs keep a record: Claude Code on the Yuri
  Mac (90 days), Codex on the Yuri Mac (68) and Codex on Yojimbo (29). Claude Code on
  Yojimbo keeps none.
- "Would the owner accept what a pruning pass proposes?" must weigh how little cover is
  enough to act on. 29 days without a load says little about an item used once a quarter.

**Load records found after the census (2026-11-24).** The census reported that use could
not be measured for rules files, hooks or memory files. That holds for reliance on a single
item. Loading is recorded: the Claude Code tool ledger stamps repo and working directory on
every tool call; Codex session files store the merged instruction text and its directory
(on the Yuri Mac 592 of 2,967 files store none, and 263 are imported Claude Code
transcripts; on Yojimbo there are 802 files from 2026-10-26, none imported; a run started
in an ephemeral mode leaves no file); and session transcripts keep run records for some
hooks. The census counted hooks and skills on the Claude Code side only. With plugin and
Codex entries the Yuri Mac has 158 hook entries, not 122; Yojimbo has 68.

**What the research found that the open tickets must weigh.** Three research tickets
closed on 2026-11-24. Their files are indexed under "Decisions so far". Nothing below is a
decision.
- Nothing found on `main`, on the Yuri Mac or in the 29 pages read detects a claim that is
  untrue in general.
  Published systems detect narrower things: a newer item contradicts an older one, a source
  changed or vanished, a cited link died, or nobody has vouched for the item within a
  period.
- On the Yuri Mac, reliance on a rules file, hook or memory file cannot be measured,
  because no ledger records it. Three ledger files there have stopped being written (last
  rows 2026-08-19, 2026-10-10 and 2026-10-20), and wiki reads left the `Read` record on
  2026-08-19 for the shell. On Yojimbo (2026-11-25) no ledger file exists. Published
  practice has six signals that need no usage ledger: size, content checks, contradiction
  at read time, contradiction at write time, replay against transcripts, and a mistake a
  person notices.
- In the pages read, only agent memory is removed without a person. For rules files
  and skills a tool proposes and a person removes. Demoting an item, so that it stays
  installed but stops loading in full, is more common than removing it.
- Knowledge stores mostly keep a superseded item and mark or rank it. They delete only
  items derived from a source that changed. No source measures one choice against another.
- Measured harm exists on both sides. In one benchmark, outdated documents retrieved
  alongside current ones cut accuracy by at least 20%, with dates shown and recency
  ranking on. In another, the best of 20 models followed 68% of 500 simultaneous
  instructions. Both are benchmarks, not agent work.
- The 29 pages read say nothing on: retiring hooks; an approval path specific to removal;
  what becomes of a retired rule or skill; a source that stays in an append-only layer but
  has aged; finding and refreshing summary pages built on a superseded source; and
  anything measured about wikis that a model maintains.

**Four defects found so far.** They are deliveries, not decisions, so they are not
tickets on this map. They are recorded here so that they reach their owners.
- The vault scanner returns "not stale" for every page when the vault has no Git history
  (owner: the scanner ADR).
- The loops registry lists `selfco-vault-hygiene` as `live` while its automation file on
  the Yuri Mac says `PAUSED`, and no automation of that name exists on Yojimbo
  (2026-11-25). The registry row names no host. FleetRunner's live job table was not read
  (owner: the `control-plane-conductor` map).
- On the Yuri Mac, six `.Codex/...` paths named in `AGENTS.md` files resolve to nothing,
  even ignoring letter case. Five of the six files that hold such a path are untracked or
  outside any repo, so they exist only there. The sixth is tracked; whether its path
  resolves on Yojimbo was not measured. `install-agents.sh` on `main` has no Codex handling
  (owner: not assigned).
- `log-skill.sh` is wired per repo. Work moved to directories where it is not wired, and on
  the Yuri Mac `skill-telemetry.jsonl` has not been written since 2026-10-20; on Yojimbo
  the file does not exist (2026-11-25) (owner: not assigned).

**Constraints.**
- Instruction files are high risk under the guided-review ruling (slice CH-5a, #715), so
  removing a rule passes the same gate as adding one. A proposal that changes a ruled
  decision of the `agent-trust-and-factory-evaluation` map goes to that map's discovery log
  (#687), not into this map.
- Yojimbo owns the vault pipeline. The Yuri Mac reviews read-only. `raw/` stays append-only.
- Research tickets run one at a time.
- Every finding carries its vantage: the host, the harness and the window it was measured
  in. A finding from one host or one harness is not a finding about the fleet until it is
  checked on the others, and no line of this map may say more than was measured. The owner
  set this on 2026-11-25. The first ticket to apply it is "Which findings so far hold on the other host and in the other harness?".

**Vault reference layer.** `synthesis/` and `concepts/` were searched by keyword on
2026-11-24. No page on this subject was found.

**Tracker.** The umbrella issue is #732. Each ticket is a sub-issue of it with native
blocked-by links. The three research tickets were closed before the issues were created,
so their issues were opened and closed on the same day.

## Decisions so far

- **What is stale here today, and is any staleness report acted on?** (#733) Closed 2026-11-24. On this Mac the vault scanner flags 0 of 1,011 pages and cannot see edits (`~/selfco` has no `.git`); no live process reads its report (the hygiene heartbeat is paused). Skills: 66 of 77 had no `Skill` call in the Claude Code tool ledger on the Yuri Mac in 90 days; Codex sessions on the same Mac opened 56 of them. Rules files, hooks and memory have no ledger of use there; loading is recorded in part. Yojimbo keeps no ledger at all (2026-11-25). See [staleness-census-2026-11-24](../research/staleness-census-2026-11-24.md).
- **How do other teams retire standing agent instructions?** (#734) Closed 2026-11-24. Only agent memory has published removal mechanisms that act without a person (expiry unless re-validated, citation checks, model deletes, background consolidation). For rules files and skills, a model or tool proposes and a person removes; hooks have nothing beyond a slowness report. Six signals work without a usage ledger. No study found in the 15 pages read measures pruning a rules file. See [retiring-agent-instructions-2026-11-24](../research/retiring-agent-instructions-2026-11-24.md).
- **How do other teams keep a retrieval knowledge store true over time?** (#735) Closed 2026-11-24. Published systems mostly detect *superseded* (a newer item contradicts an older one) or a moved source, not *untrue*; old items are usually kept and marked or ranked (Zep, Wikidata), and deleted only when derived from a changed source (LangChain). Outdated documents cut RAG accuracy by at least 20% even with dates in the prompt (HoH). No study in the 14 pages read covers LLM-maintained wikis, and none of them handles a kept source that has aged. See [keeping-a-knowledge-store-true-2026-11-24](../research/keeping-a-knowledge-store-true-2026-11-24.md).
- **What kinds of staleness are there, and what signal marks each?** (#737) Closed 2026-11-24. Four kinds, each a condition bound to one signal: *unused* (no load record in 90 days in either harness; amended 2026-11-25: counted per host and per harness, only where a load record was kept, with the days each record covers stated, and "no signal" where none was kept), *broken* (a named path, script or command does not resolve), *untrue* (a reader's flag) and *superseded* (a successor mark). Where a signal cannot be computed the record says "no signal": nothing marks an item that loads in every session, an unflagged false claim, or an unmarked replacement. → [adr:staleness-kinds-and-signals](../adr/draft-staleness-kinds-and-signals.md) (draft).
- **Which findings so far hold on the other host and in the other harness?** (#747) Closed 2026-11-25. 23 findings were re-measured. On the Yuri Mac five headline counts changed once Codex records, plugin items and the path the ledger saw were included: 9 of 77 skills have no record in either harness (the 66 is a Claude Code count); 64 to 65 of 133 beads were never opened by `Read`, not 98; 30 of 51 repo rules files have no load record, not 26; hook entries are 158, not 122; 413 of 1,011 wiki pages have no record in three sources, not 770. On Yojimbo (2026-11-25, read-only, through its conductor) no usage ledger exists, so *unused* cannot be computed there for Claude Code, and Codex session files cover 29 days. The vault on Yojimbo was not checked, because the owner left it out, so whether the scanner can flag a page on the host that owns the pipeline is still not known. See [second-vantage-2026-11-25](../research/second-vantage-2026-11-25.md).

## Tickets

| Ticket (title, refer-by-name) | Type | Blocked by | Status |
|---|---|---|---|
| What is stale here today, and is any staleness report acted on? (#733) | research | — | closed |
| How do other teams retire standing agent instructions? (#734) | research | What is stale here today, and is any staleness report acted on? | closed |
| How do other teams keep a retrieval knowledge store true over time? (#735) | research | What is stale here today, and is any staleness report acted on? | closed |
| How do the prior staleness decisions relate to this map? (#736) | grilling | What is stale here today, and is any staleness report acted on?; Which findings so far hold on the other host and in the other harness? | open |
| What kinds of staleness are there, and what signal marks each? (#737) | grilling | All three research tickets | closed |
| What marks a wiki claim untrue, as distinct from a page unused? (#738) | grilling | How do other teams keep a retrieval knowledge store true over time?; What kinds of staleness are there, and what signal marks each?; What share of sampled claims is untrue? | open |
| When a source is superseded, how are the pages built on it found and refreshed? (#739) | grilling | What marks a wiki claim untrue, as distinct from a page unused? | open |
| Is there a budget on what every session loads, and what happens past it? (#740) | grilling | What is stale here today, and is any staleness report acted on?; How do other teams retire standing agent instructions?; What does one session load at start, in each harness? | open |
| Who may retire or refresh an item on each surface? (#741) | grilling | How do the prior staleness decisions relate to this map?; What kinds of staleness are there, and what signal marks each? | open |
| What happens to a retired item? (#742) | grilling | What kinds of staleness are there, and what signal marks each? | open |
| What does retiring an instruction cost under the high-risk review rule? (#743) | grilling | Who may retire or refresh an item on each surface? | open |
| Would the owner accept what a pruning pass proposes? (#744) | prototype | Who may retire or refresh an item on each surface?; What happens to a retired item?; How will we tell whether retirement helped? | open |
| Should each session record what it loaded, across both harnesses, and in what shape? (#746) | grilling | — | open |
| Which findings so far hold on the other host and in the other harness? (#747) | research | — | closed |
| What does one session load at start, in each harness? (#748) | research | — | open |
| What share of sampled claims is untrue? (#749) | research | — | open |
| How will we tell whether retirement helped? (#750) | grilling | — | open |

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
  where the defects in the Notes go.
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
- **Which findings so far hold on the other host and in the other harness?** Added on 2026-11-25 at the owner's request. Every count and defect so far was
  measured from one Mac, and hooks and skills were counted in one harness. The census did
  not check whether the host that owns the vault pipeline holds a Git copy of the vault, so
  "the scanner can flag no page" may hold on one host only. The same doubt applies to "no
  live process reads the scanner's report" and to the *unused* signal: an item not loaded
  on one host may load daily on another. The ticket returns each finding with its host,
  harness and window, marked *holds elsewhere*, *differs* or *not checkable*, and corrected
  wording for any line here that says more than was measured. It adds the Codex-side and
  plugin items to the census. Checks on the owning host are read-only and go through a
  conductor session. It runs first of the three open research tickets.
- **What does one session load at start, in each harness?** Added on 2026-11-25. The census counted 4,996 lines across 53 rules files in
  total, not what one session loads. For a session at user scope and at a sample of repos,
  the ticket measures what loads before the first prompt (instruction files, memory index,
  skill listing, hook entries) in lines, bytes and count of distinct instructions, per
  harness.
- **What share of sampled claims is untrue?** Added on 2026-11-25. *Untrue* is marked only by a reader's flag, and no flag
  exists yet. The census checked claims that look like paths and nothing else. The ticket
  checks a fixed sample of claims from rules files, memory files and wiki pages against the
  current state and reports the share that is false, with the sample size, how it was drawn
  and who checked. Its file holds counts and kinds of claim, never the contents of memory
  files or vault pages.
- **How will we tell whether retirement helped?** Promoted on 2026-11-25 from "Not yet specified". Every remaining ticket assumes
  that retiring items helps, and the research found no study that removes rules and
  measures behaviour before and after. The ticket chooses one measure and where it is read
  from. It builds no evaluation. It is decided before the prototype so that the prototype
  can report it.

## Not yet specified

- How an agent should treat an item that is marked stale but not yet retired. The question
  depends on what the marks turn out to be.
- Copies that fall behind their source, such as a checkout many commits behind `main` or a
  host copy of a config. It is unclear whether that is this map's "untrue" or a separate
  problem of synchronisation. The kinds ruling did not settle it. One more instance: the
  `AGENTS.md` files read as rewrites of `CLAUDE.md` files and name paths that do not exist.
- Whether an item in a dormant repo is *unused* or only paused. The "not loaded" signal
  marks both the same way: on the Yuri Mac, 30 of 51 repo rules files have no load record
  in 90 days when each file is credited only to the harness that reads it (28 `CLAUDE.md`,
  2 `AGENTS.md`), mostly because their repos are idle there. On Yojimbo (46 files,
  2026-11-25) Claude Code keeps no ledger, and Codex session files cover 29 days: 2 of 7
  `AGENTS.md` have a record.
- The vault on the host that owns the pipeline. Whether it is a Git repository there,
  whether the scanner flags a page there, and what reads its report from inside the vault
  were not checked. The owner left the vault out of the second-vantage check on
  2026-11-25, to be handled separately.
- Instructions held in chat clients (project instructions generated from a contract).

## Out of scope

Nothing ruled yet.
