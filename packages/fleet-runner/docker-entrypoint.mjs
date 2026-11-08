import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { createConnection } from "node:net";

function isPrivateIPv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function containerIPv4() {
  const addresses = Object.values(networkInterfaces()).flatMap((entries) => entries ?? []);
  const match = addresses.find((iface) => iface.family === "IPv4" && !iface.internal && isPrivateIPv4(iface.address));
  if (!match) throw new Error("no private IPv4 interface available");
  return match.address;
}

const [command, ...args] = process.argv.slice(2);
if (command === "healthcheck") {
  // Credential-free TCP liveness only. Signed /report is the separate readiness check.
  const socket = createConnection({ host: process.env.FLEET_BIND_IP ?? containerIPv4(), port: Number(process.env.FLEET_PORT ?? 8787) });
  socket.setTimeout(2_000, () => process.exit(1));
  socket.once("error", () => process.exit(1));
  socket.once("connect", () => { socket.end(); process.exit(0); });
} else {

let cliArgs;
if (command === "serve" && args.length === 0) {
  cliArgs = [
    "serve",
    process.env.FLEET_BIND_IP ?? containerIPv4(),
    process.env.FLEET_PORT ?? "8787",
    process.env.FLEET_DB ?? "/var/lib/fleet-runner/state/fleet.sqlite",
    process.env.FLEET_OUT_DIR ?? "/var/lib/fleet-runner/output",
    process.env.FLEET_PUBLIC_KEYS_DIR ?? "/run/fleet-runner/public-keys",
  ];
} else if (command === "keygen" && args.length === 1) {
  cliArgs = [command, ...args];
} else {
  console.error("usage: container serve | container keygen TOKEN_FILE");
  process.exit(2);
}

const child = spawn(process.execPath, ["/app/dist/cli.js", ...cliArgs], { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}
child.once("error", () => {
  console.error("fleet-runner failed to start: spawn-error");
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

}
