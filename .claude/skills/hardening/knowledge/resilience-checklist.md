# Resilience Checklist

Audit points for the `/hardening` resilience phase. Failures in this category cause outages, not security breaches.

## Timeouts

- [ ] External HTTP calls have explicit timeouts (not default/infinite)
- [ ] Database queries have timeouts or query time limits
- [ ] LLM API calls have timeouts (Anthropic recommends 600s max, but streaming should close sooner)
- [ ] File I/O on mounted volumes has retry/timeout logic

## Retries and backoff

- [ ] Transient errors (429, 503, network timeouts) are retried with exponential backoff
- [ ] Retry limit is set (not infinite retry loop)
- [ ] Idempotent operations use idempotency keys if the API supports them
- [ ] Non-idempotent operations (charge, send email) are NOT retried without deduplication

## Circuit breakers

- [ ] Repeated failures to a downstream service eventually stop retrying (circuit open)
- [ ] Fallback behavior is defined for circuit-open state
- [ ] Circuit state is not hidden from observability

## Error boundaries

- [ ] React component trees have error boundaries at appropriate granularity
- [ ] One failing component does not crash the entire page
- [ ] Error state renders a useful message (not a blank page)
- [ ] SSE/WebSocket reconnect logic exists if connection drops

## Resource limits

- [ ] Memory usage is bounded (no unbounded caches, lists that grow forever)
- [ ] Concurrent request limits exist for resource-intensive operations
- [ ] File uploads have size limits
- [ ] LLM prompt length is capped before sending

## Graceful degradation

- [ ] If the LLM API is unavailable: clear error to user, not silent failure
- [ ] If the database is unavailable: clear error, not crash
- [ ] Features that depend on external services degrade gracefully (show cached data or error)

## Queue / async

- [ ] Background jobs have dead-letter handling (failures don't disappear silently)
- [ ] Job queues have max retry limits
- [ ] Failed jobs are visible in monitoring or logs

## Severity thresholds

| Severity | Criteria |
|----------|----------|
| HIGH | Single point of failure with no fallback |
| MEDIUM | Missing timeout/retry on external call |
| LOW | Improvement to graceful degradation |
