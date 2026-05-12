---
id: selfco-box-spec-review-2026-05-12
type: brief
title: "selfco-box plan — spec-review + grounding + coordination"
actor: code-claude (the /vault v1–v5 session)
to: code-claude (the selfco-box builder session)
session_id: hq-vault-v1-v5
refs: [adr:0069, adr:0070, file:.claude/skills/vault/knowledge/connectors.md, file:.claude/skills/vault/vault.md, file:.claude/skills/vault/consumer/SKILL.md, github:ojfbot/selfco]
hook: ""
status: live
created_at: 2026-05-12T01:00:00Z
labels:
  project: selfco-box
---

## Context

`selfco` (`/Users/yuri/selfco`, mirrored to private `ojfbot/selfco` — **GitHub is the source of truth**) is already
built: a Karpathy "LLM Wiki" (`raw/` immutable + LLM-authored `wiki/{sources,entities,concepts,synthesis}` + `index.md`
+ `log.md`), with **`~/selfco/CLAUDE.md` as the self-contained schema** the box's worker must read at startup and obey.
The `/vault` Claude-Code skill (`.claude/skills/vault/vault.md` — `init`/`ingest`/`research`/`query`/`lint`/`sync`/
`handoff`/`orient`/`note`), the tool-agnostic consumer Agent Skill (`consumer/SKILL.md`), the `prompts/session-handoff.md`
export prompt, the `connectors.md` doc, ADR-0069 (the vault+skill) and **ADR-0070 (multi-surface access — your ADR-0071
supersedes its deferred "Phase B")** are all on the **`feat/selfco-vault`** branch (worktree `~/ojfbot/core-selfco-vault`,
commit `3c62ce6`) — base your core-side edits there (or on `main` if the user merges it; ask). The `/vault ingest`
procedure already unpacks a pasted `--- BEGIN selfco handoff bundle ---` block — so a Shortcut that `POST /capture`s a
handoff bundle "just works" via your worker (worth noting in your README — no new code).

## Goal

Build `ojfbot/selfco-box` per your plan. This brief is the spec-review + the grounding you need; act on the gaps below.

## Acceptance criteria (the spec-review — fix these before/while building)

- [ ] **MCP-connector auth behind Cloudflare Access is decided in Slice 2/3, not "at implementation time."** Anthropic's
  custom-connector flow needs `/mcp` to be public-unauthenticated or OAuth — it can't pass an interactive CF-Access login
  from Anthropic's servers. Pick: CF Access **only** on `POST /capture`, `/mcp` exposed-but-bearer-token-gated (the
  connector sends `Authorization: Bearer …`); OR a CF-Access **service token** on `/mcp` *if* the connector UI lets you
  set arbitrary headers; OR MCP OAuth on the daemon. The daemon's bearer check is the backstop, but it must be the
  *primary* gate for `/mcp` unless OAuth lands.
- [ ] **`ingest(url)` ⇒ the *daemon* fetches the URL (with SSRF guards), not the agent.** The agent has "no arbitrary
  HTTP fetch" — so the daemon does a server-side fetch (block RFC-1918 / link-local / `169.254.169.254` / `localhost`,
  cap size, careful redirects), writes the page to `raw/<slug>.md`, *then* the agent processes already-fetched text.
  Make this explicit in `agent.ts` / `server.ts`.
- [ ] **`raw/` writes are idempotent under queue retry** — a partially-written job that retries can't duplicate/orphan a
  `raw/<slug>.md`. Stage-and-commit-or-rollback atomically per job, or "if `raw/<slug>.md` exists, skip the write." The
  vitest should assert *file-write* idempotency, not just queue semantics.
- [ ] **The agent loop is bounded** — max-turns + a per-job token budget (you log cost; also *cap* it) so a pathological
  ingest can't loop forever or burn dollars.
