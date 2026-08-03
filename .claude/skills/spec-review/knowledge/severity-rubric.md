# Severity rubric — worked examples per bucket

Reference for `/spec-review` Step 8, moved verbatim from SKILL.md: what belongs in each severity bucket.

## CRITICAL examples

- Wrong component name, wrong port, wrong URL, wrong production domain
- Something spec says to build that already exists (wasted sprint)
- Something spec says exists that doesn't (missing dep discovered at runtime)
- Invariant violation (e.g., Phase B ships auth-less routes, Phase C adds auth)
- Wrong CORS origin or JWT placement

## SIGNIFICANT examples

- Missing types, nodes, or fields documented in architecture
- Phase ordering that intentionally violates an invariant without acknowledgment
- Tech choice that contradicts a stated invariant (MemoryVectorStore when sqlite-vec is required)
- Ungrounded assumption that needs an explicit decision or ADR
- Dependency direction reversed (Phase A acceptance requires Phase B's output)
- Architectural drift between docs and code left unresolved

## MINOR examples

- Wrong count (says "8 nodes", lists 9)
- Open question with an obvious answer in domain-knowledge
- Test fixture described as implementation strategy
- Stale doc the spec relied on
