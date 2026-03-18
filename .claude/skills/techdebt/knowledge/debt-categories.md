# Tech Debt Categories

Used in `TechDebtIncident.category`. Each category maps to a detection strategy and remediation pattern.

## Core categories

### `type-safety`
TypeScript types are overly permissive, bypassed with casts, or missing entirely.

Detection signals:
- `any` without explanation
- `as SomeType` where the cast is not proven safe
- `!` non-null assertions on nullable values
- Missing return types on exported functions
- `interface` that accepts `unknown` where a concrete type is needed

Typical fix: Narrow the type, add a type guard, or add explicit return type annotation.

---

### `error-handling`
Errors are swallowed, not logged, or produce incorrect behavior when caught.

Detection signals:
- Empty `catch` blocks
- `catch (e) { return null }` without logging
- Promises without `.catch()` handlers
- `async` functions without try/catch in call sites that can throw
- `console.error` (should use structured logger)

---

### `test-coverage`
Code paths exist that are not exercised by any test.

Detection signals:
- Functions with no test file counterpart
- Branches (if/else, switch cases) not covered
- Error paths never tested
- `it.skip` or `test.todo` for existing features

---

### `documentation`
Code intent is not captured, making future changes risky.

Detection signals:
- Public API (exported functions, types) without JSDoc
- Complex algorithms without inline explanation
- `domain-knowledge/` files that reference code that no longer exists
- `CLAUDE.md` that references outdated file paths or commands

---

### `dead-code`
Code that is never called, exported but never imported, or conditionally disabled but not removed.

Detection signals:
- Exported symbols with zero imports
- Functions that always return early
- Feature flags that are always `false`
- `// TODO: remove this` comments older than 30 days

---

### `duplication`
The same logic exists in multiple places without abstraction.

Detection signals:
- Same validation logic in 3+ places
- Same error handling pattern copy-pasted
- Same constant defined in multiple files
- Same utility function re-implemented

---

### `security`
A security-relevant code pattern that creates exposure.

Detection signals:
- User input interpolated into queries, prompts, or commands
- Missing auth middleware on a route
- Missing ownership check (IDOR)
- Secret values not from environment variables

---

### `performance`
Code that has measurable performance impact that is not yet acute but will be.

Detection signals:
- N+1 query patterns (query inside a loop)
- Synchronous file I/O in hot paths
- Re-computing derived values on every render/request
- Unbounded arrays or caches

---

### `configuration`
Config is hardcoded, scattered, or inconsistent across environments.

Detection signals:
- Hardcoded URLs, ports, or timeouts in source files
- Same configuration in multiple files
- Development config leaking into production code paths
- Missing `.env.example` for required environment variables

---

### `dependency`
A dependency is outdated, insecure, over-broad, or duplicated.

Detection signals:
- `pnpm audit` high/critical findings
- Duplicate dependencies (same package at two versions)
- Package added for a one-off use (could be a 3-line utility instead)

## Severity × Category matrix

| Category | Common severity |
|----------|----------------|
| security | high/critical |
| type-safety | medium/high |
| error-handling | medium/high |
| test-coverage | medium |
| documentation | low/medium |
| dead-code | low |
| duplication | low/medium |
| performance | low (until it's acute) |
| configuration | medium |
| dependency | low (unless CVE → high) |
