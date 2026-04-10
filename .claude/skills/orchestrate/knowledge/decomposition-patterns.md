# Decomposition Patterns

Reference for `/orchestrate` Layer 1. Common task decomposition archetypes
that help the orchestrator break priorities into discrete, parallelizable tasks.

---

## Pattern: Add API Endpoint

**Trigger:** Priority mentions "endpoint", "route", "API", "GET/POST/PUT/DELETE"

**Tasks:**
1. Create route handler file (`src/routes/<resource>.ts`)
2. Create request/response types (`src/types/<resource>.ts`)
3. Register route in router/app (`src/app.ts` or `src/routes/index.ts`)
4. Create tests (`src/__tests__/<resource>.test.ts`)
5. Update OpenAPI spec if one exists

**Dependencies:** 2 → 1 → 3 (types first, then handler, then registration)
**Parallel:** 4 can run alongside 1 if test structure is known, 5 is independent

---

## Pattern: New UI Component

**Trigger:** Priority mentions "component", "panel", "view", "dashboard", "tab"

**Tasks:**
1. Create component file (`src/components/<Name>.tsx`)
2. Create component tests (`src/__tests__/<Name>.test.tsx`)
3. Create Storybook story (`src/stories/<Name>.stories.tsx`) — if repo uses Storybook
4. Add to barrel export (`src/components/index.ts`)
5. Wire into parent/consumer component

**Dependencies:** 1 → 4 → 5 (component exists before export, export before consumption)
**Parallel:** 2, 3 can run alongside 1

---

## Pattern: Fix Module Federation

**Trigger:** Priority mentions "MF", "remote", "federation", "shared", "remoteEntry"

**Tasks:**
1. Audit `vite.config.ts` — check federation plugin config (exposes, shared)
2. Verify shared singleton versions match host (`shell/packages/shell-app/vite.config.ts`)
3. Check `remoteEntry.js` build output (target: esnext, no minify)
4. Test: start both host and remote, verify remote loads in shell

**Dependencies:** 1 → 2 → 3 → 4 (sequential diagnostic chain)
**Parallel:** None — this is inherently sequential debugging

---

## Pattern: Component Decomposition / Refactor

**Trigger:** Priority mentions "decompose", "extract", "refactor", "split", "too large"

**Tasks:**
1. Identify extraction boundaries (read source, find logical sections)
2. Create sub-component files (one per extraction)
3. Update parent component to import and use sub-components
4. Move/update tests for extracted logic
5. Update barrel exports if sub-components are public

**Dependencies:** 1 → 2 → 3 (identify before extract, extract before rewire)
**Parallel:** Sub-component files (task 2) can be created in parallel

---

## Pattern: Database/State Migration

**Trigger:** Priority mentions "migration", "schema", "state shape", "store"

**Tasks:**
1. Create migration file or state update
2. Update TypeScript types to match new schema
3. Update data access layer / selectors
4. Add seed data or migration tests
5. Update consuming components if shape changed

**Dependencies:** 1 → 2 → 3 → 5 (schema first, types, then access layer)
**Parallel:** 4 can run alongside 3

---

## Pattern: CI/CD Enhancement

**Trigger:** Priority mentions "CI", "workflow", "pipeline", "GitHub Actions", "deploy"

**Tasks:**
1. Create/modify workflow file (`.github/workflows/<name>.yml`)
2. Add any required scripts (`scripts/<name>.sh`)
3. Update repo secrets/variables documentation
4. Test: push to branch, verify workflow runs

**Dependencies:** 2 → 1 → 4 (script exists before workflow references it)
**Parallel:** 3 is independent

---

## Pattern: Auth/Security Hardening

**Trigger:** Priority mentions "auth", "security", "JWT", "session", "CSP"

**Tasks:**
1. Audit current auth implementation (read middleware, check patterns)
2. Implement fix/enhancement
3. Add security-specific tests
4. Update security documentation or ADR

**Dependencies:** 1 → 2 → 3 (audit before fix, fix before test)
**Parallel:** 4 can run alongside 2-3

---

## Anti-patterns (do NOT decompose this way)

- **One giant task:** "Implement the feature" — too vague, needs further decomposition
- **File-per-task blindly:** Don't create a task per file if the changes are tightly coupled. Group coupled changes into one task.
- **Tests as afterthought:** Tests should be a sibling task, not a "phase 2" item. They run in parallel with implementation.
- **Over-decomposition:** If a task is <20 lines of changes across 1-2 files, don't decompose further. That's already atomic.
