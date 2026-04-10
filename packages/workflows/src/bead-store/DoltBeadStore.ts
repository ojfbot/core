/**
 * DoltBeadStore
 *
 * BeadStore implementation backed by Dolt (MySQL-wire-compatible, Git-versioned).
 * Runs against `dolt sql-server` on port 3307 (configurable via DOLT_PORT).
 *
 * Every mutation commits to the Dolt log via CALL DOLT_COMMIT(), giving
 * Git-like history for all bead changes — Yegge's "save-game rollback."
 *
 * Security: Only core and shell/Mayor instantiate this store. Sub-apps
 * expose read-only /api/beads projections over their own data.
 */

import mysql from 'mysql2/promise';
import type { Pool, PoolOptions } from 'mysql2/promise';
import type {
  BeadStore,
  BeadFilter,
  BeadEvent,
  FrameBead,
} from '../types/bead.js';
import { eventBus, makeEvent } from '../event-bus.js';

export interface DoltBeadStoreOptions {
  host?: string;
  port?: number;
  user?: string;
  database?: string;
}

export class DoltBeadStore implements BeadStore {
  private pool: Pool;

  constructor(opts: DoltBeadStoreOptions = {}) {
    const poolOpts: PoolOptions = {
      host: opts.host ?? '127.0.0.1',
      port: opts.port ?? parseInt(process.env.DOLT_PORT ?? '3307', 10),
      user: opts.user ?? 'root',
      database: opts.database ?? '.beads-dolt',
      waitForConnections: true,
      connectionLimit: 5,
    };
    this.pool = mysql.createPool(poolOpts);
  }

