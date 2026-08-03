Reference for `/prototype`: the two modes — when each applies and how to build it.

## Mode selection (Step 1)

- **Logic mode** — the question is about behavior, state transitions, edge cases, ordering, concurrency. → interactive terminal harness.
- **UI mode** — the question is about layout, interaction feel, information density, visual hierarchy. → multiple variants in one route, switched by `?variant=` param.

### Step 2a — Logic mode: build a terminal harness

- A tiny CLI loop (Node `readline` / Python `input()`) that lets you fire the inputs/events the real system would receive.
- After each input, print the **complete** state (the LangGraph state object, the reducer output, the SSE buffer — whatever the question is about).
- Drive it through the hard cases by hand: out-of-order events, cancellation, double-submit, empty input, the case nobody can reason about on a whiteboard.

### Step 2b — UI mode: build N variants

- One page/route. `const variant = new URLSearchParams(location.search).get("variant")`.
- 2–4 **radically different** takes — not tweaks. Different layouts, different interaction models. Hardcode fake data.
- Use the project's real component library (Carbon) so the comparison is honest, but skip wiring real data/state.
- List the variant URLs in your reply so the user can flip between them side by side.
