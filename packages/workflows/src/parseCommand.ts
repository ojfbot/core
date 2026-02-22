import { workflows } from "./registry.js";
import type { WorkflowArgs, WorkflowSpec } from "./types.js";

export type ParsedCommand =
  | { type: "workflow"; workflow: WorkflowSpec; args: WorkflowArgs }
  | { type: "unknown"; raw: string };

export function parseSlashCommand(raw: string): ParsedCommand {
  const trimmed = raw.trim();

  if (!trimmed.startsWith("/")) {
    return { type: "unknown", raw };
  }

  const tokens = trimmed.slice(1).split(/\s+/);
  const [name, ...rest] = tokens;

  const workflow = workflows[name];
  if (!workflow) {
    return { type: "unknown", raw };
  }

  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (const token of rest) {
    if (token.startsWith("--")) {
      const eqIdx = token.indexOf("=");
      if (eqIdx === -1) {
        const key = token.slice(2);
        flags[key] = true;
      } else {
        const key = token.slice(2, eqIdx);
        const value = token.slice(eqIdx + 1);
        flags[key] = value;
      }
    } else {
      positional.push(token);
    }
  }

  return {
    type: "workflow",
    workflow,
    args: { positional, flags },
  };
}
