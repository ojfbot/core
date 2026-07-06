---
name: adopt-stack
description: >
  MANDATORY: Load this skill IMMEDIATELY when user asks to "adopt-stack", "should I
  use this library", "integrate this tool/framework/harness", "evaluate this dependency",
  "wrap absorb or reject", "is this worth adopting", "vendor this or build it". Decides
  how to integrate a mature external stack into an opinionated one via a library-vs-application
  gate then per-opinion wrap/absorb/reject calls. Output: a script-measured Gate-0 table + a
  decision record written to decisions/adopt-stack/. Evidence-grounded — the script owns the
  numbers, every call cites a source; read-only against the candidate (writes no adapter code).
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

1. **The script owns the numbers; you own the judgment.** Size/deps/telemetry/embedded-DB come from
   `scripts/measure-pkg.mjs`, never your memory. If you didn't run it this session you don't have the
   number — `unknown` is the honest value.
2. **An application is never imported** — heavy tree + telemetry + embedded DB/server/auth ⇒ the only
   honest boundaries are a process/protocol boundary or REJECT. WRAP-by-import is for libraries.
3. **Decide per opinion, not once** — a mature stack imposes many opinions; "adopt" silently lets the
   foreign ones win. Each opinion gets its own wrap/absorb/reject call tied to a host invariant.
4. **Every call cites evidence** — a wrap/absorb/reject row names a specific dep from the script output,
   a quoted source line, or an observed command result. No grounded basis ⇒ `undecided`. Fail closed.
5. **The decision record is the deliverable** — the judgment is written to `decisions/adopt-stack/<slug>.md`;
   an evaluation that stays in chat is `engaged_no_act`, not done. Read-only against the candidate — it
   writes the decision record, not the adapter or the dependency.

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
**Paste the script's table verbatim into the decision record. Never hand-type a size, dep count, or
SDK name** — from memory they are routinely wrong (binary-MB vs decimal-MB alone shifts the figure).
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

Each row's rationale must point at evidence — a dep name from the Step 2 table, a quoted source line,
or an observed result — and the host invariant it serves. Ungrounded ⇒ `undecided`, never a guess.

### Step 5 — Write the decision record (the artifact)
Write `decisions/adopt-stack/<candidate-slug>.md` containing the script's Gate-0 table verbatim, the
decision table, and a one-line integration shape. This durable file is the deliverable and the
OPAV-tracked artifact (registered in `packages/workflows/src/tracking/expected-artifact.ts`). Then print
the summary below.

```
## /adopt-stack: <candidate>  → decisions/adopt-stack/<slug>.md

### Gate 0 (script-measured): <LIBRARY | APPLICATION>  (<n>/6 application signals)
<measure-pkg.mjs table, verbatim>

### Decision table
| # | Opinion imposed | Call (WRAP/ABSORB/REJECT/undecided) | Evidence → invariant |
|---|-----------------|--------------------------------------|----------------------|

### Integration shape
<one or two sentences naming the boundary and what gets absorbed vs. dropped>
```

## Gotchas

- **Hand-typed package facts are the #1 fabrication risk.** A model will confidently emit "119 MB,
  ~80 deps" that is wrong on both counts (the real figure is 113.9 MB; the hand list missed
  `drizzle-orm`/`nitro`/`i18next`). `measure-pkg.mjs` exists to make those numbers un-hallucinatable —
  if you're typing a figure, you're doing it wrong.
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
> The written `decisions/adopt-stack/<slug>.md` is the OPAV-tracked `skill:acted` artifact.
