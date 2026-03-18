# Observability Checklist

Audit points for the `/hardening` observability phase. These determine how visible failures are in production.

## Structured logging

- [ ] All services use a structured logger (not `console.log`)
- [ ] Log entries include: timestamp, level, service name, request ID / trace ID
- [ ] Errors include full stack traces and context
- [ ] No PII or secrets in log entries
- [ ] Log level is configurable per environment (DEBUG in dev, INFO/WARN in prod)

## Error tracking

- [ ] Sentry (or equivalent) is configured for all services
- [ ] Error tracking captures: user ID, request context, environment
- [ ] Unhandled promise rejections are captured
- [ ] Error tracking is tested in staging (not just assumed to work)

## Health checks

- [ ] Each service has a `/health` or `/ping` endpoint
- [ ] Health endpoint returns 200 only if the service is truly healthy (DB connected, etc.)
- [ ] Health checks are used by the load balancer or orchestrator

## Metrics

- [ ] Request count, latency (p50/p95/p99), and error rate are tracked
- [ ] LLM API calls are tracked: latency, token usage, error rate
- [ ] Custom business metrics for key user actions (article generated, report created)
- [ ] Metrics dashboard exists and is shared with the team

## Alerts

- [ ] Alert on error rate spike (>1% over 5-min window for critical paths)
- [ ] Alert on latency spike (p95 > threshold)
- [ ] Alert on service unavailability
- [ ] Alert channels are tested (not silent during incidents)

## Distributed tracing (if multi-service)

- [ ] Trace IDs are propagated across service boundaries
- [ ] LangGraph node execution is traced (node name, duration, state size)
- [ ] Database queries are instrumented

## LangGraph-specific

- [ ] Graph execution start/end is logged with thread_id
- [ ] Each node logs: entry, exit, output summary (not full state)
- [ ] Tool call results are logged at DEBUG level
- [ ] Checkpointer operations are logged

## Severity thresholds

| Severity | Criteria |
|----------|----------|
| HIGH | No error tracking, no health checks, production silent on failure |
| MEDIUM | Missing structured logging, missing metrics |
| LOW | Missing trace correlation, partial metric coverage |
