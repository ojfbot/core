Review the provided code for quality, correctness, and maintainability.

## Checklist

1. **Type safety** — No `any`, no loose `Record<string, string>` where a narrower type exists, no type assertions without justification
2. **Error handling** — Errors are caught at the right level, not silently swallowed, and include enough context to debug
3. **Naming** — Variables, functions, and types are named clearly; no abbreviations that require domain knowledge to decode
4. **Side effects** — Functions that modify state are obvious about it; pure functions stay pure
5. **Test coverage** — Changed code has corresponding tests; edge cases are covered
6. **Security** — No injection vectors (SQL, XSS, command), no secrets in code, no unsafe `eval` or `dangerouslySetInnerHTML`
7. **Performance** — No unnecessary re-renders, no O(n^2) where O(n) is possible, no unbounded data structures
8. **Dependencies** — New dependencies are justified; no duplicates of existing functionality

## Output format

For each issue found, report:
- **File:line** — location
- **Severity** — BLOCKING / WARNING / NIT
- **Issue** — what's wrong
- **Fix** — how to fix it

End with a verdict: **APPROVE**, **REQUEST CHANGES**, or **NEEDS DISCUSSION**.
