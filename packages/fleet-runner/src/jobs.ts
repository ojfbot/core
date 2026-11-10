// Fleet-runner queue. Lifted from BookcaseDiscovery src/run/jobs.ts under AGPL-3.0-only.
// Jobs are cache-keyed and claimed under a lease and fencing token. Callers use JobStore methods.
//
// `jobs` holds current state; `job_events` is append-only (UPDATE and DELETE refused by trigger) and
// is what the morning report reads. Neither ever holds reader text or image content: payloads may
// name private paths, so the CLI never prints them, and outputs are recorded by content hash.
//
// The fencing token guards the artifact as well as the row: each attempt writes its own immutable file
// (`<key>.<fence>.<ext>`), and only the guarded completion records which file is accepted. A stale worker
// can still write bytes, but never into the file a consumer reads.
import type { ServiceInstance, ServiceSnapshot, WorkerControl, WorkerObservation } from "./status.js";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, fsyncSync, linkSync, mkdirSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import type * as SQLite from "node:sqlite";
import type { RequestNonce } from "./auth.js";

// Vite 5 does not recognize the node:sqlite builtin. Load it through Node.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof SQLite;

export const JOBS_SCHEMA_VERSION = 5;

const SCHEMA = `
CREATE TABLE jobs (
  key           TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,
  inputs        TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(inputs)),
  params        TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(params)),
  code          TEXT,
  payload       TEXT NOT NULL CHECK (json_valid(payload)),
  requires      TEXT NOT NULL CHECK (json_valid(requires)),
  priority      INTEGER NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('ready', 'claimed', 'done', 'failed')),
  attempts      INTEGER NOT NULL,
  max_attempts  INTEGER NOT NULL,
  fence         INTEGER NOT NULL,
  worker        TEXT,
  lease_expires INTEGER,
  output        TEXT,
  output_file   TEXT,
  error         TEXT,
  created       INTEGER NOT NULL,
  updated       INTEGER NOT NULL,
  rev           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX jobs_ready ON jobs (status, priority DESC, created);
CREATE TABLE job_events (
  seq    INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     INTEGER NOT NULL,
  key    TEXT NOT NULL,
  type   TEXT NOT NULL,
  worker TEXT,
  fence  INTEGER,
  detail TEXT
);
CREATE TRIGGER job_events_no_update BEFORE UPDATE ON job_events
BEGIN SELECT RAISE(ABORT, 'job_events is append-only: UPDATE refused'); END;
CREATE TRIGGER job_events_no_delete BEFORE DELETE ON job_events
BEGIN SELECT RAISE(ABORT, 'job_events is append-only: DELETE refused'); END;
CREATE INDEX job_events_key ON job_events (key, fence);
-- Only v2 clients may write: every v2 statement sets rev (1 on insert, rev + 1 on update), and a client
-- built for an older schema, still running across the upgrade, sets neither. Its claim, heartbeat,
-- completion or admission aborts instead of acting on a job it cannot fence.
CREATE TRIGGER jobs_writer_insert BEFORE INSERT ON jobs WHEN NEW.rev IS NOT 1
BEGIN SELECT RAISE(ABORT, 'jobs: write from a pre-v2 client refused'); END;
CREATE TRIGGER jobs_writer_update BEFORE UPDATE ON jobs WHEN NEW.rev IS NOT OLD.rev + 1
BEGIN SELECT RAISE(ABORT, 'jobs: write from a pre-v2 client refused'); END;
CREATE TABLE auth_nonces (
  identity   TEXT NOT NULL,
  nonce      TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (identity, nonce)
) WITHOUT ROWID;
`;

/**
 * v1 → v2: the key's basis travels with the claim (handlers verify it), and the accepted output file is
 * recorded. v1 rows have neither, so a v1 job can neither run under a v2 handler nor serve as a cache hit
 * with a file to read. Every v1 row is retired: a `retired` event records it, the row leaves `jobs`, and
 * the same work admitted again under v2 starts fresh. Their v1 output files stay on disk, unreferenced.
 *
 * A v1 worker may still hold a claim when this runs. Its `retired` event carries that worker, fence and
 * lease expiry, so the report closes the attempt; and readmission continues the key's fence from its
 * event history, so the old worker's token can never match a new claim. The v1 retirement step is
 * followed by v2 → v3, which adds only the durable request-nonce ledger.
 */
const MIGRATE_1_TO_2 = `
ALTER TABLE jobs ADD COLUMN inputs TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(inputs));
ALTER TABLE jobs ADD COLUMN params TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(params));
ALTER TABLE jobs ADD COLUMN code TEXT;
ALTER TABLE jobs ADD COLUMN output_file TEXT;
ALTER TABLE jobs ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
CREATE INDEX job_events_key ON job_events (key, fence);
-- Only v2 clients may write: every v2 statement sets rev (1 on insert, rev + 1 on update), and a client
-- built for an older schema, still running across the upgrade, sets neither. Its claim, heartbeat,
-- completion or admission aborts instead of acting on a job it cannot fence.
CREATE TRIGGER jobs_writer_insert BEFORE INSERT ON jobs WHEN NEW.rev IS NOT 1
BEGIN SELECT RAISE(ABORT, 'jobs: write from a pre-v2 client refused'); END;
CREATE TRIGGER jobs_writer_update BEFORE UPDATE ON jobs WHEN NEW.rev IS NOT OLD.rev + 1
BEGIN SELECT RAISE(ABORT, 'jobs: write from a pre-v2 client refused'); END;
`;

