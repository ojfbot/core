#!/usr/bin/env node
import { runWorkflow } from "@ojf/workflows";

async function main(): Promise<void> {
  // Support: ojf-workflow "/summarize src/app.ts --style=detailed"
  // or: ojf-workflow /summarize src/app.ts --style=detailed  (unquoted)
  const raw = process.argv.slice(2).join(" ").trim();

  if (!raw || raw === "--help" || raw === "-h") {
    const { workflows } = await import("@ojf/workflows");
    const list = Object.values(workflows)
      .map((w) => `  /${w.name.padEnd(12)} — ${w.description}`)
      .join("\n");
    console.log(`ojf-workflow — OJF slash-command workflow runner\n\nUsage:\n  ojf-workflow "<slash command>"\n\nAvailable commands:\n${list}\n\nExamples:\n  ojf-workflow "/summarize src/app.ts"\n  ojf-workflow "/techdebt --mode=propose --incident='{...}'"\n  ojf-workflow "/techdebt --mode=apply --proposal='{...}' --dryRun"`);
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
