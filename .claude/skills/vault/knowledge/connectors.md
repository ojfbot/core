# Reaching the selfco vault from the Claude apps — connectors & sync

The `/vault` Claude-Code skill (`vault.md`) runs on the Mac. To tend the vault from the Claude **apps** —
claude.ai web, the iPhone app, the Claude Desktop Mac app — you need (1) a **connector** giving those apps
read/write access to the vault, and (2) the consumer-app **`/vault` Agent Skill** (`consumer/SKILL.md`)
uploaded to your Anthropic account. See ADR-0070.

Hard facts (May 2026): the Claude Desktop Mac app supports *local* MCP servers (`~/Library/Application
Support/Claude/claude_desktop_config.json`); **claude.ai web + the iPhone app only support remote MCP
connectors** (an HTTPS endpoint, configured once in account settings, synced across web+mobile) — a local
stdio server can't be used there. Claude-Code skills don't exist in the apps; the apps have **Agent Skills**
you upload to the account.

## Phase A — GitHub-backed reads, Notion-backed writes (now)

GitHub is the source of truth; `~/selfco` on the Mac is a clone you keep pulled/pushed. **Reads** come from
the GitHub connector. **Writes from a Claude chat** go through Notion (see the next section); the GitHub
connector is not a reliable write path in practice.

1. **The mirror** — `~/selfco` is pushed to a **private** GitHub repo `ojfbot/selfco`
   (`gh repo create ojfbot/selfco --private --source=$HOME/selfco --remote=origin --push`). `.gitignore`
   keeps `.obsidian/{plugins,workspace*}` and `raw/assets/*.tmp` out.
2. **GitHub connector — *read* surface only** (web + iPhone + Mac desktop) — in the Claude UI: Settings →
   **Connectors** → add/authorize **GitHub** → scope it to `ojfbot/selfco`. Claude in any app can now
   read/search `selfco/**`: browse pages, pull source content into a chat, search for prior entities.
   **It is not a reliable write path** — the connector's "create file" / "edit file" capabilities through
   the Claude apps don't work end-to-end for this vault (silent failures, partial commits). Write from a
   Claude chat using the **Notion `📥 selfco — Inbox`** path below; the GitHub connector is for reading and
   browsing, period.
3. **Mac desktop — add a local `mcp-obsidian`** (better UX on the Mac: live Obsidian index, no API round-trip;
   optional — the GitHub connector also works on the Mac):
   - Obsidian → Settings → Community plugins → install & enable **"Local REST API"** → copy its API key
     (it serves the vault at `https://127.0.0.1:27124` with a bearer token).
   - Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
     ```json
     {
       "mcpServers": {
         "obsidian-selfco": {
           "command": "uvx",
           "args": ["mcp-obsidian"],
           "env": {
             "OBSIDIAN_API_KEY": "<the key from the plugin>",
             "OBSIDIAN_HOST": "127.0.0.1",
             "OBSIDIAN_PORT": "27124"
           }
         }
       }
     }
     ```
     (`uvx` = `pipx run`-style runner from `uv`; `pip install mcp-obsidian` + `command: "mcp-obsidian"` also
     works. Repo: `MarkusPfundstein/mcp-obsidian` — tools: `list_files_in_vault`, `get_file_contents`,
     `search`, `patch_content`, `append_content`, `delete_file`. Want it to work with Obsidian closed instead?
     Use `Piotr1215/mcp-obsidian` — a filesystem-only server pointed at `~/selfco`.) Restart Claude Desktop.
   - Note: `mcp-obsidian` writes don't commit. Run `scripts/autocommit.sh` (a debounced `fswatch` →
     `git pull --rebase` / `commit` / `push`; launchd plist template inside the script) so Mac-local writes
     and hand-edits in Obsidian get committed+pushed.
4. **The `/vault` Agent Skill** — upload `consumer/SKILL.md` to your account (claude.ai → Settings →
   Capabilities → Skills; see `consumer/README.md`). It's connector-agnostic — it reads the vault's `CLAUDE.md`
   and writes via whichever connector is attached (GitHub or obsidian-mcp). Covers `ingest`/`query`/`note`/
   `orient`; `init`/`sync`/full web-`research` stay in Claude Code on the Mac.

Result: from web or iPhone you read via the GitHub connector and *write* via the Notion `📥 selfco — Inbox`
(next section); from the Mac you work in Claude Code (full `/vault`) or Claude Desktop (`mcp-obsidian` + the
Agent Skill), and `git pull` keeps `~/selfco` current. The Mac-side `/vault` skill (`vault.md`) does
`git pull --rebase --autostash` before and `git push` after its writes when `$V` has a remote — so the Mac
and the GitHub view stay in sync without thinking.

## Writing from a Claude chat — the Notion `📥 selfco — Inbox` (canonical write path)

