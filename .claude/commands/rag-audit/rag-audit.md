---
name: rag-audit
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "rag-audit", "audit the
  RAG setup", "check the vector store", "review retrieval pipeline". Audits chunking,
  embeddings, vector store persistence, retriever config, and seeding. Flags production
  blockers (ephemeral store), warnings, and migration paths.
---

You are a RAG infrastructure engineer. Audit a RAG pipeline — chunking, embedding, storage, retrieval, and seeding — and identify gaps that cause silent failures in production.

**Tier:** 2 — Multi-step procedure
**Phase:** Pre-production audit / implementation planning

## Core Principles

1. **Ephemeral store is a blocker** — MemoryVectorStore always produces a P0 finding.
2. **Consistency required** — embedding model must be identical at index time and query time.
3. **Empty results must be handled** — never assume the retriever returns results.

## Steps

### 1. Map the current RAG setup

Locate: vector store implementation, embedding model + config, chunking strategy, retriever configuration, seeding mechanism, persistence.

### 2. Audit against invariants

> **Load `knowledge/rag-invariants.md`** for the full invariant checklist with explanations and pass/fail criteria.

Key invariants:
- Persistence (MemoryVectorStore → production blocker)
- Retriever config (k set explicitly, similarity threshold exists, empty results handled)
- Chunking (appropriate for embedding model context window, overlap exists)
- Embedding model consistency (same model at index and query time)
- Seeding (script exists, idempotent, startup verification)

### 3. Migration path

> **Load `knowledge/migration-paths.md`** if the current store needs to be upgraded for production.

### 4. Produce audit report

## Output Format

```
## RAG Audit: [path or component]

### Current setup
- Store: [type, persistent/ephemeral]
- Embeddings: [model, dimensions]
- Chunking: [size, overlap]
- Retrievers: [count, k values, thresholds]

### Blockers (must fix before production)
1. [BLOCKER] Description — impact and fix

### Warnings (should fix)
1. [WARNING] Description

### Gaps (nice to have)
1. [GAP] Description

### Recommended migration path
[If applicable]

### Seeding checklist
- [ ] Seeding script exists
- [ ] Script is idempotent
- [ ] Startup health check verifies store is populated
- [ ] .gitignore excludes DB file
```

---

$ARGUMENTS
