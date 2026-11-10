import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import type * as SQLite from "node:sqlite";
import { JOBS_SCHEMA_VERSION, JobStore } from "./jobs.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof SQLite;
const sha = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const HASH = /^[a-f0-9]{64}$/;
const OUTPUT = /^[a-f0-9]{64}\.[0-9]+\.jsonl$/;
type InputEntry = { hash: string; size: number };
type OutputEntry = { key: string; file: string; sha256: string; size: number };
export interface RecoveryManifest {
  format: "fleet-runner-recovery-v1";
  source: "fleet-runner";
  capturedAt: string;
  schemaVersion: number;
  recoveryPoint: { eventCursor: number; jobs: number; acceptedResults: number };
  database: { file: "fleet.sqlite"; sha256: string; size: number };
  inputs: InputEntry[];
  outputs: OutputEntry[];
}

function regularBytes(path: string): Buffer {
  if (!lstatSync(path).isFile()) throw new Error("recovery-material-not-regular-file");
  return readFileSync(path);
}
function syncDir(path: string): void {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function syncTree(path: string): void {
  const entries = readdirSync(path);
  for (const entry of entries) {
    const child = join(path, entry);
    const info = lstatSync(child);
    if (info.isDirectory()) syncTree(child);
    else if (info.isFile()) {
      const fd = openSync(child, "r");
      try {
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    } else throw new Error("recovery-material-not-regular-file");
  }
  syncDir(path);
}
function ensureDistinct(destination: string, sources: string[]): void {
  const dest = resolve(destination);
  for (const source of sources) {
    const src = resolve(source);
    if (dest === src || dest.startsWith(`${src}/`) || src.startsWith(`${dest}/`))
      throw new Error("recovery-destination-not-independent");
  }
}

/** Create one immutable bundle from an SQLite-consistent snapshot and hash-addressed files. */
export function createRecoveryBundle(
  dbPath: string,
  outputDir: string,
  inputDir: string | undefined,
  destination: string,
): RecoveryManifest {
  if (dbPath === ":memory:" || !existsSync(dbPath))
    throw new Error("recovery-source-database-missing");
  const sources = [dbPath, outputDir, ...(inputDir ? [inputDir] : [])];
  ensureDistinct(destination, sources);
  if (existsSync(destination)) throw new Error("recovery-destination-exists");
  const parent = dirname(resolve(destination));
  mkdirSync(parent, { recursive: true });
  const stage = join(parent, `.${basename(destination)}.${randomUUID()}.tmp`);
  mkdirSync(stage, { mode: 0o700 });
  try {
    const dbTarget = join(stage, "fleet.sqlite");
    const live = new DatabaseSync(dbPath);
    try {
      live.exec(`VACUUM INTO '${dbTarget.replaceAll("'", "''")}'`);
    } finally {
      live.close();
    }
    const snap = new DatabaseSync(dbTarget, { readOnly: true });
    let inputs: InputEntry[];
    let outputs: OutputEntry[];
    let recoveryPoint: RecoveryManifest["recoveryPoint"];
    try {
      const version = (snap.prepare("PRAGMA user_version").get() as { user_version: number })
        .user_version;
      if (version !== JOBS_SCHEMA_VERSION) throw new Error("recovery-source-schema-incompatible");
      const jobs = snap
        .prepare("SELECT key,status,inputs,output,output_file FROM jobs ORDER BY key")
        .all() as {
        key: string;
        status: string;
        inputs: string;
        output: string | null;
        output_file: string | null;
      }[];
      const inputHashes = [
        ...new Set(jobs.flatMap((j) => JSON.parse(j.inputs) as string[])),
      ].sort();
      inputs = inputHashes.map((hash) => {
        if (!HASH.test(hash) || !inputDir) throw new Error("recovery-required-input-missing");
        const bytes = regularBytes(join(inputDir, hash));
        if (sha(bytes) !== hash) throw new Error("recovery-required-input-corrupt");
        mkdirSync(join(stage, "inputs"), { recursive: true, mode: 0o700 });
        writeFileSync(join(stage, "inputs", hash), bytes, { mode: 0o400, flag: "wx" });
        return { hash, size: bytes.length };
      });
      outputs = jobs
        .filter((j) => j.status === "done")
        .map((j) => {
          if (!j.output || !j.output_file || !OUTPUT.test(j.output_file))
            throw new Error("recovery-accepted-result-incomplete");
          const bytes = regularBytes(join(outputDir, j.output_file));
          if (sha(bytes) !== j.output) throw new Error("recovery-accepted-result-corrupt");
          mkdirSync(join(stage, "outputs"), { recursive: true, mode: 0o700 });
          writeFileSync(join(stage, "outputs", j.output_file), bytes, { mode: 0o400, flag: "wx" });
          return { key: j.key, file: j.output_file, sha256: j.output, size: bytes.length };
        });
      const eventCursor = (
        snap.prepare("SELECT COALESCE(MAX(seq),0) n FROM job_events").get() as { n: number }
      ).n;
      recoveryPoint = { eventCursor, jobs: jobs.length, acceptedResults: outputs.length };
    } finally {
      snap.close();
    }
    const dbBytes = regularBytes(dbTarget);
    const manifest: RecoveryManifest = {
      format: "fleet-runner-recovery-v1",
      source: "fleet-runner",
      capturedAt: new Date().toISOString(),
      schemaVersion: JOBS_SCHEMA_VERSION,
      recoveryPoint,
      database: { file: "fleet.sqlite", sha256: sha(dbBytes), size: dbBytes.length },
      inputs,
      outputs,
    };
    writeFileSync(join(stage, "recovery-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
    syncTree(stage);
    renameSync(stage, resolve(destination));
    try {
      const verified = verifyRecoveryBundle(resolve(destination));
      syncDir(parent);
      return verified;
    } catch (error) {
      rmSync(resolve(destination), { recursive: true, force: true });
      syncDir(parent);
      throw error;
    }
  } catch (error) {
    rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}

export function verifyRecoveryBundle(bundle: string): RecoveryManifest {
  const manifestBytes = regularBytes(join(bundle, "recovery-manifest.json"));
  const m = JSON.parse(manifestBytes.toString("utf8")) as RecoveryManifest;
  if (
    m.format !== "fleet-runner-recovery-v1" ||
    m.source !== "fleet-runner" ||
    m.schemaVersion !== JOBS_SCHEMA_VERSION ||
    m.database?.file !== "fleet.sqlite" ||
    !Array.isArray(m.inputs) ||
    !Array.isArray(m.outputs)
  )
    throw new Error("recovery-manifest-incompatible");
  if (
    !m.database.sha256 ||
    !Number.isSafeInteger(m.database.size) ||
    !m.recoveryPoint ||
    !Number.isSafeInteger(m.recoveryPoint.eventCursor)
  )
    throw new Error("recovery-manifest-invalid");
  const db = regularBytes(join(bundle, "fleet.sqlite"));
  if (db.length !== m.database.size || sha(db) !== m.database.sha256)
    throw new Error("recovery-database-hash-mismatch");
  const check = new DatabaseSync(join(bundle, "fleet.sqlite"), { readOnly: true });
  try {
    const version = (check.prepare("PRAGMA user_version").get() as { user_version: number })
      .user_version;
    const integrity = (check.prepare("PRAGMA integrity_check").get() as { integrity_check: string })
      .integrity_check;
    if (version !== JOBS_SCHEMA_VERSION) throw new Error("recovery-database-schema-incompatible");
    if (integrity !== "ok") throw new Error("recovery-database-integrity-failed");
    const rows = check.prepare("SELECT key,status,output,output_file,inputs FROM jobs").all() as {
      key: string;
      status: string;
      output: string | null;
      output_file: string | null;
      inputs: string;
    }[];
    const requiredInputs = new Set(rows.flatMap((r) => JSON.parse(r.inputs) as string[]));
    const accepted = new Map(rows.filter((r) => r.status === "done").map((r) => [r.key, r]));
    if (
      requiredInputs.size !== m.inputs.length ||
      m.inputs.some((i) => !requiredInputs.has(i.hash) || !HASH.test(i.hash))
    )
      throw new Error("recovery-input-set-mismatch");
    if (accepted.size !== m.outputs.length) throw new Error("recovery-output-set-mismatch");
    for (const i of m.inputs) {
      const bytes = regularBytes(join(bundle, "inputs", i.hash));
      if (bytes.length !== i.size || sha(bytes) !== i.hash)
        throw new Error("recovery-input-hash-mismatch");
    }
    for (const o of m.outputs) {
      const row = accepted.get(o.key);
      if (!row || row.output !== o.sha256 || row.output_file !== o.file || !OUTPUT.test(o.file))
        throw new Error("recovery-output-reference-mismatch");
      const bytes = regularBytes(join(bundle, "outputs", o.file));
      if (bytes.length !== o.size || sha(bytes) !== o.sha256)
        throw new Error("recovery-output-hash-mismatch");
    }
  } finally {
    check.close();
  }
  const allowed = new Set(["fleet.sqlite", "recovery-manifest.json", "inputs", "outputs"]);
  if (readdirSync(bundle).some((name) => !allowed.has(name)))
    throw new Error("recovery-unexpected-material");
  return m;
}

/** Restore to a nonexistent target. Validation and hold installation finish in a sibling stage before publication. */
export function restoreRecoveryBundle(
  bundle: string,
  destination: string,
): { generation: string; recoveryPoint: RecoveryManifest["recoveryPoint"]; holdToken: string } {
  const manifest = verifyRecoveryBundle(bundle);
  if (existsSync(destination)) throw new Error("restore-destination-must-be-empty-new-state");
  const parent = dirname(resolve(destination));
  mkdirSync(parent, { recursive: true });
  const stage = join(parent, `.${basename(destination)}.${randomUUID()}.tmp`);
  mkdirSync(stage, { mode: 0o700 });
  const generation = randomUUID();
  try {
    copyFileSync(join(bundle, "fleet.sqlite"), join(stage, "fleet.sqlite"));
    copyFileSync(join(bundle, "recovery-manifest.json"), join(stage, "recovery-manifest.json"));
    chmodSync(join(stage, "recovery-manifest.json"), 0o600);
    for (const [kind, entries] of [
      ["inputs", manifest.inputs.map((i) => i.hash)],
      ["outputs", manifest.outputs.map((o) => o.file)],
    ] as const) {
      if (entries.length) mkdirSync(join(stage, kind), { mode: 0o700 });
      for (const file of entries) copyFileSync(join(bundle, kind, file), join(stage, kind, file));
    }
    const store = new JobStore(join(stage, "fleet.sqlite"));
    const holdToken = JSON.stringify({
      manifestSha256: sha(regularBytes(join(bundle, "recovery-manifest.json"))),
      ...manifest.recoveryPoint,
    });
    try {
      store.establishRecoveryHold(generation, holdToken);
    } finally {
      store.close();
    }
    syncTree(stage);
    renameSync(stage, resolve(destination));
    syncDir(parent);
    return { generation, recoveryPoint: manifest.recoveryPoint, holdToken };
  } catch (error) {
    rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}
