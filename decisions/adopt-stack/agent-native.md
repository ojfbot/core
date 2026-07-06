# /adopt-stack decision: BuilderIO `@agent-native/core`

Decided 2026-07-06 (first re-measured against the live registry; original dogfood 2026-06-26).
Why-layer: `adr:wrap-absorb-reject`. Method detail: `.claude/skills/adopt-stack/knowledge/case-studies/agent-native.md`.

## Gate 0 (script-measured): APPLICATION (6/6 application signals)

`measure-pkg.mjs @agent-native/core`, verbatim:

| Signal | Measurement |
|--------|-------------|
| Version | `@agent-native/core@0.88.0` |
| Unpacked size | 120 MB |
| Direct dependencies | 88 |
| Transitive tree | unknown (requires install in a throwaway dir — ~811 when measured 2026-06-26) |
| Engines | `{"node":">=22.22.0"}` |
| Telemetry SDKs | ⚠️ @amplitude/analytics-browser, @rrweb/record, @sentry/browser, @sentry/node |
| DB drivers | ⚠️ @libsql/client, @neondatabase/serverless, better-sqlite3, drizzle-orm |
| Server / router | ⚠️ @react-router/dev, @react-router/fs-routes, h3, i18next, nitro, react-i18next |
| UI frameworks | ⚠️ 20+ @tiptap/*, 7× @radix-ui/*, codemirror, tailwind-merge |
| Auth stacks | ⚠️ better-auth |
| Native-build hints (direct) | ⚠️ better-sqlite3 |
| Ships a bin/CLI | yes |
| Application-shaped signals | 6/6 |

## Decision table

| # | Opinion imposed | Call | Evidence → invariant |
|---|-----------------|------|----------------------|
| D1 | Plan engine welded to a 120 MB / 88-dep app | **REJECT (import)** | Script: 6/6 app signals; no slim core to wrap → importing drags the whole platform into the lockfile. |
| D2 | Boundary type: import vs. talk-to | **WRAP at process boundary** *(only if live render needed)* | Honest adapter is an out-of-process CLI/MCP driver, zero packages in tree — not an SDK import. |
| D3 | Bundled Amplitude/Sentry/rrweb telemetry | **REJECT** | Script telemetry row (4 SDKs) → violates the no-phone-home / local-first invariant. |
| D4 | Hosted-DB orientation (Neon/libSQL/drizzle) | **REJECT** → local-files only | Script DB-driver row; local-files mode verified to write only local files → committed-source-of-truth invariant. |
| D5 | Output = MDX over a proprietary 20-block vocabulary, renderer-locked | **ABSORB the idea, REJECT the format** | ~80% of blocks map to portable markdown + Mermaid → diffable-artifact invariant. Take the block concept (esp. `question-form`) in GitHub-native primitives. |
| D6 | Adopt at all? | **REJECT the dependency** | Capability reachable natively (absorbed block-idea + Mermaid) with none of the baggage; keep out-of-process only if rendered visuals are specifically required. |

## Integration shape

Reject the import; keep zero `@agent-native/*` packages in the tree; absorb the structured-plan-block
idea into markdown + Mermaid. Reach for the `agent-native` CLI out-of-process only if its rendered
wireframes/diagrams are specifically needed.
