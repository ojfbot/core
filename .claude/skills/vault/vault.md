---
name: vault
description: >
  Maintain the `selfco` LLM Wiki at ~/selfco — an Obsidian vault following Karpathy's LLM-Wiki pattern
  (gist karpathy/442a6bf555914893e9891c11519de94f): an append-only `raw/` source layer and an LLM-owned
  `wiki/` of source / entity / concept / synthesis pages + index.md + log.md, with `~/selfco/CLAUDE.md`
  as the schema. Use when the user says "ingest this <file/url>", "ingest <url>", "research and file this",
  "query my wiki / what does my wiki say about X", "lint the wiki", "sync my vault", "what does my vault
  know", "init my vault", "selfco", "second brain", or wants to be oriented from the wiki. Modes: `init`
  (scaffold raw/+wiki/, write the in-vault CLAUDE.md, fetch Obsidian plugins, seed a repo entity stub per
  ojfbot repo), `ingest <path|url>` (land a source in raw/ — incl. YouTube videos via transcript — summarize, update entity/concept pages, index,
  log), `research <topic>` (active web/context7 research → raw/ + source page → concept/synthesis page),
  `query <question>` (answer from the wiki with citations, file substantive explorations back), `lint`
  (health-check the wiki), `cultivate` (the serendipity pass — hunt cross-cluster connections, weave links,
  author ≤2–3 synthesis pages; runs daily on the selfco-box), `sync [--since=7d]` (fold the ojfbot activity
  feed into repo entity pages),
  `handoff` (fold the current session into the vault — summary + full text of every artifact), `orient`,
  `note <title>`. There's also a copy-paste export prompt at `~/selfco/prompts/session-handoff.md` for
  foreign chat agents (Dia, claude.ai). Deterministic scripts read/scaffold; the LLM authors all pages.
  Distinct from /daily-logger (chronological blog) and /bead (per-repo handoff).
---

# /vault — the `selfco` LLM Wiki

**Tier:** 1 — context load + multi-step procedure
**Phase:** meta

A thin wrapper over the LLM-Wiki schema that lives **in the vault** at `${SELFCO_VAULT:-$HOME/selfco}/CLAUDE.md`.
That file is the operating manual; this skill runs the helper scripts and follows it. **Always read
`${SELFCO_VAULT:-$HOME/selfco}/CLAUDE.md` first** when invoked (after `init`, it exists). If the vault doesn't
exist yet, only `init` is valid — tell the user to run `/vault init`.

`$ARGUMENTS` is `<mode> [args]`. Vault path: `${SELFCO_VAULT:-$HOME/selfco}` (call it `$V`). Skill scripts:
`{skill}/scripts/`. Karpathy's pattern: **"Obsidian is the IDE; the LLM is the programmer; the wiki is the
codebase."** You own `wiki/`; the user reads it.

## Core principles (see `knowledge/wiki-schema.md` + `$V/CLAUDE.md` for the full schema)

- **`raw/` is append-only and immutable.** You read it; you never edit or delete it. New material is *added*.
- **`wiki/` is yours to maintain.** Pages: `wiki/sources/`, `wiki/entities/`, `wiki/concepts/`, `wiki/synthesis/`,
  plus `wiki/index.md` (the hub catalog) and `wiki/log.md` (append-only ledger, `## [YYYY-MM-DD] <op> | <title>`).
- **Link, don't copy.** ojfbot ADRs/beads, daily-logger articles, source files — referenced by path/link, never
  pasted into a page.
- **Scripts read; the LLM writes.** `init-vault.py` scaffolds + writes the in-vault `CLAUDE.md`; `collect.py`
  produces a read-only activity digest; `install-obsidian-plugins.sh` fetches plugins; `lint.py`/`ingest.py` are
  deterministic helpers. All page authoring/synthesis is done by you, here.
- **Idempotent, non-destructive.** Re-running `init` only adds what's missing. Never overwrite a hand-edited page;
  treat user edits as authoritative. `log.md` and `raw/` are append-only — nothing deletes from them.
- **Mind the git mirror.** `~/selfco` is pushed to a private GitHub repo (`ojfbot/selfco`) — that mirror is what the
  Claude *apps* (web / iPhone / Mac desktop) reach via the GitHub connector, and writes from there land as commits.
  So when this skill writes from the Mac: `git -C $V pull --rebase --autostash` *before*, and `git -C $V push`
  *after* its commit, whenever `$V` has a remote (the scripts do this; do it yourself if writing pages directly).
