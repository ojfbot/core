# Mermaid templates

Loaded during `/doc-refactor` Step 4. Common diagram patterns for OJF docs. Keep diagrams small (≤ ~12 nodes); split rather than cram. If the repo has `domain-knowledge/diagram-conventions.md`, its conventions win over these defaults.

## Agent graph (LangGraph state machines)

```mermaid
graph TD
    START([START]) --> ingest[ingest_node]
    ingest --> route{route_fn}
    route -->|needs_tools| tools[tool_node]
    route -->|done| END([END])
    tools --> ingest
```

Conventions: nodes named after the actual node functions; conditional edges labeled with the routing value; always show the path to `END`.

## API flow (request → response, incl. SSE)

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API (Express)
    participant L as LLM gateway
    C->>A: POST /api/generate
    A->>L: prompt + context
    L-->>A: stream tokens
    A-->>C: SSE events (phase, delta, done)
```

Conventions: one participant per process boundary, not per module; label SSE arrows with event names actually emitted.

## Module dependency (workspace / MF topology)

```mermaid
graph LR
    shell --> cv[cv-builder remote]
    shell --> blog[blogengine remote]
    cv --> ui[frame-ui-components]
    blog --> ui
    cv --> agent[frame-agent gateway]
```

Conventions: arrow = "imports/loads at runtime"; keep direction consistent (consumer → dependency); mark ports only if load-bearing for the doc.

## Pipeline (multi-phase processing)

```mermaid
graph LR
    collect[1. collect] --> draft[2. draft]
    draft --> council[3. council review]
    council --> synth[4. synthesize]
    synth --> publish[(published post)]
```

Conventions: number the phases; use a cylinder/stadium for the terminal artifact; annotate a phase with its owning script when docs reference it (`scripts/generate.mjs`).
