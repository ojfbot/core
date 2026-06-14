---
name: selfco-ingest
description: "Stage a URL (YouTube video, blog article, paper, podcast) into the selfco knowledge base via the Notion inbox. Discuss the source with James, build a structured wiki/sources/ draft, and write it to Notion with suggested wikilinks for the local promoter to resolve. Use this whenever James drops a URL, says \"ingest this,\" \"save this for selfco,\" \"let's discuss this video,\" or otherwise wants source material captured into his vault. The skill handles the chat side of the ingest workflow only — the local promoter on his network is what lands files on disk."
---

###### selfco-ingest
Stages new sources and substantive chat sessions into the selfco vault using the Notion inbox pattern. Discuss first, structure second, write to inbox third. The local promoter lands it on disk; this skill never touches ~/selfco/ directly.

Context

James runs a personal Obsidian vault at ~/selfco/ modeled on Karpathy's LLM Wiki pattern: raw/ for immutable sources, wiki/ for LLM-generated pages (sources/, entities/, concepts/, synthesis/), and CLAUDE.md as the schema. Because Claude chat (web/mobile) can't write to his network, all writes flow through a Notion inbox database (Inbox under selfco — Inbox). A local promoter on his network polls or webhook-receives status=ready rows and lands them in the vault with proper frontmatter, then commits to GitHub as a mirror.

This skill is the chat-side ingester. It captures source material into a wiki/sources/<slug>.md–shaped draft on the inbox and stops there. Entity/concept page updates, link resolution, and stub creation are the promoter's job, not this skill's. That separation is intentional — see selfco — chat-to-vault pipeline architecture audit (Notion) for the reasoning.

When this skill triggers

- A URL appears in chat with no other context (default: ask which mode)
- Explicit ingestion phrases: "ingest this," "save this for selfco," "add this to the vault," "this is for selfco," "drop this into selfco"
- Explicit session-handoff phrases: "fold this conversation into selfco," "save this session," "handoff to selfco," "selfco this whole thread," "make a note of this conversation"
- Discussion invitations alongside a URL: "let's talk about this video," "what do you make of this?"
- A pasted YouTube transcript or article body without an obvious destination
- "Read this and tell me what to think about it" — discussion mode with a source

Four modes

Discuss. Fetch the source, summarize briefly, surface the most interesting threads, react to what James says. Don't write anything to Notion yet. Default for ambiguous URL drops.

Stage. Build the structured source page (template below), write it to the Notion inbox. The box files any non-terminal row within ~5 min — there is no `draft` hold (ADR-0073), so finish the body *before* you create the row. The promoter lands the file and flips the row to `promoted`.

Combined. Discuss first, then offer to stage at a natural moment. Capture both the source and the discussion thread in the staged note. This is the workflow that benefits most from the deep-linking step — the connections only surface when James reacts.

Session. No external source — fold *this whole conversation* into the inbox. Used when the discussion itself is the artifact, or when a chat produced drafts/code/plans/research that should land in the vault even though no single URL kicked it off. Same staging mechanics as Stage; the body is shaped as a session bundle rather than a source page (see "If the capture is a session, not a source" under workflow §4). Default to this mode when the user says "selfco this" after a substantive conversation with no canonical source.

If unsure which mode is intended, ask once: "Discuss, stage, combined, or session?"

Workflow

1. Fetch the source

- YouTube: web_fetch the URL. If the page yields captions or a transcript, use them. Don't attempt audio transcription. If captions aren't accessible, ask James to paste the transcript — or proceed without on title/description alone, but flag the limitation.
- Article / blog post: web_fetch the URL. Extract title, author, publish date, body. Ignore sidebar/footer boilerplate.
- Paper: web_fetch the PDF or HTML landing page. Extract title, authors, abstract, key claims.
- Podcast: ask for show notes or transcript URL. Same handling as YouTube.
- **Session mode: skip this step.** There is no external source to fetch. Go straight to §2 (the discussion *is* the source) or §4 (if discussion already happened).

2. Discuss (always — even in stage mode)

