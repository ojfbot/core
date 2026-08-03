# The surface matrix (audit of 2026-07-22 — re-verify paths before editing; they move)

The 14 fleet enumeration surfaces: file, mechanism, and per-surface action.

| # | Surface | File | Mechanism | Action |
|---|---------|------|-----------|--------|
| 1 | Northstar/roadmap registry | `core/decisions/northstar/README.md` | explicit YAML | register when the repo has `.claude/northstar.md` (lint ERRORs on a registered-but-missing file — never register a stub ahead of the file) |
| 2 | daily-logger collection | `daily-logger/src/collect-context.ts` `REPOS` | explicit list | append name + one-line comment |
| 3 | daily-logger API | `daily-logger/src/build-api.ts` `KNOWN_REPOS` + `TAG_TYPE_MAP` | explicit set + map | add to BOTH (set-only = tags silently dropped) |
| 4 | daily-logger prompt | `daily-logger/src/generate-article.ts` "Additional repos" | explicit prose | add a descriptive bullet (Claude mischaracterizes activity without it) |
| 5 | Cockpit fleet cards | `morning-cockpit/packages/server/src/fleet-config.ts` `REPO_META` | explicit list | add {name, role, phase} (cosmetic; adapters auto-discover) |
| 6 | Core ecosystem table | `core/CLAUDE.md` | markdown table | add a row (port, description, phase, status) |
| 7 | frame-standup sync | `core/.claude/skills/frame-standup/scripts/sync-repos.js` `REPOS` | explicit list | append |
| 8 | frame-standup extensions | `core/.claude/skills/frame-standup/scripts/read-app-standup.js` `REPOS` | explicit list | append |
| 9 | Skills/hooks install | `core/scripts/install-agents.sh <repo>` | parametric | RUN it (installs skills, hooks, settings) |
| 10 | Launcher/workbench | `core/scripts/launcher/registrations/<repo>.json` | per-repo file | OPTIONAL — only for tmux-workbench repos |
| 11 | Frame MF inventory | `core/domain-knowledge/frame-os-context.md` | explicit table | ONLY if the repo is a Frame Module-Federation remote |
| 12 | Vault repo entity | `~/selfco/wiki/entities/<repo>.md` | AUTO — `/vault sync` creates stubs for every `~/ojfbot/*/.git` | no action; note that next sync heals |
| 13 | Cockpit read-model | `listKnownRepos()` readdir + Dolt/`.handoff` adapters | AUTO | no action |
| 14 | day-runner / bead-emit | parametric on repo label; needs dir + `.git` | AUTO | no action |
