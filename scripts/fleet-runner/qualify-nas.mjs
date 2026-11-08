#!/usr/bin/env node
// Explicit, isolated NAS qualification. This script never reboots an appliance or changes a live worker.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isIPv4 } from "node:net";
import { join, resolve, posix } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { qualificationDiagnostic } from "./qualification-diagnostic.mjs";
import { rebootRecoveryWindow } from "./reboot-timing.mjs";

const execFile = promisify(execFileCallback);
const [mode, rootArg] = process.argv.slice(2);
assert.ok(
  ["prepare", "resume-prepare", "run", "arm-reboot", "after-reboot", "status"].includes(mode),
);
assert.ok(rootArg, "an explicit new local evidence directory is required");
const root = resolve(rootArg);
const source = resolve(process.env.FLEET_SOURCE_ROOT ?? process.cwd());
const { fleetClient } = await import(
  pathToFileURL(join(source, "packages/fleet-runner/dist/client.js"))
);
const { generateToken, signer } = await import(
  pathToFileURL(join(source, "packages/fleet-runner/dist/auth.js"))
);
const { workOnce } = await import(
  pathToFileURL(join(source, "packages/fleet-runner/dist/worker.js"))
);
const { writeOutput } = await import(
  pathToFileURL(join(source, "packages/fleet-runner/dist/jobs.js"))
);
const { errorCode } = await import(
  pathToFileURL(join(source, "packages/fleet-runner/dist/diagnostics.js"))
);
let config;
let phase = mode;
const q = (value) => "'" + String(value).replaceAll("'", "'\\''") + "'";
async function docker(args) {
  const { stdout } = await execFile("docker", args, { maxBuffer: 1024 * 1024, timeout: 90_000 });
  return stdout.trim();
}
async function remote(command) {
  const { stdout } = await execFile(
    "ssh",
    ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", config.ssh, command],
    { maxBuffer: 1024 * 1024, timeout: 30_000 },
  );
  return stdout.trim();
}
async function save() {
  await writeFile(join(root, "manifest.json"), JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
}
const mounts = (outputMode = "") => [
  "--mount",
  `type=bind,src=${config.nasRoot}/state,dst=/var/lib/fleet-runner/state`,
  "--mount",
  `type=bind,src=${config.nasRoot}/output,dst=/var/lib/fleet-runner/output${outputMode}`,
  "--mount",
  `type=bind,src=${config.nasRoot}/public-keys,dst=/run/fleet-runner/public-keys,readonly`,
  "--mount",
  `type=bind,src=${config.nasRoot}/tls,dst=/run/fleet-runner/tls,readonly`,
];
const startArgs = () => [
  "run",
  "--detach",
  "--name",
  config.container,
  "--platform",
  "linux/amd64",
  "--restart",
  "unless-stopped",
  "--stop-timeout",
  "30",
  "--publish",
  `${config.lan}:${config.port}:8787`,
  ...mounts(),
  "--env",
  "FLEET_TLS_CERT=/run/fleet-runner/tls/server.crt",
  "--env",
  "FLEET_TLS_KEY=/run/fleet-runner/tls/server.key",
  config.image,
  "serve",
];
const client = () => fleetClient(config.endpoint, "owner", join(root, "owner"));
async function ready(limitMs = 60_000) {
  const start = Date.now();
  for (;;) {
    try {
      return { report: await client().report(), elapsedMs: Date.now() - start };
    } catch (error) {
      if (Date.now() - start >= limitMs) throw error;
      await delay(500);
    }
  }
}
async function verify(expected) {
  const owner = client();
  const report = await owner.report();
  assert.equal(report.period.byWorker["qualification-worker"]?.completed ?? 0, expected);
  assert.equal(report.now.byKind["proof-fixture"]?.ready ?? 0, 0);
  assert.equal(report.now.byKind["proof-fixture"]?.claimed ?? 0, 0);
  assert.equal(report.now.byKind["proof-fixture"]?.failed ?? 0, 0);
  for (const key of config.jobs) assert.equal((await owner.verify(key)).verified, true);
  // Independent filesystem reader: no SQLite or queue reducer in this comparison.
  const keys = JSON.stringify(config.jobs);
  const code = `import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs';
    import {createHash} from 'node:crypto'; const expected = Buffer.from('fleet NAS qualification v1\\n');
    for (const key of ${keys}) { const bytes=readFileSync('/accepted/'+key+'.1.jsonl');
      assert.deepEqual(bytes, expected); assert.equal(createHash('sha256').update(bytes).digest('hex'), createHash('sha256').update(expected).digest('hex')); }
    console.log('checked');`;
  assert.equal(
    await docker([
      "run",
      "--rm",
      "--user",
      "1000:1000",
      "--mount",
      `type=bind,src=${config.nasRoot}/output,dst=/accepted,readonly`,
      "--entrypoint",
      "node",
      config.image,
      "--input-type=module",
      "-e",
      code,
    ]),
    "checked",
  );
  return { completed: expected, acceptedFilesChecked: config.jobs.length, sha256Matches: true };
}
async function load() {
  config = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
}
async function trustedRestart() {
  if (process.env.FR_QUAL_TRUSTED_PROCESS === "1") return false;
  const { stdout } = await execFile(
    process.execPath,
    [fileURLToPath(import.meta.url), mode, root],
    {
      env: {
        ...process.env,
        NODE_EXTRA_CA_CERTS: join(root, "ca.crt"),
        FR_QUAL_TRUSTED_PROCESS: "1",
      },
      maxBuffer: 1024 * 1024,
      timeout: mode === "run" ? 600_000 : 330_000,
    },
  );
  process.stdout.write(stdout);
  return true;
}
async function prepare() {
  if (mode === "resume-prepare") {
    await load();
    assert.equal(config.status, "preparing");
  } else {
    assert.equal(process.env.FLEET_QUALIFY_CONFIRM, "isolated-only");
    const {
      FLEET_NAS_ROOT: nasRoot,
      FLEET_NAS_SSH: ssh,
      FLEET_LAN_IP: lan,
      FLEET_IMAGE: image,
      FLEET_IMAGE_SOURCE_COMMIT: imageSource,
    } = process.env;
    assert.ok(
      nasRoot &&
        posix.isAbsolute(nasRoot) &&
        nasRoot.split("/").length >= 4 &&
        !nasRoot.includes(","),
    );
    assert.ok(ssh && /^[a-zA-Z0-9._-]+$/.test(ssh));
    assert.ok(lan && isIPv4(lan));
    const [a, b] = lan.split(".").map(Number);
    assert.ok(a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31));
    assert.match(image ?? "", /^sha256:[a-f0-9]{64}$/);
    assert.match(imageSource ?? "", /^[a-f0-9]{40}$/);
    const port = Number(process.env.FLEET_HOST_PORT);
    assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
    assert.equal(process.env.DOCKER_HOST, `ssh://${ssh}`);
    await mkdir(root, { mode: 0o700 });
    config = {
      format: "fleet-nas-qualification/1",
      ssh,
      nasRoot,
      lan,
      port,
      image,
      imageSource,
      endpoint: `https://${lan}:${port}`,
      container: `fleet-qualification-${Date.now()}`,
      jobs: [],
      crashes: [],
      reboots: [],
      createdAt: new Date().toISOString(),
      status: "preparing",
    };
    await save();
    await remote(
      `test ! -e ${q(nasRoot)} && umask 077 && mkdir -m 700 ${q(nasRoot)} && mkdir ${["state", "output", "public-keys", "tls", "bad-state", "bad-output", "empty-registry"].map((x) => q(nasRoot + "/" + x)).join(" ")}`,
    );
    await remote(
      `umask 077; openssl req -x509 -newkey rsa:2048 -nodes -days 14 -subj /CN=fleet-qualification -addext ${q("subjectAltName=IP:" + lan)} -keyout ${q(nasRoot + "/tls/server.key")} -out ${q(nasRoot + "/tls/server.crt")} >/dev/null 2>&1 && cp ${q(nasRoot + "/tls/server.crt")} ${q(nasRoot + "/ca.crt")}`,
    );
    generateToken(join(root, "owner"));
    generateToken(join(root, "worker"));
  }
  const { ssh, nasRoot, image, lan } = config;
  phase = "public-verifiers";
  for (const [file, id] of [
    ["owner", "owner"],
    ["worker", "qualification-worker"],
  ]) {
    await execFile("scp", [
      "-O",
      "-q",
      join(root, file + ".pub"),
      `${ssh}:${nasRoot}/public-keys/${id}.pub`,
    ]);
  }
  phase = "public-ca";
  await execFile("scp", ["-O", "-q", `${ssh}:${nasRoot}/ca.crt`, join(root, "ca.crt")]);
  const initialize = `import {chownSync,chmodSync} from 'node:fs';
    for(const x of ['state','output','bad-state','bad-output','tls']) { chownSync('/setup/'+x,1000,1000); chmodSync('/setup/'+x,0o700); }
    for(const x of ['public-keys','empty-registry']) chmodSync('/setup/'+x,0o755);
    for(const x of ['server.key','server.crt']) {chownSync('/setup/tls/'+x,1000,1000);chmodSync('/setup/tls/'+x,0o600);}`;
  phase = "service-permissions";
  await docker([
    "run",
    "--rm",
    "--user",
    "0:0",
    "--mount",
    `type=bind,src=${nasRoot},dst=/setup`,
    "--entrypoint",
    "node",
    image,
    "--input-type=module",
    "-e",
    initialize,
  ]);
  phase = "service-start";
  let existing;
  try {
    existing = await docker(["inspect", "--format", "{{.Image}}", config.container]);
  } catch {}
  if (existing) assert.equal(existing, image);
  else await docker(startArgs());
  const observed = JSON.parse(await docker(["inspect", config.container]))[0];
  assert.equal(observed.Image, image);
  assert.equal(observed.NetworkSettings.Ports["8787/tcp"][0].HostIp, lan);
  assert.equal(observed.HostConfig.RestartPolicy.Name, "unless-stopped");
  config.status = "prepared";
  await save();
  console.log(
    JSON.stringify({
      phase: "prepared",
      isolated: true,
      lanOnlyPublish: true,
      tls: true,
      sourceBoundImage: true,
    }),
  );
}
async function negativeCases() {
  phase = "readiness-storage";
  const permissions = (mode) =>
    docker([
      "exec",
      "--user",
      "0:0",
      config.container,
      "node",
      "--input-type=module",
      "-e",
      `import{chmodSync}from'node:fs';chmodSync('/var/lib/fleet-runner/output',${mode});`,
    ]);
  try {
    await permissions(0);
    await assert.rejects(
      () => client().report(),
      (e) => e.status === 500,
    );
  } finally {
    await permissions(0o700);
  }
  await ready();
  config.storageReadiness = { unwritableRejected: true, recovered: true };
  await save();
  const setup = `import{DatabaseSync}from'node:sqlite';const db=new DatabaseSync('/bad/fleet.sqlite');db.exec('PRAGMA user_version=99');db.close();`;
  await docker([
    "run",
    "--rm",
    "--user",
    "1000:1000",
    "--mount",
    `type=bind,src=${config.nasRoot}/bad-state,dst=/bad`,
    "--entrypoint",
    "node",
    config.image,
    "--input-type=module",
    "-e",
    setup,
  ]);
  const cases = [
    {
      name: "future-schema",
      code: "schema-incompatible",
      args: [
        "--env",
        "FLEET_DB=/bad/fleet.sqlite",
        "--mount",
        `type=bind,src=${config.nasRoot}/bad-state,dst=/bad`,
      ],
    },
    {
      name: "readonly-output",
      code: "EROFS",
      args: [
        "--env",
        "FLEET_OUT_DIR=/bad-output",
        "--mount",
        `type=bind,src=${config.nasRoot}/bad-output,dst=/bad-output,readonly`,
      ],
    },
    {
      name: "missing-owner-verifier",
      code: "ENOENT",
      args: [
        "--env",
        "FLEET_PUBLIC_KEYS_DIR=/empty",
        "--mount",
        `type=bind,src=${config.nasRoot}/empty-registry,dst=/empty,readonly`,
      ],
    },
  ];
  config.negativeCases = [];
  for (const c of cases) {
    phase = c.name;
    await assert.rejects(
      () => docker(["run", "--rm", ...mounts(), ...c.args, config.image, "serve"]),
      (error) => {
        const lines = error.stderr.split("\n").filter((x) => x.startsWith("{"));
        assert.ok(lines.some((line) => JSON.parse(line).code === c.code));
        assert.equal(error.code, 1);
        return true;
      },
    );
    config.negativeCases.push({ name: c.name, rejected: true, code: c.code });
    await save();
  }
}
async function run() {
  assert.equal(config.status, "prepared");
  const revision = (await execFile("git", ["rev-parse", "HEAD"], { cwd: source })).stdout.trim();
  const qualifierFile = fileURLToPath(import.meta.url);
  config.qualifierSource = {
    commit: revision,
    sha256: createHash("sha256")
      .update(await readFile(qualifierFile))
      .digest("hex"),
  };
  await save();
  phase = "tls-readiness";
  await ready();
  assert.equal((await fetch(config.endpoint + "/report")).status, 401);
  const env = { ...process.env };
  delete env.NODE_EXTRA_CA_CERTS;
  const untrusted = await execFile(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `try { await fetch(process.env.FLEET_TEST_ENDPOINT+'/report'); process.exit(1); } catch { process.exit(0); }`,
    ],
    { env: { ...env, FLEET_TEST_ENDPOINT: config.endpoint } },
  );
  assert.equal(untrusted.stdout, "");
  config.tls = { trustedUnauthenticatedStatus: 401, untrustedCertificateRejected: true };
  await save();
  const owner = client(),
    worker = fleetClient(config.endpoint, "qualification-worker", join(root, "worker"));
  const bytes = Buffer.from("fleet NAS qualification v1\n");
  const input = createHash("sha256").update(bytes).digest("hex");
  for (let i = config.crashes.length; i < 10; i++) {
    phase = "crash-" + (i + 1);
    const { key, created } = await owner.enqueue({
      kind: "proof-fixture",
      inputs: [input],
      params: { trial: i },
      payload: null,
      requires: ["nas-qualification"],
      maxAttempts: 1,
    });
    if (created) {
      assert.equal(
        await workOnce(worker, {
          caps: ["nas-qualification"],
          outDir: join(root, "attempts"),
          handlers: { "proof-fixture": async (job, ctx) => writeOutput(ctx.outDir, job, bytes) },
        }),
        "completed",
      );
      config.jobs.push(key);
      await save();
    } else {
      // Reconcile only the already-recorded fixture; never admit replacement work after ambiguity.
      assert.equal(config.jobs[i], key);
    }
    await verify(i + 1);
    // Reset Docker's crash backoff so every independent trial has the same initial conditions.
    await delay(10_000);
    const authorization = signer("owner", join(root, "owner"))("GET", "/report", Buffer.alloc(0));
    assert.equal(
      (await fetch(config.endpoint + "/report", { headers: { authorization } })).status,
      200,
    );
    const started = Date.now();
    const restartsBefore = Number(
      await docker(["inspect", "--format", "{{.RestartCount}}", config.container]),
    );
    const crashCode = `import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs';
      const children=readFileSync('/proc/1/task/1/children','utf8').trim().split(/\\s+/).filter(Boolean);
      const pid=children.find(pid=>readFileSync('/proc/'+pid+'/cmdline','utf8').includes('/app/dist/cli.js'));
      assert.ok(pid); process.kill(Number(pid),'SIGKILL');`;
    try {
      await docker(["exec", config.container, "node", "--input-type=module", "-e", crashCode]);
    } catch (error) {
      assert.ok([137, 143].includes(error.code));
    }
    await ready();
    const restartsAfter = Number(
      await docker(["inspect", "--format", "{{.RestartCount}}", config.container]),
    );
    assert.ok(restartsAfter > restartsBefore);
    const elapsedMs = Date.now() - started;
    assert.ok(elapsedMs < 60_000);
    assert.equal(
      (await fetch(config.endpoint + "/report", { headers: { authorization } })).status,
      401,
    );
    const verified = await verify(i + 1);
    config.crashes.push({
      trial: i + 1,
      elapsedMs,
      restartCountIncreased: true,
      acceptedDataPreserved: true,
      replayRejectedWithinSignatureWindow: true,
      ...verified,
    });
    await save();
    console.log(
      JSON.stringify({
        phase: "process-crash",
        trial: i + 1,
        elapsedMs,
        completed: i + 1,
        sha256Matches: true,
      }),
    );
  }
  phase = "graceful-stop";
  await docker(["stop", "--time", "30", config.container]);
  assert.equal(await docker(["inspect", "--format", "{{.State.ExitCode}}", config.container]), "0");
  await delay(1_000);
  assert.equal(
    await docker(["inspect", "--format", "{{.State.Running}}", config.container]),
    "false",
  );
  await docker(["start", config.container]);
  await ready();
  await verify(10);
  config.gracefulStop = { exitCode: 0, manualStopStayedStopped: true };
  await save();
  phase = "replacement";
  await docker(["stop", "--time", "30", config.container]);
  await docker(["rm", config.container]);
  await docker(startArgs());
  await ready();
  await verify(10);
  config.replacement = { acceptedDataPreserved: true };
  await save();
  await negativeCases();
  phase = "final";
  config.final = await verify(10);
  config.tcpHealth = await docker([
    "inspect",
    "--format",
    "{{.State.Health.Status}}",
    config.container,
  ]);
  config.status = "process-qualified-reboots-pending";
  await save();
  console.log(
    JSON.stringify({
      phase: "process-qualified",
      crashes: config.crashes.length,
      completed: 10,
      sha256Matches: true,
      negativeCases: config.negativeCases.length,
      applianceReboots: config.reboots.length,
    }),
  );
}
async function main() {
  if (mode === "prepare" || mode === "resume-prepare") {
    await prepare();
    return;
  }
  await load();
  if (await trustedRestart()) return;
  if (mode === "run") {
    await run();
    return;
  }
  if (mode === "arm-reboot") {
    assert.equal(config.status, "process-qualified-reboots-pending");
    assert.ok(config.reboots.length < 3);
    await verify(10);
    config.pendingReboot = {
      bootId: await remote("cat /proc/sys/kernel/random/boot_id"),
      armedAt: Date.now(),
    };
    await save();
    console.log(
      JSON.stringify({
        phase: "reboot-armed",
        trial: config.reboots.length + 1,
        ownerActionRequired: true,
      }),
    );
    return;
  }
  if (mode === "after-reboot") {
    assert.ok(config.pendingReboot);
    const { bootId, armedAt } = config.pendingReboot;
    const { startedAt, deadline, ownerWaitMs } = rebootRecoveryWindow(armedAt, Date.now());
    let changed = false;
    while (Date.now() < deadline) {
      try {
        changed = (await remote("cat /proc/sys/kernel/random/boot_id")) !== bootId;
        if (changed) break;
      } catch {}
      await delay(2_000);
    }
    assert.equal(changed, true, "actual appliance boot must change");
    await ready(Math.max(1, deadline - Date.now()));
    const verified = await verify(10);
    assert.ok(Date.now() < deadline);
    config.reboots.push({
      trial: config.reboots.length + 1,
      elapsedMs: Date.now() - startedAt,
      ownerWaitMs,
      timingOrigin: "reboot-command-returned",
      bootChanged: true,
      dockerAccessAfterReboot: true,
      qualifierSource: {
        commit: (await execFile("git", ["rev-parse", "HEAD"], { cwd: source })).stdout.trim(),
        sha256: createHash("sha256")
          .update(await readFile(fileURLToPath(import.meta.url)))
          .digest("hex"),
      },
      ...verified,
    });
    delete config.pendingReboot;
    if (config.reboots.length === 3) config.status = "g3-qualified";
    await save();
    console.log(
      JSON.stringify({
        phase: "reboot-verified",
        trials: config.reboots.length,
        sha256Matches: true,
      }),
    );
    return;
  }
  console.log(
    JSON.stringify({
      status: config.status,
      crashTrials: config.crashes.length,
      rebootTrials: config.reboots.length,
      ...(await verify(config.jobs.length)),
    }),
  );
}
main().catch((error) => {
  console.error(JSON.stringify(qualificationDiagnostic(error, phase, errorCode(error))));
  process.exitCode = 1;
});
