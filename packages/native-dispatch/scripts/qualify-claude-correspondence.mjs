#!/usr/bin/env node
// Records one real Claude correspondence turn on Core's fixed qualification packet and writes its
// cut-down trace. Usage:
//
//   node <package>/scripts/qualify-claude-correspondence.mjs <plan.json> <approval.json> <out.trace.json>
//
// <plan.json> is a raw or prepared correspondence plan. <approval.json> is the owner's existing
// runtime approval for that plan's window; this script never writes an approval and refuses to run
// without a valid one. The turn goes through openCorrespondenceWindow's own path, transport and
// frame checker, and is journaled (and counted) in the approval's invocation journal. No HelpDesk
// data is read, and no duty listener is opened.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { prepareCorrespondencePlan, qualifyClaudeCorrespondence } from "../dist/index.js";

const [planFile, approvalFile, outputFile] = process.argv.slice(2);
if (!planFile || !approvalFile || !outputFile || process.argv.length !== 5) {
  console.error(
    "usage: qualify-claude-correspondence.mjs <plan.json> <approval.json> <out.trace.json>",
  );
  process.exit(64);
}
const output = resolve(outputFile);
if (existsSync(output) || !existsSync(dirname(output))) {
  console.error(`refused: ${output} already exists, or its folder does not`);
  process.exit(1);
}
const raw = JSON.parse(readFileSync(planFile, "utf8"));
const prepared = raw?.mode === "correspondence-prepared" ? raw : prepareCorrespondencePlan(raw);
const result = await qualifyClaudeCorrespondence({
  prepared,
  runtimeApprovalFile: isAbsolute(approvalFile) ? approvalFile : resolve(approvalFile),
  deviceId: prepared.plan.deviceId,
});
if (result.kind === "held") {
  console.log(`held: ${result.holds.join(", ")}`);
  process.exit(1);
}
if (result.kind === "not-run") {
  console.log(`not run: ${JSON.stringify(result.disposition)}`);
  process.exit(1);
}
writeFileSync(output, result.traceText, { flag: "wx", mode: 0o644 });
console.log(`version: ${result.nativeVersion}`);
console.log(`trace: ${output}`);
console.log(`sha256: ${result.traceSHA256}`);
console.log(
  `turn: ${result.disposition.kind}${result.turnRefusal ? ` (${result.turnRefusal})` : ""}`,
);
const accepted = result.verdict === "accepted";
console.log(`verdict: ${accepted ? "accepted" : `refused (${result.verdict.refused})`}`);
process.exit(accepted ? 0 : 2);
