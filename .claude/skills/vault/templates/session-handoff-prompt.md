# session-handoff prompt — export a chat session into the selfco vault

A **portable, copy-paste prompt** for getting any chat agent (Dia chat, claude.ai web, ChatGPT, whatever — agents
with no tools and no `/vault` skill) to summarize the session you're in into a **handoff bundle** you can drop
into the `selfco` LLM Wiki.

**How to use it:** copy everything between the `╔═ BEGIN` and `╚═ END` lines below, paste it into the chat you want
to export, send. The agent emits a `--- BEGIN selfco handoff bundle ---` … `--- END ---` block; copy that out and
either paste it into a Claude Code session (`/vault ingest` it) or save it under `~/selfco/raw/` to process later.
(If you're already *in* a Claude Code session and want to fold *that* session in: just run `/vault handoff` — no
copy-paste.)

---

╔═ BEGIN — copy from here ═══════════════════════════════════════════════════════════════════════

You are exporting **this chat session** into my personal Obsidian-based knowledge wiki called **selfco** (it
follows Andrej Karpathy's "LLM Wiki" pattern). Produce a single self-contained markdown document — a **selfco
handoff bundle** — that I'll copy out and file into the wiki. **Be exhaustive about artifacts, terse about
chatter. Only include what actually happened in this session — don't pad, don't invent. If there were no
artifacts, say so.**

How the wiki is structured (so your "Suggested vault filing" section is accurate):
- `raw/` — immutable source material (append-only). Articles, drafts, transcripts, the bundle itself.
- `wiki/sources/<slug>.md` — one short summary page per item in `raw/`.
- `wiki/entities/<slug>.md` — people, organizations, products, tools (and each of my `ojfbot` code repos — repo
  slugs are the directory name verbatim, e.g. `cv-builder`, `TripPlanner`, `beaverGame`, `shell`, `core`).
- `wiki/concepts/<slug>.md` — ideas, frameworks, theories, methods.
- `wiki/synthesis/<slug>.md` — comparisons, themes, roadmaps, cross-cutting analyses.
- `wiki/index.md` — the hub catalog. `wiki/log.md` — an append-only `## [YYYY-MM-DD] <op> | <title>` ledger.
- Slugs are kebab-case ASCII, no leading dates. Wikilinks are `[[slug]]` / `[[sources/slug]]`.

Emit exactly this (fill in the angle-bracket parts; keep the section headers verbatim):

--- BEGIN selfco handoff bundle ---
---
type: handoff
session: <one-line title for this session>
agent: <where this chat is — e.g. Dia, claude.ai, ChatGPT>
date: <YYYY-MM-DD, today>
topics: [<tag>, <tag>, …]
artifacts: <number of items in "Artifacts produced">
---

# <session title> — handoff bundle

## TL;DR
<2–5 sentences: what this session was for and what it produced>

## What was done
<terse narrative — the arc of the work, the key turns, the dead ends. A few short paragraphs or tight bullets.>

## Key findings / conclusions
<bullets — each substantive claim notes its basis (which source, which reasoning, which experiment)>

## Decisions
<bullets — choices made and why; "—" if none>

## Sources & documents referenced
<for each external source or document discussed/used:
 - **<title>** — <where it came from / URL> — <1–3-sentence summary of what it is and why it mattered here>
   <if it's short and pasteable, include its full text in a fenced block right under it; if it's long, give a
   precise pointer instead — don't bloat the bundle with giant verbatim sources, but DO include drafts/artifacts
   I authored in this session in full — those go in the next section>
 "—" if none>

## Artifacts produced  (FULL TEXT — do NOT summarize these away)
<one ### block per artifact I created or co-created in this session: article drafts, outlines, code, specs,
 prompts, notes, plans, diagrams-as-text, etc. Include the COMPLETE verbatim text of each. If an artifact is
 code or markdown, put it in a fenced block. If there are zero artifacts, write "(none)" under this header.>

### ARTIFACT 1 — <kind: article-draft | outline | code | spec | prompt | notes | plan | …> — <title> — slug: <kebab-slug>
<the complete verbatim text of artifact 1>

### ARTIFACT 2 — <kind> — <title> — slug: <kebab-slug>
<the complete verbatim text of artifact 2>

<…one per artifact…>

## Open threads / next steps
<bullets — what's unfinished, what to do next, what to come back to>

## Suggested vault filing
<a starting-point filing plan — I'll adjust it. Reference the page kinds above. Typical:
 - this bundle → `raw/session-<date>-<slug>.md` (the source of record)
 - ARTIFACT <n> "<title>" → `raw/<artifact-slug>.md` + a `wiki/sources/<artifact-slug>.md` summary
 - <topic discussed> → new or updated `wiki/concepts/<slug>.md` (key claims, citing the sources above)
 - <comparison / roadmap / theme> → `wiki/synthesis/<slug>.md`
 - mentions of my ojfbot repos → `[[<repo>]]` links in the relevant pages
 - `wiki/log.md` ← `## [<date>] ingest | <session title> (handoff from <agent>)`>
--- END selfco handoff bundle ---

Length handling: if the bundle is too long to fit in one message, split it into numbered parts —
`=== PART 1 of N ===` … `=== END PART 1 ===` — emit the first part, then stop and wait for me to say "continue".
**Never truncate an artifact mid-way**; if a single artifact is too long for one part, give it its own part.

Be adaptive: a short thread → a tiny bundle (TL;DR + maybe one artifact) is the right answer. An extended research
session with many documents and drafts → be thorough; capture every document and every draft.

Output only the bundle (and the part-markers if you split it). No preamble, no "here's your bundle" — just start
with `--- BEGIN selfco handoff bundle ---`.

╚═ END — copy to here ═══════════════════════════════════════════════════════════════════════════
