---
type: research
ticket: "Which findings so far hold on the other host and in the other harness?"
map: decisions/wayfinder/staleness-and-retirement.md
date: 2026-11-25
vantage: "Two vantages, kept apart. (1) Yuri's Mac (Yuri.local), 2026-11-25, one pass: Claude Code and Codex on that Mac, origin/main at bc7b5df read through one worktree, and a few read-only GitHub API calls (listed in the appendix). (2) Yojimbo, 2026-11-25: one run of the same probe by that host's conductor, from Claude Code, core at bc7b5df (its local origin/main ref, not fetched), the vault excluded by the owner; read from its answer, not observed by this session. The NAS and every other context in §1 are not measured."
---

# Second vantage, 2026-11-25

Each finding on the map so far, with where it was measured and whether it holds anywhere
else. Nothing was fixed, retired or changed. Every number was **measured** today on the
Yuri Mac with the method shown, unless it is marked *inferred* or *not re-measured*.
Numbers for Yojimbo come from one answer by that host's conductor, received the same day
(§3.8). Each carries that host's name. No number from one host is used for the other, and
where the two differ both are given.

**Verdicts.** *holds* = re-measured in that context and the same. *differs* = re-measured
and not the same. *not checkable from here* = the check needs a write, a login, a new
permission or a place this session may not read. *not checked on the owning host* = the
owning host was asked and did not check it; the reason is given. *no signal* = the record
the finding rests on does not exist on that host, so the finding neither holds nor differs
there. *does not arise* = the thing the finding is about is absent on that host. *not
asked* and *not measured there* = the request or its probe did not cover it.
"None found" always means none found by this method, on the host named.

**Privacy.** Counts, dates, config paths and repo names that `main` already names. No
text of a memory file, vault page, rules file, prompt or session. One repo that `main`
does not name is left unnamed. Yojimbo's answer lists repo names, some of them private:
for that host this file gives counts only and names no repo but `core`.

**Off limits.** The `core` checkout was not used. `core` files were read from this
worktree. One test run broke that rule by mistake; see §6.

## 1. Contexts found

The brief expected two hosts and two harnesses. The fleet's own documents and this Mac's
config directories show more. "How found" is the evidence, not an assumption.

### Hosts

| Context | How found | Measured here? |
|---|---|---|
| Yuri Mac | `hostname` = `Yuri.local`; `decisions/loops/loops.md` on `origin/main` says "each Mac (Yuri, Yojimbo)" | Yes. This file |
| Yojimbo (a second Mac) | `loops.md` (same line); `decisions/wayfinder/control-plane-conductor.md` ("Yojimbo hosts…"); `decisions/fleet-runner/release-one-g0-g2.md` ("the Yojimbo coordinator"). The map says it owns the vault pipeline | Not by this session. One probe run by its conductor on 2026-11-25, the vault left out (§3.8) |
| A FleetRunner coordinator with a live job table | Yojimbo's answer: its tracked job files were searched, "its live job table on the server was not queried" | No |
| A NAS | 11 files under `decisions/` name it (`git grep -l -w NAS origin/main -- decisions domain-knowledge`), among them `decisions/fleet-runner/release-one-nas-qualification.md` | No |
| `selfco-box` (an earlier always-on vault host) | 22 files on `origin/main` name it; `loops.md` calls it "Pi-host era automation, parked"; two `.disabled` LaunchAgents on this Mac carry its name | No. Parked, per the registry |
| GitHub Actions runners | 6 of 35 loops in `loops.md` have `trigger: gh-actions` | No. Workflows were not read |
| A private Git remote of the vault | `implementation-notes.md` (entries of 2026-08-03) describes commits and pushes of the vault; the GitHub API lists a private repository for it | Partly: last commit date and page count only (§3.1) |
| The shared `telemetry/daily` branch | `loops.md`, loop `sync-telemetry` | Partly: file list and last writer only (§3.7) |
| Chat clients (web, desktop and phone apps) | `decisions/adr/0070-vault-multi-surface-access.md` says a skill is uploaded to them by hand and must be re-uploaded to stay current | No. The map lists them under "Not yet specified" |

### Harnesses and launch modes on this Mac

| Context | How found | Measured here? |
|---|---|---|
| Claude Code (terminal and desktop app share `~/.claude`) | `~/.claude/settings.json`, ledgers, 410 transcript files | Yes |
| Codex, three originators | `session_meta.originator` in 2,967 session files: 2,730, 235 and 2 | Yes |
| Codex sub-sessions | `thread_source`: 1,959 automatic review threads and 428 subagents, against 125 started by a person | Yes, counted apart |
| Sessions Codex imported from Claude Code | `~/.codex/external_agent_session_imports.json`: 263 records, every `source_path` under `~/.claude/projects/` | Yes (§3.4) |
| Worker-launched sessions | `decisions/fleet-runner/` and `packages/native-dispatch` describe workers that start a harness with a restricted surface | No |
| Codex runs that leave no session file (an ephemeral mode) | Yojimbo's answer says such runs happened there through 2026-11-25. Here: 0 files on `origin/main` and 0 rows of this Mac's tool ledger contain `--ephemeral` | No, on either host. No session count includes them |
| Cloud sessions | Not named on `main` (`git grep` for "cloud session", "Codex cloud": 0 files under `decisions/` and `domain-knowledge/`). This session's own tooling offers a cloud target for Claude Code; Codex cloud tasks were not looked for | No |

### Plugin-supplied items on this Mac

| Context | How found | Count |
|---|---|---|
| Claude Code plugins | `enabledPlugins` in `~/.claude/settings.json`; `~/.claude/plugins/installed_plugins.json` | 12 enabled; 1 ships hooks (9 entries); 51 `SKILL.md` in installed plugin folders |
| Codex plugins | `[plugins]` in `~/.codex/config.toml`; `~/.codex/plugins/cache` | 22 enabled; 1 ships hooks (9 entries in its file, 12 trust records); 149 `SKILL.md` in the cache |

### Scheduled runners on this Mac

| Runner | How found | Count |
|---|---|---|
| launchd | `ls ~/Library/LaunchAgents` | 21 files, 2 ending `.disabled` |
| cron | `crontab -l` | No crontab |
| Codex automations | `~/.codex/automations/*/automation.toml` | 8: 3 `ACTIVE`, 5 `PAUSED` |
| Claude scheduled tasks | The desktop app's own list tool | 0 |
| GitHub Actions | `loops.md` | 6 loops; not on this Mac |

On Yojimbo (2026-11-25, its conductor's run): 13 LaunchAgents files, none ending
`.disabled`; 0 crontab lines; 1 Codex automation, `PAUSED`; 2 Claude scheduled tasks (1
enabled weekly, 1 disabled one-shot); the system launchd folders are empty.

### Checkouts on this Mac

55 directories under `~/ojfbot` hold a `.git` directory. 13 more hold a `.git` file, and
73 worktrees sit under `.worktrees` or a repo's `.claude/worktrees` (those of `core` not
listed). Together the 86 extra checkouts hold 70 `CLAUDE.md` and 24 `AGENTS.md` copies
that no count below includes. `~/.codex/worktrees` was not counted.

On Yojimbo (2026-11-25): 50 directories with a `.git` directory and 16 with a `.git`
file. Worktree copies there were not counted.

### Time windows

