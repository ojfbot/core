/**
 * Dogfood — project onto the REAL OPAV roadmap canvas, read-only.
 *
 * Proves the owned-region contract holds on the actual hand-curated artifact:
 * projecting a gate-event onto a copy of ~/selfco/canvas/opav-loop-roadmap.canvas
 * flips exactly the target slice node (color + fence) and leaves every other node —
 * and all the hand-authored prose — byte-identical. We never WRITE the file here;
 * a real canvas only changes when a real gate transitions (emit-not-magic + honesty).
 *
 * Skipped when the canvas isn't present (e.g. CI without the vault).
 */

import { describe, it, expect } from 'vitest';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { projectCanvas, GATE_STATUS_OPEN } from '../tracking/projector.js';
import { buildGateEvent } from '../tracking/gate-event.js';
import type { CanvasDoc } from '../tracking/types/canvas.js';

const CANVAS = path.join(os.homedir(), 'selfco', 'canvas', 'opav-loop-roadmap.canvas');
const present = fsSync.existsSync(CANVAS);

describe.skipIf(!present)('dogfood: real OPAV roadmap canvas', () => {
  const load = (): CanvasDoc => JSON.parse(fsSync.readFileSync(CANVAS, 'utf8')) as CanvasDoc;

  it('flips only the targeted slice node; every other node stays byte-identical', () => {
    const before = load();
    const targetId = before.nodes.find((n) => n.id === 's0') ? 's0' : before.nodes[0].id;

    const evt = buildGateEvent({ program: 'opav-loop', slice: targetId, gate: 'C0', toState: 'entered' });
    const after = projectCanvas([evt], before);

    const touched = after.nodes.find((n) => n.id === targetId)!;
    expect(touched.text).toContain(GATE_STATUS_OPEN);
    expect(touched.color).toBe('2'); // entered -> orange rollup

    // Every other node is unchanged, and edges are untouched.
    for (const node of before.nodes) {
      if (node.id === targetId) continue;
      expect(after.nodes.find((n) => n.id === node.id)).toEqual(node);
    }
    expect(after.edges).toEqual(before.edges);
  });
});
