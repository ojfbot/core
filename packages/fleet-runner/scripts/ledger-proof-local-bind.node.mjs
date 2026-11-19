import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { inspectLocalBinding, prepareLocalBinding } from "./ledger-proof-local-bind.mjs";

const proofId = "00000000-0000-4000-8000-000000000001";
const hash = (value) => createHash("sha256").update(value).digest("hex");
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
  const config = (name, body) => {
    const file = `/fixture/${name}.json`;
    files.set(file, Buffer.from(JSON.stringify(body)));
    return { settings: file, sha256: hash(canonical(body)) };
  };
  const clientBundle = "/fixture/client.mjs";
  files.set("/fixture/node", Buffer.from("synthetic node"));
  files.set(clientBundle, Buffer.from("synthetic bundle"));
  const clientSha256 = hash(files.get(clientBundle));
  const operator = config("operator", {
    proofId,
    snapshot: {
      clientBundle,
      clientBundleSHA256: clientSha256,
      serverBundleSHA256: "a".repeat(64),
    },
  });
  const relay = config("relay", {
    proof: { proofId },
    relay: { session: "cg307-00000000" },
  });
  const roles = [
    { role: "supervisor", stateFile: "/fixture/control.sqlite", initialize: true },
    { role: "watchdog", stateFile: "/fixture/control.sqlite", initialize: false },
    { role: "fallback", stateFile: "/fixture/fallback.sqlite", initialize: true },
  ].map(({ role, stateFile, initialize }) => ({
    role,
    ...config(role, { role, stateFile, proof: { proofId } }),
    initialize,
  }));
  const manifest = {
    schemaVersion: 1,
    proofId,
    client: {
      node: "/fixture/node",
      nodeSha256: hash(files.get("/fixture/node")),
      bundle: clientBundle,
      sha256: clientSha256,
    },
    operator,
    relay,
    roles,
  };
  const calls = [];
  let admitted = false;
  const io = {
    uid: () => 501,
    read: (file) => {
      assert.ok(files.has(file));
      return files.get(file);
    },
    stat: (file) => ({
      isFile: () => files.has(file),
      isSymbolicLink: () => false,
      uid: 501,
      mode: file === clientBundle || file === "/fixture/node" ? 0o755 : 0o600,
    }),
    run: (program, args) => {
      calls.push({ program, args });
      assert.equal(program, "/fixture/node");
      assert.equal(args[0], clientBundle);
      assert.equal(args[1], "ledger-proof");
      const role = JSON.parse(files.get(args[4])).role;
      const body =
        args[2] === "init"
          ? { initialized: true }
          : {
              proofId,
              role,
              terminal: null,
              jobAdmitted: admitted,
              verifiedOutput: null,
              reportDelivered: false,
            };
      return { status: 0, signal: null, stdout: JSON.stringify(body) };
    },
  };
  return {
    manifest,
    files,
    io,
    calls,
    admit: () => {
      admitted = true;
    },
  };
}

test("one journal init per state file precedes all idle status checks", () => {
  const f = fixture();
  assert.equal(inspectLocalBinding(f.manifest, f.io).journalCount, 2);
  assert.deepEqual(prepareLocalBinding(f.manifest, f.io), {
    prepared: true,
    proofId,
    journals: 2,
    roles: ["supervisor", "watchdog", "fallback"],
  });
  assert.deepEqual(
    f.calls.map(({ args }) => args[2]),
    ["init", "init", "status", "status", "status"],
  );
});

test("drift in either paired bundle or relay binding blocks before journal init", () => {
  const node = fixture();
  node.files.set("/fixture/node", Buffer.from("changed node"));
  assert.throws(() => prepareLocalBinding(node.manifest, node.io), /proof-bind-node-drift/);
  assert.equal(node.calls.length, 0);
  const client = fixture();
  client.files.set("/fixture/client.mjs", Buffer.from("changed"));
  assert.throws(() => prepareLocalBinding(client.manifest, client.io), /proof-bind-client-drift/);
  assert.equal(client.calls.length, 0);
  const relay = fixture();
  const changed = { proof: { proofId }, relay: { session: "cg307-u1-00000000" } };
  relay.files.set(relay.manifest.relay.settings, Buffer.from(JSON.stringify(changed)));
  relay.manifest.relay.sha256 = hash(canonical(changed));
  assert.throws(
    () => prepareLocalBinding(relay.manifest, relay.io),
    /proof-bind-relay-binding-mismatch/,
  );
  assert.equal(relay.calls.length, 0);
});

test("a Node executable larger than the client bundle limit remains hash-bound", () => {
  const f = fixture();
  const bytes = Buffer.alloc(17 * 1024 * 1024, 7);
  f.files.set("/fixture/node", bytes);
  f.manifest.client.nodeSha256 = hash(bytes);
  assert.equal(inspectLocalBinding(f.manifest, f.io).journalCount, 2);
  bytes[0] = 8;
  assert.throws(() => inspectLocalBinding(f.manifest, f.io), /proof-bind-node-drift/);
});

test("each shared journal must have exactly one initializer", () => {
  for (const value of [false, true]) {
    const f = fixture();
    f.manifest.roles[1].initialize = value;
    if (!value) f.manifest.roles[0].initialize = false;
    assert.throws(
      () => prepareLocalBinding(f.manifest, f.io),
      /proof-bind-journal-initializer-mismatch/,
    );
    assert.equal(f.calls.length, 0);
  }
});

test("admitted state fails the pre-READY gate", () => {
  const f = fixture();
  f.admit();
  assert.throws(
    () => prepareLocalBinding(f.manifest, f.io),
    /proof-bind-journal-not-idle-supervisor/,
  );
  assert.deepEqual(
    f.calls.map(({ args }) => args[2]),
    ["init", "init", "status"],
  );
});

test("role settings are hash-bound before any journal mutation", () => {
  const f = fixture();
  f.files.set(f.manifest.roles[0].settings, Buffer.from('{"role":"fallback"}'));
  assert.throws(() => prepareLocalBinding(f.manifest, f.io), /proof-bind-role-binding-mismatch/);
  assert.equal(f.calls.length, 0);
});

test("practice binding pins relay, role and operator to the same practice plan and excludes supervisor", () => {
  const f = fixture();
  const { manifest, files, io } = f;
  const replace = (ref, update) => {
    const value = JSON.parse(files.get(ref.settings));
    update(value);
    files.set(ref.settings, Buffer.from(JSON.stringify(value)));
    ref.sha256 = hash(canonical(value));
  };
  const proof = { proofId, practice: true };
  const planSha256 = hash(canonical(proof));
  replace(manifest.relay, (value) => {
    value.proof = proof;
  });
  replace(manifest.operator, (value) => {
    value.practicePlanSha256 = planSha256;
  });
  const fallback = manifest.roles.find((entry) => entry.role === "fallback");
  const supervisor = manifest.roles.find((entry) => entry.role === "supervisor");
  for (const ref of [fallback, supervisor])
    replace(ref, (value) => {
      value.proof = proof;
    });
  assert.throws(() => inspectLocalBinding(manifest, io), /practice-role-binding-mismatch/);
  manifest.roles = [fallback];
  assert.equal(inspectLocalBinding(manifest, io).practicePlanSha256, planSha256);
  replace(manifest.operator, (value) => {
    value.practicePlanSha256 = hash("different plan");
  });
  assert.throws(() => inspectLocalBinding(manifest, io), /practice-operator-mismatch/);
  assert.deepEqual(f.calls, []);
});
