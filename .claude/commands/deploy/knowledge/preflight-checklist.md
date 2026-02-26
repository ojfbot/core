# Pre-flight Checklist

Must be completed before any deployment. Items marked [BLOCK] will halt the deployment if not resolved.

## Code quality gates

- [ ] [BLOCK] `pnpm build` passes with no TypeScript errors
- [ ] [BLOCK] `pnpm test` passes — all tests green
- [ ] [BLOCK] No open critical/high severity issues from `/validate`
- [ ] [BLOCK] No open critical/high severity items from `/hardening` (if run this cycle)
- [ ] PR is merged or change is committed to the deploy branch
- [ ] Linting passes (`pnpm lint`)

## Environment

- [ ] [BLOCK] All required environment variables are set in the target environment
- [ ] [BLOCK] `ANTHROPIC_API_KEY` is set (if LLM calls are in the deploy)
- [ ] Database migrations are ready (if schema changed)
- [ ] Feature flags are configured (if using feature flags)
- [ ] Third-party services (APIs, webhooks) are configured in the target environment

## Database / state

- [ ] [BLOCK] Migration is reversible — a down migration exists
- [ ] Data migrations tested on a copy of production data (if data shape is changing)
- [ ] No breaking schema changes that require zero-downtime strategy (column rename, drop)

## Observability

- [ ] Error tracking is configured (Sentry DSN, etc.) for the target environment
- [ ] Logs are flowing to the expected destination
- [ ] Key metrics/alerts are set up for the new feature

## Rollback plan

- [ ] Rollback procedure is documented (see `knowledge/rollback-guide.md`)
- [ ] Previous version is still deployable (no irreversible migration)
- [ ] Team knows the rollback trigger threshold (error rate, latency spike)

## Communication

- [ ] Change is communicated to relevant stakeholders (if user-visible)
- [ ] Deployment time is confirmed (avoid deploying during peak traffic)
- [ ] On-call engineer is aware (if deploying outside business hours)

## Post-deploy verification

- [ ] Smoke test list is prepared (which flows to manually verify)
- [ ] Metrics dashboard is open and ready to monitor
- [ ] Rollback can be initiated within 5 minutes if needed

---

Mark each item:
- `[x]` — done
- `[~]` — N/A for this deployment
- `[!]` — [BLOCK] — deployment must not proceed
