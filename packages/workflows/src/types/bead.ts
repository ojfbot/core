/**
 * FrameBead — the universal typed work primitive for Frame OS.
 *
 * Every work item, agent identity, hook, mail message, and workflow step
 * is a FrameBead. Defined in ADR-0016.
 *
 * Gas Town / Paperclip mapping:
 *   Gas Town "bead"     → FrameBead
 *   Paperclip "task"    → FrameBead (type: task)
 *   G1 goal_parent      → labels.goal_parent (OKR/Roadmap chain)
 */

export type BeadType =
  | 'adr'
  | 'okr'
  | 'roadmap'
  | 'command'
  | 'draft'
  | 'cv'
  | 'task'
  | 'agent'
  | 'hook'
  | 'mail'
  | 'molecule'
  | 'convoy';

export type BeadStatus = 'created' | 'live' | 'closed' | 'archived';

export interface FrameBead {
  /** Prefixed ID, e.g. "core-adr-0016", "cv-x7k2m". Prefix routes to the rig. */
  id: string;
  type: BeadType;
  status: BeadStatus;
  title: string;
  /** Markdown content */
  body: string;
  /**
   * Arbitrary string → string labels.
   * Reserved keys:
   *   goal_parent  — ID of parent OKR or roadmap bead (G1)
   *   okr          — human-readable OKR reference
   */
  labels: Record<string, string>;
  /** Agent or user that created/owns this bead */
  actor: string;
  /** ID of the bead currently on this bead's hook (A3) */
  hook?: string;
  /** ID of the molecule this bead belongs to (A4) */
  molecule?: string;
  /** IDs of related beads */
  refs: string[];
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

// ── BeadStore interface ──────────────────────────────────────────────────────

export interface BeadFilter {
  type?: BeadType;
  status?: BeadStatus;
  actor?: string;
  prefix?: string;
  label?: Record<string, string>;
}

export type BeadEventKind = 'created' | 'updated' | 'closed';

export interface BeadEvent {
  kind: BeadEventKind;
  bead: FrameBead;
  previous?: FrameBead;
}

export interface BeadStore {
  get(id: string): Promise<FrameBead | null>;
  create(bead: FrameBead): Promise<void>;
  update(id: string, patch: Partial<FrameBead>): Promise<void>;
  close(id: string): Promise<void>;
  query(filter: BeadFilter): Promise<FrameBead[]>;
  /**
   * Watch for bead events matching filter. Returns an unsubscribe function.
   */
  watch(filter: BeadFilter, cb: (event: BeadEvent) => void): () => Promise<void>;
}

// ── Prefix routing ───────────────────────────────────────────────────────────

/**
 * Maps bead ID prefix → sub-app directory segment under ~/.beads/.
 * e.g. "core-adr-0016" → prefix "core" → ~/.beads/core/
 */
export const BEAD_PREFIX_MAP: Record<string, string> = {
  'core': 'core',
  'cv':   'cv',
  'blog': 'blog',
  'trip': 'trip',
  'pure': 'pure',
  'seh':  'seh',
  'lean': 'lean',
  'gt':   'gt',
  'hq':   'hq',
} as const;

/** Extract the prefix segment from a bead ID (everything before the first '-'). */
export function beadPrefix(id: string): string {
  const seg = id.split('-')[0];
  return BEAD_PREFIX_MAP[seg] ?? seg;
}
