# selfco — an LLM Wiki

This vault follows Andrej Karpathy's **LLM Wiki** pattern (gist: `karpathy/442a6bf555914893e9891c11519de94f`):

> **"Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."**

You curate raw material and direct the analysis. **The LLM owns and maintains `wiki/`** — it writes it; you read it. The tedious part of a knowledge base is the bookkeeping (cross-references, indexes, keeping pages consistent), and that's exactly what the LLM does well.

This file is the **schema** — the operating manual any agent should follow when working in this vault. The `/vault` skill in `ojfbot/core` wraps these workflows with helper scripts; **if you don't have that skill, just follow this file directly.**

---

## Folder roles

| Path | Owner | Rule |
|---|---|---|
| `raw/` | **You** (append-only) | Immutable source materials — articles, PDFs, clippings, chat/research dumps, notes you authored. The single source of truth for everything the wiki has ever read. The LLM **reads `raw/` but never edits or deletes it.** New material is *added*, never changed. `raw/assets/` holds images/PDFs/binaries. |
| `wiki/` | **The LLM** | The compiled, interlinked knowledge. The LLM creates, updates, cross-references, and reorganizes pages here freely — keeping everything consistent. You read it; you don't normally hand-edit it (if you do, the LLM treats your edits as authoritative and works around them). |
| `CLAUDE.md` (this file) | Shared | The schema. Change it deliberately; the `/vault` skill regenerates it from `core/.claude/skills/vault/knowledge/wiki-schema.md` on `init`. |
| `templates/` | Shared | Page scaffolds matching the schemas below. |
| `prompts/` | Shared | Reusable prompts kept in the vault. `session-handoff.md` — copy its body into a foreign chat agent (Dia, claude.ai) to export *that* session as a handoff bundle. |
| `.obsidian/` | Shared | Obsidian config — tuned graph view (color groups by folder), bundled plugins. Open this folder in Obsidian to browse the wiki as a graph; Excalibrain gives the orbit-around-a-note view. |

`raw/` ≈ Karpathy's raw sources; `wiki/` ≈ the wiki; this file ≈ the schema. There is no `Areas/` or `Sessions/` — that was a v1 layout, now folded into `wiki/`.

---

## `wiki/` structure

```
wiki/
  index.md              # master catalog — every page, one-line summary, grouped by category. The hub.
  log.md                # append-only ledger of operations. Never edited or reordered.
  sources/<slug>.md     # one summary page per item in raw/ (and per "virtual source" — see below)
  entities/<slug>.md    # people, organizations, products, tools — and every ojfbot repo (kind: repo)
  concepts/<slug>.md    # ideas, frameworks, theories, methods
  synthesis/<slug>.md   # comparisons, themes, roadmaps, cross-cutting analyses
```

**Slugs** are kebab-case ASCII, no leading dates (e.g. `llm-wiki`, `andrej-karpathy`, `obsidian-graph-uis`, `cv-builder`). For ojfbot repos the slug is the repo directory name verbatim. Wikilinks use the slug: `[[llm-wiki]]`, `[[cv-builder]]`, `[[sources/karpathy-llm-wiki]]`.

**Virtual sources** — not everything in `raw/` is a file. The ojfbot activity feed (git history, `.handoff/` beads, daily-logger articles, Claude session telemetry) and each `/vault sync` run are treated as sources too: they get a `wiki/sources/sync-YYYY-MM-DD.md` page (or similar) and a `log.md` entry, but the underlying data is referenced by path/link, not copied into `raw/`.

---

## Page schemas

Every page has YAML frontmatter, an `Up: [[index]]` line, and the sections below. Keep them — Obsidian's graph color groups key on the folder, and the index/log automation keys on frontmatter. Empty sections are fine; omitted is better than padded.

### `wiki/sources/<slug>.md` — a source summary
```yaml
---
type: source
raw: raw/<file>            # the file in raw/  — OR —
url: https://…             # for a web source
retrieved: YYYY-MM-DD      # (with url:)
ingested: YYYY-MM-DD
tags: [topic, …]
---
```
`Up: [[index]]` · **TL;DR** (2–4 sentences) · **Key takeaways** (bullets) · **Notable quotes / data** · **Links** (every URL backing this source — full clickable `https://…` links; the frontmatter `url:` is the primary, list it + every corroborating outlet here, even when the material is also archived in `raw/`) · **Touched pages** (`[[entities/…]]`, `[[concepts/…]]`, `[[synthesis/…]]` this source updated)

