import fs from "node:fs/promises";
import path from "node:path";
import { callClaude } from "./llm.js";
import type { WorkflowSpec } from "./types.js";

const SYSTEM_PROMPT =
  "You are an expert software engineering assistant. Follow the instructions in the user message precisely. Be specific, concrete, and technical.";

/**
 * Creates a WorkflowSpec whose prompt is loaded from a `.claude/skills/<name>/SKILL.md` file.
 * `$ARGUMENTS` in the markdown is replaced with the joined positional args + flags.
 *
 * Each skill is a directory: `.claude/skills/<name>/`
 *   ├── SKILL.md         ← concise orchestration skeleton (loaded into context)
 *   ├── knowledge/       ← deep reference material, loaded just-in-time by the agent
 *   └── scripts/         ← deterministic utilities, executed without loading into context
 *
 * `SKILL.md` is the canonical skill body (ADR-0084) — the same file the Claude Code Skill
 * tool discovers, so every skill is both `/name`- and `Skill(name)`-callable from a single
 * source of truth. The legacy `<name>.md` filename is read as a fallback for unmigrated skills.
 * A backward-compat symlink `.claude/commands → skills/` is maintained for legacy tooling.
 */
export function fileBackedWorkflow(
  name: string,
  description: string,
  commandsDir?: string
): WorkflowSpec {
  return {
    name,
    description,
    usage: `/${name} <arguments>  (prompt loaded from .claude/skills/${name}/SKILL.md)`,

    async handler({ args, ctx }) {
      const dir = commandsDir ?? path.join(ctx.cwd, ".claude", "skills");
      const skillPath = path.join(dir, name, "SKILL.md");
      const legacyPath = path.join(dir, name, `${name}.md`);

      let template: string;
      try {
        template = await fs.readFile(skillPath, "utf-8");
      } catch {
        // Fallback: skills not yet migrated to SKILL.md (ADR-0084)
        try {
          template = await fs.readFile(legacyPath, "utf-8");
        } catch {
          return `Error: skill file not found at ${skillPath} (or legacy ${legacyPath})`;
        }
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
