/**
 * eventEmit tests — the single write path + the honesty contract.
 *
 * No `passed`/`delivered` without a resolvable, independent evidence_ref.
 * One contract, reused by gate-event and (later) skill:acted.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { EventLedger } from '../tracking/ledger.js';
import { eventEmit } from '../tracking/emit.js';
import type { TrackingEvent, GateState } from '../tracking/types/tracking-event.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tracking-emit-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function evt(to_state: GateState, evidence_ref: TrackingEvent['evidence_ref'], op_id = 'op-1'): TrackingEvent {
  return {
    event_type: 'gate-event',
    op_id,
    correlation_id: 'opav-loop/s0/C0',
    ts: '2026-06-13T00:00:00.000Z',
    actor: 'code-claude',
    to_state,
    evidence_ref,
  };
}

describe('eventEmit honesty contract', () => {
  it('rejects a passed event with no evidence_ref (and appends nothing)', async () => {
    const ledger = new EventLedger('opav-loop', tmpDir);
    await expect(eventEmit(ledger, evt('passed', null))).rejects.toThrow(/evidence/i);
    expect(await ledger.read()).toHaveLength(0);
  });

  it('rejects a delivered event whose path evidence does not resolve', async () => {
    const ledger = new EventLedger('opav-loop', tmpDir);
    const ref = { scheme: 'path' as const, ref: path.join(tmpDir, 'nope.txt') };
    await expect(eventEmit(ledger, evt('delivered', ref))).rejects.toThrow(/resolve|exist/i);
    expect(await ledger.read()).toHaveLength(0);
  });

  it('accepts a passed event whose path evidence resolves on disk', async () => {
    const ledger = new EventLedger('opav-loop', tmpDir);
    const proof = path.join(tmpDir, 'proof.txt');
    await fs.writeFile(proof, 'test output');
    await eventEmit(ledger, evt('passed', { scheme: 'path', ref: proof }));
    expect(await ledger.read()).toHaveLength(1);
  });

  it('accepts a pr-scheme evidence_ref without touching the disk', async () => {
    const ledger = new EventLedger('opav-loop', tmpDir);
    await eventEmit(ledger, evt('passed', { scheme: 'pr', ref: '123' }));
    expect(await ledger.read()).toHaveLength(1);
  });

  it('allows entered/validating/failed with no evidence_ref', async () => {
    const ledger = new EventLedger('opav-loop', tmpDir);
    await eventEmit(ledger, evt('entered', null, 'op-a'));
    await eventEmit(ledger, evt('validating', null, 'op-b'));
    await eventEmit(ledger, evt('failed', null, 'op-c'));
    expect(await ledger.read()).toHaveLength(3);
  });
});
