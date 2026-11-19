import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { launchLocalProof } from "./ledger-proof-local-guard.mjs";

const proofId = "00000000-0000-4000-8000-000000000001";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) =>
  JSON.stringify(value, (_, row) =>
    row && typeof row === "object" && !Array.isArray(row)
      ? Object.fromEntries(
          Object.keys(row)
            .sort()
            .map((key) => [key, row[key]]),
        )
      : row,
  );

function fixture() {
  const files = new Map();
  const addJson = (name, value) => {
    const file = `/fixture/${name}.json`;
    files.set(file, Buffer.from(JSON.stringify(value)));
    return { settings: file, sha256: sha(canonical(value)) };
  };
  files.set("/fixture/client.mjs", Buffer.from("synthetic client"));
  files.set("/fixture/node", Buffer.from("synthetic node"));
  files.set("/fixture/operator.mjs", Buffer.from("synthetic operator"));
  files.set("/fixture/fallback.plist", Buffer.from("synthetic launch definition"));
  const operatorSettings = addJson("operator", {
    proofId,
    snapshot: {
      clientBundle: "/fixture/client.mjs",
      clientBundleSHA256: sha(files.get("/fixture/client.mjs")),
      serverBundleSHA256: "a".repeat(64),
      schema: 4,
    },
  });
  const relay = addJson("relay", { proof: { proofId }, relay: { session: "cg307-00000000" } });
  const fallback = addJson("fallback", {
    role: "fallback",
    proof: { proofId },
    stateFile: "/fixture/fallback.sqlite",
  });
  const binding = addJson("binding", {
    schemaVersion: 1,
    proofId,
    client: {
      node: "/fixture/node",
      nodeSha256: sha(files.get("/fixture/node")),
      bundle: "/fixture/client.mjs",
      sha256: sha(files.get("/fixture/client.mjs")),
    },
    operator: operatorSettings,
    relay,
    roles: [{ role: "fallback", ...fallback, initialize: true }],
  });
  files.set(
    "/fixture/go.json",
    Buffer.from(JSON.stringify({ verified: true, sourceSequence: 11, planSha256: "b".repeat(64) })),
  );
  const manifest = {
    schemaVersion: 1,
    proofId,
    planSha256: "b".repeat(64),
    sourceSequence: 10,
    startsAtMs: 100_000,
    endsAtMs: 1_000_000,
    binding,
    operator: {
      ...operatorSettings,
      program: "/fixture/operator.mjs",
      programSha256: sha(files.get("/fixture/operator.mjs")),
    },
    goFile: "/fixture/go.json",
    consumedFile: "/fixture/consumed.json",
    receiptFile: "/fixture/receipt.json",
    domain: "gui/501",
    roles: [
      {
        role: "fallback",
        label: `org.cg307.fallback.${proofId}`,
        plist: "/fixture/fallback.plist",
        sha256: sha(files.get("/fixture/fallback.plist")),
      },
    ],
  };
  const calls = [],
    loaded = new Set();
  let snapshotFails = false,
    cleanupFails = false,
    receiptWriteFailsOnce = false;
  const io = {
    uid: () => 501,
    now: () => 100_000,
    read: (file) => {
      assert.ok(files.has(file));
      return files.get(file);
    },
    stat: (file) => ({
      isFile: () => files.has(file),
      isSymbolicLink: () => false,
      uid: 501,
      mode: file.endsWith(".json") ? 0o600 : 0o755,
    }),
    write: (file, body, options) => {
      assert.ok(["wx", "w"].includes(options.flag));
      if (options.flag === "wx" && files.has(file)) throw Error("EEXIST");
      if (options.flag === "w") {
        assert.equal(file, manifest.receiptFile);
        assert.ok(files.has(file));
        if (receiptWriteFailsOnce) {
          receiptWriteFailsOnce = false;
          throw Error("fixture receipt write failed");
        }
      }
      files.set(file, Buffer.from(body));
    },
    run: (program, args) => {
      calls.push({ program, args });
      if (program === "/fixture/node" && args[1] === "ledger-proof" && args[2] === "status")
        return {
          status: 0,
          signal: null,
          stdout: JSON.stringify({
            proofId,
            role: "fallback",
            terminal: null,
            jobAdmitted: false,
            verifiedOutput: null,
            reportDelivered: false,
          }),
          stderr: "",
        };
      if (program === "/fixture/node" && args[0] === "/fixture/operator.mjs") {
        const mode = args[4];
        if (mode === "snapshot" && snapshotFails)
          return { status: 17, signal: null, stdout: "", stderr: "fixture queue read failed" };
        if (mode === "snapshot")
          return {
            status: 0,
            signal: null,
            stdout: JSON.stringify({ schema: 4, rows: [], events: [], accepted: null }),
            stderr: "",
          };
        if (mode === "protected-probe")
          return {
            status: 0,
            signal: null,
            stdout: JSON.stringify({ proofId, protectedIdle: true, baselineUnchanged: true }),
            stderr: "",
          };
        if (mode === "stop")
          return cleanupFails
            ? { status: 18, signal: null, stdout: "", stderr: "fixture stop failed" }
            : {
                status: 0,
                signal: null,
                stdout: JSON.stringify({
                  proofId,
                  containerStopped: true,
                  localProfileStopped: true,
                  capabilitiesRemoved: true,
                  baselineUnchanged: true,
                  scheduleRemoved: true,
                }),
                stderr: "",
              };
      }
      if (program === "/bin/launchctl") {
        if (args[0] === "print")
          return loaded.has(args[1])
            ? { status: 0, signal: null, stdout: "loaded", stderr: "" }
            : { status: 113, signal: null, stdout: "", stderr: "Could not find service" };
        if (args[0] === "bootstrap") {
          loaded.add(`gui/501/${manifest.roles[0].label}`);
          return { status: 0, signal: null, stdout: "", stderr: "" };
        }
        if (args[0] === "bootout") {
          loaded.delete(args[1]);
          return { status: 0, signal: null, stdout: "", stderr: "" };
        }
      }
      assert.fail(`unexpected program ${program}`);
    },
  };
  return {
    manifest,
    io,
    files,
    calls,
    failSnapshot: () => {
      snapshotFails = true;
    },
    failCleanup: () => {
      cleanupFails = true;
    },
    failFirstFinalReceipt: () => {
      receiptWriteFailsOnce = true;
    },
  };
}

