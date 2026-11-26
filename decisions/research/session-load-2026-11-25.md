---
type: research
ticket: "What does one session load at start, in each harness?"
map: decisions/wayfinder/staleness-and-retirement.md
date: 2026-11-25
vantage: "The Yuri Mac, 2026-11-25, one pass. Claude Code as launched by the desktop app (165 of 173 kept transcripts; 1 terminal start, 7 SDK starts) and Codex as launched by its desktop app (301 of 317 native root session files; 16 non-interactive). Records read: Claude Code transcripts 2026-06-10 to 2026-11-25, Codex session files 2026-09-18 to 2026-11-25. `core` read through one worktree. Yojimbo, the NAS and every other host and launch mode are not measured."
---

# What one session loads at start, 2026-11-25

How much is put in front of the model before it answers the first prompt, for one session,
in each harness. Nothing was changed, retired or started: no session was launched to
capture a start. Every number is from the Yuri Mac on 2026-11-25 and carries its harness.
None is a fleet number.

**Two kinds of number, kept apart.**
*Record* = read from what a real session wrote down when it started: a Claude Code
transcript under `~/.claude/projects`, or a native Codex session file under
`~/.codex/sessions`. Each record number carries the date of that start.
*Files* = assembled today from the files a start in that folder would load, by the load
rule stated in §4. A files number is a prediction, not an observation.

**Privacy.** Sizes, counts, dates, kinds and config paths. No text of a rules file, memory
file, hook output, prompt or session. Repos are named only where `CLAUDE.md` on `main`
names them; one sampled repo it does not name is left unnamed.

**Off limits.** The `core` checkout was not read or listed. `core` files were read from
this worktree. User-scope skills are links into that checkout, so they were read from the
worktree copy (§7). Records of sessions that *started* in the checkout were read, because
those records live under `~/.claude` and `~/.codex`.

## 1. Headline

| Start (Yuri Mac) | Claude Code, desktop app | Codex, desktop app |
|---|---|---|
| **User scope** | *Record*, started in the home folder 2026-11-25 (latest of 21): **247,743 bytes, 1,448 lines, 572 instructions (536 distinct), 92,967 input tokens** for the first request | No record: no native Codex session has started in the home folder. Nearest record, started in `~/ojfbot` 2026-11-20 (latest of 45): **116,544 bytes, 1,411 lines, 295 instructions (290 distinct), 29,204 input tokens** |
| **`core`** | *Record*, 2026-10-10 (latest of 3): **100,782 input tokens**; the four configured parts are 80,516 bytes and 1,019 lines. That version kept no system prompt or tool definitions, so there is no byte total | *Record*, 2026-10-21 (latest of 18): **42,823 input tokens**; the configured parts are 57,848 bytes and 707 lines. That version kept no tool definitions |
| Owner's instruction files inside it | 13,857 bytes at home (5.6% of the start); 37,347 in `core` on 2026-10-10 | 7,225 bytes in `~/ojfbot` (6.2%); 35,793 in `core` on 2026-10-21, 8,336 from today's files |

The token figures are the harness's own count for the first request and include the first
prompt (7,799 bytes at home, 177 in `core`). They are not converted from bytes.

Three things the totals show.

1. **Most of a start is not in any file this map covers.** In the Claude Code home record
   the system prompt and tool definitions are 165,543 bytes, 67% of the start. Instruction
   files, the memory index, the skill listing and hook text together are 51,624 bytes
   (21%). In the Codex `~/ojfbot` record those four are 32,563 of 116,544 bytes (28%).
2. **The 4,996 lines are never loaded together.** Recorded starts carry 103 to 488 lines of
   instruction files in Claude Code (67 desktop starts) and 113 to 486 in Codex (272).
3. **The skill listing is at a fixed size in both harnesses.** Adding skills does not add
   bytes. It removes descriptions (§3.3).

## 2. Findings table

"Configured parts" are the four surfaces the map names: instruction files, memory index,
skill listing, hook text. "instr." is the count of instructions by the rule in §4.3, summed
over the files loaded; the distinct count is given where it differs.

### Claude Code (Yuri Mac; launched by the desktop app)

| Start folder | Source | Instruction files: bytes, lines, instr. | Memory index: bytes, lines | Skill listing: bytes; skills; with a description | Hook text, bytes | Configured parts: bytes, lines | First request, input tokens |
|---|---|---|---|---|---|---|---|
| Home | Record 2026-11-25, latest of 21 | 13,857; 206; 60 (30 distinct) | 4,325; 22 | 30,035; 125; 69 | 3,407 | 51,624; 415 | 92,967 |
| `~/ojfbot` (a folder, not a repo) | Record 2026-11-21, latest of 4 with a full request | 13,857; 206; 60 (30 distinct) | 20,608; 95 | 30,072; 123; 69 | 3,231 | 67,768; 483 | 101,237 |
| `core` | Record 2026-10-10, latest of 3 | 37,347; 488; 66 | 10,238; 134 | 30,084; 351; 44 | 2,847 | 80,516; 1,019 | 100,782 |
| `core` (worktree stand-in) | Files today | 40,314; 500; 73 | 10,239; 134 | not predictable from files (§5) | — | — | — |
| `daily-logger` | Record 2026-10-17, latest of 14 | 16,118; 265; 52 | 4,188; 63 | 30,086; 272; 52 | 2,586 | 52,978; 648 | 97,163 |
| `lego-village-pipeline` | Record 2026-10-21, latest of 5 | 12,538; 174; 42 | 315; 2 | 30,085; 354; 44 | 2,697 | 45,635; 580 | 89,540 |
| `workstation-yuri` (a worktree of it) | Record 2026-11-24, latest of 2 | 13,365; 200; 37 | none | 30,082; 288; 47 | 3,355 | 46,802; 549 | 88,190 |
| `cv-builder` | Record 2026-09-24, the only one | 10,788; 174; 39 | 3,669; 58 | 30,097; 262; 54 | 2,604 | 47,158; 536 | 85,253 |
| `GroupThink` (idle) | Files today; no record | 11,220; 197; 38 | none | — | — | — | — |
| A repo with no rules file | Files today; no record | 6,940; 109; 30 | none | — | — | — | — |

