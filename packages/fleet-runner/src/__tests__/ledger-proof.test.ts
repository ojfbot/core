import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import type * as SQLite from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { jobKey, JobStore } from "../jobs.js";
import { ProofJournal } from "../ledger-proof-state.js";
import {
  LEDGER_RESULT,
  ledgerSpec,
  nightEligible,
  parseLedgerProof,
  proofHash,
  readProofSnapshot,
  verifyAccepted,
  verifyAdmission,
  verifyClaim,
} from "../ledger-proof.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof SQLite;
const dirs: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-proof-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const starts = Date.UTC(2026, 10, 17, 5, 0);
const proof = parseLedgerProof({
  schemaVersion: 1,
  proofId: "12345678-1234-4234-8234-123456789abc",
  approvalExpiresAtMs: starts + 24 * 3600_000,
  startsAtMs: starts,
  endsAtMs: starts + 90 * 60_000,
  code: "a".repeat(40),
  fixtureSha256: "b".repeat(64),
  timeZone: "America/Chicago",
  primary: "cg307-primary-12345678",
  fallback: "cg307-fallback-12345678",
  capability: "cg307-ledger-12345678",
});

it("binds the full scheduling spec and refuses an unapproved claim before execution", () => {
  const spec = ledgerSpec(proof);
  const claim = {
    key: jobKey(spec),
    kind: spec.kind,
    inputs: [],
    params: spec.params!,
    code: proof.code,
    payload: null,
    fence: 1,
    leaseExpires: starts + 300_000,
  };
  expect(() => verifyClaim(proof, claim, "primary", starts)).not.toThrow();
  for (const changed of [
    { ...claim, key: "c".repeat(64) },
    { ...claim, kind: "other" },
    { ...claim, code: "c".repeat(40) },
    { ...claim, payload: {} },
    { ...claim, inputs: ["x"] },
    { ...claim, params: { ...claim.params, fixtureVersion: 2 } },
    { ...claim, fence: 2 },
  ])
    expect(() => verifyClaim(proof, changed, "primary", starts)).toThrow("proof-claim-mismatch");
  expect(() => verifyClaim(proof, claim, "primary", proof.endsAtMs)).toThrow();
  expect(() => parseLedgerProof({ ...proof, endsAtMs: proof.endsAtMs + 1 })).toThrow();
  expect(() => parseLedgerProof({ ...proof, primary: "yuri" })).toThrow();
});

it("checks the actual readonly stored admission without migrating the pinned schema-4 service", () => {
  const dir = temp(),
    file = join(dir, "jobs.sqlite");
  const store = new JobStore(file);
  store.enqueue(ledgerSpec(proof));
  store.enqueue(ledgerSpec(proof, true));
  store.close();
  const old = new DatabaseSync(file);
  old.exec("PRAGMA user_version=4");
  old.close();
  const seen = readProofSnapshot(file, dir);
  expect(seen.schema).toBe(4);
  expect(() => verifyAdmission(proof, seen)).not.toThrow();
  // requires/maxAttempts do not change the job key, but MUST change this full admission check.
  const altered = {
    ...seen,
    rows: seen.rows.map((r) => ({ ...r, spec: { ...r.spec, maxAttempts: 3 } })),
  };
  expect(altered.rows.map((r) => r.key)).toEqual(seen.rows.map((r) => r.key));
  expect(() => verifyAdmission(proof, altered)).toThrow();
  const db = new DatabaseSync(file, { readOnly: true });
  expect(db.prepare("PRAGMA user_version").get()!.user_version).toBe(4);
  db.close();
});

it("recovers durable effects, rejects changed inputs and retains unknown outcomes", () => {
  const file = join(temp(), "proof.sqlite");
  let journal = new ProofJournal(file, proof, true);
  expect(journal.reserve("admission", ledgerSpec(proof))).toBe("new");
  journal.close();
  journal = new ProofJournal(file, proof);
  expect(journal.reserve("admission", ledgerSpec(proof))).toBe("pending");
  expect(() => journal.reserve("admission", ledgerSpec(proof, true))).toThrow(
    "proof-effect-conflict",
  );
  journal.finish("admission", { key: jobKey(ledgerSpec(proof)) });
  journal.close();
  journal = new ProofJournal(file, proof);
  expect(journal.reserve("admission", ledgerSpec(proof))).toBe("done");
  expect(journal.result("admission")).toEqual({ key: jobKey(ledgerSpec(proof)) });
  journal.advanceClock(starts);
  expect(() => journal.advanceClock(starts - 2000)).toThrow("proof-clock-rollback");
  journal.close();
  expect(() => new ProofJournal(file, { ...proof, endsAtMs: proof.endsAtMs - 1 })).toThrow(
    "proof-state-binding-mismatch",
  );
  expect(() => new ProofJournal(file, proof, true)).toThrow();
});

it("verifies real fencing acceptance and independently rejects changed accepted bytes", () => {
  const dir = temp(),
    file = join(dir, "jobs.sqlite");
  let now = starts;
  const store = new JobStore(file, { now: () => now, leaseMs: 300_000 });
  const spec = ledgerSpec(proof);
  store.enqueue(spec);
  store.enqueue(ledgerSpec(proof, true));
  const primary = store.claim(proof.primary, [proof.capability], [spec.kind])!;
  now += 300_001;
  const fallback = store.claim(proof.fallback, [proof.capability], [spec.kind])!;
  expect(fallback.fence).toBe(2);
  // Store's public completion writes and fences the canonical file.
  expect(
    store.complete(fallback.key, fallback.fence, proof.fallback, {
      sha256: proofHash(LEDGER_RESULT),
      file: `${fallback.key}.2.jsonl`,
    }),
  ).toBe(true);
  expect(
    store.complete(primary.key, primary.fence, proof.primary, {
      sha256: proofHash("wrong"),
      file: `${primary.key}.1.jsonl`,
    }),
  ).toBe(false);
  store.close();
  const db = new DatabaseSync(file);
  db.exec("PRAGMA user_version=4");
  db.close();
  const { writeFileSync } = createRequire(import.meta.url)("node:fs") as typeof import("node:fs");
  writeFileSync(join(dir, `${fallback.key}.2.jsonl`), LEDGER_RESULT);
  const snapshot = readProofSnapshot(file, dir);
  expect(verifyAccepted(proof, snapshot).fence).toBe(2);
  expect(() =>
    verifyAccepted(proof, { ...snapshot, accepted: Buffer.from("wrong").toString("base64") }),
  ).toThrow();
  expect(snapshot.events.filter((e) => e.type === "rejected-stale")).toHaveLength(1);
});

it("uses Chicago wall time across both midnight and the 07:00 boundary", () => {
  expect(nightEligible(Date.UTC(2026, 10, 17, 5), "America/Chicago")).toBe(true); // 23:00 previous day
  expect(nightEligible(Date.UTC(2026, 10, 17, 12, 59), "America/Chicago")).toBe(true);
  expect(nightEligible(Date.UTC(2026, 10, 17, 13), "America/Chicago")).toBe(false);
  expect(nightEligible(Date.UTC(2026, 10, 18, 1, 59), "America/Chicago")).toBe(false);
  expect(nightEligible(Date.UTC(2026, 10, 18, 2), "America/Chicago")).toBe(true);
});