test("verified one-use GO preflights before starting a role", () => {
  const f = fixture();
  const result = launchLocalProof(f.manifest, f.io);
  assert.equal(result.state, "STARTED");
  assert.deepEqual(result.rolesStarted, ["fallback"]);
  assert.equal(result.firstFailure, null);
  assert.ok(f.files.has(f.manifest.consumedFile));
  assert.ok(f.files.has(f.manifest.receiptFile));
  assert.equal(JSON.parse(f.files.get(f.manifest.receiptFile)).state, "STARTED");
  assert.ok(
    f.calls.findIndex(
      ({ program, args }) =>
        program === "/fixture/node" &&
        args[0] === "/fixture/operator.mjs" &&
        args[4] === "snapshot",
    ) <
      f.calls.findIndex(
        ({ program, args }) => program === "/bin/launchctl" && args[0] === "bootstrap",
      ),
  );
  assert.throws(() => launchLocalProof(f.manifest, f.io), /EEXIST/);
});

test("a pre-existing receipt blocks before GO consumption or role startup", () => {
  const f = fixture();
  f.files.set(f.manifest.receiptFile, Buffer.from("foreign receipt"));
  assert.throws(() => launchLocalProof(f.manifest, f.io), /EEXIST/);
  assert.equal(f.files.has(f.manifest.consumedFile), false);
  assert.equal(f.calls.length, 0);
});

test("a failed final receipt write enters exact cleanup after bootstrap", () => {
  const f = fixture();
  f.failFirstFinalReceipt();
  const result = launchLocalProof(f.manifest, f.io);
  assert.equal(result.state, "HELD_CLEANED");
  assert.equal(result.firstFailure.reason, "proof-guard-startup-failed");
  assert.deepEqual(result.rolesStarted, ["fallback"]);
  assert.equal(result.rolesAbsent, true);
  assert.equal(JSON.parse(f.files.get(f.manifest.receiptFile)).state, "HELD_CLEANED");
  assert.ok(f.calls.some(({ program, args }) => program === "/fixture/node" && args[4] === "stop"));
  assert.ok(
    f.calls.some(({ program, args }) => program === "/bin/launchctl" && args[0] === "bootout"),
  );
});

