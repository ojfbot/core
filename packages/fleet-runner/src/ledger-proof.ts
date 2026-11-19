import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  constants,
  closeSync,
  fstatSync,
  openSync,
  readFileSync,
  readdirSync,
  lstatSync,
} from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type * as SQLite from "node:sqlite";
import { canonicalJson, jobKey, type Claim, type JobSpec } from "./jobs.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof SQLite;
export const LEDGER_RESULT = '{"events":21,"identical":true,"differences":[]}\n';
export const proofHash = (bytes: string | Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");
export interface LedgerProof {
  schemaVersion: 1;
  proofId: string;
  approvalExpiresAtMs: number;
  startsAtMs: number;
  endsAtMs: number;
  code: string;
  fixtureSha256: string;
  timeZone: string;
  primary: string;
  fallback: string;
  capability: string;
  attendedWindow?: { notBeforeMs: number; expiresAtMs: number };
  faultMode?: "worker-stop";
}
function fail(): never {
  throw Error("invalid-ledger-proof");
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}
export function exact(value: unknown, keys: string[]): Record<string, unknown> {
  const row = object(value);
  if (Object.keys(row).sort().join(",") !== keys.sort().join(",")) fail();
  return row;
}
export function string(value: unknown, pattern?: RegExp): string {
  if (
    typeof value !== "string" ||
    !value ||
    value.includes("\0") ||
    (pattern && !pattern.test(value))
  )
    fail();
  return value;
}
export function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) fail();
  return value;
}
export function privatePath(value: unknown): string {
  const file = string(value);
  if (!isAbsolute(file) || resolve(file) !== file) fail();
  return file;
}
export function readPrivateJson(file: string, limit = 64 * 1024): unknown {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    if (
      !info.isFile() ||
      info.uid !== process.getuid?.() ||
      (info.mode & 0o077) !== 0 ||
      info.size > limit
    )
      fail();
    return JSON.parse(readFileSync(fd, "utf8")) as unknown;
  } finally {
    closeSync(fd);
  }
}
export function parseLedgerProof(value: unknown): LedgerProof {
  const hasAttendedWindow = Object.hasOwn(object(value), "attendedWindow");
  const hasFaultMode = Object.hasOwn(object(value), "faultMode");
  const row = exact(value, [
    "schemaVersion",
    "proofId",
    "approvalExpiresAtMs",
    "startsAtMs",
    "endsAtMs",
    "code",
    "fixtureSha256",
    "timeZone",
    "primary",
    "fallback",
    "capability",
    ...(hasAttendedWindow ? ["attendedWindow"] : []),
    ...(hasFaultMode ? ["faultMode"] : []),
  ]);
  if (row.schemaVersion !== 1) fail();
  const proof: LedgerProof = {
    schemaVersion: 1,
    proofId: string(
      row.proofId,
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    ),
    approvalExpiresAtMs: integer(row.approvalExpiresAtMs),
    startsAtMs: integer(row.startsAtMs),
    endsAtMs: integer(row.endsAtMs),
    code: string(row.code, /^[a-f0-9]{40}$/),
    fixtureSha256: string(row.fixtureSha256, /^[a-f0-9]{64}$/),
    timeZone: string(row.timeZone),
    primary: string(row.primary, /^cg307-primary-[a-f0-9]{8}$/),
    fallback: string(row.fallback, /^cg307-fallback-[a-f0-9]{8}$/),
    capability: string(row.capability, /^cg307-ledger-[a-f0-9]{8}$/),
  };
  new Intl.DateTimeFormat("en-US", { timeZone: proof.timeZone }).format(proof.startsAtMs);
  const suffix = proof.proofId.slice(0, 8);
  if (
    proof.primary !== `cg307-primary-${suffix}` ||
    proof.fallback !== `cg307-fallback-${suffix}` ||
    proof.capability !== `cg307-ledger-${suffix}` ||
    proof.endsAtMs <= proof.startsAtMs ||
    proof.endsAtMs - proof.startsAtMs > 90 * 60_000 ||
    proof.endsAtMs > proof.approvalExpiresAtMs
  )
    fail();
  if (hasAttendedWindow) {
    const window = exact(row.attendedWindow, ["notBeforeMs", "expiresAtMs"]);
    const notBeforeMs = integer(window.notBeforeMs);
    const expiresAtMs = integer(window.expiresAtMs);
    if (
      proof.timeZone !== "America/Chicago" ||
      expiresAtMs !== proof.approvalExpiresAtMs ||
      expiresAtMs <= notBeforeMs ||
      expiresAtMs - notBeforeMs > 90 * 60_000 ||
      proof.startsAtMs - 180_000 < notBeforeMs ||
      proof.endsAtMs >= expiresAtMs ||
      proof.endsAtMs - proof.startsAtMs > 30 * 60_000
    )
      fail();
    proof.attendedWindow = { notBeforeMs, expiresAtMs };
  }
  if (hasFaultMode) {
    if (row.faultMode !== "worker-stop" || !proof.attendedWindow) fail();
    proof.faultMode = row.faultMode;
  }
  return proof;
}
export function ledgerSpec(proof: LedgerProof, sentinel = false): JobSpec {
  return {
    kind: sentinel ? "bookcase-ledger-sentinel" : "bookcase-ledger-replay",
    inputs: [],
    params: { fixtureVersion: 1, fixtureSha256: proof.fixtureSha256, proofId: proof.proofId },
    code: proof.code,
    payload: null,
    requires: [sentinel ? `${proof.capability}-unreachable` : proof.capability],
    priority: 0,
    maxAttempts: sentinel ? 1 : 2,
  };
}
export function proofSnapshotSchema(proof: LedgerProof, schema: number): boolean {
  return schema === 4 || (proof.faultMode === "worker-stop" && schema === 5);
}
export function verifyClaim(
  proof: LedgerProof,
  claim: Claim,
  role: "primary" | "fallback",
  now: number,
): void {
  const spec = ledgerSpec(proof);
  if (
    now < proof.startsAtMs ||
    now >= proof.endsAtMs ||
    claim.key !== jobKey(spec) ||
    claim.kind !== spec.kind ||
    canonicalJson(claim.inputs) !== "[]" ||
    canonicalJson(claim.params) !== canonicalJson(spec.params) ||
    claim.code !== proof.code ||
    claim.payload !== null ||
    claim.fence !== (role === "primary" ? 1 : 2) ||
    !Number.isSafeInteger(claim.leaseExpires) ||
    claim.leaseExpires <= now ||
    claim.leaseExpires > now + 301_000
  )
    throw Error("proof-claim-mismatch");
}
export function nightEligible(now: number, timeZone: string): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  return hour >= 20 || hour < 7;
}
export function proofTimeEligible(now: number, proof: LedgerProof): boolean {
  const window = proof.attendedWindow;
  return window
    ? now >= window.notBeforeMs && now < window.expiresAtMs
    : nightEligible(now, proof.timeZone);
}
export function directoryBytes(root: string, cap: number): number {
  let total = 0;
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry),
        stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw Error("proof-symlink-refused");
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) {
        total += stat.size;
        if (total > cap) throw Error("proof-quota-exhausted");
      } else throw Error("proof-special-file-refused");
    }
  };
  visit(root);
  return total;
}

