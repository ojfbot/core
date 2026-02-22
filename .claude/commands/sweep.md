You are doing a maintenance pass — batching the small mechanical improvements that accumulate into real drag if ignored.

**Tier:** 1/2 — Single-step transformation
**Phase:** Maintenance (daily/weekly routine)

## Scope

Scan the specified path (or entire repo if none given):

### Code hygiene
- Stale `TODO` and `FIXME` comments — address, convert to tracked issues, or delete with a note.
- Unused imports, variables, and exported symbols.
- Commented-out code blocks with no explanation.
- **`console.log`, `console.error`, `console.warn`** in any file under `packages/` — these must be replaced with `getLogger('module-name')` from `utils/logger.ts`. This is a known systemic issue (see issue #51). List every occurrence with the suggested replacement.

### Config duplication
- Repeated magic strings or numbers that should be constants.
- Duplicated config values across `env.json`, GitHub Actions workflows, and Docker files.
- Package version mismatches across workspaces (pnpm workspace catalog).

### Structural noise
- Empty or near-empty files that are just stubs with no `TODO`.
- Test files with only `it.todo()` entries never filled in (flag, don't delete).
- Stale barrel `index.ts` re-exports.

### Agent / LangGraph specific
- LangGraph node files that import directly from `@langchain/*` without going through the shared wrapper layer — flag for consistency review.
- Hardcoded model names (e.g. `claude-3-5-sonnet`) that should reference a config constant.
- Inline system prompts longer than ~10 lines that should live in a dedicated prompt file.

## Output format

Group findings by category. For each:
```
[FILE:LINE] Category — Issue
  → Suggested action (safe to apply automatically | needs judgment)
```

Then a **summary**: what to apply automatically vs. what needs a decision.

If `--apply` is passed: fix everything marked "safe to apply automatically." Log each change. Do not touch anything marked "needs judgment."

## Constraints
- Do not change business logic. `/investigate` for that.
- Do not rename public APIs or exported types without checking all call sites.
- If a `TODO` references a real GitHub issue number, leave it and note it.

---

$ARGUMENTS
