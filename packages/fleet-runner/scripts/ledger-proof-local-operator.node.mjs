import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createOperator,
  projection,
  proofRelaySession,
  validateSettings,
} from "./ledger-proof-local-operator.mjs";
const proofId = "00000000-0000-4000-8000-000000000001";
const sha = (x) => createHash("sha256").update(x).digest("hex");
test("host mount sources are refused before any snapshot process starts", () => {
  const f = fixture();
  f.settings.snapshot.database = "/private-fixture/jobs.sqlite";
  assert.throws(() => validateSettings(f.settings), /snapshot-path-outside-container-mount/);
  assert.equal(f.calls.length, 0);
});

function fixture() {
  const raw = (id) => ({
    Id: id,
    Image: "sha256:" + "c".repeat(64),
    Config: { Labels: { "cg307-u1.proof": proofId }, User: "1000" },
    Mounts: [
      { Source: "/private-fixture", Destination: "/state", RW: true },
      { Source: "/private-output", Destination: "/output", RW: true },
    ],
    HostConfig: {
      PortBindings: {},
      NanoCpus: 1e9,
      Memory: 1e9,
      RestartPolicy: { Name: "no" },
      NetworkMode: "fixture",
      Privileged: false,
      ReadonlyRootfs: true,
    },
    State: { Running: true, Paused: false, Restarting: false },
  });
  const target = raw("a".repeat(64)),
    protectedContainer = raw("b".repeat(64));
  const metadata = {
    schema: 4,
    rows: [
      {
        key: "d".repeat(64),
        kind: "vision",
        status: "done",
        attempts: 1,
        fence: 1,
        worker: null,
        lease_expires: null,
      },
    ],
  };
  const settings = {
    schemaVersion: 1,
    proofId,
    endsAtMs: 1000,
    proofRoot: "/fixture/proof",
    uid: 501,
    nasAlias: "fixture",
    docker: "/usr/bin/docker",
    target: projection(target),
    snapshot: {
      serviceUid: "1000",
      node: "/usr/bin/node",
      bundle: "/artifact/fleet.mjs",
      serverBundleSHA256: sha("bundle"),
      clientBundle: "/fixture/client.mjs",
      clientBundleSHA256: sha("client"),
      schema: 4,
      database: "/state/jobs.sqlite",
      outputs: "/output",
    },
    protected: {
      container: projection(protectedContainer),
      serviceUid: "1000",
      node: "/usr/bin/node",
      database: "/state/jobs.sqlite",
      metadata,
      files: [{ path: "/fixture/protected.plist", sha256: sha("baseline") }],
    },
    local: {
      domain: "gui/501",
      stopLabels: [`fallback.${proofId}`, `supervisor.${proofId}`],
      watchdogLabel: `watchdog.${proofId}`,
      pauseFiles: ["/fixture/proof/fallback.pause", "/fixture/proof/supervisor.pause"],
      ownedProcessMarkers: [
        "/fixture/proof/fallback.settings.json",
        "/fixture/proof/supervisor.settings.json",
        "/fixture/proof/bookcase-grant.json",
      ],
      wakeOwner: `cg307-u1-${proofId}`,
    },
  };
  const calls = [],
    files = new Map([
      ["/fixture/protected.plist", "baseline"],
      ["/fixture/client.mjs", "client"],
    ]),
    symlinks = new Set();
  let processText = "",
    schedule = "",
    practiceRows = [];
  const io = {
    run: (p, a) => {
      calls.push([p, a]);
      if (p === "/usr/bin/ssh") {
        const cmd = a.at(-1);
        if (cmd.includes("'inspect'"))
          return {
            status: 0,
            stdout: JSON.stringify([cmd.includes(target.Id) ? target : protectedContainer]),
            stderr: "",
          };
        if (cmd.includes("'stop'")) {
          target.State.Running = false;
          return { status: 0, stdout: target.Id, stderr: "" };
        }
        if (cmd.includes("SELECT key,kind"))
          return { status: 0, stdout: JSON.stringify(metadata), stderr: "" };
        if (cmd.includes("createHash")) return { status: 0, stdout: sha("bundle"), stderr: "" };
        if (cmd.includes("ledger-proof-snapshot"))
          return {
            status: 0,
            stdout: JSON.stringify({
              schema: 4,
              serverNowMs: 1,
              rows: practiceRows,
              events: [],
              accepted: null,
            }),
            stderr: "",
          };
        assert.fail("unexpected SSH command");
      }
      if (p === "/bin/launchctl") {
        assert.equal(a[0], "print");
        return { status: 113, stdout: "", stderr: "Could not find service" };
      }
      if (p === "/bin/ps") return { status: 0, stdout: processText, stderr: "" };
      if (p === "/usr/bin/pmset") return { status: 0, stdout: schedule, stderr: "" };
      assert.fail("unexpected program");
    },
    read: (p) => Buffer.from(files.get(p) ?? ""),
    stat: (p) => ({
      isDirectory: () => p === "/fixture/proof",
      isFile: () => p !== "/fixture/proof",
      isSymbolicLink: () => symlinks.has(p),
      uid: 501,
      mode: 0o600,
    }),
    realpath: (p) => p,
    exists: (p) => files.has(p),
    write: (p, b, o) => {
      assert.equal(o.flag, "wx");
      assert.ok(calls.some(([_, args]) => args.at(-1).includes("'inspect'")));
      files.set(p, b);
    },
    now: () => 1,
  };
  return {
    settings,
    calls,
    target,
    metadata,
    files,
    symlinks,
    io,
    op: () => createOperator(settings, io),
    process: (v) => (processText = v),
    schedule: (v) => (schedule = v),
    practiceRows: (v) => (practiceRows = v),
  };
}
test("snapshot fixes canonical argv, UID, schema and bundle pin without arbitrary command text", () => {
  const f = fixture();
  assert.equal(f.op().snapshot({ proofId }).schema, 4);
  assert.ok(
    f.calls.at(-1)[1].at(-1).includes("'ledger-proof-snapshot' '/state/jobs.sqlite' '/output'"),
  );
  assert.ok(f.calls.at(-1)[1].at(-1).includes("'exec' '--user' '1000'"));
});
test("drift refuses snapshot before execution and stop before local mutation", () => {
  for (const mode of ["snapshot", "stop"]) {
    const f = fixture();
    const op = f.op();
    f.target.HostConfig.Memory = 2;
    assert.throws(
      () => op[mode](mode === "stop" ? { proofId, endsAtMs: 1000 } : { proofId }),
      /container-drift/,
    );
    assert.equal(f.calls.length, 1);
    assert.equal(f.files.size, 2);
  }
});
test("stop is exact-ID, preserves watchdog, verifies pauses and stopped target", () => {
  const f = fixture();
  assert.deepEqual(f.op().stop({ proofId, endsAtMs: 1000 }), {
    proofId,
    containerStopped: true,
    localProfileStopped: true,
    capabilitiesRemoved: true,
    baselineUnchanged: true,
    scheduleRemoved: true,
  });
  const stop = f.calls.find((c) => c[0] === "/usr/bin/ssh" && c[1].at(-1).includes("'stop'"));
  assert.ok(stop[1].at(-1).endsWith(`'${f.target.Id}'`));
  assert.ok(!f.calls.some((c) => c[1].join(" ").includes(f.settings.local.watchdogLabel)));
  assert.equal(f.files.size, 4);
});
test("repeat exact stop accepts only its own retained pause markers", () => {
  const f = fixture();
  assert.equal(f.op().stop({ proofId, endsAtMs: 1000 }).capabilitiesRemoved, true);
  assert.equal(f.op().stop({ proofId, endsAtMs: 1000 }).capabilitiesRemoved, true);
  assert.equal(f.files.get(f.settings.local.pauseFiles[0]), proofId + "\n");
  assert.equal(f.files.size, 4);
});
test("foreign or symlink pause marker cannot be adopted, but exact target stop still runs", () => {
  for (const kind of ["foreign", "symlink"]) {
    const f = fixture(),
      p = f.settings.local.pauseFiles[0];
    f.files.set(p, kind === "foreign" ? "other-proof\n" : proofId + "\n");
    if (kind === "symlink") f.symlinks.add(p);
    const original = f.files.get(p),
      r = f.op().stop({ proofId, endsAtMs: 1000 });
    assert.equal(r.containerStopped, true);
    assert.equal(r.capabilitiesRemoved, false);
    assert.equal(r.pauseConflict, true);
    assert.equal(f.files.get(p), original);
    assert.ok(f.calls.some((c) => c[0] === "/usr/bin/ssh" && c[1].at(-1).includes("'stop'")));
  }
});
test("owned process or wake never manufactures cleanup success", () => {
  const f = fixture();
  f.process("501 9 /fixture/proof/fallback.settings.json");
  f.schedule(f.settings.local.wakeOwner);
  const r = f.op().stop({ proofId, endsAtMs: 1000 });
  assert.equal(r.localProfileStopped, false);
  assert.equal(r.capabilitiesRemoved, false);
  assert.equal(r.scheduleRemoved, false);
});
test("protected rows and immutable files fail closed", () => {
  const f = fixture();
  const op = f.op();
  f.metadata.rows[0].status = "claimed";
  assert.throws(() => op.protectedProbe({ proofId }), /protected-jobs-drift/);
  const g = fixture();
  g.files.set("/fixture/protected.plist", "changed");
  assert.throws(() => g.op().protectedProbe({ proofId }), /protected-file-drift/);
});
test("actual worker readiness probe shape is accepted and malformed role inputs are refused", () => {
  const f = fixture(),
    op = f.op();
  assert.equal(op.protectedProbe({ proofId, role: "fallback" }).protectedIdle, true);
  assert.equal(op.protectedProbe({ proofId, role: "supervisor" }).baselineUnchanged, true);
  for (const value of [
    { proofId: "wrong", role: "fallback" },
    { proofId, role: "other" },
    { proofId, role: "fallback", extra: true },
  ])
    assert.throws(() => op.protectedProbe(value), /input-mismatch/);
});
test("unresolved identifiers, input mismatch and unsafe settings are refused offline", () => {
  const f = fixture();
  assert.throws(() => f.op().snapshot({ proofId: "wrong" }), /input-mismatch/);
  f.settings.target.id = "short";
  assert.throws(() => validateSettings(f.settings), /identity-invalid/);
  assert.equal(f.calls.length, 0);
});

