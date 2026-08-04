---
name: selfco-ingest
description: "Stage a URL (YouTube video, blog article, paper, podcast) into the selfco knowledge base via the Notion inbox. Discuss the source with James, build a structured wiki/sources/ draft, and write it to Notion with suggested wikilinks for the local promoter to resolve. Use this whenever James drops a URL, says \"ingest this,\" \"save this for selfco,\" \"let's discuss this video,\" or otherwise wants source material captured into his vault. The skill handles the chat side of the ingest workflow only — the local promoter on his network is what lands files on disk."
---

###### selfco-ingest
Stages new sources and substantive chat sessions into the selfco vault using the Notion inbox pattern. Discuss first, structure second, write to inbox third. The local promoter lands it on disk; this skill never touches ~/selfco/ directly.

Context

This skill is the chat-side ingester. It captures source material into a wiki/sources/<slug>.md–shaped draft on the inbox and stops there. Entity/concept page updates, link resolution, and stub creation are the promoter's job, not this skill's. That separation is intentional — see selfco — chat-to-vault pipeline architecture audit (Notion) for the reasoning.

> **Load `knowledge/modes-and-triggers.md`** before responding to any URL drop or ingest request — the vault architecture, trigger list, the four modes in full, per-source fetch handling, and worked examples.

Four modes

Discuss, Stage, Combined, or Session. If unsure which mode is intended, ask once: "Discuss, stage, combined, or session?"

Workflow

1. Fetch the source

web_fetch the URL and extract what the source type offers; no audio transcription. Session mode skips this step.

2. Discuss (always — even in stage mode)

Open with a 2–3 sentence framing of what the source argues. Wait for him to react before proceeding. The discussion is where deep links surface.

3. Identify type, slug, suggested wikilinks

type=source; slug is kebab-case (session mode: session-<YYYY-MM-DD>-<kebab-topic>); wrap each suggested wikilink in inline code. Don't invent canonical names.

4. Build the page

Fill the source-page body template. Floor: 500–1000 words of summary content for any non-trivial capture; artifacts are additive and included verbatim.

> **Load `knowledge/source-page-template.md`** before drafting the body — the full body template, session-mode variant, length rules, Artifacts format, slug/wikilink conventions, and style guidelines.

5. Stage to the Notion inbox

Use the Notion MCP create-pages tool against the Inbox database (data source 7b88b47f-cbc8-452d-ad03-c45006989db8). Finish the body before creating the row — the capture is one-shot. Stage with existing canonical tags only; propose new tags, never auto-create.

> **Load `knowledge/staging-and-tags.md`** before creating the row — the property mapping, status semantics (ADR-0073), the tag-proposal discipline and ALTER COLUMN procedure, and the after-staging report.

What this skill does not do

- No direct disk writes. Chat can't reach ~/selfco/. Everything goes through the inbox.
- No live wikilink resolution. The vault isn't visible from chat. Wikilink candidates are suggestions; the promoter resolves them.
- No entity or concept page maintenance. That's a separate workflow owned by Claude Code or a future entity-update skill.
- No lint / health checks. Karpathy's third operation lives on the Claude Code side, after promotion.
- No batch ingest. One source per invocation. Bulk ingest is a different pattern with different review economics.
- No audio transcription. If captions aren't accessible, ask for the transcript.
- No frontmatter generation. The promoter owns frontmatter; the body markdown stays frontmatter-free.

## Gotchas

- **This skill never writes to disk — the local promoter does.** It stages a row to the Notion inbox; the deliverable is a well-formed inbox row, not a file in `~/selfco/`. Trying to write the vault directly from chat fails (no network path to his box) — that's the whole reason the inbox pattern exists.
- **A row ingests once; later edits don't re-sync.** Finish the body before staging. Refinements happen in the vault (git history) afterward, not by editing the promoted Notion row (ADR-0073).
- **Wrap wikilinks as inline code — `` `[[page]]` `` — or Notion's formatter eats the brackets.** The promoter strips the code wrapper on write; a bare `[[page]]` can arrive mangled.
- **Discuss → structure → write, in that order.** Jumping straight to a drafted source page skips the step where James shapes what's actually worth keeping; the discussion is where the connections that aren't in the original source surface.
- **Staged ≠ filed.** Watch for `status=promoted` (with a commit ref); `status=failed` with an `error` means it never landed. Don't tell James it's in the vault until the row flips.
