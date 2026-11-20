import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  copyFileSync,
  chmodSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { generateToken } from "../dist/auth.js";
import { JobStore } from "../dist/jobs.js";
import { fleetServer } from "../dist/server.js";
import { LEDGER_RESULT, proofHash, readProofSnapshot } from "../dist/ledger-proof.js";
import {
  generateReusablePractice,
  runReusablePractice,
  resetReusablePractice,
  practiceRequest,
  releasePracticeLock,
} from "./ledger-proof-local-reusable.mjs";

test("stable host facts generate internal snapshot paths without a timed plan or GO", () => {
  const identity = "00000000-0000-4000-8000-000000000001";
  const inspect = {
    Id: "a".repeat(64),
    Image: "sha256:" + "b".repeat(64),
    Config: {
      User: "node",
      Labels: { "cg307-u1.proof": identity, "fleet.practice": "practice-fixture" },
    },
    Mounts: [
      { Source: "/host/state", Destination: "/var/lib/fleet-runner/state", RW: true },
      { Source: "/host/output", Destination: "/var/lib/fleet-runner/output", RW: true },
    ],
    HostConfig: {
      PortBindings: {},
      NanoCpus: 1e9,
      Memory: 1e9,
      RestartPolicy: { Name: "no" },
      Privileged: false,
      ReadonlyRootfs: true,
      NetworkMode: "bridge",
    },
  };
  const raw = {
    identity,
    id: "practice-fixture",
    evidenceRoot: "/fixture/practice",
    timeoutMs: 3000,
    workers: { primary: "primary", fallback: "fallback" },
    host: {
      nasAlias: "fixture",
      docker: "/usr/bin/docker",
      tokenFile: "/fixture/key",
      caFile: "/fixture/ca",
      bundle: "/fixture/client.mjs",
      bundleSha256: "f".repeat(64),
      protected: {
        container: {
          id: "c".repeat(64),
          image: "sha256:" + "d".repeat(64),
          labels: {},
          mounts: inspect.Mounts,
          portBindings: {},
          nanoCpus: 0,
          memory: 0,
          restartPolicy: { Name: "no" },
          user: "node",
          networkMode: "bridge",
          privileged: false,
          readonlyRootfs: true,
        },
        serviceUid: "node",
        node: "/usr/local/bin/node",
        database: "/state/db",
        metadata: { schema: 4, rows: [] },
        files: [{ path: "/fixture/protected", sha256: "f".repeat(64) }],
      },
    },
    target: {
      inspect,
      node: "/usr/local/bin/node",
      serverBundle: "/app/dist/cli.js",
      serverBundleSha256: "e".repeat(64),
      endpoint: "https://localhost",
    },
    command: {
      program: "/fixture/bookcase",
      args: [],
      timeoutMs: 1000,
      sha256: "e".repeat(64),
      files: {},
    },
  };
  const generated = generateReusablePractice(raw, "fallback");
  assert.equal(generated.worker.worker, "fallback");
  assert.equal(generated.operator.snapshot.database, "/var/lib/fleet-runner/state/fleet.sqlite");
  assert.equal(generated.operator.snapshot.outputs, "/var/lib/fleet-runner/output");
  assert.equal(generated.operator.proofId, identity);
  assert.equal(generated.goFile, undefined);
  assert.equal(generated.startsAtMs, undefined);
});