Full byte totals exist only where the transcript kept the request (from 2026-10-27):
home 247,743 bytes and 1,448 lines; `~/ojfbot` 274,277 and 1,538; `workstation-yuri`
236,100 and 1,504.

### Codex (Yuri Mac; launched by the desktop app)

| Start folder | Source | Instruction block: bytes, lines, instr. | Skill listing: bytes; skill lines | Hook text, bytes | Configured parts: bytes, lines | First request, input tokens |
|---|---|---|---|---|---|---|
| Home | Files today; no record | 14,338; 218; 60 (30 distinct) | — | — | — | — |
| `~/ojfbot` | Record 2026-11-20, latest of 45 | 7,225; 113; 30 | 22,268; 147 | 3,070 | 32,563; 339 | 29,204 |
| `core` | Record 2026-10-21, latest of 18 | 35,793; 486; 64 | 22,055; 199 | 0 | 57,848; 707 | 42,823 |
| `core` (worktree stand-in) | Files today | 8,336; 128; 35 | — | — | — | — |
| `daily-logger` | Record 2026-11-25, latest of 139 | 15,783; 272; 49 | 22,269; 148 | 3,407 | 41,459; 506 | 31,571 |
| `lego-village-pipeline` | Record 2026-10-21, latest of 15 | 12,544; 184; 41 | 22,250; 120 | 2,697 | 37,491; 373 | 37,306 |
| `workstation-yuri` | Files today; no record | 7,169; 109; 30 | — | — | — | — |
| `cv-builder` | Record 2026-10-03, the only one | 11,116; 188; 39 | 22,243; 100 | 2,388 | 35,747; 351 | 35,510 |
| `GroupThink` (idle) | Files today; no record | 7,169; 109; 30 | — | — | — | — |
| A repo with no rules file | Files today; no record | 7,169; 109; 30 | — | — | — | — |

Codex has no memory index on this Mac (0 memory rows, per the second-vantage file), so the
table has no memory column. Full byte totals where the record kept tool definitions:
`~/ojfbot` 116,544 bytes and 1,411 lines; `daily-logger` 125,699 and 1,602. The `core`
record has no hook text because an agent, not a person, started that session.

## 3. What loads, part by part

### 3.1 Claude Code: the home start of 2026-11-25 (record; version 2.1.330)

| Part | Kind | Count | Bytes | Lines | Instr. |
|---|---|---|---|---|---|
| Harness system prompt | Harness | 1 | 41,348 | 166 | 104 |
| Tool definitions, schemas and descriptions | Harness and connectors | 52, of which 32 from connectors | 124,195 | 518 | 323 |
| Names of tools held back until asked for | Connectors | 273 | 12,321 | 273 | 0 |
| Agent type listing | Harness and plugins | 11 | 5,922 | 11 | 7 |
| Connector (MCP server) instructions | Connectors | 3 servers | 8,988 | 65 | 27 |
| Session facts: environment, model, date, account | Harness | — | 3,345 | — | — |
| User instruction file | Owner | 1 | 6,933 | 103 | 30 |
| `AGENTS.md` in the start folder, loaded as a project file | Owner | 1 | 6,924 | 103 | 30 |
| Memory index | Owner and agents | 1 | 4,325 | 22 | 9 |
| Skill listing | Owner, plugins, desktop app | 125 skills, 69 with a description | 30,035 | 127 | 41 |
| Hook text on the first prompt | Owner | 2 blocks | 3,407 | 60 | 1 |
| **Total** | | | **247,743** | **1,448** | **572 (536 distinct)** |

Lines and instructions for the tool definitions are counted in their description text; the
bytes are the whole JSON. The memory index points at memory files; none of those loaded
with it in any record.

Range over the 32 starts that kept the request (2026-10-27 to 2026-11-25): system prompt
34,429 to 41,679 bytes; tool definitions 49 to 52, 117,769 to 135,947 bytes; held-back tool
names 243 to 346; connector instructions for 2 to 9 servers, 7,436 to 14,891 bytes. The
connector parts move from one start to the next on the same day, with which servers had
connected.

### 3.2 Codex: the `daily-logger` start of 2026-11-25 (record; CLI 0.171, started by an automation)

