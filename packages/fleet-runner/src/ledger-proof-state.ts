import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { closeSync, existsSync, lstatSync, openSync } from "node:fs";
import type * as SQLite from "node:sqlite";
import { canonicalJson } from "./jobs.js";
import { exact, object, proofHash, string } from "./ledger-proof.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof SQLite;
/** One epoch per file. Initialization is explicit; removing state never grants a new epoch. */
export class ProofJournal {
  readonly db: SQLite.DatabaseSync;
  constructor(
    file: string,
    readonly binding: unknown,
    initialize = false,
    readOnly = false,
  ) {
    if (initialize && readOnly) throw Error("proof-state-initialization-mismatch");
    if (initialize === existsSync(file)) throw Error("proof-state-initialization-mismatch");
    if (!initialize) {
      const stat = lstatSync(file);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.uid !== process.getuid?.() ||
        stat.mode & 0o077
      )
        throw Error("unsafe-proof-state");
    }
    if (initialize) closeSync(openSync(file, "wx", 0o600));
    this.db = new DatabaseSync(file, { open: true, readOnly });
    this.db.exec(
      readOnly
        ? "PRAGMA busy_timeout=5000;"
        : "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA fullfsync=ON; PRAGMA checkpoint_fullfsync=ON; PRAGMA busy_timeout=5000;",
    );
    if (initialize) {
      this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE binding (id INTEGER PRIMARY KEY CHECK(id=1), digest TEXT NOT NULL);
        CREATE TABLE state (name TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE effects (name TEXT PRIMARY KEY, input_digest TEXT NOT NULL, result TEXT);
        CREATE TABLE observations (seq INTEGER PRIMARY KEY, at_ms INTEGER NOT NULL, kind TEXT NOT NULL, value TEXT NOT NULL);
        CREATE TRIGGER no_observation_update BEFORE UPDATE ON observations BEGIN SELECT RAISE(ABORT,'append only'); END;
        CREATE TRIGGER no_observation_delete BEFORE DELETE ON observations BEGIN SELECT RAISE(ABORT,'append only'); END;`);
      this.db.prepare("INSERT INTO binding VALUES (1,?)").run(proofHash(canonicalJson(binding)));
      this.db.exec("COMMIT");
    }
    if (
      this.db.prepare("SELECT digest FROM binding WHERE id=1").get()?.digest !==
      proofHash(canonicalJson(binding))
    ) {
      this.db.close();
      throw Error("proof-state-binding-mismatch");
    }
  }
  close(): void {
    this.db.close();
  }
  get(name: string): unknown {
    const row = this.db.prepare("SELECT value FROM state WHERE name=?").get(name);
    return row ? (JSON.parse(String(row.value)) as unknown) : undefined;
  }
  setTerminal(value: unknown): boolean {
    return (
      Number(
        this.db
          .prepare("INSERT OR IGNORE INTO state(name,value) VALUES ('terminal',?)")
          .run(canonicalJson(value)).changes,
      ) === 1
    );
  }
  recordPracticeStop(stop: unknown): boolean {
    return (
      this.db
        .prepare(
          `INSERT OR IGNORE INTO state(name,value)
       SELECT 'practice-stop', ?
       WHERE NOT EXISTS (SELECT 1 FROM state WHERE name='terminal')
         AND EXISTS (SELECT 1 FROM effects WHERE name='practice-ready' AND result IS NOT NULL)`,
        )
        .run(canonicalJson(stop)).changes === 1
    );
  }
  recordPracticeFirstFailure(failure: unknown): boolean {
    return (
      this.db
        .prepare("INSERT OR IGNORE INTO state(name,value) VALUES ('practice-first-failure',?)")
        .run(canonicalJson(failure)).changes === 1
    );
  }
  freezeTerminalReport(body: Record<string, unknown>): {
    commandId: string;
    body: Record<string, unknown>;
  } {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      let saved = this.get("terminal-outbox");
      if (saved === undefined) {
        if (this.get("report") !== undefined) throw Error("proof-report-lineage-missing");
        saved = { commandId: randomUUID(), body };
        this.db.prepare("INSERT INTO state VALUES ('terminal-outbox',?)").run(canonicalJson(saved));
        this.db.prepare("INSERT INTO state VALUES ('report',?)").run(canonicalJson(body));
      }
      const record = exact(saved, ["commandId", "body"]);
      const frozen = {
        commandId: string(record.commandId, /^[a-f0-9-]{36}$/),
        body: object(record.body),
      };
      if (canonicalJson(this.get("report")) !== canonicalJson(frozen.body))
        throw Error("proof-report-binding-mismatch");
      this.db.exec("COMMIT");
      return frozen;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  put(name: string, value: unknown): void {
    if (name === "report" || name === "terminal-outbox") throw Error("proof-report-is-immutable");
    if (name === "terminal") {
      this.setTerminal(value);
      return;
    }
    this.db
      .prepare(
        "INSERT INTO state VALUES (?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value",
      )
      .run(name, canonicalJson(value));
  }
  observe(kind: string, value: unknown, now = Date.now()): void {
    this.db
      .prepare("INSERT INTO observations(at_ms,kind,value) VALUES (?,?,?)")
      .run(now, kind, canonicalJson(value));
  }
  progress() {
    return this.db
      .prepare(
        "SELECT seq,at_ms,kind,value FROM observations WHERE kind IN ('progress','held','claimed','computed') ORDER BY seq DESC LIMIT 40",
      )
      .all()
      .reverse()
      .map((row) => ({
        sequence: row.seq,
        atMs: row.at_ms,
        kind: row.kind,
        value: JSON.parse(String(row.value)) as unknown,
      }));
  }
  /** Reservation precedes the external effect. Unknown reservations cannot silently become new effects. */
  reserve(name: string, input: unknown): "new" | "pending" | "done" {
    const digest = proofHash(canonicalJson(input));
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db.prepare("SELECT input_digest,result FROM effects WHERE name=?").get(name);
      if (row && row.input_digest !== digest) throw Error("proof-effect-conflict");
      if (!row) this.db.prepare("INSERT INTO effects VALUES (?,?,NULL)").run(name, digest);
      this.db.exec("COMMIT");
      return !row ? "new" : row.result === null ? "pending" : "done";
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  finish(name: string, result: unknown): void {
    const encoded = canonicalJson(result);
    const row = this.db.prepare("SELECT result FROM effects WHERE name=?").get(name);
    if (!row || (row.result !== null && row.result !== encoded))
      throw Error("proof-effect-conflict");
    this.db
      .prepare("UPDATE effects SET result=? WHERE name=? AND result IS NULL")
      .run(encoded, name);
  }
  result(name: string): unknown {
    const row = this.db.prepare("SELECT result FROM effects WHERE name=?").get(name);
    return row?.result === null || !row ? undefined : (JSON.parse(String(row.result)) as unknown);
  }
  advanceClock(now: number): void {
    const previous = this.get("last-clock");
    if (typeof previous === "number" && now < previous - 1000) throw Error("proof-clock-rollback");
    this.put("last-clock", typeof previous === "number" ? Math.max(previous, now) : now);
  }
}