| Record | Window | Note |
|---|---|---|
| Claude Code tool ledger | 2026-04-07 to 2026-11-25, live | "Last 90 days" starts 2026-08-26 in the census, 2026-08-27 today |
| Codex session files | 2026-09-18 to 2026-11-25 | 22 of the 90 days have no Codex record. In every repo but one, the first native session is 2026-09-30 or later |
| Claude Code transcripts kept on disk | Oldest file 2026-06-29; first typed slash command 2026-07-22 | |
| `skill-telemetry.jsonl` | 2026-04-08 to 2026-10-20 | Stopped |
| Codex log database | Six days | Not used |
| Yojimbo: Claude Code ledgers | None | None of the seven ledger files exists there (§3.8) |
| Yojimbo: Codex session files | 2026-10-26 to 2026-11-23 | 29 days, not 90. Runs in an ephemeral mode leave no file |

## 2. Findings table

"Here" is the Yuri Mac. Details and commands are in §3. Columns four and five are other
contexts on the same Mac. Column six is the owning host, Yojimbo, as its conductor
reported it on 2026-11-25 (§3.8). Each cell there names the host, the harness and the
window it rests on. "State on that day" means a count of files, with no window.

| # | Finding as stated | Stated in | Measured from | Other harness and plugins, here | Other method or copy, here | Owning host |
|---|---|---|---|---|---|---|
| F1 | The vault is not a Git repo, so the scanner flags 0 of 1,011 pages | Map: Notes "Facts gathered", Decisions #733. Census §9 Q1, §11.1 | `~/selfco` here, 2026-11-24, worktree copy of `lint.py` | Does not apply | *holds* on re-run. *differs* for the Git remote: it has history to 2026-10-29 and 879 wiki pages (§3.1) | *not checked on the owning host* (owner excluded the vault on 2026-11-25; to be handled separately). Yojimbo, 2026-11-25: no Git command was run in the vault |
| F2 | Even a working age test would flag no page | Census §9 Q1 (counterfactual on file times) | File times of this copy | Does not apply | *not checkable from here*: real Git ages need a clone | *not checked on the owning host* (owner excluded the vault on 2026-11-25; to be handled separately) |
| F3 | No live process reads the scanner's report | Map: Notes (clause has no host), Decisions #733. Census §9 Q2 | launchd, crontab, 8 Codex automations, vault folders, here | *holds*: Codex run tables and Claude scheduled tasks now checked (§3.2) | *holds*: the vault's Git remote has 0 workflow files | Yojimbo, 2026-11-25, state on that day. *holds* for host schedulers: no match in 13 LaunchAgents files, 0 crontab lines, 1 Codex automation, 2 Claude scheduled tasks or the tracked FleetRunner job files. Vault-side files: *not checked on the owning host* (owner excluded the vault on 2026-11-25; to be handled separately). FleetRunner's live job table: not queried (§3.8) |
| F4 | 1,011 wiki pages; 50 inline stamps; 96 "as of" dates; 3 `superseded_by`; 3 exemptions | Map: Notes. Census §8 | This copy, 2026-11-24 | Does not apply | *holds*: 1,011, 50 and 96 all reproduce; 50 and 96 are two patterns (§3.1). Remote copy *differs*: 879 pages | *not checked on the owning host* (owner excluded the vault on 2026-11-25; to be handled separately) |
| F5 | 770 of 1,011 wiki pages never read (census: "not reliable") | Census §8, §11.3. ADR: "no signal today" | Claude `Read` rows only | *differs*: 256 of the 770 are named in Codex command text | *differs*: 137 of the 770 are named in Claude Bash rows; 413 are in none of the three records (§3.6) | *not checked on the owning host* (owner excluded the vault on 2026-11-25; to be handled separately). No tool ledger exists there either |
| F6 | 66 of 77 skills unused in 90 days; 40 never | Map: Decisions #733. ADR Evidence. Census §5, §11.4 | Claude `Skill` calls in the tool ledger, here | *differs*: 56 of today's 65 were opened by a Codex root session; 9 of 77 have neither record (§3.3) | *holds* for typed slash commands: 0 of the 65. Re-run today: 65, not 66 (ledger is live) | Yojimbo, 2026-11-25. Claude Code: *no signal*, no ledger exists there. Codex, 802 session files, 2026-10-26 to 2026-11-23 (29 days): 13 catalogue skills named by a root session, 8 of them among the 65, none among the 9 (§3.8) |
| F7 | 77 catalogue entries; 76 skill folders; 28 entries in `~/.claude/skills` | Census §5 | This worktree and this home folder | *differs* (denominator): 6 entries in `~/.agents/skills`, 3 in `~/.codex/skills`, 3 repos with `.agents/skills`, 51 and 149 plugin `SKILL.md` | Not re-measured beyond the counts | *differs* (Yojimbo, 2026-11-25, state on that day): 77 catalogue entries at the same commit; 27 entries in `~/.claude/skills`; `~/.agents/skills` absent; 3 in `~/.codex/skills`; 1 repo with `.agents/skills`; 6 and 93 `SKILL.md` in the two plugin caches (59 and 149 here by the same count) |
| F8 | 122 hook entries in 34 settings files | Census §4. ADR Evidence | `~/.claude/settings.json` and 33 repo `.claude/settings.json`, here | *differs* (denominator): 9 plugin entries in Claude Code; 27 Codex entries. 158 in all (§3.5) | *holds*: 122 and 34 reproduce; 0 entries in 16 `settings.local.json` files | *differs* (Yojimbo, both harnesses, 2026-11-25, state on that day): Claude Code 10 user entries and 49 in 14 repo files, 59 in 15 files; 9 plugin entries; Codex 0 at every scope. 68 in all |
| F9 | 1 of 122 hook script paths does not resolve | Census §4. ADR Evidence | Claude Code entries, here | *not checkable from here*: all 14 repo Codex entries name `$CLAUDE_PROJECT_DIR`; whether Codex sets it was not tested | Not re-measured | *not measured there*: the probe counts entries and resolves no script path |
| F10 | Of 14 repo-scope Codex hook entries, "9 in projects Codex does not trust" | ADR Evidence | `~/.codex/config.toml`, here | *differs* (wording): 9 have no hook trust record; 3 of the 9 are in an untrusted project, 6 in trusted projects (§3.5) | — | *does not arise* (Yojimbo, Codex, 2026-11-25): 0 repo-scope Codex hook entries, 0 hook trust records, 10 of 10 listed projects trusted |
| F11 | Of 112 repo-scope Claude hook entries: 32 in active repos, 72 idle, 8 never | ADR Evidence | Tool ledger, here | Does not apply | *holds*: 32, 72, 8 | *no signal* (Yojimbo, Claude Code, 2026-11-25): 49 repo-scope entries in 14 files and no tool ledger to split them by |
| F12 | 53 rules files, 4,996 lines | Map: ticket text of #748. Census §3 | Four paths at each repo root, plus 2 user files, here | *differs* (denominator): Codex's global file `~/.codex/AGENTS.md` is a third user-scope path with the same bytes as `~/AGENTS.md` | *holds*: 51 + 2 files, 4,778 + 218 lines. *differs* by search method: 5 nested files, 1 `.claude/rules` file, 2 rules files in the vault, 94 worktree copies (§3.4) | *differs* (Yojimbo, 2026-11-25, its checkouts as they stood): 46 files in 40 repos, 4,308 lines; 1 user-scope file, 3,899 bytes against 7,178 here; `~/AGENTS.md` and `~/.codex/AGENTS.md` absent; 8 nested files, 1 `.claude/rules` file. Vault rules files: *not checked on the owning host* (owner excluded the vault on 2026-11-25; to be handled separately) |
| F13 | 25 of 51 repo rules files loaded by either harness in 90 days; 22 by neither; 4 never. Map: "26 of 51 … loaded by neither" | ADR Evidence. Map: "Not yet specified" | Tool ledger and Codex session start directories, per repo, here | *differs*: per file, 21 have a load record and 30 have none (§3.4) | *differs*: 263 Codex session files are imports, not Codex runs | Yojimbo, 2026-11-25, 46 files. 39 `CLAUDE.md`: *no signal*, no ledger exists there. 7 `AGENTS.md`: 2 with a Codex text record, 5 in repos where no session file starts (Codex, 2026-10-26 to 2026-11-23, 29 days, not 90). 0 imports |
| F14 | More than half of Codex session files start above any repo and record only the global text; files begin 2026-09-18 | ADR "Limits". Map: Notes "Load records" | Codex session files, here | *holds*: 1,657 of 2,967 start at `~/ojfbot` (1,579 of 2,704 native), none with text beyond the global file | Add: 592 files record no instruction text at all | *differs* (Yojimbo, Codex, 802 native files, 2026-10-26 to 2026-11-23): 62 start at `~/ojfbot`, 504 outside it, 236 in four directories under it; 114 record instruction text; no global file exists there; files begin 2026-10-26 |
| F15 | 139 memory files in 24 folders (ADR: 140) | Census §6. ADR Evidence | `~/.claude/projects/*/memory`, here | *holds* in kind: Codex memory is empty (0 rows, no folder). 3 automation `memory.md` files are not in the census | Re-run: 143 files, 18 index files, 24 folders (store is live). "10 files in 8 folders with no transcript" *not re-measured* | *differs* in count, *holds* in kind (Yojimbo, both harnesses, 2026-11-25): 38 files, 4 index files, 14 folders; Codex memory 0 rows, no folder, 0 automation `memory.md` |
| F16 | 98 of 133 beads never read | Census §7. ADR Evidence and signal table | Claude `Read` rows matched to this worktree's paths | 2 of the never-read are named in Codex command text | *differs*: the 67 `core` beads were listed by worktree path and could not match. 68 to 69 of 133 were opened; 64 to 65 never (§3.6) | Yojimbo, 2026-11-25. Count *differs*: 145 beads in 14 repos. Reads: *no signal*, no ledger exists there; the probe's "0 of 145" is not "never read" |
| F17 | No usage ledger for rules files, hooks, memory; "two ledgers that did exist stopped being written" | Map: Notes, Decisions #733. Census §5, §10 | `~/.claude/*.jsonl`, here | *differs*: the suggestion ledger holds 9,510 Codex rows of 15,168; the tool, skill and session ledgers hold 0 | *differs*: three ledger files have stopped, not one (§3.7) | *differs* (Yojimbo, Claude Code, 2026-11-25): none of the seven ledger files exists and the sync LaunchAgent is not installed. Nothing stopped there; nothing is written |
| F18 | Registry says `selfco-vault-hygiene` is `live`; its automation file says `PAUSED` | Map: "Four defects". Census §9 Q2, §11.2 | `origin/main` registry; this Mac's `~/.codex/automations` | Does not apply | *holds* here. The registry row names no host (§3.2) | *differs* (Yojimbo, Codex, 2026-11-25): no automation of that name exists there; its one automation is another, `PAUSED`. FleetRunner's tracked job files hold no match; its live job table was not queried |
| F19 | Six `.Codex/...` paths in `AGENTS.md` files resolve to nothing; `install-agents.sh` has no Codex handling | Map: "Four defects". Census §11.6 | 11 `AGENTS.md` files here; a case-insensitive file system | Does not apply | *holds* here: 6 do not resolve, 1 resolves only because case is ignored. Installer: *holds* on `origin/main` (0 matches in 794 lines). 5 of the 6 files that hold such a path are untracked or outside any repo (§3.4) | Yojimbo, 2026-11-25: file system ignores case, as here; `~/AGENTS.md` and `~/.codex/AGENTS.md` absent; 7 repo `AGENTS.md`, all tracked. Whether a `.Codex` path in them resolves: *not measured there*. Installer: *holds* for its `core` checkout, which is at the commit read here |
| F20 | `skill-telemetry.jsonl` not written since 2026-10-20 | Map: "Four defects". Census §5 | This Mac's file | *holds*: 0 Codex rows in it | *holds*: last row 2026-10-20 | *differs* (Yojimbo, Claude Code, 2026-11-25): the file does not exist there |
| F21 | The scanner returns "not stale" for every page when the vault has no Git history | Map: "Four defects". Census §9 Q1 | Reading `lint.py` (last changed in commit 336ebe7) | Does not apply | *holds* for that version. The wrapper scripts run whatever the `core` checkout holds (census §11.8) | *not checked on the owning host* (owner excluded the vault on 2026-11-25; to be handled separately): the scanner was not run. Yojimbo, 2026-11-25: its `core` checkout is at bc7b5df and `lint.py` was last changed in 336ebe7, the version read here |
| F22 | *Unused* is marked by "no load record in the window, in either harness" | ADR Decision 2. Map: Decisions #737 | Records on one Mac | *differs* as computed: the skills row counts one harness (F6) and the rules row credits the wrong harness per file (F13) | *differs* as computed: the beads row is bound to one checkout path (F16) | *differs* (Yojimbo, 2026-11-25): the signal cannot be computed there. Claude Code keeps no ledger; Codex session files cover 29 days and omit ephemeral runs. Every item has "no load record in the window" and none can be called *unused* (§5) |
| F23 | Nothing, on any surface the check could see, retires an item | Map: Notes "Why this map exists" | `main` and this Mac, Claude Code side | Not re-searched beyond config: the Codex memory store is empty and no automation prompt was read | — | *not asked*: the request held no question on retirement. Not measured on Yojimbo |

