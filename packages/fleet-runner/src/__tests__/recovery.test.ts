import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import type * as SQLite from "node:sqlite";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { generateToken, signer } from "../auth.js";
import { fleetClient } from "../client.js";
import { JobStore, writeOutput } from "../jobs.js";
import { createRecoveryBundle, restoreRecoveryBundle, verifyRecoveryBundle } from "../recovery.js";
import { fleetServer } from "../server.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof SQLite;

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it("snapshots exact accepted bytes and required inputs, then restores paused under a fresh generation", async () => {
  const root = mkdtempSync(join(tmpdir(), "fleet-recovery-"));
  dirs.push(root);
  const live = join(root, "live");
  mkdirSync(live);
  const db = join(live, "queue.sqlite"),
    outputs = join(live, "outputs"),
    inputs = join(live, "inputs");
  mkdirSync(outputs);
  mkdirSync(inputs);
  const inputBytes = Buffer.from("synthetic required input");
  const inputHash = createHash("sha256").update(inputBytes).digest("hex");
  writeFileSync(join(inputs, inputHash), inputBytes);
  const source = new JobStore(db);
  const done = source.enqueue({ kind: "synthetic", inputs: [inputHash], payload: null });
  const doneClaim = source.claim("worker", [], ["synthetic"])!;
  const accepted = writeOutput(outputs, doneClaim, "accepted synthetic result");
  expect(source.complete(done.key, doneClaim.fence, "worker", accepted)).toBe(true);
  const claimed = source.enqueue({
    kind: "synthetic",
    inputs: [inputHash],
    payload: null,
    params: { next: 1 },
  });
  const oldClaim = source.claim("old-worker", [], ["synthetic"])!;
  source.close();

  const bundle = join(root, "independent-copy");
  const manifest = createRecoveryBundle(db, outputs, inputs, bundle);
  expect(verifyRecoveryBundle(bundle)).toMatchObject({
    schemaVersion: 5,
    recoveryPoint: { jobs: 2, acceptedResults: 1 },
  });
  expect(readFileSync(join(bundle, "outputs", accepted.file))).toEqual(
    Buffer.from("accepted synthetic result"),
  );
  expect(readFileSync(join(bundle, "inputs", inputHash))).toEqual(inputBytes);
  expect(JSON.stringify(manifest)).not.toMatch(/PRIVATE KEY|BEGIN .* KEY/i);

  const target = join(root, "restored-new-state");
  const restored = restoreRecoveryBundle(bundle, target);
  expect(restored.generation).not.toBe("legacy");
  let store = new JobStore(join(target, "fleet.sqlite"));
  expect(store.recoveryState()).toMatchObject({ generation: restored.generation, hold: true });
  expect(store.workerControl("old-worker").paused).toBe(true);
  expect(store.claim("new-worker", [], ["synthetic"])).toBeUndefined();
  expect(store.controlWorker("old-worker", "resume").paused).toBe(true);
  expect(store.get(claimed.key)?.status).toBe("ready");
  store.close();
  store = new JobStore(join(target, "fleet.sqlite"));
  expect(store.isRecoveryHeld()).toBe(true);
  expect(store.controlWorker("old-worker", "resume").paused).toBe(true);
  expect(store.releaseRecoveryHold(restored.generation, restored.holdToken)).toBe(true);
  expect(store.isRecoveryHeld()).toBe(false);
  expect(store.workerControl("old-worker").paused).toBe(true);
  store.close();
  expect(oldClaim.fence).toBe(1);
});

