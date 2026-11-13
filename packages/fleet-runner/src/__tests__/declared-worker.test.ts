import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import {
  accessSync,
  constants,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { build } from "esbuild";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { generateToken } from "../auth.js";
import { commandHandler } from "../declared-worker.js";
import { JobStore, type Claim } from "../jobs.js";
import { fleetServer } from "../server.js";
import { parseWorkerSettings } from "../worker-settings.js";

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let releaseDir: string;
let installed: string;
let bundle: string;
let installerEnv: NodeJS.ProcessEnv;
let tlsKey: string;
let tlsCert: string;
let dir: string;
let store: JobStore;
let server: Server;
let endpoint: string;
let running: ReturnType<typeof spawn> | undefined;

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const waitFor = async (ready: () => boolean) => {
  const end = Date.now() + 5_000;
  while (!ready()) {
    if (Date.now() >= end) throw Error("condition did not become true");
    await delay(10);
  }
};

beforeAll(async () => {
  releaseDir = mkdtempSync(join(tmpdir(), "fleet-release-"));
  installed = join(releaseDir, "installed with spaces");
  tlsKey = join(releaseDir, "tls-key.pem");
  tlsCert = join(releaseDir, "tls-cert.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      tlsKey,
      "-out",
      tlsCert,
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
    ],
    { stdio: "ignore" },
  );
  bundle = join(releaseDir, "fleet-runner.mjs");
  const built = await build({
    entryPoints: [join(pkg, "src/cli.ts")],
    outfile: bundle,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    metafile: true,
    define: {
      __FLEET_RELEASE__: JSON.stringify({
        name: "fleet-runner",
        version: "0.1.0",
        commit: "a".repeat(40),
        node_floor: "24.22.2",
        bundled: true,
      }),
    },
  });
  expect(
    Object.keys(built.metafile.inputs).every(
      (path) => path.startsWith("<define:") || path.includes("fleet-runner/src/"),
    ),
  ).toBe(true);
  mkdirSync(join(installed, "device"), { recursive: true });
  writeFileSync(join(installed, "device/key"), "identity-stays-here");
  writeFileSync(join(installed, "fleet-runner.json"), "settings-stay-here");
  installerEnv = {
    ...process.env,
    ...(process.platform === "darwin" ? {} : { FLEET_RUNNER_INSTALL_CODESIGN: "/bin/true" }),
  };
  execFileSync(
    "/bin/sh",
    [
      join(pkg, "scripts/install-worker.sh"),
      "--root",
      installed,
      "--node",
      process.execPath,
      "--bundle",
      bundle,
    ],
    { env: installerEnv },
  );
}, 30_000);

