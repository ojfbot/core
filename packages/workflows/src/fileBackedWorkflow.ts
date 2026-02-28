import fs from "node:fs/promises";
import path from "node:path";
import { callClaude } from "./llm.js";
import type { WorkflowSpec } from "./types.js";

const SYSTEM_PROMPT =
  "You are an expert software engineering assistant. Follow the instructions in the user message precisely. Be specific, concrete, and technical.";

/**
 * Creates a WorkflowSpec whose prompt is loaded from a `.claude/commands/<name>/<name>.md` file.
 * `$ARGUMENTS` in the markdown is replaced with the joined positional args + flags.
 *
 * Each command is a skill directory: `.claude/commands/<name>/`
 *   ├── <name>.md        ← concise orchestration skeleton (loaded into context)
 *   ├── knowledge/       ← deep reference material, loaded just-in-time by the agent
 *   └── scripts/         ← deterministic utilities, executed without loading into context
 *
 * This keeps `.claude/commands/` as the single source of truth for both
 * Claude Code slash commands and the programmatic core-workflow CLI.
 */
export function fileBackedWorkflow(
  name: string,
  description: string,
  commandsDir?: string
): WorkflowSpec {
  return {
    name,
    description,
    usage: `/${name} <arguments>  (prompt loaded from .claude/commands/${name}/${name}.md)`,

    async handler({ args, ctx }) {
      const dir = commandsDir ?? path.join(ctx.cwd, ".claude", "commands");
      const mdPath = path.join(dir, name, `${name}.md`);

      let template: string;
      try {
        template = await fs.readFile(mdPath, "utf-8");
      } catch {
        return `Error: command file not found at ${mdPath}`;
      }

      // Reconstruct $ARGUMENTS from parsed args
      const argParts = [
        ...args.positional,
        ...Object.entries(args.flags).map(([k, v]) =>
          v === true ? `--${k}` : `--${k}=${v}`
        ),
      ];
      // Also include selectedText or activeFilePath as context if present
      const contextParts: string[] = [];
      if (ctx.selectedText) {
        contextParts.push(`Selected text:\n\`\`\`\n${ctx.selectedText}\n\`\`\``);
      }
      if (ctx.activeFilePath && !args.positional.includes(ctx.activeFilePath)) {
        contextParts.push(`Active file: ${ctx.activeFilePath}`);
      }

      const argumentsStr = [...argParts, ...contextParts].join("\n");
      const userPrompt = template.replace(/\$ARGUMENTS/g, argumentsStr);

      return callClaude(SYSTEM_PROMPT, userPrompt);
    },
  };
}
