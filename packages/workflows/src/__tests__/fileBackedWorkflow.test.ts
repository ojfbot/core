import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Echo the user prompt back so we can assert which template was loaded
// and that $ARGUMENTS was substituted.
vi.mock("../llm.js", () => ({
  callClaude: vi.fn((_system: string, user: string) => Promise.resolve(user)),
}));

import { fileBackedWorkflow } from "../fileBackedWorkflow.js";

let skillsDir: string;

beforeEach(async () => {
  skillsDir = await fs.mkdtemp(path.join(os.tmpdir(), "ojf-fbw-test-"));
});

afterEach(async () => {
  await fs.rm(skillsDir, { recursive: true, force: true });
});

async function writeSkill(name: string, file: string, body: string) {
  const dir = path.join(skillsDir, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, file), body, "utf-8");
}

const ctx = { cwd: "/unused" };
const noArgs = { positional: [] as string[], flags: {} as Record<string, string | true> };

describe("fileBackedWorkflow file resolution (ADR-0084)", () => {
  it("loads SKILL.md as the canonical skill body", async () => {
    await writeSkill("demo", "SKILL.md", "Body from SKILL.md. Args: $ARGUMENTS");
    const spec = fileBackedWorkflow("demo", "desc", skillsDir);

    const out = await spec.handler({
      args: { positional: ["x"], flags: { mode: "go" } },
      ctx,
    } as never);

    expect(out).toContain("Body from SKILL.md");
    expect(out).toContain("x");
    expect(out).toContain("--mode=go");
  });

  it("prefers SKILL.md over the legacy <name>.md when both exist", async () => {
    await writeSkill("demo", "SKILL.md", "canonical");
    await writeSkill("demo", "demo.md", "legacy");
    const spec = fileBackedWorkflow("demo", "desc", skillsDir);

    const out = await spec.handler({ args: noArgs, ctx } as never);
    expect(out).toBe("canonical");
  });

  it("falls back to the legacy <name>.md when SKILL.md is absent", async () => {
    await writeSkill("legacy-only", "legacy-only.md", "legacy body $ARGUMENTS");
    const spec = fileBackedWorkflow("legacy-only", "desc", skillsDir);

    const out = await spec.handler({ args: noArgs, ctx } as never);
    expect(out).toContain("legacy body");
  });

  it("returns an error mentioning both paths when neither file exists", async () => {
    const spec = fileBackedWorkflow("missing", "desc", skillsDir);
    const out = await spec.handler({ args: noArgs, ctx } as never);
    expect(out).toContain("skill file not found");
    expect(out).toContain("SKILL.md");
    expect(out).toContain("missing.md");
  });
});
