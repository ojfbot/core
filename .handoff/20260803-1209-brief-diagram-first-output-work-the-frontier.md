---
id: 20260803-1209-brief-diagram-first-output-work-the-frontier
type: brief
title: "diagram-first-output: work the frontier (#368 research first)"
actor: code-claude
to: code-claude
session_id: 2026-08-03T17:09:00Z
refs:
  - github:ojfbot/core#366
  - github:ojfbot/core#368
  - github:ojfbot/core#369
  - github:ojfbot/core#371
  - github:ojfbot/core#372
  - github:ojfbot/core#373
  - file:decisions/wayfinder/diagram-first-output.md
  - file:domain-knowledge/diagram-conventions.md
  - file:.claude/skills/diagram/SKILL.md
  - path:~/selfco/diagrams/
hook: github:ojfbot/core#366
status: live
created_at: 2026-08-03T17:09:00Z
labels:
  project: diagram-first-output
---

# diagram-first-output: work the frontier

## Where this stands (all VERIFIED against git/tracker, 2026-08-03)

- Wayfinder map `decisions/wayfinder/diagram-first-output.md` — status **working**, umbrella #366,
  anchored `ns:l2-ojfbot#P2`. PRs #374/#375/#376 all MERGED to core main.
- CLOSED same day (operator in-loop fast-track): #367 convention → `domain-knowledge/
  diagram-conventions.md`; #370 skill design → `/diagram` skill, user-scoped (18 symlinks),
  catalog v1.22.
- Delivery rules now in the SKILL.md: always end by sending mermaid-cli-rendered SVGs to the
  side panel; standing diagrams land in `~/selfco/diagrams/` (Obsidian norm; outside wiki/;
  schema row added to vault CLAUDE.md). `fleet-map.md` lives there; personal-knowledge holds a
  pointer stub.
- Weekly cloud routine `pocock-diagram-experiments-watch` (trig_01XjBwdHse4dRGfBcuSuC7b4) fires
  Mondays ~8:23am CT starting 2026-08-10, posting tldraw-vs-React deltas as comments on #368
  ONLY. First run also proves/disproves cloud-agent `gh` comment auth (fallback: run log).

## Next session: ONE ticket, per wayfinder discipline

**Default pick: #368 tldraw agent ecosystem deep-research** (research type, ONE deep-research
cycle — never parallel). It unblocks #372 (canvas spike) and its findings file to
`decisions/research/`. Cover: tldraw SDK agent-drawing patterns, `.tldr` format stability,
`@kitschpatrol/tldraw-cli` headless export, mermaid↔tldraw conversion, SDK licensing/watermark,
and `mattpocock/course-video-manager` `app/features/diagrams/` snapshot-lineage internals
(Diagram = named lineage; DiagramSnapshot pinned per Clip). Check #368 comments for watch
evidence before starting. Claim = assignment: comment-claim the issue first.

Alternative picks if the operator prefers HITL: #369 (where diagrams live / which boundaries
gate — graduates the merge-quiz fog), #371 (automation, shadow-first per /gated-slice), #373
(Adobe publish endpoint).

## Gotchas carried forward

- Operator revision on record: canvas UI is the requirement; **tldraw = leading candidate, NOT
  a marriage** (map Notes). The spike (#372) must weigh Matt's React-diagram direction too.
- GitHub rendering of the #366 session diagrams is DOM-verified (2 viewscreen mermaid iframes)
  but not pixel-verified — browser-pane screenshots went black this session. 10-second manual
  check if it matters.
- Local core main carries other sessions' unpushed bead commits + a merge commit; main is
  push-protected — leave it, land beads via PR when their sessions do.
- `pnpm dlx @mermaid-js/mermaid-cli` chromium is cached in this machine's pnpm store — renders
  are fast now; use for every /diagram parse check.
