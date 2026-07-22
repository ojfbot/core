#!/usr/bin/env node
/**
 * dispatch-emit.mjs — dispatch-channel telemetry for the brief-injection experiment
 * (adr:pocock-lifecycle-absorption; consumed by scripts/skill-metrics.mjs --funnel=dispatch).
 *
 * Dispatched sessions (day-run slices, orchestrate Layer-3 workers) have no interactive
 * suggestion stream, so their skill engagement is invisible to the disposition ledger.
 * OPAV emit-not-magic doctrine: a semantic event with no tool signal gets an explicit emit.
 *
 * Usage:
 *   node scripts/dispatch-emit.mjs session-start --kind=<day-run|orchestrate-l3> --ref=<slice/task ref>
 *   node scripts/dispatch-emit.mjs skill-used   --kind=<...> --ref=<...> --skill=<tdd|code-review|...> --evidence=<scheme:ref>
 *
 * Honesty contract (same as gate-event.mjs): `skill-used` with no --evidence is rejected,
 * nothing written. Evidence is a scheme:ref (path:..., test:..., pr:...) a reviewer can resolve.
 * Ledger: ~/selfco/tracking/dispatch-sessions.jsonl (append-only).
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const LEDGER = path.join(homedir(), "selfco", "tracking", "dispatch-sessions.jsonl");

const [verb, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(
  rest.filter((a) => a.startsWith("--")).map((a) => {
    const i = a.indexOf("=");
    return i === -1 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
  }),
);

function die(msg) {
  console.error(`[dispatch-emit] REJECTED: ${msg}`);
  process.exit(1);
}

if (verb !== "session-start" && verb !== "skill-used") {
  die(`unknown verb '${verb ?? ""}' — expected session-start | skill-used`);
}
if (!args.kind || !["day-run", "orchestrate-l3"].includes(args.kind)) {
  die(`--kind must be day-run | orchestrate-l3 (got '${args.kind ?? ""}')`);
}
if (!args.ref) die("--ref is required (the slice/task ref this session was dispatched for)");
if (verb === "skill-used") {
  if (!args.skill) die("--skill is required for skill-used");
  if (!args.evidence || !/^[a-z]+:.+/.test(String(args.evidence))) {
    die("skill-used requires --evidence=<scheme:ref> (path:… | test:… | pr:…) — no evidence, nothing written");
  }
}

const record = {
  ts: new Date().toISOString(),
  event: `dispatch:${verb}`,
  kind: args.kind,
  ref: String(args.ref),
  ...(verb === "skill-used" ? { skill: String(args.skill), evidence: String(args.evidence) } : {}),
  session_id: process.env.CLAUDE_SESSION_ID ?? null,
};

mkdirSync(path.dirname(LEDGER), { recursive: true });
appendFileSync(LEDGER, JSON.stringify(record) + "\n");
console.log(`[dispatch-emit] ${record.event} ${record.kind} ${record.ref}${record.skill ? ` skill=${record.skill}` : ""} → ${LEDGER}`);
