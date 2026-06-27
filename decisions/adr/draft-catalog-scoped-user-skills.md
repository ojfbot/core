# ADR: Catalog-scoped user skills — `install --user-scope` is data-driven, not a hardcoded list
slug: catalog-scoped-user-skills
serial: draft
rev:
Date: 2026-06-26
Status: Proposed
domain: meta
type: tooling
OKR: —
Commands affected: install-agents.sh (--user-scope); every skill flagged scope:["user"]
Repos affected: core (scripts/install-agents.sh, templates/user-claude-md.template, skill-catalog)
gate:
baseline:
traces:
  supersedes:
  amends: [user-scope-baseline]
  relates-to: [stable-identity-and-facet-tags]
  parent:
  part-of-series:

---

## Context

`install-agents.sh --user-scope` is meant to symlink every skill the catalog flags `scope:["user"]`
into `~/.claude/skills/`, so those skills work in any session on the machine. The documentation
(global `~/.claude/CLAUDE.md`, this repo's `CLAUDE.md`) describes exactly that catalog-driven
behavior. **The code did not match:** the loop was a hardcoded `for skill in grill-with-docs tdd
deepen triage` — the original four Pocock skills (`user-scope-baseline`). Every skill flagged
`scope:["user"]` *since* — `bead`, `resume`, `frame-standup`, `adr`, `investigate`, `validate`,
`roadmap`, `skill-loader`, `daily-logger` — silently never synced.

This was caught while activating `/resume` (the session-provenance work): the skill was flagged
`scope:["user"]`, the docs said `--user-scope` would install it, but it never appeared — `/resume`
had to be symlinked by hand. The gap blocks the "stubbed → functional" step for the whole day-runner
loop, since the loop's skills are exactly the ones that weren't syncing.

## Decision

Make the `--user-scope` symlink set **data-driven from the catalog**: read
`skill-catalog.json` and symlink every entry whose `scope` array contains `"user"`, instead of a
hardcoded list. One exception: **`vault` is excluded** from the automatic loop — it has side effects
(`init-vault.py` scaffolds `~/selfco`) and keeps its existing opt-in flow under `--with-selfco`.

A missing skill dir for a flagged name is a `WARN`, not a silent skip. The managed CLAUDE.md template
stops enumerating a fixed four and instead states the rule (flag `scope:["user"]`, re-run
`--user-scope` to sync), so the doc can't drift from the catalog again.

## Consequences

### Gains
- Flagging a skill `scope:["user"]` in the catalog is now sufficient to make it user-scope — the
  single source of truth the docs already claimed. No code edit per skill.
- `/resume`, `/bead`, `/frame-standup`, and the rest of the day-runner loop install correctly, closing
  the stubbed→functional gap.
- Code, docs, and the catalog agree; the template states the rule, not a list that goes stale.

### Costs
- A first `--user-scope` run after this change adds ~13 symlinks at once (everything currently
  flagged). That's the intended state, but it's a larger user-scope surface than the prior four.
- `vault`'s exclusion is a named special-case in the loop — a small wart justified by its
  scaffolding side effect.

### Neutral
- This is the install half of what an earlier unmerged stub bundled as "catalog-scoped user skills +
  availability-aware suggestions." The **suggestion-availability** half (filtering skill suggestions
  by what's actually installed) is a separate concern and not decided here.
- Does not retroactively remove stale symlinks for skills no longer flagged `scope:["user"]`; a drift
  sweep can be added later if needed.
