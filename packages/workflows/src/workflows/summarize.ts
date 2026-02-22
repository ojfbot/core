import fs from "node:fs/promises";
import path from "node:path";
import { callClaude } from "../llm.js";
import type { WorkflowSpec } from "../types.js";

export const summarizeWorkflow: WorkflowSpec = {
  name: "summarize",
  description: "Summarize a file or selected text using Claude",
  usage: [
    "/summarize [file-path] [--style=brief|detailed]",
    "",
    "Examples:",
    "  /summarize src/app.ts",
    "  /summarize src/app.ts --style=detailed",
    "  (in VS Code: run with text selected to summarize selection)",
  ].join("\n"),

  async handler({ args, ctx }) {
    const style = (args.flags.style as string | undefined) ?? "brief";

    let content: string | undefined;
    let source: string;

    if (ctx.selectedText) {
      content = ctx.selectedText;
      source = "selected text";
    } else if (args.positional[0]) {
      const filePath = path.resolve(ctx.cwd, args.positional[0]);
      try {
        content = await fs.readFile(filePath, "utf-8");
        source = args.positional[0];
      } catch {
        return `Error: could not read file "${args.positional[0]}"`;
      }
    } else if (ctx.activeFilePath) {
      try {
        content = await fs.readFile(ctx.activeFilePath, "utf-8");
        source = ctx.activeFilePath;
      } catch {
        return `Error: could not read active file "${ctx.activeFilePath}"`;
      }
    } else {
      return (
        "Error: no input provided.\n" +
        "Provide a file path, select text in VS Code, or have a file open.\n\n" +
        summarizeWorkflow.usage
      );
    }

    const system =
      "You are a senior software engineer. Summarize code and documents clearly and concisely.";

    const detailInstruction =
      style === "detailed"
        ? "Provide a detailed summary covering: purpose, key responsibilities, important functions/types, notable patterns, and any concerns."
        : "Provide a brief 2-4 sentence summary of what this code/content does.";

    const userPrompt = `Summarize the following (source: ${source}).\n\n${detailInstruction}\n\n\`\`\`\n${content}\n\`\`\``;

    return callClaude(system, userPrompt);
  },
};