| Part | Kind | Count | Bytes | Lines | Instr. |
|---|---|---|---|---|---|
| Harness base instructions | Harness | 1 | 17,766 | 167 | 76 |
| Tool definitions | Harness and connectors | 3 namespaces | 42,041 | 665 | 95 |
| Names of tool namespaces held back | Connectors | — | 3,443 | 22 | 12 |
| Harness and app context blocks: permissions, modes, app context, plugin notes | Harness and app | — | 19,481 | 235 | 63 |
| Session facts: environment | Harness | — | 1,509 | 7 | 0 |
| Instruction files, as one merged block | Owner | global file and one repo file | 15,783 | 272 | 49 |
| Skill listing | Owner, plugins, app | 148 skill lines | 22,269 | 174 | 22 |
| Hook text on the first prompt | Owner | 2 blocks | 3,407 | 60 | 1 |
| **Total** | | | **125,699** | **1,602** | **318 (317 distinct)** |

Range over 317 native root session files: base instructions 17,766 to 27,768 bytes in all
but 2 (it changes with the model); tool definitions, kept in 99 files, 19,816 to 92,404 bytes;
instruction block 7,168 to 35,965 bytes over 277 files.

### 3.3 The skill listing

- **Claude Code.** 166 of 173 kept transcripts hold the listing. 102 of them are between
  30,035 and 30,117 bytes, and none is larger. The number of skills listed runs from 42 to
  354. The share listed with a description falls as the count rises: 97% under 100 skills
  (71 starts), 62% at 100 to 129 (45), 36% at 130 to 249 (8), 20% at 250 to 299 (20), 15%
  at 300 or more (22). In `core` on 2026-10-10, 351 skills were listed and 44 had a
  description.
- **Codex.** 279 native root files hold the listing. 221 are between 22,033 and 22,271
  bytes and 46 are between 40,371 and 40,491; 12 are smaller (12,140 to 14,870). List lines
  run from 24 to 388.
- **Plugin and app skills are inside these numbers.** At home on 2026-11-25, 81 of the 125
  names carry a plugin-style prefix, in 17 prefixes. A skill body is in a start record only
  where the first prompt named the skill (1 Claude Code start, 3 Codex starts).

### 3.4 Hook entries that run at start or on the first prompt

| Scope | Claude Code | Codex |
|---|---|---|
| User | 4 of 10 entries: 3 `UserPromptSubmit`, 1 `SessionStart` (asynchronous) | 3 of 4 entries: 3 `UserPromptSubmit` |
| One enabled plugin | 2 of 9: 1 `SessionStart`, 1 `UserPromptSubmit` | 2 of 9: 1 `SessionStart`, 1 `UserPromptSubmit` |
| Repo | 0 of 112 entries in 33 files (97 `PostToolUse`, 15 `PreToolUse`) | 0 of 14 entries in 5 files |

So no repo-scope hook adds to a start in either harness, and the same three user-scope
scripts run on the first prompt in both. Text injected, from records: two blocks. One is a
skill-suggestion line (138 bytes when nothing matches, about 500 when a skill does). The
other is a roster of other active sessions. In Claude Code, 148 of 173 starts hold two
blocks, 18 hold one and 7 hold none. The roster's median size by month of start: 773 bytes
in June, 1,272 in July, 1,457 in August, 2,082 in September, 2,331 in October, 3,217 in
November (maximum 3,269). The plugin entries and the `SessionStart` entry left no text in
any record.

### 3.5 First-request input tokens over time (record)

| Month of start | Claude Code, desktop app: starts; min; median; max | Codex, started by a person: starts; min; median; max |
|---|---|---|
| 2026-06 | 4; 34,585; 37,459; 54,598 | no session files |
| 2026-07 | 25; 55,162; 68,605; 76,353 | no session files |
| 2026-08 | 61; 58,034; 72,015; 86,302 | no session files |
| 2026-09 | 16; 79,609; 85,936; 109,930 | 18; 28,677; 34,810; 39,781 |
| 2026-10 | 20; 78,349; 89,427; 100,782 | 80; 22,336; 36,961; 47,725 |
| 2026-11 | 30; 87,036; 91,048; 101,237 | 15; 28,215; 34,365; 44,263 |

Each figure includes that session's first prompt; Claude Code starts with a first prompt
over 20,000 bytes are left out. In November, Claude Code by start folder: home 87,036 to
93,659 (20 starts), `~/ojfbot` 99,604 to 101,237 (3), a repo worktree 88,141 and 88,190
(2), elsewhere 91,969 to 94,431 (5).

**Launch mode changes the start more than the folder does.** The one terminal start
(2026-10-01) used 72,112 tokens. Five SDK-launched starts used 3,288 to 4,421 and one
26,163; none of the seven SDK starts holds a user instruction file or a skill listing, and
the one that names any file names only a memory index.

**Bytes per token, observed.** Bytes of the recorded parts plus the first prompt, divided
by the recorded input tokens: 2.71 to 2.75 in the three full Claude Code records, 3.98 and
3.99 in the two full Codex records. The request may hold content these parts do not count,
so the ratio is an upper bound on bytes per token. No number in this file is converted
with it.

## 4. How each number was measured

### 4.1 Records

