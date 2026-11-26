---
type: research
ticket: "What is stale here today, and is any staleness report acted on?"
map: decisions/wayfinder/staleness-and-retirement.md
date: 2026-11-24
vantage: "Yuri's Mac, 2026-11-24, one pass. No other host (not Yojimbo)."
---

# Staleness census, 2026-11-24

A count of what is stale on this Mac, per surface, and whether anything acts on a
staleness report. Nothing was fixed, deleted or retired. Every number below was
**measured** with the command shown unless it is marked *inferred*.

**Terms (from the map, not decided here).**
*Unused* = no recorded use in the usage evidence, over the window that evidence covers.
*Untrue* = a checkable claim (a named path or script) no longer resolves.
*Superseded* = an explicit marker only. Nothing here is inferred as superseded.

**Privacy.** Memory files and vault pages are reported as counts only. No names, no
contents.

## 1. Table

| Surface | Items (denominator) | Unused | Untrue (fixed sample of 20 claims) | Superseded (explicit marker) |
|---|---|---|---|---|
| Rules files | 53 files (2 user-scope, 51 in repos) | not measured | 4 fail, 16 pass, of 499 claims | 0 of 53 mark themselves |
| Hooks | 122 hook entries in 34 settings files; 28 scripts in `scripts/hooks/` | not measured | 0 fail, 20 pass, of 122 script paths (all 122: 1 fails) | 0 |
| Skills | 76 dirs in this worktree; 77 catalog entries; 28 entries in `~/.claude/skills` | catalog: 40 of 77 never used; 66 of 77 not used in the last 90 days. Home: 6 of 28 / 19 of 28 | 2 fail, 18 pass, of 322 claims | 0 of 76 |
| Memory files | 139 files in 24 `memory/` folders (18 index files not counted) | not measured | 4 fail, 16 pass, of 77 absolute-path claims | 3 files carry a strict marker |
| Beads | 133 top-level `.handoff/*.md` in 15 repos | 98 of 133 never read | 7 fail, 13 pass, of 530 claims | 1 `status: superseded`; 2 with a `superseded_by`/`supersedes` key |
| Vault wiki | 1,011 pages | 770 of 1,011 never read, but the signal ends 2026-08-19 (see §8) | 3 fail, 17 pass, of 345 absolute-path claims | 3 `superseded_by` (all in `sources/`) |
| Loops | not counted (per brief) | — | — | — |

The scanner's own result: **0 stale pages of 1,011** (see §9, question 1).

## 2. Method that applies to every row

- **Repos** = directories under `~/ojfbot` that have a `.git` directory: 55. This
  excludes 12 git worktrees and 23 plain directories (`for d in */; do [ -d "$d/.git" ]`).
- **`core`**: every `core` file was read from this worktree
  (`~/ojfbot/.worktrees/core-staleness-map`, cut from `origin/main`). The `core`
  checkout was not read. One exception: `hooks.py` and `claims.py` redirect `core` paths
  to the worktree. The user-scope hooks point at `~/ojfbot/core/scripts/hooks/...`,
  so the rule "this file exists" was tested on the worktree copy.
- **Untrue sample.** Take the claims in item order (sorted by file path, then claim),
  pick every ⌊N/20⌋-th starting at the first, stop at 20. No random draw, so a rerun
  gives the same 20. A claim is a backticked token that looks like a path (contains `/`
  and ends in an extension, or ends in `/`). Not counted: URLs, globs, placeholders
  (`<>`, `*`, `$`), flags. A claim passes if the path exists relative to the repo root,
  the file's own directory, or as an absolute or `~` path. `claims.py` is in the
  appendix. It reads only paths, never contents, into the output.
- **Usage evidence** is `~/.claude/tool-telemetry.jsonl` (one line per tool call, from
  the user-scope `log-tool-use.sh` hook). Window: **2026-04-07 to 2026-11-24**, 81,936
  rows, live today. "Last 90 days" starts 2026-08-26. It records `Read` and `Skill` calls
  only. It does not see a file read through `cat`, a search tool or another host.
  `usage.py` is in the appendix.

