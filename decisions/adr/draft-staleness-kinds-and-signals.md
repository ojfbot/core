# ADR-XXXX: Four kinds of staleness, one signal each
slug: staleness-kinds-and-signals
serial: draft
rev:
Date: 2026-11-24
Status: Proposed
domain: meta
type: convention
OKR:
Commands affected: /vault lint, /sweep, /skill-loader (vocabulary only; no behaviour changes here)
Repos affected: core (the vocabulary is fleet-wide)
gate:
baseline:
traces:
  supersedes:
  amends:
  relates-to: [vault-page-lifecycle-policy, vault-staleness-scanner, path-scoped-rules-dir-adoption, harness-loop-instrumentation, wayfinder-decision-maps]
  parent:
  part-of-series:

---

## Context

The wayfinder map [staleness-and-retirement](../wayfinder/staleness-and-retirement.md) must
rule, for each surface an agent reads, what signal marks an item stale. The surfaces are
rules files, hooks, skills, loops, memory files, beads and vault wiki pages. The map started
with three working terms: unused, untrue and superseded. This ADR records the owner's ruling
on the ticket "What kinds of staleness are there, and what signal marks each?"
(ojfbot/core#737), made on 2026-11-24.

Three findings forced the shape of the ruling.

- **None of the working terms could be observed as stated.** The
  [census](../research/staleness-census-2026-11-24.md) had to redefine all three before it
  could count anything: unused became "no recorded tool call", untrue became "a named path
  does not resolve", and superseded became "someone wrote a marker".
- **Nothing detects a false claim by scanning it,** here or in published practice. Published
  systems detect narrower things
  ([knowledge-store research](../research/keeping-a-knowledge-store-true-2026-11-24.md), §2).
- **"Stale" already had two meanings in this repo.** `adr:vault-page-lifecycle-policy` uses
  "staleness" for pages nothing uses and calls fact-validity "currency, not staleness".
  `adr:path-scoped-rules-dir-adoption` writes "stale / not-100%-true".

The census also reported that use could not be measured for rules files, hooks or memory
files. An inspection during the session corrected that in part. Whether an item was *loaded*
is recorded. Whether a session *relied on* it is not.

| Surface | What the harness loads | Record that exists today |
|---|---|---|
| Rules files | The whole file, when a session starts in its scope | Claude Code: on the Yuri Mac, transcripts from 2026-09-10 name each file loaded at start, with its text (69 of 173 kept transcripts on 2026-11-25); nothing earlier names the file, and `tool-telemetry.jsonl` stamps repo and working directory on every tool call. Codex: each session file stores the merged instruction text and its directory |
| Hooks | Each entry in a settings file, for sessions in its scope | Session transcripts keep a run record for some hooks. A hook that passes silently leaves none |
| Memory files | The folder's index, at session start in that project | Index load: listed in the same transcript record, as a file with its path (Yuri Mac, from 2026-09-10). A file opened with `Read`: logged |

## Decision

1. **A kind of staleness is a condition of the item, bound to one named signal.** Where the
   signal cannot be computed on a surface, the record says "no signal". It is not filled
   with a weaker test.

2. **There are four kinds.**

   | Kind | Condition | Signal |
   |---|---|---|
   | Unused | Nothing loads or opens the item | No load record in the window, in either harness, counted only where a load record was kept |
   | Broken | The item names something that is gone | A named path, script or command does not resolve |
   | Untrue | The world has moved past what the item says | A reader's flag on the item |
   | Superseded | A newer item replaces it | A successor mark on the old item |

   - "Stale" is the umbrella word: an item is stale when it is one or more of the four.
   - The window is 90 days. It has not been calibrated.
   - A reader is a person or an agent. A flag is a mark a reader wrote on the item after
     finding it wrong.
   - *Unused* is counted per host and per harness, and only where a load record was kept.
     A result names the host-and-harness pairs it rests on, the days of the window each
     record covers, and the pairs it could not use. A record that covers fewer than the 90
     days counts, with its days stated. Where no record was kept for a pair, the record
     says "no signal" for that pair: a missing record never makes an item *unused*. The
     owner added this on 2026-11-25, after one host was found to keep no ledger
     (ojfbot/core#747).

3. **Signal per surface, as it computes on the Yuri Mac on 2026-11-24.**

   | Surface | Unused | Broken | Untrue | Superseded |
   |---|---|---|---|---|
   | Rules files | Repo files: no session of either harness loaded the file. User-scope files, and a single rule inside a loaded file: no signal | Path check | No signal | No signal |
   | Hooks | Repo-scope entries: no session in the repo; Codex entries in a project Codex does not trust. User-scope entries: no signal | Script path check | No signal | No signal |
   | Skills | No `Skill` call in the tool ledger | Path check | No signal | No signal |
   | Memory files | No session in the folder's project, or the file is in no index | Absolute paths only | A stale flag on the file or on its index line | Successor mark |
   | Beads | No `Read` of the bead | Path check; it over-counts, because a bead often names paths in another repo | No signal | `status: superseded` or a `superseded_by` key |
   | Vault wiki | No signal today: wiki reads stopped being logged on 2026-08-19 | The lint's broken-link check, plus a path check | No signal | `superseded_by` |
   | Loops | Named, not computed | Named, not computed | Named, not computed | No signal |

4. **What the ruling does not detect.** These are stated so that a clean result is not read
   as a clean bill.
   - Reliance on anything that loads in every session: the user-scope rules files, the
     user-scope hook entries, the home memory folder, and any single rule inside a file that
     did load.
   - A false claim that no reader has flagged.
   - A replacement that nobody marked.
   - A clean result on one kind says nothing about the other three.

## Evidence

Measured on the Yuri Mac on 2026-11-24. Counts only. Four rows were corrected on
2026-11-25 from [second-vantage-2026-11-25](../research/second-vantage-2026-11-25.md).
Every row that reads a ledger is a Yuri Mac row: Yojimbo keeps no ledger (2026-11-25), so
none of them has a second-host value.

| Kind | Surface | Result | Source |
|---|---|---|---|
| Unused | Rules files (51 repo files) | Per file, each credited to the harness that reads it: 21 with a load record in 90 days (13 `CLAUDE.md`, 8 `AGENTS.md`); 26 with none in 90 days; 4 `CLAUDE.md` never. 263 Codex session files are imports and credit nothing | Tool ledger `repo` and `cwd`; Codex session working directories |
| Unused | Hook entries (112 repo-scope, Claude Code) | 32 in repos with a session in 90 days; 72 in idle repos; 8 in repos never in the ledger | Tool ledger |
| Unused | Hook entries (14 repo-scope, Codex) | 9 with no hook trust record (3 in an untrusted project, 6 in trusted projects) | Codex configuration |
| Unused | Memory files (140) | 10 files, in 8 folders with no session transcript on disk. 2 of 139 in no index | Transcript folders; census §6 |
| Unused | Skills (77) | 66 with no `Skill` call in the Claude Code ledger in 90 days. Codex root sessions opened 56 of them; 9 of 77 have neither record | Census §5 |
| Unused | Beads (133) | 64 to 65 never opened by `Read`, once `core` beads are matched under the path the ledger saw; 51 when shell reads count | Census §7 |
| Broken | All but loops | Fixed samples of 20 claims per surface: 0 to 7 fail | Census §3 to §8 |
| Broken | Hooks | 1 of 122 script paths | Census §4 |
| Untrue | Memory files | 3 files carry a strict marker (stale or superseded; the census did not split them); 2 index files carry a stale note | Census §6 |
| Superseded | Beads, wiki | 3 beads; 3 wiki pages | Census §7, §8 |

Limits of these measurements:

- **The Claude Code ledger record is a proxy.** "A session worked in the repo" is not "the
  repo's rules file loaded". A direct record exists in transcripts on the Yuri Mac from
  2026-09-10 (77 of the 90 days on 2026-11-25); the counts in this table do not use it
  yet. Codex session files show the gap: more than half of them start
  above any repo and record only the global instruction text.
- **Codex session files begin on 2026-09-18,** so the Codex side covers 67 of the 90 days.
- **The hook and skill counts above are for Claude Code.** Codex has its own hook entries,
  skills and automations, and plugins add hooks in both harnesses. The census did not count
  them.
- **One file can be read by both harnesses.** On the Yuri Mac, Claude Code has loaded an
  `AGENTS.md` as a project file in 29 recorded starts, each in a folder with no
  `CLAUDE.md`. Crediting an `AGENTS.md` only to Codex holds for the 10 repo files, which
  all sit beside a `CLAUDE.md`, as far as records go (no start in such a repo is recorded
  after 2026-10-21).
- **Loops were not counted.** The control-plane census is still open.

## Consequences

### Gains
- Later tickets can rule per kind. The published remedies differ by kind: an unused item is
  demoted or switched off, a broken reference is repaired in place, an untrue item is
  rewritten or retired, and a superseded item is kept and marked
  ([instructions research](../research/retiring-agent-instructions-2026-11-24.md) §2;
  knowledge-store research §4).
- Three of the four signals compute today with a file check or a ledger query.
- The word "stale" has one meaning in this repo.

### Costs
- **The measurable unused is mostly the harmless unused.** An item no session loads costs
  nothing. The pile-up harm comes from what loads in every session, and that has no signal.
  The load-budget ticket carries that problem, not this kind.
- **"Not loaded" mostly measures which repos are asleep.** Whether an item in a dormant repo
  is unused or only paused is not ruled here.
- **Untrue and superseded depend on someone writing a mark.** Four surfaces (rules files,
  hooks, skills, loops) have no convention for either mark. Until one exists their cells
  stay "no signal".
- **A flag is the output of detection, not detection.** An unflagged item is not thereby
  true.
- Four kinds are more vocabulary than three.

### Neutral
- `adr:vault-page-lifecycle-policy` and `adr:vault-staleness-scanner` keep their own test
  for wiki pages. In this vocabulary that test is a signal for *unused*. Whether this map
  adopts or amends them is a separate ticket (ojfbot/core#736).
- Dated claims ("as of" stamps, expiry dates) are not a signal for any kind here. The wiki
  ticket (ojfbot/core#738) may still use them.
- Both harnesses can export a finer load record than the one used here. Neither export is
  switched on. Whether to record what each session loaded is a separate ticket.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Define each kind as exactly one observable event | Every kind would compute by construction, but "stale" would mean only what today's tooling sees. Remedies differ by condition, not by detector |
| Drop "unused" and leave it to the load budget | The budget covers only what every session loads. Unread beads and wiki pages would have no ticket |
| Mark unused by wiring only (nothing calls or indexes the item) | It is the narrow case of "not loaded". It misses items that are wired and never loaded |
| No signal for unused on rules files, hooks and memory files | It throws away a signal that computes today |
| Treat a dead reference as the signal for untrue | "Does not resolve" is not "wrong". The remedy differs, and the untrue row would look covered while every claim that is not a path stays unchecked |
| Mark untrue by a declared date that has passed | That is age, not falsehood. `adr:vault-page-lifecycle-policy` rejects time-based sweeps for reference pages, and dated claims exist almost only on the wiki |
| No signal for untrue | It leaves unmarked the harm the map exists for: an agent acting on an outdated claim |

## Open points

- The 90-day window is a guess.
- The least cover a record needs before a pass may act on *unused*. A stated shorter cover
  counts, and on 2026-11-25 one pair covers 29 days. A pass that proposes removals may need
  its own minimum: "Would the owner accept what a pruning pass proposes?"
  (ojfbot/core#744).
- The skills row reads the Claude Code tool ledger, while the kind says either harness.
  Codex leaves a different record of a skill being opened (a `SKILL.md` path in a
  session's command text). Which record the row rests on per harness is not ruled.
- What the flag and the successor mark look like on each surface, and what happens to a
  marked item: "What happens to a retired item?" (ojfbot/core#742).
- Who may flag, mark, repair or retire: "Who may retire or refresh an item on each
  surface?" (ojfbot/core#741).
- What the flag is on the wiki: "What marks a wiki claim untrue, as distinct from a page
  unused?" (ojfbot/core#738).
- Signals for loops are named and not computed.

## Provenance

| Field | Value |
| --- | --- |
| Zero-point | 2026-11-24, wayfinder ticket ojfbot/core#737, ruled by the owner in session |
| Amended | 2026-11-25, the *unused* signal (counted only where a record was kept; a stated shorter cover counts), ruled by the owner in session after ojfbot/core#747 |
| Implementation start | _pending_ |
| Implementation end | _pending_ |
