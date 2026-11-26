import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evidenceProblems, filterProblems, pythonProblems, isTestFile, PREREQUISITES, PROMOTE_SWEEP_STEP, RUNNERS, unwired, vitestIncludes } from "../../check-test-wiring.mjs";

describe("check-test-wiring", () => {
  it("recognises JS, TS and Python test file names", () => {
    expect(isTestFile("a/b/x.test.mjs")).toBe(true);
    expect(isTestFile("a/test_x.py")).toBe(true);
    expect(isTestFile("a/lint.py")).toBe(false);
  });

  it("flags a test file that no glob matches", () => {
    const inc = ["scripts/lib/__tests__/**/*.test.mjs"];
    expect(unwired(["scripts/lib/__tests__/a.test.mjs", "scripts/new/a.test.mjs"], inc)).toEqual([
      "scripts/new/a.test.mjs",
    ]);
  });

  it("reads include globs from the vitest config text", () => {
    expect(vitestIncludes('test: { include: [\n "a/**/*.test.ts",\n "b/*.test.mjs",\n ], x: 1 }')).toEqual([
      "a/**/*.test.ts",
      "b/*.test.mjs",
    ]);
  });

  it("recognises spec files and _test.mjs files", () => {
    expect(isTestFile("a/x.spec.ts")).toBe(true);
    expect(isTestFile("a/x_test.mjs")).toBe(true);
    expect(unwired(["packages/fleet-runner/scripts/g6-new.test.mjs"], [])).toEqual([]);
    expect(unwired(["packages/fleet-runner/scripts/other.spec.mjs"], [])).toEqual([
      "packages/fleet-runner/scripts/other.spec.mjs",
    ]);
  });

  it("accepts new files that match a runner glob, which the runner then runs", () => {
    for (const f of [
      "packages/fleet-runner/scripts/g6-new.test.mjs",
      ".claude/skills/bead/scripts/test_new.py",
      "scripts/launcher/tests/new.test.mjs",
      "scripts/__tests__/test_other.py",
    ]) {
      expect(unwired([f], [])).toEqual([]);
    }
  });

  it("fails when a runner no longer contains the text that makes it run every match", () => {
    const real = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), "utf8");
    expect(evidenceProblems(real)).toEqual([]);
    for (const { file, text } of [...RUNNERS, ...PREREQUISITES]) {
      const broken = (f) => (f === file ? real(f).replaceAll(text, "") : real(f));
      expect(evidenceProblems(broken).length, `${file}: ${text}`).toBeGreaterThan(0);
    }
  });

  it("fails when the launcher step or the root pnpm test step is deleted", () => {
    const real = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), "utf8");
    const ci = real(".github/workflows/ci.yml");
    expect(evidenceProblems(real)).toEqual([]);
    for (const drop of ["pnpm --filter @core/launcher-tests --fail-if-no-match test", "run: pnpm test\n"]) {
      const broken = (f) => (f === ".github/workflows/ci.yml" ? ci.replace(drop, "") : real(f));
      expect(evidenceProblems(broken).length, drop).toBeGreaterThan(0);
    }
  });

  it("knows the promote's kill sweeps and slow tests as test files that only their own CI step runs", () => {
    const includes = vitestIncludes(readFileSync(new URL("../../../vitest.config.ts", import.meta.url), "utf8"));
    for (const file of ["fleet-promote-decider.sweep_test.ts", "fleet-promote-recover.slow_test.ts"]) {
      const full = `packages/fleet-runner/src/__tests__/${file}`;
      expect(isTestFile(full), file).toBe(true);
      // Not in the root include list (so `pnpm test` does not run them) ...
      expect(includes.some((g) => path.posix.matchesGlob(full, g)), file).toBe(false);
      // ... and wired through their runner, as a new file of the kind beside them would be.
      expect(unwired([full, full.replace("fleet-promote-", "another-")], includes), file).toEqual([]);
    }
    // Their config really includes both kinds: without either line the check fails.
    const real = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), "utf8");
    const config = real("vitest.promote-sweeps.config.ts");
    for (const kind of ["sweep_test", "slow_test"]) {
      const without = (f) => (f === "vitest.promote-sweeps.config.ts" ? config.replace(`"packages/fleet-runner/src/__tests__/*.${kind}.ts"`, "") : real(f));
      expect(evidenceProblems(without).length, kind).toBeGreaterThan(0);
    }
  });

  it("fails when the promote sweeps' step is deleted, or its condition is replaced", () => {
    const real = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), "utf8");
    const ci = real(".github/workflows/ci.yml");
    expect(ci).toContain(PROMOTE_SWEEP_STEP);
    const withCi = (text) => (f) => (f === ".github/workflows/ci.yml" ? text : real(f));
    const run = "        run: pnpm exec vitest run --config vitest.promote-sweeps.config.ts\n";
    const condition = "if: steps.promote_sweeps.outputs.run != 'false'";
    const mutations = {
      "the step's run line deleted": ci.replace(run, ""),
      "the condition made always false": ci.replace(condition, "if: false"),
      "the condition made to need an explicit yes that the script's output is not": ci.replace(condition, "if: steps.promote_sweeps.outputs.run == 'yes'"),
      "the deciding step deleted": ci.replace("        run: bash scripts/fleet-runner/promote-sweeps-decision.sh\n", ""),
      "the deciding step's id renamed": ci.replace("id: promote_sweeps\n", "id: sweeps\n"),
    };
    for (const [what, text] of Object.entries(mutations)) {
      expect(text, what).not.toBe(ci);
      expect(evidenceProblems(withCi(text)).length, what).toBeGreaterThan(0);
    }
  });

  it("requires --fail-if-no-match on every pnpm --filter CI step", () => {
    const ci = readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8");
    expect(filterProblems(ci)).toEqual([]);
    expect(filterProblems("run: pnpm --filter @core/old test")).toHaveLength(1);
    expect(filterProblems("run: pnpm -F @core/old test")).toHaveLength(1);
  });

  it("names Python test files that discovery would skip or that run nothing", () => {
    const body = { "a/test_ok.py": "class T(unittest.TestCase):\n  pass\n", "a/test_x-y.py": "class T(unittest.TestCase):\n  pass\n", "a/test_fn.py": "def test_x():\n  assert True\n" };
    const read = (f) => body[f];
    const problems = pythonProblems(Object.keys(body), read);
    expect(problems).toHaveLength(2);
    expect(problems.join("\n")).toContain("a/test_x-y.py");
    expect(problems.join("\n")).toContain("a/test_fn.py");
  });

  it("passes on the real Python test files", () => {
    const files = [".claude/skills/bead/scripts/test_normalize.py", ".claude/skills/vault/scripts/test_lint_gate.py", ".claude/skills/vault/scripts/test_lint_stale.py", "scripts/__tests__/test_user_scope_install.py"];
    expect(pythonProblems(files, (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), "utf8"))).toEqual([]);
  });
});