- **Claude Code.** 173 transcripts directly under `~/.claude/projects/*/`. Each was read
  from its first line to its first model reply. Read from it: the `instructions` record
  (path, kind and text of each file loaded: user, project, memory index), in 69 transcripts
  from 2026-09-10; `skill_listing` in 166; `hook_additional_context` in 166; the lists of
  held-back tools, agent types and connector instructions in 163 to 166; and
  `api-request-shape` (system prompt and tool definitions of the first request) in 32, from
  2026-10-27. Tokens are `usage` on the first model reply: input plus cache-write plus
  cache-read.
- **Codex.** 2,976 session files; 263 imports and 2,396 review threads and subagents were
  skipped, leaving 317 native root files. Each was read from its first line to its first
  model output. Read from it: `base_instructions` in the first line; `additional_tools`;
  every developer and user block before the prompt, sorted by its leading tag (the
  instruction block, the skills block, the context blocks); blocks marked as hook output
  after the prompt; and `input_tokens` of the first `token_count` event. In 89 files the
  base instructions are stored twice; they are counted once.
- **Which record stands for a start folder.** The latest one whose start folder is that
  folder (for a repo: the repo or one of its worktrees) and that holds an instruction
  list. "Latest of N" is how many such records exist.

### 4.2 Files (the load rule applied)

- **Claude Code.** The user file; then, from the start folder up to the root of its Git
  checkout, or up to `/` when it is in none, each `CLAUDE.md`, `.claude/CLAUDE.md` and
  `CLAUDE.local.md`, files under `.claude/rules` with no `paths` key, and files named on an
  `@` line. HTML comments are removed: that accounts for 238 of the 245 bytes by which every
  record of the user file is shorter than the file. An
  `AGENTS.md` is counted where its folder has no `CLAUDE.md`: this is *inferred* from 29
  records and not documented anywhere that was read (§5). The memory index is the
  `MEMORY.md` of the project folder for the checkout's main repo.
- **Codex.** `~/.codex/AGENTS.md`; then `AGENTS.md` in each folder from the project root
  down to the start folder, when the project is in Codex's trusted list; in a folder
  outside any repo, only that folder's own file. This is the documented rule, as cited in
  the notes of the ticket on kinds.
- **`core`.** This worktree stands in. Its `CLAUDE.md` is 33,374 bytes and its `AGENTS.md`
  1,167. The memory index is the one stored for the `core` project.

### 4.3 The instruction count (a heuristic)

Applied the same way to every part in §2 and §3.

1. Drop HTML comments, YAML frontmatter, fenced code, headings, blank lines, table
   separator rows and lines that are only a tag.
2. A **statement** is one list item (with its indented continuation lines), one table
   row, or one sentence of a prose paragraph.
3. An **instruction** is a statement that contains one of a fixed list of 23 marker words
   or phrases (must, never, always, do not, should, only, required, prefer, avoid, unless,
   instead, and so on), or that opens with one of 79 imperative verbs after any short
   leading label.
4. **Distinct** means different after lower-casing, removing markdown marks, collapsing
   spaces and mapping the two harness names to one token.

What it gets wrong: a list item with three orders counts once; a descriptive sentence
containing "only" counts as an instruction; two paraphrases of one rule count twice. Read
the counts as sizes, not as a tally of rules. The word lists are in `count_rule.py`.

### 4.4 The sample

The rule was fixed from activity counts before any start was sized. Population: the 54
repos under `~/ojfbot` other than `core`. Activity is recorded session starts from
2026-08-27 to 2026-11-25 in the repo or its worktrees: kept Claude Code transcripts plus
native root Codex files. Ties go to the count of sessions in the Claude Code tool ledger.

| Pick | Rule | Repo | Recorded starts (Claude Code + Codex) |
|---|---|---|---|
| 1, 2 | The two busiest | `daily-logger`, `lego-village-pipeline` | 14 + 141; 5 + 17 |
| 3 | The busiest of the rest that holds `CLAUDE.md` and no `AGENTS.md` | `workstation-yuri` | 2 + 0 |
| 4 | The busiest of the rest with a rules file below its root or in `.claude/rules` | `cv-builder` | 1 + 1 |
| 5 | Idle: first by name among repos with a rules file, no recorded start and no ledger session in the window | `GroupThink` | 0 |
| 6 | No rules file: the one with the most ledger sessions | not named on `main` | 0 |

Sample size 6, plus `core` (4 + 19 starts) and the two folders above the repos. Picks 1, 2
and 4 hold an `AGENTS.md`; picks 2 and 4 hold nested rules files. Nested files do not load
at start in either harness's record.

**Where sessions actually start.** In that window, Claude Code: 21 at home, 11 in
`~/ojfbot`, 30 in a repo or worktree, 13 elsewhere. Codex native root: 0 at home, 71 in
`~/ojfbot`, 195 in a repo or worktree (141 of them in one repo), 51 elsewhere. A session
that starts above the repos and then works inside one loads that repo's rules file later,
on entering it; this ticket did not measure loads after the first prompt.

## 5. Records against files

