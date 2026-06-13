/**
 * Replay integration — the ledger is the single source; the canvas is reproducible.
 *
 * Proof (brief #1): projecting replay(ledger) reproduces the owned region exactly,
 * regardless of what the canvas's owned region held before — a stale or divergent
 * fence is overwritten to match the ledger. This is what makes the canvas
 * un-rottable: it is derived, never authored.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { EventLedger } from '../tracking/ledger.js';
import { eventEmit } from '../tracking/emit.js';
import { projectCanvas } from '../tracking/projector.js';
import type { CanvasDoc } from '../tracking/types/canvas.js';
import type { TrackingEvent, GateState } from '../tracking/types/tracking-event.js';

let tmpDir: string;
let opSeq = 0;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tracking-replay-test-'));
  opSeq = 0;
});
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function gate(slice: string, g: string, to_state: GateState, ev?: string): TrackingEvent {
  return {
    event_type: 'gate-event',
    op_id: `op-${opSeq++}`,
    correlation_id: `opav-loop/${slice}/${g}`,
    ts: '2026-06-13T00:00:00.000Z',
    actor: 'code-claude',
    to_state,
    evidence_ref: ev ? { scheme: 'pr', ref: ev } : null,
  };
}

const cleanCanvas = (): CanvasDoc => ({
  nodes: [{ id: 's0', type: 'text', x: 0, y: 0, width: 320, height: 200, text: '## S0\nprose' }],
  edges: [],
});

describe('replay reproduces the canvas exactly', () => {
  it('a fresh projection from the ledger equals a projection over a divergent canvas', async () => {
    const ledger = new EventLedger('opav-loop', tmpDir);
    await eventEmit(ledger, gate('s0', 'C0', 'passed', '1'));
    await eventEmit(ledger, gate('s0', 'C1', 'validating'));

    // Live canvas: project onto a clean canvas.
    const live = projectCanvas(await ledger.read(), cleanCanvas());

    // A canvas someone hand-tampered with a stale/wrong fence.
    const tampered = cleanCanvas();
    tampered.nodes[0].text = '## S0\nprose\n<!--gate-status-->\n- C0 · delivered ★ — evidence: pr:FAKE\n<!--/gate-status-->';
    tampered.nodes[0].color = '4';

    // Replaying the ledger over the tampered canvas reproduces the live owned region exactly.
    const replayed = projectCanvas(await ledger.read(), tampered);
    expect(replayed.nodes[0].text).toBe(live.nodes[0].text);
    expect(replayed.nodes[0].color).toBe(live.nodes[0].color);
  });
});
