# Technical Debt

Last updated: 2026-04-13

| ID | Severity | Kind | Location | Description | Effort | Status |
|----|----------|------|----------|-------------|--------|--------|
| TD-004 | HIGH | process | daily-logger/src/generate-article.ts | Action closure pipeline uses 50-char description substring as matching key. Claude paraphrases descriptions in closedActions output, breaking the match silently — actions stay open indefinitely. Fix: deterministic action IDs (act-{date}-{command}-{hash}), prompt hardening, orphan detection. PR: ojfbot/daily-logger#153. | M | fixed |
| TD-003 | LOW | api-contract | blogengine/packages/api/src/routes/v2/tool-endpoints.ts | GET /api/tools advertises distinct per-tool endpoints (ADR-0007 compliant at discovery layer). However every tool endpoint delegates to a single `chatService.chat()` call — no per-tool routing logic exists. MetaOrchestrator cannot invoke a specific BlogEngine tool directly; all invocations pass through LangGraph internal routing. Impact: low while frame-agent does not call tools directly, but blocks per-tool capability isolation. Fix: implement per-tool handler logic in each route, or expose a tool discriminator the graph can act on. Discovered: 2026-03-17. | M | open |
| TD-002 | MEDIUM | test-coverage | shell/packages/frame-agent/src/meta-orchestrator.ts:269 | `hasCrossDomainSignal()` is private and has zero tests. Hero-demo routing depends on it. Connective tier (`'both'`, `'across'`) has latent false-positive risk. Needs extract + `meta-orchestrator.classify.test.ts`. | S | open |
| TD-001 | HIGH | process | daily-logger/src/generate-article.ts | Article generator synthesizes shipped/extracted claims from commit messages and PR body text without verifying file existence or branch merge status against actual repo state. Discovered 2026-03-11: 3 inaccuracies in article (Header.tsx absent, AppSwitcher story wrongly listed as missing, cross-domain fix on WIP branch). Fix: add post-generation verifier that cross-checks backtick file paths against repo file snapshot; flag WIP branches. See proposal in incident daily-logger-unverified-claims-2026-03-11. | M | open |

---

### [high] process: daily-logger publishes unverified file-existence and branch-merge claims
**Location:** `daily-logger/src/generate-article.ts`
**Discovered:** 2026-03-11
**Description:** The article generator feeds Claude commit messages and PR body text and asks it to synthesise what shipped. Claude infers claims from intent language ("this PR extracts Header") and turns them into past-tense facts. Three concrete errors in 2026-03-11.md: (1) `Header.tsx` claimed extracted — file absent; (2) `AppSwitcher.stories.tsx` claimed missing — file present; (3) hasCrossDomainSignal fix claimed "landed" — shell still on WIP branch with 2 uncommitted changes. The audit checklist lacked patterns for these failure modes so frame-standup had no mechanism to catch them before building the day plan.
**Proposed fix:** In `collect-context.ts`, collect a `repoSnapshots` map (flat file list per repo under packages/**/src/ + branch/status). Pass it to Claude in `buildUserPrompt()` as a verification context section. Add a `verifyFileExistenceClaims()` post-generation step that cross-checks backtick paths in `whatShipped` against the snapshot — append a correction block if any fail. Frame-standup audit checklist updated with new patterns (TD-001-checklist-patch: APPLIED 2026-03-11).
**Effort:** M
