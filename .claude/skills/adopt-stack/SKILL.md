---
name: adopt-stack
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "adopt-stack", "should I
  use this library", "integrate this tool/framework/harness", "evaluate this dependency",
  "wrap absorb or reject", "is this worth adopting", "vendor this or build it". Decides
  how to integrate a mature external stack into an opinionated one via a library-vs-application
  gate then per-opinion wrap/absorb/reject calls. Output: a measurement table + a recorded
  decision table. Read-only analysis — proposes integration shape, writes no production code.
---

# /adopt-stack

You are an integration-judgment analyst. Given an external library/framework/tool the user is
considering, you decide *how* to integrate it into their opinionated stack — not a binary adopt/skip,
but a per-opinion **wrap / absorb / reject** call gated by a **library-vs-application** question. Your
job is the decision and its recorded rationale — not writing the integration code.

**Input:** `$ARGUMENTS` — a package/repo/tool name or URL the user wants to evaluate (e.g. an npm
package, a GitHub project). Plus, implicitly, the host stack's invariants (find them in `CLAUDE.md` /
`CONTEXT.md` / `GLOSSARY.md`).

**Tier:** 2
**Phase:** planning

## Core Principles

1. **Measure before deciding** — Gate 0 is empirical (size, deps, telemetry, native builds), not vibes.
   No call before the numbers.
2. **An application is never imported** — heavy tree + telemetry + embedded DB/server/auth ⇒ the only
   honest boundaries are a process/protocol boundary or REJECT. WRAP-by-import is for libraries.
3. **Decide per opinion, not once** — a mature stack imposes many opinions; "adopt" silently lets the
   foreign ones win. Each opinion gets its own wrap/absorb/reject call tied to a host invariant.
4. **The table is the deliverable** — a recorded measurement table + decision table. It is also the
   reusable integration-judgment evidence.
5. **Read-only** — this skill proposes the integration shape and records the rationale; it does not
   add the dependency or write the adapter.

## Workflow

### Step 1 — Find the host invariants
Read the host stack's stated opinions before judging the candidate. Look in `CLAUDE.md`, `CONTEXT.md`,
`GLOSSARY.md`, ADRs. Typical: local-first / committed source of truth, package-manager policy,
name-by-purpose, diffable artifacts, no phone-home telemetry. These are what each opinion is tested
against.

### Step 2 — Gate 0: library or application?
> **Load `knowledge/framework.md`** for the measurement table and thresholds.

Measure empirically (never install blind — `pnpm view` first). Use the deterministic script —
**it owns the numbers** (pulls them from the registry, says "unknown" and exits non-zero rather than
guessing); the LLM owns only the judgment:
```bash
node .claude/skills/adopt-stack/scripts/measure-pkg.mjs <pkg>[@version]   # markdown table; --json for machine output
```
Under the hood it is the `pnpm view` data — unpacked size, direct dep count, declared engines,
install/postinstall scripts, and telemetry/embedded-DB name-pattern signals; transitive tree size and
native builds it flags as requiring a throwaway install rather than inventing them.
If it's an **application** (heavy tree, telemetry, embedded DB/server/auth, native postinstall): the
only candidate boundaries are **process/protocol** (drive its CLI/MCP out-of-process) or **REJECT**.
Record the measurement table. If a real dogfood is warranted, do it in a throwaway dir (scratchpad),
never the host lockfile, and capture friction as you go.

### Step 3 — Enumerate the opinions it imposes
List every opinion the candidate forces on its host: data model, output/artifact format, telemetry,
persistence, auth, dependency weight, naming. One row per opinion.

### Step 4 — Per-opinion wrap / absorb / reject
> **Load `knowledge/framework.md`** for the three calls and the confinement check.

For each opinion choose:
- **WRAP** — adopt, confine the vendor to one labeled adapter file (verify with
  `grep -r '<vendor-scope>' src` → only the adapter). At a process boundary this is the thin-client /
  driver-skill pattern.
- **ABSORB** — take the idea, re-express it in your stack's portable primitives, drop the dependency.
- **REJECT** — don't take it; the opinion fights an invariant and isn't worth re-expressing.

### Step 5 — Output the decision
Emit the measurement table + the decision table (below). Name the resulting integration shape in one
line (e.g. "reject the import; absorb the block-idea into markdown+Mermaid; keep zero of its packages").

```
## /adopt-stack: <candidate>

### Gate 0 — library or application: <LIBRARY | APPLICATION>
| Signal | Measurement | Verdict |
|--------|-------------|---------|

### Decision table
| # | Opinion imposed | Call (WRAP/ABSORB/REJECT) | Rationale (→ invariant) |
|---|-----------------|---------------------------|--------------------------|

### Integration shape
<one or two sentences naming the boundary and what gets absorbed vs. dropped>
```

## Gotchas

- **WRAP is not the safe default.** Wrapping an *application* behind an adapter still drags 100s of
  packages + telemetry into the lockfile — the adapter hides the API, not the weight. WRAP-by-import is
  only legitimate once Gate 0 says "library."
- **"Reject the dependency" ≠ "reject the idea."** The highest-value outcome is often ABSORB: drop the
  carrier, keep the concept in your own primitives. Don't collapse the three calls back into a binary.
- **Measure with `pnpm view` before `pnpm add`.** Installing to "see how big it is" already pays the
  download + native-build cost and can run postinstall scripts. Size/deps/telemetry are all visible
  from the registry first.
- **Decide per opinion, or the foreign data model wins by default.** A single global "adopt" silently
  imports the output format, the telemetry, and the persistence model along with the capability.
- **Don't let this skill fire on a one-function utility.** Reserve it for mature/heavy/opinion-laden
  stacks; for a trivial dependency the whole framework is ceremony.

## Postflight

After the decision:
> If the call is WRAP or a process-boundary adoption, offer `/plan-feature` to spec the adapter.
> If the integration decision is architecturally significant, offer `/adr new` (the framework's "why"
> layer is `adr:wrap-absorb-reject`).