Open with a 2–3 sentence framing of what the source argues. Don't restate the whole thing. Highlight parts James probably cares about given his @ojfbot work — assistant-centric architecture, classification systems never being neutral, Cozy Beaver, Frame ecosystem, Gas Town/Wasteland, agentic orchestration, Deakins-aesthetic interests. Wait for him to react before proceeding. The discussion is where deep links surface.

3. Identify type, slug, suggested wikilinks

- type: source (this skill only stages sources; for syntheses or concepts, use the inbox directly with the right type). Session-mode captures still use type=source — the session itself is the source of record.
- slug: kebab-case from title or canonical short form (karpathy-llm-wiki, team-deakins-1917-cinematography). For session mode: session-<YYYY-MM-DD>-<kebab-topic>. When in doubt, propose two and ask.
- Wikilinks: suggest candidates from the discussion. Wrap each in inline code — `[[Andrej Karpathy]]` — so Notion's auto-formatter leaves them alone. The promoter strips the code wrapper and resolves each link against the live vault, creating stubs per its policy.

Don't invent canonical names. If James calls something "Cozy Beaver" in one place and "beaverGame" in another, offer both and ask which is canonical for the vault.

4. Build the page

Body template (no frontmatter — the promoter generates frontmatter from inbox row properties):

```markdown
> Source: [Title](URL)
> Author / channel: ...
> Published: YYYY-MM-DD
> Captured: <today>
> Format: video / article / paper / podcast
> Duration or length: ...

## TL;DR
One paragraph. The argument in James's voice — economical, active, no boilerplate.

## Key points
- Concise bullet
- Concise bullet
- ...

## Notable claims
1. **Claim summarized actively.** Backed by [MM:SS] for video or section reference for text.
2. ...

## Suggested wikilinks
- `[[Person Name]]` — why relevant to the vault
- `[[Concept Name]]` — why relevant
- `[[Other Source]]` — connection point

## Proposed tags
[Optional — only when the capture warrants tags that don't exist in the schema yet; omit the section entirely if none. The promoter ignores this block, so it's a durable, auditable record for James to approve. Stage the row itself with existing tags only. One line each — `name` (color) — recurrence rationale. See "Proposing new tags" below.]

## Open questions
- Things worth following up on
- Where the source is weak or missing context

## Quotes
> Direct quote.
> — Speaker, [MM:SS] or page reference

## Discussion thread
[Combined or Session mode. The substance of what James and Claude talked about that the source page should preserve. Not the play-by-play — just the conclusions worth keeping.]
```

Length and substance — read this before writing the body

The body is the whole point of the row. Metadata-only rows (properties filled, body empty or a one-paragraph stub) defeat the pipeline — the promoter writes them to disk as empty wiki pages that contribute nothing to RAG. **Floor: 500–1000 words of summary content in the body for any non-trivial capture.** The template above is shaped to land in that range when each section is actually filled out — terse bullets in Key Points isn't a license to skip Notable Claims, Open Questions, or Discussion Thread.

Going under 500 words is acceptable only for genuinely trivial captures (a single short quote, a one-line bookmark, a session that was one question and one paragraph back). When you go shorter, say so in the TL;DR ("trivial capture, no full summary needed") so review can audit the call. Don't bury it.

Self-check: word-count the body before staging. Under 500 + non-trivial = underwritten — expand with what was actually discussed, or pull in artifacts you forgot to include.

Err on the side of more, not less. Length isn't penalized; thinness is.

Artifacts produced in chat

If this session generated any drafts, outlines, code, specs, prompts, plans, or notes — anything James and Claude wrote together — include each one **verbatim, never truncated**, in an Artifacts section at the bottom of the body, after Discussion thread:

```markdown
## Artifacts
### ARTIFACT 1 — <kind: draft | outline | code | spec | prompt | plan | notes> — <title>
[complete verbatim text]

### ARTIFACT 2 — <kind> — <title>
[complete verbatim text]
```

Artifacts are **additive** — they don't count toward the 500–1000-word summary floor. The summary still needs to be 500–1000 words on its own, even when there are large artifacts below it. If there were no artifacts, omit the section entirely (don't write "(none)"; just leave it out).

If the capture is a session, not a source

