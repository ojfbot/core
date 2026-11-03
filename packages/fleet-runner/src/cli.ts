#!/usr/bin/env node
import { isIPv4 } from "node:net";
import { networkInterfaces } from "node:os";
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
  if (command === "keygen" && values.length === 1) {
    generateToken(values[0]!);
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
  const store = new JobStore(db);
  const server = fleetServer(store, { registry, outDir });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, resolve);
    });
  } catch (error) {
    store.close();
    throw error;
  }
  console.log("fleet-runner listening");
  const stop = () => server.close(() => store.close());
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

main(process.argv.slice(2)).catch(() => {
  console.error("fleet-runner command failed");
  process.exitCode = 1;
});
