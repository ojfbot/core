# Case study #1 — BuilderIO `agent-native` (the engine behind `visual-plan`)

Worked example of the wrap/absorb/reject framework. Dogfooded 2026-06-26. This is the evidence base
`adr:wrap-absorb-reject` cites. The point of the case study is the *method*, not agent-native.

## What we wanted

A structured, reviewable plan artifact with a feedback loop — the value proposition of BuilderIO's
`visual-plan` skill, which is a thin instructional wrapper over the `agent-native` app/MCP.

## Step 1 — library-vs-application gate (measure first)

| Signal | Measurement | Verdict |
|--------|-------------|---------|
| Unpacked size | `@agent-native/core` = **~119 MB** | application |
| Dep count | **88 direct, ~811 in the tree** | application |
| Native postinstall | `better-sqlite3` → `prebuild-install \|\| node-gyp rebuild` | build/supply-chain surface |
| Bundled telemetry | `@amplitude/analytics-browser`, `@sentry/browser`, `@sentry/node`, `@rrweb/record` | phones home by construction |
| Embedded persistence/auth | 3 DB drivers (Neon serverless, libSQL, better-sqlite3) + `better-auth` | application |
| Embedded UI | 20+ `@tiptap/*`, 7× `@radix-ui/*`, codemirror, react-router | application |
| Install wall-clock | **5m38s** (warm pnpm store) | the cost every frozen-lockfile CI pays |

**Gate result: it is an application, not a library.** → never `import`ed; only candidates are a process
boundary (drive its CLI/MCP out-of-process) or reject.

## Step 2 — does the offline path even work? (yes)

`agent-native plan local init` / `plan blocks` run **offline, exit 0, no auth prompt**; output marked
`localOnly: true`, "generated without Plan app database writes." So the capability is real and local —
the blocker is weight/telemetry/format, not feasibility.

Friction observed (the kind a process-boundary driver must paper over):
- `plan local init` ignores cwd, resolves to a "workspace root," writes `plans/<slug>/plan.mdx`.
- `plan local check` requires `--dir`, then looks for `<dir>/plan.mdx` — a layout mismatch with what
  `init` produced.

## Step 3 — per-opinion wrap/absorb/reject calls

| # | Opinion imposed | Call | Rationale |
|---|-----------------|------|-----------|
| D1 | Plan engine welded to a 119 MB / 88-dep app | **REJECT (import)** | No slim core to wrap; importing drags the whole platform + telemetry into the lockfile. |
| D2 | Boundary type: import vs. talk-to | **WRAP at process boundary** *(only if a live render is needed)* | The honest adapter here is an out-of-process CLI/MCP driver, zero packages in our tree — not an SDK import. |
| D3 | Bundled Amplitude/Sentry/rrweb telemetry | **REJECT** | Local-first / no-phone-home is a hard invariant. A process boundary keeps the SDKs out of our tree entirely. |
| D4 | Hosted-DB orientation (Neon driver) | **REJECT** → local-files only | Confirmed local-files mode writes only local files. |
| D5 | Output = MDX over a proprietary 20-block vocabulary, renderer-locked | **ABSORB the idea, REJECT the format** | ~80% of blocks (`diff, code, file-tree, annotated-code, table, checklist, callout, rich-text, question-form, api-endpoint, data-model`) map to portable markdown + Mermaid. Only `wireframe, diagram, json-explorer, columns, tabs` need their renderer. Take the structured-block *concept* (esp. `question-form` = the feedback loop) in GitHub-native primitives. |
| D6 | Adopt at all? | **REJECT the dependency** | The wanted capability is reachable natively (absorbed block-idea + Mermaid, diffable, renders everywhere) with none of the baggage. Keep agent-native out-of-process only if its *rendered* visuals are specifically required. |

## The 20-block vocabulary (for the ABSORB decision)

`columns, tabs, api-endpoint, data-model, annotated-code, diff, file-tree, diagram, wireframe, code,
callout, checklist, question-form, rich-text, json-explorer, table`.

## Takeaway

"Adopt" was never one decision. The library-vs-application gate forced the boundary type before any
adapter code; per-opinion wrap/absorb/reject then let us keep zero of agent-native's packages while
absorbing its one good idea. A flat adopt/don't-adopt axis could not have expressed that.
