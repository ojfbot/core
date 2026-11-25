import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, afterEach, beforeAll } from "vitest";
import {
  type Box,
  DASH,
  HAND_NAME,
  OLD_BUILD,
  PROJECT,
  destroyBox,
  docker,
  imageId,
  makeBox,
  pkg,
  sha,
  sleep,
} from "./promote-harness.js";

// What the Mac-side test files share: the sandbox fleet-promote.sh runs in. EVERYTHING HERE IS
// SYNTHETIC: the keys, certificates, revisions, folders, addresses and jobs are made by the test
// and mean nothing outside it. The real scripts run from a sandbox git repo (with its own origin);
// `ssh` runs the "server" side locally, under dash, in a sandbox folder; the engine is
// fake-docker.mjs; and every "container" is a real fleet-runner server over TLS from the built
// package, so the signed status calls and the certificate fingerprint are the real ones.
export const GIT_ID = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.test", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.test" };
export const KEYS = ["extra", "observer", "owner", "worker-a", "worker-b"];
export const FAST = { FLEET_B_FIRST: "10", FLEET_B_GO: "10", FLEET_B_COPY: "10", FLEET_B_INTEGRITY: "10", FLEET_B_START: "10", FLEET_B_HEALTH: "12", FLEET_B_EXEC: "10", FLEET_B_EVIDENCE: "60", FLEET_B_UNDO_START: "10", FLEET_B_UNDO_HEALTH: "12", FLEET_B_SETTLE: "1" };

// A fake ssh: the remote command line is read by dash, as a strict server's sh would read it, and
// runs in the sandbox. ssh-faults holds "fail_from=N" (every call from the N-th fails like a lost
// connection), "fail_match=TEXT" (calls whose script holds TEXT fail), "kill_at=N" and
// "kill_when=before|after" (the whole Mac side is killed at the N-th call), and "kill_match=TEXT"
// (the same, at the call whose command line holds TEXT, whichever number it has on this machine).
export const FAKE_SSH = `#!/bin/bash
while [ "$1" = -o ]; do shift 2; done
shift
cmd="$1"
n=$(( $(cat "$FAKE_STATE/ssh.count" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$FAKE_STATE/ssh.count"
printf '%s\\n=====\\n' "$cmd" >> "$FAKE_STATE/ssh-cmds.log"
f="$FAKE_STATE/ssh-faults"
fail_from="$(sed -n 's/^fail_from=//p' "$f" 2>/dev/null)"; kill_at="$(sed -n 's/^kill_at=//p' "$f" 2>/dev/null)"; kill_when="$(sed -n 's/^kill_when=//p' "$f" 2>/dev/null)"
fail_match="$(sed -n 's/^fail_match=//p' "$f" 2>/dev/null)"; kill_match="$(sed -n 's/^kill_match=//p' "$f" 2>/dev/null)"
hit=no; if [ -n "$kill_match" ] && printf '%s' "$cmd" | grep -q -F -e "$kill_match"; then hit=yes; fi
vanish() { echo "$n" > "$FAKE_STATE/mac.killed"; kill -9 -- "-$(cat "$FAKE_STATE/mac.pid")" 2>/dev/null; kill -9 0; }
if [ -n "$fail_from" ] && [ "$n" -ge "$fail_from" ]; then cat > /dev/null; echo "ssh: connection lost" >&2; exit 255; fi
if { [ "$kill_at" = "$n" ] || [ "$hit" = yes ]; } && [ "$kill_when" = before ]; then vanish; fi
in="$(mktemp)"; cat > "$in"
if [ -n "$fail_match" ] && grep -q -e "$fail_match" "$in"; then rm -f "$in"; echo "ssh: connection lost" >&2; exit 255; fi
${DASH} -c "$cmd" < "$in"; rc=$?
rm -f "$in"
if [ "$kill_at" = "$n" ] || [ "$hit" = yes ]; then vanish; fi
exit $rc
`;