| What | Files say | Record shows | Gap |
|---|---|---|---|
| User instruction file, Claude Code | 7,178 bytes, 109 lines on disk | 6,933 bytes, 103 lines in every record from 2026-09-10 to 2026-11-25 | 245 bytes. Removing the file's 3 HTML comments leaves 6,940 |
| `~/AGENTS.md`, Claude Code | 7,169 bytes | 6,924 bytes, loaded as a project file | 245 bytes, same cause |
| Repo `CLAUDE.md`, three sampled repos | 5,606; 9,199; 6,433 bytes today | 5,605 (2026-10-21); 9,185 (2026-10-17); 6,432 (2026-11-24) | 1 to 14 bytes |
| `core` `CLAUDE.md`, Claude Code | 33,374 bytes today (worktree) | 30,414 on 2026-10-10 | 2,960 bytes of growth in 46 days, not a load difference |
| Memory index | 4,326; 10,239; 20,839 bytes | 4,325; 10,238; 20,608 | 1 byte, or growth since the record |
| Instruction block, Codex, three sampled repos | 15,668; 12,420; 11,003 bytes | 15,783; 12,544; 11,116 | 113 to 124 bytes of wrapper text |
| Instruction block, Codex, `core` | 8,336 bytes today (global 7,169 + repo 1,167) | 35,793 bytes on 2026-10-21 | **27,457 bytes.** The record predates the tracked `AGENTS.md` (first committed 2026-11-16); the second-vantage file found that the recorded text matches lines of `CLAUDE.md`. The record is of files as they were |
| Skill listing, Claude Code, home | 84 skills under `~/.claude` (27 user, 57 from enabled plugins), 28,797 bytes if none were cut | 125 skills in 30,035 bytes, 69 with a description | **29 of the 125 recorded names match a file under `~/.claude`.** The other 96 come from elsewhere: 74 `SKILL.md` files sit under the desktop app's own support folder, and built-in skills have no file. 55 of the 84 found are not listed |
| Skill listing, Claude Code, `core` | 160 entries (27 user, 57 plugin, 76 repo), 65,028 bytes uncut | 351 skills in 30,084 bytes, 44 with a description | Count and size are both unpredictable from files |
| Skill listing, Codex | 88 skills found (25 user, 63 from enabled plugins), 39,800 bytes uncut | 147 to 199 skill lines in about 22,250 bytes | 59 or more listed skills were not found by the file search |
| System prompt, tool definitions, context blocks | In no file on disk | 67% of a Claude Code home start; 72% of a Codex `~/ojfbot` start | Record only |

**The largest gap is the skill listing and the harness parts, not the rules files.** Where
the dates match, an instruction file's record and its file differ by 1 to 245 bytes.

**Claude Code loads `AGENTS.md`.** 29 records list an `AGENTS.md` as a project file: 1 in
a folder outside `~/ojfbot` on 2026-10-20, and 28 that list `~/AGENTS.md`, all of the 28
starts outside a Git checkout since 2026-11-12 (20 at home, 3 in `~/ojfbot`, 5 in scratch
folders). `~/AGENTS.md` was created on 2026-11-08; the one home start recorded that day does
not list it. The 2 starts inside a checkout since 2026-11-12 list their
repo's `CLAUDE.md` and not `~/AGENTS.md`. No record since 2026-11-12 starts in a repo that
holds both files, and none starts in a repo that holds neither. So whether Claude Code
loads a repo's `AGENTS.md` beside its `CLAUDE.md` today is not known; in 14 records from
`daily-logger` and one of its worktrees, up to 2026-10-17, it did not; that repo holds both
files today.

**The Codex project cap.** 28 of 277 recorded instruction blocks are over 32,768 bytes
(maximum 35,965), all with the 7,169-byte global file inside. No start assembled from
today's files exceeds it: the largest is 15,668 bytes.

## 6. Scope, duplication, smallest and largest

**User scope against repo scope (records).**

| Start | Loads whatever the start folder | Depends on the start folder |
|---|---|---|
| Claude Code, home, 2026-11-25 | 236,494 bytes (95.5%) | 11,249 (4.5%): `~/AGENTS.md` and the memory index |
| Claude Code, `workstation-yuri`, 2026-11-24 | 229,668 bytes (97.3%) | 6,432 (2.7%): the repo's `CLAUDE.md`. Its 163 extra skills add no bytes; they displace descriptions |
| Claude Code, `core`, configured parts only, 2026-10-10 | 39,864 of 80,516 bytes (49.5%) | 40,652 (50.5%): `CLAUDE.md` 30,414 and memory index 10,238 |
| Codex, `~/ojfbot`, 2026-11-20 | 116,544 bytes (100%) | 0 |
| Codex, `daily-logger`, 2026-11-25 | 117,200 bytes (93.2%) | 8,499 (6.8%): the repo's `AGENTS.md` |

"Whatever the start folder" still varies with the launch mode and with which connectors
were up (§3.1, §3.5).

**Duplication between files loaded together.**

- Claude Code at home, or anywhere outside a checkout: `~/AGENTS.md` repeats the user
  file. 75 of its 103 loaded lines, 6,738 of 6,924 bytes, match a line of the user file
  once the two harness names are mapped to one. Instructions: 60 loaded, 30 distinct.
- Codex at home (files; no record): the global file and `~/AGENTS.md` are byte-identical,
  so 7,169 of 14,338 bytes would be a second copy.
- A repo file against the user file: 0 matching lines and 0 matching instructions in
  `core` and in all six sampled repos, in both harnesses. The rule finds exact repeats
  only. `core`'s `CLAUDE.md` restates user-scope rules in other words, and the count does
  not see that.