## 3. Rules files

- **Items.** Two user-scope files (`~/.claude/CLAUDE.md`, `~/AGENTS.md`) plus
  `CLAUDE.md`/`AGENTS.md` at the top level and in `.claude/` of each repo. 51 repo files
  across 41 repos, 4,996 lines in all.
  ```
  for d in */; do [ -d "$d/.git" ] || continue; for f in CLAUDE.md AGENTS.md .claude/CLAUDE.md .claude/AGENTS.md; do [ -f "$d/$f" ] && echo "$d$f"; done; done
  ```
  (`core` read from the worktree.) Count: `wc -l < rules.tsv` = 53. Lines:
  `cut -f1 rules.tsv | xargs wc -l | tail -1`.
- **Unused: not measured.** Rules files load at session start. Nothing logs which rule a
  session used.
- **Untrue.** `python3 -I claims.py < rules.tsv` gave 499 claims, 16 pass, 4 fail:
  - `TripPlanner/CLAUDE.md`: `src/store/hooks.ts` (not at the repo root; may live in a
    sub-package).
  - `frame-ui-components/CLAUDE.md`: `src/__tests__/MyComponent.test.tsx` (looks like an
    example name, not a real file).
  - `lofi-beaver/AGENTS.md`: `sim/day-cycle.ts`.
  - `play-well-library/AGENTS.md`: `.Codex/northstar.md`.
  A failure means "does not resolve", not "wrong". Two of the four may be examples.
- **Superseded.** Strict markers (`superseded_by`, `STALE`, `Deprecated`):
  `cut -f1 rules.tsv | xargs grep -lE 'superseded_by|\bSTALE\b|[Dd]eprecated'` = 1 file,
  and the match is a sentence about Blender operations, not about the file. The word
  "supersede" appears in 8 files; each one is about another document (an ADR or a
  decision). I read every matching line. 0 files mark themselves superseded.

## 4. Hooks

- **Items.** 122 hook entries in 34 settings files: `~/.claude/settings.json` (10
  entries) and 33 repo `.claude/settings.json`. This worktree has none: its
  `.claude/settings.json` is gitignored and absent (see §10). `python3 -I hooks.py` (appendix).
  Scripts in `scripts/hooks/`: `ls scripts/hooks | grep -vc __tests__` = 28 (includes
  `_lib.sh`).
- **Unused: not measured.** No ledger records each hook firing. `session-telemetry.jsonl`
  records sessions, not hooks.
- **Referenced, as a side fact.** 13 of the 28 scripts are named in no settings file. I
  searched `scripts/`, `.claude/skills/` and `.github/` for each name: every one is
  named somewhere else (one to 21 files). Naming is not use. *This says nothing about
  firing.*
- **Untrue.** All 122 entries name a script path. Sample of 20: 20 pass. Over all 122:
  1 fails (`GroupThink/.claude/settings.json` points to
  `$CLAUDE_PROJECT_DIR/scripts/hooks/log-skill.sh`, which is absent).
- **Superseded.** 0. Four script files contain the words "stale" or "STALE"; the lines
  concern other things (message expiry, ledger rows).

## 5. Skills

- **Items.** `ls -d .claude/skills/*/ | wc -l` = 76 (all have `SKILL.md`).
  `skill-catalog.json` (in `.claude/skills/skill-loader/knowledge/`, version 1.25,
  updated 2026-09-24) has 77 entries; 1 (`cca-prep`) has no directory here.
  `~/.claude/skills`: 28 entries, 23 symlinks, 0 broken (`find -L ... -type l` empty),
  5 real directories.
