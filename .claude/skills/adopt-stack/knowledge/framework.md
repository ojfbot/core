# Wrap / Absorb / Reject — reference

Full rubric for the `/adopt-stack` skill. The "why" layer is `adr:wrap-absorb-reject`.

## Gate 0 — library or application? (the SCRIPT measures; you judge)

**Do not hand-measure.** `scripts/measure-pkg.mjs <pkg>` is the authoritative source for every figure
below — it shells out to `pnpm view` and emits the table. Typing a size or dep-count from memory is the
exact fabrication this gate exists to prevent. Run the script, paste its table, then judge.

| Signal (script-produced) | Smells like an application when… |
|--------------------------|----------------------------------|
| Unpacked size | tens of MB+ |
| Direct deps | dozens, spanning UI + server + DB |
| Transitive tree | hundreds — but `unknown` until you install in a throwaway dir; never estimate |
| Telemetry SDKs | any present (amplitude/sentry/rrweb/segment/posthog/datadog/…) |
| Embedded persistence/auth | ships its own DB drivers, ORM, or `better-auth` |
| Embedded server/UI | ships a router/server (nitro/h3/express/react-router) or editor (tiptap/codemirror/radix) |
| Native-build hints | direct deps like `better-sqlite3`/`sharp` (transitive native builds only show on install) |

The script reports an `n/6 application-shaped signals` count as a SIGNAL, not a verdict — you make the
call. **If application →** the only honest boundaries are **process/protocol** (drive its CLI/MCP
out-of-process, zero packages in your tree) or **REJECT**. Do not WRAP-by-import an application.

## The three calls (apply per imposed opinion, not once globally)

A mature stack imposes many opinions (data model, output format, telemetry, auth, naming). Decide each.

- **WRAP** — adopt the dependency, confine the vendor to ONE labeled adapter file; callers see only a
  domain interface. Precedent adapters: `packages/workflows/src/llm.ts`,
  `cv-builder/packages/agent-core/src/agents/base-agent.ts`. At a *process* boundary, the WRAP is the
  driver-skill / thin-client-over-a-load-bearing-app pattern ("thin client for capability, thick client
  for taste"). Verify confinement: `grep -r '<vendor-scope>' src` hits only the adapter file.
- **ABSORB** — take the *idea*, re-express it in your own portable primitives, drop the dependency.
  Right when the idea is small/good but the carrier is heavy or opinion-laden. Re-express in whatever
  your stack already renders/diffs (e.g. markdown + Mermaid over a proprietary MDX block format).
- **REJECT** — don't take it. Right when the opinion fights a hard invariant (telemetry vs. local-first;
  hosted DB vs. committed source of truth) and isn't worth re-expressing.

## Output — the decision table

Always produce a recorded table; it is the artifact and the integration-judgment evidence.

| # | Opinion the stack imposes | Call | Rationale (tie to an invariant) |
|---|---------------------------|------|---------------------------------|

Plus the Gate-0 measurement table. See `case-studies/agent-native.md` for a full worked example.

## Invariants to test each opinion against (project-specific)

Pull from the host stack's stated invariants — e.g. local-first / committed source of truth,
pnpm-only, name-by-purpose / ubiquitous language, diffable artifacts that render anywhere, no
phone-home telemetry. An opinion that violates one of these is a REJECT candidate unless the idea is
worth ABSORBing in compliant form.
