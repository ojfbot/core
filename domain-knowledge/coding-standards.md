# Coding Standards

> Read by `/validate`, `/sweep`, and `/plan-feature` when checking or writing code in any ojfbot repo.
> These are the explicit rules. If a pattern isn't documented here, derive from existing code before inventing.

---

## TypeScript

### Strictness
- `strict: true` in all tsconfigs. No exceptions.
- No `any`. Use `unknown` and narrow it, or define the type properly.
- No non-null assertions (`!`) without a comment explaining why it can't be null.
- No silent error swallowing — either handle the error or propagate it.

### Null handling
- Prefer early returns over nested conditionals.
- Optional chaining (`?.`) is fine; avoid `&&` chains for property access.
- `undefined` is preferred over `null` for optional values — pick one and be consistent within a module.

### Async
- All async functions must handle or propagate errors. No dangling promise chains.
- Prefer `async/await` over `.then()` chains.
- Use `Promise.all()` for parallel independent operations.

### Types
- Define types at module boundaries. Internal implementation can be less explicit if TypeScript infers correctly.
- `interface` for public API shapes; `type` for aliases, unions, intersections.
- Export types alongside the implementations that use them — don't make callers reach into internals.

---

## Module structure

### General
- One responsibility per module. If a file is doing two unrelated things, split it.
- Barrel exports (`index.ts`) are fine for public API surfaces; avoid them for internal cross-module imports.
- Circular dependencies are always a bug. Fix the structure, don't work around it.

### File naming
- `kebab-case.ts` for all TypeScript files.
- `PascalCase.tsx` for React components.
- Test files: `<name>.test.ts` co-located with the module, or in `__tests__/`.

### Imports
- Use explicit named imports, not namespace imports (`import * as X`).
- Sort imports: node built-ins → external packages → internal packages → relative imports.
- In pnpm workspaces, import from the package name (`@core/workflows`), not a relative path across packages.

---

## Forbidden patterns

These are hard rules. `/validate` blocks on them.

| Pattern | Why forbidden | Alternative |
|---------|--------------|-------------|
| `console.log/warn/error` in production modules | No structured logging, no correlation IDs | Use the project's logger (Winston/Pino); no logging in library code |
| Direct `anthropic` / Anthropic SDK calls in sub-apps | Breaks single-gateway model | Route through frame-agent's `/api/chat` or domain agent |
| `<iframe>` in shell or sub-apps | Breaks shared Redux store, breaks Module Federation model | Use Module Federation remotes |
| `import * as React from 'react'` | Not needed with modern JSX transform | Named imports or no import |
| `process.env.ANTHROPIC_API_KEY` in sub-app source | Key belongs in frame-agent only | Request AI capabilities through the gateway |
| `any` in public API types | Kills type safety for callers | `unknown` with narrowing, or a concrete type |
| Committing `dist/`, `.env`, `env.json` | TruffleHog blocks the PR | Add to `.gitignore`; use `.env.example` |
| Force push to `main` | Destructive to shared history | Open a PR |

---

## React + Carbon

- Import Carbon components individually: `import { Button } from '@carbon/react'` — not barrel imports.
- Do not override Carbon's `theme` prop to implement "dark mode demos" — explicitly deprioritized.
- Component files: one component per file, matching filename.
- Props interfaces: `interface <ComponentName>Props { ... }` — defined in the same file, above the component.
- No inline styles except for dynamic values that can't be expressed in CSS.

---

## LangGraph / agent nodes

- Every node function signature: `(state: <StateType>) => Partial<StateType> | Promise<Partial<StateType>>`.
- Nodes must be pure in terms of side effects — all external calls are in tool functions, not node bodies.
- State schema: all fields optional except `messages`. Never break existing field names in an update.
- Routing edges return a string key that matches an existing node name. No dynamic string construction.
- See `domain-knowledge/langgraph-patterns.md` for complete invariant list.

---

## Skill files (`.claude/commands/<name>/`)

- `<name>.md` is the orchestration skeleton — max 250 lines.
- Heavy reference material goes in `knowledge/` and is loaded explicitly with `> **Load \`knowledge/<file>.md\`**`.
- Scripts in `scripts/` are deterministic Node.js utilities — no LLM calls, no network, pure file I/O.
- YAML frontmatter required at top of `<name>.md`: `name:` and `description:` with trigger phrases.
- Generic commands must not hardcode project names (cv-builder, LangGraph, Carbon) — reference `domain-knowledge/` dynamically.

---

## pnpm workspace

- Run `pnpm install` at repo root — never `npm install` or `yarn`.
- Build a single package: `pnpm --filter @core/workflows build`.
- Add a dependency: `pnpm --filter @core/cli add <package>`.
- Never edit `pnpm-lock.yaml` by hand.
- Node version: v24.11.1 (`.nvmrc`). Run `fnm use` after cloning.

---

## PR standards

- PRs target `main`. Branch naming: `feat/`, `fix/`, `chore/`, `docs/`.
- Every PR description includes: what changed, why, how to test.
- New routes require auth middleware — `/validate` blocks without it.
- Deleted tests require explanation in the PR description.
- No PR merges if visual regression CI fails.

---

## What a good ADR looks like

An ADR is the answer to: "Why is the code this way?"

**Good ADR:**
- Context explains a real constraint or tension (not "we thought it was a good idea").
- Decision is a single, clear sentence.
- Consequences section is honest — lists costs, not just gains.
- At least one rejected alternative, with a real reason for rejection.

**Bad ADR:**
- Context is "we decided to use X for Y" (circular).
- No alternatives considered.
- Consequences are all positive (no trade-off acknowledged).
- Written after the decision was implemented and then forgotten.

Write the ADR when the decision is being made, not retrospectively. The template is at `decisions/adr/template.md`.
