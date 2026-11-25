import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Slice 4 of the release pipeline, without a server or Docker. EVERYTHING HERE IS SYNTHETIC: the
// keys, certificates, revisions, folders, addresses and jobs are made by the test and mean nothing
// outside it. The real scripts run from a sandbox git repo (with its own origin); `ssh` runs the
// "server" side locally in a sandbox folder; `docker` is a fake that keeps container state in files
// and runs helper containers' shell and node commands locally with their mounts mapped; Compose is a
// small emulator (interpolation, long-form normalisation, JSON); and every "container" is a real
// fleet-runner server over TLS from the built package, so the signed status calls are the real ones.
vi.setConfig({ testTimeout: 180_000 });
const pkg = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = resolve(pkg, "../..");
const OLD_BUILD = "0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d";
const OLD_CID = "c".repeat(64);
const OLD_IMAGE = `sha256:${"0".repeat(63)}1`;
const NEW_CID = "e".repeat(64);
const KEY_IDS = ["extra", "observer", "owner", "worker-a", "worker-b"];
const GIT_ID = {
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.test",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.test",
};

const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const approvalSha = (text: string) => sha(text.toLowerCase().replace(/\s+/g, " ").trim());

function run(cwd: string, command: string, args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
async function freePort(): Promise<number> {
  return await new Promise((ok, bad) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
    s.on("error", bad);
  });
}

// ---- The fake server side.

const FAKE_SSH = `#!/bin/bash
# Run the remote command locally, in the sandbox "server". FAKE_SSH_FAIL_MATCH makes any call whose
# command or input contains that text fail like a lost connection.
while [ "$1" = -o ]; do shift 2; done
shift
cmd="$1"
echo call >> "$FAKE_STATE/ssh.log"
in="$(mktemp)"; cat > "$in"
if [ -n "$FAKE_SSH_FAIL_MATCH" ] && { grep -q -e "$FAKE_SSH_FAIL_MATCH" "$in" || printf '%s' "$cmd" | grep -q -e "$FAKE_SSH_FAIL_MATCH"; }; then
  rm -f "$in"; echo "ssh: connection lost" >&2; exit 255
fi
# FAKE_SSH_DELAY_MATCH: a slow (but live) connection for the matching call.
if [ -n "$FAKE_SSH_DELAY_MATCH" ] && { grep -q -e "$FAKE_SSH_DELAY_MATCH" "$in" || printf '%s' "$cmd" | grep -q -e "$FAKE_SSH_DELAY_MATCH"; }; then sleep "$FAKE_SSH_DELAY"; fi
# The frozen compose config is changed after it was checked, right before the switch uses it.
if [ -n "$FAKE_TAMPER_FROZEN" ] && grep -q -e "stopped the previous production" "$in"; then
  f="$FAKE_PROD_DEPLOY/.promote-lock/resolved.json"; [ -f "$f" ] && printf ' ' >> "$f"
fi
# FAKE_COMMIT_RO: the records folder or promote.log cannot be written while the commit runs.
ro=""
if [ -n "$FAKE_COMMIT_RO" ] && grep -q -e "superseded-by-" "$in"; then
  case "$FAKE_COMMIT_RO" in records) ro="$FAKE_PROD_DEPLOY/promote-records" ;; log) ro="$FAKE_PROD_DEPLOY/promote.log" ;; esac
  chmod a-w "$ro"
fi
sh -c "$cmd" < "$in"; rc=$?
[ -z "$ro" ] || chmod u+w "$ro"
rm -f "$in"; exit $rc
`;

const FAKE_DOCKER = `#!/bin/bash
S="$FAKE_STATE"; mkdir -p "$S/images"
echo "docker $*" >> "$S/docker.log"
alive() { [ -f "$S/$1.pid" ] && kill -0 "$(cat "$S/$1.pid")" 2>/dev/null; }
stop_one() { if [ -f "$S/$1.pid" ]; then kill "$(cat "$S/$1.pid")" 2>/dev/null; while kill -0 "$(cat "$S/$1.pid")" 2>/dev/null; do sleep 0.1; done; rm -f "$S/$1.pid"; fi; }
start_old() {
  alive old && return 0
  set -m
  FAKE_DROP_JOB="" FAKE_ROOT="$FAKE_PROD_ROOT" FAKE_BUILD="$FAKE_OLD_BUILD" FAKE_CERT="$FAKE_PROD_ROOT/tls/server.crt" FAKE_KEY="$FAKE_PROD_ROOT/tls/server.key" \\
    nohup node "$FAKE_BIN/fake-server.mjs" >> "$S/server.log" 2>&1 &
  echo $! > "$S/old.pid"
  set +m
}
case "$1" in
  image)
    case "$2" in
      load)
        rel="$(dirname "$4")/release.json"
        tag="$(node -p 'require(process.argv[1]).tag' "$rel")"; id="$(node -p 'require(process.argv[1]).image_id' "$rel")"
        echo "$id" > "$S/images/$tag" ;;
      inspect)
        tag="\${@: -1}"
        case "$4" in
          *Env*) printf 'PATH=/usr/local/bin:/usr/bin\\nNODE_ENV=production\\n' ;;
          *Id*) cat "$S/images/$tag" 2>/dev/null || exit 1 ;;
          *Os*) echo linux/amd64 ;;
          *User*) echo node ;;
        esac ;;
    esac ;;
  run) exec node "$FAKE_BIN/fake-run.mjs" "$@" ;;
  compose)
    shift
    # FAKE_TAMPER_AT_UP: both copies of the frozen config are changed after the check, before Compose
    # reads its config; Compose is given the config on stdin, so the change must not reach it.
    if [ -n "$FAKE_TAMPER_AT_UP" ] && printf '%s\n' "$@" | grep -qx up; then
      for f in "$FAKE_PROD_DEPLOY/compose.resolved.json" "$FAKE_PROD_DEPLOY/.promote-lock/resolved.json"; do
        [ ! -f "$f" ] || sed -i.bak 's/"read_only": true/"read_only": false, "privileged": true/' "$f"
      done
    fi
    exec node "$FAKE_BIN/fake-compose.mjs" "$@" ;;
  kill) exit 0 ;;
  ps)
    project="$(printf '%s\\n' "$@" | sed -n 's/^label=com.docker.compose.project=//p')"
    if [ -n "$project" ] && alive compose; then echo "$FAKE_NEW_CID"; fi ;;
  stop)
    for a in "$@"; do
      case "$a" in
        "$FAKE_OLD_NAME" | "$FAKE_OLD_CID") stop_one old ;;
        "$FAKE_NEW_CID") stop_one compose ;;
      esac
    done ;;
  start) [ "$2" = "$FAKE_OLD_NAME" ] && { start_old; : > "$S/old.started"; } ;;
  exec)
    shift 2
    if [ "$1" = sh ]; then (cd "$FAKE_PROD_ROOT/public-keys" && sha256sum -- *.pub)
    else node -e "$3" "$FAKE_PROD_ROOT/state/fleet.sqlite"; fi ;;
  inspect)
    fmt="$3" target="$4"
    case "$target" in
      "$FAKE_OLD_NAME" | "$FAKE_OLD_CID")
        [ -z "$FAKE_OLD_ABSENT" ] || exit 1
        run=false; alive old && run=true
        case "$fmt" in
          *Health*) echo healthy ;;
          *PortBindings*) printf '{"8787/tcp":[{"HostIp":"127.0.0.1","HostPort":"%s"}]}\\n' "$FAKE_PROD_PORT" ;;
          *Mounts*)
            r="$FAKE_PROD_ROOT"
            printf 'bind %s/state /var/lib/fleet-runner/state true\\nbind %s/output /var/lib/fleet-runner/output true\\nbind %s/inputs /var/lib/fleet-runner/inputs true\\nbind %s/public-keys /run/fleet-runner/public-keys false\\nbind %s/tls /run/fleet-runner/tls false\\n\\n' "$r" "$r" "$r" "$r" "$r"
            [ -z "$FAKE_EXTRA_MOUNT" ] || printf 'bind / /host true\\n' ;;
          *Privileged*) echo "false 0 0 bridge \${FAKE_AUTO_REMOVE:-false}" ;;
          *Config.Env*) printf 'FLEET_WORKERS=worker-a,worker-b\\nFLEET_OBSERVERS=observer\\nFLEET_BUILD_REF=%s\\nFLEET_INPUT_DIR=/var/lib/fleet-runner/inputs\\nFLEET_TLS_CERT=/run/fleet-runner/tls/server.crt\\nFLEET_TLS_KEY=/run/fleet-runner/tls/server.key\\nFLEET_PORT=8787\\nPATH=/usr/local/bin:/usr/bin\\nNODE_ENV=production\\n' "$FAKE_OLD_BUILD" ;;
          *'.Id}} {{.Image'*) if [ -n "$FAKE_OLD_WRONG_ID" ] && [ -f "$S/old.started" ]; then echo "\${FAKE_OLD_CID%?}0 $FAKE_OLD_IMAGE $run"; else echo "$FAKE_OLD_CID $FAKE_OLD_IMAGE $run"; fi ;;
          *State.Running*) echo "$run" ;;
          *'.Image'*) echo "$FAKE_OLD_IMAGE" ;;
          *'.Id'*) echo "$FAKE_OLD_CID" ;;
        esac ;;
      "$FAKE_NEW_CID")
        case "$fmt" in
          *Health*) echo healthy ;;
          *Config.Env*) node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); for (const [k,v] of Object.entries(c.services["fleet-runner"].environment)) console.log(k+"="+v)' "$S/compose.started.json" ;;
          *'.Image'*) cat "$S/compose.image" ;;
          *State.Running*) alive compose && echo true || echo false ;;
        esac ;;
      *) exit 1 ;;
    esac ;;
esac
`;