  async get(id: string): Promise<FrameBead | null> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM beads WHERE id = ?',
      [id],
    );
    const results = rows as Record<string, unknown>[];
    if (results.length === 0) return null;
    return this.rowToBead(results[0]);
  }

  async create(bead: FrameBead): Promise<void> {
    await this.pool.execute(
      `INSERT INTO beads (id, type, status, title, body, labels, actor, hook, molecule, refs, created_at, updated_at, closed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bead.id,
        bead.type,
        bead.status,
        bead.title,
        bead.body,
        JSON.stringify(bead.labels),
        bead.actor,
        bead.hook ?? null,
        bead.molecule ?? null,
        JSON.stringify(bead.refs),
        bead.created_at,
        bead.updated_at,
        bead.closed_at ?? null,
      ],
    );
    await this.doltCommit(`bead:created ${bead.type} "${bead.title}"`);
    await this.insertEvent('created', bead.id, bead.actor, `created ${bead.type} "${bead.title}"`);

    const evt = makeEvent('bead:created', bead.actor, `created ${bead.type} "${bead.title}"`, { bead_id: bead.id });
    eventBus.emit(evt);
  }

  async update(id: string, patch: Partial<FrameBead>): Promise<void> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Bead not found: ${id}`);
    if (existing.status === 'closed' && existing.labels['audit_locked'] === 'true') {
      throw new Error(`Bead ${id} is audit-locked and cannot be mutated.`);
    }

    const updated: FrameBead = {
      ...existing,
      ...patch,
      id, // never overwrite ID
      updated_at: new Date().toISOString(),
    };

    await this.pool.execute(
      `UPDATE beads SET type=?, status=?, title=?, body=?, labels=?, actor=?, hook=?, molecule=?, refs=?, updated_at=?, closed_at=?
       WHERE id=?`,
      [
        updated.type,
        updated.status,
        updated.title,
        updated.body,
        JSON.stringify(updated.labels),
        updated.actor,
        updated.hook ?? null,
        updated.molecule ?? null,
        JSON.stringify(updated.refs),
        updated.updated_at,
        updated.closed_at ?? null,
        id,
      ],
    );
    await this.doltCommit(`bead:updated ${updated.type} "${updated.title}"`);
    await this.insertEvent('updated', id, updated.actor, `updated ${updated.type} "${updated.title}"`);

    const evt = makeEvent('bead:updated', updated.actor, `updated ${updated.type} "${updated.title}"`, { bead_id: id });
    eventBus.emit(evt);
  }

  async close(id: string): Promise<void> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Bead not found: ${id}`);

    await this.update(id, {
      status: 'closed',
      closed_at: new Date().toISOString(),
      labels: { ...existing.labels, audit_locked: 'true' },
    });

    const closed = await this.get(id);
    if (closed) {
      const evt = makeEvent('bead:closed', closed.actor, `closed ${closed.type} "${closed.title}"`, { bead_id: id });
      eventBus.emit(evt);
    }
  }

  async query(filter: BeadFilter): Promise<FrameBead[]> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter.type) {
      conditions.push('type = ?');
      params.push(filter.type);
    }
    if (filter.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }
    if (filter.actor) {
      conditions.push('actor = ?');
      params.push(filter.actor);
    }
    if (filter.prefix) {
      conditions.push('id LIKE ?');
      params.push(filter.prefix + '-%');
    }

    let sql = 'SELECT * FROM beads';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';

    const [rows] = await this.pool.execute(sql, params);
    const results = (rows as Record<string, unknown>[]).map((r) => this.rowToBead(r));

    // Label filtering in application layer (JSON column)
    if (filter.label) {
      return results.filter((bead) => {
        for (const [k, v] of Object.entries(filter.label!)) {
          if (bead.labels[k] !== v) return false;
        }
        return true;
      });
    }

    return results;
  }

  watch(filter: BeadFilter, cb: (event: BeadEvent) => void): () => Promise<void> {
    // Leverage the eventBus — all mutations emit events through it
    const unsub = eventBus.on((event) => {
      if (!event.type.startsWith('bead:')) return;
      const kind = event.type.replace('bead:', '') as BeadEvent['kind'];
      if (!['created', 'updated', 'closed'].includes(kind)) return;

      // Fetch the bead to check filter match
      const beadId = event.bead_id;
      if (!beadId) return;

      this.get(beadId).then((bead) => {
        if (!bead) return;
        if (filter.type && bead.type !== filter.type) return;
        if (filter.status && bead.status !== filter.status) return;
        if (filter.actor && bead.actor !== filter.actor) return;
        if (filter.prefix && !bead.id.startsWith(filter.prefix + '-')) return;
        cb({ kind, bead });
      }).catch(() => { /* silently ignore */ });
    });

    return async () => { unsub(); };
  }

  /** Graceful shutdown — drain the connection pool */
  async destroy(): Promise<void> {
    await this.pool.end();
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private rowToBead(row: Record<string, unknown>): FrameBead {
    return {
      id: row.id as string,
      type: row.type as FrameBead['type'],
      status: row.status as FrameBead['status'],
      title: row.title as string,
      body: row.body as string,
      labels: typeof row.labels === 'string' ? JSON.parse(row.labels) : (row.labels as Record<string, string>) ?? {},
      actor: row.actor as string,
      refs: typeof row.refs === 'string' ? JSON.parse(row.refs) : (row.refs as string[]) ?? [],
      created_at: this.toISOString(row.created_at),
      updated_at: this.toISOString(row.updated_at),
      ...(row.hook != null ? { hook: row.hook as string } : {}),
      ...(row.molecule != null ? { molecule: row.molecule as string } : {}),
      ...(row.closed_at != null ? { closed_at: this.toISOString(row.closed_at) } : {}),
    };
  }

  private toISOString(val: unknown): string {
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'string') return val;
    return new Date().toISOString();
  }

  private async doltCommit(message: string): Promise<void> {
    try {
      await this.pool.execute("CALL DOLT_ADD('-A')");
      await this.pool.execute("CALL DOLT_COMMIT('-m', ?)", [message]);
    } catch {
      // Dolt commit may fail if no changes (duplicate insert guard) — non-fatal
    }
  }

  private async insertEvent(
    eventType: string,
    beadId: string,
    actor: string,
    summary: string,
  ): Promise<void> {
    try {
      await this.pool.execute(
        `INSERT INTO bead_events (event_type, bead_id, actor, summary, timestamp)
         VALUES (?, ?, ?, ?, NOW())`,
        [eventType, beadId, actor, summary],
      );
    } catch {
      // Non-fatal — event log is supplementary
    }
  }
}
