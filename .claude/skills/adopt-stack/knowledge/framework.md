# Wrap / Absorb / Reject — reference

Full rubric for the `/adopt-stack` skill. The "why" layer is `adr:wrap-absorb-reject`.

## Gate 0 — library or application? (measure before deciding)

Run these against the candidate **before** any other reasoning. An *application* is never `import`ed.

| Signal | How to measure | Smells like an application when… |
|--------|----------------|----------------------------------|
| Unpacked size | `pnpm view <pkg> dist.unpackedSize` | tens of MB+ |
| Direct deps | `pnpm view <pkg> dependencies` | dozens, spanning UI + server + DB |
| Transitive tree | `pnpm view`/install count | hundreds |
| Telemetry SDKs | grep deps for `amplitude\|sentry\|rrweb\|segment\|posthog\|analytics` | any present |
| Embedded persistence/auth | grep deps for DB drivers, `better-auth`, ORM | ships its own DB/auth |
| Embedded server/UI | grep for `react\|vue\|express\|nitro\|tiptap\|next` | ships a UI or server |
| Native postinstall | watch install for `node-gyp`/`prebuild-install` | compiled native modules |

**If application →** the only honest boundaries are **process/protocol** (drive its CLI/MCP
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
