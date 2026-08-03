# Migration paths

Loaded during `/rag-audit` Step 3, when the current store must be upgraded for production. The invariants that drive the choice are in `rag-invariants.md`; this file covers how to get from here to there without corrupting retrieval.

## Choosing the target store

| Current | Production target | When |
|---|---|---|
| `MemoryVectorStore` (ephemeral) | SQLite-backed store (e.g. sqlite-vec / LanceDB file store) | Single-node app, store fits on disk, no concurrent writers |
| `MemoryVectorStore` | Chroma (persistent client) | Need collections/metadata filtering, still local-first |
| SQLite/file store | pgvector | Multiple services read the index, or the app already runs Postgres |
| Any store, model change needed | Same store, full re-index | Embedding model/dimension changes for quality or cost |

Prefer the smallest store that satisfies persistence — a file-backed store on the app's own disk beats introducing a new service for a single-consumer index.

## Migration steps (any path)

1. **Pin the embedding model first.** The target index must be built with the exact model + dimensions the query path will use. If the model is changing, this migration is a full re-embed — there is no converting vectors between models.
2. **Re-index from source documents, not from the old vectors.** Export the raw docs/chunks, run the seeding script against the new store. Old vectors are disposable; source text is canonical.
3. **Make the seeding script idempotent against the new store** (upsert by stable chunk ID, or drop-and-rebuild a named collection) before pointing the app at it.
4. **Verify before cutover:** vector count matches expected chunk count; a fixed set of 5–10 known queries returns the same top-k documents (or better) than the old store; empty-result handling still triggers on a nonsense query.
5. **Cut over behind config** — store choice should be an env/config value, so rollback is a config change, not a code revert.
6. **Add the startup health check** — app refuses to serve (or logs loudly) when the store is reachable but empty.

## Gotchas

- **Don't run old and new stores half-migrated.** Queries hitting a partially seeded store return plausible-but-wrong context — worse than downtime. Seed fully, verify, then switch.
- **Dimension mismatch fails late.** Some stores accept inserts of any dimension and only misbehave at query time. Assert the dimension at seed time.
- **`.gitignore` the new DB file** before the first seed run, or the index ends up in the repo.
