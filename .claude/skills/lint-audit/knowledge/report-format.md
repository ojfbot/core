# Lint Audit report format

The output template for Step 4, including the pinned @frame/eslint-plugin rules reference table.

```markdown
## Lint Audit Report

**Project:** [repo name]
**Date:** [ISO timestamp]
**Rules:** @frame/eslint-plugin v2.0.0 (8 rules)

### Summary
| Severity | Count |
|----------|-------|
| Error    | N     |
| Warning  | N     |
| Clean    | N files |

### Findings by Rule

| Rule | Severity | Count | Files | TECHDEBT |
|------|----------|-------|-------|----------|
| @frame/no-console-in-production | warn | 3 | api/routes.ts, ... | — |
| @frame/no-untyped-schema-fields | warn | 2 | models/bio.ts | TD-002, TD-003 |

### Artifact Scanner
- Status: CLEAN | N violations
- [details if violations found]

### Recommendations
- [ACTION] N findings map to open TECHDEBT items — prioritize TD-XXX
- [FIX] N warnings can be auto-fixed with `pnpm lint:fix`
- [INFO] Overall quality score: X/10

### @frame/eslint-plugin Rules Reference
| Rule | What it catches | Why |
|------|-----------------|-----|
| no-source-maps-in-production | sourceMap:true in build configs | Claude Code source map leak prevention |
| no-api-keys-in-client | API keys in browser code | Security boundary enforcement |
| enforce-singleton-versions | Hardcoded MF shared versions | Module Federation runtime safety |
| no-cross-package-relative-imports | ../../packages/foo imports | Monorepo package boundary integrity |
| require-zod-validation-at-boundaries | req.body without Zod parse | API input validation |
| no-console-in-production | console.log in source files | Debug artifact cleanup |
| no-untyped-schema-fields | z.array(z.string()) on enrichable fields | Schema richness for agent analysis |
| require-test-for-new-exports | Exports without test files | Test coverage alongside implementation |
```