test("pinned image named node user is accepted only with exact matching exec identity", () => {
  const f = fixture();
  f.target.Config.User = "node";
  f.settings.target.user = "node";
  f.settings.snapshot.serviceUid = "node";
  assert.equal(f.op().snapshot({ proofId }).schema, 4);
  assert.ok(f.calls.at(-1)[1].at(-1).includes("'exec' '--user' 'node'"));
  f.settings.snapshot.serviceUid = "1000";
  assert.throws(() => validateSettings(f.settings), /snapshot-user-mismatch/);
});

test("existing protected unlimited resource settings are preserved, proof limits remain mandatory", () => {
  const f = fixture();
  f.settings.protected.container.nanoCpus = 0;
  f.settings.protected.container.memory = 0;
  assert.doesNotThrow(() => validateSettings(f.settings));
  f.settings.target.nanoCpus = 0;
  assert.throws(() => validateSettings(f.settings), /target-invalid/);
  f.settings.target.nanoCpus = 1e9;
  f.settings.target.memory = 2 * 1073741824;
  assert.throws(() => validateSettings(f.settings), /target-invalid/);
});

test("Docker mount ordering is normalized while every mount property stays pinned", () => {
  const f = fixture();
  f.target.Mounts.push({ Source: "/second", Destination: "/artifact", RW: false });
  f.settings.target = projection(f.target);
  f.target.Mounts.reverse();
  const op = f.op();
  assert.equal(op.snapshot({ proofId }).schema, 4);
  f.target.Mounts[0].Source = "/changed";
  assert.throws(() => op.snapshot({ proofId }), /container-drift/);
});
test("expected and observed mount permutations match, but actual mount drift still blocks", () => {
  const base = fixture();
  base.target.Mounts.push({ Source: "/second", Destination: "/artifact", RW: false });
  base.settings.target = projection(base.target);
  base.settings.target.mounts.reverse();
  assert.equal(base.op().snapshot({ proofId }).schema, 4);
  for (const change of [
    (m) => (m[0].Source = "/changed"),
    (m) => (m[0].Destination = "/changed"),
    (m) => (m[0].RW = false),
    (m) => m.push({ Source: "/extra", Destination: "/extra", RW: true }),
    (m) => m.pop(),
  ]) {
    const f = fixture();
    f.target.Mounts.push({ Source: "/second", Destination: "/artifact", RW: false });
    f.settings.target = projection(f.target);
    const op = f.op();
    change(f.target.Mounts);
    assert.throws(() => op.snapshot({ proofId }), /container-drift/);
  }
});
test("duplicate mount destination is rejected on either side", () => {
  const a = fixture();
  a.settings.target.mounts.push({ ...a.settings.target.mounts[0] });
  assert.throws(() => validateSettings(a.settings), /identity-invalid/);
  const b = fixture();
  b.target.Mounts.push({ ...b.target.Mounts[0] });
  assert.throws(() => b.op().snapshot({ proofId }), /container-drift/);
});
test("image, port and full target ID remain exact under mount normalization", () => {
  for (const change of [
    (f) => (f.target.Image = "sha256:" + "e".repeat(64)),
    (f) =>
      (f.target.HostConfig.PortBindings = { "8787/tcp": [{ HostIp: "127.0.0.1", HostPort: "1" }] }),
    (f) => (f.target.Id = "e".repeat(64)),
  ]) {
    const f = fixture(),
      op = f.op();
    change(f);
    assert.throws(() => op.snapshot({ proofId }), /container-drift/);
  }
});

