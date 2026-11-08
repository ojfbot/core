#!/usr/bin/env node
import { fleetClient } from "./client.js";
import { consoleServer } from "./console.js";
import { statusView, currentSnapshot } from "./status.js";
import type { StatusView } from "./status.js";
import { isIPv4 } from "node:net";
import { networkInterfaces } from "node:os";
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
import { JobStore } from "./jobs.js";
import { fleetServer } from "./server.js";

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
  if (command === "--help" || command === "help") {
    console.log(
      "fleet-runner keygen FILE | serve LAN_IP PORT DB OUTPUT REGISTRY | status|workers|events|logs|doctor [--json] | console [--port PORT] | control WORKER pause|drain|resume",
    );
    return;
  }
  if (command === "keygen" && values.length === 1) {
    generateToken(values[0]!);
    return;
  }
  if (
    ["status", "workers", "events", "logs", "doctor", "console", "control"].includes(command ?? "")
  ) {
    const endpoint = process.env.FLEET_ENDPOINT,
      token = process.env.FLEET_TOKEN_FILE;
    if (!endpoint || !token) throw Error("missing-configuration");
    const client = fleetClient(endpoint, process.env.FLEET_ID ?? "observer", token);
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