### Wording checks on the two outside-practice files

The research was not redone. "Nothing published" in these lines means nothing found in the
pages read: 15 pages from 13 publishers and 14 pages from 11 publishers, all read on
2026-11-24.

| # | Line | Stated in | Verdict |
|---|---|---|---|
| W1 | "Nothing, here or in published practice, detects a claim that is untrue in general." | Map: Notes. ADR: Context | Says more than was read. "Here" is `main` and one Mac |
| W2 | "Only agent memory is removed without a person in published practice." | Map: Notes | Says more than was read |
| W3 | "Published practice is silent on: retiring hooks; …" | Map: Notes | Says more than was read |
| W4 | "No study measures pruning a rules file." | Map: Decisions #734 | Says more than was read |
| W5 | "No study covers LLM-maintained wikis, and nothing handles a kept source that has aged." | Map: Decisions #735 | Says more than was read |
| W6 | "Only memory expires." ("Expiry on rules, skills or hooks") | Instructions research §6 | Says more than was read |
| W7 | "No source measures one choice against another." "No source describes retiring a hook." | Map: Notes. Instructions research §6 | Fine: "source" is bounded by the list of sources read |

## 3. What was measured, and how

### 3.1 The vault and the scanner

- **Here.** `ls -ad ~/selfco/.git`: no such file. `git -C ~/selfco rev-parse`: "not a git
  repository". `find ~/selfco/wiki -name '*.md' | wc -l` = 1,011 (458 sources, 197
  entities, 176 concepts, 175 synthesis, 5 hub files).
