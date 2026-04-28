# Depth metrics — how to measure shallow vs deep

Four metrics, computed by `scripts/measure-depth.mjs`. Each is a heuristic — they flag candidates, not verdicts. The skill cross-references them with code-reading judgment.

## Metric 1: public exports per file

**Definition:** count of `export` declarations per `.ts`/`.tsx` file (excluding `export default` of a single value, which counts as 1).

**Read it:**
- 1 export = a focused module. Probably fine, depending on what it does.
- 2–5 exports = healthy default for most files.
- 6–15 exports = a bag of related utilities. Sometimes fine (a `utils/string.ts` namespace is often this shape) but verify.
- 16+ exports = almost always either a barrel file (re-exporting) or a kitchen sink. Audit.

**False positives:**
- Barrel re-exports (`export { X } from './x'; export { Y } from './y';`) inflate the count without adding implementation. The script flags barrels separately by detecting whether each export is a re-export from another file.
- Type-only exports (`export type Foo = ...`) are usually fine to keep clustered. Ignore for depth audit unless they're driving caller complexity.
- React component files often have implementation + types + props interface = 3+ exports legitimately.

## Metric 2: lines per public function

**Definition:** for each exported function/method, count non-blank, non-comment lines in the body.

**Read it:**
- 1–5 lines = thin wrapper. Probably indirection without payoff. Inline candidate or sign of shallow design.
- 5–20 lines = light implementation. Often fine; verify the function name matches the work.
- 20–80 lines = healthy. The interesting Ousterhout zone — heavy implementation behind a simple call.
- 80–150 lines = dense implementation; verify cohesion (does it do *one* conceptual thing?).
- 150+ lines = consider splitting, but **that is a different problem** (large function ≠ shallow module). Don't conflate.

**False positives:**
- A 3-line function that wraps a complex external API call is *deep* (hides the messy SDK behind a clean interface). Read the implementation, not just the line count.
- React components that delegate everything to a single hook can legitimately be 5–10 lines.
- Type guards (`function isFoo(x): x is Foo { return ... }`) are short by design.

## Metric 3: import-to-export ratio

**Definition:** count of `import` statements / count of `export` declarations.

**Read it:**
- < 0.5 = file imports very little; mostly self-contained logic. Often deep.
- 0.5–2 = healthy.
- 2–5 = file is doing wiring; verify whether it's deserved (e.g., an entry point) or whether it's gluing too many things together.
- 5+ = thin wrapper that delegates to many collaborators. Strong shallow signal.

**False positives:**
- Test files inflate this dramatically (lots of imports for setup, few exports). The script excludes `*.test.ts` and `__tests__/` by default.
- Entry points (CLI mains, route registrars) legitimately import many things; flag them but consider context before proposing a deepening.

## Metric 4: single-caller leaf files

**Definition:** files imported from exactly one other file in the codebase.

**Read it:** these are candidates for *inlining*. If only one place uses `parseFooHelper.ts`, ask whether `parseFoo.ts` should just contain `parseFooHelper`'s logic. Often the answer is yes — the extra file forced indirection without callers benefiting from polymorphism.

**False positives:**
- Files imported only by a barrel `index.ts` look like single-caller but are actually used through the barrel. The script follows barrels one level when computing this metric.
- Test fixtures legitimately have one caller (their test file).
- Files depended on by external packages (entry points published in `package.json` `main`/`exports`) appear as zero-caller in the local graph; the script reports those separately as "external surface" rather than as candidates.

## Reading the JSON output

```json
{
  "scope": "packages/workflows/src",
  "files_analyzed": 42,
  "metrics": {
    "avg_exports_per_file": 3.2,
    "avg_lines_per_public_fn": 14,
    "avg_import_export_ratio": 1.4,
    "single_caller_leaves": 7,
    "barrel_files": 3
  },
  "candidates": [
    {
      "file": "packages/workflows/src/utils/coerce.ts",
      "exports": 8,
      "avg_lines_per_fn": 3,
      "import_ratio": 0.5,
      "is_single_caller_leaf": true,
      "called_from": ["packages/workflows/src/parseCommand.ts"],
      "score": 0.81
    }
  ]
}
```

**`score`** is 0–1, computed as a weighted blend of: low function length, high export count, high import ratio, single-caller status. Higher = more shallow / more deepen-worthy.

Scores ≥ 0.7 are the audit's primary candidates. 0.5–0.7 are secondary (worth a look). < 0.5 are noise.

## When metrics lie

Numbers are signal, not gospel. Always read the file before proposing a deepening:

- **Cohesion check.** Do the exports belong together? If the file has 12 exports and they're all about Bead lifecycle, that's not shallow — it's a focused namespace. If the 12 are unrelated utilities, propose splitting *and* deepening.
- **Tested + comfortable + stable.** A file scoring 0.85 that hasn't changed in 6 months and has good tests is often fine. Move on.
- **Caller pain check.** Read 2–3 files that import from the candidate. If the imports are clean and the calls are obvious, the wrapper is doing its job. If callers have to import 4 things from the same file to do anything useful, the wrapper is shallow.

## Excluding files

By default the script excludes:
- `**/*.test.ts`, `**/*.spec.ts`, `**/__tests__/**` (test files have different shape)
- `**/dist/**`, `**/build/**`, `**/node_modules/**` (generated/external)
- `**/*.d.ts` (type-only declarations)

To include test patterns or override exclusions: `node scripts/measure-depth.mjs --scope=<path> --include-tests`.
