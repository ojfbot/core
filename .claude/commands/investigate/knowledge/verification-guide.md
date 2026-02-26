# Verification Guide

After building the cause map, verify each link before reporting. A confident-sounding wrong cause map is worse than an honest uncertain one.

## Verification methods by evidence type

### Code analysis
- Read the specific function/file at the exact line implicated
- Check: does the code actually do what the cause map claims?
- Check: is there a conditional, guard, or fallback that changes the behavior?
- Check: what are the TypeScript types — could a type mismatch be the real cause?

### Runtime state
- If you have access to logs: find log entries from the time of the failure
- If you have stack traces: follow the call stack top-to-bottom, not just the error line
- If you have test failures: run the specific test in isolation to confirm it reproduces

### Git history
- `git log --follow -p <file>` to see full history of a file
- `git log --all --oneline --grep="<keyword>"` to find relevant commits
- `git diff <commit>^..<commit> -- <file>` to see exactly what changed in a commit

### Schema / data
- Check migration files for schema changes
- Check type definitions for interface changes
- Check API response shape vs component expectations

## Confidence levels

Label each link in your cause map:

- **CONFIRMED** — verified by direct code read or log evidence
- **HIGH** — logically follows from confirmed evidence, no plausible alternative
- **MEDIUM** — plausible but not directly confirmed, one other explanation exists
- **LOW** — speculative, based on symptom pattern matching only

A cause map with all CONFIRMED links can be acted on immediately.
A cause map with LOW links needs more investigation before proposing fixes.

## When to stop investigating

Stop when:
1. You have a complete cause map with at least HIGH confidence on all links, AND
2. You have at least one CONFIRMED root cause, AND
3. You can explain the symptom from the root cause without gaps

Do not stop when:
- You have a plausible theory but haven't read the actual code
- The last link in the chain is "something in the framework" without specifics
- You found a fix that "seems like it would work" but can't trace why the bug exists

## Reporting uncertain findings

If you cannot complete the cause map:

```
### Incomplete investigation

Root cause could not be fully confirmed. Evidence suggests [MEDIUM confidence hypothesis].

To confirm: [specific file/test/log to check next]
Blocking question: [what specific information is missing]
```

Never report a LOW-confidence hypothesis as a finding without labeling it explicitly.