- Skill listing, from files: 26 of `core`'s 76 repo skills carry the name of a user-scope
  skill (the user-scope entries are links to them); 12 of 45 in `daily-logger`; 7 of 34
  in `GroupThink`.
- Across harnesses: the three first-prompt hook scripts are the same files in both.

**Smallest and largest in the sample of six.**

| Measure | Smallest | Largest |
|---|---|---|
| Claude Code, instruction files plus memory index, files today | 6,940 bytes, 109 lines, 30 instr.: the repo with no rules file | 20,328 bytes, 334 lines: `daily-logger` |
| Claude Code, configured parts, record (4 repos) | 45,635 bytes: `lego-village-pipeline`, 2026-10-21 | 52,978 bytes: `daily-logger`, 2026-10-17 |
| Claude Code, first-request tokens, record (4 repos) | 85,253: `cv-builder`, 2026-09-24 | 97,163: `daily-logger`, 2026-10-17 |
| Codex, instruction block, files today | 7,169 bytes, 109 lines, 30 instr.: three repos (no `AGENTS.md`, not trusted, or both) | 15,668 bytes, 264 lines, 49 instr.: `daily-logger` |
| Codex, configured parts, record (3 repos) | 35,747 bytes: `cv-builder`, 2026-10-03 | 41,459 bytes: `daily-logger`, 2026-11-25 |

`core` is outside the sample and above it on every row: 50,553 bytes of instruction files
plus memory index from today's files, 80,516 bytes of configured parts in its record. The
recorded rows compare starts from different dates and harness versions.

**All 55 repos, files today.** Claude Code, user file plus repo files: 6,940 bytes in the
14 repos with no rules file, median 9,459, maximum 40,314 (`core`; next is `virtualLight`
at 22,138); 109 to 500 lines; 30 to 73 instructions. Codex: 7,169 bytes in 47 of 55 repos
(45 hold no `AGENTS.md`, 2 hold one in a project Codex does not trust), maximum 15,668
(`daily-logger`; next is `morning-cockpit` at 14,474). Memory index: 18 index files, 168 to
20,839 bytes, median 1,284, at most 173 lines.

## 7. What differs between the harnesses

| | Claude Code (Yuri Mac) | Codex (Yuri Mac) |
|---|---|---|
| First request, November | Median 91,048 input tokens (30 starts) | Median 34,365 (15 starts by a person) |
| Trend since records begin | Median 37,459 in June to 91,048 in November | 34,810 in September to 34,365 in November |
| User-scope instruction file | 6,933 bytes reach the model (7,178 on disk) | 7,168 bytes reach the model (7,169 on disk) |
| Parent folders | Walks up from the start folder; stops at the checkout root | Walks down from the project root; outside a repo reads the start folder only |
| The other harness's file | Loads `AGENTS.md` where no `CLAUDE.md` is beside it (inferred) | Not configured to read `CLAUDE.md` |
| Trust | None needed for instruction files | Repo files load only in a trusted project: 8 of the 10 repos with `AGENTS.md` |
| Memory index | Loads; 315 to 20,608 bytes in records | None on this Mac |
| Skill listing | About 30,000 bytes at most; descriptions dropped past roughly 100 skills | About 22,250 or 40,450 bytes |
| Repo skills | A repo's `.claude/skills` joins the listing (up to 354 listed) | Only `.agents/skills`, in 3 repos |
| Tool definitions | 118 to 136 KB in 49 to 52 definitions, plus 243 to 346 held-back names | 20 to 92 KB |
| What the record keeps | File path, kind and text of each instruction file | Merged text and a folder; no file names |
| Record window | Instruction lists from 2026-09-10 (77 days); full requests from 2026-10-27 (30 days) | 2026-09-18 on (69 days) |
| Sessions the record misses | SDK starts load almost nothing and are 7 of 173 | Runs in an ephemeral mode leave no file |

**Links into the checkout.** 22 of the 28 entries in `~/.claude/skills` are links into the
`core` checkout, and 7 of the 10 user-scope hook entries name a script by path under it. What a start loads
from them is the checkout as it stands on whatever branch it is on, not `main`. This file
read the worktree copies, so its files numbers for user-scope skills can differ from what a
session read.

## 8. Proposed wording

For the conductor to apply. Nothing here was edited.

### Map: Notes, "Load records found after the census"

- **Now** "Loading is recorded: the Claude Code tool ledger stamps repo and working
  directory on every tool call; Codex session files store the merged instruction text and
  its directory"
  **Proposed** "Loading is recorded: the Claude Code tool ledger stamps repo and working
  directory on every tool call; on the Yuri Mac, Claude Code transcripts from 2026-09-10
  also list each instruction file loaded at start with its path and text, and the memory
  index with it (69 of 173 kept transcripts on 2026-11-25), and from 2026-10-27 they keep
  the system prompt and tool definitions of the first request (32 transcripts); Codex
  session files store the merged instruction text and its directory"

### Map: Notes, "What the second vantage changes"