- **Scanner.** `PYTHONDONTWRITEBYTECODE=1 python3 -I .claude/skills/vault/scripts/lint.py ~/selfco/wiki --stale`
  from this worktree: 1,011 pages, 0 orphans, 0 broken links, 198 raw items with no source
  page, **0 stale pages**. Files in `~/selfco` changed today, before and after: 0 and 0.
- **Stamps.** Pages matching `\(as of \d{4}-\d{2}`: 50. Pages matching `\bas of 20\d{2}-\d{2}`
  in any case: 96. The map's 50 and the census's 96 are both right. They are two patterns.
- **A Git copy exists elsewhere.** `gh repo list` shows a private repository for the vault.
  `gh api repos/…/commits?per_page=1`: last commit **2026-10-29**. Its tree holds **879**
  files matching `wiki/**/*.md` and 0 workflow files. This Mac's copy has 1,011 pages and
  the newest was changed on 2026-11-16. So Git history exists for the vault up to
  2026-10-29, the copy here holds 132 more pages than the remote, and which host pushed
  is not known from here.
- **Not done.** The remote was not cloned (a download and a write), so the scanner was not
  run against real Git ages.

### 3.2 Readers of the report, and the hygiene loop

- **Schedulers here.** No LaunchAgents file names `vault-stale`, `lint.py`,
  `maintenance-report`, `_lint-report` or `--stale` (21 files searched). No crontab. Of 8
  Codex automations, one prompt names `_lint-report`: `selfco-vault-hygiene`, which is
  `PAUSED`. The census searched three of those five strings and found none; the wider
  pattern finds this one.
- **Codex run tables** (the census listed them as not checked). Opened read-only with
  `immutable=1`, so rows still in a write-ahead log are not counted. `automation_runs`
  holds 0 rows for the hygiene automation in both databases. It is of kind `heartbeat`.
  The `automations` row says last run **2026-10-26** in `codex-dev.db` and null in
  `codex.db`. Run rows are in `codex-dev.db` up to 2026-11-17 and in `codex.db` from
  2026-11-18. So "never fired" and "last ran on 2026-10-26" are both readable here,
  depending on the file.
- **Claude scheduled tasks** (also listed as not checked): 0 on this Mac.
- **Report file.** `wiki/_lint-report.md` last written 2026-10-26. `wiki/log.md` has 24
  lines naming the report, dated 2026-06-07 to 2026-10-26.
- **The registry row.** `selfco-vault-hygiene` in `loops.md` on `origin/main`:
  `status: live`, `trigger_ref: ~/.codex/automations/selfco-vault-hygiene/automation.toml`.
  The registry has no host field. A home-relative path names a different file on each
  host. The row cannot be called wrong from one Mac.
- **A second Mac, 2026-11-25.** Yojimbo reports no automation of that name (§3.8). So the
  file the row points to is `PAUSED` on one Mac and absent on the other. FleetRunner's
  live job table and the NAS were not read, so the row is still not shown wrong; it is
  matched by nothing found on either Mac.

### 3.3 Skills

- **Re-run of the census count.** `Skill` rows in `~/.claude/tool-telemetry.jsonl` since
  2026-08-26: 65 of 77 catalogue skills have none (66 on 2026-11-24; the ledger is live).
  40 have none ever. `~/.claude/skills`: 18 of 28 have none since the cut (19 yesterday).
- **Codex, same Mac.** For each native root session (not a review thread, subagent or
  import), take tool-call inputs only, never outputs, and match
  `skills/<name>/SKILL.md`. Of the 65 skills with no Claude `Skill` call, **56** are named
  that way in at least one session and 33 in three or more. **9 of 77** have neither a
  Claude `Skill` call nor a Codex read. This is a weaker signal than a `Skill` call: a
  `cat` during an audit counts. It is the only Codex signal there is, because Codex opens a
  skill by reading its file.
- **Typed slash commands** (the census listed them as not measured). `<command-name>` in
  410 kept transcripts: 10 distinct names, 7 of them catalogue skills, none typed since
  2026-08-26. The upper-bound caveat does not change the count here.
- **Denominators.** The 77 is the `core` catalogue. Not in it: 51 `SKILL.md` in installed
  Claude plugins, 149 in the Codex plugin cache, 8 in `~/.codex/skills`.

### 3.4 Rules files

- **Re-run.** Four paths at each repo root: 51 files in 41 repos (41 `CLAUDE.md`, 10
  `AGENTS.md`), 4,778 lines. With `~/.claude/CLAUDE.md` and `~/AGENTS.md` (109 lines
  each): 53 files, 4,996 lines. Matches the census.
- **Not found by that search.** 5 tracked rules files below the root in 5 repos
  (`git ls-files '*CLAUDE.md' '*AGENTS.md'`). 1 file under a `.claude/rules` folder.
  `CLAUDE.md` and `AGENTS.md` at the root of the vault, which is outside `~/ojfbot`.
  `~/.codex/AGENTS.md`, the file Codex loads as global, byte-identical to `~/AGENTS.md`.
  94 copies in worktrees.
- **Tracked or not.** `git ls-files -- <file>` is empty for **6 of the 10** `AGENTS.md`
  files. An earlier draft of this file said those six exist only in this Mac's checkouts.
  That holds for five. The sixth has a tracked `AGENTS.md`, with different bytes, on its
  repo's default branch (`git ls-tree origin/HEAD`, as last fetched); this Mac's checkout
  of that repo is behind it. Yojimbo reports 7 `AGENTS.md`, all tracked, and none in the
  five repos (§3.8).
- **By branch.** Counted on each repo's default branch as last fetched, this Mac has 7
  root `AGENTS.md`, not 10: the 4 tracked ones, the 1 above, and 2 in repos whose
  checked-out branch lacks the file. 3 of 55 repos have no remote default ref and were
  not counted. Yojimbo's 7 and this 7 are not the same seven: one of its repos has no
  checkout here. A count of `AGENTS.md` files is a fact about one host's checkouts on the
  branches they were on.
- **Which harness reads which file.** `~/.codex/config.toml` sets no
  `project_doc_fallback_filenames`, so Codex is not configured to read `CLAUDE.md`. 1 of
  41 `CLAUDE.md` files imports `AGENTS.md` with an `@` line; the other 40 do not.
- **Imports.** 263 of 2,967 Codex session files are listed in Codex's own import record
  with a source path under `~/.claude/projects/`. They are Claude Code transcripts. 259
  of them record no instruction text.
- **The disputed count, settled.** A design note credited Codex with loading two
  `lofi-beaver` rules files and also listed `lofi-beaver` among repos where no session
  recorded the file's text. The second statement is right. Both session files that start
  in `lofi-beaver` are imports; neither records any instruction text; the project is not
  in Codex's trusted list; and no native Codex session starts there. The same holds for
  `virtualLight` (1 file, an import) and `play-well-library` (5 files, all imports).