- **No secrets.** Never write tokens, `.env` values, or credentials into the vault.
- **Don't call it a "second brain."** "The vault" / "the wiki" / "source, entity, concept, synthesis pages".

## Modes

### `init`
`python {skill}/scripts/init-vault.py` — scaffolds `raw/` + `wiki/{sources,entities,concepts,synthesis}`, seeds
`wiki/index.md` and an empty `wiki/log.md`, writes `$V/CLAUDE.md` (the schema, from `templates/vault-claude-md.md`),
writes `.obsidian/` config (path-keyed `graph.json`, `community-plugins.json`, templates), `$V/README.md`,
`.gitignore`, `git init`s, fetches the Obsidian plugins (`install-obsidian-plugins.sh`), and seeds a
`wiki/entities/<repo>.md` stub (`kind: repo`, ports from each repo's `CLAUDE.md`) for every `~/ojfbot/*/.git` repo
(skips worktrees). Idempotent. Then summarize what was created and tell the user to open `~/selfco` in Obsidian and
to run `/vault sync`.

### `ingest <path-or-url>`
Karpathy's core loop (full procedure in `$V/CLAUDE.md` § Workflows):
1. **Land it in `raw/`.** Local file → copy/move into `raw/` (binaries → `raw/assets/`). URL → download to
   `raw/<slug>.md` (+ assets); `ingest.py` can help (`python {skill}/scripts/ingest.py <url>` downloads + stubs the
   source page). **YouTube URLs are handled automatically** (`youtube.com/watch`, `youtu.be/`, `youtube.com/shorts/…`):
   `ingest.py` detects them and pulls the transcript via `yt-dlp` (manual captions preferred, auto-generated
   fallback) instead of `curl`, cleaning it to readable speaker-split text with a metadata header. Requires `yt-dlp`
   on PATH (`brew install yt-dlp`); degrades gracefully with an actionable error if absent or if the video has no
   English captions. Opinionated talks/podcasts → fill the source page with `templates/article-ingest.md` (Critique +
   Bridge). Never modify the raw file afterward.
2. **Read it; discuss the key takeaways with the user** before writing.
3. **Write `wiki/sources/<slug>.md`** (from `templates/source.md`) — TL;DR, key takeaways, notable quotes/data.
4. **Update the wiki** — create/update every `entities/`, `concepts/`, `synthesis/` page the source bears on (be
   willing to touch 10–15), adding claims with `[[sources/<slug>]]` citations; fix cross-refs.
5. **Update `wiki/index.md`** (new pages + refreshed one-liners).
6. **Append `## [YYYY-MM-DD] ingest | <title>` to `wiki/log.md`** listing what changed.
Report the diff. Then commit: `git -C $V pull --rebase --autostash` (if remote) → `git -C $V add -A && git commit -m "vault: ingest …"` → `git -C $V push` (if remote). Suggest it; do it if the user is hands-off.
*Pasted session-handoff bundle?* If the source is a `--- BEGIN selfco handoff bundle ---` block (from `prompts/session-handoff.md` run in a foreign chat), write it verbatim to `raw/session-<date>-<slug>.md` first (that's the source of record), then run the loop over it — each `### ARTIFACT n` → its own `raw/<artifact-slug>.md` + a `wiki/sources/<artifact-slug>.md`; the bundle's "Suggested vault filing" is a starting point, not gospel; log it as `## [date] ingest | <session> (handoff from <agent>)`.

### `handoff`
Fold *this* Claude session into the vault — no copy-paste. Summarize the session as if producing the bundle in
`{V:-~/selfco}/prompts/session-handoff.md` (TL;DR · what was done · findings · decisions · sources · **full text of
every artifact** you produced this session · open threads · filing plan), then file it directly: write
`raw/session-<date>-<slug>.md` (the bundle, as the source of record) + each artifact to its own `raw/<slug>.md` + a
`wiki/sources/<slug>.md` summary for each; create/update the `wiki/concepts/`·`wiki/synthesis/`·`wiki/entities/`
pages it bears on (claims cite the source pages); refresh `wiki/index.md`; append `## [date] ingest | <session>
(handoff)` to `wiki/log.md`; commit (pull --rebase / push if remote). It's `ingest`, where the "source" is this
conversation. (For exporting a *foreign* chat's session: that's the copy-paste prompt in `prompts/session-handoff.md`
— give the user that, then `ingest` the bundle they bring back.)

### `research <topic>`
Like `ingest`, but you fetch the sources: `WebSearch` / `WebFetch` / `mcp__plugin_context7_context7__*` for current
material. For each useful source: save it into `raw/` (or record `url:` + `retrieved:` if not worth archiving), give
it a `wiki/sources/` page, then write/update the `concepts/` or `synthesis/` page from those sources. Update
`wiki/index.md`; append `## [date] research | <topic>` to `wiki/log.md`.

### `query <question>`
1. Search `wiki/` (and `raw/` if a page is thin) for relevant pages.
2. Answer the user **citing `[[pages]]` / `[[sources/…]]`**. If the wiki can't answer it, say so and suggest what to
   `ingest`/`research`.
3. If the exploration was substantive, **file it back** as a new `wiki/synthesis/` (or `wiki/concepts/`) page, link
   it from `index.md`, and append `## [date] query | <question>` to `wiki/log.md`. One-off lookups don't need a page.

### `lint [--fix]`
`python {skill}/scripts/lint.py` for the deterministic part (orphan pages, `raw/` items with no `sources/` page,
broken `[[links]]`); you do the semantic part — contradictions between pages, claims superseded by newer sources,
missing cross-refs, data gaps. Report findings grouped by type. Only mutate the wiki if `--fix` (or the user says
so), then append `## [date] lint | <n findings, m fixed>` to `wiki/log.md`.
With `--gate` (adr:lint-shadow-to-gate) the script exits 1 on the two deterministic blocking classes — broken
`[[links]]` and raw-without-source (orphans/stale stay advisory) — and never fixes anything; the selfco-box runs
it pre-commit on its push path. Escape valve: `SELFCO_LINT_GATE_OVERRIDE=1`.

### `cultivate`
The serendipity pass — `lint` keeps the wiki correct; `cultivate` makes it compound (full procedure in
`$V/CLAUDE.md` § Workflows). Runs unattended daily on the selfco-box (`selfco-box cultivate`, vendored
procedure: `selfco-box/src/prompts/cultivate-procedure.md`) and on demand here. Two candidate channels
feed the run, both suggestion-only into `wiki/_suggested-links.md`: `lint.py --suggest-links`
(structural, Adamic-Adar on co-citation) and `semantic-suggest.py` (embeddings; prototype,
adr:semantic-link-suggester — surfaces pairs with ZERO shared citations, the ones co-citation is blind
to; Voyage embeddings with `$VOYAGE_API_KEY`, labelled TF-IDF fallback without):
1. Orient on the delta — `wiki/index.md` + `wiki/log.md` entries since the last `cultivate` entry.
2. Read 2–4 mutually-unlinked clusters *together*; hunt non-obvious connections (shared mechanisms,
   transferable methods, contradictions, same idea under two names).
3. **Weave before you write** — enrich existing pages with `[[links]]` + a sentence of *why*; 10–15 page
   touches beat one new page.
4. Author **≤ 2–3 new `synthesis/` pages**, each with a real thesis + claims citing ≥ 2 distinct
   `[[sources/…]]`. Restatement of an existing page → extend that page instead.
5. Update `wiki/index.md`; append `## [date] cultivate | <summary>` to `wiki/log.md` **including a
   "Considered, declined" list**. **Empty run = success state** — "no connections above threshold" is a
   valid, logged outcome. Never pad (Goodhart guardrail).
Commit (pull --rebase --autostash → add/commit → push, if remote).

### `sync [--since=7d]`
The ojfbot activity feed (see `knowledge/wiki-schema.md` for the data sources):
1. `python {skill}/scripts/collect.py --since=<window>` → JSON digest (sessions, per-repo git, skills, beads,
   ADR list, any `## [date] session | …` stub lines in `wiki/log.md`).
2. For each repo with activity: update `wiki/entities/<repo>.md` — **Current state** + **Open threads**, append to a
   recent-work list (terse, link-heavy: bead paths, commit subjects, `[[sources/sync-<date>]]`), set `status:` /
   `last_synced:`. Create from `templates/entity.md` (`kind: repo`) if missing.
3. Write `wiki/sources/sync-YYYY-MM-DD.md` summarizing the window; refresh `wiki/index.md`.
4. Fold the hook's `## [date] session | …` stub lines into that day's context (don't delete them — `log.md` is
   append-only), then append `## [date] sync | …`.
Report the diff; commit (pull --rebase --autostash if remote → add -A && commit → push if remote). Tip: start the
mode with the pull so you fold in any web/iPhone-originated writes before re-running `collect.py`.

### `orient`
Read `wiki/index.md` + the most recent entries in `wiki/log.md`; surface what the wiki knows — active repos, open
research threads, recent ingests/syncs, anything thin. Use at the *start* of a session.

### `note <title> [--raw | --<type>]`
Quick capture from the current conversation. Default → `raw/<slug>.md` (it's a source you authored; later `ingest`
it). `--<type>` (entity|concept|synthesis) → create that `wiki/<type>/` page directly.

## Working from the Claude apps (web / iPhone / Mac desktop)

This skill is Claude-Code-only. For the consumer apps there's a **tool-agnostic `/vault` Agent Skill** at
`{skill}/consumer/SKILL.md` (uploadable to the Anthropic account — see `{skill}/consumer/README.md` and
`{skill}/knowledge/connectors.md`). It covers `ingest` / `query` / `note` / `orient` / `handoff` (`init` / `sync` /
full web-`research` stay here — they need the python scripts + the ojfbot repos on disk + git). To capture a session
in a chat agent that has *no* connector at all (Dia, plain claude.ai), use the copy-paste prompt
`{V:-~/selfco}/prompts/session-handoff.md` (canonical source: `{skill}/templates/session-handoff-prompt.md`) — it
makes that agent emit a `--- BEGIN selfco handoff bundle ---` block; bring it back here and `/vault ingest` it.
The Agent Skill reads the vault's
`CLAUDE.md` for the schema and writes via whatever vault tools the app has — the **GitHub connector** (`ojfbot/selfco`
repo; works on web + iPhone + desktop; each write is a commit) or a **local `mcp-obsidian` server** (Mac desktop;
live Obsidian index). GitHub is the source of truth; `~/selfco` on the Mac is a clone — keep it pulled/pushed (this
skill does; `{skill}/scripts/autocommit.sh` covers writes that bypass it).

## Output format

```
## /vault <mode>
Vault: ~/selfco  (LLM Wiki)

- raw/:     <files added>
- wiki/:    <pages created / updated — one line each>
- log.md:   <the new entry's title>

Next: <one suggestion — e.g. "open ~/selfco in Obsidian", "/vault lint", "git commit">
```

## Constraints

- MUST read `$V/CLAUDE.md` before acting (once it exists). The in-vault schema wins if it ever disagrees with this file.
- MUST NOT edit or delete anything in `raw/`. MUST NOT reorder/edit existing `wiki/log.md` entries.
- MUST NOT overwrite hand-edited wiki pages — treat user edits as authoritative.
- MUST NOT paste ADR/bead/article/source bodies into wiki pages — link only.
- MUST NOT write credentials/`.env` contents anywhere in the vault.
- MUST keep page frontmatter + section structure per the schema (graph color groups + index/log automation depend on it).
- `init` and `sync` MUST be safe to run repeatedly.

## Composition

- After `/bead` (per-repo handoff written) → `/vault sync` folds it into the repo's entity page.
- `/handoff` is orthogonal (one module's runbook); `/vault` is the cross-project compiled knowledge.
- Not a replacement for `/daily-logger` (published chronological blog) — complementary; a source/session page may
  *link* a daily-logger article.

---

## See Also

- `${SELFCO_VAULT:-$HOME/selfco}/CLAUDE.md` — **the schema** (operating manual; generated from `templates/vault-claude-md.md`)
- `knowledge/wiki-schema.md` — dev summary of the schema + the `sync` data sources
- `knowledge/obsidian-graph-setup.md` — graph-UI tuning (path color groups), Excalibrain/mindmap/Graphify, the Karpathy gist
- `knowledge/connectors.md` — reaching the vault from the Claude apps (GitHub connector / mcp-obsidian / Phase-B tunnel)
- `consumer/SKILL.md` + `consumer/README.md` — the consumer-app `/vault` Agent Skill (ingest/query/note/orient/handoff)
- `templates/{vault-claude-md,source,entity,concept,synthesis,session-handoff-prompt}.md`
- `scripts/{init-vault.py, migrate-v1.py, collect.py, install-obsidian-plugins.sh, lint.py, semantic-suggest.py, ingest.py, autocommit.sh}` — `ingest.py` auto-detects YouTube URLs and lands the transcript in `raw/` via `yt-dlp` (`brew install yt-dlp`)
- `${SELFCO_VAULT:-$HOME/selfco}/prompts/session-handoff.md` — the copy-paste session-export prompt (seeded by `init`)
- ADR-0085 (`decisions/adr/0085-selfco-vault-and-skill.md`) + ADR-0070 (`…/0070-vault-multi-surface-access.md`), `domain-knowledge/selfco-vault.md`
- Karpathy's LLM Wiki: <https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>
