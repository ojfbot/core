// events.mjs — C3, the TPM measurement spine for the loading-discipline gate (ADR-0081 §Slice 2).
//
// Every tripwire firing appends one JSONL event. analyze.mjs turns these into the Technical
// Performance Measures (M3 gate precision, M5 judge reliability) that RIDM-gate the shadow→enforce
// promotion. `summarize` is a pure function over an event array so it's unit-testable.

import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

export function gateLogPath() {
  return process.env.CLAUDE_MD_GATE_LOG || join(homedir(), '.claude', 'claude-md-gate-telemetry.jsonl');
}

// Append one event. Best-effort: never throw into the hook path (a logging failure must not block edits).
export function logGateEvent(event, { logPath = gateLogPath(), now } = {}) {
  try {
    const ts = event.ts || (now ? now() : new Date().toISOString());
    const line = JSON.stringify({ ts, ...event }) + '\n';
    const dir = dirname(logPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(logPath, line);
    return true;
  } catch {
    return false;
  }
}

export function readEvents({ logPath = gateLogPath() } = {}) {
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

// Pure: compute the TPMs from an event array.
export function summarize(events) {
  const tripped = events.filter((e) => e.tripwire?.tripped);
  const judged = tripped.filter((e) => e.verdict);                       // judge actually ran
  const wouldFlag = judged.filter((e) => e.verdict?.isConditional);      // judge says "conditional → block"
  const blocked = events.filter((e) => e.action === 'block');
  const overridden = events.filter((e) => e.overridden === true);        // an enforce-mode block later reversed

  const rate = (n, d) => (d ? n / d : null);
  return {
    total: events.length,
    tripped: tripped.length,
    judged: judged.length,
    wouldFlag: wouldFlag.length,
    blocked: blocked.length,
    overridden: overridden.length,
    // M5 (judge reliability): in shadow, the would-flag rate among judged trips. Watch for noise.
    m5WouldFlagRate: rate(wouldFlag.length, judged.length),
    // M3 (gate precision): override rate among actual blocks. Needs enforce-mode data; null in pure shadow.
    m3OverrideRate: rate(overridden.length, blocked.length),
    nojudge: tripped.length - judged.length, // trips where the judge couldn't run (no key / error)
  };
}
