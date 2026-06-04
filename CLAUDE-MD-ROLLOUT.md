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
| cv-builder | audited | ~4151 | ~600 (proj.) | — | Propose validated. **Finding:** root `ARCHITECTURE.md` pointer (CLAUDE.md:15) is broken — real file is `docs/ARCHITECTURE.md`. Plan: relocate-not-delete + fix pointer. L1: agent-core (add-an-agent), `.claude/rules/mf-and-deploy.md`. |
| purefoy | pr-open | ~4066 | ~1243 | [purefoy#44](https://github.com/ojfbot/purefoy/pull/44) | ~69% drop, relocate-only. L1 `deakins_forums/CLAUDE.md`; L2 in repo-native `documentation/` (NOT `domain-knowledge/` — it's a gitignored symlink farm into core). |
| virtualLight | untouched | ~3746 | — | — | most lines (390); comprehensive doc |
| blogengine | untouched | ~2840 | — | — | multi-tab dashboard; lens/responder rules |
| TripPlanner | untouched | ~2831 | — | — | 11-phase SSE pipeline subtree |
| core | untouched | ~5097 | — | — | **predicted minimal** — mostly Layer-0 (command catalog + ecosystem map). Validates "size ≠ problem". |

**Process per cycle (`/claude-md-rollout --step`):**
1. Pick the first repo in `untouched` (top of table order).
2. `/claude-md-audit <repo> --apply` on a new `docs/claude-md-routing` branch in that repo.
3. Re-measure; record `After` tokens + assert 0 `@import` routings.
4. Open a PR; set state `pr-open`, fill the PR column.
5. Commit this tracker. Do **one** repo, then stop.

**Rollout is inert without the `/schedule` routine** — pausing/deleting it halts all automation. Each step is a reviewable PR; nothing auto-merges.
