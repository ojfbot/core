/**
 * EventLedger — append-only JSONL ledger, the source of truth for the tracking spine.
 *
 * One file per program: <root>/<program>.jsonl. Append-only, never rewritten —
 * the file IS the audit trail. Append is idempotent on op_id (first write wins),
 * so retries and the reconciler can never double-count.
 *
 * Root is injectable (default ~/selfco/tracking) so tests run against a temp dir,
 * mirroring FilesystemBeadStore's constructor-root pattern.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import type { TrackingEvent } from './types/tracking-event.js';

export const DEFAULT_TRACKING_ROOT = path.join(os.homedir(), 'selfco', 'tracking');

export class EventLedger {
  private readonly file: string;
  /** op_ids already on disk — the idempotency guard. Hydrated lazily from the file. */
  private seen: Set<string> | null = null;

  constructor(program: string, root: string = DEFAULT_TRACKING_ROOT) {
    this.file = path.join(root, `${program}.jsonl`);
  }

  /** Parse the ledger file into events, in append order. Missing file = empty. */
  async read(): Promise<TrackingEvent[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    return raw
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as TrackingEvent);
  }

  /**
   * Append one event. Idempotent on op_id: if the op_id is already present, this
   * is a no-op (first write wins, the file is untouched).
   */
  async append(event: TrackingEvent): Promise<void> {
    await this.hydrateSeen();
    if (this.seen!.has(event.op_id)) return;
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.appendFile(this.file, JSON.stringify(event) + '\n', 'utf8');
    this.seen!.add(event.op_id);
  }

  private async hydrateSeen(): Promise<void> {
    if (this.seen) return;
    const seen = new Set<string>();
    try {
      const raw = fsSync.readFileSync(this.file, 'utf8');
      for (const line of raw.split('\n')) {
        if (line.trim().length === 0) continue;
        seen.add((JSON.parse(line) as TrackingEvent).op_id);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    this.seen = seen;
  }
}
