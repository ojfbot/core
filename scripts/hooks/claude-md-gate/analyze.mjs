#!/usr/bin/env node
// analyze.mjs — C3 CLI. Reads the gate TPM log and prints M3/M5 (ADR-0081 §Slice 2).
// Usage: node analyze.mjs [--json] [--log <path>]
import { readEvents, summarize, gateLogPath } from './events.mjs';

const args = process.argv.slice(2);
const jsonOnly = args.includes('--json');
const logIdx = args.indexOf('--log');
const logPath = logIdx >= 0 ? args[logIdx + 1] : gateLogPath();

const events = readEvents({ logPath });
const s = summarize(events);

if (jsonOnly) {
  console.log(JSON.stringify({ logPath, ...s }, null, 2));
} else {
  const pct = (r) => (r == null ? 'n/a (needs enforce data)' : `${(r * 100).toFixed(1)}%`);
  console.log(`\nCLAUDE.md gate TPMs (ADR-0081 Slice 2) — ${logPath}\n`);
  console.log(`  events logged ............ ${s.total}`);
  console.log(`  tripwire fired ........... ${s.tripped}  (judge ran on ${s.judged}, no-judge ${s.nojudge})`);
  console.log(`  judge would-flag ......... ${s.wouldFlag}`);
  console.log(`  blocked (enforce) ........ ${s.blocked}  (overridden ${s.overridden})`);
  console.log('');
  console.log(`  M5 judge would-flag rate . ${pct(s.m5WouldFlagRate)}   (shadow proxy; watch for noise)`);
  console.log(`  M3 gate override rate .... ${pct(s.m3OverrideRate)}   (target < 30% before promoting to enforce)`);
  console.log('\n  Promotion to enforce is RIDM-gated on M3 < 30% and low/stable M5 over ~4 weeks of shadow.\n');
}