For Session mode, replace the source-header block (Source / Author / Published / Captured / Format / Duration) with:

```markdown
> Session: <one-line title>
> Date: YYYY-MM-DD
> Topics: tag, tag, tag
> Artifacts: <count>
```

And replace Notable claims with Decisions (choices made in the session and why; "—" if none). Everything else — TL;DR, Key points, Suggested wikilinks, Open questions, Discussion thread, Artifacts — stays the same. Quotes section is optional in session mode; keep it if there were memorable user phrasings worth preserving verbatim, drop it if not.

5. Stage to the Notion inbox

Use the Notion MCP create-pages tool against the Inbox database. The data source ID is 7b88b47f-cbc8-452d-ad03-c45006989db8. Verify against ~/selfco/CLAUDE.md if the schema drifts.

Property mapping:

- Title: source title (for session mode: "Session — <topic>, <YYYY-MM-DD>")
- type: source
- slug: kebab-case (session mode: session-<YYYY-MM-DD>-<kebab-topic>)
- source url: the URL (session mode: leave empty or use the chat URL if available)
- session: "Claude chat — <topic>, <date>"
- tags: a JSON-array string, e.g. "[\"selfco\", \"pipeline\"]". **Stage the row with existing canonical tags only** — choose from the live multi-select. Common picks: selfco, plus topic tags (pipeline, typescript, xr, etc.) when they fit. If the capture genuinely reaches into a domain the existing tags don't cover, don't invent a value on the row and don't silently expand the schema — **propose** the tag per *Proposing new tags* below. If the option set may have drifted, verify it against the data source first.
- status: optional. The box files any non-terminal row — anything but the terminal `promoted` / `declined` / `failed` (ADR-0073) — within ~5 min, so `draft` no longer holds a row for review. Leave it unset or set `draft`; either ingests. The capture is **one-shot** (idempotent on the Notion page id): finish the body before creating the row, and refine afterward in the vault's git history, not by editing the Notion row.

Proposing new tags (discipline)

Tag governance is a middle path — not "silently invent" (sprawl) and not "never suggest" (every new domain stays under-tagged until James intervenes by hand). Tags are a load-bearing cross-reference surface: a disciplined, growing tag set is what makes the wiki navigable, so propose new tags when a capture genuinely needs them — under all of these constraints:

1. **High recurrence bar.** Propose a tag only if it would plausibly recur across multiple future captures — the ≥3-future-members test. `geospatial` passes (a whole domain). `submarine-cables` fails (one source) — leave that to a wikilink, not a tag.
2. **Cap per ingest: ~2–3 proposed tags.** If a single capture seems to need five new tags, the taxonomy is wrong, not under-built — surface *that* signal instead of proposing five.
3. **Prefer existing tags.** Before proposing, check whether an existing tag — even an imperfect fit — already covers the need. Reach for a new tag last.
4. **Surface near-duplicates.** If a proposed tag is close to an existing one (`maps` vs. the existing `cartography`), say so and default to the existing one.
5. **Propose, never auto-create.** Draft each proposal as **`name` + color + one-line rationale**. Stage the row with existing tags only; James approves new tags explicitly before they enter the schema. (Same discipline as the search-before-stage dedup — propose, let review decide.)
6. **Proposals live in the row body.** Put them in the `## Proposed tags` section of the staged row (durable, auditable, ignored by the promoter) — not in chat only.

When James approves a batch, add them with an **additive** schema update — re-declare the FULL option list (re-stating the existing options preserves them; omitting one drops it):

```
ALTER COLUMN "tags" SET MULTI_SELECT(
  'drone':blue, 'dji':blue, 'vfx':purple, 'pipeline':green, 'solarpunk':green,
  'typescript':orange, 'compliance':red, 'mckinney':red, 'xr':purple, 'meta':gray,
  'inbox-pattern':gray, 'selfco':gray, 'ojfbot':default, 'codenames':default,
  'integration':default, 'architecture':default, 'workstation-yuri':default,
  'geospatial':blue, 'agents':orange, 'cartography':blue,
  '<NEW_TAG>':<color>
)
```

