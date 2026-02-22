import { describe, it, expect } from "vitest";
import { applyUnifiedDiff } from "../utils/diff.js";

describe("applyUnifiedDiff", () => {
  it("returns original when diff is empty", () => {
    const original = "line1\nline2\nline3";
    expect(applyUnifiedDiff(original, "")).toBe(original);
  });

  it("adds a line", () => {
    const original = "line1\nline3";
    const diff = [
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,2 +1,3 @@",
      " line1",
      "+line2",
      " line3",
    ].join("\n");

    const result = applyUnifiedDiff(original, diff);
    expect(result).toBe("line1\nline2\nline3");
  });

  it("removes a line", () => {
    const original = "line1\nline2\nline3";
    const diff = [
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,3 +1,2 @@",
      " line1",
      "-line2",
      " line3",
    ].join("\n");

    const result = applyUnifiedDiff(original, diff);
    expect(result).toBe("line1\nline3");
  });

  it("replaces a line", () => {
    const original = "line1\nold line\nline3";
    const diff = [
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,3 +1,3 @@",
      " line1",
      "-old line",
      "+new line",
      " line3",
    ].join("\n");

    const result = applyUnifiedDiff(original, diff);
    expect(result).toBe("line1\nnew line\nline3");
  });

  it("handles creating content for empty original", () => {
    const original = "";
    const diff = [
      "--- /dev/null",
      "+++ b/new-file.ts",
      "@@ -0,0 +1,2 @@",
      "+first line",
      "+second line",
    ].join("\n");

    const result = applyUnifiedDiff(original, diff);
    expect(result).toContain("first line");
    expect(result).toContain("second line");
  });
});