From claude.ai web, the iPhone app, or anywhere else you can edit a Notion DB, drop a row into the canonical
`📥 selfco — Inbox` database (page id `35e54a8c-53d7-81de-8e0f-e4c367908439`, DB id
`81b8a0f7e97d4052900fac535b035237`). The `selfco-box` daemon polls this DB every 5 min, files matching rows
into `~/selfco` per the vault schema, commits, and pushes — then flips the Notion row to `status=promoted`
with a `commit ref` + `promoted at` timestamp.

**Row shape:**
- **Title** — what the page is about. Becomes the `title` field of the vault page.
- **`status`** (select) — set to `ready` when you want the box to file it. Stays `draft` while you're still
  editing. After the box runs: `promoted` (success) or `failed` (with the reason in `error`).
- **`type`** (select) — one of `source`, `entity`, `concept`, `synthesis`, `note` (matches the vault schemas
  in `~/selfco/CLAUDE.md`).
- **`slug`** (text) — kebab-case; becomes the filename under `raw/<slug>.md` + `wiki/<type>/<slug>.md`. If
  omitted, the agent derives one from the title.
- **`tags`** (multi-select) — drawn from a frozen vocabulary. Unknown tags → row marked `failed`.
- **`commit ref`** (text, written by the box) — the SHA the row was filed at.
- **`promoted at`** (date, written by the box) — when the box committed.
- **`error`** (text, written by the box on failure) — what went wrong.

**Wikilink convention:** in Notion, write wikilinks as **inline code** — `` `[[some-page]]` `` — so Notion's
auto-formatter doesn't eat the brackets. The poller strips the inline-code wrapper on write so the markdown
in the vault lands as plain `[[some-page]]`.

**Body:** standard markdown in the row's body (paragraphs, headings, bullet/numbered lists, code blocks,
quotes, to-dos, dividers). Attachments (images/files) are skipped in the current slice — paste their text
content directly or link out.

**Idempotency** is keyed on the Notion page id; once a row is filed, repeat polls do nothing. To re-file a
row after edits, flip its `status` back to `draft` then up to `ready`.

**Reaching it from a chat:** the row creation can be done via Notion's UI directly, or — when the chat has a
Notion connector authorized — by asking the model to "create a row in the `selfco — Inbox` database with
status=ready, type=…, slug=…" and giving the body.

The selfco-box runs the poller on this Mac via launchd (`com.ojfbot.selfco-box.poll-notion.plist`, every
5 min). When the Mac mini is up the plist moves there; everything else stays the same.

## Writing from an iOS Shortcut — `POST /capture`

The selfco-box exposes `POST /capture` on `127.0.0.1:$PORT` (bearer-token gated). An iOS Shortcut hitting
that endpoint enqueues a job exactly like the Notion poller does. **Reachability**: local-network only for
now; the public Cloudflare-Tunnel endpoint is Slice 3b (deferred).

## Phase B — locally-hosted obsidian-mcp (later, when you have dedicated hardware)

The "real" obsidian-mcp, always-on, no GitHub round-trip:

- On the box: a clone of `ojfbot/selfco` kept synced (a `git pull` cron, or it *is* the working copy with
  autocommit) + Obsidian (or headless) + the **Local REST API** plugin + `mcp-obsidian` wrapped in an HTTP/SSE
  transport + **`cloudflared`** (Cloudflare Tunnel) + **Cloudflare Access** (e.g. email-OTP) → an authenticated
  `https://selfco-mcp.<your-domain>` endpoint.
- In the Claude UI: Settings → Connectors → **Add custom connector** → that HTTPS URL + OAuth/token. It then
  works on web + iPhone + desktop. Keep the GitHub connector too (git history, repo search) or retire it.
- **The `consumer/SKILL.md` Agent Skill does not change** — it already targets "whatever vault tools you have".
  The migration is just: stand up the endpoint, add the connector, done.

## Why this shape

- `/vault`-as-Agent-Skill, tool-agnostic → one Skill, every surface; survives the Phase-A→B connector swap.
- GitHub-as-source-of-truth → the Mac is a clone, every device pull-rebases from the GitHub ref. The
  selfco-box writes to its local clone first and pushes; reads on other devices come from the next pull.
- The **Notion `📥 selfco — Inbox`** is the only chat→vault write path that actually works in 2026 —
  the GitHub connector reads cleanly but its write surface in the Claude apps is unreliable for this vault.
  Notion is the channel that always succeeds (a row create with `status=ready`); the box does the actual
  filing + commit + push.
- The python helpers (`init-vault.py`, `collect.py`, `lint.py`, `ingest.py`) and the `sync` activity feed need
  the ojfbot repos on disk + git, so they stay Claude-Code-on-the-Mac — but `init` is one-time and `sync` is a
  Mac-only concern anyway, so the app-side subset (`ingest`/`query`/`note`/`orient`) is exactly the useful one.
