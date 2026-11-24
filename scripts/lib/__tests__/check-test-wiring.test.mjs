import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evidenceProblems, isTestFile, PREREQUISITES, RUNNERS, unwired, vitestIncludes } from "../../check-test-wiring.mjs";

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
});
