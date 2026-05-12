# `/vault` — consumer-app Agent Skill

`SKILL.md` here is a **Claude Agent Skill** — the version of `/vault` that works in the Claude *apps*
(claude.ai web, the iPhone app, the Claude Desktop Mac app), as opposed to the full Claude-Code `/vault`
skill one level up (`../vault.md`), which only runs in Claude Code on the Mac (it needs the python scripts +
the ojfbot repos on disk + git).

It covers `ingest` / `query` / `note` / `orient` — the LLM-authoring modes. It's **connector-agnostic**: it
reads the vault's `CLAUDE.md` (the schema) and writes via whatever vault tools the app has — the **GitHub
connector** on the `selfco` repo, or a local **`mcp-obsidian`** server. So it doesn't change when you migrate
connectors (see `../knowledge/connectors.md`).

## Install it

You need a vault connector attached first (`../knowledge/connectors.md` — Phase A: the GitHub connector on
`ojfbot/selfco`, plus optionally `mcp-obsidian` in the Mac desktop app). Then add this Skill to your Anthropic
account so it's available across web / desktop / mobile:

- **claude.ai (web):** Settings → **Capabilities → Skills** → **Create skill** (or **Upload**) → give it the
  `name`/`description` from `SKILL.md`'s frontmatter and paste the body (or upload a zip of this `consumer/`
  folder if the UI accepts a bundle). It then shows up in the web app, the Mac desktop app, and the iPhone app.
- **Claude CLI / Claude Code:** `claude skill install <path-to-this-folder>` (or zip it and upload) if you'd
  rather manage it from the terminal — but note the *Claude-Code* `/vault` (`../vault.md`) already covers the
  Mac, so the main reason to install this one is the apps.
- Keep this folder as the source of truth and re-upload when it changes (it's versioned alongside `/vault` in
  the `core` repo on the `feat/selfco-vault` branch).

## Use it

In any Claude app with a vault connector + this Skill: `/vault ingest <url>`, `/vault query <question>`,
`/vault note <title>`, `/vault orient` — or just describe the task ("ingest this article into my selfco wiki")
and the model picks the Skill up from its `description`. With the GitHub connector, each write is a commit to
`ojfbot/selfco`; `git pull` on your Mac to bring them down. With `mcp-obsidian`, writes are uncommitted in
`~/selfco` — `git push` from your Mac (or run `../scripts/autocommit.sh`).

`init` and `sync` are not here — run those in Claude Code on the Mac (`/vault init`, `/vault sync`).
