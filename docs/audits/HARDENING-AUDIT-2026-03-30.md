# Architecture Hardening Audit -- 2026-03-30

Consolidated gap analysis for architecture workshop. Audit-only, no code changes.

Repos audited: **shell**, **cv-builder**, **daily-logger**

---

## 1. SHELL (frame.jim.software)

### Security

| # | Finding | Severity | Workshop Priority |
|---|---------|----------|-------------------|
| S1 | **No authentication on frame-agent API.** All `/api/chat`, `/api/tools`, `/api/inspect`, `/api/techdebt` routes are publicly accessible. The only protection is CORS origin check. Anyone who knows the URL can call the LLM gateway directly, burning API credits. | HIGH | Workshop -- needs architectural decision on auth strategy (JWT, API key, or session) |
| S2 | **Helmet uses defaults only.** `app.use(helmet())` applies default CSP but no custom `Content-Security-Policy` directives. Shell loads MF remotes from multiple origins; CSP should explicitly allowlist `cv.jim.software`, `blog.jim.software`, etc. as `script-src`. | MEDIUM | Fix independently |
| S3 | **CORS allows any extension in dev.** When `ALLOWED_EXTENSION_IDS` is unset (default), any Chrome/Firefox extension can call frame-agent. Production must set this env var. | MEDIUM | Fix independently -- document in deploy checklist |
| S4 | **6 dependency vulnerabilities (3 high, 3 moderate).** All via `picomatch` in `sass`/`@parcel/watcher` transitive deps. Build-time only, not runtime. | LOW | Fix independently -- `pnpm update` or overrides |
| S5 | **shell vercel.json has no security headers.** No `X-Frame-Options`, `X-Content-Type-Options`, or `Strict-Transport-Security` headers configured for the Vercel deployment. | MEDIUM | Fix independently |

### Resilience

| # | Finding | Severity | Workshop Priority |
|---|---------|----------|-------------------|
| R1 | **No timeout on frame-agent-client fetch calls.** `frameAgentClient.chat()` and `streamChat()` call `fetch()` with no `AbortController` timeout. If frame-agent hangs, the shell UI hangs indefinitely. | HIGH | Fix independently |
| R2 | **No retry logic on LLM calls.** `meta-orchestrator.ts` has init timeout for tool discovery but no retry/backoff on the main `messages.create()` calls. A transient 429 or 503 from Anthropic fails the user request. | MEDIUM | Workshop -- decide retry budget vs. user-visible latency |
| R3 | **MF remote load failure shows static error.** `AppFrame.tsx` catches import errors and renders a message, plus ErrorBoundary wraps the component. This is good. However, there is no retry mechanism -- user must manually navigate away and back. | LOW | Fix independently -- add "Retry" button |
| R4 | **SSE stream has no reconnect logic.** `streamChat()` reads until `done` but does not handle mid-stream disconnections or attempt reconnection. | MEDIUM | Fix independently |
| R5 | **No request body size validation beyond Express limit.** `express.json({ limit: '10mb' })` is set, but `conversationHistory` arrays can grow unbounded. A user with a very long conversation could send enormous payloads. | MEDIUM | Fix independently -- cap conversation history length |

### Observability

