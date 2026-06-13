/**
 * gateEvent tests — the first consumer of the spine.
 *
 * One call: build the gate-event, emit it (honesty-enforced, op_id-idempotent),
 * then project the whole ledger onto the on-disk canvas. Dogfood: a `passed` flips
 * the matching slice node's color and writes an evidence-citing fence line.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { gateEvent } from '../tracking/gate-event.js';
import { EventLedger } from '../tracking/ledger.js';
import type { CanvasDoc } from '../tracking/types/canvas.js';

let tmpDir: string;
let canvasPath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tracking-gate-test-'));
  canvasPath = path.join(tmpDir, 'roadmap.canvas');
  const canvas: CanvasDoc = {
    nodes: [{ id: 's0', type: 'text', x: 0, y: 0, width: 320, height: 200, text: '## S0\nKEYSTONE' }],
    edges: [],
  };
  await fs.writeFile(canvasPath, JSON.stringify(canvas, null, '\t'));
});
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function readCanvas(): Promise<CanvasDoc> {
  return JSON.parse(await fs.readFile(canvasPath, 'utf8')) as CanvasDoc;
}

describe('gateEvent', () => {
  it('flips the slice node color and writes an evidence-citing fence (dogfood)', async () => {
    await gateEvent({
      program: 'opav-loop',
      slice: 's0',
      gate: 'C0',
      toState: 'passed',
      evidence: { scheme: 'pr', ref: '123' },
      ledgerRoot: tmpDir,
      canvasPath,
    });
    const node = (await readCanvas()).nodes[0];
    expect(node.color).toBe('5'); // passed -> cyan rollup
    expect(node.text).toMatch(/C0 · passed/);
    expect(node.text).toContain('pr:123');
    expect(node.text!.startsWith('## S0\nKEYSTONE')).toBe(true); // prose intact
  });

  it('rejects a passed transition with no evidence (honesty contract, nothing written)', async () => {
    await expect(
      gateEvent({ program: 'opav-loop', slice: 's0', gate: 'C0', toState: 'passed', ledgerRoot: tmpDir, canvasPath }),
    ).rejects.toThrow(/evidence/i);
    const ledger = new EventLedger('opav-loop', tmpDir);
    expect(await ledger.read()).toHaveLength(0);
  });

  it('is idempotent on a repeated identical transition (single ledger event)', async () => {
    const args = {
      program: 'opav-loop',
      slice: 's0',
      gate: 'C0',
      toState: 'validating' as const,
      ledgerRoot: tmpDir,
      canvasPath,
    };
    await gateEvent(args);
    await gateEvent(args);
    const ledger = new EventLedger('opav-loop', tmpDir);
    expect(await ledger.read()).toHaveLength(1);
  });
});
