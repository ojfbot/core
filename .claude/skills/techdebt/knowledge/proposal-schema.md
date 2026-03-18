# TechDebt Proposal Schema

The `TechDebtProposal` format used by `/techdebt --mode=propose` and `--mode=apply`.

## JSON schema

```json
{
  "incident": {
    "id": "string (kebab-case, unique)",
    "severity": "low | medium | high | critical",
    "category": "see debt-categories.md",
    "title": "string (concise, ≤80 chars)",
    "description": "string (what is wrong and why it matters)",
    "location": "file:line or file range",
    "discovered": "ISO date string",
    "context": "string (how it was discovered, what triggered this)"
  },
  "proposal": {
    "type": "refactor | fix | document | delete | add",
    "summary": "string (what the patch does)",
    "patch": "string (unified diff format)",
    "files_affected": ["path/to/file.ts"],
    "test_plan": "string (how to verify the fix)",
    "risk": "low | medium | high",
    "effort": "S | M | L | XL"
  }
}
```

## Field notes

### `incident.severity`

- `critical` — blocks production use or causes data loss
- `high` — materially degrades correctness, security, or reliability
- `medium` — affects developer productivity or code quality at scale
- `low` — cleanup, style, minor duplication

### `incident.category`

See `knowledge/debt-categories.md` for the full taxonomy. Common values:
`type-safety`, `error-handling`, `test-coverage`, `documentation`, `dead-code`, `duplication`, `security`

### `proposal.patch`

Must be a valid unified diff. Format:
```
--- a/packages/workflows/src/runner.ts
+++ b/packages/workflows/src/runner.ts
@@ -10,7 +10,7 @@
 context line
-old line
+new line
 context line
```

The patch is applied by `applyUnifiedDiff()` from `src/utils/diff.ts`.

### `proposal.risk`

- `low` — cosmetic change, no behavioral change
- `medium` — behavioral change with test coverage to verify
- `high` — behavioral change with limited test coverage — requires human review

## TECHDEBT.md entry format

When writing to `TECHDEBT.md` (scan mode), use this format:

```markdown
### [severity] [category]: [title]
**Location:** `file:line`
**Discovered:** YYYY-MM-DD
**Description:** [what is wrong and why it matters]
**Proposed fix:** [one-sentence description of the fix, or "see proposal"]
**Effort:** S/M/L/XL
```

## apply mode constraints

The `apply` mode will only write to paths matching the allowlist in `knowledge/allowed-paths.md`.

For any proposal that touches paths outside the allowlist, `apply` mode halts and outputs:
```
BLOCKED: path outside apply allowlist
File: [path]
Action: Apply manually or update the allowlist
```
