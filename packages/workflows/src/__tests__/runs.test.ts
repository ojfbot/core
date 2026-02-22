import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { writeRun } from "../utils/runs.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ojf-runs-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("writeRun", () => {
  it("creates runs/<workflow>/<timestamp>[-<slug>]/ directory", async () => {
    const runDir = await writeRun(tmpDir, {
      workflow: "summarize",
      timestamp: new Date().toISOString(),
      durationMs: 123,
      args: { positional: ["src/app.ts"], flags: {} },
      cwd: tmpDir,
    }, "## Summary\nThis is the output.");

    expect(runDir).toContain(path.join(tmpDir, "runs", "summarize"));

    const dirName = path.basename(runDir);
    expect(dirName).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}-app$/);
  });

  it("uses --mode flag as slug when present", async () => {
    const runDir = await writeRun(tmpDir, {
      workflow: "techdebt",
      timestamp: new Date().toISOString(),
      durationMs: 50,
      args: { positional: [], flags: { mode: "propose" } },
      cwd: tmpDir,
    }, "proposal output");

    expect(path.basename(runDir)).toMatch(/propose$/);
  });

  it("omits slug when no args", async () => {
    const runDir = await writeRun(tmpDir, {
      workflow: "sweep",
      timestamp: new Date().toISOString(),
      durationMs: 10,
      args: { positional: [], flags: {} },
      cwd: tmpDir,
    }, "sweep output");

    // dirName should be timestamp only: YYYY-MM-DD-HHmmss
    expect(path.basename(runDir)).toMatch(/^\d{4}-\d{2}-\d{2}-\d{6}$/);
  });

  it("writes output.md and run.json", async () => {
    const output = "# Result\nSome content here.";
    const runDir = await writeRun(tmpDir, {
      workflow: "validate",
      timestamp: new Date().toISOString(),
      durationMs: 200,
      args: { positional: ["src/auth.ts"], flags: {} },
      cwd: tmpDir,
    }, output);

    const outputMd = await fs.readFile(path.join(runDir, "output.md"), "utf-8");
    expect(outputMd).toBe(output);

    const runJson = JSON.parse(
      await fs.readFile(path.join(runDir, "run.json"), "utf-8")
    );
    expect(runJson.workflow).toBe("validate");
    expect(runJson.durationMs).toBe(200);
    expect(runJson.runDir).toBe(runDir);
  });

  it("sanitizes special characters in slug", async () => {
    const runDir = await writeRun(tmpDir, {
      workflow: "plan-feature",
      timestamp: new Date().toISOString(),
      durationMs: 5,
      args: { positional: ["Add user auth (v2)!"], flags: {} },
      cwd: tmpDir,
    }, "output");

    const dirName = path.basename(runDir);
    // slug part should be clean
    expect(dirName).toMatch(/add-user-auth-v2$/);
  });
});
