/**
 * Reconciler tests — the hook target, SHADOW-first (observe + alarm, no auto-repair).
 *
 * Three audits: (a) canvas owned-region == ledger-derived (divergence); (b) every
 * current passed/delivered carries a resolvable evidence_ref (honesty); (c) gates
 * stuck in `validating` past an SLA (staleness). Auto-repair is action-taking, so it
 * stays OFF — reconcile WRITES NOTHING; it returns findings + a proposed canvas only.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { reconcile } from '../tracking/reconciler.js';
import { projectCanvas } from '../tracking/projector.js';
import type { CanvasDoc } from '../tracking/types/canvas.js';
import type { TrackingEvent, GateState } from '../tracking/types/tracking-event.js';

let opSeq = 0;
function gate(slice: string, g: string, to_state: GateState, opts: { ev?: string; ts?: string } = {}): TrackingEvent {
  return {
    event_type: 'gate-event',
    op_id: `op-${opSeq++}`,
    correlation_id: `opav-loop/${slice}/${g}`,
    ts: opts.ts ?? '2026-06-13T00:00:00.000Z',
    actor: 'code-claude',
    to_state,
    evidence_ref: opts.ev ? { scheme: 'pr', ref: opts.ev } : null,
  };
}
const baseCanvas = (): CanvasDoc => ({
  nodes: [{ id: 's0', type: 'text', x: 0, y: 0, width: 320, height: 200, text: '## S0\nprose' }],
  edges: [],
});

const NOW = Date.parse('2026-06-14T00:00:00.000Z');
const SLA = 12 * 60 * 60 * 1000; // 12h

describe('reconcile divergence audit', () => {
  it('flags a node whose owned region was hand-edited away from the ledger', () => {
    const events = [gate('s0', 'C0', 'passed', { ev: '1' })];
    const tampered = projectCanvas(events, baseCanvas());
    tampered.nodes[0].text = tampered.nodes[0].text!.replace('passed', 'delivered'); // hand-edit the fence
    const report = reconcile(events, tampered, { nowMs: NOW, slaMs: SLA });
    expect(report.divergences.map((d) => d.nodeId)).toContain('s0');
  });

  it('does NOT flag a hand-edit to prose outside the fence', () => {
    const events = [gate('s0', 'C0', 'passed', { ev: '1' })];
    const projected = projectCanvas(events, baseCanvas());
    projected.nodes[0].text = projected.nodes[0].text!.replace('## S0\nprose', '## S0\nprose EDITED BY HAND');
    const report = reconcile(events, projected, { nowMs: NOW, slaMs: SLA });
    expect(report.divergences).toHaveLength(0);
  });
});

describe('reconcile evidence audit', () => {
  it('flags a current passed state with no resolvable evidence_ref', () => {
    const events = [gate('s0', 'C0', 'passed')]; // seeded directly — bypasses emit's contract
    const canvas = projectCanvas(events, baseCanvas());
    const report = reconcile(events, canvas, { nowMs: NOW, slaMs: SLA });
    expect(report.evidenceViolations.map((v) => v.correlation_id)).toContain('opav-loop/s0/C0');
  });

  it('does not flag a passed state that has resolvable evidence', () => {
    const events = [gate('s0', 'C0', 'passed', { ev: '1' })];
    const report = reconcile(events, projectCanvas(events, baseCanvas()), { nowMs: NOW, slaMs: SLA });
    expect(report.evidenceViolations).toHaveLength(0);
  });
});

describe('reconcile staleness audit', () => {
  it('alarms on a gate left validating past the SLA', () => {
    const events = [gate('s0', 'C0', 'validating', { ts: '2026-06-13T00:00:00.000Z' })]; // 24h before NOW
    const report = reconcile(events, projectCanvas(events, baseCanvas()), { nowMs: NOW, slaMs: SLA });
    expect(report.stale.map((s) => s.correlation_id)).toContain('opav-loop/s0/C0');
  });

  it('does not alarm on a recent validating gate', () => {
    const events = [gate('s0', 'C0', 'validating', { ts: '2026-06-13T20:00:00.000Z' })]; // 4h before NOW
    const report = reconcile(events, projectCanvas(events, baseCanvas()), { nowMs: NOW, slaMs: SLA });
    expect(report.stale).toHaveLength(0);
  });
});

describe('reconcile is SHADOW (writes nothing, auto-repair off)', () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tracking-recon-test-'));
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reports autoRepairApplied=false and leaves the canvas file byte-identical', async () => {
    const events = [gate('s0', 'C0', 'passed', { ev: '1' })];
    const tampered = projectCanvas(events, baseCanvas());
    tampered.nodes[0].text = tampered.nodes[0].text!.replace('passed', 'failed');
    const canvasPath = path.join(tmpDir, 'roadmap.canvas');
    const onDisk = JSON.stringify(tampered, null, '\t');
    await fs.writeFile(canvasPath, onDisk);

    const report = reconcile(events, tampered, { nowMs: NOW, slaMs: SLA });

    expect(report.autoRepairApplied).toBe(false);
    expect(report.proposedCanvas).not.toBeNull(); // a repair is PROPOSED, not applied
    expect(await fs.readFile(canvasPath, 'utf8')).toBe(onDisk); // file untouched
  });
});
