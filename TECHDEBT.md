# Technical Debt

Last updated: 2026-07-25

| ID | Severity | Kind | Location | Description | Effort | Status |
|----|----------|------|----------|-------------|--------|--------|
| TD-006 | HIGH | process | decisions/loops/loops.md:218 (`hook-bead-session`), scripts/hooks/bead-session.sh | The loops registry declares `hook-bead-session` live with the purpose "writes the session's report bead", but the script is a PostToolUse hook that never touches `.handoff/`. Nothing closes the bead ledger, so `orient.py` reports every brief as a permanently open hook: 28 open hooks, 9 reports, 3 closures ever, 32% of beads non-conformant. Green under `loops-lint` (existence ≠ purpose), skipped by `loops-liveness` (`cadence: event`), `verifier: none`. Discovered 2026-07-25 by a false pickup of #274. Fix: `rm:rm-l2-ojfbot#S32` then `#S33`. See expanded section. | M | open |
| TD-005 | LOW | structure | .claude/skills/frame-standup/frame-standup.md (372 lines), .claude/skills/orchestrate/orchestrate.md (369 lines) | Both main skill files exceed the Tier-2 line budget (≤250; see skill-create/knowledge/naming-guide.md). Both already have `knowledge/` subdirs but the bulk of the orchestration prose, prompt templates, and step detail still lives inline, which inflates context cost every time the skill loads. Fix: move the long inline prompt/template/example blocks into the existing `knowledge/` files behind JIT `> Load knowledge/<topic>.md` directives, leaving quick-start + workflow skeleton in the main file. Audited 2026-05-12 (ADR-0083); all other skill files are within budget. | M | open |
| TD-004 | HIGH | process | daily-logger/src/generate-article.ts | Action closure pipeline uses 50-char description substring as matching key. Claude paraphrases descriptions in closedActions output, breaking the match silently — actions stay open indefinitely. Fix: deterministic action IDs (act-{date}-{command}-{hash}), prompt hardening, orphan detection. PR: ojfbot/daily-logger#153. | M | fixed |
| TD-003 | LOW | api-contract | blogengine/packages/api/src/routes/v2/tool-endpoints.ts | GET /api/tools advertises distinct per-tool endpoints (ADR-0007 compliant at discovery layer). However every tool endpoint delegates to a single `chatService.chat()` call — no per-tool routing logic exists. MetaOrchestrator cannot invoke a specific BlogEngine tool directly; all invocations pass through LangGraph internal routing. Impact: low while frame-agent does not call tools directly, but blocks per-tool capability isolation. Fix: implement per-tool handler logic in each route, or expose a tool discriminator the graph can act on. Discovered: 2026-03-17. | M | open |
| TD-002 | MEDIUM | test-coverage | shell/packages/frame-agent/src/meta-orchestrator.ts:269 | `hasCrossDomainSignal()` is private and has zero tests. Hero-demo routing depends on it. Connective tier (`'both'`, `'across'`) has latent false-positive risk. Needs extract + `meta-orchestrator.classify.test.ts`. | S | open |
| TD-001 | HIGH | process | daily-logger/src/generate-article.ts | Article generator synthesizes shipped/extracted claims from commit messages and PR body text without verifying file existence or branch merge status against actual repo state. Discovered 2026-03-11: 3 inaccuracies in article (Header.tsx absent, AppSwitcher story wrongly listed as missing, cross-domain fix on WIP branch). Fix: add post-generation verifier that cross-checks backtick file paths against repo file snapshot; flag WIP branches. See proposal in incident daily-logger-unverified-claims-2026-03-11. | M | open |

---

### [high] process: the bead ledger's closure loop is declared but not implemented
**Location:** `decisions/loops/loops.md:218` (`hook-bead-session`), `scripts/hooks/bead-session.sh`
**Discovered:** 2026-07-25
**Description:** The loops registry declares:

```yaml
- slug: hook-bead-session
  purpose: "Session-close bead emission — writes the session's report bead + events"
  trigger_ref: scripts/hooks/bead-session.sh
  cadence: event
  verifier: "none"
  evidence_ref: "dolt:bead_events"
  status: live
```