it("restores a read-only bundle without changing its database", () => {
  const root = mkdtempSync(join(tmpdir(), "fleet-recovery-readonly-"));
  dirs.push(root);
  const live = join(root, "live");
  mkdirSync(live);
  const db = join(live, "queue.sqlite"),
    outputs = join(live, "outputs");
  mkdirSync(outputs);
  new JobStore(db).close();

  const bundle = join(root, "readonly-copy");
  createRecoveryBundle(db, outputs, undefined, bundle);
  const bundleDb = join(bundle, "fleet.sqlite");
  const sourceBytes = readFileSync(bundleDb);
  chmodSync(bundleDb, 0o400);
  for (const dir of [
    bundle,
    ...readdirSync(bundle, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(bundle, entry.name)),
  ]) {
    chmodSync(dir, 0o500);
  }
  for (const file of [
    bundleDb,
    join(bundle, "recovery-manifest.json"),
    ...readdirSync(bundle, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) =>
        readdirSync(join(bundle, entry.name)).map((name) => join(bundle, entry.name, name)),
      ),
  ]) {
    chmodSync(file, 0o400);
  }

  try {
    const restored = restoreRecoveryBundle(bundle, join(root, "restored"));
    expect(verifyRecoveryBundle(bundle).database.sha256).toBe(
      createHash("sha256").update(sourceBytes).digest("hex"),
    );
    expect(readFileSync(bundleDb)).toEqual(sourceBytes);
    expect(statSync(bundleDb).mode & 0o777).toBe(0o400);

    const restoredDb = join(root, "restored", "fleet.sqlite");
    expect(statSync(restoredDb).mode & 0o777).toBe(0o600);
    const store = new JobStore(restoredDb);
    expect(store.recoveryState()).toMatchObject({ generation: restored.generation, hold: true });
    store.close();
  } finally {
    for (const entry of readdirSync(bundle, { withFileTypes: true })) {
      const path = join(bundle, entry.name);
      if (entry.isDirectory()) {
        for (const child of readdirSync(path)) chmodSync(join(path, child), 0o600);
        chmodSync(path, 0o700);
      } else {
        chmodSync(path, 0o600);
      }
    }
    chmodSync(bundle, 0o700);
  }
});

it("fails closed on missing, corrupt, truncated and newer-schema backup material", () => {
  const root = mkdtempSync(join(tmpdir(), "fleet-recovery-invalid-"));
  dirs.push(root);
  const live = join(root, "live");
  mkdirSync(live);
  const db = join(live, "q.sqlite"),
    out = join(live, "out");
  mkdirSync(out);
  new JobStore(db).close();
  const bundle = join(root, "backup");
  createRecoveryBundle(db, out, undefined, bundle);
  writeFileSync(join(bundle, "recovery-manifest.json"), "{");
  expect(() => verifyRecoveryBundle(bundle)).toThrow();
  writeFileSync(join(bundle, "recovery-manifest.json"), "{}");
  expect(() => restoreRecoveryBundle(bundle, join(root, "no-restore"))).toThrow(
    "recovery-manifest-incompatible",
  );

  const fresh = join(root, "backup2");
  createRecoveryBundle(db, out, undefined, fresh);
  rmSync(join(fresh, "fleet.sqlite"));
  expect(() => verifyRecoveryBundle(fresh)).toThrow();

  const fresh2 = join(root, "backup3");
  createRecoveryBundle(db, out, undefined, fresh2);
  writeFileSync(join(fresh2, "fleet.sqlite"), "truncated");
  expect(() => verifyRecoveryBundle(fresh2)).toThrow("recovery-database-hash-mismatch");

  const future = join(root, "backup-future");
  createRecoveryBundle(db, out, undefined, future);
  const futureDb = new DatabaseSync(join(future, "fleet.sqlite"));
  futureDb.exec("PRAGMA user_version=99");
  futureDb.close();
  const manifest = JSON.parse(readFileSync(join(future, "recovery-manifest.json"), "utf8"));
  const futureBytes = readFileSync(join(future, "fleet.sqlite"));
  manifest.database.size = futureBytes.length;
  manifest.database.sha256 = createHash("sha256").update(futureBytes).digest("hex");
  writeFileSync(join(future, "recovery-manifest.json"), JSON.stringify(manifest));
  expect(() => verifyRecoveryBundle(future)).toThrow("recovery-database-schema-incompatible");
});

