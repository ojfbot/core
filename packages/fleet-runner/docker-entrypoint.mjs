import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

function isPrivateIPv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function eth0IPv4() {
  const addresses = networkInterfaces().eth0 ?? [];
  const match = addresses.find((iface) => iface.family === "IPv4" && !iface.internal && isPrivateIPv4(iface.address));
  if (!match) throw new Error("no private IPv4 address found on eth0");
  return match.address;
}

const [command, ...args] = process.argv.slice(2);
let cliArgs;
if (command === "serve" && args.length === 0) {
  cliArgs = [
    "serve",
    eth0IPv4(),
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
child.once("error", (error) => {
  console.error("fleet-runner failed to start", error.message);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
