/**
 * CanvasProjector — pure ledger -> view projection (projection-from-canonical).
 *
 * The canvas is DERIVED. This module never reads canvas state as truth; it folds
 * tracking events into the latest state per gate and writes ONLY the owned region
 * of each slice node:
 *   1. node.color — a status rollup (rollupColor)
 *   2. the text between GATE_STATUS_OPEN and GATE_STATUS_CLOSE — the per-gate lines
 *
 * Everything else (hand-authored prose, node geometry, unknown fields, other nodes)
 * is preserved verbatim. nodeId == the slice segment of correlation_id. Events whose
 * slice has no canvas node are ignored (the caller may log them). The projection is
 * pure and idempotent: projecting the same events twice yields identical output.
 */

import type { CanvasDoc, CanvasNode } from './types/canvas.js';
import type { GateState, TransitionState, TrackingEvent } from './types/tracking-event.js';

export const GATE_STATUS_OPEN = '<!--gate-status-->';
export const GATE_STATUS_CLOSE = '<!--/gate-status-->';

/** A glyph per state, used in the fence lines (deterministic rendering). */
const STATE_GLYPH: Record<TransitionState, string> = {
  entered: '·',
  validating: '⏳',
  passed: '✓',
  failed: '✗',
  delivered: '★',
  acted: '➤',
};

/** The Projector interface: a pure view derived from the event stream. */
export interface Projector<View> {
  project(events: TrackingEvent[], current: View): View;
}

/** Parse `${program}/${slice}/${gate}` → its parts. */
export function parseCorrelation(correlation_id: string): { program: string; slice: string; gate: string } {
  const [program, slice, gate] = correlation_id.split('/');
  return { program, slice, gate };
}

/**
 * Latest gate-event per (slice, gate), in append order (last write wins).
 * Returns Map<slice, Map<gate, TrackingEvent>>. Non gate-event types are ignored.
 */
export function latestPerGate(events: TrackingEvent[]): Map<string, Map<string, TrackingEvent>> {
  const bySlice = new Map<string, Map<string, TrackingEvent>>();
  for (const e of events) {
    if (e.event_type !== 'gate-event') continue;
    const { slice, gate } = parseCorrelation(e.correlation_id);
    if (!slice || !gate) continue;
    if (!bySlice.has(slice)) bySlice.set(slice, new Map());
    bySlice.get(slice)!.set(gate, e); // later events overwrite earlier ones
  }
  return bySlice;
}

/**
 * Rollup a slice's gate states into a single canvas color.
 * Precedence: any failed → red(1); else all delivered → green(4); else any
 * validating → yellow(3); else any passed → cyan(5); else any entered → orange(2);
 * else undefined (leave the node's color untouched).
 */
export function rollupColor(states: GateState[]): string | undefined {
  if (states.length === 0) return undefined;
  if (states.includes('failed')) return '1';
  if (states.every((s) => s === 'delivered')) return '4';
  if (states.includes('validating')) return '3';
  if (states.includes('passed')) return '5';
  if (states.includes('entered')) return '2';
  return undefined;
}

/** Render the deterministic fence body for a slice's gates (sorted by gate name). */
export function renderFence(gates: Map<string, TrackingEvent>): string {
  const lines = [...gates.keys()].sort().map((g) => {
    const e = gates.get(g)!;
    const glyph = STATE_GLYPH[e.to_state];
    const evidence = e.evidence_ref ? ` — evidence: ${e.evidence_ref.scheme}:${e.evidence_ref.ref}` : '';
    return `- ${g} · ${e.to_state} ${glyph}${evidence}`;
  });
  return [GATE_STATUS_OPEN, ...lines, GATE_STATUS_CLOSE].join('\n');
}

/**
 * Replace (or append) the owned fence region in a node's text, leaving prose intact.
 *
 * The boundary is NORMALIZED so the replace path (already-fenced canvas) and the
 * append path (clean canvas) converge byte-for-byte: trailing whitespace before the
 * fence is collapsed to a single blank-line separator. Without this, re-projecting
 * over an already-fenced canvas drifts from the first projection. This normalization
 * stays strictly within the owned region — prose content above it is preserved.
 */
function writeFence(text: string, fence: string): string {
  const start = text.indexOf(GATE_STATUS_OPEN);
  const end = text.indexOf(GATE_STATUS_CLOSE);
  let before: string;
  let after: string;
  if (start !== -1 && end !== -1 && end > start) {
    before = text.slice(0, start);
    after = text.slice(end + GATE_STATUS_CLOSE.length);
  } else {
    before = text;
    after = '';
  }
  const prose = before.replace(/\s+$/, '');
  const sep = prose.length > 0 ? '\n\n' : '';
  return prose + sep + fence + after;
}

/**
 * Project events onto a canvas. Pure: returns a new CanvasDoc; the input is not
 * mutated. Only slice nodes with matching events are touched, and only their
 * color + fence region.
 */
export function projectCanvas(events: TrackingEvent[], current: CanvasDoc): CanvasDoc {
  const bySlice = latestPerGate(events);
  const nodes: CanvasNode[] = current.nodes.map((node) => {
    const gates = bySlice.get(node.id);
    if (!gates || gates.size === 0) return node;
    // gates holds gate-events only (latestPerGate filters by type), so to_state is GateState.
    const states = [...gates.values()].map((e) => e.to_state as GateState);
    const color = rollupColor(states);
    const text = writeFence(node.text ?? '', renderFence(gates));
    return { ...node, text, ...(color ? { color } : {}) };
  });
  return { ...current, nodes };
}

/** The Projector-interface form of projectCanvas, for callers that hold a view. */
export const canvasProjector: Projector<CanvasDoc> = {
  project: projectCanvas,
};