it("rejects a missing or corrupt accepted result before publishing a restore", () => {
  const root = mkdtempSync(join(tmpdir(), "fleet-recovery-result-"));
  dirs.push(root);
  const live = join(root, "live");
  mkdirSync(live);
  const db = join(live, "q.sqlite"),
    out = join(live, "out");
  mkdirSync(out);
  const store = new JobStore(db);
  const { key } = store.enqueue({ kind: "synthetic", inputs: [], payload: null });
  const claim = store.claim("worker", [], ["synthetic"])!;
  const result = writeOutput(out, claim, "exact result bytes");
  expect(store.complete(key, claim.fence, "worker", result)).toBe(true);
  store.close();
  const missing = join(root, "backup-missing");
  createRecoveryBundle(db, out, undefined, missing);
  rmSync(join(missing, "outputs", result.file));
  expect(() => verifyRecoveryBundle(missing)).toThrow();
  expect(() => restoreRecoveryBundle(missing, join(root, "must-not-exist"))).toThrow();
  expect(() => readFileSync(join(root, "must-not-exist"))).toThrow();

  const corrupt = join(root, "backup-corrupt");
  createRecoveryBundle(db, out, undefined, corrupt);
  chmodSync(join(corrupt, "outputs", result.file), 0o600);
  writeFileSync(join(corrupt, "outputs", result.file), "changed synthetic result");
  expect(() => verifyRecoveryBundle(corrupt)).toThrow("recovery-output-hash-mismatch");
});

it("rejects duplicate accepted-result entries instead of treating one file as two results", () => {
  const root = mkdtempSync(join(tmpdir(), "fleet-recovery-duplicate-results-"));
  dirs.push(root);
  const live = join(root, "live");
  mkdirSync(live);
  const db = join(live, "queue.sqlite");
  const outputs = join(live, "outputs");
  mkdirSync(outputs);
  const store = new JobStore(db);
  for (const index of [1, 2]) {
    const { key } = store.enqueue({
      kind: "synthetic",
      inputs: [],
      params: { index },
      payload: null,
    });
    const claim = store.claim("worker", [], ["synthetic"])!;
    const result = writeOutput(outputs, claim, `result-${index}`);
    expect(store.complete(key, claim.fence, "worker", result)).toBe(true);
  }
  store.close();

  const bundle = join(root, "duplicate-backup");
  createRecoveryBundle(db, outputs, undefined, bundle);
  const manifest = JSON.parse(readFileSync(join(bundle, "recovery-manifest.json"), "utf8"));
  manifest.outputs = [manifest.outputs[0], manifest.outputs[0]];
  writeFileSync(join(bundle, "recovery-manifest.json"), JSON.stringify(manifest));
  expect(() => verifyRecoveryBundle(bundle)).toThrow("recovery-output-set-mismatch");
  const target = join(root, "must-not-publish");
  expect(() => restoreRecoveryBundle(bundle, target)).toThrow("recovery-output-set-mismatch");
  expect(existsSync(target)).toBe(false);
});

it("rejects symlink aliases and restore destinations nested inside source paths", () => {
  const root = mkdtempSync(join(tmpdir(), "fleet-recovery-paths-"));
  dirs.push(root);
  const live = join(root, "live");
  mkdirSync(live);
  const db = join(live, "queue.sqlite");
  const outputs = join(live, "outputs");
  mkdirSync(outputs);
  new JobStore(db).close();

  const alias = join(root, "outputs-alias");
  symlinkSync(outputs, alias, "dir");
  expect(() => createRecoveryBundle(db, outputs, undefined, join(alias, "backup"))).toThrow(
    "recovery-destination-not-independent",
  );
  expect(existsSync(join(outputs, "backup"))).toBe(false);

  const bundle = join(root, "independent-backup");
  createRecoveryBundle(db, outputs, undefined, bundle);
  expect(() => restoreRecoveryBundle(bundle, join(bundle, "restored-state"))).toThrow(
    "restore-destination-not-independent",
  );
  const bundleAlias = join(root, "backup-alias");
  symlinkSync(bundle, bundleAlias, "dir");
  expect(() => restoreRecoveryBundle(bundle, join(bundleAlias, "restored-through-alias"))).toThrow(
    "restore-destination-not-independent",
  );
  expect(verifyRecoveryBundle(bundle).format).toBe("fleet-runner-recovery-v1");
});