test("snapshot command failure retains bounded real stderr and exit status for private receipt", () => {
  const f = fixture();
  const run = f.io.run;
  f.io.run = (p, a) => {
    if (p === "/usr/bin/ssh" && a.at(-1).includes("ledger-proof-snapshot"))
      return { status: 17, signal: null, stdout: "", stderr: "fixture permission denied" };
    return run(p, a);
  };
  assert.throws(
    () => f.op().snapshot({ proofId }),
    (error) => {
      assert.equal(error.message, "proof-operator-command-failed");
      assert.deepEqual(error.commandFailure, {
        status: 17,
        signal: null,
        stderr: "fixture permission denied",
      });
      return true;
    },
  );
});

test("client and server bundle digests are independent gates", () => {
  const client = fixture();
  client.files.set("/fixture/client.mjs", "changed");
  assert.throws(() => client.op().snapshot({ proofId }), /client-bundle-drift/);
  assert.equal(client.calls.filter((c) => c[0] === "/usr/bin/ssh").length, 1);
  const server = fixture();
  server.settings.snapshot.serverBundleSHA256 = sha("other");
  assert.throws(() => server.op().snapshot({ proofId }), /server-bundle-drift/);
  assert.ok(
    server.calls.some((c) => c[0] === "/usr/bin/ssh" && c[1].at(-1).includes("createHash")),
  );
});

