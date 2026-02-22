import { parseSlashCommand } from "./parseCommand.js";
import { workflows } from "./registry.js";
import { writeRun } from "./utils/runs.js";
import type { WorkflowContext } from "./types.js";

export async function runWorkflow(
  raw: string,
  ctx: WorkflowContext
): Promise<string> {
  const parsed = parseSlashCommand(raw);

  if (parsed.type === "unknown") {
    const available = Object.values(workflows)
      .map((w) => `  /${w.name.padEnd(12)} — ${w.description}`)
      .join("\n");

    if (!raw.trim()) {
      return `Available commands:\n${available}`;
    }

    return (
      `Unknown command: "${raw.trim()}"\n\n` +
      `Available commands:\n${available}`
    );
  }

  const start = Date.now();
  const output = await parsed.workflow.handler({ args: parsed.args, ctx });
  const durationMs = Date.now() - start;

  const runDir = await writeRun(ctx.cwd, {
    workflow: parsed.workflow.name,
    timestamp: new Date().toISOString(),
    durationMs,
    args: parsed.args,
    cwd: ctx.cwd,
  }, output);

  return `${output}\n\n---\n_Run saved to: ${runDir}_`;
}
