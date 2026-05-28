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

You **read** the vault through whatever connector is attached, but **writes from a Claude chat go through
the Notion `📥 selfco — Inbox`** — that's the only path that's reliable in 2026:

- **GitHub connector** on the `selfco` repo (`ojfbot/selfco`) — available on web / iPhone / Mac desktop.
  **READ-ONLY in practice.** Use its read-file / search tools to pull source content and existing pages into
  the chat. Do not attempt to create or update files through the connector — its write surface for this
  vault is unreliable (silent failures, partial commits). Use Notion below for writes.
- **Notion `📥 selfco — Inbox`** (DB id `81b8a0f7e97d4052900fac535b035237`) — **the canonical chat→vault
  write path.** Create a **complete** row in this database (`status` is optional — the box files any
  non-terminal row within ~5 min; there is no `draft` hold, so finish the body before you create the row).
  The `selfco-box` daemon polls every 5 min, files matching rows into `~/selfco`, commits, and pushes. See
  `## Writing → Notion` below for the row shape.
- **`mcp-obsidian` server** — on the Mac desktop app only. Tools: `get_file_contents`, `search`,
  `patch_content`, `append_content`, `list_files_in_vault`, `delete_file`. Writes are NOT commits — rely on
  `autocommit.sh`. Available only on the Mac; web + iPhone go through Notion.

**Before doing anything, fetch and read the vault's `CLAUDE.md`** — `selfco/CLAUDE.md` via the GitHub
connector (read-only is fine for this), or `CLAUDE.md` at the vault root via obsidian-mcp. That file is the
**canonical schema**: folder roles (`raw/` = immutable, append-only; `wiki/` = yours; `CLAUDE.md` = schema),
the page schemas (frontmatter + required sections for `source` / `entity` / `concept` / `synthesis` /
`index` / `log`), the slug rules (kebab-case, ojfbot repos use the dir name verbatim), and the workflows.
**Follow `CLAUDE.md`; this file is just the entry point.** If `CLAUDE.md` and this file ever disagree,
`CLAUDE.md` wins.

Layout reminder: `wiki/index.md` (the hub catalog — every page reachable from here), `wiki/log.md`
(append-only ledger, `## [YYYY-MM-DD] <op> | <title>` + bullets — never reorder/edit past entries),
`wiki/sources/`, `wiki/entities/` (people/orgs/products/tools + every ojfbot repo, `kind: repo`),
`wiki/concepts/`, `wiki/synthesis/`. Links are `[[slug]]` / `[[sources/slug]]`.

## Body substance — the whole point

Writes that land **metadata-only rows** (title + tags + empty/one-paragraph body) are the failure mode this
skill exists to prevent. The Notion inbox feeds the `selfco` vault; the vault feeds RAG; **an empty page
contributes nothing to either**. Every row you create must carry a substantive markdown body. This is the
non-negotiable contract of this skill — if you skip it, you've broken the pipeline.

- **Default floor: 500–1000 words of summary content in the body**, regardless of which mode you're in. This
  is what makes the vault page actually useful to future retrieval.
- **Artifacts add on top.** Any draft, outline, code, spec, prompt, plan, notes, or research findings produced
  in the session goes in the body **in full, verbatim, never truncated**. Artifacts don't count toward the
  500–1000 word floor — they're additive.
- **Markdown, not prose-soup.** Use headings (`##`, `###`), bullets, code fences (with language), blockquotes,
  dividers. This lands in Obsidian; the graph, search, and your own readability depend on real structure.
- **Going shorter than 500 words is an opt-out, not the default.** Only acceptable when the entire session
  was genuinely trivial — a single lookup, a one-paragraph clarification, no decisions made, no artifacts
  produced. If you do go shorter, **say so in the TL;DR** ("trivial session, no full summary needed") so the
  user can audit.
- **Self-check before you create the row:** word-count the body. If it's under 500 words and the session
  wasn't trivial, **you've underwritten** — expand the summary with the actual substance of what was
  discussed, and pull in any artifacts you forgot, *before* creating the row (it ingests one-shot; there's no
  `draft` hold to fix it in afterward).
- **Err on the side of more, not less.** This is feeding RAG, not a publishable essay. Length isn't penalized;
  thinness is.

## Modes

### `ingest <path-or-url>`  (the core loop)

**Two paths**, depending on what's attached:

