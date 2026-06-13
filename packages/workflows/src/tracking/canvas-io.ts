/**
 * Canvas IO — read/write JSON Canvas (.canvas) files for the projector.
 *
 * Serialization mirrors Obsidian's on-disk style: a tab-indented top-level object
 * whose `nodes`/`edges` arrays put each entry compact on its own line. This keeps
 * projection diffs minimal against hand-authored canvases (one line changes per
 * touched node) instead of reflowing the whole file.
 */

import fs from 'fs/promises';
import type { CanvasDoc } from './types/canvas.js';

export async function readCanvas(file: string): Promise<CanvasDoc> {
  return JSON.parse(await fs.readFile(file, 'utf8')) as CanvasDoc;
}

/** Serialize in Obsidian's style: each node/edge a compact line, tab-indented arrays. */
export function serializeCanvas(canvas: CanvasDoc): string {
  const nodes = canvas.nodes.map((n) => '\t\t' + JSON.stringify(n)).join(',\n');
  const edges = canvas.edges.map((e) => '\t\t' + JSON.stringify(e)).join(',\n');
  return `{\n\t"nodes":[\n${nodes}\n\t],\n\t"edges":[\n${edges}\n\t]\n}\n`;
}

export async function writeCanvas(file: string, canvas: CanvasDoc): Promise<void> {
  await fs.writeFile(file, serializeCanvas(canvas), 'utf8');
}