test("reusable practice performs signed admission, expired-lease takeover, verified result, stale rejection and reset", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "reusable-practice-")));
  const db = join(root, "queue.sqlite"),
    outputs = join(root, "accepted");
  const store = new JobStore(db, { leaseMs: 40 });
  for (const name of ["owner", "primary", "fallback"]) generateToken(join(root, name));
  const server = fleetServer(store, {
    registry: root,
    outDir: outputs,
    workers: ["primary", "fallback"],
    observers: [],
    practiceId: "practice-fixture",
  });
  try {
    await new Promise((accept, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", accept);
    });
    const endpoint = `http://127.0.0.1:${server.address().port}`;
    const node = join(root, "node");
    copyFileSync(process.execPath, node);
    chmodSync(node, 0o700);
    const messages = [];
    let sequence = 0;
    const config = (role) => ({
      schemaVersion: 1,
      id: "practice-fixture",
      device: `device-${role}`,
      primaryDevice: "device-primary",
      fallbackDevice: "device-fallback",
      workers: { primary: "primary", fallback: "fallback" },
      code: "a".repeat(40),
      fixtureSha256: "b".repeat(64),
      timeoutMs: 3000,
      ownerKey: join(root, "owner"),
      evidenceRoot: join(root, role + "-evidence"),
      operator: {
        proofId: "00000000-0000-4000-8000-000000000001",
        target: { labels: { "fleet.practice": "practice-fixture" } },
      },
      worker: {
        schemaVersion: 1,
        endpoint,
        worker: role,
        tokenFile: join(root, role),
        outDir: join(root, "out"),
        statusFile: join(root, role + "-status.json"),
        kinds: {
          "bookcase-ledger-replay": {
            capabilities: ["practice-fixture"],
            command: [
              node,
              "-e",
              `const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');let input='';process.stdin.on('data',x=>input+=x);process.stdin.on('end',()=>{const {job,outDir}=JSON.parse(input);const file=job.key+'.'+job.fence+'.jsonl',bytes=Buffer.from(${JSON.stringify(LEDGER_RESULT)});fs.writeFileSync(path.join(outDir,file),bytes,{flag:'wx'});console.log(JSON.stringify({file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}));});`,
            ],
            timeoutMs: 1000,
          },
        },
      },
      commandSha256: proofHash(readFileSync(node)),
      commandFiles: {},
      relay: {
        startAfter: 0,
        session: role,
        peerSessions: { primary: "primary", fallback: "fallback" },
        environment: {
          HELPDESK_DEVICE_WRITER: `device-${role}`,
          HELPDESK_URL: "https://localhost",
        },
        adapter: { program: node, sha256: proofHash(readFileSync(node)), args: [], files: {} },
      },
    });
    const operator = {
      snapshot: () => readProofSnapshot(db, outputs, true),
      protectedProbe: () => ({ protectedIdle: true, baselineUnchanged: true }),
    };
    const deps = (role) => ({
      operator,
      wait: () => delay(2),
      relay: {
        read: async (after) => messages.filter((message) => message.sequence > after),
        post: async (phase, openSequence, body = {}) => {
          const message = {
            ...body,
            role,
            phase,
            openSequence,
            sequence: ++sequence,
            receivedAt: Date.now(),
          };
          messages.push(message);
          return message.sequence;
        },
      },
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const [primary, fallback] = await Promise.all([
        runReusablePractice(config("primary"), "primary", deps("primary")),
        runReusablePractice(config("fallback"), "fallback", deps("fallback")),
      ]);
      assert.equal(primary.state, "PASS");
      assert.equal(fallback.state, "PASS");
      assert.equal(primary.staleRejected, true);
      assert.equal(primary.resultVerified, true);
      const final = operator.snapshot();
      assert.equal(final.rows[0].worker, "fallback");
      assert.equal(final.rows[0].fence, 2);
      const acceptedFile = join(outputs, final.rows[0].outputFile);
      assert.equal(
        (await resetReusablePractice(config("primary"), "primary", { operator })).reset,
        true,
      );
      assert.equal(readFileSync(acceptedFile, "utf8"), LEDGER_RESULT);
      assert.equal(operator.snapshot().rows.length, 0);
      assert.ok(store.events(0).length > 0);
    }
    // Kill the actual primary runner immediately after signed admission, leaving its lock and queued job.
    const crashConfig = join(root, "crash-config.json"),
      crashScript = join(root, "crash.mjs");
    writeFileSync(crashConfig, JSON.stringify(config("primary")), { mode: 0o600 });
    const runnerModule = new URL("./ledger-proof-local-reusable.mjs", import.meta.url).href;
    const snapshotModule = new URL("../dist/ledger-proof.js", import.meta.url).href;
    writeFileSync(
      crashScript,
      `import {readFileSync} from 'node:fs';
      import {runReusablePractice,practiceRequest} from ${JSON.stringify(runnerModule)};
      import {readProofSnapshot} from ${JSON.stringify(snapshotModule)};
      const config=JSON.parse(readFileSync(process.argv[2]));
      const owner=practiceRequest(config.worker.endpoint,'owner',config.ownerKey);
      await runReusablePractice(config,'primary',{
        operator:{snapshot:()=>readProofSnapshot(${JSON.stringify(db)},${JSON.stringify(outputs)},true),protectedProbe:()=>({protectedIdle:true,baselineUnchanged:true})},
        relay:{post:async()=>100,read:async()=>[{sequence:101,role:'fallback',phase:'READY',openSequence:100}]},
        owner:async(method,path,body)=>{const result=await owner(method,path,body);if(path==='/enqueue')process.kill(process.pid,'SIGKILL');return result;}
      });`,
      { mode: 0o600 },
    );
    const child = spawn(process.execPath, [crashScript, crashConfig], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let crashError = "";
    child.stderr.on("data", (bytes) => {
      crashError += bytes;
    });
    const exit = await new Promise((accept, reject) => {
      child.on("error", reject);
      child.on("exit", (code, signal) => accept({ code, signal }));
    });
    assert.equal(exit.signal, "SIGKILL", crashError);
    const crashedKey = operator.snapshot().rows[0].key;
    assert.equal(operator.snapshot().rows[0].status, "ready");
    assert.equal(
      JSON.parse(readFileSync(join(root, "primary-evidence", "primary.lock"))).pid,
      child.pid,
    );
    const archiveThenReset = practiceRequest(endpoint, "owner", join(root, "owner"));
    assert.equal(
      (
        await resetReusablePractice(config("primary"), "primary", {
          operator,
          owner: async (method, path, body) => {
            assert.ok(
              readdirSync(join(root, "primary-evidence"))
                .filter((name) => name.startsWith("reset-"))
                .some((name) =>
                  JSON.parse(
                    readFileSync(join(root, "primary-evidence", name, "before.json")),
                  ).rows.some((row) => row.key === crashedKey),
                ),
            );
            return archiveThenReset(method, path, body);
          },
        })
      ).reset,
      true,
    );
    assert.ok(
      readdirSync(join(root, "primary-evidence"))
        .filter((name) => name.startsWith("reset-"))
        .some((name) =>
          JSON.parse(readFileSync(join(root, "primary-evidence", name, "before.json"))).rows.some(
            (row) => row.key === crashedKey,
          ),
        ),
    );
    assert.throws(() => readFileSync(join(root, "primary-evidence", "primary.lock")), /ENOENT/);
    const recovered = await Promise.all([
      runReusablePractice(config("primary"), "primary", deps("primary")),
      runReusablePractice(config("fallback"), "fallback", deps("fallback")),
    ]);
    assert.ok(recovered.every((result) => result.state === "PASS"));
    await resetReusablePractice(config("primary"), "primary", { operator });
    let mutations = 0;
    await assert.rejects(
      runReusablePractice(config("primary"), "primary", {
        ...deps("primary"),
        operator: {
          snapshot: () => {
            throw Error("proof-operator-snapshot-path-outside-container-mount");
          },
        },
        request: async () => {
          mutations++;
        },
        owner: async () => {
          mutations++;
        },
        relay: { read: async () => [], post: async () => 1 },
      }),
      /snapshot-path-outside-container-mount/,
    );
    assert.equal(mutations, 0);
    assert.throws(() => readFileSync(join(root, "primary-evidence", "primary.lock")), /ENOENT/);
    const ownerOnPractice = practiceRequest(endpoint, "owner", join(root, "owner"));
    await ownerOnPractice("POST", "/enqueue", { kind: "unrelated", inputs: [], payload: null });
    const foreign = store.events(0).at(-1).key;
    assert.deepEqual(
      await ownerOnPractice("POST", "/practice/reset", {
        practice: "practice-fixture",
        expectedKeys: [foreign],
      }),
      { reset: false },
    );
    assert.ok(store.get(foreign));
    // Reset is unreachable on a normal service even for owner.
    const normal = fleetServer(store, {
      registry: root,
      outDir: outputs,
      workers: ["primary", "fallback"],
      observers: [],
    });
    await new Promise((accept) => normal.listen(0, "127.0.0.1", accept));
    try {
      const owner = practiceRequest(
        `http://127.0.0.1:${normal.address().port}`,
        "owner",
        join(root, "owner"),
      );
      await assert.rejects(
        owner("POST", "/practice/reset", { practice: "practice-fixture", expectedKeys: [] }),
        /403/,
      );
    } finally {
      await new Promise((accept) => normal.close(accept));
    }
  } finally {
    await new Promise((accept) => server.close(accept));
    store.close();
    rmSync(root, { recursive: true });
  }
});