Run via the Notion `update-data-source` tool against data_source_id `7b88b47f-cbc8-452d-ad03-c45006989db8`. **Only for James-approved batches** — this skill never mutates the schema on its own. (A periodic full-taxonomy review for sprawl / dead tags / near-dups is a separate pass; if the incremental approach drifts, surface that — don't audit here.)

The body markdown is the template above.

After staging, give James the Notion page URL and **report the body word count** ("staged at <N> words of summary; <M> additional in artifacts"). The row ingests on the next poll (~5 min) regardless of status and is **send-once** (idempotent on the page id) — don't tell him to flip it to ready, and don't expect to fix it by editing the row afterward; refinement happens via commits on `ojfbot/selfco`. The row flips to `status=promoted` with a `commit ref` when the box files it. If new tags were warranted, point him at the **Proposed tags** block in the row body to approve.

Style guidelines

- Economy. No corporate boilerplate. No "this excellent article explores..."
- Active voice. No "it was argued that..."
- Don't overstate individual ownership of team-maintained work.
- Trust the developer audience — cultural shorthand is fine.
- If James pushes back on a framing during discussion, update the staged row accordingly before finalizing. Don't be precious about the first draft.
- Quotes should be exact. Paraphrases should be flagged as such.
- Beware lossy compression. The source page is a summary, and summaries drop caveats, dates, minority views, exact wording. When a claim is contested, contingent, or dated, keep the qualifier even if it costs a few words.

What this skill does not do

- No direct disk writes. Chat can't reach ~/selfco/. Everything goes through the inbox.
- No live wikilink resolution. The vault isn't visible from chat. Wikilink candidates are suggestions; the promoter resolves them.
- No entity or concept page maintenance. That's a separate workflow owned by Claude Code or a future entity-update skill.
- No lint / health checks. Karpathy's third operation lives on the Claude Code side, after promotion.
- No batch ingest. One source per invocation. Bulk ingest is a different pattern with different review economics.
- No audio transcription. If captions aren't accessible, ask for the transcript.
- No frontmatter generation. The promoter owns frontmatter; the body markdown stays frontmatter-free.

Examples

Ambiguous URL drop
James: https://youtube.com/watch?v=abc123
Claude: [fetches the URL] "That's the Team Deakins ep on 1917's one-shot logistics. Discuss, stage, combined, or session?"

Stage-only
James: "save this for selfco — https://karpathy.bearblog.dev/llm-wiki/"
Claude: [fetches → builds the source page → stages to inbox] "Staged as karpathy-llm-wiki, 720 words of summary in the body. Suggested wikilinks: [[Andrej Karpathy]], [[LLM Wiki]], [[Obsidian]], [[Vannevar Bush]], with a connection to [[Frame]] worth surfacing. It files within ~5 min; watch for status=promoted: <url>."

Combined discussion → stage
James: "let's discuss this — <article URL>"
Claude: [fetches → opens with framing → discusses] ... after a few turns: "Stage what we just covered? The Gas Town execution-plane vs Frame experience-plane connection isn't in the original article, but it surfaced here and is worth keeping in the discussion thread."

Session
James: "fold this conversation into selfco"
Claude: [reviews the conversation, identifies topics, drafts, decisions] "Staging as session-2026-05-15-frame-shell-architecture-rethink, 840 words of summary covering the TL;DR / Key points / Decisions / Open questions / Discussion thread, plus the two drafts we worked on (Frame shell adapter spec, beaverGame portal sketch) included verbatim under Artifacts. Tags: selfco, frame, architecture. It files within ~5 min; watch for status=promoted: <url>."

Related

- selfco — Inbox (Notion database, data_source_id 7b88b47f-cbc8-452d-ad03-c45006989db8)
- selfco × Claude apps — the Notion inbox pattern (Notion synthesis)
- selfco — chat-to-vault pipeline architecture audit (Notion synthesis)
- selfco — Cloudflare Tunnel push-based promoter design (Notion synthesis)
- ~/selfco/CLAUDE.md (canonical schema, read by promoter)
- The handoff skill (for kicking off Claude Code work after a stage)
- Karpathy's LLM Wiki gist: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f