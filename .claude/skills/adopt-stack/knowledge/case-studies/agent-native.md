# Case study #1 — BuilderIO `agent-native` (the engine behind `visual-plan`)

Worked example of the wrap/absorb/reject framework. Dogfooded 2026-06-26. This is the evidence base
`adr:wrap-absorb-reject` cites. The point of the case study is the *method*, not agent-native.

## What we wanted

A structured, reviewable plan artifact with a feedback loop — the value proposition of BuilderIO's
`visual-plan` skill, which is a thin instructional wrapper over the `agent-native` app/MCP.

## Step 1 — library-vs-application gate (`measure-pkg.mjs @agent-native/core`)

Numbers are the script's, not hand-typed (registry-sourced, **v0.79.17 as measured 2026-06-26** — the
registry moves: by 2026-07-06 it was v0.88.0 / 120 MB, which is exactly why the gate is script-driven):

| Signal (script) | Measurement | Verdict |
|-----------------|-------------|---------|
| Unpacked size | **113.9 MB** (119,389,983 bytes) | application |
| Direct deps | **88** | application |
| Telemetry SDKs | `@amplitude/analytics-browser`, `@rrweb/record`, `@sentry/browser`, `@sentry/node` | phones home by construction |
| DB drivers | `@libsql/client`, `@neondatabase/serverless`, `better-sqlite3`, `drizzle-orm` | application |
| Server / router | `nitro`, `h3`, `@react-router/*`, `i18next` | application |
| UI frameworks | 20+ `@tiptap/*`, 7× `@radix-ui/*`, codemirror | application |
| Auth | `better-auth` | application |
| Native-build hint | `better-sqlite3` | build/supply-chain surface |
| Application-shaped signals | **6/6** | application |

Measured by install in a throwaway dir (not registry-provable): **~811 packages in the tree**, native
`better-sqlite3` postinstall (`prebuild-install \|\| node-gyp rebuild`), **5m38s** install wall-clock.

**Gate result: it is an application, not a library.** → never `import`ed; only candidates are a process
boundary (drive its CLI/MCP out-of-process) or reject.

> Note: the original hand-written draft said "~119 MB" (decimal-MB) and missed `drizzle-orm`, `nitro`/
> `h3`, and `i18next`. The script's 113.9 MB (binary-MB) and complete dep list are why this gate is
> script-driven.

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
| D1 | Plan engine welded to a 113.9 MB / 88-dep app | **REJECT (import)** | No slim core to wrap; importing drags the whole platform + telemetry into the lockfile. |
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