### `wiki/entities/<slug>.md` — a person / org / product / tool / repo
```yaml
---
type: entity
kind: person | org | product | tool | repo
# for kind: repo, also:
repo: <repo-slug>
ports: [<dev>, <preview>]
status: unstarted | active | paused | shipped | archived
last_synced: YYYY-MM-DD
tags: [topic, …]
---
```
`Up: [[index]]` · **What it is** · **Current state** (for repos: filled by `/vault sync` from git/telemetry/beads) · **Relationships** (`[[…]]` — what it builds on, consumes, competes with) · **Sources** (`[[sources/…]]` — include the primary external URL inline, e.g. `- [[sources/foo]] — Publisher: https://…`, so the page is clickable without a hop) · **Open threads**

### `wiki/concepts/<slug>.md` — an idea / framework / theory
```yaml
---
type: concept
status: seedling | growing | evergreen
tags: [topic, …]
---
```
`Up: [[index]]` · **Definition** · **Why it matters** · **How it works / key claims** (each claim → a `[[sources/…]]`) · **Related** (`[[…]]`) · **Open questions**

### `wiki/synthesis/<slug>.md` — a comparison / theme / analysis / roadmap
```yaml
---
type: synthesis
tags: [topic, …]
---
```
`Up: [[index]]` · **Question / thesis** · **Comparison / analysis** · **Sources** (`[[sources/…]]` — include the primary external URL inline, e.g. `- [[sources/foo]] — Publisher: https://…`, so the page is clickable without a hop) · **Implications**

### `wiki/index.md` — the master catalog
```yaml
---
type: index
---
```
`# selfco — index` · short blurb · then a section per category (**Entities**, **Concepts**, **Synthesis**, **Sources**, **ojfbot ADRs**, …), each entry `- [[slug]] — one-line summary`. Every page in `wiki/` must be reachable from here. This page is intentionally link-dense — it's the big hub node in the graph.

### `wiki/log.md` — the operation ledger (append-only)
```
# selfco — log

## [2026-05-12] ingest | Karpathy LLM Wiki
- raw/karpathy-llm-wiki.md → wiki/sources/karpathy-llm-wiki.md
- created wiki/concepts/llm-wiki.md, wiki/entities/andrej-karpathy.md
- updated wiki/index.md

## [2026-05-11] sync | first /vault sync
- ...
```
Ops: `ingest` · `research` · `query` · `lint` · `sync` · `session` · `init`. **Never edit or reorder existing entries** — a correction is a new entry.

---

## Workflows

### `ingest <path-or-url>` — the core loop
1. **Land the source in `raw/`.** A local file → copy/move it into `raw/` (binaries → `raw/assets/`). A URL → download it to `raw/<slug>.md` (plus any assets). Never modify it afterward.
2. **Read it. Discuss the key takeaways with me** before writing — confirm what's worth keeping.
3. **Write `wiki/sources/<slug>.md`** — TL;DR + key takeaways + notable quotes/data + a **`## Links`** section listing *every* URL that backs the source (primary + each corroborating outlet), as full clickable `https://…` links. Multi-source research (e.g. a `/deep-research` report) must carry all its source URLs here — don't strand them in `raw/`.
4. **Update the wiki.** Create or update every `entities/` and `concepts/` (and `synthesis/`) page the source bears on — be willing to touch 10–15 pages in one pass. Add the new claims, with `[[sources/<slug>]]` citations. Fix any cross-references that need it.
5. **Update `wiki/index.md`** — add the new pages, refresh the one-liners.
6. **Append a `## [YYYY-MM-DD] ingest | <title>` entry to `wiki/log.md`** listing what changed.