// docker run: the helper containers. Their mounts are mapped onto the host paths and their shell or
// node command runs here; load-release.sh's non-root probe answers 1000.
const FAKE_RUN = `
import { spawnSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(3);
const mounts = [];
let entry = "", image = "", i = 0;
for (; i < args.length; i += 1) {
  const a = args[i];
  if (a === "--rm") continue;
  if (["--network", "--user", "--platform", "--name"].includes(a)) { i += 1; continue; }
  if (a === "--entrypoint") { entry = args[++i]; continue; }
  if (a === "-v") { const [h, c] = args[++i].split(":"); mounts.push([c, h]); continue; }
  image = a; i += 1; break;
}
const rest = args.slice(i);
mounts.sort((x, y) => y[0].length - x[0].length);
const map = (text) => { for (const [c, h] of mounts) text = text.split(c + "/").join(h + "/").split(c + " ").join(h + " ").split(c + '"').join(h + '"').replace(new RegExp(c.replace(/[/.]/g, "\\\\$&") + "$"), h); return text; };
if (entry === "node" && rest[0] === "-p") { console.log("1000"); process.exit(0); }
appendFileSync(process.env.FAKE_STATE + "/helper-images.log", image + "\\n");
let r;
if (process.env.FAKE_SLOW_COPY && entry === "sh" && rest[1].includes("cp -a")) spawnSync("sleep", [process.env.FAKE_SLOW_COPY]);
if (entry === "sh" && rest[0] === "-c") r = spawnSync("sh", ["-c", map(rest[1])], { stdio: "inherit" });
else if (entry === "node" && rest[0] === "-e") r = spawnSync("node", ["-e", rest[1], ...rest.slice(2).map(map)], { stdio: "inherit" });
else { console.error("fake docker run: unknown command"); process.exit(1); }
if (process.env.FAKE_CORRUPT_SNAPSHOT && entry === "sh" && rest[1].includes("cp -a")) {
  const m = /state\\.pre-[0-9TZ-]+\\.part/.exec(rest[1]);
  if (m) writeFileSync(process.env.FAKE_PROD_ROOT + "/" + m[0] + "/fleet.sqlite", "not a database");
}
process.exit(r.status ?? 1);
`;

// A tiny Compose: config resolves ${VAR}, ${VAR:-x} and ${VAR:?x} from the env file and prints the
// long form as JSON; up/ps run the resolved file (JSON) as a fake container.
const FAKE_COMPOSE = `
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, openSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.env.FAKE_REPO_ROOT + "/package.json");
const YAML = require("yaml");
const S = process.env.FAKE_STATE;
const args = process.argv.slice(2);
let project = "", envFile = "", file = "";
while (args.length && args[0].startsWith("-")) {
  const a = args.shift();
  if (a === "-p") project = args.shift(); else if (a === "--env-file") envFile = args.shift(); else if (a === "-f") file = args.shift();
}
const cmd = args.shift();
const alive = () => { try { process.kill(Number(readFileSync(S + "/compose.pid", "utf8")), 0); return true; } catch { return false; } };
const sorted = (v) => Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v;
if (cmd === "config") {
  const env = {};
  for (const line of readFileSync(envFile, "utf8").split("\\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (m) env[m[1]] = m[2]; }
  let missing = false;
  const text = readFileSync(file, "utf8").replace(/\\$\\{([A-Z0-9_]+)(?::([?-])([^}]*))?\\}/g, (_, k, op, arg) => {
    if (env[k] !== undefined && env[k] !== "") return env[k];
    if (op === "-") return arg;
    if (op === "?") missing = true;
    return "";
  });
  if (missing) { console.error("required variable is missing"); process.exit(1); }
  const doc = YAML.parse(text);
  const out = { name: project || doc.name, networks: { default: { name: (project || doc.name) + "_default", ipam: {} } }, services: {} };
  for (const [name, s] of Object.entries(doc.services)) {
    const t = { command: null, entrypoint: null, networks: { default: null }, ...s };
    t.ports = (s.ports || []).map((p) => { const [ip, pub, target] = String(p).split(":"); return { mode: "ingress", host_ip: ip, target: Number(target), published: pub, protocol: "tcp" }; });
    t.volumes = (s.volumes || []).map((v) => { const [source, target, mode] = String(v).split(":"); return { type: "bind", source, target, ...(mode === "ro" ? { read_only: true } : {}), bind: {} }; });
    out.services[name] = t;
  }
  console.log(JSON.stringify(sorted(out), null, 2));
} else if (cmd === "up") {
  const bytes = readFileSync(file === "-" ? 0 : file, "utf8");
  if (alive()) process.exit(0);
  const cfg = JSON.parse(bytes);
  writeFileSync(S + "/compose.started.json", bytes);
  const s = cfg.services["fleet-runner"];
  const root = s.volumes.find((v) => v.target === "/var/lib/fleet-runner/state").source.replace(/\\/state$/, "");
  const tls = process.env.FAKE_OTHER_CERT ? process.env.FAKE_OTHER_CERT_DIR : root + "/tls";
  const log = openSync(S + "/server.log", "a");
  const child = spawn("node", [process.env.FAKE_BIN + "/fake-server.mjs"], {
    detached: true, stdio: ["ignore", log, log],
    env: { ...process.env, FAKE_ROOT: root, FAKE_BUILD: process.env.FAKE_BAD_BUILD ? "f".repeat(40) : s.environment.FLEET_BUILD_REF,
      FAKE_CERT: tls + "/server.crt", FAKE_KEY: tls + "/server.key", FAKE_DROP_JOB: process.env.FAKE_DROP_JOB || "" },
  });
  child.unref();
  writeFileSync(S + "/compose.pid", String(child.pid));
  writeFileSync(S + "/compose.cfg", file);
  writeFileSync(S + "/compose.image", readFileSync(S + "/images/" + s.image, "utf8").trim());
} else if (cmd === "ps") {
  if (alive()) console.log(process.env.FAKE_NEW_CID);
}
`;

const FAKE_SERVER = `
import { readFileSync } from "node:fs";
import { join } from "node:path";
const pkg = process.env.FAKE_PKG;
const { JobStore } = await import(pkg + "/dist/jobs.js");
const { fleetServer } = await import(pkg + "/dist/server.js");
const root = process.env.FAKE_ROOT;
const store = new JobStore(join(root, "state/fleet.sqlite"));
if (process.env.FAKE_DROP_JOB) {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(join(root, "state/fleet.sqlite"));
  db.exec("DELETE FROM jobs WHERE rowid = (SELECT min(rowid) FROM jobs)");
  db.close();
}
const server = fleetServer(store, {
  registry: join(root, "public-keys"),
  outDir: join(root, "output"),
  workers: ["worker-a", "worker-b"],
  observers: ["observer"],
  build: process.env.FAKE_BUILD,
  tls: { cert: readFileSync(process.env.FAKE_CERT), key: readFileSync(process.env.FAKE_KEY) },
});
server.listen(Number(process.env.FAKE_PROD_PORT), "127.0.0.1");
for (const s of ["SIGTERM", "SIGINT"]) process.once(s, () => { server.close(() => { store.close(); process.exit(0); }); server.closeAllConnections(); });
`;

// ---- The sandbox.

interface Box {
  root: string;
  repo: string;
  bin: string;
  conf: string;
  stageDeploy: string;
  prodDeploy: string;
  prodRoot: string;
  port: number;
  revs: string[];
}
let box: Box;
let cache: string;

const fake = (name: string) => join(box.root, "fake", name);
const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");
const promoteLog = () => read(join(box.prodDeploy, "promote.log"));

function env(extra: Record<string, string> = {}): Record<string, string> {
  return {
    PATH: `${box.bin}:${process.env.PATH ?? ""}`,
    FLEET_STAGE_CONF: box.conf,
    FAKE_STATE: join(box.root, "fake"),
    FAKE_BIN: box.bin,
    FAKE_PKG: pkg,
    FAKE_REPO_ROOT: repoRoot,
    FAKE_PROD_ROOT: box.prodRoot,
    FAKE_PROD_DEPLOY: box.prodDeploy,
    FAKE_PROD_PORT: String(box.port),
    FAKE_OLD_NAME: "fleet-hand-started",
    FAKE_OLD_CID: OLD_CID,
    FAKE_OLD_IMAGE: OLD_IMAGE,
    FAKE_OLD_BUILD: OLD_BUILD,
    FAKE_NEW_CID: NEW_CID,
    FAKE_OTHER_CERT_DIR: join(cache, "other-tls"),
    FLEET_READY_TRIES: "20",
    FLEET_READY_SLEEP: "0.3",
    FLEET_UNDO_RETRY_SECS: "20",
    FLEET_UNDO_HEALTH_WAIT: "5",
    FLEET_FENCE_WAIT: "30",
    FLEET_DEADMAN_SECS: "600",
    // Small synthetic phase bounds, so short dead-man deadlines pass the window check.
    FLEET_STOP_SECS: "5",
    FLEET_SNAPSHOT_COPY_SECS: "10",
    FLEET_INTEGRITY_SECS: "10",
    FLEET_START_SECS: "10",
    FLEET_STATUS_TIMEOUT_SECS: "2",
    FLEET_TLS_SECS: "5",
    FLEET_VERIFY_SECS: "5",
    FLEET_RECORD_SECS: "5",
    FLEET_DEADMAN_MARGIN_SECS: "1",
    FLEET_PROMOTE_FAULT: "",
    FAKE_SSH_DELAY_MATCH: "",
    FAKE_SSH_DELAY: "0",
    FAKE_COMMIT_RO: "",
    FAKE_TAMPER_AT_UP: "",
    FAKE_SLOW_COPY: "",
    FAKE_LN_FAIL: "",
    FAKE_DEADMAN_RACE: "",
    FAKE_SSH_FAIL_MATCH: "",
    FAKE_TAMPER_FROZEN: "",
    FAKE_CORRUPT_SNAPSHOT: "",
    FAKE_BAD_BUILD: "",
    FAKE_DROP_JOB: "",
    FAKE_OTHER_CERT: "",
    FAKE_OLD_WRONG_ID: "",
    FAKE_EXTRA_MOUNT: "",
    FAKE_AUTO_REMOVE: "",
    FAKE_OLD_ABSENT: "",
    ...extra,
  };
}
const script = () => join(box.repo, "packages/fleet-runner/scripts/fleet-promote.sh");
const promote = (args: string[], extra: Record<string, string> = {}) =>
  run(box.repo, "bash", [script(), ...args], env(extra));
