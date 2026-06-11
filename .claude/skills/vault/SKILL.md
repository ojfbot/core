---
name: vault
description: Maintain the `selfco` LLM Wiki at ~/selfco — a Karpathy-style Obsidian vault (append-only `raw/` source layer + an LLM-owned `wiki/` of source/entity/concept/synthesis pages + index.md + log.md; the schema is `~/selfco/CLAUDE.md`). Use when the user says "ingest this <file/url>", "ingest <url>", "research and file this", "query my wiki / what does my wiki say about X", "lint the wiki", "sync my vault", "init my vault", "selfco", "second brain", "vault", or wants to be oriented from the wiki. Modes: init, ingest <path|url>, research <topic>, query <question>, lint, sync [--since=7d], handoff, orient, note <title>. Distinct from /daily-logger (chronological blog) and /bead (per-repo handoff).
---

# /vault — the `selfco` LLM Wiki

This is the **Claude Code entry point** for the `/vault` skill. The full operating procedure (every mode,
the core principles, the git-mirror rules, the output format, and the constraints) lives in **`vault.md`** in
this same directory — that file is the canonical skill body and is also what the `@core/workflows` TS engine
loads. This `SKILL.md` exists so the skill is discoverable and directly invocable via the Skill tool; it does
not duplicate the procedure.

**On invocation:**

1. **Read `vault.md`** in this directory — it is the authoritative procedure. Follow it.
2. **Then read `${SELFCO_VAULT:-$HOME/selfco}/CLAUDE.md`** (the in-vault schema / operating manual) before
   acting on any mode except `init` — the in-vault schema wins if it ever disagrees with `vault.md`. If the
   vault doesn't exist yet, only `init` is valid; tell the user to run `/vault init`.
3. Parse `$ARGUMENTS` as `<mode> [args]` and execute that mode per `vault.md`.

Vault path: `${SELFCO_VAULT:-$HOME/selfco}`. Deterministic helpers (read/scaffold only; the LLM authors all
pages): `scripts/{init-vault.py, ingest.py, collect.py, lint.py, semantic-suggest.py, canvas-fit.py, install-obsidian-plugins.sh}` (`ingest.py`
auto-detects YouTube URLs and lands the transcript via `yt-dlp`). Page
scaffolds: `templates/`. Schema reference: `knowledge/wiki-schema.md`. Consumer-app companion (web / iPhone /
Mac desktop): `consumer/SKILL.md`.

**Resolving `{skill}`:** `vault.md` writes some paths with a `{skill}/…` placeholder (e.g.
`python {skill}/scripts/ingest.py`). That placeholder is substituted by the `@core/workflows` TS engine but
**not** by the Skill tool — so when this skill is invoked via the Skill tool, treat `{skill}` as **this
skill's own directory** (the directory containing this `SKILL.md` and `vault.md`). Resolve every
`{skill}/scripts/…`, `{skill}/templates/…`, and `{skill}/knowledge/…` path against it.