| # | Finding | Severity | Workshop Priority |
|---|---------|----------|-------------------|
| O1 | **No error tracking (Sentry or equivalent).** Neither shell-app nor frame-agent has Sentry configured. Production errors are invisible unless someone checks Vercel logs. | HIGH | Workshop -- choose error tracking service, budget |
| O2 | **All logging is `console.log/error/warn`.** frame-agent has 17 console calls with no structured format. No timestamps, no request IDs, no log levels. | MEDIUM | Fix independently -- adopt pino (cv-builder's agent-graph already uses it) |
| O3 | **Health endpoint exists but is minimal.** `/health` returns `{ status: 'ok', initialized: bool }`. Good baseline. Missing: dependency health (can it reach sub-app APIs?). | LOW | Fix independently |
| O4 | **No LLM call metrics.** No tracking of Anthropic API latency, token usage, or error rates. Cannot tell if classify() or main agent calls are slow or failing. | MEDIUM | Workshop -- decide metrics stack |

---

## 2. CV-BUILDER (cv.jim.software)

### Security

| # | Finding | Severity | Workshop Priority |
|---|---------|----------|-------------------|
| S6 | **Auth middleware is a passthrough.** `packages/api/src/middleware/auth.ts` has `authenticate()` and `authorize()` functions that call `next()` unconditionally with TODO comments. All API routes (resume CRUD, job data, interview prep, chat) are unauthenticated. Since this is externally visible to hiring managers: anyone can read/write/delete resume data. | HIGH | Workshop -- this is the most externally visible app; needs auth before sharing with employers |
| S7 | **browser-automation server uses `cors()` with no origin restriction.** `app.use(cors())` allows any origin. This is a dev/CI service but if accidentally exposed, it grants full browser automation access. | MEDIUM | Fix independently -- restrict to localhost |
| S8 | **42 dependency vulnerabilities (35 high, 7 moderate).** Mostly via `tar` in `lerna` transitive deps, and Storybook env var exposure advisory. The 7 high/critical vulns from commit `ab7ce82` were NOT fully resolved -- 35 high vulns remain. | HIGH | Fix independently -- `pnpm update lerna`, evaluate Storybook advisory |
| S9 | **API key loaded from `env.json` file.** `packages/agent-core/src/utils/config.ts` reads `ANTHROPIC_API_KEY` from a JSON file on disk. File is in `.gitignore`. Risk: file permissions on deploy target. Standard practice is env vars only. | LOW | Fix independently |
| S10 | **CSP configured correctly.** `frame-ancestors` is set to `'self'` + `CORS_ORIGIN`. CORS origin is explicit (not `*`). Helmet is active. This is the most mature security setup of the three repos. | -- (positive) | N/A |

### Resilience

| # | Finding | Severity | Workshop Priority |
|---|---------|----------|-------------------|
| R6 | **ErrorBoundary present in Dashboard.** Wraps the main Dashboard component. Good. | -- (positive) | N/A |
| R7 | **Agent initialization failure is non-fatal.** Both v1 AgentManager and v2 GraphManager catch init errors and log warnings; server stays up. Good pattern. | -- (positive) | N/A |
| R8 | **No timeout on Anthropic calls in agent-graph.** LangGraph nodes call Claude with no explicit timeout. Long-running graph executions could hang. | MEDIUM | Fix independently |
| R9 | **Rate limiting present.** `standardLimiter` on v1 routes, separate limits on v2. Good. | -- (positive) | N/A |

### Observability

| # | Finding | Severity | Workshop Priority |
|---|---------|----------|-------------------|
| O5 | **Structured logging exists (pino) but only in agent-graph.** `packages/agent-graph/src/utils/logger.ts` uses pino with pretty-print dev transport. The main API server (`packages/api/`) still uses `console.log` (35 calls). Two logging patterns in one repo. | MEDIUM | Fix independently -- extend pino to API server |
| O6 | **No Sentry.** Same gap as shell. Only mentioned in a PR educational analysis doc, never implemented. | HIGH | Workshop -- same decision as shell |
| O7 | **Health endpoint exists.** Returns `{ status: 'ok' }`. Minimal but functional. | LOW | Fix independently -- add DB/agent health |
| O8 | **CI is the most mature.** Visual regression, security scan (TruffleHog), dependency audit, Claude Code review. All green. This is the benchmark for the other repos. | -- (positive) | N/A |

---

## 3. DAILY-LOGGER (log.jim.software)

### Security

| # | Finding | Severity | Workshop Priority |
|---|---------|----------|-------------------|
| S11 | **No hardcoded secrets.** All `ANTHROPIC_API_KEY` and `GH_PAT` references are `process.env` reads or `${{ secrets.* }}` in workflows. Clean. | -- (positive) | N/A |
| S12 | **`sk-ant-mock-smoke-test` in `pr-check.yml`.** This is a fake key used for MOCK_LLM mode in CI. Not a real secret, but looks suspicious to automated scanners. | LOW | Fix independently -- use env var or `mock` string |
| S13 | **14 dependency vulnerabilities (6 high, 7 moderate, 1 low).** Via `picomatch` and `undici` in `@vercel/node`. | MEDIUM | Fix independently |
| S14 | **Vercel API routes have no auth.** `vercel.json` rewrites `/api/auth/:path*` and `/api/github/:path*` to serverless functions. If these exist, they are publicly accessible. The static JSON API (`/api/entries.json`, etc.) is intentionally public. | MEDIUM | Investigate -- confirm whether auth/github routes exist and what they expose |
| S15 | **No CSP headers on Vercel deployment.** `vercel.json` only sets `Cache-Control` headers. No security headers. | MEDIUM | Fix independently |

### Resilience

| # | Finding | Severity | Workshop Priority |
|---|---------|----------|-------------------|
| R10 | **Claude API failure is handled with fallback.** `callClaudeForArticle()` catches errors, returns `null`, triggering the validation ladder (v2 -> v1 -> partial salvage -> stub article). This is well-designed. | -- (positive) | N/A |
| R11 | **Council synthesis failure falls back to draft.** `synthesizeWithCouncil()` catches API errors and returns the unmodified draft. Pipeline never crashes from an LLM failure. | -- (positive) | N/A |
| R12 | **Single retry with error feedback on v2 validation failure.** `generate-article.ts:763` retries once with validation errors appended. Only one retry -- not a loop. Good. | -- (positive) | N/A |
| R13 | **`gh` CLI calls have 30s timeout.** `collect-context.ts` sets `timeout: 30_000` on subprocesses. Good. | -- (positive) | N/A |
| R14 | **No timeout on Anthropic `messages.create()` calls.** Neither `callClaudeForArticle()` nor council `reviewDraft()` sets a timeout. The Anthropic SDK has no default timeout. If Claude hangs, the GitHub Actions job runs until the 10-minute workflow timeout. | MEDIUM | Fix independently -- set `timeout` option on Anthropic client |
| R15 | **Workflow has `timeout-minutes: 10`.** Good backstop for hangs. | -- (positive) | N/A |
| R16 | **No idempotency guard.** If the workflow runs twice for the same date (manual re-trigger), it checks if the branch exists and skips. Good. But if the branch was deleted after merge, it would generate a duplicate article. | LOW | Fix independently -- check if `_articles/{date}.md` exists on main |

### Observability

| # | Finding | Severity | Workshop Priority |
|---|---------|----------|-------------------|
| O9 | **No alerting on pipeline failure.** `daily-blog.yml` has no `on: failure` notification step. If the overnight run fails (API down, rate limited, GH_PAT expired), nobody is notified. The failure is only visible in the GitHub Actions tab. Since daily-logger is described as "every day without entry is lost signal," this is a significant gap. | HIGH | Workshop -- decide notification channel (Slack, email, GitHub issue) |
| O10 | **All logging is `console.log/error/warn`.** 124 console calls across 11 source files. No structured format, no timestamps (CI adds them), no correlation IDs. | MEDIUM | Fix independently |
| O11 | **No health endpoint.** daily-logger's React frontend is a static SPA consuming JSON files. No server-side health check. This is expected for a static site. | -- (N/A) | N/A |
| O12 | **Artifact upload on `if: always()`.** Articles are uploaded as GitHub Actions artifacts even on failure. Good for debugging. | -- (positive) | N/A |
| O13 | **No Sentry on React frontend.** `packages/frontend/` has no error tracking. If the SPA crashes for a visitor (hiring manager), there is no signal. | MEDIUM | Fix independently |

---

## Cross-cutting findings

| # | Finding | Severity | Workshop Priority |
|---|---------|----------|-------------------|
| X1 | **No error tracking anywhere.** Zero repos have Sentry or equivalent. Production errors across 3 deployed services are invisible. This is the single highest-priority cross-cutting gap. | HIGH | Workshop -- standardize on one service, deploy to all 3 |
| X2 | **No structured logging standard.** cv-builder's agent-graph has pino; everything else uses `console.*`. Need a logging standard for the cluster. | MEDIUM | Workshop -- adopt pino everywhere, define log format |
| X3 | **No auth on any API.** shell (frame-agent), cv-builder API, and daily-logger API routes are all unauthenticated. For a portfolio project this is low-risk, but cv-builder is shared with hiring managers and frame-agent controls API spend. | HIGH | Workshop -- decide auth strategy per service |
| X4 | **Dependency audit debt.** Combined: 62 vulnerabilities (44 high). Most are transitive (lerna, sass, vercel). Need a dependency update sprint. | MEDIUM | Fix independently -- schedule 2h dependency update session |
| X5 | **No CSP headers on Vercel deployments.** Neither shell nor daily-logger configures security headers in `vercel.json`. cv-builder sets them server-side but not on Vercel static. | MEDIUM | Fix independently -- add headers block to all `vercel.json` files |

---

## Workshop agenda recommendation

Priority order for tomorrow's discussion:

1. **Error tracking (X1)** -- Pick Sentry (free tier covers this scale), define integration pattern, assign to all 3 repos. 30 min.
2. **Auth strategy (X3)** -- frame-agent: API key or short-lived token? cv-builder: JWT before sharing with employers? daily-logger: static site, no API auth needed. 30 min.
3. **Pipeline failure alerting (O9)** -- daily-logger runs unattended overnight; needs failure notification. GitHub Actions + Slack webhook or email. 15 min.
4. **Retry/timeout strategy (R1, R2, R14)** -- Standardize: Anthropic client timeout (120s), fetch timeout (30s), retry budget (1 retry on 429/503). 15 min.
5. **Structured logging (X2)** -- Adopt pino cluster-wide. cv-builder agent-graph already uses it. 10 min.

Items marked "Fix independently" above do not need workshop time -- they can be addressed as regular PRs.

---

## Summary scorecard

| Repo | Security | Resilience | Observability | Overall |
|------|----------|------------|---------------|---------|
| shell | Needs auth (HIGH) | Needs timeouts (HIGH) | No error tracking (HIGH) | Weakest -- most gaps |
| cv-builder | Auth is a passthrough (HIGH), 35 high vulns | Good patterns, minor gaps | Partial pino, no Sentry | Best baseline, auth is the blocker |
| daily-logger | Clean secrets mgmt | Excellent fallback design | No failure alerting (HIGH) | Best resilience, worst observability |