**Path A — Notion Inbox (web / iPhone / anywhere without obsidian-mcp).** This is the default. Create one
row in the `📥 selfco — Inbox` DB with:
- title = the page title
- `status` — optional (the box files any non-terminal row; no `draft` hold)
- `type` = `source` (or `entity` / `concept` / `synthesis` / `note` if you know which schema applies)
- `slug` = the kebab-case filename (optional; the agent will derive one)
- `tags` = the relevant frozen-vocabulary tags
- body = the **full source text or URL content** (not a summary, not a link-only entry, **never empty**). If
  the source itself is short or thin, fill the body out with your own analysis on top of the source text:
  TL;DR, key takeaways, why it matters, related concepts/entities the source touches — aiming for **≥500
  words total** so the vault page is actually useful. Wikilinks as `` `[[some-page]]` `` (inline code so
  Notion doesn't eat the brackets — the poller strips the wrapper). See `## Body substance — the whole
  point` above; this is not optional.

The selfco-box will file it within ~5 min: it writes `raw/<slug>.md` + `wiki/sources/<slug>.md`, touches the
entity/concept/synthesis pages the source bears on, updates `wiki/index.md`, appends a `wiki/log.md` entry,
and commits + pushes. The row flips to `status=promoted` with a `commit ref` + `promoted at` when done.

Tell the user: "Filed a row in the Notion `selfco — Inbox`; the selfco-box will pick it up within 5 minutes
and commit it to `~/selfco`. Watch for `status=promoted` on the row."

**Path B — `mcp-obsidian` (Mac desktop only).** When the Mac obsidian-mcp tools are attached, you can write
directly. Steps:
1. Land the source in `raw/<slug>.md` (binaries → `raw/assets/`); never edit a `raw/` file afterward.
2. Read it. Tell the user the key takeaways; confirm what's worth keeping.
3. Write `wiki/sources/<slug>.md` per the `source` schema in `CLAUDE.md` (TL;DR · Key takeaways · Notable
   quotes/data · Touched pages). Set `raw: raw/<file>` (or `url:` + `retrieved:`), `ingested: <today>`.
4. Update the entity / concept / synthesis pages the source bears on — append new claims with
   `[[sources/<slug>]]` citations; preserve hand-edits.
5. Update `wiki/index.md` and append `## [<today>] ingest | <title>` to `wiki/log.md`.
6. Tell the user: "Writes are uncommitted in `~/selfco`; `git push` from your Mac (or your `autocommit.sh`
   will handle it)."

*Pasted session-handoff bundle?* If what the user gives you is a `--- BEGIN selfco handoff bundle ---` block
(produced by the prompt in `prompts/session-handoff.md` running in a foreign chat like Dia), write it verbatim to
`raw/session-<date>-<slug>.md` first (the source of record), then run the loop over it — each `### ARTIFACT n` →
its own `raw/<artifact-slug>.md` + a `wiki/sources/<artifact-slug>.md`; the bundle's "Suggested vault filing" is a
starting point, not gospel; log it `## [<date>] ingest | <session> (handoff from <agent>)`.

### `handoff`
Fold *this* session into the vault — no copy-paste. Summarize the conversation as if producing the bundle in
`prompts/session-handoff.md` (TL;DR · what was done · findings · decisions · sources · **full text of every artifact
you produced this session** · open threads · filing plan), then file it via the `ingest` path that fits your surface:

- **Web / iPhone / no obsidian-mcp** — create **one** row in the Notion `📥 selfco — Inbox` (`type=source`,
  `slug=session-<date>-<slug>`; `status` optional) whose body is the **full handoff bundle**. The body must
  include, at minimum, these sections (omit none — write "—" or "(none)" if a section genuinely has nothing):
  - **TL;DR** — 3–5 sentences: what the session was for and what it produced
  - **What was done** — **≥200 words of narrative**: the arc of the work, the key turns, the dead ends
  - **Key findings / conclusions** — bullets with substance (each substantive claim notes its basis), not
    section headers with nothing under them
  - **Decisions** — choices made and why (or "—" if none)
  - **Sources referenced** — for each external source or document discussed/used, 1–3 sentences on what it
    is and why it mattered (or "—" if none)
  - **Artifacts produced** — one `### ARTIFACT n — <kind> — <title> — slug: <kebab-slug>` block per item you
    created or co-created in this session (drafts, outlines, code, specs, prompts, plans, notes, etc.).
    Include the **complete verbatim text** of each. **Never summarize an artifact away.** If there were
    genuinely zero artifacts, write "(none)" under this header.
  - **Open threads / next steps** — what's unfinished, what to come back to
  - **Suggested vault filing** — a starting-point filing plan (the daemon will adjust)

  **Target: 500–1000 words across TL;DR + What was done + findings + decisions + sources combined**, plus
  artifacts on top in full (artifacts are additive, not part of the 500–1000 count). See `## Body substance
  — the whole point` above. The selfco-box agent unpacks this bundle: writes `raw/session-<date>-<slug>.md`
  (the full bundle as the source of record), then a `raw/<artifact-slug>.md` + `wiki/sources/<artifact-slug>.md`
  per `### ARTIFACT n`, updates the entity/concept/synthesis pages, refreshes `wiki/index.md`, and appends
  `## [<date>] ingest | <session> (handoff)` to `wiki/log.md`. Tell the user when the row is filed and that
  `status=promoted` confirms the commit.