it("requires an explicit resume after hold release for workers without saved controls", () => {
  const root = mkdtempSync(join(tmpdir(), "fleet-recovery-worker-pause-"));
  dirs.push(root);
  const live = join(root, "live");
  mkdirSync(live);
  const db = join(live, "queue.sqlite");
  const outputs = join(live, "outputs");
  mkdirSync(outputs);
  const source = new JobStore(db);
  source.enqueue({ kind: "synthetic", inputs: [], payload: null });
  source.close();
  const bundle = join(root, "backup");
  createRecoveryBundle(db, outputs, undefined, bundle);
  const target = join(root, "restored");
  const restored = restoreRecoveryBundle(bundle, target);
  const store = new JobStore(join(target, "fleet.sqlite"));
  const worker = "configured-but-no-control-row";
  expect(store.workerControl(worker)).toMatchObject({ paused: true });
  expect(store.releaseRecoveryHold(restored.generation, restored.holdToken)).toBe(true);
  expect(store.workerControl(worker)).toMatchObject({ paused: true });
  expect(store.claim(worker, [], ["synthetic"])).toBeUndefined();
  expect(store.controlWorker(worker, "resume")).toMatchObject({ paused: false });
  expect(store.claim(worker, [], ["synthetic"])).toBeDefined();
  store.close();
});

it("timestamps freshness from snapshot start even when copying takes longer", () => {
  const root = mkdtempSync(join(tmpdir(), "fleet-recovery-snapshot-time-"));
  dirs.push(root);
  const live = join(root, "live");
  mkdirSync(live);
  const db = join(live, "queue.sqlite");
  const outputs = join(live, "outputs");
  mkdirSync(outputs);
  new JobStore(db).close();
  const timestamps = ["2026-11-10T18:00:00.000Z", "2026-11-10T18:17:00.000Z"];
  const manifest = createRecoveryBundle(db, outputs, undefined, join(root, "backup"), {
    now: () => new Date(timestamps.shift()!),
  });
  expect(manifest.capturedAt).toBe("2026-11-10T18:00:00.000Z");
  expect(manifest.copyCompletedAt).toBe("2026-11-10T18:17:00.000Z");
  expect(Date.parse(manifest.copyCompletedAt) - Date.parse(manifest.capturedAt)).toBe(17 * 60_000);
});

it("checks exact bundle directory contents and derives recovery-point metadata from SQLite", () => {
  const root = mkdtempSync(join(tmpdir(), "fleet-recovery-metadata-"));
  dirs.push(root);
  const live = join(root, "live");
  mkdirSync(live);
  const db = join(live, "queue.sqlite");
  const outputs = join(live, "outputs");
  mkdirSync(outputs);
  const source = new JobStore(db);
  source.enqueue({ kind: "synthetic", inputs: [], payload: null });
  source.close();

  const extra = join(root, "extra-material");
  createRecoveryBundle(db, outputs, undefined, extra);
  mkdirSync(join(extra, "outputs"));
  writeFileSync(join(extra, "outputs", "orphan.jsonl"), "unreferenced");
  expect(() => verifyRecoveryBundle(extra)).toThrow("recovery-directory-contents-mismatch");

  const forged = join(root, "forged-point");
  createRecoveryBundle(db, outputs, undefined, forged);
  const manifest = JSON.parse(readFileSync(join(forged, "recovery-manifest.json"), "utf8"));
  manifest.recoveryPoint = { eventCursor: 0, jobs: 999, acceptedResults: 999 };
  writeFileSync(join(forged, "recovery-manifest.json"), JSON.stringify(manifest));
  expect(() => verifyRecoveryBundle(forged)).toThrow("recovery-point-mismatch");
});

