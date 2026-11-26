---
type: research
ticket: "What share of sampled claims is untrue?"
issue: ojfbot/core#749
map: decisions/wayfinder/staleness-and-retirement.md
date: 2026-11-26
vantage: "The Yuri Mac, 2026-11-26, one pass by one agent (this session). Rules files read from the Yuri Mac's checkouts, with `core` read from the worktree `core-staleness-map`; memory files from the Yuri Mac's `~/.claude/projects`; wiki pages from the Yuri Mac copy of the vault at `~/selfco/wiki` (not a Git repository; not the vault's private remote; not the owning host, Yojimbo, which was not read). Claims were checked against the Yuri Mac's disk, read-only `gh` queries and at most 10 public web pages."
---

# What share of sampled claims is untrue, 2026-11-26

*Untrue* is the kind of staleness marked only by a reader's flag
([draft ADR](../adr/draft-staleness-kinds-and-signals.md), Decision 2), and no flag exists
yet. This file measures how common the condition is before the design ticket decides what
the flag is: a fixed random sample of 90 claims, 30 per surface, each checked by hand
against the current state. Nothing was fixed, flagged, edited or retired.

**Privacy.** Counts, shares, kinds of claim and kinds of evidence only. No claim text, no
names or paths of memory files or vault pages, no repo named unless `CLAUDE.md`'s Ecosystem
table names it. The working list (each claim's text, file and verdict) is kept outside the
repository, in this session's scratchpad.

**Order of writing.** Sections 1 to 3 were written and saved before the draw was run and
before any claim was checked. They were not edited after the results came in, except where
a line says so under "Deviations from the method".

## 1. Surfaces and frames

All three frames were listed on the Yuri Mac on 2026-11-26 at 00:48 CST Each list is sorted bytewise (`LC_ALL=C sort`) on the full
path before the draw.

| Surface | Frame | Files | Lines |
|---|---|---|---|
| Rules files | `~/.claude/CLAUDE.md`, `~/AGENTS.md`, plus `CLAUDE.md`, `AGENTS.md`, `.claude/CLAUDE.md` and `.claude/AGENTS.md` at the root of each directory under `~/ojfbot` that holds a `.git` directory (the census's four root paths). `core` is read from this worktree; the `core` checkout is excluded by path | 53 | 4,999 |
| Memory files | `find ~/.claude/projects -path '*/memory/*' -name '*.md' ! -name MEMORY.md`. Index files are excluded | 144 | 4,468 |
| Wiki pages | `find ~/selfco/wiki -name '*.md'`, in the Yuri Mac copy. Hub files (index, log and the lint files) are in the frame | 1,011 | 57,207 |

The memory frame is 144 files today against 139 in the census (2026-11-24) and 140 in the
draft ADR (2026-11-25). The rules and wiki frames match the census counts.

## 2. What counts as a claim

A **unit** is one sentence of prose, one table row, or one heading. Units come from the
file's body: YAML frontmatter, fenced code blocks and HTML comments are removed first.
Consecutive prose lines are joined into a paragraph (files wrap lines), a list item with its
continuation lines is one block, and a block is split into sentences after `.`, `!` or `?`
followed by whitespace and a capital letter, digit, backtick, `*`, `[`, `(` or a quote mark.
The splitter is deterministic and imperfect (it splits after "e.g." before a capital); its
output is the unit list, whatever it does.

A unit **qualifies as a claim** when it asserts, in the indicative, a state that someone
could check:

1. something exists or is at a place (a file, repo, script, service, page, tool);
2. something is at a version, count or size;
3. something has a status (active, paused, open, merged, live, disabled);
4. something is configured some way (X is set to Y, X runs on Y, X reads Y);
5. someone owns or holds a role over something;
6. something happened on a date;
7. an outside source says something (a paper, a product's documentation, a vendor).

A unit **does not qualify** when it is an instruction or a rule ("use", "never", "must",
"should", "do X"), a preference, a plan or intention ("will", "next", "to do"), an opinion or
evaluation ("is better", "is the right call"), a definition of a term, a question, a heading
or fragment with no checkable assertion, or a statement only about the file itself ("this
section lists"). These are counted as **skipped units**, by reason.

Tie rules for the heuristic, applied the same way on every surface:

- A unit that mixes a rule and a claim qualifies if the claim part can be checked on its
  own (a rule followed by its reason, "Why: X happened on DATE", is a claim about X).
- The verdict covers every checkable clause in the unit. *Partly true* means at least one
  clause holds and at least one does not.
- A claim phrased as a past event ("on DATE, X happened") is checked against the record of
  that event. Every other claim is checked against the state today, including one stamped
  "as of DATE": if the state has moved, the verdict is *untrue* and the stamp is recorded as
  an existing marker.
- A claim about a host other than the Yuri Mac, or about what the vault's Git history shows,
  is *not checkable here*, with that reason.

## 3. The draw

- **Seed: 20261126.** One generator, `random.Random(20261126)` in Python 3.14.5, used in
  this order: shuffle the rules frame, then draw a start position for each rules file taken;
  then shuffle the memory frame and draw its start positions; then the wiki frame. Every
  call happens in that sequence, so a re-run with the same frames gives the same draw.
- **Files.** Take files in shuffled order until 30 have yielded a claim. A file with no
  units, or whose units hold no claim, yields none; it is recorded and the next file is
  taken. No file is taken twice.
- **Position.** For each file taken, `start = rng.randrange(number of units)`. Read units
  from `start` forward; the first unit that qualifies is the claim. If none qualifies before
  the end, continue from unit 0 up to `start - 1`. Every unit passed over is a skipped unit.
- **Outside sources.** Claims whose check needs an outside source are listed in draw order
  (rules 1 to 30, then memory 1 to 30, then wiki 1 to 30). The first 10 are checked against
  public web pages; the rest are *not checkable: outside source*.
- **Who checks.** One agent, this session, on 2026-11-26. No second reader checks the
  verdicts.
- **Interval.** The untrue share is untrue / (true + untrue + partly true). *Not checkable*
  is outside the denominator and reported apart. The 95% interval is the Wilson score
  interval. A second share counts *partly true* with *untrue*; both are reported.
- **Dated against undated.** A claim is *dated* when its unit carries a date or an "as of"
  stamp. A file is *dated* when its frontmatter carries a date field. The age of a claim is
  2026-11-26 minus the latest date the unit gives, or, failing that, the file's date field.

## Deviations from the method

Sections 1 to 3 above were not edited after checking began. These are the places where
applying them needed a ruling the method did not make. Each was settled the conservative
way, and each is also logged in `implementation-notes.md`.

- **A fourth not-checkable reason.** The brief listed four reasons. Some claims are present
  tense yet have nothing on disk to check against, or name a past event whose record was
  searched for and not found. These are reported as *not checkable: no record*, a wider
  reading of "past event with no record". 8 claims fall here.
- **A clause that could not be confirmed is not counted as false.** Two claims held in their
  main clause, but one minor clause was not found in the place searched: a comment location
  on GitHub, and one word in the part of a long specification that was read. Both are
  *true*, with the gap noted in the working list. *Partly true* is kept for a clause shown
  to be wrong.
- **The web queue counted only claims a public page could settle.** Three claims needed an
  outside source that has no public page: a page in a private workspace, a printed book, and
  follower counts behind sign-in walls on social platforms, which are also about a private
  person. They were left out of the queue, so the 10 web checks went to the next claims in
  draw order. All three are *not checkable: outside source*.
- **Three of the 10 web checks were inconclusive.** One page renders only through a script
  and returned no text, one guessed product address returned "not found", and one page did
  not show the relation the claim asserts. Each still used up one of the 10 checks, and each
  claim is *not checkable: outside source*.

## 4. Findings

Every number in this section is from the Yuri Mac on 2026-11-26: 30 claims per surface,
checked by one agent (this session), with no second reader.

| | Rules files | Memory files | Wiki (Yuri Mac copy) | Total |
|---|---|---|---|---|
| Files taken | 30 | 31 (1 yielded no claim) | 30 | 91 |
| Claims drawn | 30 | 30 | 30 | 90 |
| Skipped units | 104 | 63 | 108 | 275 |
| Checked (true + untrue + partly) | 28 | 23 | 19 | 70 |
| True | 22 | 20 | 19 | 61 |
| **Untrue** | **4** | **1** | **0** | **5** |
| Partly true | 2 | 2 | 0 | 4 |
| Not checkable: other host | 0 | 0 | 1 | 1 |
| Not checkable: vault Git history | 0 | 0 | 0 | 0 |
| Not checkable: outside source | 1 | 1 | 9 | 11 |
| Not checkable: no record | 1 | 6 | 1 | 8 |
| **Untrue share** (Wilson 95%) | **4 / 28 = 14.3%** (5.7–31.5) | **1 / 23 = 4.3%** (0.8–21.0) | **0 / 19 = 0%** (0–16.8) | **5 / 70 = 7.1%** (3.1–15.7) |
| Untrue or partly true (Wilson 95%) | 6 / 28 = 21.4% (10.2–39.5) | 3 / 23 = 13.0% (4.5–32.1) | 0 / 19 = 0% (0–16.8) | 9 / 70 = 12.9% (6.9–22.7) |

**30 claims per surface is too small to rank the surfaces.** All three intervals overlap. The
wiki's 0 of 19 is consistent with a true rate of up to about 17%, and the rules files' 4 of
28 with one as low as about 6%.

### Untrue and partly true, by kind

| Kind | Untrue | Partly true |
|---|---|---|
| Configuration (X runs on, reads or routes to Y) | 2 | 0 |
| Path or name | 1 | 1 |
| Status | 1 | 0 |
| Version or count | 0 | 2 |
| Outside source | 1 | 1 |
| Ownership | 0 | 0 |
| Date | 0 | 0 |

The most common kind of untrue claim is **configuration** (2 of 5). Together with path or
name and status, claims about the state of the fleet's own systems make up 4 of the 5 untrue
claims and 3 of the 4 partly true ones. For 3 of the 5 untrue claims nothing shows whether the
claim was ever true, so "the state moved past it" is not shown for them. Only the 2 dated ones
show that a state changed after the date.

### Age and markers of the untrue claims

- **Dated by the unit: 2 of 5.** Their ages are 119 days (a stated migration date) and 132
  days (a stated rebuild date). The other 3 are not dated by their unit, and their files carry
  no date field: rules files have no frontmatter. Ages from Git history were not measured.
- **Existing markers: none.** None of the 5 untrue items, and none of the 4 partly true ones,
  carries an "as of" stamp, a stale mark or a superseded mark on the claim or its file. The
  3 memory files among the 9 have no mark on their index lines either. Where marker words
  appear in those files ("superseded", "stale"), the lines are about other things. So there
  was no marker that could have been right or wrong. The two dates were present, but nothing
  read them as a cue to recheck.

### Dated against undated

| | Checked | Untrue | Partly true |
|---|---|---|---|
| Claim unit carries a date | 15 (12 memory, 2 rules, 1 wiki) | 2 (13%) | 0 |
| No date in the unit | 55 (26 rules, 18 wiki, 11 memory) | 3 (5.5%) | 4 |

Dated claims were untrue somewhat more often (2 of 15 against 3 of 55), but at these counts
the difference is noise. The two groups also differ in kind. 10 of the 15 dated claims
record a past event (a typed remark, a merge, a publication date), and each of those was
true by its record. The other 5 dated claims state a present condition with a date
attached, and both dated untrue claims are among those 5. Nearly every undated claim states
a present condition.

### Skipped units

275 units were passed over before a claim qualified: 157 sentences, 50 headings, 49 links
or navigation lines, and 19 table rows. The 157 sentences are the instructions,
preferences, plans, opinions, definitions and self-references that §2 excludes. They were
classed by hand and not split further. Two of the 30 rules files, both user-scope, account
for 77 of the 104 rules skips, because they are almost entirely instructions. In the wiki,
71 of the 108 skips are links, headings or navigation lines. One memory file held no claim
among its 8 units.

### What the checks rested on

Of the 70 verdicts on checked claims: 38 rest on a file read, 7 on a read of the vault's
`raw/` capture, 7 on a search of Claude Code transcripts for a typed message on the stated
date, 7 on a public web page, 6 on a read-only `gh` query and 5 on a command (a listing or
count). Of the 19 true wiki verdicts, 7 rest on the page's own raw capture. Each of those
shows that the page matches what was captured, not that the world still matches the capture.

## 5. How each number was measured

- **Frames:** the three lists in §1, built with the commands shown there and sorted with
  `LC_ALL=C sort`. The rules list substitutes this worktree for `core` and asserts that no
  path under the `core` checkout is in it.
- **Draw:** a script in this session's scratchpad (`draw.py`) implements §2's unit splitter
  and §3's draw: `random.Random(20261126)`, frames shuffled in the order rules, memory, wiki,
  and one `randrange` per file taken. It was run with 30, 31 and 30 files taken (memory took
  31 because one file held no claim). It prints the units from each start position, and one
  reader picked the first qualifying unit by §2. Re-running it with the same frames and the
  same file counts gives the same files and start positions. The qualifying judgement is
  manual and was not repeated.
- **Checks:** each claim was checked against the Yuri Mac's disk, read-only, by listing,
  `grep` or reading the named file. Repos were read as their working trees, and `core` as
  this worktree or `origin/main`. GitHub was queried with read-only `gh` calls (`pr view`,
  `issue view`, `api` GETs, and `secret list`, which shows names only). Typed remarks were
  matched in Claude Code transcripts under `~/.claude/projects` by a scan of user-typed text
  that excluded this session. Wiki claims were checked against the `raw/` capture named in
  the page's frontmatter, where there was one, and otherwise against the pages and files they
  name. Nothing under `~/selfco` was written. One PDF in the vault's raw layer was converted to
  text in the scratchpad.
- **Web:** 10 fetches of public pages, one per claim, in draw order among claims that a
  public page could settle. Results: 4 true, 2 untrue, 1 partly true, 3 inconclusive. 5 more
  claims needed an outside source and were past the cap; 3 had no public page (see
  "Deviations from the method"). Two long pages were read in part
  (the first 100,000 characters).
- **Interval:** Wilson score interval, z = 1.96, computed in the same script as the counts.
- **Kinds, dates and markers:** kinds were assigned by hand from §2's list. A claim counts as
  dated when its unit holds a calendar date. Marker words were counted with
  `grep -iE 'as of|stale|supersed|deprecat'` on each untrue or partly true file and on its
  memory index line, and every hit was read.
- **Working list:** each claim's text, file, start position, verdict, evidence and note is in
  the scratchpad (`verdicts.tsv`, `draw.json`), outside the repository.

## 6. Proposed wording

These are proposals for the conductor to integrate. This file does not edit the map or the
ADR.

**Map, research ticket "What share of sampled claims is untrue?" (#749), closing summary:**

> Closed 2026-11-26. On the Yuri Mac, a fixed random sample of 90 claims (30 each from rules
> files, memory files and the Yuri Mac copy of the wiki; seed 20261126) was checked by one
> agent, with no second reader. 5 of 70 checkable claims were untrue (7.1%, Wilson 95%
> 3.1–15.7%), and 9 of 70 were untrue or partly true. By surface: rules 4 of 28, memory 1 of
> 23, wiki 0 of 19. That is too few to rank the surfaces. 20 of the 90 could not be checked
> here, 11 of them for want of an outside source. Most untrue claims concern configuration,
> a path or a status. None of the untrue items carried a stale, superseded or "as of" mark.
> See [untrue-claims-2026-11-26](../research/untrue-claims-2026-11-26.md).

**Draft ADR, Evidence table, a new row:**

> | Untrue | Rules files, memory files, wiki (Yuri Mac copy) | Sample of 90 claims, 70 checkable: 5 untrue (rules 4 of 28, memory 1 of 23, wiki 0 of 19); none carried a flag or marker | [untrue-claims-2026-11-26](../research/untrue-claims-2026-11-26.md) |

**Draft ADR, Decision 4, the bullet "A false claim that no reader has flagged":** add

> On the Yuri Mac on 2026-11-26, about 1 checkable claim in 14 was untrue in a sample of 70
> (Wilson 95% 3–16%), and none of them was flagged.

**Draft ADR, Decision 3, memory-file row, Untrue column ("A stale flag on the file or on its
index line"):** no correction to the wording. Add a note that in this sample the one untrue
memory claim and the two partly true ones carried no such flag. On this sample, the signal
would have marked none of them.

## 7. What "What marks a wiki claim untrue, as distinct from a page unused?" (#738) must weigh

These are facts and open questions only. Nothing here decides the ticket or proposes a flag.

**Facts from this sample (Yuri Mac copy, 2026-11-26):**

- 0 of 19 checkable wiki claims were untrue. The upper end of the interval is about 17%, so
  this does not show that the wiki is clean.
- 11 of 30 wiki claims could not be checked here: 9 needed an outside source, 1 needed the
  owning host and 1 had no record. The wiki is the surface whose claims most often rest on
  the outside world.
- 7 of the 19 true wiki verdicts rest on the page's own `raw/` capture. They show that the
  page agrees with what was captured. They do not show that the source or the world still
  agrees: the raw layer is append-only and ages, which is the case #738 already names.
- Wiki pages are dense with links, headings and navigation lines: 71 of the 108 wiki skips.
  A unit of "claim" depends on how pages are split.
- On the other two surfaces, every untrue claim concerns the fleet's own systems
  (configuration, a path or name, a status) or a product's documented features. None
  carried a marker, and two carried a date that nothing acted on.
- The Yuri Mac copy has no Git history, and no sampled claim needed it. The owning host's
  copy was not read, and the two copies differ in page count (1,011 here against 879 on the
  private remote).

**Open questions:**

- Does a flag sit on a claim, on a page or on the raw source the page cites? A page can
  match its capture while the capture has aged.
- Does "agrees with its own raw capture" count as checked, as true, or as neither?
- Who or what can check an outside-source claim when web checks are capped, cost tokens,
  and sometimes come back inconclusive (3 of 10 here)?
- Is a dated claim's date a cue to recheck? Here dates were present on 2 of the 5 untrue
  claims and acted on by nothing.
- Would the same sample drawn from the owning host's copy give the same result?

## 8. Not measured

- The owning host, Yojimbo, its vault copy, and the vault's private remote. Every wiki number
  is from the Yuri Mac copy only.
- Any surface other than the three named: hooks, skills, beads, loops, Codex-only files under
  `~/.codex`, and the 86 extra checkouts' copies of rules files.
- A second reader of the qualifying judgements or the verdicts. Agreement between readers is
  unknown.
- The 5 outside-source claims past the cap of 10 web checks, and the 3 that no public page
  could settle.
- The ages of the 3 undated untrue claims from Git history (`git log` or `git blame` on the
  line).
- Whether the 3 undated untrue claims were ever true.
- Every clause of a multi-clause claim. Where a unit held several clauses, the verdict rests
  on the clauses checked (§2), and minor clauses were not always traced.
- Claims in YAML frontmatter, fenced code blocks and HTML comments, which §2 excludes.
- Web checks from any network vantage but the Yuri Mac's: one untrue verdict rests on a
  hostname that does not resolve from here.
- Codex transcripts, as a record of typed remarks. Only Claude Code transcripts were
  searched, so "no record" for a remark may mean it was typed in Codex or before the kept
  transcripts begin.
