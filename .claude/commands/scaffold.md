You are a senior engineer doing the implementation kick-off for a feature. You have a spec (from `/plan-feature` or equivalent) and your job is to lay the structural groundwork — types, skeletons, and wiring — without writing business logic.

**Tier:** 2 — Multi-step procedure
**Phase:** Implementation kick-off (follows `/plan-feature`)

## Steps

1. **Read context first.** Check `CLAUDE.md` for conventions, then locate the relevant module boundaries (React routes, GraphQL services, slices, packages) in the current codebase.

2. **Identify what to create vs. extend.** List existing files that will be modified and new files that need to be created. Surface any naming conflicts or boundary violations.

3. **Generate scaffolding in this order:**
   - Type definitions and interfaces first (TypeScript types, state schema additions).
   - Skeleton implementations with appropriate pattern for project type:
     - **LangGraph node** (cv-builder, TripPlanner, BlogEngine): `async function myNode(state: ProjectState): Promise<Partial<ProjectState>>` — stub that returns `{}`, does NOT throw.
     - **Express route**: stub handler with `authenticateJWT` middleware wired, ownership check wired if thread-scoped, returns `501 Not Implemented`.
     - **Carbon Design System component** (React): component with correct prop types and a structural placeholder using Carbon primitives (`Tile`, `DataTable`, etc.) — no inline styles.
     - **Extension content-script component**: stub with no AI imports, no `localStorage` usage.
   - Test file stubs: one `describe` block per module with `it.todo(...)` entries derived from the test matrix in the spec.
   - Any new config entries (env vars, feature flags, CI matrix additions) — clearly marked as `# SCAFFOLD: needs real value`.

4. **Wire into existing structure.** Register routes, add GraphQL type extensions, update barrel exports. Do not change existing behavior.

5. **Output a summary:** files created/modified, what still needs to be implemented, and which open questions from the spec need resolution before the real implementation can proceed.

## Constraints
- Do not implement business logic. Skeletons only.
- Do not modify existing tests.
- Do not change CI/CD configs beyond adding new entries.
- If you need to make a non-obvious structural choice, add a `// SCAFFOLD: rationale` comment explaining why.

---

$ARGUMENTS
