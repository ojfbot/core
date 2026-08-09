# The surface matrix (audit of 2026-07-22 — re-verify paths before editing; they move)

The 15 fleet enumeration surfaces: file, mechanism, and per-surface action.

**Mechanism is the thing to read first.** `explicit` surfaces need a hand edit at onboard time and
drift silently between edits — they are the TD-007 population. `AUTO` and `REGISTRY-GENERATED`
surfaces need no onboard action; for those, the job is to *keep* them generated. A surface that
starts registry-generated and acquires "just one" hand-maintained list has quietly become the next
row in the explicit half of this table.

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
| 15 | Cockpit fleet-structure pane | `morning-cockpit` fleet-structure adapter → `/api/fleet-structure`, rendered by the Fleet section's Tiers/Constellation modes | **REGISTRY-GENERATED** — reads `core/decisions/northstar/README.md` + roadmap `status:` tallies + `decisions/wayfinder/*` frontmatter; census side is a `~/ojfbot/*/.git` readdir | no onboard action. **Verify it is still generated**: membership must be joined to the registry on both sides and disagreement *rendered* (unregistered = dashed), never joined to `REPO_META` (surface 5) and never a hand-kept node list — that is exactly how it would become surface #16 (TD-007) |