- **Unused.** Strict use = a `Skill` tool call in `tool-telemetry.jsonl` (`usage.py`):
  - Catalog (77): 40 never, 66 none in the last 90 days.
  - Home (28): 6 never, 19 none in the last 90 days.
  - Looser count (a `Skill` call or a `Read` of its `SKILL.md`): 3 of 77 never used.
    The loose count is inflated: three sessions each read 10 or more `SKILL.md` files
    in one go, up to 68, which looks like an audit sweep and not use.
  - Not counted: a skill run inline by a user-typed slash command may not show as a
    `Skill` call. So "unused" is an upper bound.
  - `~/.claude/skill-telemetry.jsonl` (163 lines, 2026-04-08 to **2026-10-20**) stopped
    being written on 2026-10-20. The user-scope settings have no `Skill` hook;
    `log-skill.sh` is wired only in some repos. I did not use it for counts.
- **Untrue.** `claims.py` over the 76 `SKILL.md`: 322 claims, 18 pass, 2 fail
  (`scaffold-frame-app`: `packages/shell-app/src/components/AppFrame.tsx`;
  `teach`: `teach/index.md`, which may be a path inside the vault).
- **Superseded.** 0 of 76 have `superseded_by`, `deprecated` or a retired status in
  frontmatter. Catalog `status` is empty for 76 entries and `active` for 1. 21 `SKILL.md`
  files contain the word "superseded", "deprecated" or "STALE"; I did not read them
  and do not count them.
- **Suggestion ledger** (`~/.claude/suggestion-telemetry.jsonl`, 14,888 events,
  2026-04-12 to 2026-11-24): 1,239 `suggested`, 5,885 `suggestion-ignored`, 5,587
  `no-match`. `suggestion-followed` events are in the other ledger: 15 (last 2026-10-20).
  Counts are raw events. I did not work out a rate: the event kinds do not pair one to
  one.

## 6. Memory files

- **Items.** `find ~/.claude/projects -path '*/memory/*' -name '*.md' ! -name MEMORY.md`
  = 139, in 24 folders (`find ~/.claude/projects -maxdepth 2 -type d -name memory`) out
  of 54 project folders. 18 `MEMORY.md` index files are not counted. Index links: 137,
  0 dangling; 2 files are named in no index.
- **Unused: not measured.** The index is injected at session start, so a `Read` log
  would undercount, and no recall is logged.
- **Untrue.** Only absolute and `~` paths can be checked (relative ones have no
  root). Of 324 claims, 77 are absolute. `ABS=1 python3 -I claims.py < mem.tsv`: sample
  20, 16 pass, 4 fail (three under a `plans/` folder, one a repo directory). The other
  247 claims were not tested.
- **Superseded.** Strict marker (`superseded_by`, `STALE`, `Deprecated`): 3 files. A
  looser word match (`supersed|obsolete`): 10 files. Two index files carry a STALE note.

## 7. Beads

