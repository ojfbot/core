# PR Review Dimensions

## Correctness
- Does the code do what the PR description says?
- Are edge cases handled?
- Are error paths correct (not just happy path)?

## Security (OWASP-informed)
- No `console.log` in production code (`no-console-in-production` rule)
- No source maps enabled (`no-source-maps-in-production` rule)
- No API keys in client bundles (`no-api-keys-in-client` rule)
- No cross-package relative imports (`no-cross-package-relative-imports` rule)
- Zod validation at API boundaries (`require-zod-validation-at-boundaries` rule)
- No user input in shell commands (injection risk)

## Performance
- No unnecessary re-renders in React components
- No N+1 queries in API routes
- Appropriate use of `useMemo`/`useCallback` (don't over-optimize)
- Bundle size impact for browser-app changes

## Maintainability
- Clear naming (intent-revealing, not implementation-describing)
- No premature abstractions (3 similar lines > unnecessary helper)
- No dead code or commented-out blocks
- Types are precise (not `any` or overly broad unions)

## Test Coverage
- New exports have corresponding tests (`require-test-for-new-exports` rule)
- Schema changes have validation tests
- Bug fixes have regression tests

## Documentation
- CLAUDE.md updated if architecture changed
- ADR created for significant decisions
- API routes documented (request/response shapes)

## Red Flags (auto-fail)

| Finding | Why |
|---------|-----|
| `sourceMap: true` in production config | Source map leak risk (Claude Code v2.1.88 incident) |
| API key in client code | Credential exposure |
| `../../../packages/` imports | Cross-package boundary violation |
| `dangerouslyAllowBrowser` | Browser-side API key exposure |
| `any` type at API boundary | Runtime type safety bypassed |
