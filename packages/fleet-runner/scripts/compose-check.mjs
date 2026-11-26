// Check production's RESOLVED compose config against an exact allowlist (ojfbot/core#647, slice 4).
// fleet-promote.sh takes compose.production.yaml from the revision it promotes, so a revision could
// otherwise drop the hardening or add a mount, a device or a privilege and still start. This runs
// on the Mac, from the promoting checkout, on `docker compose config --format json` resolved on the
// server with production's own env file, BEFORE production is touched; the switch then requires the
// config it resolves to be byte-identical to the one checked here.
//
//   node compose-check.mjs <resolved.json> <project> <root> <lan address> <port> <uid:gid> <revision> \
//     <sha256 of production's FLEET_WORKERS> <sha256 of production's FLEET_OBSERVERS>
//
// Every key, at every level that matters, must be one the allowlist names, with exactly the value
// production needs: anything else (privileged, cap_add, devices, network_mode, extra networks,
// extra volumes or ports, a different user, a changed environment) is refused. Prints PASS or FAIL
// lines naming keys only, never a value (the environment holds production's identity lists). The
// identity lists must be production's current ones, compared by SHA-256, so a revision cannot move
// a worker to observer or add one. The file is started as it is (nothing re-read, no interpolation),
// so a "$" anywhere in it is refused too.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const [file, project, root, lan, port, uidgid, revision, workersSha, observersSha] = process.argv.slice(2);
const hex64 = /^[0-9a-f]{64}$/;
if (
  !revision ||
  !/^[0-9a-f]{40}$/.test(revision) ||
  !/^[1-9][0-9]*:[0-9]+$/.test(uidgid ?? "") ||
  !hex64.test(workersSha ?? "") ||
  !hex64.test(observersSha ?? "")
) {
  console.error(
    "usage: compose-check.mjs <resolved.json> <project> <root> <lan> <port> <uid:gid> <revision> <workers sha256> <observers sha256>",
  );
  process.exit(2);
}
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const problems = [];
const bad = (what) => problems.push(what);
let cfg;
let text = "";
try {
  text = readFileSync(file, "utf8");
  cfg = JSON.parse(text);
} catch {
  console.log("FAIL the resolved compose config is not JSON");
  process.exit(1);
}
if (text.includes("$")) bad("the config holds a $, which Compose would interpolate when it starts");
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
// Key order does not matter (Compose's own output order is not a contract); array order does.
const canon = (v) =>
  Array.isArray(v) ? v.map(canon) : isObject(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
// Exactly these keys: a missing required key or any other key is refused.
function keys(where, obj, required, optional = []) {
  if (!isObject(obj)) return bad(`${where} is not an object`), false;
  for (const k of required) if (!(k in obj)) bad(`${where} has no ${k}`);
  for (const k of Object.keys(obj)) if (!required.includes(k) && !optional.includes(k)) bad(`${where} has ${k}, which is not allowed`);
  return true;
}
const expect = (where, value, want) => same(value, want) || bad(`${where} is not the required value`);

if (keys("the config", cfg, ["name", "services"], ["networks"])) {
  expect("name", cfg.name, project);
  // Only Compose's own default network, with nothing configured on it.
  if (cfg.networks !== undefined && keys("networks", cfg.networks, [], ["default"]) && cfg.networks.default !== undefined) {
    if (keys("networks.default", cfg.networks.default, [], ["name", "ipam"])) {
      if (cfg.networks.default.name !== undefined) expect("networks.default.name", cfg.networks.default.name, `${project}_default`);
      if (cfg.networks.default.ipam !== undefined) expect("networks.default.ipam", cfg.networks.default.ipam, {});
    }
  }
  if (keys("services", cfg.services, ["fleet-runner"])) {
    const s = cfg.services["fleet-runner"];
    const where = "services.fleet-runner";
    const required = [
      "cap_drop", "environment", "image", "platform", "ports", "read_only", "restart",
      "security_opt", "stop_grace_period", "tmpfs", "user", "volumes",
    ];
    if (keys(where, s, required, ["command", "entrypoint", "networks"])) {
      if (s.command !== undefined) expect(`${where}.command`, s.command, null);
      if (s.entrypoint !== undefined) expect(`${where}.entrypoint`, s.entrypoint, null);
      if (s.networks !== undefined) expect(`${where}.networks`, s.networks, { default: null });
      expect(`${where}.cap_drop`, s.cap_drop, ["ALL"]);
      expect(`${where}.image`, s.image, `fleet-runner:${revision}`);
      expect(`${where}.platform`, s.platform, "linux/amd64");
      expect(`${where}.read_only`, s.read_only, true);
      expect(`${where}.restart`, s.restart, "unless-stopped");
      expect(`${where}.security_opt`, s.security_opt, ["no-new-privileges:true"]);
      expect(`${where}.stop_grace_period`, s.stop_grace_period, "30s");
      expect(`${where}.tmpfs`, s.tmpfs, ["/tmp:size=16m,mode=1777"]);
      expect(`${where}.user`, s.user, uidgid);
      expect(`${where}.ports`, s.ports, [
        { mode: "ingress", host_ip: lan, target: 8787, published: String(port), protocol: "tcp" },
      ]);
      const vol = (name, target, ro) => ({
        type: "bind",
        source: `${root}/${name}`,
        target,
        ...(ro ? { read_only: true } : {}),
        bind: {},
      });
      expect(`${where}.volumes`, s.volumes, [
        vol("state", "/var/lib/fleet-runner/state", false),
        vol("output", "/var/lib/fleet-runner/output", false),
        vol("inputs", "/var/lib/fleet-runner/inputs", false),
        vol("public-keys", "/run/fleet-runner/public-keys", true),
        vol("tls", "/run/fleet-runner/tls", true),
      ]);
      const env = s.environment;
      const envKeys = ["FLEET_BUILD_REF", "FLEET_INPUT_DIR", "FLEET_OBSERVERS", "FLEET_TLS_CERT", "FLEET_TLS_KEY", "FLEET_WORKERS"];
      if (keys(`${where}.environment`, env, envKeys)) {
        expect("FLEET_BUILD_REF", env.FLEET_BUILD_REF, revision);
        expect("FLEET_INPUT_DIR", env.FLEET_INPUT_DIR, "/var/lib/fleet-runner/inputs");
        expect("FLEET_TLS_CERT", env.FLEET_TLS_CERT, "/run/fleet-runner/tls/server.crt");
        expect("FLEET_TLS_KEY", env.FLEET_TLS_KEY, "/run/fleet-runner/tls/server.key");
        for (const k of ["FLEET_WORKERS", "FLEET_OBSERVERS"]) {
          if (typeof env[k] !== "string" || !/^[a-z][a-z0-9-]*(,[a-z][a-z0-9-]*)*$/.test(env[k])) bad(`${k} is not a list of identity names`);
        }
        if (typeof env.FLEET_WORKERS === "string" && sha256(env.FLEET_WORKERS) !== workersSha) bad("FLEET_WORKERS is not production's current list");
        if (typeof env.FLEET_OBSERVERS === "string" && sha256(env.FLEET_OBSERVERS) !== observersSha) bad("FLEET_OBSERVERS is not production's current list");
      }
    }
  }
}
if (problems.length > 0) {
  for (const p of problems) console.log(`FAIL compose: ${p}`);
  process.exit(1);
}
console.log("PASS the resolved compose config is exactly production's allowlisted shape (hardening, user, five mounts, one port)");
