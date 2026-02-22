import { describe, it, expect } from "vitest";

// parseCommand imports the registry which imports workflow files that import
// the Anthropic SDK. We mock the registry to avoid needing an API key in tests.
import { vi } from "vitest";

vi.mock("../registry.js", () => ({
  workflows: {
    summarize: {
      name: "summarize",
      description: "Summarize a file",
      usage: "/summarize [file]",
      handler: async () => "summary",
    },
    techdebt: {
      name: "techdebt",
      description: "Meta workflow",
      usage: "/techdebt --mode=propose",
      handler: async () => "proposal",
    },
  },
}));

const { parseSlashCommand } = await import("../parseCommand.js");

describe("parseSlashCommand", () => {
  it("returns unknown for empty string", () => {
    expect(parseSlashCommand("")).toEqual({ type: "unknown", raw: "" });
  });

  it("returns unknown when no leading slash", () => {
    expect(parseSlashCommand("summarize foo")).toEqual({
      type: "unknown",
      raw: "summarize foo",
    });
  });

  it("returns unknown for unregistered command", () => {
    expect(parseSlashCommand("/nonexistent")).toEqual({
      type: "unknown",
      raw: "/nonexistent",
    });
  });

  it("parses a known command with no args", () => {
    const result = parseSlashCommand("/summarize");
    expect(result.type).toBe("workflow");
    if (result.type !== "workflow") return;
    expect(result.workflow.name).toBe("summarize");
    expect(result.args.positional).toEqual([]);
    expect(result.args.flags).toEqual({});
  });

  it("parses positional arguments", () => {
    const result = parseSlashCommand("/summarize src/app.ts");
    expect(result.type).toBe("workflow");
    if (result.type !== "workflow") return;
    expect(result.args.positional).toEqual(["src/app.ts"]);
  });

  it("parses --flag=value", () => {
    const result = parseSlashCommand("/summarize src/app.ts --style=detailed");
    expect(result.type).toBe("workflow");
    if (result.type !== "workflow") return;
    expect(result.args.flags.style).toBe("detailed");
    expect(result.args.positional).toEqual(["src/app.ts"]);
  });

  it("parses boolean --flag (no value)", () => {
    const result = parseSlashCommand("/techdebt --dryRun");
    expect(result.type).toBe("workflow");
    if (result.type !== "workflow") return;
    expect(result.args.flags.dryRun).toBe(true);
  });

  it("parses multiple flags", () => {
    const result = parseSlashCommand("/techdebt --mode=propose --includeDomainContext");
    expect(result.type).toBe("workflow");
    if (result.type !== "workflow") return;
    expect(result.args.flags.mode).toBe("propose");
    expect(result.args.flags.includeDomainContext).toBe(true);
  });

  it("trims leading/trailing whitespace", () => {
    const result = parseSlashCommand("  /summarize src/app.ts  ");
    expect(result.type).toBe("workflow");
  });
});
