Reference for `selfco-ingest` page building: slug and wikilink conventions, the full source-page body template, the session-mode variant, length/substance rules, the Artifacts format, and the style guidelines.

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

Style guidelines

- Economy. No corporate boilerplate. No "this excellent article explores..."
- Active voice. No "it was argued that..."
- Don't overstate individual ownership of team-maintained work.
- Trust the developer audience — cultural shorthand is fine.
- If James pushes back on a framing during discussion, update the staged row accordingly before finalizing. Don't be precious about the first draft.
- Quotes should be exact. Paraphrases should be flagged as such.
- Beware lossy compression. The source page is a summary, and summaries drop caveats, dates, minority views, exact wording. When a claim is contested, contingent, or dated, keep the qualifier even if it costs a few words.
