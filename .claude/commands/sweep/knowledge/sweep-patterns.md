# Sweep Patterns

Categories of issues `/sweep` finds and (optionally) fixes. Each has a severity and default action.

## Category 1: Stale TODO/FIXME

**Severity:** LOW (escalate to MEDIUM if >90 days old or blocks a shipped feature)

**Pattern:**
```typescript
// TODO: handle error case
// FIXME: this is wrong when X happens
// HACK: workaround for <issue>
// NOTE: remove this after <date>
```

**Detection:** grep for `TODO|FIXME|HACK|XXX` in non-test source files

**Report format:**
```
[STALE TODO] src/utils/parser.ts:42
  "TODO: handle empty input" — added 2024-03, still present
  Action: resolve or convert to GitHub issue
```

**--apply behavior:** Do not auto-fix. List only.

---

## Category 2: Commented-out code

**Severity:** LOW (escalate to MEDIUM if >2 weeks old)

**Pattern:**
```typescript
// const oldFn = () => { ... }
// import { something } from './old-module'
```

**Detection:** Blocks of 2+ consecutive comment lines that look like code (contain `=`, `(`, `)`, `{`, `}`, `import`, `const`, `function`, `return`)

**--apply behavior:** Delete confirmed commented-out code blocks (not single-line comments explaining logic).

---

## Category 3: Console.* in production packages

**Severity:** MEDIUM (HIGH if in hot paths or loops)

**Pattern:**
```typescript
console.log('debug:', value)
console.error('something failed')
console.debug(state)
```

**Exceptions:**
- `console.error` in CLI tools where it's intentional output
- Test files (`*.test.*`, `*.spec.*`)
- Scripts in `scripts/` directories
- Node.js CLI entry points

**--apply behavior:** Convert to `logger.debug/info/error()` if a logger is available in scope. Otherwise flag for manual review.

---

## Category 4: Unused imports

**Severity:** LOW

**Detection:** TypeScript/ESLint reports unused imports. Check `tsconfig.json` for `noUnusedLocals`.

**--apply behavior:** Remove confirmed unused imports (where TS reports them as unused). Do not remove imports that look unused but may be used for side effects (e.g., CSS imports, `reflect-metadata`).

---

## Category 5: Config duplication

**Severity:** MEDIUM

**Patterns:**
- Same port number defined in multiple files
- Same URL/endpoint defined in multiple places
- Same timeout value scattered across files
- Repeated magic strings that should be constants

**Detection:** Find string literals that appear 3+ times across source files and are not simple values like `""`, `"true"`, `"false"`.

**--apply behavior:** Do not auto-fix. List duplicates with file:line references and suggest extraction to a shared constants file.

---

## Category 6: Dead exports

**Severity:** LOW

**Pattern:** Exported functions/types that are never imported anywhere in the project.

**Detection:** grep for `export const|export function|export type|export interface` then verify each exported symbol is imported somewhere.

**Note:** Public package APIs may be intentionally exported for external consumers. Check `package.json` `"exports"` field before flagging.

**--apply behavior:** Flag for review. Do not remove automatically.

---

## Category 7: Structural noise

**Severity:** LOW

**Patterns:**
- Empty files (0 bytes or only whitespace)
- `*.js` files that have a corresponding `*.ts` file (likely generated, should be in `.gitignore`)
- `dist/` or `build/` files checked in accidentally
- `.DS_Store` files in git

**--apply behavior:** List only. Do not delete files.

---

## Sweep report format

```
## Sweep Report — [repo/path]

### Summary
Total findings: N  |  Apply-safe: N  |  Review-required: N

### Findings

[MEDIUM] console.* in production package
  packages/workflows/src/runner.ts:47 — console.log('debug:', args)
  packages/workflows/src/llm.ts:23 — console.error('llm error')
  Action: Replace with structured logger

[LOW] Stale TODOs
  src/types.ts:12 — TODO: add validation (2024-11)
  Action: Resolve or file as GitHub issue

### Applied changes (--apply mode only)
- Removed 3 commented-out code blocks
- Removed 2 unused imports
```
