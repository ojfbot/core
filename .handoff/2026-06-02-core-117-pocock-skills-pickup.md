---
id: core-117-pocock-skills-pickup-2026-06-02
type: brief
title: "core#117 — land Pocock skill conventions + 7 new skills (rebase, resolve catalog, renumber ADR)"
actor: code-claude (the 2026-06-02 fleet PR-cleanup session)
to: code-claude (next session picking up core#117)
session_id: 2026-06-02T02:31:35Z
refs: [github:ojfbot/core#117, github:ojfbot/core#126, github:ojfbot/core#127, file:.claude/skills/skill-loader/knowledge/skill-catalog.json, file:decisions/adr/0070-vault-multi-surface-access.md, file:.claude/skills/vault/SKILL.md, file:CLAUDE.md, file:scripts/install-agents.sh, adr:0079, adr:0080]
hook: ""
status: live
created_at: 2026-06-02T02:31:35Z
labels:
  project: core-skills
---

## Context

PR **#117** (`claude/improve-core-skills-bTevN` → `main`, **+712/−9 across 21 files**) is the last substantive PR left from a fleet-wide PR cleanup on 2026-06-02 that merged 12 PRs and advanced `core` `main` a lot (ADR-0079/0080, the vault `SKILL.md` from #126, `lint.py --stale` from #124). #117 was deliberately deferred for its own pass. It adds Pocock-style skill conventions: **7 new skills** (`/prototype`, `/caveman`, `/zoom-out`, `/git-guardrails`, and the `/writing-fragments`→`/writing-beats`→`/writing-shape` pipeline, all as `<name>/<name>.md`); edits to `bead.md` (`--compact`), `pr-review`/`spec-review`/`validate` (doc-only "Spec vs Standards" reframing), `skill-create/knowledge/naming-guide.md`; a skill `status` lifecycle wired into `scripts/install-agents.sh` (jq skip) + `scripts/hooks/suggest-skills.mjs`; registration in `skill-catalog.json` (+6) and `packages/workflows/src/registry.ts` (+7); `CLAUDE.md` table rows; `TECHDEBT.md`; and two trivial unused-import test fixes. **It does NOT touch `.claude/skills/vault/`** — no collision with this session's vault work. CI was green on its head (stale runs; re-runs on rebase). Re-verified vs current `main` on 2026-06-02: only **two** blockers remain.

## Goal

Rebase #117 onto current `origin/main`, clear the two blockers (one real conflict + one ADR-number clash), decide the SKILL.md question for the new skills, and merge it (rebase strategy). Do the git surgery in an **isolated `/tmp` clone** — `/Users/yuri/ojfbot/core` is worked on by concurrent agents (a wrong-branch rebase bit this session; see Flag back).

## Acceptance criteria

- [ ] **Conflict resolved:** `.claude/skills/skill-loader/knowledge/skill-catalog.json` — the *only* true conflict (verified via `git merge-tree`; `CLAUDE.md` and `scripts/install-agents.sh` auto-merge clean). Keep **both** entry sets (main's + #117's 6), take higher `version` + today's `updated`, valid JSON.
- [ ] **ADR renumbered:** #117 adds `decisions/adr/0070-pocock-skill-conventions-and-new-skills.md`, but `0070-vault-multi-surface-access.md` already exists on main. Numbers in use: **0069, 0070, 0073, 0079, 0080** → rename to **`0081`** (verify `core#127` hasn't also claimed 0081; else 0082). Update the filename, the ADR's own title/header, the `CLAUDE.md` reference, and any skill-body/catalog citation of it.
- [ ] **SKILL.md decision made** (see Constraints) — either add a thin `SKILL.md` per new skill, or file a follow-up; do not leave it implicit.
- [ ] `python3 -c "import json; json.load(open('.claude/skills/skill-loader/knowledge/skill-catalog.json'))"` passes; no duplicate ADR numbers (`ls decisions/adr/ | grep -oE '^[0-9]{4}' | sort | uniq -d` empty).
- [ ] CI green (the `packages/workflows/src/__tests__/mail.test.ts` ENOTEMPTY test is **flaky** — re-run, don't chase); `gh pr view 117 --json mergeable` → MERGEABLE/CLEAN.
- [ ] Merged via `gh pr merge 117 --repo ojfbot/core --rebase --delete-branch`; `main` left clean.

## References

- github:ojfbot/core#117 — the PR (head `claude/improve-core-skills-bTevN`)
- github:ojfbot/core#126 — merged this session; added `.claude/skills/vault/SKILL.md` as the Skill-tool-callability template (thin SKILL.md deferring to `<name>.md`)
- github:ojfbot/core#127 — open (concurrent session's YouTube-ingest PR); check only for ADR-number overlap
- file:.claude/skills/skill-loader/knowledge/skill-catalog.json — the conflict
- file:decisions/adr/0070-vault-multi-surface-access.md — the number that clashes
- adr:0079, adr:0080 — merged this session (vault page-lifecycle + staleness scanner)
- file:core/CLAUDE.md (Architecture §) — documents the `<name>/<name>.md` skill format

## Flag back

- **Concurrent-agent hazard (live):** multiple agents operate on `/Users/yuri/ojfbot/core` at once. A survey-then-act gap caused a wrong-branch rebase this session. **Re-check `git rev-parse --abbrev-ref HEAD` + `git status --porcelain` immediately before any destructive op**, and prefer a throwaway `/tmp` clone for the rebase/resolve, then `--force-with-lease` push + merge via `gh`. Do not `reset --hard`/discard anyone's uncommitted or unpushed work.
- **SKILL.md / systemic format decision is NOT yours to make unilaterally** if you go the batch route: adding `SKILL.md` to *all* ~40 core skills + wiring `install-agents.sh` contradicts the documented `<name>/<name>.md` format in `core/CLAUDE.md` and is **ADR-shaped**. For #117 specifically, adding a thin `SKILL.md` for just its 7 new skills is in-scope and safe; the fleet-wide change should be its own ADR + PR. Surface to the user before doing the fleet-wide version.
- If the catalog conflict turns out non-trivial (e.g. #127 also merged catalog entries by the time you start), re-confirm the merged JSON is valid and all skills resolve before merging.

## Constraints

- **The 7 new skills won't be Skill-tool-callable as shipped.** This session established that the Skill *tool* discovers only `<dir>/SKILL.md`; ojfbot's `<name>/<name>.md` skills are reachable via the slash/TS-engine paths but **not** `Skill(<name>)`. #126 fixed this for `vault` with a thin `SKILL.md` (frontmatter `name`+concise `description`, body defers to `<name>.md`). Mirror that per new skill if you want them Skill-tool-callable on merge — copy the shape from `.claude/skills/vault/SKILL.md`.
- Use **pnpm**, never npm (`pnpm --filter @core/workflows test`).
- Match the rebase-merge strategy used for the rest of this cleanup; keep `main` clean (on `main`, 0/0 vs origin).
- Don't touch `core#127`'s branch/work; coordinate only on the ADR number.

## Time-box

Not a spike — but if the catalog conflict balloons because of newer merges, stop and re-scope rather than force a messy merge.
