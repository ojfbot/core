import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../dist/jobs.js";
import { projection } from "./ledger-proof-local-operator.mjs";
import { preparePractice, preflightPractice } from "./ledger-proof-local-practice.mjs";

const sha = (value) => createHash("sha256").update(value).digest("hex");
const scripts = dirname(fileURLToPath(import.meta.url));
const proofId = "00000000-0000-4000-8000-000000000001";
function fixture(root, role) {
  const starts = Date.UTC(2030, 0, 1);
  const proof = {
    schemaVersion: 1,
    proofId,
    practice: true,
    code: "a".repeat(40),
    fixtureSha256: "b".repeat(64),
    timeZone: "America/Chicago",
    primary: "cg307-primary-00000000",
    fallback: "cg307-fallback-00000000",
    capability: "cg307-ledger-00000000",
    startsAtMs: starts,
    endsAtMs: starts + 25 * 60000,
    approvalExpiresAtMs: starts + 30 * 60000,
    attendedWindow: { notBeforeMs: starts - 180000, expiresAtMs: starts + 30 * 60000 },
  };
  const inspect = {
    Id: "c".repeat(64),
    Image: "sha256:" + "d".repeat(64),
    Config: { User: "node", Labels: { "cg307-u1.proof": proofId } },
    Mounts: [
      { Source: "/host/state", Destination: "/var/lib/fleet-runner/state", RW: true },
      { Source: "/host/output", Destination: "/var/lib/fleet-runner/output", RW: true },
    ],
    HostConfig: {
      NanoCpus: 1e9,
      Memory: 1e9,
      PortBindings: {},
      RestartPolicy: { Name: "no" },
      Privileged: false,
      ReadonlyRootfs: true,
      NetworkMode: "bridge",
    },
  };
  const protectedContainer = { ...projection(inspect), id: "e".repeat(64) };
  const node = join(dirname(root), "node"),
    bundle = join(scripts, "../dist/cli.js");
  copyFileSync(process.execPath, node);
  chmodSync(node, 0o700);
  return {
    root,
    role,
    plan: {
      proof,
      planSha256: sha(canonicalJson(proof)),
      startAfter: 0,
      thread: "00000000-0000-4000-8000-000000000002",
      stream: "00000000-0000-4000-8000-000000000003",
    },
    target: {
      inspect,
      projectionSha256: sha(canonicalJson(projection(inspect))),
      nasAlias: "fixture",
      docker: "/usr/bin/docker",
      node: "/usr/local/bin/node",
      serverBundle: "/app/dist/cli.js",
      serverBundleSha256: "f".repeat(64),
      endpoint: "https://127.0.0.1:18789",
    },
    host: {
      scripts,
      node,
      bundle,
      nodeSha256: sha(readFileSync(node)),
      bundleSha256: sha(readFileSync(bundle)),
      device: role === "primary" ? "device-a" : "device-b",
      primaryDevice: "device-a",
      fallbackDevice: "device-b",
      tokenFile: join(root, "private-token"),
      caFile: join(root, "ca.crt"),
      adapter: {
        program: "/usr/bin/false",
        sha256: sha(readFileSync("/usr/bin/false")),
        args: [],
        files: {},
      },
      environment: {
        HELPDESK_URL: "https://localhost:8765",
        HELPDESK_DEVICE_WRITER: role === "primary" ? "device-a" : "device-b",
      },
      protected: {
        container: protectedContainer,
        serviceUid: "node",
        node: "/usr/local/bin/node",
        database: "/var/lib/fleet-runner/state/fleet.sqlite",
        metadata: { schema: 4, rows: [] },
        files: [{ path: "/fixture/protected.plist", sha256: "f".repeat(64) }],
      },
    },
  };
}

for (const role of ["primary", "fallback"])
  test(`prepare ${role} generates an idle binding with container paths and no GO`, () => {
    const scratch = realpathSync(mkdtempSync(join(tmpdir(), "practice-test-")));
    const root = join(scratch, "proof");
    try {
      const input = fixture(root, role);
      const result = preparePractice(input);
      assert.equal(result.prepared, true);
      const operator = JSON.parse(readFileSync(join(root, "operator.json")));
      assert.equal(operator.snapshot.database, "/var/lib/fleet-runner/state/fleet.sqlite");
      assert.equal(operator.snapshot.outputs, "/var/lib/fleet-runner/output");
      const runtime = JSON.parse(readFileSync(join(root, `${role}.json`)));
      assert.equal(runtime.role, role);
      assert.equal(runtime.settings.worker, input.plan.proof[role]);
      assert.equal(result.proofId, proofId);
      assert.throws(() => readFileSync(join(root, "GO.json")), /ENOENT/);
      assert.throws(() => preparePractice(input), /root-must-be-new/);
    } finally {
      rmSync(scratch, { recursive: true });
    }
  });

test("generated preflight checks snapshot, protected state, relay and key without GO or startup", async () => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), "practice-preflight-")));
  const root = join(scratch, "proof");
  try {
    const input = fixture(root, "primary");
    preparePractice(input);
    const guard = JSON.parse(readFileSync(join(root, "guard.json")));
    const calls = [];
    const dependencies = {
      io: {
        run: (program, args, stdin) => {
          calls.push(args);
          if (args[0] === "print") return { status: 113, stderr: "Could not find service" };
          if (args[4] === "snapshot") {
            assert.deepEqual(JSON.parse(stdin), { proofId });
            return {
              status: 0,
              stdout: JSON.stringify({ schema: 5, rows: [], events: [], accepted: null }),
            };
          }
          if (args[4] === "protected-probe")
            return {
              status: 0,
              stdout: JSON.stringify({ proofId, protectedIdle: true, baselineUnchanged: true }),
            };
          assert.equal(args[2], "status");
          return spawnSync(program, args, { encoding: "utf8" });
        },
      },
      runCommand: async (command) => {
        assert.ok(command.args.includes("GET"));
        return { thread: { thread_id: input.plan.thread }, stream_id: input.plan.stream };
      },
      checkWorker: async () => {
        calls.push(["signed-key-read"]);
      },
    };
    assert.equal((await preflightPractice(guard, "primary", dependencies)).state, "PASS");
    assert.ok(calls.some((args) => args[0] === "signed-key-read"));
    assert.throws(() => readFileSync(join(root, "GO.used")), /ENOENT/);
    dependencies.io.run = (program, args) =>
      args[4] === "snapshot"
        ? { status: 17, stderr: "original snapshot permission failure" }
        : spawnSync(program, args, { encoding: "utf8" });
    await assert.rejects(preflightPractice(guard, "primary", dependencies), (error) => {
      assert.equal(error.privateFailure.exitCode, 17);
      assert.equal(error.privateFailure.stderr, "original snapshot permission failure");
      return true;
    });
    assert.throws(() => readFileSync(join(root, "guard-receipt.json")), /ENOENT/);
  } finally {
    rmSync(scratch, { recursive: true });
  }
});
