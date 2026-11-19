#!/usr/bin/env node
// Bound local proof operator. No effects at import. Host values arrive in private settings.
import { spawnSync } from "node:child_process";
import { readFileSync, lstatSync, realpathSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
const fail = (code) => {
  throw Error(`proof-operator-${code}`);
};
const requireThat = (value, code) => {
  if (!value) fail(code);
};
const hex = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const absolute = (v) => typeof v === "string" && isAbsolute(v) && !v.includes("\0");
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
const exact = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join() === keys.sort().join();
function normalizedMounts(mounts, code) {
  requireThat(Array.isArray(mounts), code);
  const sorted = [...mounts].sort((a, b) =>
    String(a?.Destination).localeCompare(String(b?.Destination)),
  );
  const destinations = sorted.map((m) => m?.Destination);
  requireThat(
    destinations.every((d) => typeof d === "string" && d.length > 0) &&
      new Set(destinations).size === destinations.length,
    code,
  );
  return sorted;
}
export function projection(c) {
  return {
    id: c.Id,
    image: c.Image,
    labels: c.Config?.Labels,
    mounts: normalizedMounts(c.Mounts, "container-drift"),
    portBindings: c.HostConfig?.PortBindings,
    nanoCpus: c.HostConfig?.NanoCpus,
    memory: c.HostConfig?.Memory,
    restartPolicy: c.HostConfig?.RestartPolicy,
    user: c.Config?.User,
    networkMode: c.HostConfig?.NetworkMode,
    privileged: c.HostConfig?.Privileged,
    readonlyRootfs: c.HostConfig?.ReadonlyRootfs,
  };
}
export function proofRelaySession(proofId) {
  requireThat(
    typeof proofId === "string" &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(proofId),
    "proof-id-invalid",
  );
  return `cg307-${proofId.slice(0, 8)}`;
}
const identityKeys = [
  "id",
  "image",
  "labels",
  "mounts",
  "portBindings",
  "nanoCpus",
  "memory",
  "restartPolicy",
  "user",
  "networkMode",
  "privileged",
  "readonlyRootfs",
];
function identity(v) {
  requireThat(
    exact(v, identityKeys) && hex(v.id) && /^sha256:[a-f0-9]{64}$/.test(v.image),
    "identity-invalid",
  );
  requireThat(
    v.labels &&
      typeof v.labels === "object" &&
      Array.isArray(v.mounts) &&
      v.mounts.length > 0 &&
      v.portBindings &&
      typeof v.portBindings === "object",
    "identity-invalid",
  );
  normalizedMounts(v.mounts, "identity-invalid");
  requireThat(
    Number.isSafeInteger(v.nanoCpus) &&
      v.nanoCpus >= 0 &&
      Number.isSafeInteger(v.memory) &&
      v.memory >= 0 &&
      typeof v.user === "string" &&
      v.user.length > 0 &&
      typeof v.networkMode === "string" &&
      typeof v.privileged === "boolean" &&
      typeof v.readonlyRootfs === "boolean",
    "identity-invalid",
  );
}
export function validateSettings(s) {
  requireThat(
    exact(s, [
      "schemaVersion",
      "proofId",
      "endsAtMs",
      "proofRoot",
      "uid",
      "nasAlias",
      "docker",
      "target",
      "snapshot",
      "protected",
      "local",
      ...(s?.practicePlanSha256 !== undefined ? ["practicePlanSha256"] : []),
    ]),
    "settings-invalid",
  );
  requireThat(
    s.schemaVersion === 1 &&
      /^[a-f0-9-]{36}$/.test(s.proofId) &&
      Number.isSafeInteger(s.endsAtMs) &&
      s.endsAtMs > 0 &&
      absolute(s.proofRoot) &&
      Number.isSafeInteger(s.uid) &&
      s.uid > 0 &&
      (s.practicePlanSha256 === undefined || hex(s.practicePlanSha256)),
    "settings-invalid",
  );
  requireThat(
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(s.nasAlias) && s.docker === "/usr/bin/docker",
    "route-invalid",
  );
  identity(s.target);
  identity(s.protected.container);
  requireThat(
    s.target.id !== s.protected.container.id &&
      s.target.labels["cg307-u1.proof"] === s.proofId &&
      s.target.privileged === false &&
      s.target.restartPolicy?.Name === "no" &&
      s.target.nanoCpus > 0 &&
      s.target.nanoCpus <= 1000000000 &&
      s.target.memory > 0 &&
      s.target.memory <= 1073741824,
    "target-invalid",
  );
  requireThat(
    exact(s.snapshot, [
      "serviceUid",
      "node",
      "bundle",
      "serverBundleSHA256",
      "clientBundle",
      "clientBundleSHA256",
      "schema",
      "database",
      "outputs",
    ]) &&
      /^(?:[1-9][0-9]*|node)$/.test(s.snapshot.serviceUid) &&
      ["node", "bundle", "clientBundle", "database", "outputs"].every((k) =>
        absolute(s.snapshot[k]),
      ) &&
      hex(s.snapshot.serverBundleSHA256) &&
      hex(s.snapshot.clientBundleSHA256) &&
      [4, 5].includes(s.snapshot.schema),
    "snapshot-invalid",
  );
  requireThat(s.target.user.split(":")[0] === s.snapshot.serviceUid, "snapshot-user-mismatch");
  for (const field of ["database", "outputs"]) {
    const path = s.snapshot[field];
    requireThat(
      s.target.mounts.some(
        (mount) =>
          mount.RW === true &&
          (path === mount.Destination || path.startsWith(mount.Destination + "/")),
      ),
      "snapshot-path-outside-container-mount",
    );
    requireThat(
      !s.target.mounts.some(
        (mount) => mount.Source && (path === mount.Source || path.startsWith(mount.Source + "/")),
      ),
      "snapshot-host-path-refused",
    );
  }
  requireThat(
    exact(s.protected, ["container", "serviceUid", "node", "database", "metadata", "files"]) &&
      /^(?:[1-9][0-9]*|node)$/.test(s.protected.serviceUid) &&
      absolute(s.protected.node) &&
      absolute(s.protected.database),
    "protected-invalid",
  );
  requireThat(
    s.protected.container.user.split(":")[0] === s.protected.serviceUid,
    "protected-user-mismatch",
  );
  requireThat(
    s.protected.metadata?.schema === 4 &&
      Array.isArray(s.protected.metadata.rows) &&
      s.protected.metadata.rows.length <= 10000 &&
      s.protected.files.length > 0 &&
      s.protected.files.every(
        (f) => exact(f, ["path", "sha256"]) && absolute(f.path) && hex(f.sha256),
      ),
    "baseline-invalid",
  );
  const l = s.local;
  requireThat(
    exact(l, [
      "domain",
      "stopLabels",
      "watchdogLabel",
      "pauseFiles",
      "ownedProcessMarkers",
      "wakeOwner",
    ]) &&
      l.domain === `gui/${s.uid}` &&
      l.stopLabels.length === 2 &&
      new Set(l.stopLabels).size === 2 &&
      !l.stopLabels.includes(l.watchdogLabel) &&
      [...l.stopLabels, l.watchdogLabel].every(
        (v) => /^[A-Za-z0-9._-]+$/.test(v) && v.includes(s.proofId),
      ),
    "local-selectors-invalid",
  );
  requireThat(
    l.pauseFiles.length === 2 &&
      l.ownedProcessMarkers.length >= 3 &&
      l.ownedProcessMarkers.length <= 16 &&
      [...l.pauseFiles, ...l.ownedProcessMarkers].every(
        (p) => absolute(p) && p.startsWith(s.proofRoot + "/"),
      ) &&
      l.wakeOwner === `cg307-u1-${s.proofId}`,
    "local-paths-invalid",
  );
  return structuredClone(s);
}
const metadataScript = `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1],{readOnly:true});try{db.exec('BEGIN');const schema=db.prepare('PRAGMA user_version').get().user_version;if(schema!==4)throw Error('schema');const rows=db.prepare('SELECT key,kind,status,attempts,fence,worker,lease_expires FROM jobs ORDER BY key LIMIT 10001').all();if(rows.length>10000)throw Error('bound');console.log(JSON.stringify({schema,rows}));db.exec('COMMIT')}finally{db.close()}`;
const bundleHashScript = `const fs=require('node:fs'),c=require('node:crypto');process.stdout.write(c.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'))`;
function realRun(program, args) {
  const r = spawnSync(program, args, {
    encoding: "utf8",
    timeout: 8000,
    maxBuffer: 4 * 1024 * 1024,
    env: {
      PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
      ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
    },
  });
  if (r.error || r.signal || typeof r.status !== "number") {
    const error = Error("proof-operator-command-unobservable");
    error.commandFailure = {
      status: typeof r.status === "number" ? r.status : null,
      signal: r.signal ?? null,
      stderr: String(r.stderr ?? "").slice(0, 4096),
    };
    throw error;
  }
  return { status: r.status, signal: null, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}
// The coordinator verifies signed, role-addressed receipts before setting verified.
function practiceBarrier(settings, input) {
  requireThat(
    exact(input, ["verified", "proofId", "endsAtMs", "planSha256", "targetIdSha256", "workers"]) &&
      input.verified === true &&
      input.proofId === settings.proofId &&
      input.endsAtMs === settings.endsAtMs &&
      input.planSha256 === settings.practicePlanSha256 &&
      input.targetIdSha256 === hash(settings.target.id) &&
      Array.isArray(input.workers) &&
      input.workers.length === 2,
    "practice-barrier-invalid",
  );
  const roles = new Set();
  const commands = new Set();
  const sequences = new Set();
  for (const worker of input.workers) {
    requireThat(
      exact(worker, ["sourceSequence", "role", "terminal", "launcher", "absence"]) &&
        ["primary", "fallback"].includes(worker.role) &&
        !roles.has(worker.role) &&
        Number.isSafeInteger(worker.sourceSequence) &&
        !sequences.has(worker.sourceSequence),
      "practice-worker-receipt-invalid",
    );
    const { terminal, launcher, absence } = worker;
    requireThat(
      exact(terminal, ["outcome", "reason", "stop", "atMs"]) &&
        terminal.outcome === "STOPPED" &&
        terminal.reason === "operator-stop" &&
        Number.isSafeInteger(terminal.atMs),
      "practice-worker-terminal-invalid",
    );
    const stop = terminal.stop;
    requireThat(
      exact(stop, [
        "verified",
        "proofId",
        "role",
        "settingsSha256",
        "commandId",
        "sourceSequence",
      ]) &&
        stop.verified === true &&
        stop.proofId === settings.proofId &&
        stop.role === worker.role &&
        hex(stop.settingsSha256) &&
        typeof stop.commandId === "string" &&
        /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(stop.commandId) &&
        Number.isSafeInteger(stop.sourceSequence) &&
        stop.sourceSequence > 0 &&
        worker.sourceSequence > stop.sourceSequence &&
        !commands.has(stop.commandId),
      "practice-worker-stop-invalid",
    );
    requireThat(
      exact(launcher, ["outcome", "child", "atMs"]) &&
        launcher.outcome === "STOPPED" &&
        exact(launcher.child, ["exitCode", "signal"]) &&
        launcher.child.exitCode === 0 &&
        launcher.child.signal === null &&
        Number.isSafeInteger(launcher.atMs) &&
        launcher.atMs >= terminal.atMs,
      "practice-launcher-terminal-invalid",
    );
    requireThat(
      exact(absence, ["label", "process", "slot", "grant", "signer"]) &&
        Object.values(absence).every((absent) => absent === true),
      "practice-worker-cleanup-unverified",
    );
    roles.add(worker.role);
    commands.add(stop.commandId);
    sequences.add(worker.sourceSequence);
  }
}

export function createOperator(input, overrides = {}) {
  const s = validateSettings(input);
  const io = {
    run: realRun,
    read: readFileSync,
    stat: lstatSync,
    realpath: realpathSync,
    write: writeFileSync,
    exists: existsSync,
    now: Date.now,
    ...overrides,
  };
  const checked = (program, args) => {
    const r = io.run(program, args);
    if (r.status !== 0 || r.signal) {
      const error = Error("proof-operator-command-failed");
      error.commandFailure = {
        status: typeof r.status === "number" ? r.status : null,
        signal: r.signal ?? null,
        stderr: String(r.stderr ?? "").slice(0, 4096),
      };
      throw error;
    }
    return r.stdout;
  };
  const remote = (args) =>
    checked("/usr/bin/ssh", [
      "-T",
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=5",
      "-o",
      "ServerAliveInterval=3",
      "-o",
      "ServerAliveCountMax=1",
      s.nasAlias,
      [s.docker, ...args].map(quote).join(" "),
    ]);
  const inspect = (expected) => {
    const rows = JSON.parse(remote(["inspect", expected.id]));
    requireThat(
      Array.isArray(rows) &&
        rows.length === 1 &&
        canonical(projection(rows[0])) ===
          canonical({ ...expected, mounts: normalizedMounts(expected.mounts, "identity-invalid") }),
      "container-drift",
    );
    return rows[0];
  };
  const exec = (container, uid, node, args) =>
    remote(["exec", "--user", uid, container, node, ...args]);
  function localFiles() {
    for (const f of s.protected.files) {
      const st = io.stat(f.path);
      requireThat(
        st.isFile() &&
          !st.isSymbolicLink() &&
          !(st.mode & 0o022) &&
          hash(io.read(f.path)) === f.sha256,
        "protected-file-drift",
      );
    }
  }
  function protectedCheck() {
    const c = inspect(s.protected.container);
    requireThat(
      c.State?.Running === true && c.State?.Paused === false && c.State?.Restarting === false,
      "protected-service-state",
    );
    const metadata = JSON.parse(
      exec(s.protected.container.id, s.protected.serviceUid, s.protected.node, [
        "-e",
        metadataScript,
        s.protected.database,
      ]),
    );
    requireThat(canonical(metadata) === canonical(s.protected.metadata), "protected-jobs-drift");
    requireThat(
      metadata.rows.every((r) => r.status === "done" || r.status === "failed"),
      "protected-work-active",
    );
    localFiles();
    return true;
  }
  function inputCheck(value, stop = false) {
    requireThat(
      exact(value, stop ? ["proofId", "endsAtMs"] : ["proofId"]) &&
        value.proofId === s.proofId &&
        (!stop || value.endsAtMs === s.endsAtMs),
      "input-mismatch",
    );
  }
  function pause(file) {
    const p = dirname(file);
    const st = io.stat(p);
    requireThat(
      st.isDirectory() &&
        !st.isSymbolicLink() &&
        st.uid === s.uid &&
        !(st.mode & 0o077) &&
        io.realpath(p) === p,
      "pause-parent-unsafe",
    );
    if (io.exists(file)) {
      const f = io.stat(file);
      requireThat(
        f.isFile() &&
          !f.isSymbolicLink() &&
          f.uid === s.uid &&
          !(f.mode & 0o077) &&
          String(io.read(file, "utf8")) === s.proofId + "\n",
        "pause-conflict",
      );
    } else io.write(file, s.proofId + "\n", { flag: "wx", mode: 0o600 });
  }
  function labelAbsent(label) {
    const r = io.run("/bin/launchctl", ["print", `${s.local.domain}/${label}`]);
    if (r.status === 0) return false;
    requireThat(
      r.status === 113 && /Could not find service/.test(r.stderr),
      "launchd-unobservable",
    );
    return true;
  }
  function ownedProcessesAbsent() {
    const processes = checked("/bin/ps", ["-axo", "uid=,pid=,command="]);
    return processes
      .split("\n")
      .every((line) => !s.local.ownedProcessMarkers.some((marker) => line.includes(marker)));
  }
  const operator = {
    snapshot(value) {
      inputCheck(value);
      const c = inspect(s.target);
      requireThat(
        c.State?.Running === true && !c.State?.Paused && !c.State?.Restarting,
        "target-not-running",
      );
      requireThat(
        hash(io.read(s.snapshot.clientBundle)) === s.snapshot.clientBundleSHA256,
        "client-bundle-drift",
      );
      requireThat(
        exec(s.target.id, s.snapshot.serviceUid, s.snapshot.node, [
          "-e",
          bundleHashScript,
          s.snapshot.bundle,
        ]).trim() === s.snapshot.serverBundleSHA256,
        "server-bundle-drift",
      );
      const result = JSON.parse(
        exec(s.target.id, s.snapshot.serviceUid, s.snapshot.node, [
          s.snapshot.bundle,
          "ledger-proof-snapshot",
          s.snapshot.database,
          s.snapshot.outputs,
        ]),
      );
      requireThat(
        result.schema === s.snapshot.schema &&
          Array.isArray(result.rows) &&
          result.rows.length <= 2 &&
          Array.isArray(result.events) &&
          result.events.length <= 256,
        "snapshot-invalid",
      );
      return result;
    },
    finishPractice(value) {
      requireThat(
        hex(s.practicePlanSha256) && io.now() < s.endsAtMs,
        "practice-finish-unavailable",
      );
      practiceBarrier(s, value);
      requireThat(
        s.local.stopLabels.every(labelAbsent) && ownedProcessesAbsent(),
        "practice-local-worker-present",
      );
      protectedCheck();
      const snapshot = operator.snapshot({ proofId: s.proofId });
      requireThat(
        snapshot.rows.length === 0 && snapshot.events.length === 0 && snapshot.accepted === null,
        "practice-queue-not-empty",
      );
      let stopRequestedAtMs;
      const cleanup = operator.stop({ proofId: s.proofId, endsAtMs: s.endsAtMs }, () => {
        stopRequestedAtMs = io.now();
        requireThat(stopRequestedAtMs < s.endsAtMs, "practice-finish-unavailable");
        io.write(
          join(s.proofRoot, "practice-queue-stop.json"),
          JSON.stringify({ barrier: value, snapshot, stopRequestedAtMs }) + "\n",
          { flag: "wx", mode: 0o600 },
        );
      });
      requireThat(
        stopRequestedAtMs !== undefined &&
          cleanup.containerStopped &&
          cleanup.localProfileStopped &&
          cleanup.capabilitiesRemoved &&
          cleanup.baselineUnchanged &&
          cleanup.scheduleRemoved,
        "practice-queue-cleanup-unverified",
      );
      const receipt = {
        proofId: s.proofId,
        snapshot,
        stopRequestedAtMs,
        stopConfirmedAtMs: io.now(),
        cleanup,
      };
      io.write(join(s.proofRoot, "practice-queue-stopped.json"), JSON.stringify(receipt) + "\n", {
        flag: "wx",
        mode: 0o600,
      });
      return receipt;
    },
    protectedProbe(value) {
      requireThat(
        value?.proofId === s.proofId &&
          (exact(value, ["proofId"]) ||
            (exact(value, ["proofId", "role"]) &&
              ["primary", "fallback", "supervisor", "watchdog"].includes(value.role))),
        "input-mismatch",
      );
      protectedCheck();
      return {
        proofId: s.proofId,
        observedAtMs: io.now(),
        protectedIdle: true,
        baselineUnchanged: true,
      };
    },
    stop(value, recordRequest) {
      inputCheck(value, true);
      const before = inspect(s.target);
      let pauseConflict = false,
        localStopError = false;
      for (const p of s.local.pauseFiles) {
        try {
          pause(p);
        } catch {
          pauseConflict = true;
        }
      }
      for (const label of s.local.stopLabels) {
        try {
          if (!labelAbsent(label))
            checked("/bin/launchctl", ["bootout", `${s.local.domain}/${label}`]);
        } catch {
          localStopError = true;
        }
      }
      if (before.State?.Running === true) {
        recordRequest?.();
        remote(["stop", "--time", "2", s.target.id]);
      }
      const after = inspect(s.target);
      const containerStopped =
        after.State?.Running === false &&
        after.State?.Paused === false &&
        after.State?.Restarting === false;
      let unloaded = false;
      try {
        unloaded = s.local.stopLabels.every(labelAbsent);
      } catch {
        localStopError = true;
      }
      const noOwned = ownedProcessesAbsent();
      const schedule = checked("/usr/bin/pmset", ["-g", "sched"]);
      const scheduleRemoved = !schedule.includes(s.local.wakeOwner);
      const baselineUnchanged = protectedCheck();
      const paused =
        !pauseConflict &&
        s.local.pauseFiles.every((p) => {
          if (!io.exists(p)) return false;
          const st = io.stat(p);
          return (
            st.isFile() &&
            !st.isSymbolicLink() &&
            st.uid === s.uid &&
            !(st.mode & 0o077) &&
            String(io.read(p, "utf8")) === s.proofId + "\n"
          );
        });
      const result = {
        proofId: s.proofId,
        containerStopped,
        localProfileStopped: unloaded && noOwned && !localStopError,
        capabilitiesRemoved: containerStopped && unloaded && noOwned && paused && !localStopError,
        baselineUnchanged,
        scheduleRemoved,
      };
      if (pauseConflict) result.pauseConflict = true;
      if (localStopError) result.localStopError = true;
      return result;
    },
  };
  return operator;
}
if (
  typeof __FLEET_PRACTICE_BUNDLE__ === "undefined" &&
  process.argv[1] &&
  realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    const args = process.argv.slice(2);
    requireThat(args.length === 4 && args[0] === "--settings" && args[2] === "--mode", "arguments");
    const st = lstatSync(args[1]);
    requireThat(
      st.isFile() && !st.isSymbolicLink() && st.uid === process.getuid() && !(st.mode & 0o177),
      "settings-permissions",
    );
    const settings = JSON.parse(readFileSync(args[1], "utf8"));
    const mode = args[3];
    requireThat(["snapshot", "protected-probe", "stop", "finish-practice"].includes(mode), "mode");
    const body = readFileSync(0, "utf8");
    requireThat(Buffer.byteLength(body) <= 4096, "input-bound");
    const op = createOperator(settings);
    const action =
      mode === "protected-probe"
        ? "protectedProbe"
        : mode === "finish-practice"
          ? "finishPractice"
          : mode;
    const result = op[action](JSON.parse(body));
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch (e) {
    if (e?.commandFailure) {
      try {
        const args = process.argv.slice(2),
          settings = JSON.parse(readFileSync(args[1], "utf8"));
        const file = join(settings.proofRoot, "operator-command-error.json");
        writeFileSync(file, `${canonical({ mode: args[3], ...e.commandFailure })}\n`, {
          flag: "wx",
          mode: 0o600,
        });
      } catch {}
    }
    if (e?.commandFailure)
      process.stderr.write(
        JSON.stringify({ reason: e.message, firstFailure: e.commandFailure }) + "\n",
      );
    else
      process.stderr.write(
        /^proof-operator-[a-z-]+$/.test(e?.message ?? "")
          ? e.message + "\n"
          : "proof-operator-failed\n",
      );
    process.exitCode = 1;
  }
}