export interface ProofRow {
  key: string;
  spec: JobSpec;
  status: string;
  attempts: number;
  fence: number;
  worker: string | null;
  leaseExpires: number | null;
  output: string | null;
  outputFile: string | null;
}
export interface ProofSnapshot {
  schema: number;
  serverNowMs: number;
  rows: ProofRow[];
  events: {
    seq: number;
    ts: number;
    key: string;
    type: string;
    worker: string | null;
    fence: number | null;
    leaseExpiredAtMs: number | null;
  }[];
  accepted: string | null;
}
/** Existing operator route calls this against ONLY the disposable state. Never opens JobStore or migrates it. */
export function readProofSnapshot(database: string, outputs: string): ProofSnapshot {
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    db.exec("BEGIN");
    const schema = integer(db.prepare("PRAGMA user_version").get()!.user_version);
    if (schema !== 4 && schema !== 5) throw Error("proof-schema-mismatch");
    const raw = db.prepare("SELECT * FROM jobs ORDER BY key LIMIT 3").all();
    if (raw.length > 2) throw Error("proof-queue-not-isolated");
    if (
      raw.some(
        (r) =>
          !["bookcase-ledger-replay", "bookcase-ledger-sentinel"].includes(String(r.kind)) ||
          r.payload !== "null" ||
          r.inputs !== "[]",
      )
    )
      throw Error("proof-queue-not-synthetic");
    const rows = raw.map(
      (r): ProofRow => ({
        key: string(r.key),
        spec: {
          kind: string(r.kind),
          inputs: JSON.parse(string(r.inputs)),
          params: JSON.parse(string(r.params)),
          code: string(r.code),
          payload: JSON.parse(string(r.payload)),
          requires: JSON.parse(string(r.requires)),
          priority: integer(r.priority),
          maxAttempts: integer(r.max_attempts),
        },
        status: string(r.status),
        attempts: integer(r.attempts),
        fence: integer(r.fence),
        worker: r.worker === null ? null : string(r.worker),
        leaseExpires: r.lease_expires === null ? null : integer(r.lease_expires),
        output: r.output === null ? null : string(r.output),
        outputFile: r.output_file === null ? null : string(r.output_file),
      }),
    );
    const events = db
      .prepare(
        "SELECT seq,ts,key,type,worker,fence,CASE WHEN type='lease-expired' THEN CAST(detail AS INTEGER) ELSE NULL END AS leaseExpiredAtMs FROM job_events ORDER BY seq LIMIT 257",
      )
      .all() as ProofSnapshot["events"];
    if (events.length > 256) throw Error("proof-event-quota-exhausted");
    const done = rows.filter((r) => r.status === "done");
    if (done.length > 1) throw Error("proof-output-mismatch");
    let accepted: string | null = null;
    if (done[0]) {
      const row = done[0];
      if (row.outputFile !== `${row.key}.${row.fence}.jsonl`) throw Error("proof-output-mismatch");
      const fd = openSync(join(outputs, row.outputFile), constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        if (fstatSync(fd).size > 4096) throw Error("proof-output-too-large");
        accepted = readFileSync(fd).toString("base64");
      } finally {
        closeSync(fd);
      }
    }
    db.exec("COMMIT");
    return { schema, serverNowMs: Date.now(), rows, events, accepted };
  } finally {
    db.close();
  }
}
export function verifyAdmission(proof: LedgerProof, snapshot: ProofSnapshot): void {
  const specs = [ledgerSpec(proof), ledgerSpec(proof, true)];
  if (
    !proofSnapshotSchema(proof, snapshot.schema) ||
    snapshot.rows.length !== 2 ||
    !Number.isSafeInteger(snapshot.serverNowMs)
  )
    throw Error("proof-admission-mismatch");
  if (snapshot.events.some((event) => !specs.some((spec) => jobKey(spec) === event.key)))
    throw Error("proof-foreign-events");
  for (const spec of specs) {
    const row = snapshot.rows.find((r) => r.key === jobKey(spec));
    if (!row || canonicalJson(row.spec) !== canonicalJson(spec))
      throw Error("proof-admission-mismatch");
  }
}
export function verifyAccepted(proof: LedgerProof, snapshot: ProofSnapshot): ProofRow {
  verifyAdmission(proof, snapshot);
  const row = snapshot.rows.find((r) => r.key === jobKey(ledgerSpec(proof)))!;
  const sentinel = snapshot.rows.find((r) => r.key === jobKey(ledgerSpec(proof, true)))!;
  const claims = snapshot.events.filter((e) => e.key === row.key && e.type === "claimed");
  if (
    row.status !== "done" ||
    row.attempts !== 2 ||
    row.fence !== 2 ||
    row.worker !== proof.fallback ||
    row.output !== proofHash(LEDGER_RESULT) ||
    snapshot.accepted !== Buffer.from(LEDGER_RESULT).toString("base64") ||
    row.outputFile !== `${row.key}.2.jsonl` ||
    sentinel.status !== "ready" ||
    sentinel.attempts !== 0 ||
    claims.length !== 2 ||
    claims[0]?.worker !== proof.primary ||
    claims[0]?.fence !== 1 ||
    claims[1]?.worker !== proof.fallback ||
    claims[1]?.fence !== 2 ||
    snapshot.events.filter((e) => e.key === row.key && e.type === "completed").length !== 1
  )
    throw Error("proof-acceptance-mismatch");
  return row;
}