That purpose is false. `scripts/hooks/bead-session.sh` is a **PostToolUse** hook — registered in
`.claude/settings.json` under the `Skill` and `Bash` matchers — that records skill invocations and
creates Dolt task/PR beads. It never touches `.handoff/` and has no session-end path. **Nothing
writes the session's report bead.**

`orient.py:119-121` computes open hooks as `type: brief AND status: live` minus the ids named by
some report's `responding_to`. With no reports written, every brief is a permanently open hook.
Measured across all 14 repos with a `.handoff/`: **28 open hooks**, **9 report beads total**, **3
beads ever reaching `status: closed`**, and **21 of 65 beads (32%) non-conformant** (14 with no
frontmatter, 6 off-enum status such as `open`/`delivered`/`NOT STARTED — …`, 4 missing `id`, 1 using
`kind:` for `type:`) and therefore invisible to `orient.py` entirely. `silicon-empires`,
`f1-pit-wall`, and `f1-substrate` have zero parseable beads.

Three guards each have a structural reason they missed it: `loops-lint.mjs` only checks that
`trigger_ref` exists on disk (presence is not purpose conformance, so lint is green);
`loops-liveness.mjs` skips `cadence: event` loops by design ("`event` and `manual` loops have no
cadence to breach"); and the entry declares `verifier: "none"`. Its `evidence_ref: dolt:bead_events`
points at a stream believed empty — unverified, Dolt was not running when this was found.

Aggravating factor: 8 of the 14 repos with a `.handoff/` have no `.claude/skills/bead` installed
(bldgblog-corpus, capture-agent (formerly gcgcca), lofi-beaver, mc-motion, mc-perf, morning-cockpit, silicon-empires,
virtualLight), which explains the schema drift. Install is not sufficient, though — `f1-pit-wall`
and `f1-substrate` have the skill and still produce zero reports. This is the ADR-0068 behavioral
gap (0.8% skill-suggestion-followed rate) surfacing in a new place.

**Discovered by:** a cold pickup of bead `20260723-1629-brief-arcade-l2-p1-rewording-pickup` on
2026-07-25 nearly redid wayfinder #274, which had merged 12 hours earlier as PR #285. Retired by
bead `20260725-1135-report-arcade-l2-p1-rewording-shipped`.

**Proposed fix:** `rm:rm-l2-ojfbot#S32` — correct the registry entry to what the script actually
does; add `scripts/bead-lint.mjs` (dep-free, reusing `parseFM`/`loadRegistry`/`repoRootOf` from
`scripts/lib/northstar-fm.mjs`) plus a CI workflow mirroring `northstar-lint.yml` including its
vantage scoping, **shadow/WARN-only** at first per ADR-0086; and close the event-loop liveness blind
spot. Then `rm:rm-l2-ojfbot#S33` — backfill the 28 hooks with the existing `/resume --verify`, which
already git-grounds report beads for work that shipped without a self-report, and promote schema
errors from WARN to blocking once the fleet is clean.
**Effort:** M

---

### [high] process: daily-logger publishes unverified file-existence and branch-merge claims
**Location:** `daily-logger/src/generate-article.ts`
**Discovered:** 2026-03-11
**Description:** The article generator feeds Claude commit messages and PR body text and asks it to synthesise what shipped. Claude infers claims from intent language ("this PR extracts Header") and turns them into past-tense facts. Three concrete errors in 2026-03-11.md: (1) `Header.tsx` claimed extracted — file absent; (2) `AppSwitcher.stories.tsx` claimed missing — file present; (3) hasCrossDomainSignal fix claimed "landed" — shell still on WIP branch with 2 uncommitted changes. The audit checklist lacked patterns for these failure modes so frame-standup had no mechanism to catch them before building the day plan.
**Proposed fix:** In `collect-context.ts`, collect a `repoSnapshots` map (flat file list per repo under packages/**/src/ + branch/status). Pass it to Claude in `buildUserPrompt()` as a verification context section. Add a `verifyFileExistenceClaims()` post-generation step that cross-checks backtick paths in `whatShipped` against the snapshot — append a correction block if any fail. Frame-standup audit checklist updated with new patterns (TD-001-checklist-patch: APPLIED 2026-03-11).
**Effort:** M
