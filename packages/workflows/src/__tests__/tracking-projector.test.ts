/**
 * CanvasProjector tests — projection-from-canonical.
 *
 * The canvas is a DERIVED view. The projector owns exactly two things per slice
 * node (nodeId == slice): node.color (a status rollup) and the text between the
 * <!--gate-status--> ... <!--/gate-status--> fence. Hand-authored prose outside
 * the fence is outside the contract — never read, never written.
 */

import { describe, it, expect } from 'vitest';
import {
  projectCanvas,
  rollupColor,
  GATE_STATUS_OPEN,
  GATE_STATUS_CLOSE,
} from '../tracking/projector.js';
import type { CanvasDoc } from '../tracking/types/canvas.js';
import type { TrackingEvent, GateState } from '../tracking/types/tracking-event.js';

let opSeq = 0;
function gate(slice: string, gateName: string, to_state: GateState, evidenceRef?: string): TrackingEvent {
  return {
    event_type: 'gate-event',
    op_id: `op-${opSeq++}`,
    correlation_id: `opav-loop/${slice}/${gateName}`,
    ts: '2026-06-13T00:00:00.000Z',
    actor: 'code-claude',
    to_state,
    evidence_ref: evidenceRef ? { scheme: 'pr', ref: evidenceRef } : null,
  };
}

function canvas(nodeText: string, color?: string): CanvasDoc {
  return {
    nodes: [{ id: 's0', type: 'text', x: 0, y: 0, width: 320, height: 200, text: nodeText, ...(color ? { color } : {}) }],
    edges: [],
  };
}

describe('projectCanvas owned-region contract', () => {
  it('writes a gate-status fence into the matching slice node', () => {
    const out = projectCanvas([gate('s0', 'C0', 'passed', '123')], canvas('## S0\nhand-authored prose'));
    const node = out.nodes[0];
    expect(node.text).toContain(GATE_STATUS_OPEN);
    expect(node.text).toContain(GATE_STATUS_CLOSE);
    expect(node.text).toMatch(/C0.*passed/);
    expect(node.text).toContain('pr:123');
  });

  it('leaves hand-authored prose above the fence untouched', () => {
    const prose = '## S0 · Suggestion identity\nKEYSTONE — blocks everything';
    const out = projectCanvas([gate('s0', 'C0', 'entered')], canvas(prose));
    expect(out.nodes[0].text!.startsWith(prose)).toBe(true);
  });

  it('is idempotent — projecting the same events twice yields identical text and color', () => {
    const events = [gate('s0', 'C0', 'passed', '1'), gate('s0', 'C1', 'validating')];
    const once = projectCanvas(events, canvas('## S0\nprose'));
    const twice = projectCanvas(events, once);
    expect(twice.nodes[0].text).toBe(once.nodes[0].text);
    expect(twice.nodes[0].color).toBe(once.nodes[0].color);
  });

  it('uses the latest event per gate (last write wins)', () => {
    const events = [gate('s0', 'C0', 'validating'), gate('s0', 'C0', 'passed', '9')];
    const out = projectCanvas(events, canvas('## S0\nprose'));
    expect(out.nodes[0].text).toMatch(/C0.*passed/);
    expect(out.nodes[0].text).not.toMatch(/C0.*validating/);
  });

  it('ignores events whose slice has no matching canvas node (no throw, no change)', () => {
    const base = canvas('## S0\nprose');
    const out = projectCanvas([gate('s99', 'C0', 'passed', '1')], base);
    expect(out.nodes[0].text).toBe('## S0\nprose');
    expect(out.nodes).toHaveLength(1);
  });
});

describe('rollupColor precedence', () => {
  const cases: Array<[GateState[], string | undefined]> = [
    [['failed', 'passed'], '1'],          // any failed -> red
    [['delivered', 'delivered'], '4'],    // all delivered -> green
    [['delivered', 'validating'], '3'],   // any validating -> yellow
    [['passed', 'entered'], '5'],         // any passed (not all delivered) -> cyan
    [['entered'], '2'],                   // entered only -> orange
    [[], undefined],                      // nothing -> untouched
  ];
  it.each(cases)('rollup(%j) === %s', (states, expected) => {
    expect(rollupColor(states)).toBe(expected);
  });
});