### `research <topic>` — ingest, but you fetch the sources
Do active research (web search / fetch / docs). For each useful source: save it into `raw/` (or record `url:` + `retrieved:` if it's not worth archiving), give it a `wiki/sources/` page with a **`## Links`** section holding every URL it draws on, then write/update the `concepts/` or `synthesis/` page from those sources — and when an entity/synthesis page cites a source, **put that source's primary URL inline** on the `## Sources` line so the page is clickable without a hop. Log it (`## [date] research | <topic>`). "File good explorations back into the wiki."

### `query <question>` — answer from the wiki, then file it back
1. Search `wiki/` (and `raw/` if a page is thin) for relevant pages.
2. Answer me, **citing `[[pages]]` and `[[sources/…]]`**. If the wiki can't answer it, say so and suggest what to `ingest`/`research`.
3. If the answer was a substantive exploration, **file it back** as a new `wiki/synthesis/` (or `concepts/`) page and log it (`## [date] query | <question>`). One-off lookups don't need a page.

### `lint` — health check (you don't get bored; do the bookkeeping)
Scan `wiki/` for: contradictions between pages; claims superseded by newer sources; orphan pages (no inbound links); missing cross-references; data gaps; items in `raw/` with no `wiki/sources/` page; broken `[[links]]`. Report findings. Only fix things if I say so (or you're told `--fix`). Log it (`## [date] lint | <n findings>`).

### `sync` — fold in the ojfbot activity feed (this vault's special input)
The ojfbot cluster is a standing source. On `sync`: read recent git history, `.handoff/` beads, Claude session/skill telemetry (a helper script produces a JSON digest); update each repo's `wiki/entities/<repo>.md` (**Current state**, recent work, `status:`, `last_synced:`); write a `wiki/sources/sync-YYYY-MM-DD.md` page; refresh `wiki/index.md`; fold any `## [date] session | …` stub lines (left by the opt-in `vault-session.sh` hook) into that day's context; append `## [date] sync | …` to `wiki/log.md`. Never copy bead/commit/article bodies — link by path.

### `note <title>` — quick capture
Something I want kept but haven't processed → write it to `raw/<slug>.md` (it's a source you authored). If I say it's already a finished thought, you may instead create the appropriate `wiki/<type>/` page directly.

### `handoff` — fold the current session into the wiki
For wrapping up a working session (this one). Build a **handoff bundle** in the format defined in `prompts/session-handoff.md` — TL;DR · what was done · key findings · decisions · sources & docs referenced · **the full text of every artifact produced this session** (drafts, code, outlines — one block each, verbatim) · open threads · a filing plan. Then file it: write `raw/session-<YYYY-MM-DD>-<slug>.md` (the bundle, as the source of record) + each artifact to its own `raw/<artifact-slug>.md` + a `wiki/sources/<artifact-slug>.md` summary; create/update the `entities/`·`concepts/`·`synthesis/` pages it bears on (claims cite the source pages); update `wiki/index.md`; append `## [YYYY-MM-DD] ingest | <session> (handoff)` to `wiki/log.md`. It's `ingest`, where the "source" is the conversation. (Exporting a *foreign* chat agent's session is the copy-paste prompt in `prompts/session-handoff.md` → it emits the bundle → `ingest` the bundle.)

---

## What this is NOT

- **Not a chat log.** Conversations aren't preserved; the *pages* are the things worth keeping.
- **Not RAG.** Knowledge is compiled once into persistent interlinked pages, not re-derived per question.
- **`raw/` is never edited.** Append only. It's the audit trail of what the wiki was built from.
- **Link, don't copy.** ojfbot ADRs, `.handoff/` beads, daily-logger articles, source files — referenced by path/link, never pasted into a wiki page.
- **No secrets.** Never write tokens, `.env` values, or credentials into any page.
- **Not the same as `daily-logger`.** `daily-logger` publishes a chronological dev blog. `wiki/log.md` is this vault's *internal* operation ledger. The `wiki/` pages are the compiled knowledge. A session note may *link* a daily-logger article; it doesn't ingest one.
- **Not a "second brain"** — call it "the vault" / "the wiki" / "source, entity, concept, synthesis pages".

---

## Browsing it

Open `~/selfco` in Obsidian. The graph view (tuned in `.obsidian/graph.json`) colours clusters by folder — `wiki/entities`, `wiki/concepts`, `wiki/sources`, `wiki/synthesis`, `raw` — with `wiki/index.md` as the big hub node.

