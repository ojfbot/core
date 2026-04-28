---
name: bead
description: Use this skill at session boundaries — when picking up work in a project that has a `.handoff/` directory, when delegating from a chat session to a Claude Code session, or when a substantive piece of work, decision, or gotcha just occurred and should not be lost. Triggers include "orient me", "pick up where we left off", "what was the last session about", "write a brief for Claude Code", "log this decision", "capture this discovery", "write a bead". The skill produces small, dated, markdown files (beads) with structured frontmatter that any future session — chat or Code — can read to reconstruct context. Bead schema is compatible with Gas Town / Beads / GasCity for optional downstream ingestion. NOTE: distinct from /handoff (post-ship runbook documentation) — /bead is for inter-session continuity via beads, not module documentation.
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

## What this skill is NOT

- Not a project management system. It does not replace GitHub issues, ADRs, or CLAUDE.md.
- Not a full Gas Town. The frontmatter is bead-compatible by design so this can be ingested later, but the skill is standalone and has no Gas Town runtime dependency.
- Not a chat log. Beads are the things worth remembering; the conversation that produced them is not preserved.
- Not auto-merging. Nothing in `.handoff/` ever overwrites or merges. Beads are append-only; corrections take the form of a new bead that supersedes a prior one (referenced via `refs`).

## Protocol overview

The session lifecycle has three phases:

**1. Orient.** Read the most recent beads in `.handoff/`. Understand: what hooks are open, what was last decided, what discoveries are recent, who was the last actor. Use `scripts/orient.py` or read the directory directly. Surface the orientation summary to the user/operator before proceeding.

**2. Work.** Execute. The skill is dormant during work — its job is at the seams.

**3. Handoff.** Before the session ends (context pressure, task complete, user wraps up), write at minimum one bead. A `report` if you executed work. A `brief` if you delegated work. Standalone `decision` and `discovery` beads as warranted. Use `scripts/write.py` to scaffold from templates.

## Files in this skill

- `references/bead-schemas.md` — frontmatter schema per bead type
- `references/session-protocol.md` — orient → work → handoff in detail
- `references/gas-town-compatibility.md` — how this maps to bead/Gas Town/GasCity for downstream ingestion
- `templates/<type>.md` — scaffolding templates for each bead type
- `scripts/orient.py` — read recent beads, produce orientation summary
- `scripts/write.py` — scaffold a new bead from template
- `scripts/replay.py` — show timeline of beads since a date

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
3. Fill in the template fields. Do not pad — empty sections are fine, omitted is better than fluff.
4. Save the bead to `.handoff/`. The filename is generated; do not rename.
```

## A note on identity

The `actor` field in bead frontmatter is the addressable identity. Sessions are ephemeral; actors are durable. Use stable names: `chat-claude`, `code-claude`, `<human-username>`, or named agents from your wider system. This identity convention is what makes "the next session of code-claude" coherent across time.
