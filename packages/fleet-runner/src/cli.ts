#!/usr/bin/env node
import { launchLedgerProof } from "./ledger-proof-launcher.js";
import { parseProofRelay, postProofRelay, readProofRelay } from "./ledger-proof-relay.js";
import {
  cancelProofWake,
  parsePowerPlan,
  parseWakeRequest,
  prepareProofWake,
  proofHostProbe,
  runProofSleep,
} from "./ledger-proof-power.js";
import {
  exact,
  readPrivateJson,
  object,
  parseLedgerProof,
  readProofSnapshot,
  proofHash,
  privatePath,
} from "./ledger-proof.js";
import { ProofJournal } from "./ledger-proof-state.js";
import {
  loadProofRuntime,
  requestPracticeStop,
  runProofSupervisor,
  runProofWatchdog,
  runProofWorker,
} from "./ledger-proof-runtime.js";
import { fleetClient } from "./client.js";
import { consoleServer } from "./console.js";
import { statusView, currentSnapshot } from "./status.js";
import type { StatusView } from "./status.js";
import { isIPv4 } from "node:net";
import { networkInterfaces } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import {
  constants,
  accessSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { errorCode } from "./diagnostics.js";
import { generateToken } from "./auth.js";
import { canonicalJson, JobStore } from "./jobs.js";
import { fleetServer } from "./server.js";
import { createRecoveryBundle, restoreRecoveryBundle, verifyRecoveryBundle } from "./recovery.js";
import { loadWorkerSettings } from "./worker-settings.js";
import { runDeclaredWorker } from "./declared-worker.js";
import { proofCommand, workerPlist } from "./proof-command.js";
import { releaseInfo } from "./version.js";
import { spawn } from "node:child_process";

function isLocalLan(address: string): boolean {
  if (!isIPv4(address)) return false;
  const [a, b = 0] = address.split(".").map(Number);
  const privateIp = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  return (
    privateIp &&
    Object.values(networkInterfaces()).some((entries) =>
      entries?.some((iface) => !iface.internal && iface.address === address),
    )
  );
}

async function main(args: string[]): Promise<void> {
  const [command, ...values] = args;
  if (command === "practice") {
    const helper = [
      new URL("./practice.mjs", import.meta.url),
      new URL("../scripts/ledger-proof-local-practice.mjs", import.meta.url),
    ]
      .map((url) => fileURLToPath(url))
      .find(existsSync);
    if (!helper) throw Error("practice-helper-missing: install the complete FleetRunner release");
    const result = spawnSync(process.execPath, [helper, ...values], { stdio: "inherit" });
    process.exitCode = result.status ?? 1;
    return;
  }
  if (
    (command === "ledger-proof-relay" || command === "ledger-proof-power") &&
    values.length === 5 &&
    values[1] === "--settings" &&
    values[3] === "--sha256"
  ) {
    process.umask(0o077);
    const raw = readPrivateJson(values[2]!);
    if (proofHash(canonicalJson(raw)) !== values[4])
      throw Error("proof-helper-settings-digest-mismatch");
    const action = values[0];
    if (command === "ledger-proof-power" && (action === "authorize" || action === "revoke")) {
      const wake = parseWakeRequest(exact(raw, ["wake"]).wake);
      const result = await (action === "authorize"
        ? prepareProofWake(wake)
        : cancelProofWake(wake));
      console.log(JSON.stringify(result));
      return;
    }
    const config = object(raw),
      proof = parseLedgerProof(config.proof);
    let result: unknown;
    if (command === "ledger-proof-relay") {
      const relay = parseProofRelay(config.relay, proof);
      if (action === "post")
        result = await postProofRelay(relay, JSON.parse(readFileSync(0, "utf8")));
      else if (action === "ready" || action === "fault")
        result = await readProofRelay(relay, action);
      else if (action === "evidence") {
        const input = object(JSON.parse(readFileSync(0, "utf8")));
        if (input.proofId !== proof.proofId || (input.phase !== "ready" && input.phase !== "fault"))
          throw Error("proof-relay-input-mismatch");
        result = await readProofRelay(relay, input.phase);
      } else throw Error("invalid-proof-relay-action");
    } else {
      const plan = parsePowerPlan(config.power, proof);
      if (action === "prepare") result = await prepareProofWake(plan);
      else if (action === "cancel") result = await cancelProofWake(plan);
      else if (action === "probe-primary" || action === "probe-fallback")
        result = await proofHostProbe(plan, action === "probe-primary");
      else if (action === "sleep")
        result = await runProofSleep(plan, JSON.parse(readFileSync(0, "utf8")));
      else throw Error("invalid-proof-power-action");
    }
    console.log(JSON.stringify(result));
    return;
  }
  if (command === "ledger-proof-snapshot" && values.length === 2) {
    process.stdout.write(`${JSON.stringify(readProofSnapshot(values[0]!, values[1]!))}\n`);
    return;
  }
  if (
    command === "ledger-proof" &&
    (values[0] === "stop-practice"
      ? values.length === 7 && values[5] === "--stop"
      : values.length === 5) &&
    values[1] === "--settings" &&
    values[3] === "--sha256"
  ) {
    process.umask(0o077);
    const [action] = values;
    const config = loadProofRuntime(values[2]!, values[4]!);
    const binding = { ...config, role: config.role === "watchdog" ? "supervisor" : config.role };
    const journal = new ProofJournal(
      config.stateFile,
      binding,
      action === "init",
      action === "status",
    );
    const stopped = new AbortController();
    const cancel = () => stopped.abort();
    process.on("SIGTERM", cancel);
    process.on("SIGINT", cancel);
    try {
      if (action === "init") {
        console.log(
          JSON.stringify({ initialized: true, bindingSha256: proofHash(canonicalJson(binding)) }),
        );
      } else if (action === "status") {
        console.log(
          JSON.stringify({
            proofId: config.proof.proofId,
            role: config.role,
            progress: journal.progress(),
            terminal: journal.get("terminal") ?? null,
            readinessHold: journal.get("readiness-held") ?? null,
            lastSnapshot: journal.get("snapshot-time") ?? null,
            jobAdmitted: !!journal.result("admit-job"),
            verifiedOutput: journal.result("accepted") ?? null,
            cleanupVerified: !!journal.get("cleanup-complete"),
            reportDelivered: !!journal.result("terminal-report"),
            ...(config.proof.practice
              ? {
                  practiceLauncher: journal.get("practice-launcher") ?? null,
                  practiceFirstFailure: journal.get("practice-first-failure") ?? null,
                }
              : {}),
          }),
        );
      } else if (action === "stop-practice") {
        const stop = requestPracticeStop(
          config,
          journal,
          values[4]!,
          readPrivateJson(privatePath(values[6]), 4096),
        );
        console.log(JSON.stringify({ recorded: true, stop }));
      } else if (action === "launch") {
        await launchLedgerProof(config, journal, values[2]!, values[4]!, stopped.signal);
      } else if (action === "run") {
        if (config.settings.caFile && process.env.NODE_EXTRA_CA_CERTS !== config.settings.caFile)
          throw Error("proof-ca-startup-required");
        if (config.role === "supervisor") await runProofSupervisor(config, journal, stopped.signal);
        else if (config.role === "watchdog")
          await runProofWatchdog(config, journal, stopped.signal);
        else await runProofWorker(config, journal, stopped.signal, values[4]!);
      } else throw Error("invalid-proof-action");
    } finally {
      journal.close();
      process.off("SIGTERM", cancel);
      process.off("SIGINT", cancel);
    }
    return;
  }
  if (command === "version" && values.length === 0) {
    console.log(JSON.stringify(releaseInfo, null, 2));
    return;
  }
  if (command === "worker" && values.length === 2 && values[0] === "--settings") {
    process.umask(0o077);
    const settings = loadWorkerSettings(values[1]!);
    if (settings.caFile && process.env.NODE_EXTRA_CA_CERTS !== settings.caFile) {
      // Node reads extra CA trust at process startup. Relaunch only this installed binary/bundle.
      const child = spawn(process.execPath, process.argv.slice(1), {
        env: { ...process.env, NODE_EXTRA_CA_CERTS: settings.caFile },
        stdio: "inherit",
      });
      const term = () => child.kill("SIGTERM");
      const interrupt = () => child.kill("SIGINT");
      process.on("SIGTERM", term);
      process.on("SIGINT", interrupt);
      try {
        await new Promise<void>((ok, fail) => {
          child.once("error", fail);
          child.once("close", (code) => {
            process.exitCode = code ?? 1;
            ok();
          });
        });
      } finally {
        process.off("SIGTERM", term);
        process.off("SIGINT", interrupt);
      }
      return;
    }
    const stop = new AbortController();
    const cancel = () => stop.abort();
    process.on("SIGINT", cancel);
    process.on("SIGTERM", cancel);
    try {
      await runDeclaredWorker(settings, stop.signal);
    } finally {
      process.off("SIGINT", cancel);
      process.off("SIGTERM", cancel);
    }
    return;
  }
  if (command === "proof-fixture" && values.length === 0) {
    process.umask(0o077);
    console.log(JSON.stringify(proofCommand(JSON.parse(readFileSync(0, "utf8")))));
    return;
  }
  if (command === "worker-plist" && values.length === 2) {
    process.stdout.write(workerPlist(values[0]!, values[1]!));
    return;
  }
  if (command === "--help" || command === "help") {
    console.log(
      "fleet-runner worker --settings FILE | worker-plist ROOT EXISTING_LABEL | proof-fixture | version | keygen FILE | serve LAN_IP PORT DB OUTPUT REGISTRY | backup DB OUTPUT_DIR INPUT_DIR|- NEW_DEST | verify-backup BUNDLE | restore BUNDLE NEW_STATE_DIR | status|workers|events|logs|doctor [--json] | console [--port PORT] | control WORKER pause|drain|resume",
    );
    return;
  }
  if (command === "keygen" && values.length === 1) {
    generateToken(values[0]!);
    return;
  }
  if (command === "backup" && values.length === 4) {
    const manifest = createRecoveryBundle(
      values[0]!,
      values[1]!,
      values[2] === "-" ? undefined : values[2]!,
      values[3]!,
    );
    console.log(
      JSON.stringify({
        verified: true,
        capturedAt: manifest.capturedAt,
        recoveryPoint: manifest.recoveryPoint,
        manifest: join(values[3]!, "recovery-manifest.json"),
      }),
    );
    return;
  }
  if (command === "verify-backup" && values.length === 1) {
    const manifest = verifyRecoveryBundle(values[0]!);
    console.log(
      JSON.stringify({
        verified: true,
        capturedAt: manifest.capturedAt,
        recoveryPoint: manifest.recoveryPoint,
      }),
    );
    return;
  }
  if (command === "restore" && values.length === 2) {
    const restored = restoreRecoveryBundle(values[0]!, values[1]!);
    console.log(
      JSON.stringify({
        restored: true,
        paused: true,
        generation: restored.generation,
        recoveryPoint: restored.recoveryPoint,
        holdToken: restored.holdToken,
        setFLEET_GENERATION: restored.generation,
      }),
    );
    return;
  }
  if (
    [
      "status",
      "workers",
      "events",
      "logs",
      "doctor",
      "console",
      "control",
      "release-recovery",
    ].includes(command ?? "")
  ) {
    const endpoint = process.env.FLEET_ENDPOINT,
      token = process.env.FLEET_TOKEN_FILE;
    if (!endpoint || !token) throw Error("missing-configuration");
    const client = fleetClient(
      endpoint,
      process.env.FLEET_ID ?? "observer",
      token,
      process.env.FLEET_GENERATION,
    );
    if (command === "release-recovery") {
      if (values.length !== 1 || process.env.FLEET_ID !== "owner")
        throw Error("invalid-recovery-release");
      console.log(JSON.stringify(await client.releaseRecoveryHold(values[0]!)));
      return;
    }
    if (command === "console") {
      const port = values.length === 0 ? 0 : Number(values[1]);
      if (
        values.length &&
        (values.length !== 2 ||
          values[0] !== "--port" ||
          !/^[0-9]+$/.test(values[1] ?? "") ||
          !Number.isInteger(port) ||
          port < 1 ||
          port > 65535)
      )
        throw Error("invalid-arguments");
      const viewer = consoleServer(client);
      await new Promise<void>((resolve, reject) => {
        viewer.once("error", reject);
        viewer.listen(port, "127.0.0.1", resolve);
      });
      const address = viewer.address();
      if (!address || typeof address === "string") throw Error("viewer-unavailable");
      console.log(`Fleet Runner console: http://127.0.0.1:${address.port}`);
      process.once("SIGTERM", () => viewer.close());
      process.once("SIGINT", () => viewer.close());
      return;
    }
    if (command === "control") {
      const [worker, action] = values;
      if (!worker || !["pause", "drain", "resume"].includes(action ?? "") || values.length !== 2)
        throw Error("invalid-control");
      console.log(
        JSON.stringify(await client.control(worker, action as "pause" | "drain" | "resume")),
      );
      return;
    }
    if (command === "events" && values.includes("--after")) {
      const index = values.indexOf("--after");
      const after = Number(values[index + 1]);
      if (
        !Number.isSafeInteger(after) ||
        after < 0 ||
        values.filter((_, i) => i !== index && i !== index + 1).some((v) => v !== "--json")
      )
        throw Error("invalid-cursor");
      console.log(JSON.stringify(await client.statusEvents(after)));
      return;
    }
    if (values.some((v) => v !== "--json")) throw Error("invalid-arguments");
    const snapshot = await client.status();
    if (!currentSnapshot(snapshot)) throw Error("incompatible-status");
    console.log(JSON.stringify(statusView(snapshot, command as StatusView)));
    if (command === "doctor" && !(statusView(snapshot, "doctor") as { healthy: boolean }).healthy)
      process.exitCode = 1;
    return;
  }
  const [host, portValue, db, outDir, registry] = values;
  const port = Number(portValue);
  if (
    command !== "serve" ||
    values.length !== 5 ||
    !host ||
    !isLocalLan(host) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !db ||
    !outDir ||
    !registry
  ) {
    process.exitCode = 2;
    console.error(
      "usage: fleet-runner keygen TOKEN_FILE | fleet-runner serve LAN_IPV4 PORT DB OUT_DIR PUBLIC_KEYS_DIR",
    );
    return;
  }
  process.umask(0o077);
  accessSync(registry, constants.R_OK | constants.X_OK);
  if (!statSync(registry).isDirectory()) throw new Error("invalid registry");
  accessSync(join(registry, "owner.pub"), constants.R_OK);
  mkdirSync(outDir, { recursive: true });
  const probe = join(outDir, `.readiness-${randomUUID()}`);
  const fd = openSync(probe, "wx", 0o600);
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
    unlinkSync(probe);
  }
  const cert = process.env.FLEET_TLS_CERT;
  const key = process.env.FLEET_TLS_KEY;
  const inputDir = process.env.FLEET_INPUT_DIR;
  if (!!cert !== !!key) throw new Error("TLS requires both certificate and key");
  const store = new JobStore(db);
  const server = fleetServer(store, {
    registry,
    outDir,
    ...(inputDir ? { inputDir } : {}),
    observers: (process.env.FLEET_OBSERVERS ?? "observer").split(",").filter(Boolean),
    workers: (process.env.FLEET_WORKERS ?? "yuri,yojimbo").split(",").filter(Boolean),
    build: process.env.FLEET_BUILD_REF ?? "unknown",
    ...(cert && key
      ? {
          tls: { cert: readFileSync(cert), key: readFileSync(key), minVersion: "TLSv1.2" as const },
        }
      : {}),
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => {
        server.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    store.close();
    throw error;
  }
  console.log("fleet-runner listening");
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => server.closeAllConnections(), 20_000);
    deadline.unref();
    server.close(() => {
      clearTimeout(deadline);
      store.close();
    });
    server.closeIdleConnections();
  };
  server.on("error", (error) => {
    console.error(JSON.stringify({ phase: "runtime", code: errorCode(error) }));
    process.exitCode = 1;
    stop();
  });
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(JSON.stringify({ phase: "startup", code: errorCode(error) }));
  process.exitCode = 1;
});