- **Now** "What a session loads at start differs by host as well as by harness: the
  user-scope rules file is 7,178 bytes on the Yuri Mac and 3,899 on Yojimbo, and Codex has
  a global file on the first and none on the second."
  **Proposed, added after it** "On the Yuri Mac (2026-11-25) 6,933 of the 7,178 bytes
  reach a Claude Code session, and since 2026-11-12 Claude Code also loads `~/AGENTS.md`
  (6,924 bytes) at every recorded start outside a Git checkout (28 starts), so those starts
  carry the user-scope rules twice. That file is in no count of repo rules files. Whether
  Yojimbo has one was not measured."

### Map: Decisions so far (new entry)

- **What does one session load at start, in each harness?** (#748) Closed 2026-11-25. On
  the Yuri Mac, a Claude Code session started by the desktop app in the home folder sent
  247,743 bytes and 92,967 input tokens before its first reply (record, 2026-11-25);
  instruction files are 13,857 bytes of that, and the system prompt and tool definitions
  165,543. A Codex session started in `~/ojfbot` sent 116,544 bytes and 29,204 tokens
  (record, 2026-11-20); none has started in the home folder. Recorded starts carry 103 to
  488 lines of instruction files, never the 4,996. The skill listing is held near 30,000
  bytes in Claude Code and near 22,250 or 40,450 in Codex, whatever the number of skills.
  Claude Code's median first request grew from 37,459 tokens in June to 91,048 in
  November; Codex's stayed near 35,000. Yojimbo and other launch modes are not measured.
  See [session-load-2026-11-25](../research/session-load-2026-11-25.md).

### Map: Tickets table

- **Now** "What does one session load at start, in each harness? (#748) | research | — | open"
  **Proposed** the same row with status "closed".

### Map: Not yet specified, third bullet

- **Proposed, added to the bullet** "A further case: on the Yuri Mac a session of either
  harness that starts above the repos (32 of 75 Claude Code starts and 71 of 317 Codex
  starts in 90 days) loads no repo rules file at start, and the tool ledger then credits
  the repo once the session works in it."

### Draft ADR `staleness-kinds-and-signals`: Context table

- **Now**, row "Rules files", column "Record that exists today": "Claude Code: none naming
  the file, but `tool-telemetry.jsonl` stamps repo and working directory on every tool
  call."
  **Proposed** "Claude Code: on the Yuri Mac, transcripts from 2026-09-10 name each file
  loaded at start, with its text (69 of 173 kept transcripts on 2026-11-25); nothing
  earlier names the file, and `tool-telemetry.jsonl` stamps repo and working directory on
  every tool call."
- **Now**, row "Memory files": "Index load: none. A file opened with `Read`: logged"
  **Proposed** "Index load: listed in the same transcript record, as a file with its path
  (Yuri Mac, from 2026-09-10). A file opened with `Read`: logged"

### Draft ADR: Evidence, "Limits of these measurements"

- **Now** "**The Claude Code load record is a proxy.** "A session worked in the repo" is
  not "the repo's rules file loaded"."
  **Proposed** "**The Claude Code ledger record is a proxy.** "A session worked in the
  repo" is not "the repo's rules file loaded". A direct record exists in transcripts on the
  Yuri Mac from 2026-09-10 (77 of the 90 days on 2026-11-25); the ADR's counts do not use
  it yet."
- **Proposed, new limit** "**One file can be read by both harnesses.** On the Yuri Mac,
  Claude Code has loaded an `AGENTS.md` as a project file in 29 recorded starts, each in a
  folder with no `CLAUDE.md`. Crediting an `AGENTS.md` only to Codex holds for the 10 repo
  files, which all sit beside a `CLAUDE.md`, as far as records go (no start in such a repo
  is recorded after 2026-10-21)."

## 9. What the budget ticket (#740) must weigh

Facts first, then questions. No budget is proposed.

**Facts (Yuri Mac, 2026-11-25, harness named in each).**

- The part the owner writes is small beside the whole. Instruction files are 5.6% of a
  Claude Code home start and 6.2% of a Codex `~/ojfbot` start. With memory index, skill
  listing and hook text the share is 21% and 28%.
- The harness already enforces two ceilings. The skill listing stops near 30,000 bytes in
  Claude Code and near 22,250 or 40,450 in Codex. Past it, in Claude Code, descriptions go:
  15% of skills keep one at 300 skills or more. Codex documents a 32,768-byte cap on
  project instruction files; 28 of 277 recorded blocks are above that figure with the
  global file included.
- The skill listing carries no mark of what was cut: a skill past the ceiling is listed by
  name alone. Whether either harness warns the user at a ceiling was not checked.
- Growth is measurable after the fact. Claude Code's median first request went from 37,459
  tokens in June to 91,048 in November. Which part grew is known only from 2026-10-27,
  when transcripts began to keep the request. The hook roster grew from a median of 773
  bytes to 3,217 over the same months.
- The start folder moves the total less than the launch mode does: 87,036 to 101,237
  tokens across November desktop starts, against 3,288 to 4,421 for SDK starts and 72,112
  for one terminal start.
- A unit matters. One byte of Claude Code request cost about 1.5 times the tokens of one
  byte of Codex request in these records (2.7 against 4.0 bytes per token).
- Duplication is concentrated in one place: `~/AGENTS.md` against the user file, loaded
  together by Claude Code outside a checkout (6,738 duplicate bytes).
- `core` is the outlier among repos: 40,314 bytes of instruction files against a median of
  9,459, and a 10,239-byte memory index.
- The count of distinct instructions by this file's rule: 30 in the user file alone; 66 to
  73 with `core`; 536 in a whole Claude Code home start and 290 to 317 in a whole Codex
  start, most of them in tool descriptions and the system prompt.

**Open questions.**

- Which total does a budget bind: the configured parts the owner controls, or the whole
  first request, most of which the harness and the connectors decide?
- In what unit: bytes, lines, instructions by a stated rule, or the harness's own token
  count? Only the token count is recorded by both harnesses for every start.
- Is a budget set per harness and per launch mode, given a difference of two to three times
  between the two harnesses and of twenty times or more between desktop and SDK starts?
- Do connectors, plugins and the desktop app's own skills fall under it? They are 96 of
  125 listed skills and 32 of 52 tool definitions at home, and no rules file controls them.
- Does a budget count what loads after the first prompt? Sessions that start above the
  repos take on a repo's rules file later, and this ticket did not measure that.
- Is the skill-listing ceiling a budget already in force, and is a skill listed without a
  description still loaded in the sense the map means?
- Who would see a breach? The records that show growth are read by nothing today.
- Does the second host need its own figure before any number is set? Its user file is
  3,899 bytes and it has no Codex global file; nothing else in this file is known there.

## 10. Not measured

- **Yojimbo, the NAS and every other host.** Nothing in this file was measured there. A
  request for the same pass on Yojimbo was drafted for the conductor and not sent.
- **Other launch modes.** One terminal start and seven SDK starts are in the records; none
  was studied beyond its token count and instruction list. Worker-launched sessions, cloud
  sessions and Codex runs in an ephemeral mode were not measured.
- **A Codex start in the home folder.** None exists. Its row is from files only, and
  whether Codex would load `~/AGENTS.md` a second time there was not observed.
- **A Claude Code start, since 2026-11-12, in a repo with both rules files or with
  neither.** None exists, so the `AGENTS.md` rule in §4.2 is inferred, not confirmed.
- **A Claude Code start in `core` after 2026-10-10 and a Codex start in `core` after
  2026-10-21.** The `core` rows are records of the files as they were, plus today's
  worktree files.
- **The `core` checkout.** Its settings, its Codex hooks, its branch and whether its files
  match this worktree. Repo-scope hook entries for `core` are not in §3.4.
- **Loads after the first prompt.** Nested rules files, a repo's rules file loaded on
  entering it, memory files opened later, skill bodies, tool results.
- **Which parts grew between June and October.** Transcripts before 2026-10-27 keep no
  system prompt or tool definitions, and before 2026-09-10 no instruction list.
- **Token counts per part.** Only the total of the first request is recorded.
- **Text the plugin hooks and the `SessionStart` hook add.** None appears in a record;
  whether they ran was not checked.
- **Where the 96 unmatched Claude Code skills and the 59 or more unmatched Codex skills
  are defined**, beyond a count of files in the desktop app's support folder.
- **Whether the memory index is cut at a size.** The largest is 20,839 bytes and 173
  lines; no record shows a cut.
- **Reliance.** Whether the model used any of what loaded.
- **Subagents and review threads.** 2,396 Codex files and Claude Code subagent
  transcripts were skipped; what they load at start was not measured.
- **Paraphrased duplication.** The duplicate counts see exact repeats only.

## Appendix: methods

All scripts are read-only, print sizes, counts, dates and paths only, and were run as
`python3 -I`. They list `~/ojfbot`, skip `core` by path and read it from this worktree; a
guard in `measure.py` refuses any read under the checkout. They are held outside the repo
with the session's notes, in a folder named `session-load-2026-11-25`.

- **`cc_scan.py`** → one line per Claude Code transcript: start folder, version, launch
  mode, date, and the size of each start record. **`cx_scan.py`** → the same for each
  Codex session file, with its import flag and thread source. Both stop at the first model
  output.
- **`count_rule.py`** holds the counting rule of §4.3. `python3 -I count_rule.py <file>`
  prints bytes, lines, statements, instructions and distinct instructions for one file.
- **`measure.py`** → for each start point, the parts from the latest record and the parts
  assembled from files, in both harnesses, with totals and duplicate lines. Its output is
  the source of §1, §2, §3.1, §3.2, §5 and §6. **`table.py`** groups that output.
- **`activity.py`** → recorded starts per repo in the window, for the sample rule.
- **`extras.py`** → skill-listing sizes over all records, the 55-repo figures, memory
  index sizes, launch modes and start folders. **`last_pass.py`** → first-request tokens
  by month, `AGENTS.md` loads, hook events and roster sizes, and the ranges in §3.1 and
  §3.2.
- Shell: `stat` for the dates of `~/AGENTS.md`; `git ls-files '*CLAUDE.md' '*AGENTS.md'
  '.claude/rules/*'` per repo for nested rules files; `find` for `SKILL.md` under the
  desktop app's support folder, counted by folder.
- To re-run: `cc_scan.py OUT`, `cx_scan.py OUT`, `activity.py`, then `measure.py OUT`,
  `extras.py`, `last_pass.py`. The whole pass takes under a minute. The transcript and
  session-file formats are not documented interfaces and changed twice inside the window.