const yes = (rev: string, n = 1) =>
  `Yes, put ${rev.slice(0, 7)} live (synthetic approval ${"run".repeat(n)})`;
const setStaged = (last: string, staged: string) =>
  writeFileSync(join(box.stageDeploy, "stage-state"), `last_passed=${last}\nstaged_ok=${staged}\n`);
const statusNow = (): string => {
  const r = spawnSync("node", [join(pkg, "scripts/stage-smoke.mjs"), "build"], {
    encoding: "utf8",
    env: {
      ...process.env,
      STAGE_URL: `https://localhost:${box.port}`,
      STAGE_KEYS_DIR: join(box.root, "prodkeys"),
      STAGE_STATUS_ID: "observer",
      NODE_EXTRA_CA_CERTS: join(box.root, "prodkeys/ca.crt"),
    },
  });
  return r.status === 0 ? (JSON.parse(r.stdout).build as string) : "";
};
const status = async (): Promise<string> => statusNow();
const waitFor = async (what: () => boolean | Promise<boolean>, ms = 30_000) => {
  for (let t = 0; t < ms; t += 200) {
    if (await what()) return;
    await new Promise((ok) => setTimeout(ok, 200));
  }
  throw new Error("timed out waiting");
};
const commit = (message: string) => {
  run(box.repo, "git", ["add", "-A"]);
  run(box.repo, "git", ["commit", "-q", "-m", message], GIT_ID);
  run(box.repo, "git", ["push", "-q", "origin", "main"]);
  return run(box.repo, "git", ["rev-parse", "HEAD"]).out.trim();
};
// A synthetic staged release, and this Mac's receipt of it.
function makeStaged(rev: string, receipt = true) {
  const dir = join(box.stageDeploy, "releases", rev);
  mkdirSync(dir, { recursive: true });
  const archive = Buffer.from(`synthetic archive of ${rev}\n`);
  writeFileSync(join(dir, "fleet-runner-image.tar"), archive);
  const json = `${JSON.stringify({ revision: rev, tag: `fleet-runner:${rev}`, image_id: `sha256:${sha(`image ${rev}`)}`, manifest_digest: `sha256:${sha(`manifest ${rev}`)}`, archive_sha256: sha(archive) }, null, 2)}\n`;
  writeFileSync(join(dir, "release.json"), json);
  if (receipt) {
    mkdirSync(join(dirname(box.conf), "receipts"), { recursive: true, mode: 0o700 });
    writeFileSync(
      join(dirname(box.conf), "receipts", `${rev}.receipt`),
      [
        `revision=${rev}`,
        `tag=fleet-runner:${rev}`,
        `image_id=sha256:${sha(`image ${rev}`)}`,
        `manifest_digest=sha256:${sha(`manifest ${rev}`)}`,
        `archive_sha256=${sha(archive)}`,
        `release_json_sha256=${sha(json)}`,
        "stage_run=synthetic",
        "",
      ].join("\n"),
    );
  }
  setStaged(rev, rev);
}
const startOld = () => {
  const r = run(box.root, "docker", ["start", "fleet-hand-started"], env());
  if (r.status !== 0) throw new Error(r.out);
  // A running production answers: wait until the synthetic one does.
  for (let i = 0; i < 50 && statusNow() !== OLD_BUILD; i += 1) spawnSync("sleep", ["0.2"]);
};
const jobCount = () => {
  const r = run(box.root, "node", [
    "-e",
    `const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync(process.argv[1],{readOnly:true});console.log(d.prepare("SELECT count(*) n FROM jobs").get().n)`,
    join(box.prodRoot, "state/fleet.sqlite"),
  ]);
  return Number(r.out.trim().split("\n").pop());
};

beforeAll(() => {
  // Synthetic keys and two synthetic certificates, made once.
  cache = mkdtempSync(join(tmpdir(), "fleet-promote-cache-"));
  for (const id of KEY_IDS) {
    const r = run(cache, "node", [join(pkg, "dist/cli.js"), "keygen", join(cache, `${id}.token`)]);
    if (r.status !== 0) throw new Error(r.out);
  }
  // A synthetic CA, and two server certificates it signs (the second for the changed-certificate case).
  const ssl = (cwd: string, args: string[]) => {
    const r = run(cwd, "openssl", args);
    if (r.status !== 0) throw new Error(r.out);
  };
  ssl(cache, [
    "req",
    "-x509",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:prime256v1",
    "-nodes",
    "-days",
    "2",
    "-subj",
    "/CN=synthetic-ca",
    "-keyout",
    "ca.key",
    "-out",
    "ca.crt",
  ]);
  writeFileSync(
    join(cache, "ext.cnf"),
    "subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n",
  );
  for (const d of ["tls", "other-tls"]) {
    mkdirSync(join(cache, d));
    ssl(join(cache, d), [
      "req",
      "-new",
      "-newkey",
      "ec",
      "-pkeyopt",
      "ec_paramgen_curve:prime256v1",
      "-nodes",
      "-subj",
      "/CN=localhost",
      "-keyout",
      "server.key",
      "-out",
      "server.csr",
    ]);
    ssl(join(cache, d), [
      "x509",
      "-req",
      "-in",
      "server.csr",
      "-CA",
      "../ca.crt",
      "-CAkey",
      "../ca.key",
      "-CAcreateserial",
      "-days",
      "2",
      "-sha256",
      "-extfile",
      "../ext.cnf",
      "-out",
      "server.crt",
    ]);
  }
});
afterAll(() => rmSync(cache, { recursive: true, force: true }));

