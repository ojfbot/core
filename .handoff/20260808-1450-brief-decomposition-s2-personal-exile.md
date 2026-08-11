---
id: 20260808-1450-brief-decomposition-s2-personal-exile
type: brief
title: "core decomposition S2: personal exile + attic + dead-structure delete (gated on #436 — now MERGED)"
actor: code-claude
session_id: 2026-08-08T14:50:00Z
refs:
  - github:ojfbot/core#436
  - 20260808-1445-report-decomposition-s1-reconciler-pr436
  - file:TECHDEBT.md
  - file:scripts/install-agents.sh
status: open
created_at: 2026-08-08T14:50:00Z
labels:
  project: core-decomposition
  slice: S2
---

# S2 — personal exile + attic + dead-structure delete

Entrance criterion MET: S1 (fleet reconciler, shadow) merged as `695bb3c` on origin/main.
The reconciler will catch any reference this slice misses.

## Ground rules (from S1 session)

- Cut a fresh worktree from **origin/main**; local core main runs diverged — never build from it.
- One PR, human-gated. Never touch `~/selfco/tracking/` or `decisions/northstar/` frontmatter.
- Log deviations to implementation-notes.md under a dated S2 heading (S1 heading precedent).

## Scope (from the approved Option A proposal)

1. **Personal exile**: move `personal-knowledge/` (15 files, already gitignored → no git surgery)
   to `~/selfco/career/`; leave a pointer README. Retarget `install-agents.sh` §5's
   `tbcony-job-target.md` symlink to the new home — or better, grill whether distributing a job
   doc fleet-wide should survive at all (recommend: drop the phase, note in PR).
2. **frame-os-context split**: strip operator job-target framing out of fleet-symlinked
   `domain-knowledge/frame-os-context.md` (product context stays; career framing → ~/selfco/career/).
3. **Attic**: move the 9 dated root audits (HARDENING-AUDIT, SURVEY, DIA-CROSSCHECK, …) to
   `docs/audits/`. `CLAUDE-MD-ROLLOUT.md` and `implementation-notes.md` STAY (script-read state).
4. **Dead-structure delete**: empty `skills/` + `runs/` dirs; `packages/cli` +
   `packages/vscode-extension` shells (git history preserves); fix README/docs/architecture.md
   claims about them; remove `skills/**` from the /techdebt allowlist note in CLAUDE.md:352.
   Stale worktree `.claude/worktrees/brave-lumiere-f43c8c` (holds divergent catalog stamped
   v1.22/68-entries): `git worktree remove` it — check its branch `claude/gifted-lamarr-05695a`
   for unmerged work FIRST; if dirty, report, don't force.
5. **Verify**: installer idempotent re-run across the fleet; all symlinks resolve;
   `node scripts/fleet-manifest.mjs` shows no NEW drift; full vitest from the installed checkout.

## Success criteria

- Installer re-run clean fleet-wide; zero dead symlinks; reconciler drift unchanged or reduced.
- No skill/script references a deleted path (grep for `packages/cli`, `runs/`, `skills/` root refs).
- PR body lists every moved/deleted path with its disposition.
