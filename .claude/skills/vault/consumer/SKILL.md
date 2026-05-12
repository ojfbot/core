---
name: vault
description: >
  Maintain the user's "selfco" LLM Wiki (Karpathy pattern: an append-only `raw/` source layer + an
  LLM-owned `wiki/` of source/entity/concept/synthesis pages + index.md + log.md, with `CLAUDE.md` as
  the schema). Use this whenever the user says "ingest this <file/url> into my vault / wiki", "ingest
  <url>", "add this to my selfco wiki", "research and file this", "query my wiki / what does my vault
  say about X", "what does the wiki know about <repo/topic>", "selfco", "second brain", or asks to be
  oriented from the vault. Modes: `ingest <path|url>` (land a source in raw/, write a summary page,
  update the entity/concept pages it bears on, update index.md, append a log entry) · `query <q>`
  (answer from the wiki with [[page]] citations; file substantive explorations back) · `note <title>`
  (quick capture to raw/) · `orient` (read index.md + recent log.md, surface what the wiki knows) · `handoff`
  (fold THIS session into the vault — summary + full text of every artifact). To export a session from a chat
  agent with no connector at all (Dia, plain claude.ai), the user copies the prompt in `prompts/session-handoff.md`
  instead. Requires a vault connector — the GitHub connector on the `selfco` repo (web / mobile / desktop) or a
  local obsidian-mcp server (Mac desktop). NOT for `init`/`sync` (those run in Claude Code on the Mac).
---

# /vault — selfco LLM Wiki (consumer-app edition)

This is the Claude-apps companion to the `/vault` Claude-Code skill. It lets you tend the **selfco** vault
from claude.ai web, the Claude iPhone app, or the Claude Desktop Mac app — anywhere a vault connector is
attached. The Karpathy pattern: *"Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."*
You curate sources; you (the model) own `wiki/`.

## Step 0 — figure out your vault tools, then read the schema

You write to the vault through **whatever connector is attached**:
- **GitHub connector** on the `selfco` repo (`ojfbot/selfco`) — available on web / iPhone / Mac desktop.
  Use its read-file / search / create-or-update-file tools. **Every write is a commit** — no extra step.
- **`mcp-obsidian` server** — on the Mac desktop app. Tools: `get_file_contents`, `search`, `patch_content`
  (insert into an existing note), `append_content`, `list_files_in_vault`, `delete_file`. Writes are NOT
  commits — at the end, tell the user to `git push` from their Mac (or rely on their `autocommit.sh`).

**Before doing anything, fetch and read the vault's `CLAUDE.md`** — `selfco/CLAUDE.md` via the GitHub
connector, or `CLAUDE.md` at the vault root via obsidian-mcp. That file is the **canonical schema**: folder
roles (`raw/` = immutable, append-only; `wiki/` = yours; `CLAUDE.md` = schema), the page schemas (frontmatter
+ required sections for `source` / `entity` / `concept` / `synthesis` / `index` / `log`), the slug rules
(kebab-case, ojfbot repos use the dir name verbatim), and the workflows. **Follow `CLAUDE.md`; this file is
just the entry point.** If `CLAUDE.md` and this file ever disagree, `CLAUDE.md` wins.

Layout reminder: `wiki/index.md` (the hub catalog — every page reachable from here), `wiki/log.md`
(append-only ledger, `## [YYYY-MM-DD] <op> | <title>` + bullets — never reorder/edit past entries),
`wiki/sources/`, `wiki/entities/` (people/orgs/products/tools + every ojfbot repo, `kind: repo`),
`wiki/concepts/`, `wiki/synthesis/`. Links are `[[slug]]` / `[[sources/slug]]`.

## Modes

### `ingest <path-or-url>`  (the core loop)
1. **Land the source in `raw/`.** A URL → fetch it (or have the user paste it) and write it to `raw/<slug>.md`
   (binaries → `raw/assets/`); a pasted document → `raw/<slug>.md`. Never edit a `raw/` file afterward.
2. **Read it. Tell the user the key takeaways** and confirm what's worth keeping.
3. **Write `wiki/sources/<slug>.md`** per the `source` schema in `CLAUDE.md` (TL;DR · Key takeaways · Notable
   quotes/data · Touched pages). Set `raw: raw/<file>` (or `url:` + `retrieved:`), `ingested: <today>`.
4. **Update the wiki.** Create or update every `wiki/entities/`, `wiki/concepts/`, `wiki/synthesis/` page the
   source bears on — be willing to touch 10–15 — adding the new claims with `[[sources/<slug>]]` citations and
   fixing cross-references. (Read the existing page first; preserve hand-edits; append rather than rewrite when
   in doubt.)
