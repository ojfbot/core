# LangGraph / Multi-Agent Failure Patterns

## Common Failures

### 1. Agent Timeout
**Symptom**: Agent hangs, no response within expected window.
**Causes**: Model rate limiting, infinite tool-call loops, oversized context.
**Detection**: Monitor `duration_ms` in telemetry. Alert if > 2x median.
**Recovery**: Circuit breaker with fallback model. Kill after max iterations.

### 2. Context Overflow
**Symptom**: Truncated responses, lost instructions, hallucinated context.
**Causes**: Conversation history too long, large tool results not trimmed.
**Detection**: Track `input_tokens` per call. Alert if approaching model limit.
**Recovery**: Summarize conversation history. Trim tool results to relevant excerpts.

### 3. Tool Call Loops
**Symptom**: Agent repeatedly calls same tool with same/similar arguments.
**Causes**: Ambiguous tool descriptions, model confusion, missing stop conditions.
**Detection**: Count consecutive identical tool calls. Alert if > 3.
**Recovery**: Add explicit stop conditions. Improve tool descriptions. Max iteration cap.

### 4. Malformed Tool Responses
**Symptom**: Agent receives tool result it can't parse.
**Causes**: Schema mismatch, unexpected error format, null/undefined fields.
**Detection**: Zod validation on tool outputs (not just inputs).
**Recovery**: Return structured error with suggested retry action.

### 5. Rate Limiting
**Symptom**: 429 responses from Anthropic API.
**Causes**: Too many parallel agents, burst requests.
**Detection**: Monitor HTTP status codes in API client.
**Recovery**: Exponential backoff. Model failover chain. Request queuing.

## Telemetry Signals

| Signal | What it tells you | Threshold |
|--------|------------------|-----------|
| `input_tokens` | Context size creep | > 80% of model limit |
| `tool_call_count` | Loop risk | > 10 per turn |
| `duration_ms` | Performance degradation | > 30s per agent call |
| `error_rate` | Systemic issues | > 5% of calls |
| `cache_read_ratio` | Prompt caching effectiveness | < 50% = review prompts |