- **Items.** A bead = a top-level `*.md` file in a repo's `.handoff/` folder. `python3 -I
  beads.py <outdir>` (appendix): 133 beads in 15 repos (`core` taken from the worktree's
  tracked files, 67 of the 133). Subfolders are not beads: 23,230 `.md` files sit in
  subfolders of 3 repos (`daily-logger` 21,824, `morning-cockpit` 1,016,
  `lego-village-pipeline` 390). Per-cycle files, not counted.
- **Unused.** A bead is "used" if the `Read` tool opened its path: 35 of 133 were,
  98 were never (window 2026-04-07 to 2026-11-24).
- **Untrue.** 530 claims, sample 20: 13 pass, 7 fail. Caveat: a bead often describes
  work in another repo, so a path may be right for that repo and fail here.
- **Superseded.** Frontmatter `status`: 88 `live`, 35 `closed`, 4 `open`, 1
  `superseded`, 1 none. 2 beads carry `superseded_by` or `supersedes`. 36 contain one of
  the words; not counted. Only 1 of 133 carries an `expires_at`, although
  `bead-emit.mjs` documents an expiry label.

## 8. Vault wiki

- **Items.** `find ~/selfco/wiki -name '*.md' | wc -l` = 1,011: 458 sources, 197
  entities, 176 concepts, 175 synthesis, and 5 hub files (`index`, `log`, `_hot`,
  `_lint-report`, `_suggested-links`).
- **Scanner.** I read `lint.py` before running it. It calls `git log` and `git show` (read
  only), writes no file, and only `--gate` and `--suggest-links` do more. I ran this
  worktree's copy (the wrapper `vault-stale.sh` runs the `core` checkout, which I may not
  touch):
  `PYTHONDONTWRITEBYTECODE=1 python3 -I .claude/skills/vault/scripts/lint.py ~/selfco/wiki --stale`.
  Result: 0 orphans, 0 broken links, 198 raw items with no source page, **0 stale
  pages**. I counted files in `~/selfco` changed since 2026-11-24 before and after: 16
  and 16.
- **Unused.** 241 of 1,011 pages were opened by `Read` at least once; 770 never. But
  the last such `Read` was **2026-08-19**, and none fall in the last 90 days. Wiki
  access has probably moved to other tools that this ledger does not see. Treat
  "770 unused" as *not reliable*.
- **Untrue.** 345 absolute-path claims; sample 20: 17 pass, 3 fail. Relative claims
  not tested.
- **Superseded.** `grep -rlE '^superseded_by:'` = 3 (all `sources/`). `staleness: ignore` =
  3 (matches the map). Inline "as of" stamps: `grep -rliE '\bas of 20[0-9]{2}-[0-9]{2}'`
  = **96** files. The map says 50; I could not reproduce 50, and I do not know the
  pattern it used. The word "superseded" appears in 63 files; not counted.

## 9. The two questions

### Q1. Does the "no tracked edit in 90 days" test still see edits? **No. It sees none.**

- **Measured.** `~/selfco` is **not a git repository**. `ls -a ~/selfco` shows no
  `.git`, and `git log` in it fails with "not a git repository (or any of the parent
  directories)". There is no latest commit to compare with.
- The wiki is live: newest page change 2026-11-16 18:24; 65 pages changed in the last
  30 days, 339 in the last 90 (`find ~/selfco/wiki -name '*.md' -mtime -N`).
- In `lint.py`, `git_age_days()` returns `None` when git fails, and `is_stale()` then
  returns "not stale" (`age is None or age < days`). So on this Mac the scanner cannot
  flag any page, whatever its age. The ADR-0080 test was written for a vault that
  commits to Git. This one does not, here.
- **Counterfactual (measured, labelled as such).** I ran `lint.py` with
  `git_age_days` swapped for file mtime, in memory, writing nothing. It still reported
  0 stale pages. So the other conditions (an independent inbound link, or a later log
  mention) also clear every page. Even a working age test would currently flag none.
  File mtime under Obsidian Sync may mean "synced", not "edited"; this is *inferred*.
- **Not checked.** Whether Yojimbo holds a Git copy of the vault.

### Q2. Does anything read the scanner's report and act on it? **Not now.**

- **Measured callers.** `vault-stale.sh` is named in `~/selfco/scripts/vault-maintenance-report.sh`
  (its companion), `~/selfco/bases/maintenance.base`, the vault's `CLAUDE.md` and
  `AGENTS.md`, and one `log.md` entry (2026-05-16, ADR-0079 filing) that says the script was
  "not written this session". Those are documents, not callers.
  `grep -rln -E "vault-stale|--stale" ~/selfco/{scripts,bases,maintenance,tracking,prompts,templates}`.
- **Schedulers.** No launchd plist names it (21 in `~/Library/LaunchAgents`; the 2
  selfco ones are `.disabled`). No crontab line. None of the 8 Codex automations names
  `vault-stale`, `lint.py` or `maintenance-report` (5 are PAUSED, 3 ACTIVE).
- **Loops registry** (`decisions/loops/loops.md`):
  - `selfco-maintenance-report`: trigger `manual`, status `disabled`.
  - `selfco-vault-hygiene`: a daily Codex heartbeat, status `live`. Its
    `automation.toml` on this Mac says **`status = "PAUSED"`**, file changed 2026-10-26
    20:38. The registry and the file disagree.
- **Evidence of past action.** `wiki/log.md` has 18 entries of the form
  "Refreshed `wiki/_lint-report.md` ... unchanged finding set"; the last is
  **2026-10-26**. `_lint-report.md` was last written 2026-10-26 (29 days ago), so the
  report the heartbeat fed is not refreshed now. In those runs the stale list was empty,
  so there was nothing to retire. No log entry shows a page retired or refreshed
  because of a stale report.
- **`maintenance.base`** is an Obsidian view over file mtime, not over the scanner. It
  acts only if a person opens it; I found no record of that.
- **Conclusion (inferred from the above).** No process consumes the stale report today;
  the one that did is paused; and the report would be empty anyway (Q1).
- **Not checked.** The Codex run table (`automation_runs`); Claude scheduled tasks.

### Loops

I did not count loops. The control-plane map (`decisions/wayfinder/control-plane-conductor.md`,
last changed 2026-11-16, commit `2963bec`) lists "Census the control plane (#315)" as
**open**, and a search of `decisions/` found no census result. `decisions/loops/loops.md`
is the registry, not that census. Nothing to cite yet.

## 10. Not measured

- Unused for rules files, hooks and memory files: no usage ledger exists.
- Unused for any surface by an edit-age test: no git history in the vault; most repos' file
  mtimes mean checkout time.
- Untrue for claims that are not paths (commands, flags, numbers, "X is the owner").
- Untrue for relative paths in memory files and wiki pages (no root to resolve against).
- Skills used by a typed slash command, if it does not pass through the `Skill` tool.
- Hook firing; Codex `automation_runs`; Claude scheduled tasks; Yojimbo; any other host.
- The `core` checkout itself (off limits). `core`'s own `.claude/settings.json` is
  gitignored, so a fresh worktree has no project hooks; the live `core` checkout may
  have some.
- Loops (per the brief).

## 11. Surprises

1. **The vault scanner is blind here.** `~/selfco` has no `.git`; the 90-day test returns
   "not stale" for every page (§9 Q1). ADR-0080 assumes Git.
2. **`_lint-report.md` and the hygiene heartbeat stopped on 2026-10-26.** The registry
   still says `live`; the Codex file says `PAUSED`.
3. **Two skill ledgers have gone quiet in different ways.** `skill-telemetry.jsonl`
   stopped on 2026-10-20 (no `Skill` hook at user scope). Wiki `Read` events stop on
   2026-08-19 while the wiki is still edited. A census that trusted either would
   overstate "unused".
4. **Most skills are not used in a given quarter:** 66 of 77 in the last 90 days, by
   the strict `Skill`-call measure (an upper bound).
5. **`core/CLAUDE.md` documents hooks in `.claude/settings.json`, but that file is
   gitignored and absent from a clean worktree.** A reader of a fresh checkout sees a
   claim it cannot confirm.
6. **6 of 11 `AGENTS.md` files point at `.Codex/...` paths**, apparently a rewrite of
   `.claude/...`. At least one (`.Codex/northstar.md`) does not resolve.
7. **The map's "50 inline as-of stamps" does not reproduce:** a plain pattern finds 96.
8. **`vault-stale.sh` and `vault-maintenance-report.sh` hard-code the `core` checkout
   path** for `lint.py`. They break if that working tree moves, and they run whatever
   that tree holds, not `main`.
9. **Beads have an expiry label in code but 1 of 133 uses it.**

## Appendix: scripts

All are read-only and write nothing except `beads.py` (two small files in the directory
you pass) and `claims.py` (no files). Run from the `core` worktree. `rules.tsv`,
`skills.tsv`, `mem.tsv`, `wiki.tsv` are lists of `file<TAB>root` lines; `beads.py`
builds `beads.tsv`.

### claims.py
```python
#!/usr/bin/env python3
# usage: claims.py ROOTMAP_JSON? -> reads "file<TAB>root" lines on stdin, prints sampled claim results
import sys, re, os
W="/Users/yuri/ojfbot/.worktrees/core-staleness-map"
H=os.path.expanduser("~")
tok=re.compile(r'`([^`\s]+)`')
def ok(t):
    if re.search(r'[<>*$\{\}\[\]|:@#()=,;]',t) and not t.startswith('~/'): return False
    if re.search(r'[<>*$\{\}\[\]|()=,;]',t): return False
    if t.startswith(('http','--','-','/dev','/tmp')): return False
    if t.endswith('/') and len(t)>2: return '/' in t.rstrip('/') or t.startswith('.')
    if '/' not in t: return False
    return bool(re.search(r'\.[A-Za-z0-9]{1,6}$',t))