5. **Update `wiki/index.md`** — add the new pages under the right category sections, refresh the one-liners.
6. **Append `## [<today>] ingest | <title>` to `wiki/log.md`** listing exactly what you created/updated.
7. **Commit** — GitHub connector: already done (one commit per write — that's fine, or squash if your tool can).
   obsidian-mcp: tell the user "writes are uncommitted in `~/selfco`; `git push` from your Mac (or your
   autocommit handles it)."

*Pasted session-handoff bundle?* If what the user gives you is a `--- BEGIN selfco handoff bundle ---` block
(produced by the prompt in `prompts/session-handoff.md` running in a foreign chat like Dia), write it verbatim to
`raw/session-<date>-<slug>.md` first (the source of record), then run the loop over it — each `### ARTIFACT n` →
its own `raw/<artifact-slug>.md` + a `wiki/sources/<artifact-slug>.md`; the bundle's "Suggested vault filing" is a
starting point, not gospel; log it `## [<date>] ingest | <session> (handoff from <agent>)`.

### `handoff`
Fold *this* session into the vault — no copy-paste. Summarize the conversation as if producing the bundle in
`prompts/session-handoff.md` (TL;DR · what was done · findings · decisions · sources · **full text of every artifact
you produced this session** · open threads · filing plan), then file it directly: write `raw/session-<date>-<slug>.md`
(the bundle, as the source of record) + each artifact to its own `raw/<slug>.md` + a `wiki/sources/<slug>.md` summary;
create/update the `wiki/concepts/`·`wiki/synthesis/`·`wiki/entities/` pages it bears on (claims cite the source pages);
refresh `wiki/index.md`; append `## [<date>] ingest | <session> (handoff)` to `wiki/log.md`; commit per step 7. It's
`ingest`, where the "source" is this conversation.

### `research <topic>`  (ingest, but you fetch the sources — web-search-capable surfaces only)
Search the web; for each useful source, write it to `raw/<slug>.md` (or record `url:` + `retrieved:` if not
worth archiving), give it a `wiki/sources/` page, then write/update the `wiki/concepts/` or `wiki/synthesis/`
page from those sources. Update `wiki/index.md`; append `## [<today>] research | <topic>` to `wiki/log.md`.
(If this surface can't browse the web, say so and fall back to `ingest` with a source the user supplies.)

### `query <question>`
1. Search `wiki/` (and `raw/` if a page is thin) for the relevant pages — read them.
2. Answer the user, **citing `[[pages]]` and `[[sources/…]]`** by name. If the wiki can't answer it, say so and
   suggest what to `ingest` / `research`.
3. If the answer was a substantive exploration, **file it back** as a new `wiki/synthesis/` (or `wiki/concepts/`)
   page, link it from `wiki/index.md`, and append `## [<today>] query | <question>` to `wiki/log.md`. A one-off
   lookup doesn't need a page.

### `note <title>`
Quick capture from the conversation → `raw/<slug>.md` (it's a source you authored; `ingest` it later). If the
user says it's a finished thought, you may instead create the appropriate `wiki/<type>/` page directly.

### `orient`
Read `wiki/index.md` + the most recent entries in `wiki/log.md` (and `wiki/synthesis/cluster-status.md` if it
exists). Surface: what areas the wiki covers, which ojfbot repos are active vs scaffold vs dormant, open research
threads, what was last ingested/synced, anything thin. Use at the *start* of a session in the apps.

### Not here — `init` / `sync`
`init` (scaffold the vault) and `sync` (fold in the ojfbot activity feed — git history, `.handoff/` beads,
Claude session telemetry) need the python helper scripts + the ojfbot repos on disk + git. They run in **Claude
Code on the Mac** (`/vault init` / `/vault sync`). If the user asks for those here, tell them to run them there.

## Constraints
- Read `CLAUDE.md` first (it's the schema); never touch `raw/` after creating a file; never reorder/edit past
  `wiki/log.md` entries; never overwrite a hand-edited page (treat user edits as authoritative); link, don't copy
  (ADRs/beads/articles referenced by path/link, never pasted); never write credentials or `.env` contents anywhere.
- Keep page frontmatter + section structure exact (the Obsidian graph's colour groups and the index/log automation
  depend on it).
- Output a short report: pages created / updated (one line each), the new `log.md` entry's title, and — for the
  obsidian-mcp path — the reminder to `git push` from the Mac.

## See also (in the `core` repo, on the Mac)
- `core/.claude/skills/vault/knowledge/connectors.md` — connector setup (GitHub / mcp-obsidian / the future
  Cloudflare-tunneled obsidian-mcp), the sync model, the autocommit helper
- `core/.claude/skills/vault/vault.md` — the full Claude-Code `/vault` skill (init/sync/research too)
- `core/decisions/adr/0069-*.md`, `0070-*.md` — the vault design + the multi-surface-access design
- the vault's own `CLAUDE.md` — the schema (the thing to actually follow)
- Karpathy's "LLM Wiki" gist — the pattern this implements