it("rejects pre-restore signed traffic and old claimed attempts at the HTTP seam", async () => {
  const root = mkdtempSync(join(tmpdir(), "fleet-recovery-http-"));
  dirs.push(root);
  const live = join(root, "live");
  mkdirSync(live);
  const db = join(live, "q.sqlite"),
    outputs = join(live, "outputs");
  mkdirSync(outputs);
  const source = new JobStore(db);
  const { key } = source.enqueue({ kind: "synthetic", inputs: [], payload: null });
  const oldClaim = source.claim("worker", [], ["synthetic"])!;
  source.close();
  const bundle = join(root, "backup");
  createRecoveryBundle(db, outputs, undefined, bundle);
  const target = join(root, "restored");
  const restored = restoreRecoveryBundle(bundle, target);
  const registry = join(root, "registry");
  mkdirSync(registry);
  generateToken(join(registry, "owner"));
  generateToken(join(registry, "worker"));
  generateToken(join(registry, "observer"));
  const store = new JobStore(join(target, "fleet.sqlite"));
  const server = fleetServer(store, {
    registry,
    outDir: join(target, "outputs"),
    inputDir: join(target, "inputs"),
    workers: ["worker"],
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("missing listener");
  try {
    const old = fleetClient(`http://127.0.0.1:${addr.port}`, "worker", join(registry, "worker"));
    const current = fleetClient(
      `http://127.0.0.1:${addr.port}`,
      "worker",
      join(registry, "worker"),
      restored.generation,
    );
    const owner = fleetClient(
      `http://127.0.0.1:${addr.port}`,
      "owner",
      join(registry, "owner"),
      restored.generation,
    );
    await expect(old.status()).rejects.toMatchObject({ status: 401 });
    await expect(old.heartbeat({ key, fence: oldClaim.fence })).rejects.toMatchObject({
      status: 401,
    });
    await expect(current.heartbeat({ key, fence: oldClaim.fence })).resolves.toBe(false);
    await expect(owner.status()).resolves.toMatchObject({
      schemaVersion: 1,
      service: { ready: false, reasons: ["recovery-hold"] },
    });
    await expect(owner.statusEvents()).resolves.toMatchObject({ schemaVersion: 1 });
    const duplicateTarget = `/status?generation=${restored.generation}&generation=${restored.generation}`;
    const duplicateAuth = signer("owner", join(registry, "owner"))(
      "GET",
      duplicateTarget,
      Buffer.alloc(0),
    );
    const duplicate = await fetch(`http://127.0.0.1:${addr.port}${duplicateTarget}`, {
      headers: { authorization: duplicateAuth },
    });
    expect(duplicate.status).toBe(401);
    await expect(current.workerControl()).resolves.toMatchObject({ paused: true });
    await expect(owner.control("worker", "resume")).resolves.toMatchObject({ paused: true });
    await expect(owner.releaseRecoveryHold(restored.holdToken)).resolves.toMatchObject({
      released: true,
    });
    expect(store.get(key)?.status).toBe("ready");
    expect(store.workerControl("worker").paused).toBe(true);
    await owner.control("worker", "resume");
    const newClaim = await current.claim([], ["synthetic"]);
    expect(newClaim?.fence).toBeGreaterThan(oldClaim.fence);
    await expect(current.heartbeat({ key, fence: oldClaim.fence })).resolves.toBe(false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
  }
});

it("runs backup, verification and restore through the CLI process seam", () => {
  const root = mkdtempSync(join(tmpdir(), "fleet-recovery-cli-"));
  dirs.push(root);
  const live = join(root, "live");
  mkdirSync(live);
  const db = join(live, "queue.sqlite");
  const outputs = join(live, "outputs");
  mkdirSync(outputs);
  new JobStore(db).close();
  const bundle = join(root, "independent-copy");
  const restoredPath = join(root, "restored");
  const cli = join(dirname(fileURLToPath(import.meta.url)), "../../dist/cli.js");
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  expect(run("backup", db, outputs, "-", bundle).status).toBe(0);
  expect(run("verify-backup", bundle).stdout).toMatch(/"verified":true/);
  const restoredProcess = run("restore", bundle, restoredPath);
  expect(restoredProcess.status).toBe(0);
  expect(JSON.parse(restoredProcess.stdout)).toMatchObject({ restored: true, paused: true });
  const restored = new JobStore(join(restoredPath, "fleet.sqlite"));
  expect(restored.recoveryState().hold).toBe(true);
  restored.close();
});
