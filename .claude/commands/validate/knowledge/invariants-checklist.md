# Universal Invariants Checklist

These invariants apply to every PR in every project, regardless of stack. Each must be verified or explicitly marked N/A before a PASS verdict.

## TypeScript safety

- [ ] No `any` types added without a `// eslint-disable` comment explaining why
- [ ] No `as SomeType` casts without evidence the cast is safe
- [ ] No `!` non-null assertions on values that can be null at runtime
- [ ] Function return types declared (not inferred) on exported functions
- [ ] All `interface` changes have been propagated to all callsites

## Error handling

- [ ] Async operations are inside try/catch or have `.catch()` handlers
- [ ] Error boundaries exist for React component trees that can throw
- [ ] External API calls handle non-2xx responses (not just network errors)
- [ ] Fallback values are sane (not `null` where `[]` is correct, not `""` where `null` is correct)

## Test coverage

- [ ] New functions have unit tests or are explicitly covered by integration tests
- [ ] Happy path tested
- [ ] Primary failure path tested (not just `expect(fn()).toBeDefined()`)
- [ ] No `it.skip` or `test.todo` added for new functionality

## Logging

- [ ] No `console.log` / `console.debug` in non-test code (use structured logger)
- [ ] Errors are logged with context (not just re-thrown silently)
- [ ] No PII or secret values in log statements (user emails, tokens, etc.)

## Security

- [ ] No secret values hardcoded — all from environment variables
- [ ] User input is not directly interpolated into SQL, shell commands, or LLM prompts
- [ ] No new `eval()` or `new Function()` calls
- [ ] External URLs are validated before being fetched

## Dependencies

- [ ] No new `npm install` of packages with known CVEs (`pnpm audit`)
- [ ] No packages added that duplicate existing functionality in the project
- [ ] `package.json` changes match `pnpm-lock.yaml` changes

## Build integrity

- [ ] `pnpm build` passes with no new TypeScript errors
- [ ] `pnpm test` passes with no new failures
- [ ] No new warnings introduced (lint, tsc, vitest)

## Notes

Mark each item as:
- `[x]` — verified, passes
- `[~]` — N/A for this change
- `[!]` — FAIL — describe the violation
