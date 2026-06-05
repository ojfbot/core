# ADR-0070: Reaching the selfco vault from the Claude apps — GitHub mirror + connector now, locally-hosted obsidian-mcp later
slug: vault-multi-surface-access
serial: 0070
domain: observation
type: architecture

Date: 2026-05-12
Status: Accepted
OKR: 2026-Q2 / O-Knowledge / KR-cross-project-recall
Commands affected: /vault (Claude-Code skill — git-remote awareness; + a new consumer-app Agent-Skill variant)
Repos affected: core (the /vault skill, consumer Agent Skill, connectors doc, autocommit helper), new repo ~/selfco / GitHub `ojfbot/selfco`

---

## Context

`/vault` (ADR-0085) is a Claude-Code skill and `~/selfco` is a local-only git repo on the Mac. The user wants to
invoke the vault workflows from the consumer Claude apps too — claude.ai web, the Claude Desktop Mac app, the iPhone
app — and have output land in the vault. Constraints (verified May 2026): Claude Desktop supports *local* MCP servers
(`~/Library/Application Support/Claude/claude_desktop_config.json`); claude.ai web + the iPhone app support only
**remote MCP connectors** (an HTTPS endpoint configured once in account settings, synced across web+mobile) — a local
stdio server can't be used there; Claude-Code skills don't exist in the apps, which instead support uploadable **Agent
Skills**. So three things are needed: a way for the apps to read/write `~/selfco` (a connector), a `/vault` workflow
that exists *in* the apps (an Agent Skill), and keeping the Mac copy and the connector's view in sync.

## Decision

**Phase A (now):** push `~/selfco` to a **private GitHub repo `ojfbot/selfco`** and use Anthropic's official
**GitHub connector** as the vault connector for the apps — it works on web + iPhone + Mac desktop, needs no tunnel and
no always-on Mac, and **every write is a commit** (so the vault gets git history for free from any surface). The Mac
desktop app *additionally* gets a local **`mcp-obsidian`** server (Obsidian "Local REST API" plugin + `MarkusPfundstein/mcp-obsidian`)
for a live-index UX. **GitHub is the source of truth; `~/selfco` on the Mac is a clone** — the Claude-Code `/vault`
skill (and `init-vault.py`) now `git pull --rebase --autostash` before and `git push` after their writes when `$V`
has a remote, and `scripts/autocommit.sh` (debounced `fswatch` → pull/commit/push, launchd template included) covers
writes that bypass the skill (Mac-local `mcp-obsidian`, hand-edits in Obsidian).

A **`/vault` Agent Skill** (`core/.claude/skills/vault/consumer/SKILL.md`) is uploaded to the Anthropic account so the
workflows exist in the apps. It covers `ingest` / `query` / `note` / `orient` (the LLM-authoring modes) — `init` /
`sync` / full web-`research` stay in Claude Code on the Mac (they need the python helpers + the ojfbot repos on disk +
git). It is **connector-agnostic**: it reads the vault's `CLAUDE.md` for the schema and writes via whatever vault tools
the app has (the GitHub connector's read/write-file/search tools, or `mcp-obsidian`'s `get_file_contents`/`search`/
`patch_content`/`append_content`).

**Phase B (later, with dedicated hardware):** migrate to a locally-hosted obsidian-mcp — the Local REST API plugin +
`mcp-obsidian` behind an HTTP/SSE transport + Cloudflare Tunnel + Cloudflare Access → an authenticated HTTPS endpoint
added as a custom remote MCP connector (keep the GitHub connector too, or retire it). **The Agent Skill does not change**
— it already targets "whatever vault tools you have"; the migration is just swapping the connector in account settings.

## Consequences

### Gains
- `/vault` reachable from every Claude surface; the Karpathy "phone-it-in from anywhere" use case works.
- GitHub-as-source-of-truth: app writes are commits (free history), no tunnel, no Mac-must-be-on; clean sync model.
- One Agent Skill, tool-agnostic → survives the Phase-A→B connector swap with zero changes.
- Mac keeps the full `/vault` (init/sync/research + the python helpers); the apps get exactly the useful subset.

### Costs
- Vault contents now live in a private GitHub repo (a hosted copy of the whole ojfbot picture + the spine + OKRs +
  whatever personal notes accrue). Private, but it's off-machine.
- Two write paths during Phase A (GitHub from the apps, `mcp-obsidian`/Obsidian on the Mac) → the Mac must be kept
  pulled/pushed; mitigated by the skill doing it + `autocommit.sh`, but it's a discipline.
- `mcp-obsidian` writes aren't commits → without `autocommit.sh` running, `~/selfco`'s working tree can drift from git.
- Phase B is real work (tunnel, Access, an always-on box) — deferred, not free.
- One more thing to keep current: the Agent Skill is uploaded out-of-band (claude.ai UI); it has to be re-uploaded
  when `consumer/SKILL.md` changes.

### Neutral
- `~/selfco` stays its own repo (now with a GitHub remote), still not symlinked into ojfbot — consistent with ADR-0085.
- The `~/selfco` history carries ~8 MB of (since-deleted) Obsidian plugin binaries; pushed as-is — annoying, harmless.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Tunnel a local `mcp-obsidian` from the Mac now (Cloudflare/Tailscale Funnel) | Mac-must-be-on; exposes the vault over the internet (auth'd, but still); more moving parts; no auto-commit. Better as Phase B once there's dedicated always-on hardware. |
| Just Claude-Code on the Mac (no apps) | Doesn't satisfy the request — no Claude Code on iPhone; the consumer apps only do connectors. |
| Re-implement `/vault` per-app (web Skill, separate desktop config, …) | Duplication; drift. One tool-agnostic Agent Skill + one connector-of-the-moment is simpler. |
| Sync `~/selfco` to iCloud/Dropbox and point a hosted MCP at that | More plumbing than the GitHub connector, and you lose commit-per-write history. |
| Make `~/selfco` part of the ojfbot monorepo / a symlink | Contradicts ADR-0085 (the vault is deliberately standalone — "selfco OS", not an ojfbot sub-app). |
