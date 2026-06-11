# CLAUDE.md loading-discipline rollout (ADR-0081)

Opt-in, PR-gated, automated rollout of the loading-discipline to oversized `CLAUDE.md` files.
Advanced **one repo per cycle** by `/claude-md-rollout --step` (run manually or by a `/schedule` cron).
Surfaced daily in `/frame-standup`. See `decisions/adr/0081-*.md` and `.handoff/adr-0081-loading-discipline-handoff.md`.

**State machine:** `untouched → audited → pr-open → merged → gated`
- `untouched` — in scope, not started.
- `audited` — `/claude-md-audit` proposed a routing plan (no PR yet).
- `pr-open` — decomposition PR open for review.
- `merged` — PR merged; Layer-1 files live.
- `gated` — (after Slice 2) the PreToolUse gate is active for this repo.

**Metric (M1) is descriptive, not a target.** A near-zero footprint drop is correct for a Layer-0-heavy repo.
Baseline tokens are the always-loaded measurement at rollout start (`footprint.mjs`).

| Repo | State | Baseline (M1, ~tokens) | After (~tokens) | PR | Notes |
|------|-------|------------------------|-----------------|-----|-------|
| cv-builder | merged | ~4151 | ~941 | [cv-builder#148](https://github.com/ojfbot/cv-builder/pull/148) | ~77% drop, relocate-only. Fixed broken `ARCHITECTURE.md` pointer → `docs/ARCHITECTURE.md`. L1 `packages/agent-core/CLAUDE.md` + `.claude/rules/mf-and-deploy.md` (paths-scoped); L2 `docs/claude-reference.md`. Verified ARCHITECTURE.md is NOT a superset → relocated, not deleted. Unblocked by dep fix [cv-builder#149](https://github.com/ojfbot/cv-builder/pull/149) (langsmith/fast-xml-builder HIGH vulns). |
| purefoy | merged | ~4066 | ~1243 | [purefoy#44](https://github.com/ojfbot/purefoy/pull/44) | ~69% drop, relocate-only. L1 `deakins_forums/CLAUDE.md`; L2 in repo-native `documentation/` (NOT `domain-knowledge/` — it's a gitignored symlink farm into core). PR also dropped stale "keep PRIVATE" framing across 7 docs (repo is public; scraped data gitignored). |
| virtualLight | untouched | ~3746 | — | — | most lines (390); comprehensive doc. **SKIPPED 2026-06-11:** no `origin` remote and CLAUDE.md (plus most of the repo) is untracked — not PR-gateable. Needs a remote + initial commit before rollout; `--step` should skip to the next repo until then. |
| blogengine | pr-open | ~2832 | ~1041 | [BlogEngine#57](https://github.com/ojfbot/BlogEngine/pull/57) | ~63% drop, relocate-only. L1 `packages/browser-app/CLAUDE.md` (Redux/Carbon + MF remote config, ~441 cond-tokens); L2 `documentation/claude-reference.md` (new tracked dir — `domain-knowledge/` is the gitignored symlink farm). Fixed stale package list (`browser-automation` undocumented). 0 @imports. |
| TripPlanner | untouched | ~2831 | — | — | 11-phase SSE pipeline subtree |
| core | untouched | ~5097 | — | — | **predicted minimal** — mostly Layer-0 (command catalog + ecosystem map). Validates "size ≠ problem". |

**Process per cycle (`/claude-md-rollout --step`):**
1. Pick the first repo in `untouched` (top of table order).
2. `/claude-md-audit <repo> --apply` on a new `docs/claude-md-routing` branch in that repo.
3. Re-measure; record `After` tokens + assert 0 `@import` routings.
4. Open a PR; set state `pr-open`, fill the PR column.
5. Commit this tracker. Do **one** repo, then stop.

**Rollout is inert without the `/schedule` routine** — pausing/deleting it halts all automation. Each step is a reviewable PR; nothing auto-merges.
