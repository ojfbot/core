import { createRequire } from "node:module";
import { closeSync, existsSync, lstatSync, openSync } from "node:fs";
import type * as SQLite from "node:sqlite";
import { canonicalJson } from "./jobs.js";
import { proofHash } from "./ledger-proof.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof SQLite;
/** One epoch per file. Initialization is explicit; removing state never grants a new epoch. */
export class ProofJournal {
  readonly db: SQLite.DatabaseSync;
  constructor(
    file: string,
    readonly binding: unknown,
    initialize = false,
  ) {
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
    this.db = new DatabaseSync(file, { open: true });
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA fullfsync=ON; PRAGMA checkpoint_fullfsync=ON; PRAGMA busy_timeout=5000;",
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
  put(name: string, value: unknown): void {
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