test("snapshot schema is pinned per isolated queue", () => {
  const f = fixture();
  f.settings.snapshot.schema = 5;
  assert.throws(() => f.op().snapshot({ proofId }), /snapshot-invalid/);
  const run = f.io.run;
  f.io.run = (p, a) =>
    p === "/usr/bin/ssh" && a.at(-1).includes("ledger-proof-snapshot")
      ? {
          status: 0,
          stdout: JSON.stringify({
            schema: 5,
            serverNowMs: 1,
            rows: [],
            events: [],
            accepted: null,
          }),
          stderr: "",
        }
      : run(p, a);
  assert.equal(f.op().snapshot({ proofId }).schema, 5);
});

test("relay session derives a stable short proof identifier", () => {
  assert.equal(proofRelaySession(proofId), "cg307-00000000");
  assert.ok(proofRelaySession(proofId).length <= 32);
  for (const bad of ["00000000", "00000000-0000-4000-8000-000000000001-extra"])
    assert.throws(() => proofRelaySession(bad), /proof-id-invalid/);
});

function practiceBarrier(f) {
  f.settings.practicePlanSha256 = sha("practice plan");
  return {
    verified: true,
    proofId,
    endsAtMs: 1000,
    planSha256: f.settings.practicePlanSha256,
    targetIdSha256: sha(f.target.Id),
    workers: ["primary", "fallback"].map((role, offset) => ({
      role,
      sourceSequence: 30 + offset,
      terminal: {
        outcome: "STOPPED",
        reason: "operator-stop",
        atMs: 1,
        stop: {
          verified: true,
          proofId,
          role,
          settingsSha256: sha(role),
          commandId: `00000000-0000-4000-8000-00000000000${offset}`,
          sourceSequence: 20 + offset,
        },
      },
      launcher: { outcome: "STOPPED", child: { exitCode: 0, signal: null }, atMs: 2 },
      absence: { label: true, process: true, slot: true, grant: true, signer: true },
    })),
  };
}

test("practice finish keeps the queue up through both receipts and the final empty snapshot", () => {
  const f = fixture(),
    barrier = practiceBarrier(f);
  const commands = f.io.run;
  f.io.run = (program, args) => {
    if (args.at(-1).includes("'stop'")) {
      const intent = JSON.parse(f.files.get("/fixture/proof/practice-queue-stop.json"));
      assert.deepEqual(intent.barrier, barrier);
      assert.deepEqual(intent.snapshot.rows, []);
      assert.ok(f.calls.some(([, args]) => args.at(-1).includes("'ledger-proof-snapshot'")));
    }
    return commands(program, args);
  };
  const result = f.op().finishPractice(barrier);
  assert.equal(result.cleanup.containerStopped, true);
  assert.equal(result.stopRequestedAtMs, 1);
});

test("practice finish leaves the queue up with missing, unbound or unclean evidence", () => {
  for (const change of [
    (f, b) => b.workers.pop(),
    (f, b) => (b.targetIdSha256 = sha("wrong target")),
    (f, b) => (b.workers[0].terminal.outcome = "HELD"),
    (f, b) => (b.workers[1].launcher.child.signal = "SIGKILL"),
    (f, b) => (b.workers[1].absence.slot = false),
    (f) => f.practiceRows([{ key: "nonempty" }]),
    (f) => f.process("/fixture/proof/fallback.settings.json"),
  ]) {
    const f = fixture(),
      barrier = practiceBarrier(f);
    change(f, barrier);
    assert.throws(() => f.op().finishPractice(barrier), /proof-operator-practice-/);
    assert.equal(f.target.State.Running, true);
    assert.equal(f.files.has("/fixture/proof/practice-queue-stop.json"), false);
  }
});
