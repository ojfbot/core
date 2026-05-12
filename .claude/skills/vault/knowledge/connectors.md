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

## Phase A — GitHub-backed (now)

GitHub is the source of truth; `~/selfco` on the Mac is a clone you keep pulled/pushed.

1. **The mirror** — `~/selfco` is pushed to a **private** GitHub repo `ojfbot/selfco`
   (`gh repo create ojfbot/selfco --private --source=$HOME/selfco --remote=origin --push`). `.gitignore`
   keeps `.obsidian/{plugins,workspace*}` and `raw/assets/*.tmp` out.
2. **GitHub connector** (web + iPhone + Mac desktop) — in the Claude UI: Settings → **Connectors** →
   add/authorize **GitHub** → scope it to `ojfbot/selfco`. Claude in any app can now read/search/write
   `selfco/**` via the GitHub API; **each write is a commit** to `ojfbot/selfco`. Bring those down to the Mac
   with `git -C ~/selfco pull --rebase`.
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

Result: from web or iPhone you `/vault ingest <url>` etc. → commits land in `ojfbot/selfco`; from the Mac you
work in Claude Code (full `/vault`) or Claude Desktop (`mcp-obsidian` + the Agent Skill), and `git pull` keeps
`~/selfco` current. The Mac-side `/vault` skill (`vault.md`) does `git pull --rebase --autostash` before and
`git push` after its writes when `$V` has a remote — so the two views stay in sync without thinking.

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
- GitHub-as-source-of-truth → web/iPhone writes are commits (free history), no tunnel, no Mac-must-be-on; the
  Mac is a clone.
- The python helpers (`init-vault.py`, `collect.py`, `lint.py`, `ingest.py`) and the `sync` activity feed need
  the ojfbot repos on disk + git, so they stay Claude-Code-on-the-Mac — but `init` is one-time and `sync` is a
  Mac-only concern anyway, so the app-side subset (`ingest`/`query`/`note`/`orient`) is exactly the useful one.