const MIGRATE_2_TO_3 = `
CREATE TABLE auth_nonces (
  identity   TEXT NOT NULL,
  nonce      TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (identity, nonce)
) WITHOUT ROWID;
`;

export type JobStatus = "ready" | "claimed" | "done" | "failed";
export type JobEventType =
  | "enqueued"
  | "claimed"
  | "completed"
  | "rejected-stale"
  | "failed"
  | "retry"
  | "released"
  | "lease-expired"
  | "retired";

/** What a client admits. The key is derived from everything that determines the output. */
export interface JobSpec {
  kind: string;
  /** Content hashes of the inputs (working-copy sha256, a commit, a cache file's hash). Order is significant. */
  inputs: string[];
  /** Everything else that changes the output (rotations, polygons, tiling). Keyed, so handlers execute these, not the payload. */
  params?: Record<string, unknown>;
  model?: { id: string; revision: string };
  /** Code commit or pinned helper identity. */
  code?: string;
  /** Where the inputs are on this host, and nothing that changes the output. May name private paths: never printed or committed. */
  payload: unknown;
  /** Worker capabilities the job needs, e.g. `apple-vision`, `mps`, `mlx`. */
  requires?: string[];
  priority?: number;
  maxAttempts?: number;
}

export interface Claim {
  key: string;
  kind: string;
  /** The keyed basis, so a handler can verify what it resolved from the payload before running. */
  inputs: string[];
  params: Record<string, unknown>;
  code: string | null;
  payload: unknown;
  fence: number;
  leaseExpires: number;
}

/** One attempt's output: the file name under the worker's output directory and its content hash. */
export interface JobOutput {
  file: string;
  sha256: string;
}

export interface JobRow {
  key: string;
  kind: string;
  status: JobStatus;
  attempts: number;
  fence: number;
  worker: string | null;
  /** The accepted output's content hash. */
  output: string | null;
  /** The accepted output's file name: the one consumers read. Other attempts' files are orphans. */
  outputFile: string | null;
  error: string | null;
}

/** Stable JSON: object keys sorted at every level, so equal specs hash equally. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** The job key (CONTEXT.md): the payload is excluded, because it says *where* inputs are, not *what* they are. */
export function jobKey(spec: Pick<JobSpec, "kind" | "inputs"> & Partial<JobSpec>): string {
  const basis = { kind: spec.kind, inputs: spec.inputs, params: spec.params ?? {}, model: spec.model ?? null, code: spec.code ?? null };
  return createHash("sha256").update(canonicalJson(basis)).digest("hex");
}

/**
 * Write one attempt's output to `<dir>/<key>.<fence>.<ext>`. The file is complete before it appears (written
 * to a temporary file, then hard-linked into place) and is never overwritten: linking fails if the name
 * exists. So a worker that wakes after losing its lease cannot touch the accepted attempt's bytes.
 */
