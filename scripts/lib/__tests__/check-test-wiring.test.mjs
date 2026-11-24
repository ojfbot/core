import { describe, expect, it } from "vitest";
import { isTestFile, unwired, vitestIncludes } from "../../check-test-wiring.mjs";

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
});