The community plugins are *downloaded* into `.obsidian/plugins/` but **not auto-enabled** — go to **Settings → Community plugins** and enable the ones you want (that path version-checks each against your Obsidian; auto-enabling one whose `minAppVersion` is newer than your app crashes the vault on open): **Obsidian Mind Map** (render a note as a tree), **Graph Analysis** (centrality/clustering), **Persistent Graph** (stable saved layout), and **Excalibrain** (TheBrain-style orbit around the current note — it draws onto an **Excalidraw** canvas, so enable Excalidraw too; both need a recent Obsidian, ≥1.5.7). To re-download after a clone: `core/.claude/skills/vault/scripts/install-obsidian-plugins.sh`.

For a cinematic whole-vault "galaxy", point [Graphify](https://www.getgraphify.com/blog/graphify-vs-obsidian) (or TheBrain) at this folder — it's plain markdown; no integration needed.

---

## Working from the Claude apps (web / iPhone / Mac desktop)

This vault is mirrored to a **private GitHub repo `ojfbot/selfco`** — that mirror is what the Claude *apps* reach for **reading**. For **writes from a Claude chat**, the channel that works is the **Notion `📥 selfco — Inbox`**: the `selfco-box` daemon (an always-on local process) polls that DB every 5 min and files matching rows into this vault, commits, and pushes. **GitHub is the source of truth; this folder on the Mac is a clone** (`/vault` on the Mac pulls/pushes; `scripts/autocommit.sh` covers Mac-local writes that bypass it).

- **Reading from any Claude app** — Anthropic's official **GitHub connector** scoped to `ojfbot/selfco` lets claude.ai web · the Claude iPhone app · Claude Desktop read/search the vault. **Read-only in practice** — the connector's write surface for this vault is unreliable. Use it to pull source content into a chat and to search for existing pages.
- **Writing from a Claude chat — Notion `📥 selfco — Inbox`** (DB id `81b8a0f7e97d4052900fac535b035237`). Create a row with `status=ready`, fill in `type` / `slug` / `tags`, drop the page body in. Write wikilinks as inline code — `` `[[some-page]]` `` — so Notion doesn't auto-format the brackets; the poller strips the wrapper. Within ~5 min the box files the row into `raw/<slug>.md` + the right `wiki/<type>/<slug>.md`, commits, and pushes; the Notion row flips to `status=promoted` with a `commit ref` + `promoted at`. On terminal failure: `status=failed` + `error`.
- **Claude Desktop (Mac) also** — a local **`mcp-obsidian`** server (the Obsidian "Local REST API" plugin + `MarkusPfundstein/mcp-obsidian`) gives you live Obsidian-index writes against this folder. Its writes aren't commits — `autocommit.sh` (or `git push` by hand) handles that. Available only on the Mac; web + iPhone go through Notion.
- **The `/vault` skill in the apps** — a tool-agnostic **Agent Skill** uploaded to your Anthropic account (`core/.claude/skills/vault/consumer/SKILL.md`): `ingest` / `query` / `note` / `orient` / `handoff`. It reads *this file* for the schema; reads via the GitHub connector; writes via the Notion Inbox (web/iPhone) or `mcp-obsidian` (Mac). `init` / `sync` / full web-`research` stay in **Claude Code on the Mac** (they need the python helpers + the ojfbot repos + git). Future: a Cloudflare-tunneled MCP endpoint on dedicated hardware swaps in as a custom connector with no Skill change.
- **Session handoff** — `/vault handoff` (in Claude Code, or the Agent Skill) folds *the current* session into the wiki: a summary + the **full text of every artifact** produced + a `wiki/log.md` entry. In the apps, the Skill emits the bundle into a Notion Inbox row (`type=source`, `slug=session-<date>-<slug>`, `status=ready`); the box's agent unpacks it: writes `raw/session-<date>-<slug>.md` + one `raw/<artifact-slug>.md` per `### ARTIFACT n`, summary pages, log entry. To capture a session from a chat agent with *no* connector (Dia, plain claude.ai), copy the body of `prompts/session-handoff.md` into it → it emits a `--- BEGIN selfco handoff bundle ---` block → paste that into a Notion Inbox row and set `status=ready`.

Setup + migration path: `core/.claude/skills/vault/knowledge/connectors.md`. Design: ADR-0085, ADR-0070, ADR-0072 (Notion as the chat→vault write channel).