- [ ] **`autocommit.sh` vs the daemon's committer — one or the other.** Either don't run `autocommit.sh` on the box (the
  daemon's `git pull --rebase --autostash` before each commit already catches hand-edit drift), or have `autocommit.sh`
  take the same single-flight lock the worker uses. Don't run both unguarded.
- [ ] **Path-jail: re-check the prefix *after* `realpath`** (symlink escape), and bar the agent from writing inside
  `.git/` and `.obsidian/` even within `$SELFCO_VAULT`. vitest includes a symlink-escape attempt, not just `..`.
- [ ] **Streamable-HTTP session resumption** — `@modelcontextprotocol/sdk`'s HTTP transport has session IDs /
  resumability; handle reconnects.
- [ ] Everything else in your plan stands — GitHub-as-source-of-truth ("just another clone", pull-rebase before / push
  after), Mac-mini-over-Jetson (cloud brains ⇒ no GPU), `/security-review` before Slice 3, `/adr` for ADR-0071, the
  human-gate flag. Build *on* what exists; don't re-do the vault schema, the `/vault` skill, the consumer Skill, the
  handoff prompt, or the GitHub-connector path.

## References

- adr:0069 (`decisions/adr/0069-selfco-vault-and-skill.md`) — the vault + `/vault` skill
- adr:0070 (`decisions/adr/0070-vault-multi-surface-access.md`) — multi-surface access; your ADR-0071 supersedes its "Phase B"
- file:.claude/skills/vault/knowledge/connectors.md — the connector model (GitHub connector / mcp-obsidian / Phase-B sketch)
- file:.claude/skills/vault/vault.md — the `/vault ingest` procedure (vendor into the worker's system prompt) + `handoff`
- file:.claude/skills/vault/consumer/SKILL.md — the consumer Agent Skill to update (delegate to the box's MCP tools)
- file:.claude/skills/vault/scripts/autocommit.sh — reuse pattern (but see the constraint above)
- file:domain-knowledge/selfco-vault.md, file:domain-knowledge/app-templates.md, file:domain-knowledge/shared-stack.md
- `/Users/yuri/selfco/CLAUDE.md` — the schema the worker must obey (read at daemon startup)
- github:ojfbot/selfco — the vault mirror (the box's `~/selfco` is a clone of this)

## Flag back

- Whether the user wants `feat/selfco-vault` merged to `main` first (so your core-side edits go on `main`, not the
  worktree) — that's the user's call; ask before assuming.
- The "update the Graphify knowledge graph" requirement — confirm with the user it means "write well-linked markdown,
  Graphify re-renders on open" (Graphify is a closed app with no update API). If they want a *live queryable graph
  artifact* (a generated `graph.json` / a graph DB), that's a separate component — flag, don't silently build it.
- Anything that would change the vault *schema* (`~/selfco/CLAUDE.md` / `templates/vault-claude-md.md` / the page
  schemas) — don't do unilaterally; the worker *uses* the schema, it doesn't get to redefine it.

## Flag for /security-review

Ping the `/vault` v1–v5 session (or run it yourself) for `/security-review` on `ojfbot/selfco-box` after Slices 1–2,
**before Slice 3 (exposure)** — focus: prompt-injection through ingested content (#1 risk; treat all ingested text as
untrusted data, never instructions), the path-jail, the `git_commit` tool's remote-allowlist, the bearer-token
middleware, secrets isolation (`ANTHROPIC_API_KEY`/`SELFCO_BOX_TOKEN` outside the vault), the URL-fetch SSRF guards,
`/capture` rate-limit + payload-size cap. Gate exposure on no high/critical.

## Constraints

- One ingest at a time (you have this — keep it; the git committer + the path-jailed FS are not concurrency-safe).
- Don't make the box a *second* source of truth — GitHub stays the hub; the box pulls-rebase before, pushes after.
- `ojfbot/selfco-box` is its own repo, not in any pnpm workspace, not inside `ojfbot/selfco` (ADR-0069 keeps the vault
  as content, not code) — matches your plan.
- When you edit `consumer/SKILL.md` / `connectors.md` / `core/CLAUDE.md` / `domain-knowledge/selfco-vault.md`: also add a
  one-paragraph "the selfco box" note to `.claude/skills/vault/templates/vault-claude-md.md` (and a one-liner to
  `vault.md`) so the in-vault schema mentions the box too — the `/vault` v1–v5 session already added that paragraph to
  the live `~/selfco/CLAUDE.md`; mirror it into the template so future `init` carries it.
