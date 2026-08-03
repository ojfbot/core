Reference for `selfco-ingest` staging: the Notion inbox property mapping and status semantics, the tag-proposal discipline and approved-batch schema update, the after-staging report, and related references. (The body template itself is in `knowledge/source-page-template.md`.)

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

Related

- selfco — Inbox (Notion database, data_source_id 7b88b47f-cbc8-452d-ad03-c45006989db8)
- selfco × Claude apps — the Notion inbox pattern (Notion synthesis)
- selfco — chat-to-vault pipeline architecture audit (Notion synthesis)
- selfco — Cloudflare Tunnel push-based promoter design (Notion synthesis)
- ~/selfco/CLAUDE.md (canonical schema, read by promoter)
- The handoff skill (for kicking off Claude Code work after a stage)
- Karpathy's LLM Wiki gist: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