export function sh(cwd: string, command: string, args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
// A port nothing listens on, and that no other sandbox of this file was given: the sweeps make
// several sandboxes at once, and two that asked at the same moment could be told the same port.
export const portsGiven = new Set<number>();
export async function freePort(): Promise<number> {
  for (;;) {
    const port = await new Promise<number>((ok, bad) => {
      const s = createServer();
      s.listen(0, "127.0.0.1", () => {
        const { port } = s.address() as { port: number };
        s.close(() => ok(port));
      });
      s.on("error", bad);
    });
    if (portsGiven.has(port)) continue;
    portsGiven.add(port);
    return port;
  }
}

export interface E2E {
  box: Box;
  repo: string;
  conf: string;
  stageDeploy: string;
  revs: string[];
  env: Record<string, string>;
}
export let cache = "";
export const all: E2E[] = [];

/** Call once at the top of a test file: makes the synthetic keys and certificates before its tests, and removes every sandbox after each. */
export function useMacSandboxes() {
  beforeAll(() => {
    // Synthetic keys and two synthetic certificates signed by one synthetic CA, made once.
    cache = mkdtempSync(join(tmpdir(), "fleet-promote-cache-"));
    for (const id of KEYS) {
      const r = sh(cache, "node", [join(pkg, "dist/cli.js"), "keygen", join(cache, `${id}.token`)]);
      if (r.status !== 0) throw new Error(r.out);
    }
    const ssl = (cwd: string, args: string[]) => {
      const r = sh(cwd, "openssl", args);
      if (r.status !== 0) throw new Error(r.out);
    };
    ssl(cache, ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-days", "2", "-subj", "/CN=synthetic-ca", "-keyout", "ca.key", "-out", "ca.crt"]);
    writeFileSync(join(cache, "ext.cnf"), "subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n");
    for (const d of ["tls", "other-tls"]) {
      mkdirSync(join(cache, d));
      ssl(join(cache, d), ["req", "-new", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-subj", "/CN=localhost", "-keyout", "server.key", "-out", "server.csr"]);
      ssl(join(cache, d), ["x509", "-req", "-in", "server.csr", "-CA", "../ca.crt", "-CAkey", "../ca.key", "-CAcreateserial", "-days", "2", "-sha256", "-extfile", "../ext.cnf", "-out", "server.crt"]);
    }
  });
  afterAll(() => rmSync(cache, { recursive: true, force: true }));
  afterEach(() => {
    for (const e of all.splice(0)) destroy(e);
  });
}
export function destroy(e: E2E) {
  const pid = join(e.box.fake, "mac.pid");
  if (existsSync(pid)) {
    try {
      process.kill(-Number(readFileSync(pid, "utf8")), "SIGKILL");
    } catch {}
  }
  destroyBox(e.box);
}

/** A sandbox, with its synthetic production answering. A port found free can be taken in the moment before the server listens on it: then another sandbox is made, on another port. */
export async function setup(opts: { rehearsal?: boolean; track?: boolean } = {}): Promise<E2E> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await setupOnce(opts);
    } catch (err) {
      if (attempt === 3 || !String(err).includes("does not answer")) throw err;
    }
  }
}
export async function setupOnce(opts: { rehearsal?: boolean; track?: boolean } = {}): Promise<E2E> {
  const port = await freePort();
  const box = makeBox({
    rehearsal: opts.rehearsal,
    port,
    // Three synthetic jobs in production's store, the real store.
    seed: (db) => {
      const seed = sh(tmpdir(), "node", [
        "--input-type=module",
        "-e",
        `const { JobStore } = await import(${JSON.stringify(`${pkg}/dist/jobs.js`)}); const s = new JobStore(process.argv[1]); for (let i = 0; i < 3; i++) s.enqueue({ kind: "proof-fixture", inputs: ["${"a".repeat(63)}" + i], payload: null }); s.close();`,
        db,
      ]);
      if (seed.status !== 0) throw new Error(seed.out);
    },
  });
  const root = box.root;
  const repo = join(root, "repo");
  const confDir = join(root, "conf");
  const stageDeploy = join(root, "server/stage-deploy");
  for (const d of [join(root, "stage-keys"), join(root, "prodkeys"), stageDeploy, join(root, "server/stage-root"), confDir]) mkdirSync(d, { recursive: true });
  for (const d of [join(root, "stage-keys"), join(root, "prodkeys"), confDir]) chmodSync(d, 0o700);
  for (const f of readdirSync(join(box.prodRoot, "public-keys"))) rmSync(join(box.prodRoot, "public-keys", f));
  for (const id of KEYS) cpSync(join(cache, `${id}.token.pub`), join(box.prodRoot, "public-keys", `${id}.pub`));
  cpSync(join(cache, "observer.token"), join(root, "prodkeys/observer.token"));
  cpSync(join(cache, "ca.crt"), join(root, "prodkeys/ca.crt"));
  for (const f of ["server.crt", "server.key"]) cpSync(join(cache, "tls", f), join(box.prodRoot, "tls", f));
  // Every "container" from here on is a real TLS server of the built package.
  writeFileSync(
    join(box.fake, "service.json"),
    JSON.stringify({ argv: ["node", join(pkg, "src/__tests__/fakes/fake-server.mjs")], env: { FAKE_PKG: pkg, FAKE_PROD_PORT: String(port), FAKE_OTHER_CERT_DIR: join(cache, "other-tls") } }),
  );
  // The sandbox repo: the real scripts and deploy files, committed, with an origin at the same main.
  const target = join(repo, "packages/fleet-runner");
  mkdirSync(target, { recursive: true });
  cpSync(join(pkg, "scripts"), join(target, "scripts"), { recursive: true });
  cpSync(join(pkg, "deploy"), join(target, "deploy"), { recursive: true });
  symlinkSync(join(pkg, "dist"), join(target, "dist"));
  writeFileSync(join(repo, ".gitignore"), "packages/fleet-runner/dist\n");
  const git = (...a: string[]) => {
    const r = sh(repo, "git", a, GIT_ID);
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
  sh(root, "git", ["clone", "-q", "--bare", repo, join(root, "origin.git")]);
  git("remote", "add", "origin", join(root, "origin.git"));
  git("fetch", "-q", "origin");
  writeFileSync(join(box.bin, "ssh"), FAKE_SSH);
  chmodSync(join(box.bin, "ssh"), 0o755);
  // The server's sh is dash here, the strictest there is.
  symlinkSync(DASH, join(box.bin, "sh"));
  const conf = join(confDir, "stage.conf");
  writeFileSync(
    conf,
    [
      "NAS_SSH=synthetic-server",
      `NAS_STAGE_DIR=${stageDeploy}`,
      `NAS_STAGE_ROOT=${join(root, "server/stage-root")}`,
      "STAGE_LAN_IP=127.0.0.1",
      `STAGE_PORT=${port + 1}`,
      "STAGE_HOST=localhost",
      `STAGE_KEYS_DIR=${join(root, "stage-keys")}`,
      `PROD_PORT=${port}`,
      `PROD_CONTAINER=${HAND_NAME}`,
      `PROD_PROJECT=${PROJECT}`,
      `NAS_PROD_DIR=${box.ctl}`,
      `NAS_PROD_ROOT=${box.prodRoot}`,
      `PROD_KEYS_DIR=${join(root, "prodkeys")}`,
      `PROD_KEY_IDS="${KEYS.join(" ")}"`,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  const e: E2E = {
    box,
    repo,
    conf,
    stageDeploy,
    revs,
    env: { ...box.env, FLEET_STAGE_CONF: conf, FLEET_POLL_SECS: "0.3", FLEET_STATUS_TIMEOUT_SECS: "3", FLEET_UNDO_STATUS_SECS: "20", ...FAST },
  };
  if (opts.track !== false) all.push(e);
  // The hand-started production, now a real server answering as the old build.
  docker(box, ["stop", "-t", "1", HAND_NAME]);
  docker(box, ["start", HAND_NAME]);
  for (let i = 0; i < 60 && statusNow(e) !== OLD_BUILD; i += 1) await sleep(200);
  if (statusNow(e) !== OLD_BUILD) {
    if (all.includes(e)) all.splice(all.indexOf(e), 1);
    destroy(e);
    throw new Error("the synthetic production does not answer");
  }
  writeFileSync(join(box.fake, "docker.log"), "");
  for (const rev of revs) staged(e, rev);
  return e;
}
export function statusNow(e: E2E): string {
  const r = spawnSync("node", [join(pkg, "scripts/stage-smoke.mjs"), "build"], {
    encoding: "utf8",
    env: { ...process.env, STAGE_URL: `https://localhost:${e.box.port}`, STAGE_KEYS_DIR: join(e.box.root, "prodkeys"), STAGE_STATUS_ID: "observer", NODE_EXTRA_CA_CERTS: join(e.box.root, "prodkeys/ca.crt"), STAGE_TIMEOUT_MS: "3000" },
  });
  return r.status === 0 ? (JSON.parse(r.stdout).build as string) : "";
}
/** A synthetic staged release of <rev>, the image the engine "loaded" for it, and this Mac's receipt. */
export function staged(e: E2E, rev: string, receipt = true) {
  const dir = join(e.stageDeploy, "releases", rev);
  mkdirSync(dir, { recursive: true });
  const archive = Buffer.from(`synthetic archive of ${rev}\n`);
  writeFileSync(join(dir, "fleet-runner-image.tar"), archive);
  const json = `${JSON.stringify({ revision: rev, tag: `fleet-runner:${rev}`, image_id: imageId(rev), manifest_digest: `sha256:${sha(`manifest ${rev}`)}`, archive_sha256: sha(archive) }, null, 2)}\n`;
  writeFileSync(join(dir, "release.json"), json);
  if (receipt) {
    mkdirSync(join(dirname(e.conf), "receipts"), { recursive: true, mode: 0o700 });
    writeFileSync(
      join(dirname(e.conf), "receipts", `${rev}.receipt`),
      [`revision=${rev}`, `tag=fleet-runner:${rev}`, `image_id=${imageId(rev)}`, `manifest_digest=sha256:${sha(`manifest ${rev}`)}`, `archive_sha256=${sha(archive)}`, `release_json_sha256=${sha(json)}`, "stage_run=synthetic", ""].join("\n"),
    );
  }
  writeFileSync(join(e.stageDeploy, "stage-state"), `last_passed=${rev}\nstaged_ok=${rev}\n`);
}
export const yes = (what: string, n = 1) => `Yes, put ${what} live (synthetic approval ${"again ".repeat(n)})`;
export const script = (e: E2E) => join(e.repo, "packages/fleet-runner/scripts/fleet-promote.sh");
export function promote(e: E2E, args: string[], extra: Record<string, string> = {}) {
  return sh(e.repo, "bash", [script(e), ...args], { ...e.env, ...extra });
}
/** Start the Mac side in a group of its own, so the whole of it can be killed. */
export function promoteAsync(e: E2E, args: string[], extra: Record<string, string> = {}) {
  let out = "";
  const child = spawn("bash", [script(e), ...args], { cwd: e.repo, env: { ...e.env, ...extra }, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  writeFileSync(join(e.box.fake, "mac.pid"), String(child.pid));
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  let status: number | null = null;
  const done = new Promise<void>((ok) =>
    child.once("close", (code) => {
      status = code;
      ok();
    }),
  );
  return { pid: child.pid as number, done, out: () => out, status: () => status };
}
export const ops = (e: E2E) => (existsSync(e.box.runs) ? readdirSync(e.box.runs).sort() : []);
export const lastOp = (e: E2E) => ops(e).pop() as string;
export const macLog = (e: E2E) => {
  const dir = join(dirname(e.conf), "logs");
  // Only the logs: a Mac that was killed leaves its logger's FIFO there, and reading a FIFO never returns.
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".log"))
        .map((f) => readFileSync(join(dir, f), "utf8"))
        .join("\n")
    : "";
};
export const sshCmds = (e: E2E) => (existsSync(join(e.box.fake, "ssh-cmds.log")) ? readFileSync(join(e.box.fake, "ssh-cmds.log"), "utf8") : "");
export const sshCount = (e: E2E) => Number(existsSync(join(e.box.fake, "ssh.count")) ? readFileSync(join(e.box.fake, "ssh.count"), "utf8") : "0");
export const setSsh = (e: E2E, lines: string[]) => writeFileSync(join(e.box.fake, "ssh-faults"), `${lines.join("\n")}\n`);
/** The revision the tests promote: the sandbox repo's HEAD, staged in setup. */
export const headRev = (e: E2E) => e.revs[e.revs.length - 1] as string;
