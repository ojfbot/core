---
name: bead
description: Use this skill at session boundaries — when picking up work in a project that has a `.handoff/` directory, when delegating from a chat session to a Claude Code session, or when a substantive piece of work, decision, or gotcha just occurred and should not be lost. Triggers include "orient me", "pick up where we left off", "what was the last session about", "write a brief for Claude Code", "log this decision", "capture this discovery", "write a bead"; also "/bead --compact", "compact this conversation", "hand this off so another agent can continue" for a one-shot temp-file handoff that skips the ledger. The skill produces small, dated, markdown files (beads) with structured frontmatter that any future session — chat or Code — can read to reconstruct context. Bead schema is compatible with Gas Town / Beads / GasCity for optional downstream ingestion. NOTE: distinct from /handoff (post-ship runbook documentation) — /bead is for inter-session continuity via beads, not module documentation.
---

# /bead — session continuity via beads

A lightweight protocol for handing off work between Claude sessions (chat ↔ code, code ↔ code, code ↔ chat). Produces small, dated, markdown files (beads) with bead-shaped frontmatter. No infrastructure, no daemon, no database — just a `.handoff/` directory in the project root that accumulates a ledger of what happened.

## When to use this skill

Auto-trigger on these signals from the user or from session state:

- **Starting a session in a project with a `.handoff/` directory** → run `orient` first, before any other action.
- **Wrapping up a session that produced substantive work** → write a `report` bead before closing.
- **Handing off from chat to Claude Code (or back)** → write a `brief` bead aimed at the receiving actor.
- **A decision worth ADR-status was just made** → write a `decision` bead.
- **A non-obvious gotcha was discovered** (API quirk, build trap, environmental detail) → write a `discovery` bead.

Do NOT invoke for trivial sessions, single-question lookups, or conversations that produced no durable artifact.

> **Load `knowledge/scope-boundaries.md`** when unsure whether /bead applies — what this skill is NOT.

## Protocol overview

The session lifecycle has three phases:

**1. Orient.** Read the most recent beads in `.handoff/`. Understand: what hooks are open, what was last decided, what discoveries are recent, who was the last actor. Use `scripts/orient.py` or read the directory directly. Surface the orientation summary to the user/operator before proceeding.

**2. Work.** Execute. The skill is dormant during work — its job is at the seams.

**3. Handoff.** Before the session ends (context pressure, task complete, user wraps up), write at minimum one bead. A `report` if you executed work. A `brief` if you delegated work. Standalone `decision` and `discovery` beads as warranted. Use `scripts/write.py` to scaffold from templates.

> **Load `knowledge/file-map.md`** before reaching for this skill's scripts, references, or templates — the file inventory.

## How to act on auto-trigger

When the skill triggers on session start in a project with `.handoff/`:

```
1. Run `python <skill>/scripts/orient.py --root .handoff` (or read directly)
2. Surface a brief orientation: "Last session was <date>, <actor> wrote <type>.
   Open hooks: <list>. Recent discoveries: <count>."
3. Ask the user what they want to work on, OR (if a brief is addressed to you)
   proceed to execute the open brief.
```

When the skill triggers at session end:

```
1. Identify what kind of bead this session warrants (report? decision? discovery?).
2. Use `scripts/write.py <type>` to scaffold.
3. **Read `references/bead-schemas.md` before filling the frontmatter** — it defines the
   required and optional fields per bead type; a bead with wrong frontmatter is invisible
   to downstream ingestion.
4. Fill in the template fields. Do not pad — empty sections are fine, omitted is better than fluff.
5. Save the bead to `.handoff/`. The filename is generated; do not rename.
```

> **Load `knowledge/actor-identity.md`** before filling the `actor` field — the durable-identity convention.

## `--compact` mode — one-shot conversation handoff

> **Load `knowledge/compact-mode.md`** when invoked as `/bead --compact` or asked to compact/hand off the conversation — the one-shot temp-file handoff procedure skipping the ledger.

## Gotchas

- **Orient is a session-start gate, not an optional courtesy.** When a project has `.handoff/`, reading recent beads *before* acting is the whole point — skipping straight to work means you re-derive context the last actor already wrote down, and may redo or contradict a decision. If `.handoff/` exists, orient first, every time.
- **Beads record what's worth remembering, not what happened.** The strongest failure mode is turning a bead into a chat transcript or a play-by-play. Empty sections are fine; omitted is better than padded. A `discovery` bead is one gotcha, not a session diary.
- **Corrections are new beads, never edits.** `.handoff/` is append-only and nothing auto-merges. When a prior bead is wrong, write a new one that supersedes it via `refs` — do not edit or delete the old file, or you break the ledger's auditability.
- **`actor` is a durable identity, not the session.** Use stable names (`chat-claude`, `code-claude`, a human username) — inventing a fresh per-session actor breaks "the next session of code-claude" continuity that addressed `brief` beads depend on.
- **`--compact` references artifacts, it doesn't reproduce them.** The temptation is to paste plans/diffs/ADR bodies into the handoff doc. Link them by path/SHA/URL instead — a compact handoff that inlines content is neither compact nor a clean baton-pass, and it goes stale the moment the source changes.
