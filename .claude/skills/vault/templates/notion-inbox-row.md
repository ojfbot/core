# Notion `📥 selfco — Inbox` row — the chat→vault write template

The shape of a row in the canonical Notion `📥 selfco — Inbox` database (DB id
`81b8a0f7e97d4052900fac535b035237`). The `selfco-box` daemon polls every 5 min for rows where
`status=ready`, files them into `~/selfco`, commits, pushes, and flips the row to `status=promoted` with a
`commit ref` + `promoted at` timestamp.

This is the **canonical chat→vault write path**: from claude.ai web, the iPhone app, or anywhere else that
can edit the Notion DB, create a row in this shape and the page lands in the vault unattended.

## Properties

| Property | Type | Required | What it does |
|---|---|---|---|
| `Name` / `Title` | title | yes | The page title. Becomes the `title` of the wiki page. |
| `status` | select | yes | Set to **`ready`** when you want the box to file it. Stays `draft` while you're editing. After the box runs: `promoted` (filed + committed) or `failed` (see `error`). |
| `type` | select | strongly recommended | One of `source`, `entity`, `concept`, `synthesis`, `note` — matches the vault page schemas in `~/selfco/CLAUDE.md`. Routes the page to the right `wiki/<type>/` folder. |
| `slug` | text | optional | kebab-case. Becomes `raw/<slug>.md` + `wiki/<type>/<slug>.md`. If omitted, the agent derives one from the title. |
| `tags` | multi-select | optional | Drawn from the **frozen vocabulary** in the DB. Unknown tags → row marked `failed` with the bad tag in `error`. |
| `commit ref` | text | (written by the box) | The git SHA the row was filed at. |
| `promoted at` | date | (written by the box) | When the box committed. |
| `error` | text | (written by the box) | What went wrong on terminal failure (retries exhausted, unknown tag, etc.). |

## Body (the page content)

Standard markdown. The box agent reads this verbatim and writes it into `raw/<slug>.md`, then summarizes /
links it into the wiki per the vault schema. Supported block types:

- paragraphs, `# heading_1` / `## heading_2` / `### heading_3`
- bulleted lists, numbered lists, to-dos
- fenced code blocks (with language)
- blockquotes
- dividers (`---`)

**Attachments (images / files / video / audio / pdf) are skipped** in the current slice — the poller logs a
warning and the row still gets filed without them. Paste the text content of attachments directly into the
body, or link out.

## Body substance — required, not optional

The body is **the whole point of the row.** A row with full properties but an empty (or one-paragraph stub)
body produces an empty wiki page, which contributes nothing to the RAG retrieval the vault is supposed to
feed. Rules:

- **Minimum: 500 words for any non-trivial session/source.** Target 500–1000 words for the summary content.
- **Artifacts produced during the session must be included in full, verbatim, never truncated.** They go
  inline in the body (or in `### ARTIFACT n` blocks for handoffs). Artifacts are *additive* to the
  500–1000-word floor — they don't count toward it.
- **Markdown structure required** — `##` / `###` headings, bullets, fenced code blocks, blockquotes. The
  Obsidian graph and search depend on real structure; a wall of paragraph text is the wrong shape.
- **Going shorter than 500 words is an opt-out, not the default.** Only acceptable when the entire session
  was genuinely trivial (single lookup, one-paragraph clarification, no decisions, no artifacts). When you
  go shorter, say so in the TL;DR ("trivial session, no full summary needed") so the user can audit.
- **Self-check:** word-count the body before setting `status=ready`. Under 500 words + non-trivial session =
  underwritten. Go back and expand with the actual substance of what happened, or pull in artifacts that
  belong in the body.

## The wikilink convention — important

In Notion, write wikilinks as **inline code**: `` `[[some-page]]` ``. This stops Notion's auto-formatter
from eating the brackets. The poller strips the inline-code wrapper on write, so the markdown in the vault
ends up as plain `[[some-page]]`.

Without the wrapper, Notion will silently turn `[[foo]]` into a Notion @-mention or a different inline form,
and the link won't survive the round trip.

## Idempotency

Keyed on the Notion **page id**. A row that's been filed (and thus has `status=promoted`) won't be filed
again — even if the body is edited. To re-file a row after edits, flip its `status` back to `draft` then up
to `ready`. (Or better: create a new row, since the vault treats `raw/` as immutable.)

## Example row

**(Note: the body below is deliberately abridged to keep this template scannable. Your real rows should be
500–1000 words of summary in the body — see `## Body substance` above. Treat the body shown here as the
*shape*, not the *length*.)**

> **Title:** `selfco — chat-to-vault pipeline architecture audit`
>
> **status:** `ready`
> **type:** `source`
> **slug:** `selfco-chat-to-vault-pipeline-architecture-audit`
> **tags:** `selfco`, `architecture`, `audit`
>
> **Body:**
> ```
> # selfco — chat-to-vault pipeline architecture audit
>
> ## TL;DR
> The GitHub-connector path fails silently for writes. Notion is the channel that works. The fix is a
> polling promoter on the always-on host that drains `status=ready` rows.
>
> ## Key findings
> 1. The GitHub connector's `create-or-update-file` returns success but no commit lands.
> 2. Notion's `pages.update` and `dataSources.query` are reliable from a server-side integration token.
> 3. Asset URLs in Notion expire in ~1h, so attachments must be downloaded synchronously (deferred).
>
> See `` `[[selfco-vault]]` `` for the vault design and `` `[[adr-0072]]` `` for the decision record.
> ```

After 5 min: the row's `status` becomes `promoted`, `commit ref` shows the SHA, and
`~/selfco/raw/selfco-chat-to-vault-pipeline-architecture-audit.md` + `wiki/sources/selfco-chat-to-vault-pipeline-architecture-audit.md`
exist on disk, pushed to `origin/main`.