afterAll(() => rmSync(releaseDir, { recursive: true, force: true }));
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "declared-worker-"));
  for (const id of ["owner", "worker"]) generateToken(join(dir, id));
  store = new JobStore(join(dir, "jobs.sqlite"));
  server = fleetServer(store, {
    registry: dir,
    outDir: join(dir, "accepted"),
    workers: ["worker"],
  });
  await new Promise<void>((ok, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", ok);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw Error("no listener");
  endpoint = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  if (running && running.exitCode === null && running.signalCode === null) {
    running.kill("SIGTERM");
    await once(running, "close");
  }
  running = undefined;
  await new Promise<void>((ok) => server.close(() => ok()));
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

function settings() {
  const current = join(installed, "worker/current");
  return {
    schemaVersion: 1,
    endpoint,
    worker: "worker",
    tokenFile: join(dir, "worker"),
    outDir: join(dir, "attempts"),
    statusFile: join(dir, "status.json"),
    pollMs: 10,
    kinds: {
      "proof-fixture": {
        capabilities: ["fixture"],
        command: [join(current, "node"), join(current, "fleet-runner.mjs"), "proof-fixture"],
      },
    },
  };
}

it("installs one self-contained signed-runtime release and refuses to replace it", () => {
  const current = join(installed, "worker/current");
  expect(readlinkSync(current)).toBe("0.1.0");
  const manifest = JSON.parse(readFileSync(join(current, "manifest.json"), "utf8"));
  expect(manifest).toMatchObject({
    name: "fleet-runner",
    version: "0.1.0",
    commit: "a".repeat(40),
    node_version: `v${process.versions.node}`,
  });
  expect(manifest.files["fleet-runner.mjs"].sha256).toBe(
    hash(readFileSync(join(current, "fleet-runner.mjs"))),
  );
  expect(manifest.files.node.sha256).toBe(hash(readFileSync(process.execPath)));
  expect(readFileSync(join(installed, "device/key"), "utf8")).toBe("identity-stays-here");
  expect(readFileSync(join(installed, "fleet-runner.json"), "utf8")).toBe("settings-stay-here");
  expect(() =>
    execFileSync(
      "/bin/sh",
      [
        join(pkg, "scripts/install-worker.sh"),
        "--root",
        installed,
        "--node",
        process.execPath,
        "--bundle",
        bundle,
      ],
      { env: installerEnv, stdio: "pipe" },
    ),
  ).toThrow();
  expect(readlinkSync(current)).toBe("0.1.0");
});

it("runs the installed bundle with its own Node and configured CA, claims only configured kind/capability pairs, and preserves a completed retry", async () => {
  await new Promise<void>((ok) => server.close(() => ok()));
  server = fleetServer(store, {
    registry: dir,
    outDir: join(dir, "accepted"),
    workers: ["worker"],
    tls: { key: readFileSync(tlsKey), cert: readFileSync(tlsCert), minVersion: "TLSv1.2" },
  });
  await new Promise<void>((ok, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", ok);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw Error("no TLS listener");
  endpoint = `https://127.0.0.1:${address.port}`;
  const cfg = { ...settings(), caFile: tlsCert };
  const extra = { capabilities: ["other-capability"], command: cfg.kinds["proof-fixture"].command };
  const configured = { ...cfg, kinds: { ...cfg.kinds, "reserved-kind": extra } };
  const configFile = join(dir, "worker.json");
  writeFileSync(configFile, JSON.stringify(configured));
  const unknown = store.enqueue({
    kind: "not-listed",
    inputs: [],
    params: {},
    payload: null,
    priority: 100,
  });
  const wrongCaps = store.enqueue({
    kind: "proof-fixture",
    inputs: [],
    params: { test: "wrong-cap" },
    payload: null,
    requires: ["other-capability"],
    priority: 99,
  });
  const spec = {
    kind: "proof-fixture",
    inputs: [],
    params: { test: "accepted" },
    payload: null,
    requires: ["fixture"],
    maxAttempts: 1,
  };
  const accepted = store.enqueue(spec);
  const current = join(installed, "worker/current");
  running = spawn(
    join(current, "node"),
    [join(current, "fleet-runner.mjs"), "worker", "--settings", configFile],
    { env: { PATH: "/no-global-runtime" }, stdio: "ignore" },
  );
  await waitFor(() => store.get(accepted.key)?.status === "done");
  const row = store.get(accepted.key);
  expect(row).toMatchObject({
    status: "done",
    worker: "worker",
    attempts: 1,
    fence: 1,
    output: "4a531719e249b4b40dd32824870633b7ac4a0c13a172c02af1f0393fae888fed",
  });
  if (!row?.outputFile) throw Error("missing accepted file");
  expect(readFileSync(join(dir, "accepted", row.outputFile), "utf8")).toBe(
    "fleet NAS qualification v1\n",
  );
  const events = store.events(0);
  expect(events.filter((e) => e.key === accepted.key).map((e) => e.type)).toEqual([
    "enqueued",
    "claimed",
    "completed",
  ]);
  expect(store.enqueue(spec)).toEqual({ key: accepted.key, created: false });
  await delay(30);
  expect(store.get(unknown.key)?.status).toBe("ready");
  expect(store.get(wrongCaps.key)?.status).toBe("ready");
  expect(store.get(accepted.key)).toEqual(row);
  expect(store.events(0)).toEqual(events);
  const closed = once(running, "close");
  running.kill("SIGTERM");
  await closed;
  expect(running.exitCode).toBe(0);
  const status = JSON.parse(readFileSync(cfg.statusFile, "utf8"));
  expect(status).toMatchObject({
    worker: "worker",
    state: "stopped",
    kinds: ["proof-fixture", "reserved-kind"],
  });
  expect(JSON.stringify(status)).not.toContain(cfg.tokenFile);
}, 15_000);

it("refuses unlisted agent and shell launchers in local settings", () => {
  expect(() => parseWorkerSettings({ ...settings(), statusFile: settings().tokenFile })).toThrow(
    "invalid-worker-settings",
  );
  for (const executable of ["/opt/bin/claude", "/opt/bin/codex", "/bin/sh", "/usr/bin/env"]) {
    expect(() =>
      parseWorkerSettings({
        ...settings(),
        kinds: { "proof-fixture": { capabilities: [], command: [executable] } },
      }),
    ).toThrow("agent-or-shell-command-refused");
  }
});

it("rejects a command result outside the fenced output path", async () => {
  const command = join(dir, "bad-output.mjs");
  writeFileSync(
    command,
    "process.stdout.write(JSON.stringify({file:'../outside',sha256:'a'.repeat(64)}));",
  );
  const job: Claim = {
    key: "a".repeat(64),
    fence: 1,
    kind: "proof-fixture",
    inputs: [],
    params: {},
    code: null,
    payload: null,
    leaseExpires: Date.now() + 300000,
  };
  await expect(
    commandHandler({ capabilities: [], command: [process.execPath, command], timeoutMs: 1000 })(
      job,
      { signal: new AbortController().signal, outDir: dir },
    ),
  ).rejects.toMatchObject({ code: "invalid-command-output" });
});

it("cancels the installed command rather than leaving it running", async () => {
  const command = join(dir, "waiting.mjs"),
    pidFile = join(dir, "child.pid");
  writeFileSync(
    command,
    "import {writeFileSync} from 'node:fs';writeFileSync(process.argv[2],String(process.pid));setInterval(()=>{},1000);",
  );
  const job: Claim = {
    key: "b".repeat(64),
    fence: 1,
    kind: "proof-fixture",
    inputs: [],
    params: {},
    code: null,
    payload: null,
    leaseExpires: Date.now() + 300000,
  };
  const stop = new AbortController();
  const result = commandHandler({
    capabilities: [],
    command: [process.execPath, command, pidFile],
    timeoutMs: 5000,
  })(job, { signal: stop.signal, outDir: dir });
  const rejected = expect(result).rejects.toMatchObject({ code: "interrupted" });
  await waitFor(() => existsSync(pidFile));
  const pid = Number(readFileSync(pidFile, "utf8"));
  stop.abort();
  await rejected;
  expect(() => process.kill(pid, 0)).toThrow();
});

it("checks the Node signature before executing a supplied shell", () => {
  const fake = join(dir, "fake-node"),
    marker = join(dir, "executed");
  writeFileSync(fake, `#!/bin/sh\ntouch '${marker}'\n`, { mode: 0o700 });
  accessSync(fake, constants.X_OK);
  expect(() =>
    execFileSync(
      "/bin/sh",
      [
        join(pkg, "scripts/install-worker.sh"),
        "--root",
        join(dir, "install"),
        "--node",
        fake,
        "--bundle",
        bundle,
      ],
      { env: { ...process.env, FLEET_RUNNER_INSTALL_CODESIGN: "/bin/false" }, stdio: "pipe" },
    ),
  ).toThrow();
  expect(existsSync(marker)).toBe(false);
  expect(existsSync(join(dir, "install"))).toBe(false);
});