export function writeOutput(dir: string, job: Pick<Claim, "key" | "fence">, data: string | Uint8Array, ext = "jsonl"): JobOutput {
  mkdirSync(dir, { recursive: true });
  const file = `${job.key}.${job.fence}.${ext}`;
  const tmp = join(dir, `${file}.${process.pid}.${randomUUID()}.tmp`);
  try {
    const fd = openSync(tmp, "wx", 0o600);
    try {
      writeFileSync(fd, data);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    linkSync(tmp, join(dir, file));
    syncDirectory(dir);
  } finally {
    try { unlinkSync(tmp); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return { file, sha256: createHash("sha256").update(data).digest("hex") };
}

function syncDirectory(dir: string): void {
  const fd = openSync(dir, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

/** A retry may find an orphan from an interrupted completion; make it durable before commit. */
export function syncOutput(dir: string, file: string): void {
  const fd = openSync(join(dir, file), "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
  syncDirectory(dir);
}

export interface JobStoreOptions {
  /** Clock in epoch ms; tests pass a fake one. */
  now?: () => number;
  /** Lease length. Default 5 min, the same as core's agent lease: a crashed or sleeping worker frees its job quickly. */
  leaseMs?: number;
}

/**
 * The morning report. Two scopes, never mixed: `now` is the table's state when the report runs; `period`
 * counts what happened between `since` and `until`.
 */
export interface JobEvent {
  seq: number;
  ts: number;
  key: string;
  type: JobEventType;
  worker: string | null;
  fence: number | null;
}

/** The morning report. Its current state and time window are separate. */
export interface JobReport {
  now: {
    at: number;
    byKind: Record<string, Record<JobStatus, number>>;
    /** Jobs that are failed now (any time), by kind and error code. */
    failures: { kind: string; error: string; count: number }[];
    oldestReadyAgeSeconds: number | null;
  };
  period: {
    since: number;
    until: number;
    events: Partial<Record<JobEventType, number>>;
    /**
     * Per worker, attempts that ended in the period by how they ended, plus `machineSeconds`: the time its
     * attempts held a valid lease inside the period. Each attempt counts from its claim to its end or to its
     * lease's actual expiry, whichever is first, clipped to the period at both ends; running attempts included.
     */
    byWorker: Record<string, WorkerPeriod>;
  };
}

export interface WorkerPeriod {
  completed: number;
  failed: number;
  released: number;
  leaseExpired: number;
  /** Attempts ended because a schema upgrade retired their job. */
  retired: number;
  staleRejected: number;
  machineSeconds: number;
}

export class JobStore {
  readonly #db: SQLite.DatabaseSync;
  readonly #now: () => number;
  readonly #leaseMs: number;

  constructor(path: string, options: JobStoreOptions = {}) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.#db = new DatabaseSync(path);
    this.#now = options.now ?? Date.now;
    this.#leaseMs = options.leaseMs ?? 5 * 60_000;
    this.#db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;");
    // Read the version and write the new one in the same write transaction as the schema change, so two
    // processes opening a new or old table at once cannot both create or migrate it, and an interrupted
    // upgrade rolls back whole and is retried on the next open.
    this.#tx(() => {
      const version = (this.#db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
      if (version === JOBS_SCHEMA_VERSION) return;
      if (version === 0) {
        this.#db.exec(SCHEMA);
      } else if (version === 1) {
        this.#db.exec(MIGRATE_1_TO_2);
        const rows = this.#db.prepare("SELECT key, status, worker, fence, lease_expires FROM jobs").all() as {
          key: string;
          status: JobStatus;
          worker: string | null;
          fence: number;
          lease_expires: number | null;
        }[];
        for (const r of rows)
          this.#event(r.key, "retired", r.worker, r.fence, `schema-v1:${r.status}${r.lease_expires === null ? "" : `:${r.lease_expires}`}`);
        this.#db.exec("DELETE FROM jobs");
        this.#db.exec(MIGRATE_2_TO_3);
      } else if (version === 2) {
        this.#db.exec(MIGRATE_2_TO_3);
      } else if (version === 3 || version === 4) {
        // Status/control tables are introduced atomically below.
      } else {
        throw new Error(`job table schema ${version}, expected ${JOBS_SCHEMA_VERSION}`);
      }
    this.#db.exec(`CREATE TABLE IF NOT EXISTS fleet_status_meta (id INTEGER PRIMARY KEY CHECK(id=1), starts INTEGER NOT NULL, revision INTEGER NOT NULL, salt TEXT NOT NULL, tracked_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS fleet_presence (worker TEXT PRIMARY KEY, seen_at INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS fleet_controls (worker TEXT PRIMARY KEY, paused INTEGER NOT NULL, revision INTEGER NOT NULL, intent TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS fleet_recovery (id INTEGER PRIMARY KEY CHECK(id=1), generation TEXT NOT NULL, hold INTEGER NOT NULL CHECK(hold IN (0,1)), recovery_point TEXT NOT NULL);`);
    this.#db.prepare("INSERT OR IGNORE INTO fleet_recovery VALUES (1,'legacy',0,'')").run();
    this.#db.prepare("INSERT OR IGNORE INTO fleet_status_meta VALUES (1,0,0,?,?)").run(randomUUID(), this.#now());
    this.#db.exec(`CREATE TRIGGER IF NOT EXISTS jobs_paused_claim BEFORE UPDATE ON jobs
      WHEN NEW.status='claimed' AND (OLD.status!='claimed' OR NEW.fence!=OLD.fence)
      AND EXISTS (SELECT 1 FROM fleet_controls WHERE worker=NEW.worker AND paused=1)
      BEGIN SELECT RAISE(ABORT,'worker claims paused'); END;`);
      this.#db.exec(`CREATE TRIGGER IF NOT EXISTS jobs_recovery_hold_claim BEFORE UPDATE ON jobs
      WHEN NEW.status='claimed' AND (OLD.status!='claimed' OR NEW.fence!=OLD.fence)
      AND EXISTS (SELECT 1 FROM fleet_recovery WHERE id=1 AND hold=1)
      BEGIN SELECT RAISE(ABORT,'fleet recovery hold is active'); END;`);
      this.#db.exec(`PRAGMA user_version = ${JOBS_SCHEMA_VERSION}`);
    });

  }

  close(): void {
    this.#db.close();
  }

  /** Atomically remember a verified request nonce across every process using this database. */
  consumeNonce(candidate: RequestNonce): boolean {
    return this.#tx(() => {
      this.#db.prepare("DELETE FROM auth_nonces WHERE expires_at <= ?").run(candidate.now);
      const result = this.#db
        .prepare("INSERT OR IGNORE INTO auth_nonces (identity, nonce, expires_at) VALUES (?, ?, ?)")
        .run(candidate.identity, candidate.nonce, candidate.expiresAt);
      return Number(result.changes) === 1;
    });
  }

  /**
   * Admit a job. Idempotent: an existing key (in any state) is left alone and reported as not created. A key
   * readmitted after retirement continues its fence from the event history, so tokens never repeat per key.
   */
  enqueue(spec: JobSpec): { key: string; created: boolean } {
    const key = jobKey(spec);
    return this.#tx(() => {
      const now = this.#now();
      const res = this.#db
        .prepare(
          `INSERT OR IGNORE INTO jobs (key, kind, inputs, params, code, payload, requires, priority, status, attempts, max_attempts, fence, created, updated, rev)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready', 0, ?, (SELECT COALESCE(MAX(fence), 0) FROM job_events WHERE key = ?), ?, ?, 1)`,
        )
        .run(
          key,
          spec.kind,
          JSON.stringify(spec.inputs),
          canonicalJson(spec.params ?? {}),
          spec.code ?? null,
          JSON.stringify(spec.payload ?? null),
          JSON.stringify(spec.requires ?? []),
          spec.priority ?? 0,
          spec.maxAttempts ?? 3,
          key,
          now,
          now,
        );
      const created = Number(res.changes) === 1;
      if (created) this.#event(key, "enqueued", null, 0);
      return { key, created };
    });
  }

  /**
   * Claim the highest-priority ready job this worker can run, after sweeping expired leases. A job is
   * runnable when the worker has every capability it requires and, if `kinds` is given, a handler for its kind.
   */
  claim(worker: string, caps: readonly string[], kinds?: readonly string[]): Claim | undefined {
    const have = new Set(caps);
    const handled = kinds ? new Set(kinds) : undefined;
    return this.#tx(() => {
      if (this.isRecoveryHeld() || this.workerControl(worker).paused) return undefined;
      this.#sweep();
      const rows = this.#db
        .prepare("SELECT key, kind, inputs, params, code, payload, requires, fence FROM jobs WHERE status = 'ready' ORDER BY priority DESC, created, key")
        .all() as { key: string; kind: string; inputs: string; params: string; code: string | null; payload: string; requires: string; fence: number }[];
      const row = rows.find((r) => (!handled || handled.has(r.kind)) && (JSON.parse(r.requires) as string[]).every((c) => have.has(c)));
      if (!row) return undefined;
      const now = this.#now();
      const fence = row.fence + 1;
      const leaseExpires = now + this.#leaseMs;
      this.#db
        .prepare("UPDATE jobs SET status = 'claimed', fence = ?, worker = ?, lease_expires = ?, attempts = attempts + 1, updated = ?, rev = rev + 1 WHERE key = ?")
        .run(fence, worker, leaseExpires, now, row.key);
      this.#event(row.key, "claimed", worker, fence);
      return {
        key: row.key,
        kind: row.kind,
        inputs: JSON.parse(row.inputs) as string[],
        params: JSON.parse(row.params) as Record<string, unknown>,
        code: row.code,
        payload: JSON.parse(row.payload),
        fence,
        leaseExpires,
      };
    });
  }

  /**
   * Extend the lease. False means the worker no longer holds the job and must stop. The clock is read after
   * the write lock is taken: time spent waiting for the lock counts against the lease, never for it.
   */
  heartbeat(key: string, fence: number, worker: string): boolean {
    return this.#tx(() => {
      const now = this.#now();
      const res = this.#db
        .prepare("UPDATE jobs SET lease_expires = ?, updated = ?, rev = rev + 1 WHERE key = ? AND status = 'claimed' AND fence = ? AND worker = ? AND lease_expires > ?")
        .run(now + this.#leaseMs, now, key, fence, worker, now);
      return Number(res.changes) === 1;
    });
  }

  /**
   * Record success and make this attempt's file the accepted output. Rejected (and recorded) unless the
   * worker still holds the job under the same fencing token.
   */
  complete(key: string, fence: number, worker: string, output: JobOutput | (() => JobOutput)): boolean {
    return this.#tx(() => {
      if (typeof output === "function" && !this.#held(key, fence, worker)) {
        this.#event(key, "rejected-stale", worker, fence);
        return false;
      }
      const accepted = typeof output === "function" ? output() : output;
      const now = this.#now();
      const res = this.#db
        .prepare(
          "UPDATE jobs SET status = 'done', output = ?, output_file = ?, error = NULL, lease_expires = NULL, updated = ?, rev = rev + 1 WHERE key = ? AND status = 'claimed' AND fence = ? AND worker = ? AND lease_expires > ?",
        )
        .run(accepted.sha256, accepted.file, now, key, fence, worker, now);
      const ok = Number(res.changes) === 1;
      this.#event(key, ok ? "completed" : "rejected-stale", worker, fence);
      return ok;
    });
  }

  /** Record a failure by error code. Retryable failures go back to ready until `max_attempts`. */
  fail(key: string, fence: number, worker: string, code: string, retryable: boolean): boolean {
    return this.#tx(() => {
      const row = this.#held(key, fence, worker);
      if (!row) {
        this.#event(key, "rejected-stale", worker, fence, code);
        return false;
      }
      const again = retryable && row.attempts < row.max_attempts;
      this.#db
        .prepare("UPDATE jobs SET status = ?, error = ?, worker = NULL, lease_expires = NULL, updated = ?, rev = rev + 1 WHERE key = ?")
        .run(again ? "ready" : "failed", code, this.#now(), key);
      this.#event(key, again ? "retry" : "failed", worker, fence, code);
      return true;
    });
  }

  /** Give a job back without spending an attempt: an interruption (user activity, shutdown) is not a failure. */
  release(key: string, fence: number, worker: string): boolean {
    return this.#tx(() => {
      if (!this.#held(key, fence, worker)) return false;
      this.#db
        .prepare("UPDATE jobs SET status = 'ready', attempts = attempts - 1, worker = NULL, lease_expires = NULL, updated = ?, rev = rev + 1 WHERE key = ?")
        .run(this.#now(), key);
      this.#event(key, "released", worker, fence);
      return true;
    });
  }

  /** Return expired leases to the queue (or fail them when out of attempts). Returns how many. */
  sweep(): number {
    return this.#tx(() => this.#sweep());
  }

  get(key: string): JobRow | undefined {
    return this.#db
      .prepare("SELECT key, kind, status, attempts, fence, worker, output, output_file AS outputFile, error FROM jobs WHERE key = ?")
      .get(key) as JobRow | undefined;
  }

  /** Input access is scoped to the requesting worker's current, unexpired attempt. */
  holdsInput(key: string, fence: number, worker: string, hash: string): boolean {
    const row = this.#db.prepare("SELECT inputs FROM jobs WHERE key = ? AND status = 'claimed' AND fence = ? AND worker = ? AND lease_expires > ?")
      .get(key, fence, worker, this.#now()) as { inputs: string } | undefined;
    return !!row && (JSON.parse(row.inputs) as string[]).includes(hash);
  }

  events(after: number): JobEvent[] {
    return this.#db
      .prepare("SELECT seq, ts, key, type, worker, fence FROM job_events WHERE seq > ? ORDER BY seq LIMIT 1000")
      .all(after) as unknown as JobEvent[];
  }

  startStatusInstance(): ServiceInstance {
    return this.#tx(() => {
      this.#db.prepare("UPDATE fleet_status_meta SET starts=starts+1, revision=revision+1 WHERE id=1").run();
      const meta = this.#db.prepare("SELECT starts, tracked_at FROM fleet_status_meta WHERE id=1").get() as { starts: number; tracked_at: number };
      return { id: randomUUID(), startedAt: this.#now(), starts: meta.starts, trackedSince: meta.tracked_at };
    });
  }

  recordPresence(worker: string, observation: WorkerObservation): void {
    this.#tx(() => {
      this.#db.prepare("INSERT INTO fleet_presence VALUES (?,?,?) ON CONFLICT(worker) DO UPDATE SET seen_at=excluded.seen_at, data=excluded.data")
        .run(worker, this.#now(), JSON.stringify(observation));
      this.#db.prepare("UPDATE fleet_status_meta SET revision=revision+1 WHERE id=1").run();
    });
  }

  workerControl(worker: string): WorkerControl {
    const row = this.#db.prepare("SELECT paused, revision, intent FROM fleet_controls WHERE worker=?").get(worker) as { paused: number; revision: number; intent: WorkerControl["intent"] } | undefined;
    const held = this.isRecoveryHeld();
    return row ? { ...row, paused: !!row.paused || held, revision: row.revision + (held ? 1 : 0), intent: held ? "pause" : row.intent } : { paused: held, revision: held ? 1 : 0, intent: held ? "pause" : "resume" };
  }

  recoveryState(): { generation: string; hold: boolean; recoveryPoint: string } {
    const row = this.#db.prepare("SELECT generation, hold, recovery_point AS recoveryPoint FROM fleet_recovery WHERE id=1").get() as { generation: string; hold: number; recoveryPoint: string };
    return { ...row, hold: row.hold === 1 };
  }

  isRecoveryHeld(): boolean {
    return (this.#db.prepare("SELECT hold FROM fleet_recovery WHERE id=1").get() as { hold: number }).hold === 1;
  }

  /** A restored service starts paused. No worker control route can clear this hold. */
  establishRecoveryHold(generation: string, recoveryPoint: string): void {
    this.#tx(() => {
      this.#db.prepare("UPDATE fleet_recovery SET generation=?, hold=1, recovery_point=? WHERE id=1").run(generation, recoveryPoint);
      const claimed = this.#db.prepare("SELECT key,worker,fence FROM jobs WHERE status='claimed'").all() as { key:string; worker:string|null; fence:number }[];
      for (const row of claimed) this.#event(row.key,"retired",row.worker,row.fence,`restore:${generation}`);
      this.#db.prepare("UPDATE jobs SET status='ready', worker=NULL, lease_expires=NULL, updated=?, rev=rev+1 WHERE status='claimed'").run(this.#now());
      this.#db.prepare("UPDATE fleet_controls SET paused=1, revision=revision+1, intent='pause'").run();
    });
  }

  releaseRecoveryHold(generation: string, recoveryPoint: string): boolean {
    return this.#tx(() => {
      const state = this.recoveryState();
      if (!state.hold || state.generation !== generation || state.recoveryPoint !== recoveryPoint) return false;
      this.#db.prepare("UPDATE fleet_recovery SET hold=0 WHERE id=1").run();
      this.#db.prepare("UPDATE fleet_status_meta SET revision=revision+1 WHERE id=1").run();
      return true;
    });
  }

  controlWorker(worker: string, intent: WorkerControl["intent"]): WorkerControl {
    return this.#tx(() => {
      if (intent === "resume" && this.isRecoveryHeld()) {
        this.#db.prepare("INSERT INTO fleet_controls VALUES (?,?,1,?) ON CONFLICT(worker) DO UPDATE SET paused=1, revision=fleet_controls.revision+1, intent='pause'")
          .run(worker, 1, "pause");
        this.#db.prepare("UPDATE fleet_status_meta SET revision=revision+1 WHERE id=1").run();
        return this.workerControl(worker);
      }
      this.#db.prepare("INSERT INTO fleet_controls VALUES (?,?,1,?) ON CONFLICT(worker) DO UPDATE SET paused=excluded.paused, revision=fleet_controls.revision+1, intent=excluded.intent")
        .run(worker, intent === "resume" ? 0 : 1, intent);
      this.#db.prepare("UPDATE fleet_status_meta SET revision=revision+1 WHERE id=1").run();
      return this.workerControl(worker);
    });
  }

  /** One bounded operations projection; never serializes a job, input, path, output or error message. */
  statusSnapshot(instance: ServiceInstance, workers: readonly string[], reasons: string[], build: string): ServiceSnapshot {
    return this.#tx(() => {
    const now = Math.floor(this.#now() / 1000) * 1000;
    const meta = this.#db.prepare("SELECT revision, salt FROM fleet_status_meta WHERE id=1").get() as { revision: number; salt: string };
    const cursor = (this.#db.prepare("SELECT COALESCE(MAX(seq),0) AS seq FROM job_events").get() as { seq: number }).seq;
    const queue = { ready: 0, claimed: 0, done: 0, failed: 0 };
    for (const row of this.#db.prepare("SELECT status, COUNT(*) AS n FROM jobs GROUP BY status").all() as { status: keyof typeof queue; n: number }[]) queue[row.status] = row.n;
    const kinds: ServiceSnapshot["kinds"] = [];
    for (const row of this.#db.prepare("SELECT kind,status,COUNT(*) AS n FROM jobs GROUP BY kind,status").all() as { kind: string; status: keyof typeof queue; n: number }[]) {
      const kind = ["read-vision","read-qwen","proof-fixture"].includes(row.kind) ? row.kind : "other";
      let item = kinds.find(k=>k.kind===kind); if (!item) { item={kind,ready:0,claimed:0,done:0,failed:0}; kinds.push(item); } item[row.status]+=row.n;
    }
    const held = this.#db.prepare("SELECT worker, COUNT(*) AS n FROM jobs WHERE status='claimed' AND lease_expires>? GROUP BY worker").all(now) as { worker: string; n: number }[];
    const expired = (this.#db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE status='claimed' AND lease_expires<=?").get(now) as { n: number }).n;
    const events = (this.#db.prepare("SELECT seq,ts,key,type,worker,fence FROM job_events ORDER BY seq DESC LIMIT 25").all() as unknown as JobEvent[]).reverse().map(e => ({
      seq: e.seq, at: e.ts, trace: "t_" + createHash("sha256").update(meta.salt + e.key).digest("base64url").slice(0,16), type: e.type,
      worker: e.worker === null ? null : workers.includes(e.worker) ? e.worker : "other", fence: e.fence,
    }));
    return { schemaVersion: 1, revision: `${instance.starts}.${cursor}.${meta.revision}.${now}.${expired}.${workers.map(id=>{const row=this.#db.prepare("SELECT seen_at FROM fleet_presence WHERE worker=?").get(id) as {seen_at:number}|undefined;return row&&this.#now()-row.seen_at<=30000?"f":"s";}).join("")}`, generatedAt: now, cursor,
      service: { ...instance, version: "0.1.0", build, ready: reasons.length === 0, reasons, uptimeSeconds: Math.max(0, Math.floor((now-instance.startedAt)/1000)) },
      queue, kinds, leases: { active: held.reduce((n,r) => n+r.n,0), expired }, events,
      workers: workers.map(id => {
        const row = this.#db.prepare("SELECT seen_at,data FROM fleet_presence WHERE worker=?").get(id) as { seen_at: number; data: string } | undefined;
        const fresh = !!row && row.seen_at <= this.#now() && this.#now()-row.seen_at <= 30_000;
        const data = row ? JSON.parse(row.data) as WorkerObservation : undefined;
        const control = this.workerControl(id); const heldSlots = held.find(r => r.worker === id)?.n ?? 0;
        return { id, seenAt: row?.seen_at ?? null, freshness: fresh ? "fresh" : row ? "stale" : "unknown",
          phase: fresh ? control.paused ? heldSlots ? "draining" : "paused" : data!.phase : "unknown",
          eligibility: fresh ? control.paused ? "operator-paused" : data!.eligibility : "unknown",
          handlers: fresh ? data!.handlers : [], busy: fresh ? data!.busy : null, heldSlots, control,
          ...(fresh && data!.errorCode ? { errorCode: data!.errorCode } : {}), };
      }), backup: { state: "unqualified", lastVerifiedAt: null }, };
    });
  }

  publicEvents(after: number, workers: readonly string[]): { schemaVersion: number; cursor: number; events: ServiceSnapshot["events"]; hasMore: boolean } {
    const meta=this.#db.prepare("SELECT salt FROM fleet_status_meta WHERE id=1").get() as {salt:string};
    const rows=this.events(after).slice(0,100);
    const events=rows.map(e=>({seq:e.seq,at:e.ts,trace:"t_"+createHash("sha256").update(meta.salt+e.key).digest("base64url").slice(0,16),type:e.type,worker:e.worker===null?null:workers.includes(e.worker)?e.worker:"other",fence:e.fence}));
    const cursor=rows.at(-1)?.seq??after;
    const latest=(this.#db.prepare("SELECT COALESCE(MAX(seq),0) AS n FROM job_events").get() as {n:number}).n;
    return {schemaVersion:1,cursor,events,hasMore:latest>cursor};
  }

  /** The morning report: aggregates only (kinds, workers, counts, error codes). */
  report(since = 0): JobReport {
    const until = this.#now();
    const byKind: JobReport["now"]["byKind"] = Object.create(null);
    for (const r of this.#db.prepare("SELECT kind, status, COUNT(*) AS n FROM jobs GROUP BY kind, status").all() as { kind: string; status: JobStatus; n: number }[]) {
      byKind[r.kind] ??= { ready: 0, claimed: 0, done: 0, failed: 0 };
      byKind[r.kind]![r.status] = r.n;
    }
    const failures = this.#db
      .prepare("SELECT kind, error, COUNT(*) AS count FROM jobs WHERE status = 'failed' GROUP BY kind, error ORDER BY count DESC")
      .all() as { kind: string; error: string; count: number }[];
    const oldest = this.#db.prepare("SELECT MIN(created) AS t FROM jobs WHERE status = 'ready'").get() as { t: number | null };

    const events: JobReport["period"]["events"] = {};
    const byWorker: JobReport["period"]["byWorker"] = Object.create(null);
    const forWorker = (w: string): WorkerPeriod =>
      (byWorker[w] ??= { completed: 0, failed: 0, released: 0, leaseExpired: 0, retired: 0, staleRejected: 0, machineSeconds: 0 });
    // Leased time inside the window [since, until], never negative (a future `since` gives zero).
    const leased = (start: number, end: number): number => Math.max(0, Math.min(end, until) - Math.max(start, since)) / 1000;
    // Open attempts (`key#fence` → worker and lease start), seeded from claims before the period whose end,
    // if any, falls inside it: an attempt that crosses `since` counts from `since`.
    const open = new Map<string, { worker: string; start: number }>();
    const rows = this.#db.prepare("SELECT ts, key, type, worker, fence, detail FROM job_events WHERE worker IS NOT NULL ORDER BY seq").all() as {
      ts: number;
      key: string;
      type: JobEventType;
      worker: string;
      fence: number;
      detail: string | null;
    }[];
    const ends: Partial<Record<JobEventType, keyof WorkerPeriod>> = {
      completed: "completed",
      failed: "failed",
      retry: "failed",
      released: "released",
      "lease-expired": "leaseExpired",
      retired: "retired",
    };
    for (const e of rows) {
      const attempt = `${e.key}#${e.fence}`;
      if (e.type === "claimed") {
        open.set(attempt, { worker: e.worker, start: e.ts });
        if (e.ts >= since) events.claimed = (events.claimed ?? 0) + 1;
        continue;
      }
      if (e.ts < since) {
        if (ends[e.type]) open.delete(attempt);
        continue;
      }
      events[e.type] = (events[e.type] ?? 0) + 1;
      if (e.type === "rejected-stale") forWorker(e.worker).staleRejected += 1;
      const counter = ends[e.type];
      const held = open.get(attempt);
      if (!counter || !held) continue;
      const w = forWorker(held.worker);
      w[counter] += 1;
      // An expired lease ended when it ran out (recorded by the sweep), not when the sweep noticed.
      // A retired claim ended at retirement or its lease expiry, whichever was first (`schema-v1:claimed:<expiry>`).
      const expiry =
        e.detail === null ? NaN : e.type === "lease-expired" ? Number(e.detail) : e.type === "retired" ? Number(e.detail.split(":")[2]) : NaN;
      const end = Number.isFinite(expiry) ? Math.min(e.ts, expiry) : e.ts;
      w.machineSeconds += leased(held.start, end);
      open.delete(attempt);
    }
    // Attempts still claimed count up to now or their current lease expiry, whichever is first: an expired
    // lease that no sweep has noticed yet stops counting when it ran out.
    const leases = new Map(
      (this.#db.prepare("SELECT key, fence, lease_expires FROM jobs WHERE status = 'claimed'").all() as { key: string; fence: number; lease_expires: number }[]).map(
        (r) => [`${r.key}#${r.fence}`, r.lease_expires],
      ),
    );
    for (const [attempt, held] of open) forWorker(held.worker).machineSeconds += leased(held.start, leases.get(attempt) ?? until);
    // Events with no worker (admission, retiring an unclaimed job) are counted here.
    for (const r of this.#db
      .prepare("SELECT type, COUNT(*) AS n FROM job_events WHERE worker IS NULL AND ts >= ? GROUP BY type")
      .all(since) as { type: JobEventType; n: number }[])
      events[r.type] = (events[r.type] ?? 0) + r.n;

    return {
      now: { at: until, byKind, failures, oldestReadyAgeSeconds: oldest.t === null ? null : Math.round((until - oldest.t) / 1000) },
      period: { since, until, events, byWorker },
    };
  }

  #held(key: string, fence: number, worker: string): { attempts: number; max_attempts: number } | undefined {
    return this.#db
      .prepare("SELECT attempts, max_attempts FROM jobs WHERE key = ? AND status = 'claimed' AND fence = ? AND worker = ? AND lease_expires > ?")
      .get(key, fence, worker, this.#now()) as { attempts: number; max_attempts: number } | undefined;
  }

  #sweep(): number {
    const now = this.#now();
    const expired = this.#db
      .prepare("SELECT key, worker, fence, attempts, max_attempts, lease_expires FROM jobs WHERE status = 'claimed' AND lease_expires <= ?")
      .all(now) as { key: string; worker: string; fence: number; attempts: number; max_attempts: number; lease_expires: number }[];
    for (const r of expired) {
      const again = r.attempts < r.max_attempts;
      this.#db
        .prepare("UPDATE jobs SET status = ?, error = ?, worker = NULL, lease_expires = NULL, updated = ?, rev = rev + 1 WHERE key = ?")
        .run(again ? "ready" : "failed", again ? null : "lease-expired", now, r.key);
      // The detail is when the lease actually ran out, which the report uses, not when the sweep noticed.
      this.#event(r.key, "lease-expired", r.worker, r.fence, String(r.lease_expires));
    }
    return expired.length;
  }

  #event(key: string, type: JobEventType, worker: string | null, fence: number, detail?: string): void {
    this.#db.prepare("INSERT INTO job_events (ts, key, type, worker, fence, detail) VALUES (?, ?, ?, ?, ?, ?)").run(this.#now(), key, type, worker, fence, detail ?? null);
  }

  #tx<T>(fn: () => T): T {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      this.#db.exec("COMMIT");
      return out;
    } catch (e) {
      this.#db.exec("ROLLBACK");
      throw e;
    }
  }
}