claims=[]
for line in sys.stdin:
    f,root=line.rstrip('\n').split('\t')
    try: txt=open(f,errors='replace').read()
    except Exception: continue
    for t in sorted(set(tok.findall(txt))):
        if ok(t) and (not os.environ.get('ABS') or t.startswith(('/','~/'))): claims.append((f,root,t))
claims.sort(key=lambda c:(c[0],c[2]))
n=len(claims); k=max(n//20,1)
sample=claims[::k][:20] if n>20 else claims
def resolve(f,root,t):
    p=t
    if p.startswith('~/ojfbot/core/'): p=W+'/'+p[len('~/ojfbot/core/'):]
    elif p.startswith('~/'): p=H+p[1:]
    elif p.startswith('/Users/yuri/ojfbot/core/'): p=W+'/'+p[len('/Users/yuri/ojfbot/core/'):]
    cands=[p] if os.path.isabs(p) else [os.path.join(root,p),os.path.join(os.path.dirname(f),p)]
    return any(os.path.exists(c) for c in cands)
print("claims_total",n,"sample",len(sample))
ps=0
for f,root,t in sample:
    r=resolve(f,root,t); ps+=r
    print("PASS" if r else "FAIL", os.path.basename(root) if root!=H else '~', os.path.relpath(f,root) if f.startswith(root) else f, t)
print("passes",ps,"fails",len(sample)-ps)
```

### usage.py
```python
# usage.py — run from the core worktree. Usage evidence from ~/.claude/tool-telemetry.jsonl.
import json,os,glob,collections
H=os.path.expanduser("~"); CUT90="2026-08-26"   # 2026-11-24 minus 90 days
cat=[s['name'] for s in json.load(open('.claude/skills/skill-loader/knowledge/skill-catalog.json'))['skills']]
home=sorted(os.listdir(H+"/.claude/skills"))
wiki={p for p in glob.glob(H+"/selfco/wiki/**/*.md",recursive=True)}
beads=set(json.load(open(os.environ["BEADS_JSON"])))
sk=collections.Counter(); sk90=collections.Counter(); wr=set(); wr90=set(); br=set(); first=last=None
for l in open(H+"/.claude/tool-telemetry.jsonl"):
    x=json.loads(l); ts=x['ts']; first=min(first or ts,ts); last=max(last or ts,ts)
    t=x.get('tool_name'); fp=x.get('file_path','')
    if t=='Skill' and x.get('skill'):
        n=x['skill'].split(':')[-1]; sk[n]+=1
        if ts>=CUT90: sk90[n]+=1
    if t=='Read':
        if fp in wiki: wr.add(fp); (wr90.add(fp) if ts>=CUT90 else None)
        if fp in beads: br.add(fp)
print("ledger window",first,last)
for nm,lst in (("catalog",cat),("home ~/.claude/skills",home)):
    print(nm,len(lst),"zero Skill-tool uses (all):",sum(sk[x]==0 for x in lst),"| zero in last 90d:",sum(sk90[x]==0 for x in lst))
print("wiki pages Read >=1:",len(wr),"of",len(wiki),"| since",CUT90,":",len(wr90))
print("beads Read >=1:",len(br),"of",len(beads))
```

### hooks.py
```python
# hooks.py — run from the core worktree. Counts hook entries; checks each script path resolves; samples 20.
import json,re,os,glob
W=os.getcwd(); H=os.path.expanduser("~"); files=[H+"/.claude/settings.json"]
for d in sorted(glob.glob(H+"/ojfbot/*/")):
    d=d.rstrip('/'); r=W if d.endswith('/ojfbot/core') else d
    if os.path.isdir(d+"/.git") and os.path.exists(r+"/.claude/settings.json"): files.append(r+"/.claude/settings.json")
claims=[]; n=0
for f in files:
    root=H if f.startswith(H+"/.claude/") else f[:-len("/.claude/settings.json")]
    for ev,arr in json.load(open(f)).get("hooks",{}).items():
        for m in arr:
            for h in m.get("hooks",[]):
                n+=1
                for t in sorted(set(re.findall(r'(?:\$CLAUDE_PROJECT_DIR|/Users/yuri)[^\s"\'|;&]*\.(?:sh|mjs|js|py|ts)\b',h.get("command","")))):
                    claims.append((f,root,ev,t))
print("settings files",len(files),"hook entries",n,"script paths",len(claims))
def ok(root,t):
    p=t.replace("$CLAUDE_PROJECT_DIR",root)
    if p.startswith(H+"/ojfbot/core/"): p=W+p[len(H+"/ojfbot/core"):]   # core paths go to the worktree, never the core checkout
    return os.path.exists(p)
claims.sort(key=lambda c:(c[0],c[2],c[3])); k=max(len(claims)//20,1); s=claims[::k][:20]
print("sample",len(s),"pass",sum(ok(c[1],c[3]) for c in s),"| all-claims failing:",sum(not ok(c[1],c[3]) for c in claims))
```

### beads.py
```python
# beads.py — run from the core worktree. Lists top-level .handoff/*.md beads (core = this worktree's tracked files).
import os,re,subprocess,json,sys,collections
W=os.getcwd(); B=os.path.expanduser("~/ojfbot"); out=sys.argv[1]; beads=[]
for d in sorted(os.listdir(B)):
    h=f"{B}/{d}/.handoff"
    if d!="core" and os.path.isdir(f"{B}/{d}/.git") and os.path.isdir(h):
        beads+=[f"{h}/{f}" for f in sorted(os.listdir(h)) if f.endswith(".md") and os.path.isfile(f"{h}/{f}")]
beads+=[f"{W}/{t}" for t in subprocess.run(["git","ls-files",".handoff"],capture_output=True,text=True).stdout.split() if t.endswith(".md") and t.count("/")==1]
json.dump(beads,open(out+"/beads.json","w"))
open(out+"/beads.tsv","w").write("".join(f"{p}\t{p.split('/.handoff/')[0]}\n" for p in beads))
st=collections.Counter(); sup=0; word=0
for p in beads:
    t=open(p,errors="replace").read(); m=re.match(r'---\n(.*?)\n---',t,re.S)
    if m:
        s=re.search(r'^status:\s*(\S+)',m.group(1),re.M); st[s.group(1) if s else None]+=1
        sup+=bool(re.search(r'^(superseded_by|supersedes):',m.group(1),re.M))
    word+=bool(re.search(r'superseded|\bSTALE\b|deprecated',t,re.I))
print("beads",len(beads),"status",dict(st),"with superseded_by/supersedes key",sup,"containing marker word",word)
```
