#!/usr/bin/env node
import { runWorkflow } from "@core/workflows";

async function main(): Promise<void> {
  // Support: core-workflow "/summarize src/app.ts --style=detailed"
  // or: core-workflow /summarize src/app.ts --style=detailed  (unquoted)
  const raw = process.argv.slice(2).join(" ").trim();

  if (!raw || raw === "--help" || raw === "-h") {
    const { workflows } = await import("@core/workflows");
    const list = Object.values(workflows)
      .map((w) => `  /${w.name.padEnd(12)} — ${w.description}`)
      .join("\n");
    console.log(`core-workflow — OJF slash-command workflow runner\n\nUsage:\n  core-workflow "<slash command>"\n\nAvailable commands:\n${list}\n\nExamples:\n  core-workflow "/summarize src/app.ts"\n  core-workflow "/techdebt --mode=propose --incident='{...}'"\n  core-workflow "/techdebt --mode=apply --proposal='{...}' --dryRun"`);
    process.exit(0);
  }

  try {
    const result = await runWorkflow(raw, { cwd: process.cwd() });
    console.log(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