/** Runs one job; resolves to the attempt's output (see {@link writeOutput}). Must stop promptly when `signal` aborts. */
export type JobHandler = (job: Claim, ctx: { signal: AbortSignal; outDir: string }) => Promise<JobOutput>;

/** A handler failure with an error code (never message text that could carry reader output). */
export class JobError extends Error {
  override readonly name = "JobError";
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, retryable: boolean) {
    super(code);
    this.code = code;
    this.retryable = retryable;
  }
}

export interface WorkerOptions {
  worker: string;
  caps: readonly string[];
  handlers: Readonly<Record<string, JobHandler>>;
  outDir: string;
  /** Default: a third of the store's lease. */
  heartbeatMs?: number;
  /** Stop after this many jobs. Default: until the queue has nothing this worker can run. */
  maxJobs?: number;
  /** Aborting releases the current job (an interruption, not a failure) and stops the loop. */
  signal?: AbortSignal;
  log?: (line: string) => void;
}

export interface WorkerSummary {
  completed: number;
  failed: number;
  staleRejected: number;
  released: number;
}

/** Claim and run jobs one at a time until the queue is empty for this worker, `maxJobs` is reached, or `signal` aborts. */
export async function runWorker(store: JobStore, options: WorkerOptions): Promise<WorkerSummary> {
  const summary: WorkerSummary = { completed: 0, failed: 0, staleRejected: 0, released: 0 };
  const log = options.log ?? (() => {});
  const kinds = Object.keys(options.handlers);
  while (!options.signal?.aborted && (options.maxJobs === undefined || summary.completed + summary.failed + summary.staleRejected < options.maxJobs)) {
    const job = store.claim(options.worker, options.caps, kinds);
    if (!job) break;
    const handler = options.handlers[job.kind]!;
    const lost = new AbortController();
    const signal = options.signal ? AbortSignal.any([lost.signal, options.signal]) : lost.signal;
    const beat = setInterval(() => {
      if (!store.heartbeat(job.key, job.fence, options.worker)) lost.abort();
    }, options.heartbeatMs ?? 60_000);
    const t0 = Date.now();
    try {
      const output = await handler(job, { signal, outDir: options.outDir });
      if (options.signal?.aborted && !lost.signal.aborted) {
        store.release(job.key, job.fence, options.worker);
        summary.released += 1;
      } else if (store.complete(job.key, job.fence, options.worker, output)) {
        summary.completed += 1;
        log(`jobs: ${job.kind} ${job.key.slice(0, 12)} done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      } else {
        summary.staleRejected += 1;
        log(`jobs: ${job.kind} ${job.key.slice(0, 12)} completion rejected: lease lost`);
      }
    } catch (e) {
      if (options.signal?.aborted && !lost.signal.aborted) {
        store.release(job.key, job.fence, options.worker);
        summary.released += 1;
      } else {
        const code = e instanceof JobError ? e.code : "handler-error";
        const retryable = e instanceof JobError ? e.retryable : true;
        if (store.fail(job.key, job.fence, options.worker, code, retryable)) summary.failed += 1;
        else summary.staleRejected += 1;
        log(`jobs: ${job.kind} ${job.key.slice(0, 12)} failed: ${code}`);
      }
    } finally {
      clearInterval(beat);
    }
  }
  return summary;
}
