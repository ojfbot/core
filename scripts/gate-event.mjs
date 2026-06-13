#!/usr/bin/env node
// gate-event.mjs — emit a deliverable gate-transition onto the tracking spine.
//
// The runnable, explicit write path for adr:deliverable-tracking-spine. Emit-not-magic:
// a semantic gate pass has no Claude Code tool event, so the slice lifecycle
// (/gated-slice, /validate, /tdd) calls THIS at each transition. It emits through the
// one eventEmit (honesty-enforced, op_id-idempotent) and re-projects the canvas from
// the full ledger. The reconciler hook only audits — it never writes.
//
// Usage:
//   node scripts/gate-event.mjs <program> <slice> <gate> <to_state> [--evidence=scheme:ref] \
//        [--canvas=PATH] [--ledger-root=DIR] [--actor=NAME]
//
// Examples:
//   node scripts/gate-event.mjs opav-loop s0 C0 entered
//   node scripts/gate-event.mjs opav-loop s0 C0 validating
//   node scripts/gate-event.mjs opav-loop s0 C0 passed --evidence=pr:151
//
// to_state ∈ entered | validating | passed | failed | delivered
// passed/delivered REQUIRE --evidence (path:… must exist on disk; pr/tpm/test accepted as-is).

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const expand = (p) => (p && p.startsWith('~') ? p.replace('~', homedir()) : p);

const positional = [];
const flags = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] ?? true;
  else positional.push(a);
}
const [program, slice, gate, toState] = positional;
if (!program || !slice || !gate || !toState) {
  console.error('usage: gate-event.mjs <program> <slice> <gate> <to_state> [--evidence=scheme:ref] [--canvas=PATH] [--ledger-root=DIR] [--actor=NAME]');
  process.exit(2);
}

let evidence;
if (flags.evidence) {
  const idx = String(flags.evidence).indexOf(':');
  if (idx === -1) {
    console.error(`--evidence must be scheme:ref (path|pr|tpm|test), got "${flags.evidence}"`);
    process.exit(2);
  }
  evidence = { scheme: String(flags.evidence).slice(0, idx), ref: String(flags.evidence).slice(idx + 1) };
}

let gateEvent;
try {
  const dist = pathToFileURL(resolve(HERE, '../packages/workflows/dist/tracking')).href;
  ({ gateEvent } = await import(`${dist}/gate-event.js`));
} catch {
  console.error('[gate-event] workflows build not found — run `pnpm --filter @core/workflows build` first.');
  process.exit(1);
}

const canvasPath = expand(flags.canvas ?? '~/selfco/canvas/opav-loop-roadmap.canvas');
const ledgerRoot = expand(flags['ledger-root'] ?? '~/selfco/tracking');

try {
  const { event, canvasUpdated } = await gateEvent({
    program,
    slice,
    gate,
    toState,
    ...(evidence ? { evidence } : {}),
    ...(flags.actor ? { actor: String(flags.actor) } : {}),
    ledgerRoot,
    ...(existsSync(canvasPath) ? { canvasPath } : {}),
  });
  console.error(`[gate-event] emitted ${event.event_type} ${toState} → ${event.correlation_id}` + (canvasUpdated ? ` (canvas projected: ${canvasPath})` : ' (ledger only — canvas not found)'));
} catch (err) {
  console.error(`[gate-event] REJECTED — ${err.message}`);
  process.exit(1);
}
