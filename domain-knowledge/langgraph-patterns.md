# LangGraph Patterns and Invariants

Reference for commands that review or debug LangGraph code in cv-builder.

## State schema rules

- All state lives in `CVBuilderState` (defined in `packages/agent-graph/src/state/schema.ts`).
- Every field must have a TypeScript type and a reducer function (or use `LastValue` / `Append` helpers).
- Nodes declare their inputs implicitly by reading from state and outputs by returning a partial state object.
- **Invariant:** a node must not read fields it doesn't own unless they are read-only inputs. Nodes that write the same field create a conflict — flag this.

## Node design rules

- Each node is a pure-ish async function: `(state: CVBuilderState) => Promise<Partial<CVBuilderState>>`.
- LLM calls must handle: empty response, malformed JSON (if structured output expected), rate limit errors, and token overflow.
- Nodes should not have side effects other than LLM calls and (explicitly) tool calls.
- **Invariant:** every node that calls an Anthropic/OpenAI API must catch and handle `RateLimitError` and propagate a user-readable error state.

## Graph / routing rules

- `StateGraph` compiles to a runnable graph — compilation errors are a signal that node names or edge targets are wrong.
- Every conditional edge function must return a value that matches a registered node name or `END`.
- **Invariant:** there must be no routing path that reaches an unregistered node name. Test graph compilation as a standalone unit test.
- The `orchestratorNode` is the entry point and routes based on parsed user intent. Changes to its routing logic affect the entire graph.

## Checkpointer (SQLite)

- `sqlite-checkpointer.ts` persists graph state between requests (enables resume from failure, human-in-the-loop).
- Each `thread_id` maps to a checkpoint chain. Thread IDs come from the API layer and must be validated.
- **Invariant:** checkpointer `put` must be called after state changes, not before. Test that state is correctly restored from a saved checkpoint.
- The checkpointer database file is separate from (or shared with) the `sqlite-thread-manager` — check the config before assuming.

## RAG retrievers

Three specialized retrievers in `packages/agent-graph/src/rag/`:
- Resume templates retriever
- Learning resources retriever
- Interview preparation retriever

Each wraps either `MemoryVectorStore` (current, ephemeral) or `SQLiteVectorStore` (target, persistent).

- **Invariant:** every retriever call must handle `k=0` (empty results) without throwing. Downstream nodes that consume retriever results must handle empty arrays.
- Seeding: the knowledge base must be seeded before retrieval works. In tests, use a pre-seeded in-memory store.

## Streaming (SSE)

- V2 chat uses Server-Sent Events. The stream is closed by the client or on graph completion.
- **Known issue #60:** `AbortController` cleanup for async operations in modals can cause premature stream termination.
- **Invariant:** SSE error events should include enough context to surface to the user. Silent stream termination is a bug.

## Testing LangGraph code

Priority order for test coverage (from issue #52):
1. `CVBuilderState` schema — state validation, reducers, initial state
2. `sqlite-checkpointer` — put, get, list checkpoints with real SQLite in-memory
3. Individual node logic — with mocked LLM responses (use `vi.mock('@langchain/anthropic')`)
4. Graph compilation — assert `graph.compile()` succeeds without throwing
5. Routing — assert conditional edge functions return the expected node names for given state inputs
6. API integration — with supertest against the Express app

## Common failure signatures

| Symptom | Likely cause |
|---------|-------------|
| `Cannot read properties of undefined (reading 'xxx')` in a node | State field name mismatch — node reads `state.resumeData`, schema has `state.resume` |
| Graph hangs / never reaches `END` | Routing loop — two nodes route to each other with no exit condition |
| `Checkpoint not found for thread` | Thread ID not matching, or checkpointer DB not initialized before use |
| Retriever returns 0 results always | Vector store not seeded, or embedding model key missing |
| SSE stream closes immediately | Unhandled error in first node; check Sentry or logs for the exception |
| `TypeError: graph.compile is not a function` | Import from wrong package or version mismatch in `@langchain/langgraph` |