- **Per file.** A file is credited only to the harness that reads it.

  | Files | Load record since 2026-08-26 | None in the window |
  |---|---|---|
  | 41 `CLAUDE.md` | 13 (a Claude Code tool call in the repo; a proxy) | 28: 24 with an earlier record, 4 never |
  | 10 `AGENTS.md` | 8: 7 where a native Codex session in the repo records text beyond the global file, 1 through a `CLAUDE.md` import | 2: no native Codex session in the repo |
  | 51 | **21** | **30** |

  The per-repo method behind "25 loaded" reproduces only if imports count as Codex runs
  (13 repos by Claude Code, plus `lofi-beaver` and `virtualLight`).
- **A limit of the text record.** Codex stores the merged text and a directory, not file
  names. In `core`, 77 native session files (last 2026-10-21) record project text. It
  matches lines found only in today's `CLAUDE.md` and no line of today's `AGENTS.md`,
  which was first committed on 2026-11-16. Counting only text that matches today's file,
  the 21 becomes 20. A text record is evidence about the file as it was.

### 3.5 Hooks

- **Re-run.** `~/.claude/settings.json` 10 entries; 33 repo `.claude/settings.json` files
  112 entries. 122 in 34 files, as in the census. By repo activity: 32, 72 and 8, as in
  the ADR.
- **Not in the 122, on this Mac.**

  | Source | Entries | Scope |
  |---|---|---|
  | One enabled Claude Code plugin | 9 | Every Claude Code session |
  | `~/.codex/hooks.json` | 4 | Every Codex session |
  | `.codex/hooks.json` in 5 repos | 14 | Codex sessions in a trusted project, once each hook is trusted |
  | One enabled Codex plugin | 9 (12 trust records) | Every Codex session |
  | `settings.local.json`, user and 15 repos | 0 | — |

  122 + 9 + 27 = **158** entries across both harnesses. The `core` checkout's own settings
  and worktree copies are not in any of these numbers.
- **Trust.** `[hooks.state]` holds 21 records: 4 user, 12 plugin, 3 and 2 for two repos.
  The 9 entries in three other repos have no record. Of those three repos, one is not a
  trusted project and two are. So "9 in projects Codex does not trust" should read "9
  with no hook trust record".
- **Shape.** All 14 repo Codex entries name `$CLAUDE_PROJECT_DIR` in their command, and 5
  match on `Skill`. Whether either works in Codex was not tested.
- **Only here.** The 5 repo `.codex/hooks.json` files are untracked and absent from their
  repos' default branches as last fetched (`git ls-files`, `git ls-tree -r origin/HEAD`).
  Yojimbo reports 0 Codex hook entries at user, repo and plugin scope (§3.8). All 27
  Codex entries found on the two Macs are on this one.

### 3.6 Beads and wiki pages

- **Beads, re-run.** 133 top-level `.handoff/*.md` in 15 repos, as in the census.
- **The 98.** The census listed the 67 `core` beads by this worktree's path. `Read` rows
  carry the path the session used, which is the main checkout's. 0 of the 67 could match.

  | How a `Read` is matched to a bead | Opened | Never |
  |---|---|---|
  | Exact listed path (the census) | 35 | 98 |
  | `core` beads under the main checkout's path | 68 | 65 |
  | Same repo and file name through any checkout | 69 | 64 |

  Of the 65: 13 are named in a Claude Bash row, 2 in native Codex command text, 51 in
  neither.
- **Wiki pages.** 241 of 1,011 opened by `Read`; the last such row is 2026-08-19, as in
  the census. Of the 770 never opened: 137 are named in Claude Bash rows (the summary
  field is cut at about 400 characters, so this undercounts), 256 in native Codex command
  text, 357 in either, **413 in none of the three**. The last Bash row naming a wiki page
  is 2026-11-24. Wiki reads did not stop; they moved to the shell.

### 3.7 Ledgers

| Ledger in `~/.claude` | Rows | First | Last row | Rows from Codex sessions |
|---|---|---|---|---|
| `tool-telemetry.jsonl` | 83,313 | 2026-04-07 | 2026-11-25 (live) | 0 |
| `suggestion-telemetry.jsonl` | 15,168 | 2026-04-12 | 2026-11-25 (live) | 9,510 (from 2026-09-30) |
| `session-telemetry.jsonl` | 1,875 | 2026-04-07 | 2026-11-25 (live) | 0 |
| `skill-architecture-audit.jsonl` | 66 | 2026-06-18 | 2026-11-23 | 0 |
| `skill-telemetry.jsonl` | 163 | 2026-04-08 | **2026-10-20** | 0 |
| `standup-telemetry.jsonl` | 25 | 2026-04-28 | **2026-10-10** | 0 |
| `claude-md-gate-telemetry.jsonl` | 3 | 2026-08-09 | **2026-08-19** | 0 |

- A row is "from Codex" when its `session_id` is a thread id in Codex's own index.
- 63% of the suggestion ledger comes from Codex sessions. The census's suggestion counts
  mix both harnesses and did not say so.
- The `telemetry/daily` branch on GitHub holds six ledger files. Its metadata file names
  this Mac as the writer of the last sync (2026-11-25). Yojimbo reports no ledger file
  and no sync LaunchAgent (§3.8), so nothing found there could write it. Other hosts were
  not checked.

### 3.8 The owning host's answer

- **Vantage.** Yojimbo, 2026-11-25. That host's conductor ran the probe unchanged from
  Claude Code and reported that the request file's checksum matched. `core` there is on
  `main` at bc7b5df, equal to its local `origin/main` ref, which was not fetched. This
  session read the answer once and did not observe the host. Nothing in this section is
  inferred from the Yuri Mac.
- **The vault was left out.** The owner ruled, in that host's chat, that the vault there
  is handled separately. The probe was given a path that does not exist. Its vault lines
  ("absent", "0 of 0") report that exclusion and say nothing about the vault. No Git
  command ran in the vault and the scanner was not run.
