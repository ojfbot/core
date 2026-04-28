# Session protocol

Every session that touches a project with a `.handoff/` directory follows the same three-phase shape: **orient → work → handoff**. The skill is active at the seams (orient and handoff); during work it stays out of the way.

## Orient

First action when starting a session in a project with `.handoff/`:

```bash
python <skill>/scripts/orient.py --root .handoff
```

Or, if the script isn't available, read the directory directly. The script's job is to produce a short summary:

- The most recent N beads (default 5)
- Open hooks (work assignments without a closing bead)
- Recent discoveries (last 14 days, or all unmigrated)
- The last actor and what they wrote

Surface this orientation to the user before proceeding. If the most recent bead is a `brief` addressed to *this actor*, the natural next step is to confirm the goal and execute. If not, ask what to work on.

**Do not silently proceed.** The orientation is a load-bearing moment; the operator should see what state the project is in before any action.

## Work

The skill is dormant. Do the work. The only mid-session reasons to invoke the skill are:

- **A decision is being made** that's ADR-worthy → write a `decision` bead at the moment of decision, not at session end. The context will fade.
- **A non-obvious gotcha just bit you** → write a `discovery` bead now, not later. Future-you will not remember the symptoms with the clarity present-you has.

Both of these are interruptions, not session-end activity. Keep them small (templates handle the structure).

## Handoff

Before the session ends, identify what bead(s) to write. Decision tree:

```
Did this session execute substantive work?
  yes → write a `report` bead
  no  → did this session plan or delegate work?
          yes → write a `brief` bead
          no  → were there decision or discovery moments not yet captured?
                  yes → write the missing bead(s)
                  no  → no bead needed
```

A session can produce multiple beads. The common case is one (a report or a brief). The maximum useful case is three or four (report + decision + discovery + decision).

### Wrapping up

After writing the bead(s):

1. Verify the filename matches the `id` field (the `write.py` script does this automatically; manual edits should not break the invariant).
2. Stage and commit the bead(s) to git. The commit message convention is `handoff: <type>: <title>` so the git log doubles as a coarse session log.
3. If you wrote a brief and there's a recipient agent that's about to start, the brief is the orient material for that next session.

## Identity and addressing

The `actor` field is how sessions are addressed. Use stable names:

- `chat-claude` — Claude in claude.ai or the desktop/mobile app
- `code-claude` — Claude Code in a terminal session
- `<human-username>` — when a human writes a bead directly
- `<named-agent>` — for sessions running under a specific configured identity (a Frame agent, a Gas Town polecat by name, etc.)

The `to` field on briefs uses the same vocabulary. A brief addressed to `code-claude` is the orient-target for the next code session in this project.

## What about cross-repo handoffs?

A bead's `refs` field accepts `github:owner/repo#issue` URIs. A brief in repo A can reference issues in repo B; a report from repo A can be the orient material for a session about to start in repo B (the human or operator surfaces it).

For the cozy-beaver project: a brief in `asset-foundry/.handoff/` that references `beaverGame#BG-007` is a hint that the next session should consider both repos. The skill does not enforce this — it's a convention.

## A note on what *not* to write

Beads are not a chat log. Do not write a bead that reproduces conversation history. Beads are *what would be lost* if the session ended right now.

The test: would this content be useful to read 30 days from now, with no memory of the conversation that produced it? If yes, it's a bead. If no, it isn't.