- **Mac desktop with `mcp-obsidian`** — file the bundle directly as in `ingest` Path B above (one `raw/` for
  the bundle, then one per artifact, then update the wiki pages, then remind the user about `git push`).

`handoff` is `ingest`, where the "source" is this conversation.

### `research <topic>`  (ingest, but you fetch the sources — web-search-capable surfaces only)
Search the web; for each useful source, write it to `raw/<slug>.md` (or record `url:` + `retrieved:` if not
worth archiving), give it a `wiki/sources/` page, then write/update the `wiki/concepts/` or `wiki/synthesis/`
page from those sources. Update `wiki/index.md`; append `## [<today>] research | <topic>` to `wiki/log.md`.
(If this surface can't browse the web, say so and fall back to `ingest` with a source the user supplies.)

Each Notion row you create as part of a research session follows the same body-substance rule as `ingest`:
**full source/retrieved-page text + your summary + key takeaways in the body, ≥500 words**. The
`wiki/concepts/` or `wiki/synthesis/` row that ties the research together should itself be a substantive
body (the actual analysis, not just a list of `[[sources/…]]` links) — this is *the* output of a research
session and is exactly the kind of page that's supposed to be 500–1000 words minimum.

### `query <question>`
1. Search `wiki/` (and `raw/` if a page is thin) for the relevant pages — read them.
2. Answer the user, **citing `[[pages]]` and `[[sources/…]]`** by name. If the wiki can't answer it, say so and
   suggest what to `ingest` / `research`.
3. If the answer was a substantive exploration, **file it back** as a new `wiki/synthesis/` (or `wiki/concepts/`)
   page, link it from `wiki/index.md`, and append `## [<today>] query | <question>` to `wiki/log.md`. A one-off
   lookup doesn't need a page.

### `note <title>`
Quick capture from the conversation → `raw/<slug>.md` (it's a source you authored; `ingest` it later). **The
body must contain the actual captured material** — the thought, the snippet, the observation, the user's
exact words if they were quoting themselves — not just a one-line summary or the title repeated. If the user
said "note X", **X belongs in the body**. If the capture is genuinely a single sentence, that's fine (this
is the one mode where short is sometimes correct) — set `type=note` so the daemon files it accordingly. If
the user says it's a finished thought, you may instead create the appropriate `wiki/<type>/` page directly,
in which case the body follows the 500–1000-word substance rule like every other mode.

### `orient`
Read `wiki/index.md` + the most recent entries in `wiki/log.md` (and `wiki/synthesis/cluster-status.md` if it
exists). Surface: what areas the wiki covers, which ojfbot repos are active vs scaffold vs dormant, open research
threads, what was last ingested/synced, anything thin. Use at the *start* of a session in the apps.

### Not here — `init` / `sync`
`init` (scaffold the vault) and `sync` (fold in the ojfbot activity feed — git history, `.handoff/` beads,
Claude session telemetry) need the python helper scripts + the ojfbot repos on disk + git. They run in **Claude
Code on the Mac** (`/vault init` / `/vault sync`). If the user asks for those here, tell them to run them there.

## Constraints
- **Body substance is non-negotiable.** Metadata-only rows (title + tags + empty/stub body) defeat the entire
  purpose of the pipeline. See `## Body substance — the whole point` above. Word-count the body before creating
  the row (it ingests one-shot — no `draft` hold); if it's under 500 words and the session wasn't trivial, you've underwritten.
- Read `CLAUDE.md` first (it's the schema); never touch `raw/` after creating a file; never reorder/edit past
  `wiki/log.md` entries; never overwrite a hand-edited page (treat user edits as authoritative); link, don't copy
  (ADRs/beads/articles referenced by path/link, never pasted); never write credentials or `.env` contents anywhere.
- Keep page frontmatter + section structure exact (the Obsidian graph's colour groups and the index/log automation
  depend on it).
- Output a short report: pages created / updated (one line each), **body word count for each Notion row you
  wrote**, the new `log.md` entry's title, and — for the obsidian-mcp path — the reminder to `git push` from
  the Mac.

## See also (in the `core` repo, on the Mac)
- `core/.claude/skills/vault/knowledge/connectors.md` — connector setup (GitHub / mcp-obsidian / the future
  Cloudflare-tunneled obsidian-mcp), the sync model, the autocommit helper
- `core/.claude/skills/vault/vault.md` — the full Claude-Code `/vault` skill (init/sync/research too)
- `core/decisions/adr/0069-*.md`, `0070-*.md` — the vault design + the multi-surface-access design
- the vault's own `CLAUDE.md` — the schema (the thing to actually follow)
- Karpathy's "LLM Wiki" gist — the pattern this implements
