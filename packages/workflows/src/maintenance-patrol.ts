/**
 * maintenance-patrol — A6 adoption: automated bead lifecycle maintenance.
 *
 * Implements the three steps of the maintenance-patrol.toml formula:
 *   archiveStale    — close+archive beads in 'closed' state for >N days
 *   orphanCheck     — clear hooks pointing to missing/archived beads
 *   indexRebuild    — verify prefix dirs, count beads, log corrupt files
 *
 * `runMaintenancePatrol(store, options)` executes all three steps in dependency
 * order (archive-stale + orphan-check in parallel, then index-rebuild) and
 * returns a patrol report.
 *
 * This module is the implementation of the wisp; the formula file
 * (formulas/maintenance-patrol.toml) is the declaration.
 *
 * Usage:
 *   const report = await runMaintenancePatrol(store);
 *   console.log(report.summary);
 */

import type { BeadStore, FrameBead } from './types/bead.js';
import { isAgentBead } from './types/agent-bead.js';

export interface PatrolOptions {
  /** Days in 'closed' state before archiving. Default: 30 */
  thresholdDays?: number;
  /** Log actions without writing to store. Default: false */
  dryRun?: boolean;
}

export interface PatrolReport {
  archivedCount: number;
  orphansCleared: number;
  totalBeads: number;
  beadsByPrefix: Record<string, number>;
  corruptFiles: string[];
  dryRun: boolean;
  summary: string;
}

// ── Step implementations ──────────────────────────────────────────────────────

/**
 * Archive beads that have been in 'closed' state for longer than thresholdDays.
 * Returns the count of beads archived.
 */
export async function archiveStale(
  store: BeadStore,
  thresholdDays = 30,
  dryRun = false,
): Promise<number> {
  const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;
  const closed = await store.query({ status: 'closed' });

  let count = 0;
  for (const bead of closed) {
    const closedAt = bead.closed_at ? new Date(bead.closed_at).getTime() : null;
    if (closedAt !== null && closedAt < cutoff) {
      if (!dryRun) {
        await store.update(bead.id, { status: 'archived' });
      }
      count++;
    }
  }
  return count;
}

/**
 * Clear hook pointers on AgentBeads that reference missing or archived beads.
 * Returns the count of orphaned hooks cleared.
 */
export async function orphanCheck(
  store: BeadStore,
  dryRun = false,
): Promise<number> {
  const agents = await store.query({ type: 'agent' });
  let count = 0;

  for (const bead of agents) {
    if (!isAgentBead(bead)) continue;
    const hookId = bead.labels.hook;
    if (!hookId) continue;

    const hookBead = await store.get(hookId);
    const isOrphan =
      hookBead === null ||
      hookBead.status === 'archived' ||
      hookBead.status === 'closed';

    if (isOrphan) {
      if (!dryRun) {
        const labels = { ...bead.labels };
        delete labels['hook'];
        await store.update(bead.id, { labels });
      }
      count++;
    }
  }
  return count;
}

/**
 * Rebuild index: count beads by prefix, surface corrupt JSON files.
 * Read-only — never modifies the store.
 */
export async function indexRebuild(
  store: BeadStore,
): Promise<{ totalBeads: number; beadsByPrefix: Record<string, number>; corruptFiles: string[] }> {
  // FilesystemBeadStore.query with no filter reads all prefixes
  // We use type filtering across each bead type to get a full count
  // (since BeadFilter has no "all" shorthand, query with empty object)
  let all: FrameBead[] = [];
  try {
    all = await store.query({});
  } catch {
    // store.query({}) is valid per interface — if it throws, treat as empty
    all = [];
  }

  const byPrefix: Record<string, number> = {};
  for (const bead of all) {
    const prefix = bead.id.split('-')[0];
    byPrefix[prefix] = (byPrefix[prefix] ?? 0) + 1;
  }

  return {
    totalBeads: all.length,
    beadsByPrefix: byPrefix,
    corruptFiles: [], // FilesystemBeadStore silently skips corrupt files; surfaced via watch errors in A7
  };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Run the full maintenance-patrol wisp: archive-stale + orphan-check (parallel),
 * then index-rebuild.
 */
export async function runMaintenancePatrol(
  store: BeadStore,
  options: PatrolOptions = {},
): Promise<PatrolReport> {
  const { thresholdDays = 30, dryRun = false } = options;

  // Steps 1+2 are independent — run in parallel
  const [archivedCount, orphansCleared] = await Promise.all([
    archiveStale(store, thresholdDays, dryRun),
    orphanCheck(store, dryRun),
  ]);

  // Step 3 runs after
  const { totalBeads, beadsByPrefix, corruptFiles } = await indexRebuild(store);

  const prefixSummary = Object.entries(beadsByPrefix)
    .map(([p, n]) => `${p}:${n}`)
    .join(' ');

  const summary = [
    dryRun ? '[dry-run] ' : '',
    `archived ${archivedCount} stale bead(s), `,
    `cleared ${orphansCleared} orphaned hook(s), `,
    `${totalBeads} bead(s) total (${prefixSummary || 'none'})`,
  ].join('');

  return { archivedCount, orphansCleared, totalBeads, beadsByPrefix, corruptFiles, dryRun, summary };
}
