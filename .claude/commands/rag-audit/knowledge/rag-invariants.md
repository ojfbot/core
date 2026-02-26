# RAG Pipeline Invariants

Critical properties that a RAG pipeline must maintain for reliable retrieval.

## Vector store persistence

**Invariant:** The vector store must be persistent across process restarts.

**Violation:** Using an in-memory vector store in production. Every restart discards all embeddings. Cold starts require full re-seeding.

**Signal:** `new MemoryVectorStore()` without any persistence layer in a production code path.

**Fix:** Migrate to pgvector (Postgres), ChromaDB, Pinecone, or another persistent store. See `knowledge/migration-paths.md`.

---

## Chunking consistency

**Invariant:** Chunking strategy must be consistent across seeding and retrieval.

**Violation:** Seeding with 512-token chunks, but retrieval is configured for 1024-token windows. Or different chunk overlap values.

**Signal:** `chunkSize` or `chunkOverlap` values defined in multiple places with different values.

**Fix:** Extract chunking config to a single constant. Use it in both seeder and retriever.

---

## Embedding model consistency

**Invariant:** The same embedding model must be used for seeding and querying.

**Violation:** Seeding with `text-embedding-3-small` but querying with `text-embedding-3-large`. Dimensions differ — queries will fail or produce garbage.

**Signal:** Embedding model name defined in multiple places; vector dimensions in schema don't match the model.

**Fix:** Extract embedding model to a single config constant. Add a smoke test that verifies the seeded store can be queried.

---

## Retrieval k-value

**Invariant:** The number of retrieved documents (`k`) must be tuned to the context window.

**Violation:** `k=20` when each chunk is 1024 tokens — 20k tokens of context before the query. Most LLMs will perform poorly at this context load.

**Signal:** `k > 5` without context length budgeting.

**Recommendation:** `k=3-5` for 4k context models, `k=5-10` for 16k+ models. Measure answer quality, not just retrieval recall.

---

## Metadata filtering

**Invariant:** Retrieved documents must be filterable by relevant metadata.

**Violation:** All documents seeded without metadata. Retrieval returns results from irrelevant categories, dates, or users.

**Signal:** No `metadata` field in the document schema, or metadata is present but no filter is applied at retrieval time.

**Fix:** Seed with structured metadata (`{source, date, userId, category}`). Apply filters at retrieval: `retriever.invoke(query, { filter: { userId: user.id } })`.

---

## Seeding idempotency

**Invariant:** Re-running the seeder must not duplicate documents.

**Violation:** Seeder appends documents on every run. After 10 runs, each query returns 10x duplicated results.

**Signal:** No deduplication check in the seeder; no document ID tracking.

**Fix:** Use document IDs derived from content hash or source path. Check for existence before inserting. Or clear and re-seed atomically.

---

## Similarity score threshold

**Invariant:** Documents below a minimum similarity score must not be included in the context.

**Violation:** No score threshold set. Irrelevant documents included when the query has no close matches.

**Signal:** `similaritySearch()` called without a score threshold or filter.

**Fix:** Use `similaritySearchWithScore()` and filter results: `results.filter(([_, score]) => score >= 0.75)`.
