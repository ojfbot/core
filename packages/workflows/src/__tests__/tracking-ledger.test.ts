/**
 * EventLedger tests — deliverable-tracking spine.
 *
 * The append-only JSONL ledger is the source of truth. Append is idempotent
 * on op_id (the dedup key for retries and reconciler double-writes).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { EventLedger } from '../tracking/ledger.js';
import type { TrackingEvent } from '../tracking/types/tracking-event.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tracking-ledger-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function gateEvt(op_id: string, to_state: TrackingEvent['to_state'] = 'entered'): TrackingEvent {
  return {
    event_type: 'gate-event',
    op_id,
    correlation_id: 'opav-loop/s0/C0',
    ts: '2026-06-13T00:00:00.000Z',
    actor: 'code-claude',
    to_state,
    evidence_ref: null,
  };
}

describe('EventLedger.append', () => {
  it('writes one JSONL line per appended event', async () => {
    const ledger = new EventLedger('opav-loop', tmpDir);
    await ledger.append(gateEvt('op-1'));
    await ledger.append(gateEvt('op-2', 'validating'));

    const events = await ledger.read();
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.op_id)).toEqual(['op-1', 'op-2']);
  });

  it('is a no-op when an event with an existing op_id is appended again', async () => {
    const ledger = new EventLedger('opav-loop', tmpDir);
    await ledger.append(gateEvt('op-1'));
    await ledger.append(gateEvt('op-1', 'validating')); // same op_id, different body

    const events = await ledger.read();
    expect(events).toHaveLength(1);
    expect(events[0].to_state).toBe('entered'); // first write wins; second never lands
  });
});