test("preflight failure enters cleanup and preserves its original error", () => {
  const f = fixture();
  f.failSnapshot();
  const result = launchLocalProof(f.manifest, f.io);
  assert.equal(result.state, "HELD_CLEANED");
  assert.equal(result.firstFailure.reason, "proof-guard-command-failed");
  assert.equal(result.firstFailure.private.exitCode, 17);
  assert.equal(result.firstFailure.private.stderr, "fixture queue read failed");
  assert.ok(
    f.calls.some(
      ({ program, args }) =>
        program === "/fixture/node" && args[0] === "/fixture/operator.mjs" && args[4] === "stop",
    ),
  );
  assert.equal(
    f.calls.filter(({ program, args }) => program === "/bin/launchctl" && args[0] === "bootstrap")
      .length,
    0,
  );
});

test("non-idle journal preflight still enters exact cleanup", () => {
  const f = fixture();
  const run = f.io.run;
  f.io.run = (program, args, input, timeout) => {
    const result = run(program, args, input, timeout);
    if (program === "/fixture/node" && args[2] === "status") {
      const body = JSON.parse(result.stdout);
      body.jobAdmitted = true;
      return { ...result, stdout: JSON.stringify(body) };
    }
    return result;
  };
  const result = launchLocalProof(f.manifest, f.io);
  assert.equal(result.state, "HELD_CLEANED");
  assert.equal(result.firstFailure.reason, "proof-bind-journal-not-idle-fallback");
  assert.ok(
    f.calls.some(
      ({ program, args }) =>
        program === "/fixture/node" && args[0] === "/fixture/operator.mjs" && args[4] === "stop",
    ),
  );
});

test("cleanup failure never replaces the first error or claims clean stop", () => {
  const f = fixture();
  f.failSnapshot();
  f.failCleanup();
  const result = launchLocalProof(f.manifest, f.io);
  assert.equal(result.state, "HELD_CLEANUP_UNVERIFIED");
  assert.equal(result.firstFailure.private.exitCode, 17);
  assert.equal(result.cleanupError, "proof-guard-command-failed");
});

test("a GO mismatch blocks before any one-use marker or role effect", () => {
  const f = fixture();
  f.files.set(
    f.manifest.goFile,
    Buffer.from(
      JSON.stringify({ verified: true, sourceSequence: 10, planSha256: f.manifest.planSha256 }),
    ),
  );
  assert.throws(() => launchLocalProof(f.manifest, f.io), /proof-guard-go-mismatch/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.files.has(f.manifest.consumedFile), false);
});

test("practice GO cannot select a launch role that differs from the bound practice role", () => {
  const f = fixture();
  const { manifest, files, io } = f;
  const replace = (ref, update) => {
    const value = JSON.parse(files.get(ref.settings));
    update(value);
    files.set(ref.settings, Buffer.from(JSON.stringify(value)));
    ref.sha256 = sha(canonical(value));
  };
  const proof = { proofId, practice: true };
  const planSha256 = sha(canonical(proof));
  replace(manifest.binding, (binding) => {
    replace(binding.relay, (relay) => {
      relay.proof = proof;
    });
    replace(binding.operator, (op) => {
      op.practicePlanSha256 = planSha256;
    });
    replace(binding.roles[0], (worker) => {
      worker.proof = proof;
    });
    manifest.operator.sha256 = binding.operator.sha256;
  });
  manifest.planSha256 = planSha256;
  files.set(
    manifest.goFile,
    Buffer.from(JSON.stringify({ verified: true, sourceSequence: 11, planSha256 })),
  );
  manifest.roles[0].role = "primary";
  assert.throws(() => launchLocalProof(manifest, io), /practice-role-binding-mismatch/);
  assert.equal(files.has(manifest.consumedFile), false);
  assert.deepEqual(f.calls, []);
});