- **No ledgers.** None of the seven ledger files in §3.7 exists there, and the LaunchAgent
  that syncs them is not installed. The probe lines that read a ledger (40 repos "never
  in the ledger", no `Skill` call, 0 of 145 beads read) mean *no ledger*, not *never*.
  Claude Code transcripts do exist there (145 project folders) and were not read.
- **Codex window.** 802 session files, all native, 2026-10-26 to 2026-11-23: 29 days, not
  90. By `thread_source`: 732 automatic review threads, 17 subagents, 38 started by a
  person, 13 started or forked by an agent, 2 unlabelled. Runs started in an ephemeral
  mode leave no session file. The conductor says such runs happened there through
  2026-11-25 and were not counted.
- **Side by side.** The same probe on the same day. The columns are two hosts and are not
  added together.

  | Count | Yuri Mac | Yojimbo |
  |---|---|---|
  | Directories with a `.git` directory; checkouts with a `.git` file | 55; 13 | 50; 16 |
  | Rules files at the four root paths | 51 in 41 repos, 4,778 lines | 46 in 40 repos, 4,308 lines |
  | `CLAUDE.md`; `AGENTS.md` | 41; 10 | 39; 7 |
  | `AGENTS.md` not tracked in Git | 6 | 0 |
  | `~/.claude/CLAUDE.md` | 7,178 bytes | 3,899 bytes |
  | `~/AGENTS.md`; `~/.codex/AGENTS.md` | 7,169 bytes each | both absent |
  | Nested tracked rules files; `.claude/rules` files | 5; 1 | 8; 1 |
  | Claude Code hook entries: user; repo | 10; 112 in 33 files | 10; 49 in 14 files |
  | Claude Code plugins enabled; their hook entries | 12; 9 | 5; 9 |
  | Codex hook entries: user; repo; plugin | 4; 14 in 5 files; 9 | 0; 0; 0 |
  | Codex projects listed (all trusted); hook trust records | 33; 21 | 10; 0 |
  | Entries in `~/.claude/skills` | 28 | 27 |
  | Entries in `~/.agents/skills` | 6 | folder absent |
  | Entries in `~/.codex/skills`; `SKILL.md` below it | 3; 8 | 3; 8 |
  | `SKILL.md` in plugin caches: Codex; Claude Code | 149; 59 | 93; 6 |
  | Repos with `.agents/skills` | 3 | 1 |
  | Catalogue entries | 77 | 77 |
  | Claude Code memory: files; index files; folders | 143; 18; 24 | 38; 4; 14 |
  | Claude Code project folders | 54 | 145 |
  | Codex memory rows; automation `memory.md` files | 0; 3 | 0; 0 |
  | Beads | 133 in 15 repos | 145 in 14 repos |
  | Ledger files, of seven | 7, of which 3 stopped | 0 |
  | LaunchAgents files; ending `.disabled` | 21; 2 | 13; 0 |
  | Codex automations | 8, of which 3 `ACTIVE` | 1, `PAUSED` |
  | Claude scheduled tasks | 0 | 2, of which 1 enabled |
  | Codex session files; imports among them | 2,967; 263 | 802; 0 |
  | Native Codex files, first to last | 2026-09-18 to 2026-11-25 | 2026-10-26 to 2026-11-23 |
  | Native files starting at `~/ojfbot` itself | 1,579 of 2,704 | 62 of 802 |
  | Native files starting outside `~/ojfbot` | 258 | 504 |
  | Native files whose recorded text runs 200 characters past the global file | 890 | 114 (no global file there) |

  The Claude Code plugin cache count (59) includes cached versions; §1's 51 counts
  installed versions only. `core` was read from a worktree here and from the checkout
  there.
- **Readers of the report, host side.** No match in 13 LaunchAgents files, 0 crontab
  lines, the 1 Codex automation or the 2 Claude scheduled tasks. Two LaunchAgents files
  are named for the vault (a backup job and an inbox job, by file name); neither holds
  the pattern. The system launchd folders are empty. The tracked FleetRunner job and
  package files at bc7b5df hold 0 matches; its live job table was not queried. The one
  Codex automation is not the hygiene loop. Its last run reads null in `codex.db` and
  2026-10-30 in `codex-dev.db`, the same split as in §3.2.
- **Codex load records.** Native files start in four directories under `~/ojfbot` besides
  the folder itself: 159, 70, 5 and 2 files. Only the first two record project text (54
  and 58 files), and both of those repos hold an `AGENTS.md`. So 2 of the 7 `AGENTS.md`
  files there have a Codex text record in the 29 days, and 5 are in repos where no
  session file starts. The probe does not match the text to today's file (the limit in
  §3.4), and it does not report whether a `CLAUDE.md` there imports `AGENTS.md`.
- **Skills in Codex there.** 21 names appear in the command text of root sessions; 13 are
  catalogue skills. Of the 65 with no `Skill` call on the Yuri Mac, 8 are among the 13.
  Of the 9 with no record on the Yuri Mac in either harness, none is. The set arithmetic
  was done here on that host's list.

## 4. What differs, and which open ticket it matters to

1. **A Git copy of the vault exists; this Mac does not have it.** History runs to
   2026-10-29 on a private remote. Matters to "How do the prior staleness decisions relate
   to this map?" (#736): whether the scanner ADR's test is blind depends on the copy it
   runs against. The owning host was asked and the vault there was left out by the
   owner's ruling, so this is still not known. Also to "What marks a wiki claim untrue,
   as distinct from a page unused?" (#738).
2. **"66 of 77 skills unused" is a Claude Code number.** With Codex reads on the same Mac
   9 of 77 have no record in either. Matters to "Would the owner accept what a pruning pass
   proposes?" (#744): a pass fed the 66 would propose retiring skills that Codex sessions
   open. Also to "Should each session record what it loaded, across both harnesses, and in
   what shape?" (#746): the two harnesses leave unlike records. Yojimbo's Codex files
   (29 days) name 13 catalogue skills and none of the 9; Claude Code use there leaves no
   ledger, so the 9 is not a two-host number.