beforeEach(async () => {
  const root = mkdtempSync(join(tmpdir(), "fleet-promote-box-"));
  const repo = join(root, "repo");
  const bin = join(root, "bin");
  const confDir = join(root, "conf");
  const nas = join(root, "nas");
  const stageDeploy = join(nas, "stage-deploy");
  const prodDeploy = join(nas, "prod-deploy");
  const prodRoot = join(nas, "prod-root");
  for (const d of [
    bin,
    join(root, "fake/images"),
    join(root, "stage-keys"),
    join(root, "prodkeys"),
    stageDeploy,
    join(nas, "stage-root"),
    confDir,
  ]) {
    mkdirSync(d, { recursive: true });
  }
  for (const d of ["state", "output", "inputs", "public-keys", "tls"])
    mkdirSync(join(prodRoot, d), { recursive: true });
  for (const d of [join(root, "stage-keys"), join(root, "prodkeys"), confDir]) chmodSync(d, 0o700);
  for (const id of KEY_IDS)
    cpSync(join(cache, `${id}.token.pub`), join(prodRoot, "public-keys", `${id}.pub`));
  cpSync(join(cache, "observer.token"), join(root, "prodkeys/observer.token"));
  // The synthetic CA signs both certificates, so a changed one is caught by the fingerprint check.
  cpSync(join(cache, "ca.crt"), join(root, "prodkeys/ca.crt"));
  for (const f of ["server.crt", "server.key"])
    cpSync(join(cache, "tls", f), join(prodRoot, "tls", f));
  // Three synthetic jobs in production's store.
  const seed = run(root, "node", [
    "--input-type=module",
    "-e",
    `const { JobStore } = await import(${JSON.stringify(`${pkg}/dist/jobs.js`)}); const s = new JobStore(process.argv[1]); for (let i = 0; i < 3; i++) s.enqueue({ kind: "proof-fixture", inputs: ["${"a".repeat(63)}" + i], payload: null }); s.close();`,
    join(prodRoot, "state/fleet.sqlite"),
  ]);
  if (seed.status !== 0) throw new Error(seed.out);
  // The sandbox repo: the real scripts and deploy files, committed, with an origin at the same main.
  const target = join(repo, "packages/fleet-runner");
  mkdirSync(target, { recursive: true });
  cpSync(join(pkg, "scripts"), join(target, "scripts"), { recursive: true });
  cpSync(join(pkg, "deploy"), join(target, "deploy"), { recursive: true });
  symlinkSync(join(pkg, "dist"), join(target, "dist"));
  writeFileSync(join(repo, ".gitignore"), "packages/fleet-runner/dist\n");
  const git = (...a: string[]) => {
    const r = run(repo, "git", a, GIT_ID);
    if (r.status !== 0) throw new Error(r.out);
    return r.out.trim();
  };
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "first");
  const revs = [git("rev-parse", "HEAD")];
  writeFileSync(join(repo, "second.txt"), "second");
  git("add", "-A");
  git("commit", "-q", "-m", "second");
  revs.push(git("rev-parse", "HEAD"));
  run(root, "git", ["clone", "-q", "--bare", repo, join(root, "origin.git")]);
  git("remote", "add", "origin", join(root, "origin.git"));
  git("fetch", "-q", "origin");
  for (const [f, body] of [
    ["ssh", FAKE_SSH],
    ["docker", FAKE_DOCKER],
    ["fake-run.mjs", FAKE_RUN],
    ["fake-compose.mjs", FAKE_COMPOSE],
    ["fake-server.mjs", FAKE_SERVER],
  ] as const) {
    writeFileSync(join(bin, f), body);
    chmodSync(join(bin, f), 0o755);
  }
  // What a Linux server has and a Mac may not: setsid, GNU stat -c, sha256sum.
  if (spawnSync("sh", ["-c", "command -v setsid"]).status !== 0) {
    writeFileSync(
      join(bin, "setsid"),
      `#!/bin/bash\nexec perl -MPOSIX -e 'POSIX::setsid(); exec { $ARGV[0] } @ARGV' -- "$@"\n`,
    );
    chmodSync(join(bin, "setsid"), 0o755);
  }
  if (spawnSync("stat", ["-c", "%u", "/"]).status !== 0) {
    writeFileSync(
      join(bin, "stat"),
      `#!/bin/bash\n[ "$1" = -c ] && [ "$2" = %u:%g ] && exec /usr/bin/stat -f %u:%g "$3"\nexec /usr/bin/stat "$@"\n`,
    );
    chmodSync(join(bin, "stat"), 0o755);
  }
  // FAKE_LN_FAIL: the decision link fails as on a full disk (not "already exists").
  writeFileSync(
    join(bin, "ln"),
    `#!/bin/bash\nif [ -n "$FAKE_LN_FAIL" ]; then case "\${@: -1}" in */decided) echo "ln: No space left on device" >&2; exit 1 ;; esac; fi\nexec /bin/ln "$@"\n`,
  );
  // FAKE_DEADMAN_RACE: right after the commit publishes its record, the dead-man claims the undo
  // and starts it (as if its deadline passed between the commit's first check and its claim).
  writeFileSync(
    join(bin, "mv"),
    `#!/bin/bash\n/bin/mv "$@" || exit $?\nif [ -n "$FAKE_DEADMAN_RACE" ]; then case "\${@: -1}" in */promote-records/promote-*.txt) l="$FAKE_PROD_DEPLOY/.promote-lock"; /bin/ln "$l/claim.deadman" "$l/decided" && (setsid sh "$l/run-undo.sh" "$l" >/dev/null 2>&1 </dev/null &) ;; esac; fi\n`,
  );
  chmodSync(join(bin, "ln"), 0o755);
  chmodSync(join(bin, "mv"), 0o755);
  if (spawnSync("sh", ["-c", "command -v sha256sum"]).status !== 0) {
    writeFileSync(join(bin, "sha256sum"), `#!/bin/bash\nexec shasum -a 256 "$@"\n`);
    chmodSync(join(bin, "sha256sum"), 0o755);
  }
  const port = await freePort();
  const conf = join(confDir, "stage.conf");
  writeFileSync(
    conf,
    [
      "NAS_SSH=synthetic-server",
      `NAS_STAGE_DIR=${stageDeploy}`,
      `NAS_STAGE_ROOT=${join(nas, "stage-root")}`,
      "STAGE_LAN_IP=127.0.0.1",
      `STAGE_PORT=${port + 1}`,
      "STAGE_HOST=localhost",
      `STAGE_KEYS_DIR=${join(root, "stage-keys")}`,
      `PROD_PORT=${port}`,
      "PROD_CONTAINER=fleet-hand-started",
      "PROD_PROJECT=fleet-prod",
      `NAS_PROD_DIR=${prodDeploy}`,
      `NAS_PROD_ROOT=${prodRoot}`,
      `PROD_KEYS_DIR=${join(root, "prodkeys")}`,
      `PROD_KEY_IDS="${KEY_IDS.join(" ")}"`,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  box = { root, repo, bin, conf, stageDeploy, prodDeploy, prodRoot, port, revs };
});

afterEach(() => {
  const pids = [join(box.prodDeploy, ".promote-lock/deadman.pid")];
  for (const f of existsSync(fake("")) ? readdirSync(fake("")) : [])
    if (f.endsWith(".pid")) pids.push(fake(f));
  for (const p of pids) {
    try {
      process.kill(Number(readFileSync(p, "utf8")));
    } catch {
      /* already gone */
    }
  }
  rmSync(box.root, { recursive: true, force: true });
});

// Nothing of production changed: no engine call that changes anything, no spent approval, no lock.
function expectUntouched() {
  expect(read(fake("docker.log"))).not.toMatch(/docker (stop|compose .* up)/);
  expect(read(fake("docker.log")).match(/docker start /g)?.length ?? 0).toBeLessThanOrEqual(1);
  expect(promoteLog()).not.toContain(" started ");
  expect(existsSync(join(box.prodDeploy, ".promote-lock"))).toBe(false);
}

describe("fleet-promote.sh refuses, before anything changes", () => {
  it("without the owner's approval, before reaching the server", () => {
    for (const args of [
      [box.revs[1]],
      [box.revs[1], "--owner-approved", ""],
      [box.revs[1], "--owner-approved", "  "],
    ]) {
      const r = promote(args);
      expect(r.status, args.join(" ")).toBe(3);
      expect(r.out).toContain("REFUSED promote changes production and needs the owner's yes");
    }
    expect(read(fake("ssh.log"))).toBe("");
  });

  it("an approval that names no revision, or one of more than one line", () => {
    const rev = box.revs[1];
    let r = promote([rev, "--owner-approved", "yes, ship it"]);
    expect(r.out).toContain(
      `the owner's approval must name the revision it approves (the approval must hold the start (7 to 40 hex characters) of ${rev.slice(0, 7)}'s commit ID`,
    );
    r = promote([rev, "--owner-approved", `yes ${rev.slice(0, 7)}\nand something else`]);
    expect(r.out).toContain("--owner-approved must be one line");
    expect(r.status).toBe(1);
    expect(read(fake("ssh.log"))).toBe("");
  });

  it("an approval naming a longer string that only starts with the revision (a prefix collision)", () => {
    const rev = box.revs[1];
    const other = `${rev.slice(0, 7)}${"0".repeat(33)}`;
    // It is the start of no commit, so it is ignored, and nothing else names the revision.
    const r = promote([rev, "--owner-approved", `Yes, promote ${other}`]);
    expect(r.status).toBe(1);
    expect(r.out).toContain(
      `the owner's approval must name the revision it approves (the approval must hold the start`,
    );
    expect(read(fake("ssh.log"))).toBe("");
  });

  it("an approval that holds the revision only as a window inside a longer string", () => {
    const rev = box.revs[1];
    const r = promote([rev, "--owner-approved", `yes ${rev.slice(2, 14)}`]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("the owner's approval must name the revision it approves");
  });

  it("an approval that also names another commit", () => {
    const [other, rev] = box.revs;
    const r = promote([rev, "--owner-approved", `yes ${rev.slice(0, 7)}, and also ${other}`]);
    expect(r.status).toBe(1);
    expect(r.out).toContain(
      `the approval names ${other}, which is ${other.slice(0, 12)}, not ${rev.slice(0, 7)}`,
    );
  });

  it("an ambiguous short revision, and accepts the same revision named unambiguously, in any case", () => {
    // Two synthetic commits whose IDs share their first 7 characters (found offline, deterministic).
    const t = run(box.repo, "git", ["hash-object", "-t", "tree", "-w", "/dev/null"]).out.trim();
    const mk = (n: number) =>
      spawnSync("git", ["commit-tree", t], {
        cwd: box.repo,
        input: `synthetic collision ${n}\n`,
        encoding: "utf8",
        env: {
          ...process.env,
          ...GIT_ID,
          GIT_AUTHOR_DATE: "1700000000 +0000",
          GIT_COMMITTER_DATE: "1700000000 +0000",
        },
      }).stdout.trim();
    const a = mk(5137);
    const b = mk(15944);
    expect(a).toBe("e4e2bb5b4e70aa65ae076611b56dc2bda6f1fdb1");
    expect(b.slice(0, 7)).toBe(a.slice(0, 7));
    let r = promote([a, "--owner-approved", `yes ${a.slice(0, 7)}`, "--rehearsal"]);
    expect(r.status).toBe(1);
    expect(r.out).toContain(
      `the approval names ${a.slice(0, 7)}, which is the start of more than one commit`,
    );
    // Unambiguous and upper case: the approval passes, and a later check refuses instead.
    r = promote([a, "--owner-approved", `YES ${a.slice(0, 9).toUpperCase()}`, "--rehearsal"]);
    expect(r.status).toBe(1);
    expect(r.out).not.toContain("the approval names");
    expect(r.out).not.toContain("must name the revision");
  });

  it("ignores hex-looking words that name no commit, and still refuses one that names another commit", () => {
    const [other, rev] = box.revs;
    const s7 = rev.slice(0, 7);
    // A date, "feedback" and "deadbeef" are hex runs of 7+ characters that start no commit: ignored.
    for (const text of [
      `Yes, promote ${s7} on 20261125`,
      `Good feedback. Yes, promote ${s7} deadbeef`,
    ]) {
      const r = promote([rev, "--owner-approved", text, "--rehearsal"]);
      expect(r.out, text).not.toContain("the approval names");
      expect(r.out, text).not.toContain("must name the revision");
    }
    // Only hex words that name nothing: refused, stating the rule.
    let r = promote([rev, "--owner-approved", "Yes, feedback deadbeef 20261125", "--rehearsal"]);
    expect(r.out).toContain("the approval must hold the start (7 to 40 hex characters) of");
    // A second token naming another real commit refuses.
    r = promote([
      rev,
      "--owner-approved",
      `Yes, promote ${s7} on 20261125, not ${other.slice(0, 8)}`,
    ]);
    expect(r.status).toBe(1);
    expect(r.out).toContain(
      `the approval names ${other.slice(0, 8)}, which is ${other.slice(0, 12)}, not ${s7}`,
    );
  });

  it("a branch named like a short commit ID, as the revision or in the approval (fix 5)", () => {
    const [a, b] = box.revs;
    // A local branch named as commit A's 7 characters, pointing at commit B.
    expect(run(box.repo, "git", ["branch", a.slice(0, 7), b]).status).toBe(0);
    let r = promote([
      a.slice(0, 7),
      "--owner-approved",
      `Yes, put ${a.slice(0, 7)} live`,
      "--rehearsal",
    ]);
    expect(r.status).toBe(1);
    expect(r.out).toContain(
      `${a.slice(0, 7)} resolves to ${b.slice(0, 12)}, which does not start with it`,
    );
    // Promoting B with an approval that names A's short ID (now a branch at B) is refused too: the
    // approval's tokens are matched against commit IDs only.
    r = promote([b, "--owner-approved", `Yes, put ${a.slice(0, 7)} live`, "--rehearsal"]);
    expect(r.status).toBe(1);
    expect(r.out).toContain(
      `the approval names ${a.slice(0, 7)}, which is ${a.slice(0, 12)}, not ${b.slice(0, 7)}`,
    );
    expect(read(fake("ssh.log"))).toBe("");
  });

  it("a dead-man deadline that is not longer than the bounded phases plus the margin (fix 6)", () => {
    const rev = box.revs[1];
    // Health alone: 20 tries x (2 s + 1 s) = 60 s; with the other synthetic bounds the sum is 125 s.
    const r = promote([rev, "--owner-approved", yes(rev)], { FLEET_DEADMAN_SECS: "120" });
    expect(r.status).toBe(1);
    expect(r.out).toContain(
      "the dead-man's deadline (120 s) must be longer than the bounded phases after arming (125 s) plus the margin (1 s)",
    );
    expect(read(fake("ssh.log"))).toBe("");
    expect(
      promote([rev, "--owner-approved", yes(rev)], { FLEET_DEADMAN_SECS: "126" }).out,
    ).toContain("must be longer than");
  });

  it("from a dirty checkout or one not at origin/main, unless --rehearsal", () => {
    const rev = box.revs[1];
    writeFileSync(join(box.repo, "second.txt"), "changed");
    let r = promote([rev, "--owner-approved", yes(rev)]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("this checkout has uncommitted changes");
    run(box.repo, "git", ["checkout", "-q", "--", "second.txt"]);
    run(box.repo, "git", ["checkout", "-q", "--detach", box.revs[0]]);
    r = promote([box.revs[0], "--owner-approved", yes(box.revs[0])]);
    expect(r.out).toContain("this checkout is not at origin/main");
    expect(read(fake("ssh.log"))).toBe("");
  });

  it("--rehearsal or a forced fault against a production without the rehearsal marker", () => {
    const rev = box.revs[1];
    makeStaged(rev);
    let r = promote([rev, "--owner-approved", yes(rev)], { FLEET_PROMOTE_FAULT: "health" });
    expect(r.out).toContain("FLEET_PROMOTE_FAULT needs --rehearsal");
    r = promote([rev, "--owner-approved", yes(rev), "--rehearsal"]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("--rehearsal is only for a throwaway production");
    expectUntouched();
  });

  it("a revision not staged, or staged but not the last that passed, and creates nothing on the server", () => {
    const [other, rev] = box.revs;
    makeStaged(rev);
    for (const [last, staged] of [
      [rev, other],
      [other, rev],
      [rev, ""],
    ]) {
      setStaged(last, staged);
      const r = promote([rev, "--owner-approved", yes(rev)]);
      expect(r.status).toBe(1);
      expect(r.out).toContain(`${rev.slice(0, 7)} is not staged`);
    }
    expect(existsSync(box.prodDeploy)).toBe(false);
    expectUntouched();
  });

  it("without this Mac's receipt, or when the server's release is not the receipted one", () => {
    const rev = box.revs[1];
    makeStaged(rev, false);
    let r = promote([rev, "--owner-approved", yes(rev)]);
    expect(r.out).toContain(`this Mac has no receipt for ${rev.slice(0, 7)}`);
    makeStaged(rev);
    writeFileSync(join(box.stageDeploy, "releases", rev, "release.json"), "{}\n");
    r = promote([rev, "--owner-approved", yes(rev)]);
    expect(r.out).toContain("is not the one this Mac verified (receipt)");
    expect(r.status).toBe(1);
    expect(existsSync(box.prodDeploy)).toBe(false);
  });

  it("a staged archive that does not hash to the receipt, with this checkout's load-release.sh", () => {
    const rev = box.revs[1];
    makeStaged(rev);
    startOld();
    writeFileSync(
      join(box.stageDeploy, "releases", rev, "load-release.sh"),
      "echo 'PASS forged'; exit 0\n",
    );
    writeFileSync(
      join(box.stageDeploy, "releases", rev, "fleet-runner-image.tar"),
      "a different archive\n",
    );
    const r = promote([rev, "--owner-approved", yes(rev)]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL archive checksum");
    expect(r.out).not.toContain("PASS forged");
    expectUntouched();
  });

  it("an approval that was already used, also with other case or spacing", () => {
    const rev = box.revs[1];
    makeStaged(rev);
    mkdirSync(box.prodDeploy, { recursive: true });
    writeFileSync(join(box.prodDeploy, ".fleet-runner-production"), "");
    writeFileSync(
      join(box.prodDeploy, "promote.log"),
      `20261101T000000Z-1 started fleet-hand-started -> ${rev.slice(0, 7)} approval_sha256=${approvalSha(yes(rev))} approval: ${yes(rev)}\n`,
    );
    for (const approval of [yes(rev), `  ${yes(rev).toUpperCase()}  `]) {
      const r = promote([rev, "--owner-approved", approval]);
      expect(r.status, approval).toBe(1);
      expect(r.out).toContain(
        "this approval was already used (promote.log): each yes covers one promotion",
      );
    }
    expect(promoteLog().split("\n").filter(Boolean)).toHaveLength(1);
    expect(read(fake("docker.log"))).toBe("");
  });

  it("to sign as production's owner, or without PROD_KEY_IDS", () => {
    const rev = box.revs[1];
    const base = read(box.conf);
    writeFileSync(box.conf, `${base}PROD_STATUS_ID=owner\n`);
    let r = promote([rev, "--owner-approved", yes(rev)]);
    expect(r.out).toContain("the promote never signs as production's owner");
    writeFileSync(box.conf, base.replace(/^PROD_KEY_IDS=.*$/m, ""));
    r = promote([rev, "--owner-approved", yes(rev)]);
    expect(r.out).toContain("config must set PROD_KEY_IDS");
    expect(read(fake("ssh.log"))).toBe("");
  });

  it("a hand-started container the Compose file cannot reproduce: an extra mount, or auto-remove", () => {
    const rev = box.revs[1];
    makeStaged(rev);
    startOld();
    for (const extra of [{ FAKE_EXTRA_MOUNT: "1" }, { FAKE_AUTO_REMOVE: "true" }]) {
      const r = promote([rev, "--owner-approved", yes(rev)], extra);
      expect(r.status).toBe(1);
      expect(r.out).toContain(
        "the first promote cannot reproduce the hand-started container; nothing was changed",
      );
    }
    expectUntouched();
  });

  it("enrolled keys that are not exactly PROD_KEY_IDS", () => {
    const rev = box.revs[1];
    makeStaged(rev);
    startOld();
    rmSync(join(box.prodRoot, "public-keys/extra.pub"));
    const r = promote([rev, "--owner-approved", yes(rev)]);
    expect(r.status).toBe(1);
    expect(r.out).toContain(
      "production's enrolled keys are not exactly the ones PROD_KEY_IDS names",
    );
    expectUntouched();
  });

  it("a tampered compose.production.yaml, through the promote itself, ending 'nothing was changed'", () => {
    const file = join(box.repo, "packages/fleet-runner/deploy/compose.production.yaml");
    writeFileSync(
      file,
      read(file)
        .replace(
          "    read_only: true\n",
          "    read_only: true\n    privileged: true\n    cap_add: [SYS_ADMIN]\n",
        )
        .replace("tls:ro\n", "tls:ro\n      - /:/host\n"),
    );
    const rev = commit("synthetic tampered compose");
    makeStaged(rev);
    startOld();
    const r = promote([rev, "--owner-approved", yes(rev)]);
    expect(r.status).toBe(1);
    expect(r.out).toContain(
      "FAIL compose: services.fleet-runner has privileged, which is not allowed",
    );
    expect(r.out).toContain(
      "FAIL compose: services.fleet-runner has cap_add, which is not allowed",
    );
    expect(r.out).toContain(
      "FAIL compose: services.fleet-runner.volumes is not the required value",
    );
    expect(r.out).toContain("is not production's allowlisted shape; nothing was changed");
    expectUntouched();
  });
});

describe("fleet-promote.sh switches, health-checks and undoes", () => {
  const ready = () => {
    makeStaged(box.revs[1]);
    startOld();
  };

  it("promotes: snapshot verified, exactly the checked config, health checked, record, dead-man disarmed", async () => {
    ready();
    const rev = box.revs[1];
    const r = promote([rev, "--owner-approved", yes(rev)]);
    expect(r.out).toContain(
      "PASS the resolved compose config is exactly production's allowlisted shape",
    );
    expect(r.out).toContain("PASS the server-side dead-man is armed");
    expect(r.out).toMatch(/SNAPSHOT state\.pre-\S+ integrity=ok schema=\d+ jobs=3/);
    expect(r.out).toContain(`PASS signed status ready, build ${rev.slice(0, 12)}`);
    expect(r.out).toContain("PASS the same TLS certificate");
    expect(r.out).toContain("PASS the same 5 enrolled keys, by hash");
    expect(r.out).toContain("PASS 3 jobs (the snapshot had 3)");
    expect(r.out).toContain("PASS the server-side dead-man is disarmed");
    expect(r.out).toContain(`PASS production runs ${rev.slice(0, 7)}`);
    expect(r.out).toContain("UNDO by hand");
    expect(r.status, r.out).toBe(0);
    expect(await status()).toBe(rev);
    expect(promoteLog()).toMatch(
      / started fleet-hand-started -> [\s\S]* promoted fleet-hand-started -> /,
    );
    const records = readdirSync(join(box.prodDeploy, "promote-records"));
    expect(records.some((f) => /^promote-.*\.txt$/.test(f))).toBe(true);
    expect(records.some((f) => f.endsWith(".part"))).toBe(false);
    // What runs is the frozen, checked config, started with nothing re-read.
    // Compose got the checked bytes on stdin: no file was opened between the check and the start.
    expect(read(fake("compose.cfg")).trim()).toBe("-");
    expect(read(fake("docker.log"))).toMatch(
      /compose -p fleet-prod --env-file \/dev\/null -f - up -d --pull never/,
    );
    expect(read(fake("compose.started.json"))).toBe(
      read(join(box.prodDeploy, "compose.resolved.json")),
    );
    // Change A: the manual undo was saved when the dead-man was armed.
    expect(records.some((f) => /^manual-undo-.*\.txt$/.test(f))).toBe(true);
    // The root helper containers ran by the checked image ID, never by tag.
    const helpers = read(fake("helper-images.log")).trim().split("\n");
    expect(helpers.length).toBeGreaterThan(2);
    for (const h of helpers) expect(h).toBe(`sha256:${sha(`image ${rev}`)}`);
    // The dead-man saw the pass and stood down; the lock is gone.
    expect(existsSync(join(box.prodDeploy, ".promote-lock"))).toBe(false);
    // A durable local log of the whole run, beside the private config.
    const dir = join(dirname(box.conf), "logs");
    const log = readdirSync(dir)
      .filter((f) => f.endsWith(".log"))
      .map((f) => read(join(dir, f)))
      .join("\n");
    expect(log).toContain(`PASS production runs ${rev.slice(0, 7)}`);
  });

  it("undoes itself on a failed health check, puts the old container back, and exits non-zero", async () => {
    ready();
    const rev = box.revs[1];
    const r = promote([rev, "--owner-approved", yes(rev)], {
      FAKE_BAD_BUILD: "1",
      FLEET_READY_TRIES: "4",
    });
    expect(r.out).toContain(`FAIL signed status is not ready on build ${rev.slice(0, 12)}`);
    expect(r.out).toContain("this Mac runs the undo");
    expect(r.out).toContain("put the verified snapshot back as the state folder");
    expect(r.out).toContain("started the previous production again");
    expect(r.out).toContain(`CHECKED signed status ready, build ${OLD_BUILD.slice(0, 12)}`);
    expect(r.out).toContain("UNDONE production is back on the hand-started container");
    expect(r.out).not.toMatch(/^PASS production runs/m);
    expect(r.status).toBe(1);
    expect(await status()).toBe(OLD_BUILD);
    expect(read(fake("docker.log"))).toMatch(
      /docker start fleet-hand-started[\s\S]*docker stop[\s\S]*docker start fleet-hand-started/,
    );
    expect(promoteLog()).toContain(" undone fleet-hand-started -> ");
    expect(readdirSync(box.prodRoot).some((f) => f.startsWith("state.failed-"))).toBe(true);
    expect(
      readdirSync(join(box.prodDeploy, "promote-records")).some((f) =>
        /^undo-.*-mac\.txt$/.test(f),
      ),
    ).toBe(true);
    expect(existsSync(join(box.prodDeploy, ".promote-lock"))).toBe(false);
  });

  it("undoes itself under the rehearsal's forced health failure too", async () => {
    ready();
    mkdirSync(box.prodDeploy, { recursive: true });
    writeFileSync(join(box.prodDeploy, ".fleet-runner-production"), "");
    writeFileSync(join(box.prodDeploy, ".fleet-runner-promote-rehearsal"), "");
    const rev = box.revs[1];
    const r = promote([rev, "--owner-approved", yes(rev), "--rehearsal"], {
      FLEET_PROMOTE_FAULT: "health",
      FLEET_READY_TRIES: "3",
    });
    expect(r.out).toContain("REHEARSAL: the health check will be made to fail");
    expect(r.out).toContain("UNDONE production is back");
    expect(r.status).toBe(1);
    expect(await status()).toBe(OLD_BUILD);
  });

  for (const [name, extra, message] of [
    [
      "a changed TLS certificate",
      { FAKE_OTHER_CERT: "1" },
      "FAIL production's TLS certificate changed",
    ],
    ["fewer jobs", { FAKE_DROP_JOB: "1" }, "FAIL the job count fell from 3 to 2"],
  ] as const) {
    it(`undoes itself on ${name}`, async () => {
      ready();
      const rev = box.revs[1];
      const r = promote([rev, "--owner-approved", yes(rev)], extra);
      expect(r.out).toContain(message);
      expect(r.out).toContain("UNDONE production is back");
      expect(r.status).toBe(1);
      expect(await status()).toBe(OLD_BUILD);
      expect(jobCount()).toBe(3);
    });
  }

  it("refuses to start a frozen config that changed after it was checked, and undoes", async () => {
    ready();
    const rev = box.revs[1];
    const r = promote([rev, "--owner-approved", yes(rev)], { FAKE_TAMPER_FROZEN: "1" });
    expect(r.out).toContain("FAIL the compose config to start is not the one that was checked");
    expect(r.out).toContain(
      "the new revision never started, so the live state folder was left as it was",
    );
    expect(r.out).toContain("UNDONE production is back");
    expect(r.status).toBe(1);
    expect(read(fake("docker.log"))).not.toMatch(/compose .* up/);
    expect(await status()).toBe(OLD_BUILD);
  });

  it("stops on a snapshot that fails its integrity check, leaves the live state alone, and undoes", async () => {
    ready();
    const rev = box.revs[1];
    const r = promote([rev, "--owner-approved", yes(rev)], { FAKE_CORRUPT_SNAPSHOT: "1" });
    expect(r.out).toContain(
      "FAIL the snapshot does not open read-only or fails its integrity check",
    );
    expect(r.out).toContain(
      "the new revision never started, so the live state folder was left as it was",
    );
    expect(r.out).toContain("UNDONE production is back");
    expect(r.status).toBe(1);
    expect(read(fake("docker.log"))).not.toMatch(/compose .* up/);
    expect(readdirSync(box.prodRoot).some((f) => f.startsWith("state.pre-"))).toBe(false);
    expect(jobCount()).toBe(3);
    expect(await status()).toBe(OLD_BUILD);
  });

  it("undoes when the success record cannot be written, and never prints PASS", async () => {
    ready();
    const rev = box.revs[1];
    const r = promote([rev, "--owner-approved", yes(rev)], {
      FAKE_SSH_FAIL_MATCH: "promote-.*\\.txt\\.part",
    });
    expect(r.out).toContain("FAIL could not write the record promote-");
    expect(r.out).toContain("UNDONE production is back");
    expect(r.out).not.toMatch(/^PASS production runs/m);
    expect(r.status).toBe(1);
    expect(promoteLog()).not.toContain(" promoted ");
    expect(await status()).toBe(OLD_BUILD);
  });

  it("reports FAIL and keeps the lock when the container that comes back is not the one that ran before", () => {
    ready();
    const rev = box.revs[1];
    const r = promote([rev, "--owner-approved", yes(rev)], {
      FAKE_BAD_BUILD: "1",
      FLEET_READY_TRIES: "3",
      FAKE_OLD_WRONG_ID: "1",
    });
    expect(r.out).toContain("FAIL the running container is not the one that ran before");
    expect(r.out).toContain("FAIL the undo did not complete");
    expect(r.out).toMatch(
      /A server-side dead-man may be armed until \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/,
    );
    expect(r.out).toContain("promote-records/undo-");
    expect(r.out).toContain("0. claim the decision first");
    expect(r.out).not.toContain("then remove the lock folder");
    expect(r.out).not.toContain("UNDONE");
    expect(r.status).toBe(1);
    expect(existsSync(join(box.prodDeploy, ".promote-lock"))).toBe(true);
  });

  // Tiny synthetic bounds, so a dead-man deadline of 30 s passes the window check (sum 27 + 1).
  const QUICK = {
    FLEET_STOP_SECS: "3",
    FLEET_SNAPSHOT_COPY_SECS: "3",
    FLEET_INTEGRITY_SECS: "3",
    FLEET_START_SECS: "3",
    FLEET_READY_TRIES: "2",
    FLEET_STATUS_TIMEOUT_SECS: "2",
    FLEET_READY_SLEEP: "0",
    FLEET_TLS_SECS: "2",
    FLEET_VERIFY_SECS: "2",
    FLEET_RECORD_SECS: "2",
    FLEET_DEADMAN_MARGIN_SECS: "1",
    FLEET_DEADMAN_SECS: "30",
  };
  const lockDir = () => join(box.prodDeploy, ".promote-lock");
  const localLog = () => {
    const dir = join(dirname(box.conf), "logs");
    return existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith(".log"))
          .map((f) => read(join(dir, f)))
          .join("\n")
      : "";
  };
  const spawnPromote = (rev: string, extra: Record<string, string> = {}, approval = yes(rev)) => {
    const child = spawn("bash", [script(), rev, "--owner-approved", approval], {
      cwd: box.repo,
      env: { ...process.env, ...env(extra) },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const state = { out: "", code: null as number | null, done: false };
    child.stdout.on("data", (d) => (state.out += String(d)));
    child.stderr.on("data", (d) => (state.out += String(d)));
    child.on("close", (c) => {
      state.code = c;
      state.done = true;
    });
    return { child, state };
  };
  // The engine's stop of the old container: the switch is under way on the server.
  const switching = () => /docker stop -t 30/.test(read(fake("docker.log")));
  // SIGKILL to everything on this side (the main part runs in a process group of its own, and its
  // ssh): no trap runs, nothing here helps.
  const killMac = (pid: number) => {
    process.kill(-pid, "SIGKILL");
    spawnSync("pkill", ["-KILL", "-f", script()]);
    spawnSync("pkill", ["-KILL", "-f", "synthetic-server"]);
  };

  it("brings production back from the server alone when this Mac is killed mid-switch (the dead-man)", async () => {
    ready();
    const rev = box.revs[1];
    const { child } = spawnPromote(rev, QUICK);
    await waitFor(switching);
    killMac(child.pid!);
    const lock = lockDir();
    await waitFor(() => existsSync(join(lock, "deadman.done")), 90_000);
    expect(read(join(lock, "decided")).trim()).toBe("deadman");
    expect(read(join(lock, "deadman.log"))).toContain(
      "no pass from the Mac by the deadline: undoing",
    );
    expect(read(join(lock, "undo.rc")).trim()).toBe("0");
    expect(read(join(lock, "deadman.done")).trim()).toBe("ok");
    expect(await status()).toBe(OLD_BUILD);
    expect(jobCount()).toBe(3);
    expect(promoteLog()).toContain(" undone-by-server fleet-hand-started -> ");
    const records = readdirSync(join(box.prodDeploy, "promote-records"));
    expect(records.some((f) => /^undo-\S+\.txt$/.test(f))).toBe(true);
    // Change A: the manual undo was saved at arming, beginning with the claim of the decision.
    const manual = records.find((f) => f.startsWith("manual-undo-")) ?? "x";
    expect(read(join(box.prodDeploy, "promote-records", manual))).toContain(
      "0. claim the decision first",
    );
    // Nobody checked its signed status from the Mac, so the lock stays for a person.
    expect(existsSync(lock)).toBe(true);
    // Fix 4: a second run is refused with the dead-man's time and record path, never told to remove the lock.
    const second = promote([rev, "--owner-approved", yes(rev, 2)]);
    expect(second.status).toBe(1);
    expect(second.out).toMatch(/dead-man may be armed until \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/);
    expect(second.out).toContain("promote-records/undo-");
    expect(second.out).toContain("do not remove the lock while the dead-man may run");
    expect(second.out).not.toMatch(/if none is running, remove/);
  });

  for (const [name, inject] of [
    ["the decision link fails as on a full disk", "ln"],
    ["an empty decided folder is there", "folder"],
  ] as const) {
    it(`keeps the dead-man responsible when ${name} (fix 1)`, async () => {
      ready();
      const rev = box.revs[1];
      const { child } = spawnPromote(rev, { ...QUICK, FAKE_LN_FAIL: inject === "ln" ? "1" : "" });
      await waitFor(switching);
      killMac(child.pid!);
      const lock = lockDir();
      if (inject === "folder") {
        await waitFor(() => existsSync(join(lock, "claim.deadman")));
        mkdirSync(join(lock, "decided"));
      }
      await waitFor(() => existsSync(join(lock, "deadman.done")), 90_000);
      expect(read(join(lock, "deadman.log"))).toContain(
        "no decision could be recorded: this dead-man stays responsible and undoes",
      );
      expect(read(join(lock, "deadman.log"))).not.toContain("disarmed");
      expect(read(join(lock, "undo.rc")).trim()).toBe("0");
      expect(await status()).toBe(OLD_BUILD);
      expect(jobCount()).toBe(3);
    });
  }

  it("says so in promote.log when the dead-man's lock is removed by hand (fix 4)", async () => {
    ready();
    const rev = box.revs[1];
    const { child } = spawnPromote(rev, QUICK);
    await waitFor(switching);
    killMac(child.pid!);
    const lock = lockDir();
    await waitFor(() => existsSync(join(lock, "deadman.pid")));
    rmSync(lock, { recursive: true, force: true });
    await waitFor(() => promoteLog().includes(" deadman-stopped-lock-removed "), 20_000);
    expect(promoteLog()).toContain("nothing was undone by the server; check production by hand");
  });

  it("refuses the pass when the dead-man claimed the undo while the record write was slow (fix 9)", async () => {
    ready();
    const rev = box.revs[1];
    const r = promote([rev, "--owner-approved", yes(rev)], {
      ...QUICK,
      FAKE_SSH_DELAY_MATCH: "promote-.*\\.txt\\.part",
      FAKE_SSH_DELAY: "36",
    });
    expect(r.out).toContain("PASS 3 jobs");
    expect(r.out).toContain(
      "FAIL the server-side dead-man claimed the undo before the pass could be committed",
    );
    expect(r.out).toContain(
      "the server-side dead-man had already claimed the undo; waiting for it",
    );
    expect(r.out).toContain("UNDONE production is back");
    expect(r.out).not.toMatch(/^PASS production runs/m);
    expect(r.status).toBe(1);
    expect(await status()).toBe(OLD_BUILD);
    expect(jobCount()).toBe(3);
    expect(promoteLog()).not.toContain(" promoted ");
    expect(promoteLog()).toContain(" undone-by-server ");
  });

  it("refuses the pass when the dead-man claims between the commit's checks and its claim", async () => {
    ready();
    const rev = box.revs[1];
    const r = promote([rev, "--owner-approved", yes(rev)], { FAKE_DEADMAN_RACE: "1" });
    expect(r.out).toContain(
      "FAIL the server-side dead-man claimed the undo before the pass could be committed",
    );
    expect(r.out).toContain("UNDONE production is back");
    expect(r.out).not.toMatch(/^PASS production runs/m);
    expect(r.status).toBe(1);
    expect(await status()).toBe(OLD_BUILD);
    expect(promoteLog()).toContain(" superseded-by-deadman ");
    expect(
      readdirSync(join(box.prodDeploy, "promote-records")).some((f) =>
        f.endsWith(".txt.superseded"),
      ),
    ).toBe(true);
  });

  for (const [what, ro] of [
    ["the record cannot be published", "records"],
    ["the promote.log line cannot be written", "log"],
  ] as const) {
    it(`undoes when ${what} at the commit, and never prints PASS (fix 8)`, async () => {
      ready();
      const rev = box.revs[1];
      const r = promote([rev, "--owner-approved", yes(rev)], { FAKE_COMMIT_RO: ro });
      expect(r.out).toContain("FAIL the pass could not be committed");
      expect(r.out).toContain("UNDONE production is back");
      expect(r.out).not.toMatch(/^PASS production runs/m);
      expect(r.status).toBe(1);
      expect(await status()).toBe(OLD_BUILD);
      expect(promoteLog()).not.toMatch(/ promoted fleet-hand-started/);
    });
  }

  it("starts the exact bytes that were checked, even if the files change after the check (fix 7)", async () => {
    ready();
    const rev = box.revs[1];
    const r = promote([rev, "--owner-approved", yes(rev)], { FAKE_TAMPER_AT_UP: "1" });
    expect(r.status, r.out).toBe(0);
    // The copies were changed after the check...
    expect(read(join(box.prodDeploy, "compose.resolved.json"))).toContain('"privileged": true');
    // ...but what Compose was given is the checked config, byte for byte.
    const started = readFileSync(fake("compose.started.json"));
    expect(String(started)).not.toContain("privileged");
    expect(read(fake("compose.cfg")).trim()).toBe("-");
    const record =
      readdirSync(join(box.prodDeploy, "promote-records")).find((f) =>
        /^promote-.*\.txt$/.test(f),
      ) ?? "x";
    expect(read(join(box.prodDeploy, "promote-records", record))).toContain(
      `resolved config sha256 ${sha(started)}`,
    );
  });

  it("ends in the undo when a fenced step overruns its bound (fix 6)", async () => {
    ready();
    const rev = box.revs[1];
    const r = promote([rev, "--owner-approved", yes(rev)], {
      FLEET_SNAPSHOT_COPY_SECS: "2",
      FAKE_SLOW_COPY: "6",
    });
    expect(r.out).toContain("FAIL the snapshot copy took longer than 2 seconds");
    expect(r.out).toContain(
      "the new revision never started, so the live state folder was left as it was",
    );
    expect(r.out).toContain("UNDONE production is back");
    expect(r.status).toBe(1);
    expect(await status()).toBe(OLD_BUILD);
    expect(jobCount()).toBe(3);
  });

  it("keeps its output and its undo when Ctrl-C comes during the fenced switch (fix 3)", async () => {
    ready();
    const rev = box.revs[1];
    const { child, state } = spawnPromote(rev);
    await waitFor(switching);
    // Ctrl-C reaches the script and its logger (the terminal's group); the script passes it on.
    process.kill(-child.pid!, "SIGINT");
    await waitFor(() => state.done, 120_000);
    expect(state.code).toBe(130);
    expect(state.out).toContain("UNDONE production is back");
    expect(localLog()).toContain("UNDONE production is back");
    expect(await status()).toBe(OLD_BUILD);
    expect(jobCount()).toBe(3);
  });

  it("keeps logging and undoes when the terminal closes during the fenced switch (SIGHUP)", async () => {
    ready();
    const rev = box.revs[1];
    const { child, state } = spawnPromote(rev);
    await waitFor(switching);
    // A closed terminal hangs up its whole group: the script and its logger. The logger must
    // outlive it, or the rest of the run is lost from the durable log.
    process.kill(-child.pid!, "SIGHUP");
    await waitFor(() => state.done, 120_000);
    expect(state.code).toBe(129);
    expect(localLog()).toContain("UNDONE production is back");
    expect(await status()).toBe(OLD_BUILD);
  });

  it("still claims and runs the undo from this Mac when its logger is killed after arming (fix 2)", async () => {
    ready();
    const rev = box.revs[1];
    const { child, state } = spawnPromote(rev, { FAKE_BAD_BUILD: "1", FLEET_READY_TRIES: "6" });
    await waitFor(() => state.out.includes("dead-man is armed"));
    // The logger is the script's child that stays in the script's process group.
    const kids = spawnSync("pgrep", ["-P", String(child.pid)], { encoding: "utf8" })
      .stdout.trim()
      .split("\n")
      .filter(Boolean);
    const logger = kids.find(
      (k) =>
        spawnSync("ps", ["-o", "pgid=", "-p", k], { encoding: "utf8" }).stdout.trim() ===
        String(child.pid),
    );
    expect(logger).toBeTruthy();
    process.kill(Number(logger), "SIGKILL");
    await waitFor(() => state.done, 120_000);
    expect(state.code).toBe(1);
    expect(await status()).toBe(OLD_BUILD);
    // " undone " is the line the Mac writes when it claimed and ran the undo itself.
    expect(promoteLog()).toContain(" undone fleet-hand-started -> ");
    expect(existsSync(lockDir())).toBe(false);
  });

  for (const name of ["stdout closed", "the reader gone"] as const) {
    it(`still undoes, and logs it durably, with ${name}`, async () => {
      ready();
      const rev = box.revs[1];
      const call = `bash ${JSON.stringify(script())} ${rev} --owner-approved ${JSON.stringify(yes(rev))}`;
      const cmd =
        name === "stdout closed"
          ? `exec 1>&- 2>&-; ${call}`
          : `${call} 2>&1 | head -c 20 >/dev/null; exit "\${PIPESTATUS[0]}"`;
      const r = run(
        box.repo,
        "bash",
        ["-c", cmd],
        env({ FAKE_BAD_BUILD: "1", FLEET_READY_TRIES: "3" }),
      );
      expect(r.status).toBe(1);
      expect(await status()).toBe(OLD_BUILD);
      expect(promoteLog()).toContain(" undone fleet-hand-started -> ");
      const dir = join(dirname(box.conf), "logs");
      const log = readdirSync(dir)
        .filter((f) => f.endsWith(".log"))
        .map((f) => read(join(dir, f)))
        .join("\n");
      expect(log).toContain("FAIL signed status is not ready");
      expect(log).toContain("UNDONE production is back");
    });
  }

  it("promotes again from Compose to Compose, and undoes back to the previous Compose revision", async () => {
    ready();
    const rev = box.revs[1];
    const first = promote([rev, "--owner-approved", yes(rev)]);
    expect(first.status, first.out).toBe(0);
    writeFileSync(join(box.repo, "third.txt"), "third");
    const c = commit("third");
    makeStaged(c);
    const r = promote([c, "--owner-approved", yes(c, 2)], { FAKE_TAMPER_FROZEN: "1" });
    expect(r.out).toContain(`production now: ${rev.slice(0, 7)}`);
    expect(r.out).toContain("FAIL the compose config to start is not the one that was checked");
    expect(r.out).toContain("started the previous production again");
    expect(r.out).toContain(`CHECKED signed status ready, build ${rev.slice(0, 12)}`);
    expect(r.out).toContain(`UNDONE production is back on ${rev.slice(0, 7)}`);
    expect(r.status).toBe(1);
    expect(read(join(box.prodDeploy, "fleet-production.env"))).toContain(`FLEET_REVISION=${rev}`);
    expect(await status()).toBe(rev);
    const ok = promote([c, "--owner-approved", yes(c, 3)]);
    expect(ok.out).toContain(`PASS production runs ${c.slice(0, 7)} (was ${rev.slice(0, 7)})`);
    expect(ok.status, ok.out).toBe(0);
    expect(await status()).toBe(c);
  });
});

// The promoted revision brings its own compose.production.yaml, so the config Compose resolves from
// it is checked against an exact allowlist before production is touched. Synthetic values only.
describe("compose-check.mjs", () => {
  const rev = "b".repeat(40);
  const root = "/srv/synthetic-prod";
  const workers = "worker-a,worker-b";
  const observers = "observer";
  const good = () => ({
    name: "synthetic-prod",
    networks: { default: { name: "synthetic-prod_default", ipam: {} } },
    services: {
      "fleet-runner": {
        cap_drop: ["ALL"],
        command: null,
        entrypoint: null,
        environment: {
          FLEET_BUILD_REF: rev,
          FLEET_INPUT_DIR: "/var/lib/fleet-runner/inputs",
          FLEET_OBSERVERS: observers,
          FLEET_TLS_CERT: "/run/fleet-runner/tls/server.crt",
          FLEET_TLS_KEY: "/run/fleet-runner/tls/server.key",
          FLEET_WORKERS: workers,
        },
        image: `fleet-runner:${rev}`,
        networks: { default: null },
        platform: "linux/amd64",
        ports: [
          {
            mode: "ingress",
            host_ip: "10.0.0.2",
            target: 8787,
            published: "18788",
            protocol: "tcp",
          },
        ],
        read_only: true,
        restart: "unless-stopped",
        security_opt: ["no-new-privileges:true"],
        stop_grace_period: "30s",
        tmpfs: ["/tmp:size=16m,mode=1777"],
        user: "1000:1000",
        volumes: (
          [
            ["state", "/var/lib/fleet-runner/state", false],
            ["output", "/var/lib/fleet-runner/output", false],
            ["inputs", "/var/lib/fleet-runner/inputs", false],
            ["public-keys", "/run/fleet-runner/public-keys", true],
            ["tls", "/run/fleet-runner/tls", true],
          ] as const
        ).map(([name, target, ro]) => ({
          type: "bind",
          source: `${root}/${name}`,
          target,
          ...(ro ? { read_only: true } : {}),
          bind: {},
        })),
      },
    },
  });
  // A fixture that each case tampers with freely.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Cfg = any;
  const check = (cfg: Cfg) => {
    const file = join(box.root, "resolved.json");
    writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
    return run(box.root, "node", [
      join(pkg, "scripts/compose-check.mjs"),
      file,
      "synthetic-prod",
      root,
      "10.0.0.2",
      "18788",
      "1000:1000",
      rev,
      sha(workers),
      sha(observers),
    ]);
  };
  const svc = (cfg: Cfg) => cfg.services["fleet-runner"];

  it("passes production's own shape", () => {
    const r = check(good());
    expect(r.out).toContain(
      "PASS the resolved compose config is exactly production's allowlisted shape",
    );
    expect(r.status).toBe(0);
  });

  it("refuses identity lists that are not production's current ones (a worker moved to observer)", () => {
    const cfg = good();
    svc(cfg).environment.FLEET_WORKERS = "worker-a";
    svc(cfg).environment.FLEET_OBSERVERS = "observer,worker-b";
    const r = check(cfg);
    expect(r.status).toBe(1);
    expect(r.out).toContain("FLEET_WORKERS is not production's current list");
    expect(r.out).toContain("FLEET_OBSERVERS is not production's current list");
    expect(r.out).not.toContain("worker-b");
  });

  const tampered: [string, (cfg: Cfg) => void, string][] = [
    [
      "privileged",
      (c) => {
        svc(c).privileged = true;
      },
      "has privileged, which is not allowed",
    ],
    [
      "an extra cap_add",
      (c) => {
        svc(c).cap_add = ["SYS_ADMIN"];
      },
      "has cap_add, which is not allowed",
    ],
    [
      "an extra volume",
      (c) => {
        svc(c).volumes.push({ type: "bind", source: "/", target: "/host", bind: {} });
      },
      "volumes is not the required value",
    ],
    [
      "a writable key folder",
      (c) => {
        delete svc(c).volumes[3].read_only;
      },
      "volumes is not the required value",
    ],
    [
      "a device",
      (c) => {
        svc(c).devices = [{ source: "/dev/sda", target: "/dev/sda", permissions: "rwm" }];
      },
      "has devices",
    ],
    [
      "host networking",
      (c) => {
        svc(c).network_mode = "host";
      },
      "has network_mode",
    ],
    [
      "another network",
      (c) => {
        c.networks.outside = { external: true };
      },
      "networks has outside",
    ],
    [
      "a writable root file system",
      (c) => {
        svc(c).read_only = false;
      },
      "read_only is not the required value",
    ],
    [
      "no cap_drop",
      (c) => {
        delete svc(c).cap_drop;
      },
      "has no cap_drop",
    ],
    [
      "no no-new-privileges",
      (c) => {
        svc(c).security_opt = [];
      },
      "security_opt is not the required value",
    ],
    [
      "root",
      (c) => {
        svc(c).user = "0:0";
      },
      "user is not the required value",
    ],
    [
      "a second port",
      (c) => {
        svc(c).ports.push({
          mode: "ingress",
          host_ip: "0.0.0.0",
          target: 22,
          published: "2222",
          protocol: "tcp",
        });
      },
      "ports is not the required value",
    ],
    [
      "another image",
      (c) => {
        svc(c).image = "fleet-runner:latest";
      },
      "image is not the required value",
    ],
    [
      "an extra environment variable",
      (c) => {
        svc(c).environment.NODE_OPTIONS = "--inspect=0.0.0.0";
      },
      "environment has NODE_OPTIONS",
    ],
    [
      "another restart policy",
      (c) => {
        svc(c).restart = "always";
      },
      "restart is not the required value",
    ],
    [
      "a top-level volume",
      (c) => {
        c.volumes = { data: {} };
      },
      "the config has volumes",
    ],
    [
      "a second service",
      (c) => {
        c.services.sidecar = { image: "x" };
      },
      "services has sidecar",
    ],
    [
      "a $ Compose would interpolate at start",
      (c) => {
        svc(c).tmpfs = ["/tmp:size=${SIZE}"];
      },
      "holds a $",
    ],
  ];
  it.each(tampered)("refuses %s", (_name, tamper, message) => {
    const cfg = good();
    tamper(cfg);
    const r = check(cfg);
    expect(r.status).toBe(1);
    expect(r.out).toContain(message);
    expect(r.out).not.toContain("PASS");
    // Only key names are printed, never a value from the environment.
    expect(r.out).not.toContain("worker-a");
  });
});

describe("the server-side runner", () => {
  // HelpDesk's first promote failed (safely) because a command in a remote script read the rest of
  // the script from ssh's stdin. Every remote script is read whole before it runs.
  it("cannot be swallowed by a command that reads stdin", () => {
    const lib = join(box.repo, "packages/fleet-runner/scripts/lib/fleet-stage-lib.sh");
    const r = run(
      box.repo,
      "bash",
      [
        "-c",
        `. "${lib}"; NAS_SSH=synthetic-server; nas 'cat >/dev/null\necho "still here $1"' one`,
      ],
      env(),
    );
    expect(r.status).toBe(0);
    expect(r.out).toContain("still here one");
  });
});
