#!/usr/bin/env node
// Records one real Claude correspondence turn on Core's fixed qualification packet and writes its
// cut-down trace. Usage:
//
//   node <package>/scripts/qualify-claude-correspondence.mjs <plan.json> <approval.json> <out.trace.json>
//
// <plan.json> is a raw correspondence plan; its Claude version need not be allowlisted yet.
// <approval.json> is the owner's existing `owner-approved-correspondence-qualification` approval for
// that plan; a duty-window approval is refused. This script never writes an approval and refuses to
// run without a valid one. The turn goes through openCorrespondenceWindow's own path, transport and
// frame checker, in the qualification journal the approval names (one turn, separate from every
// duty journal). No HelpDesk data is read, and no duty listener is opened. The trace is written
// only to <out.trace.json>, with mode 0600.
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import {
  prepareCorrespondenceQualificationPlan,
  qualifyClaudeCorrespondence,
  writeCorrespondenceTrace,
} from "../dist/index.js";

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
const prepared = prepareCorrespondenceQualificationPlan(raw?.mode ? raw.plan : raw);
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
writeCorrespondenceTrace(output, result.traceText);
console.log(`version: ${result.nativeVersion}`);
console.log(`trace: ${output}`);
console.log(`sha256: ${result.traceSHA256}`);
console.log(
  `turn: ${result.disposition.kind}${result.turnRefusal ? ` (${result.turnRefusal})` : ""}`,
);
const accepted = result.verdict === "accepted";
console.log(`verdict: ${accepted ? "accepted" : `refused (${result.verdict.refused})`}`);
// The entry to add to src/correspondence-allowlist.ts, trace embedded, once the trace is committed.
if (result.allowlistEntry) console.log(`allowlist entry: ${JSON.stringify(result.allowlistEntry)}`);
process.exit(accepted ? 0 : 2);