3. **"98 of 133 beads never read" is a path artefact.** 64 to 65 by a like-for-like match,
   51 when shell reads count. Matters to "What happens to a retired item?" (#742) and to
   #744. It also shows that a census taken from a worktree must map paths back to the
   checkout the ledger saw.
4. **"26 of 51 rules files loaded by neither harness" is 30 of 51 per file.** Codex was
   credited with sessions it only imported, and each file was credited to both harnesses.
   Matters to #744, whose two computable inputs include "files no session loaded", and to
   "What does one session load at start, in each harness?" (#748).
5. **Hook entries are 158 here, not 122.** The 9 plugin entries on each side run in every
   session of that harness. Matters to "Is there a budget on what every session loads, and
   what happens past it?" (#740) and to #748.
6. **Six of ten `AGENTS.md` files are untracked on this Mac.** Five exist only in this
   Mac's checkouts; Yojimbo reports no `AGENTS.md` in those repos. The sixth has a tracked
   counterpart upstream with different bytes. Five of the six files behind the `.Codex`
   defect are also only here (four of them are among the five; the fifth is `~/AGENTS.md`,
   absent on Yojimbo). Matters to "Who may retire or refresh an item on each surface?"
   (#741): for an untracked file, "which host acts" has one answer. Also to #736, which
   routes the defects.
7. **The loops registry has no host field.** The hygiene automation is `PAUSED` on the
   Yuri Mac and does not exist on Yojimbo. `live` is matched by nothing found on either
   Mac; FleetRunner's live job table and the NAS were not read. Matters to #736 (the
   defect is routed to the `control-plane-conductor` map).
8. **One ledger is already cross-harness and three have stopped, on the Yuri Mac.**
   Matters to #746 and to "How will we tell whether retirement helped?" (#750): a measure
   read from these files is read from one host, and from one harness except for
   suggestions.
9. **Wiki reads moved to the shell.** 413 of 1,011 pages have no record in three sources
   here, not 770. Matters to #736 and #738: the ADR's "no signal today" for wiki *unused*
   still stands, but the reason is that reads are spread over records nobody joins.
10. **The rules-file count depends on where one looks.** Nested files, a rules folder, the
    vault's own rules files, a third user-scope path and 94 worktree copies are outside
    the 53. Matters to #748 and #740.
11. **The owning host keeps no ledger.** None of the seven files exists on Yojimbo and the
    sync job is not installed (2026-11-25). Every Claude Code count in the census and in
    this file is a Yuri Mac count with no counterpart. Matters to #746: a load record
    must be installed on each host, not only defined. Also to #750 and #744, and to the
    wording of *unused* (§5).
12. **Codex records on Yojimbo cover 29 days and leave out ephemeral runs.** A repo with
    no session file there may still have had Codex runs. Whether such runs happen on the
    Yuri Mac was not checked beyond two searches (§1). Matters to #746, and to every
    "no native Codex session in the repo" line above, which should read "no session file".
13. **User-scope rules differ by host.** `~/.claude/CLAUDE.md` is 7,178 bytes here and
    3,899 there, and Codex has a global file here and none there. What a session loads at
    start depends on the host as well as the harness. Matters to #748 and #740.
14. **Every Codex hook found is on the Yuri Mac.** 27 here, 0 on Yojimbo; the 14
    repo-scope entries sit in untracked files. The ADR's row about them is a one-host
    row. Matters to #741 and #748.
15. **Bead and rules-file counts differ by host.** 145 beads in 14 repos there against 133
    in 15 here; 46 rules files against 51. A retirement pass run on one host would see a
    different set from the other. Matters to #742 and #744.
16. **The vault questions are still open on the host that owns the pipeline.** F1, F2, F4,
    F5, F21 and the vault half of F3 were not checked there. Matters to #736 and #738.

## 5. Corrected wording

Each line says more than was measured. Replacements are proposals; nothing was edited.

### Map: Notes

> - Two facts were not checked at charting. The census answered both: on this Mac the
>   vault is not a Git repository, so the scanner's 90-day test can flag no page; and no
>   live process reads the scanner's report.

Replace with: "Two facts were not checked at charting. On the Yuri Mac (2026-11-24,
re-run 2026-11-25) the vault folder is not a Git repository, so the scanner's 90-day test
can flag no page there. A private Git remote of the vault exists, with history to
2026-10-29. On the Yuri Mac no live process reads the scanner's report: launchd, cron,
Codex automations and Claude scheduled tasks were checked. On Yojimbo (2026-11-25) no
host scheduler names the report either: launchd, cron, its one Codex automation and its
Claude scheduled tasks were checked, and FleetRunner's live job table was not. The vault
on Yojimbo was not checked: the owner left it out on 2026-11-25, to be handled
separately."

> every tool call, Codex session files store the merged instruction text and its directory,

Replace with: "every tool call; Codex session files store the merged instruction text and
its directory (on the Yuri Mac 592 of 2,967 files store none, and 263 are imported Claude
Code transcripts; on Yojimbo there are 802 files from 2026-10-26, none imported; a run
started in an ephemeral mode leaves no file),"

> - Nothing, here or in published practice, detects a claim that is untrue in general.

Replace with: "Nothing found on `main`, on the Yuri Mac or in the 29 pages read detects a
claim that is untrue in general."

> - "Unused" cannot be measured here for rules files, hooks or memory files, because no
>   ledger records their use. Two ledgers that did exist stopped being written.

Replace with: "On the Yuri Mac, reliance on a rules file, hook or memory file cannot be
measured, because no ledger records it. Three ledger files there have stopped being
written (last rows 2026-08-19, 2026-10-10 and 2026-10-20), and wiki reads left the `Read`
record on 2026-08-19 for the shell. On Yojimbo (2026-11-25) no ledger file exists."

> - Only agent memory is removed without a person in published practice.

Replace with: "In the pages read, only agent memory is removed without a person."

> - Published practice is silent on: retiring hooks; …

Replace with: "The 29 pages read say nothing on: retiring hooks; …"

> - "Would the owner accept what a pruning pass proposes?" has two computable inputs on rules
>   files today: broken references, and files no session loaded.

Replace with: "… has two inputs that compute on the Yuri Mac today: broken references,
and files with no load record there, each file credited only to the harness that reads it."

### Map: Four defects

> - The loops registry lists `selfco-vault-hygiene` as `live` while its automation file
>   says `PAUSED`

Replace with: "The loops registry lists `selfco-vault-hygiene` as `live` while its
automation file on the Yuri Mac says `PAUSED`, and no automation of that name exists on
Yojimbo (2026-11-25). The registry row names no host. FleetRunner's live job table was
not read."

> - Six `.Codex/...` paths named in `AGENTS.md` files resolve to nothing, even ignoring
>   letter case, and `install-agents.sh` has no Codex handling

Replace with: "On the Yuri Mac, six `.Codex/...` paths named in `AGENTS.md` files resolve
to nothing, even ignoring letter case. Five of the six files that hold such a path are
untracked or outside any repo, so they exist only there. The sixth is tracked; whether
its path resolves on Yojimbo was not measured. `install-agents.sh` on `main` has no Codex
handling."

> `skill-telemetry.jsonl` has not been written since 2026-10-20

Replace with: "on the Yuri Mac `skill-telemetry.jsonl` has not been written since
2026-10-20; on Yojimbo the file does not exist (2026-11-25)"

### Map: Decisions so far (closed tickets)

> Skills: 66 of 77 unused in 90 days. Rules files, hooks and memory have no usage ledger.

Replace with: "Skills: 66 of 77 had no `Skill` call in the Claude Code tool ledger on the
Yuri Mac in 90 days; Codex sessions on the same Mac opened 56 of them. Rules files, hooks
and memory have no ledger of use there; loading is recorded in part. Yojimbo keeps no
ledger at all (2026-11-25)."

> No study measures pruning a rules file.

Replace with: "No study found in the 15 pages read measures pruning a rules file."

> No study covers LLM-maintained wikis, and nothing handles a kept source that has aged.

Replace with: "No study in the 14 pages read covers LLM-maintained wikis, and none of
them handles a kept source that has aged."

> *unused* (no load record in 90 days in either harness)

This touches a ruled decision, so what follows is a proposal for the owner.

Before Yojimbo answered, this file proposed: "*unused* (no load record in 90 days, in
either harness, on any host whose records were read; each result names the hosts read)".
That wording does not hold. Yojimbo's records were read, and on the Claude Code side
there are none. Under the wording Yojimbo counts as a host read, adds no record for any
item, and the result names two hosts while resting on one. A host that keeps no record
and a host where the item never loaded give the same answer. Reading a record is not the
condition; a record having been kept is.

Proposed instead: "*unused* (no load record in 90 days, counted only where a load record
was kept: per host and per harness. Each result names the host-and-harness pairs it rests
on, with the days each record covers, and the pairs it could not use. Where no record was
kept the item is *not measured* there, never *unused*)".

What that means on 2026-11-25, for the owner to weigh:

| Host and harness | Load record kept | Days of the 90 covered |
|---|---|---|
| Yuri Mac, Claude Code | Tool ledger (a proxy for rules files) | 90 |
| Yuri Mac, Codex | Session files; imports and ephemeral runs aside | 68 (from 2026-09-18) |
| Yojimbo, Codex | Session files; ephemeral runs aside | 29 (from 2026-10-26) |
| Yojimbo, Claude Code | None. Transcripts exist and were not read | 0 |

One pair covers the whole window. If the rule requires full cover, *unused* can be
computed today for Claude Code on the Yuri Mac and nowhere else. If it accepts a stated
shorter cover, three pairs count and each result must say how many days it rests on. This
file does not choose between the two.

### Map: Not yet specified

> 26 of 51 repo rules files were loaded by neither harness in 90 days, mostly because
> their repos are idle.

