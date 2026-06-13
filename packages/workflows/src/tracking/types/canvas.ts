/**
 * Minimal JSON Canvas (Obsidian) types — only what the projector reads and writes.
 *
 * The full spec has more node kinds; the tracking projector only touches `text`
 * nodes' `text` and `color`, and preserves everything else (x/y/width/height and
 * any unknown fields) verbatim so hand-arranged placement survives projection.
 */

/** JSON Canvas colors: '1' red · '2' orange · '3' yellow · '4' green · '5' cyan · '6' purple. */
export type CanvasColor = '1' | '2' | '3' | '4' | '5' | '6';

export interface CanvasNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  color?: string;
  /** Preserve any fields the projector doesn't model. */
  [key: string]: unknown;
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  [key: string]: unknown;
}

export interface CanvasDoc {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}
