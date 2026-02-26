# LangGraph Failure Modes

Known failure signatures for LangGraph state machine debugging. Cross-reference with `domain-knowledge/langgraph-patterns.md`.

## FM-1: Infinite loop / missing terminal condition

**Symptoms:**
- Graph runs indefinitely, never reaching `END`
- Same node executes repeatedly (check logs for repeated node name)
- Timeout or token limit hit without completing

**Detection:**
```python
# Pattern: conditional edge with no path to END
def route(state):
    if condition:
        return "node_a"
    else:
        return "node_b"  # both routes loop back, no END condition
```

**Fix:** Ensure at least one branch in every routing function can reach `END`. Add max-iteration counter to state if the loop is intentional.

---

## FM-2: State schema violation

**Symptoms:**
- `ValidationError` on state update
- Node returns fields not in `StateAnnotation`
- Required fields missing from output

**Detection:**
```python
# Pattern: returning keys not declared in state
class State(TypedDict):
    messages: list
    # ← no 'result' key declared

def my_node(state: State) -> dict:
    return {"result": "..."}  # KeyError or ignored silently
```

**Fix:** Add missing key to `StateAnnotation`. Or remove the key from the return value if it was unintentional.

---

## FM-3: Checkpointer desync

**Symptoms:**
- Resuming a thread produces wrong or stale state
- Earlier state appears to be replayed
- `thread_id` changes produce unexpected state

**Detection:**
- Check if the checkpointer is persisted (not in-memory `MemorySaver` in production)
- Check if the graph schema changed after checkpoints were written
- Verify `thread_id` is stable across sessions

**Fix:** For production: use `AsyncPostgresSaver` or `AsyncSqliteSaver`. In dev: clear checkpointer between runs if schema changed.

---

## FM-4: Tool call failure not caught

**Symptoms:**
- Graph appears to complete but produces wrong output
- Error logged but graph continues with partial state

**Detection:**
```python
# Pattern: tool error not propagated
@tool
def my_tool(input: str) -> str:
    result = external_api(input)  # raises on failure
    return result  # if this raises, state.messages may have partial ToolMessage
```

**Fix:** Wrap tool calls in try/catch. Return an error message as the tool result so the LLM can handle it. Never let tool exceptions escape without a ToolMessage response.

---

## FM-5: Reducer conflict

**Symptoms:**
- State field unexpectedly reset to initial value
- Appended values not accumulating
- Only the last update visible in state

**Detection:**
```python
# Pattern: using list without Annotated[list, add_messages]
class State(TypedDict):
    messages: list  # ← default reducer REPLACES, doesn't append

# Fix:
from langgraph.graph import add_messages
class State(TypedDict):
    messages: Annotated[list, add_messages]
```

**Fix:** Use `Annotated[list, add_messages]` for message accumulation. Use `Annotated[T, lambda a, b: b]` (replace) only when replacement is intentional.

---

## FM-6: Async/sync mismatch

**Symptoms:**
- `RuntimeError: no running event loop`
- Coroutine returned where value expected
- Graph hangs at async node

**Detection:**
- Node function is `async def` but graph compiled without async invoker
- `await` missing inside async node
- `sync_invoke` used with async nodes

**Fix:** Ensure all nodes in an async graph are `async def`. Use `await graph.ainvoke()` not `graph.invoke()`.

---

## FM-7: Missing interrupt / human-in-the-loop

**Symptoms:**
- Graph runs past a checkpoint where human approval was expected
- Interrupt never fires, approval step skipped

**Detection:**
```python
# Pattern: interrupt_before not set for the right node
graph.compile(
    checkpointer=checkpointer,
    # interrupt_before=["approval_node"]  ← missing
)
```

**Fix:** Add `interrupt_before=["node_name"]` to compile. Ensure the thread is resumed (not re-invoked) after the interrupt.
