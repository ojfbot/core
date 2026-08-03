# Modes, output format, and composition

Reference for `/tdd` invocation modes, the report format, and how the skill composes with its siblings.

## Modes

- **Default** — full red-green-refactor loop, one test at a time.
- `--watch` — run vitest in watch mode (`pnpm test:watch <pattern>`) and react to red/green transitions automatically.
- `--scope=<file>` — limit changes to a single file. Reject any code change outside it.
- `--no-refactor` — skip step 7. Use when the user explicitly wants minimal-change discipline only.

## Output format

```
## Behavior under test
<one sentence>

## Test (red)
<file path: line numbers>
<code block>

Run: <command>
Result: FAIL — <expected failure message>

## Implementation (green)
<file path: line numbers>
<diff or code block>

Run: <command>
Result: PASS

## Full suite check
Run: <command>
Result: <N passed / M failed / K skipped>

## Refactor candidates
1. <move> — <why>
2. <move> — <why>

(awaiting approval; reply "skip" to commit as-is)

## Escalation
<none | suggest /deepen on <path> because <trigger>>
```

## Composition

- Precedes nothing — `/tdd` is the implementation step itself.
- Composes with `/scaffold` (which wires types and stubs without business logic) and `/test-expand` (which plans coverage without enforcing the loop).
- Postflight escalation routes to `/deepen` when shallow-design smells appear.
- Anti-pattern: invoking `/tdd` repeatedly to drive a multi-feature change. TDD is per-behavior. Multi-feature work should pass through `/plan-feature` first.

## See Also

- `seams-and-anti-patterns.md` — seams, mock-at-boundaries rules, anti-pattern catalog
- `../../test-expand/knowledge/test-patterns.md` — project test patterns (Vitest, Zod, async, mocks)
- `../../test-expand/SKILL.md` — coverage planning (lighter than `/tdd`; no enforcement loop)
- `../../scaffold/SKILL.md` — when the test demands new structure
- `../../deepen/SKILL.md` — when 3+ tests in a row are awkward
- `domain-knowledge/coding-standards.md` — TypeScript rules (strict null, async/await, type exports)