Replace with: "on the Yuri Mac, 30 of 51 repo rules files have no load record in 90 days
when each file is credited only to the harness that reads it (28 `CLAUDE.md`, 2
`AGENTS.md`), mostly because their repos are idle there. On Yojimbo (46 files,
2026-11-25) Claude Code keeps no ledger, and Codex session files cover 29 days: 2 of 7
`AGENTS.md` have a record."

### Draft ADR `staleness-kinds-and-signals`: Evidence

| Line | Replace the result with |
|---|---|
| "25 loaded by either harness in 90 days; 22 by neither in 90 days; 4 by neither ever" | "Per file, each credited to the harness that reads it: 21 with a load record in 90 days (13 `CLAUDE.md`, 8 `AGENTS.md`); 26 with none in 90 days; 4 `CLAUDE.md` never. 263 Codex session files are imports and credit nothing" |
| "9 in projects Codex does not trust" | "9 with no hook trust record (3 in an untrusted project, 6 in trusted projects)" |
| "66 with no `Skill` call in 90 days; an upper bound" | "66 with no `Skill` call in the Claude Code ledger in 90 days. Codex root sessions opened 56 of them; 9 of 77 have neither record" |
| "98 never opened by `Read`" | "64 to 65 never opened by `Read`, once `core` beads are matched under the path the ledger saw; 51 when shell reads count" |

The ADR's signal table says "No `Skill` call in the tool ledger" for skills, while its
kind says "in either harness". The row and the kind disagree; this file does not choose.

All four rows above are Yuri Mac rows, and so is every other Evidence row that reads a
ledger. Yojimbo keeps no ledger (2026-11-25), so none of them has a second-host value.
The Evidence table should say which host each row was measured on.

## 6. Not measured

- **The vault on Yojimbo.** The owner left it out on 2026-11-25, to be handled
  separately. Not checked there: whether the vault is a Git repository, its page and
  stamp counts, the scanner run, when `_lint-report.md` was last written, `log.md` lines
  naming it, vault config files naming the scanner, the vault's rules files, and reads of
  wiki pages. Rows F1, F2, F4, F5, F21 and the vault half of F3.
- **Also not checked on Yojimbo, by its conductor's own list.** FleetRunner's live job
  table and any other container on that server (only tracked definitions were searched).
  Whether the remote has moved past bc7b5df (its checkout was not fetched). Codex runs
  started in an ephemeral mode, which leave no session file.
- **Not covered by the request or its probe, so not measured on Yojimbo.** Claude Code
  transcripts (145 project folders; the only Claude Code record there). Hook script paths
  (F9). `.Codex` paths in `AGENTS.md` files (F19). Whether a `CLAUDE.md` imports
  `AGENTS.md`. Whether recorded Codex text matches today's file. Anything that retires an
  item (F23). Worktree copies.
- **Yojimbo, by observation.** This session read one answer. It ran nothing there.
- **Ephemeral Codex runs on the Yuri Mac.** Not looked for beyond two searches (§1).
- **The NAS, `selfco-box`, GitHub Actions runners, chat clients, cloud sessions,
  worker-launched sessions.** Named in §1, not inspected.
- **The `core` checkout**: its settings, its Codex hooks, its beads, its `.Codex/skills`
  path. One test run of the probe read counts from it by mistake (line counts of two rules
  files, entry counts of two hook files, a `.handoff` listing, `git ls-files`). Nothing
  was written, the run was repeated with `core` read from this worktree, and no number
  from that checkout is in this file. It is logged in `implementation-notes.md`.
- **The 86 worktree checkouts and `~/.codex/worktrees`**: counted, not read.
- **The scanner against real Git ages.** Needs a clone of the vault's remote.
- **Which host pushed the vault remote, and why pushes stopped on 2026-10-29.**
- **Whether a Codex hook that names `$CLAUDE_PROJECT_DIR` or matches on `Skill` ever
  runs.** Needs a hook to be fired.
- **What Codex's import of Claude Code config copies** (85 import rows in its index).
- **Hook firing in either harness; reliance on any single rule.** No record exists here.
- **Memory files with no session transcript; the broken-path samples; the superseded
  markers.** Taken from the census, not re-measured.
- **Codex rows still in a write-ahead log.** Databases were opened read-only and immutable.
- **Whether Codex itself, on another host, has the same automations.** `~/.codex` is per
  host.
- **Loops.** Not counted, as in the census.
- **The two outside-practice files.** Wording only. No source was re-read.

## Appendix: methods

All scripts are read-only and print counts, dates, config paths and public skill names.
Python was run as `python3 -I`. `core` was read from this worktree.

- **`second_vantage_probe.py`** (260 lines) reproduces §1's runner counts and §3.1, §3.2,
  §3.4 (counts), §3.5, §3.7 and the per-repo Codex table on any host. It is embedded in
  the owning-host request so that both hosts run the same instrument. Its run here took 25
  seconds and its output is kept with the request.
- **Codex session scan.** For each of 2,967 files under `~/.codex/sessions` and
  `~/.codex/archived_sessions` (`zstd -dc` for the 2,808 compressed ones): the first
  `session_meta` gives start directory, date, `thread_source` and originator; every
  `world_state` record with an `agents_md` key gives the length of the recorded text, and
  the older `# AGENTS.md instructions for <dir>` message is read the same way; tool-call
  inputs (`custom_tool_call`, `function_call`, never their outputs) are matched against
  `skills/<name>/SKILL.md`, `<repo>/.handoff/<file>.md` and
  `wiki/(sources|entities|concepts|synthesis)/<file>.md`. A file is an import when its
  thread id is in `external_agent_session_imports.json`.
- **Text match.** For each repo rules file, up to six lines of 48 characters or more that
  occur in no other rules file and not in the global file. A session matches a file when
  its recorded text contains one of them.
- **Claude Code proxy.** A repo has a load record when `tool-telemetry.jsonl` has a row
  whose `repo` is the repo, or whose `cwd` is inside it or one of its worktrees, on or
  after 2026-08-26.
- **Typed slash commands.** `<command-name>` in user lines of 410 files under
  `~/.claude/projects`, with the line's own timestamp.
- **GitHub reads.** `gh issue view` for the ticket; `gh repo list` (names and last push);
  the repository record, one commit and one tree of the vault's remote (date, path
  counts); `git ls-remote`, one commit, the tree and the metadata file of
  `telemetry/daily`. The only write was assigning the ticket.
- **The owning host's answer.** Read once, read-only, from the fleet's relay on
  2026-11-25. The request, with the probe embedded, went out through a conductor; this
  session sent nothing to that host.
- **Cross-checks after the answer**, on this Mac, read-only: `git ls-files` and
  `git ls-tree origin/HEAD` for root `AGENTS.md` and `.codex/hooks.json` in 55 repos
  (remote refs as last fetched; nothing was fetched; 3 repos have no remote default ref);
  `.Codex/` counted in each `AGENTS.md` and in its default-branch copy; set arithmetic on
  the catalogue against both hosts' Codex skill lists; `git grep -l -e '--ephemeral' origin/main`
  and `grep -c` of the same string in the tool ledger.
- **Scratch files** are held outside the repo with the session's notes: `codex_scan.py`,
  `codex_scan2.py`, `codex_agg.py`, `codex_side.py`, `claude_side.py`, `final_agg.py`,
  the probe and its output.
