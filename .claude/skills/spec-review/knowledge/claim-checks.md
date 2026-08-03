# Claim checks — what to parse, what to read, what to verify

Reference for `/spec-review` Steps 1–5, moved verbatim from SKILL.md.

## Claim types to identify when parsing (Step 1)

- What projects and repos does this spec touch?
- What phases or components does it propose?
- What **existence claims** does it make? ("X is already implemented", "Y already exists", "Z is missing")
- What **port/URL claims** does it make?
- What **pattern claims** does it make? ("follows X pattern from Y repo")
- What **sequencing claims** does it make? ("Phase A unblocks Phase B")
- What does it leave as open questions?

## Ground-truth sources to load (Step 2)

**For Frame OS cluster work:**
- `domain-knowledge/frame-os-context.md` — ports, env vars, what already exists, what must NOT be done, roadmap phases
- `domain-knowledge/<project>-architecture.md` — monorepo packages, open issues, blockers
- `domain-knowledge/shared-stack.md` — auth invariant, LangGraph node pattern, RAG invariant, logging invariant, Carbon DS

**For any spec:**
- If the spec claims something already exists in code, read the actual file or run a targeted search. Existence claims wrong in either direction (says exists but doesn't; says to build but it's already there) are CRITICAL.
- If the spec references a pattern from another repo, verify that repo actually uses that pattern.

## Existence-claim flags (Step 3)

- Flag: thing spec says to build that already exists (duplicate work)
- Flag: thing spec says exists that doesn't (hidden dependency)

## Architecture and pattern checks (Step 5)

- Verify "follows X pattern" claims against the actual reference implementation
- Check shared-stack.md invariants: auth on all v2 routes, no raw `console.*`, no MemoryVectorStore in production, sqlite-vec as RAG target
- Check sequencing: does any phase ship a route, store, or feature that violates an invariant the next phase is meant to fix?