test("reset refuses a live lease and recovers an expired claim without reusing its fence", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "practice-reset-")));
  let now = 1000;
  const store = new JobStore(join(root, "queue.sqlite"), { leaseMs: 100, now: () => now });
  try {
    const spec = {
      kind: "bookcase-ledger-replay",
      inputs: [],
      payload: null,
      params: { practice: "practice-fixture" },
      requires: ["practice-fixture"],
    };
    const { key } = store.enqueue(spec);
    const claim = store.claim("primary", ["practice-fixture"], [spec.kind]);
    assert.equal(store.resetPractice("practice-fixture", [key]), false);
    now = claim.leaseExpires;
    assert.equal(store.resetPractice("practice-fixture", [key]), true);
    assert.ok(store.events(0).some((event) => event.key === key));
    store.enqueue(spec);
    const next = store.claim("fallback", ["practice-fixture"], [spec.kind]);
    assert.equal(next.fence, claim.fence + 1);
    assert.equal(store.heartbeat(key, claim.fence, "primary"), false);
  } finally {
    store.close();
    rmSync(root, { recursive: true });
  }
});

test("lock cleanup preserves the first error and exposes a cleanup-only failure", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "practice-lock-"))),
    file = join(root, "lock");
  try {
    writeFileSync(file, JSON.stringify({ pid: process.pid, token: "fixture" }), { mode: 0o600 });
    const first = Error("original-snapshot-failure");
    const failRemove = () => {
      throw Error("fixture-unlink-refused");
    };
    releasePracticeLock(file, "fixture", first, failRemove);
    assert.equal(first.message, "original-snapshot-failure");
    assert.equal(first.cleanupFailure, "fixture-unlink-refused");
    assert.throws(
      () => releasePracticeLock(file, "fixture", undefined, failRemove),
      /fixture-unlink-refused/,
    );
  } finally {
    rmSync(root, { recursive: true });
  }
});
