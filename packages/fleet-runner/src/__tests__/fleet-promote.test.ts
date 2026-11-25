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
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  type Box,
  DASH,
  GUARD,
  HAND_NAME,
  OLD_BUILD,
  PROJECT,
  alive,
  containers,
  destroyBox,
  docker,
  dockerLog,
  field,
  imageId,
  jobsIn,
  journal,
  lockIsFree,
  makeBox,
  opDir,
  pkg,
  reality,
  record,
  records,
  setFaults,
  sha,
  sleep,
  states,
} from "./fakes/promote-harness.js";

// fleet-promote.sh end to end, without a server or a real engine. EVERYTHING HERE IS SYNTHETIC: the
// keys, certificates, revisions, folders, addresses and jobs are made by the test and mean nothing
// outside it. The real scripts run from a sandbox git repo (with its own origin); `ssh` runs the
// "server" side locally, under dash, in a sandbox folder; the engine is fake-docker.mjs; and every
// "container" is a real fleet-runner server over TLS from the built package, so the signed status
// calls and the certificate fingerprint are the real ones.
vi.setConfig({ testTimeout: 400_000 });
const GIT_ID = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.test", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.test" };
const KEYS = ["extra", "observer", "owner", "worker-a", "worker-b"];
const FAST = { FLEET_B_FIRST: "10", FLEET_B_GO: "10", FLEET_B_COPY: "10", FLEET_B_INTEGRITY: "10", FLEET_B_START: "10", FLEET_B_HEALTH: "12", FLEET_B_EXEC: "10", FLEET_B_EVIDENCE: "60", FLEET_B_UNDO_START: "10", FLEET_B_UNDO_HEALTH: "12", FLEET_B_SETTLE: "1" };

// A fake ssh: the remote command line is read by dash, as a strict server's sh would read it, and
// runs in the sandbox. ssh-faults holds "fail_from=N" (every call from the N-th fails like a lost
// connection), "fail_match=TEXT" (calls whose script holds TEXT fail), "kill_at=N" and
// "kill_when=before|after" (the whole Mac side is killed at the N-th call).
const FAKE_SSH = `#!/bin/bash
while [ "$1" = -o ]; do shift 2; done
shift
cmd="$1"
n=$(( $(cat "$FAKE_STATE/ssh.count" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$FAKE_STATE/ssh.count"
printf '%s\\n=====\\n' "$cmd" >> "$FAKE_STATE/ssh-cmds.log"
f="$FAKE_STATE/ssh-faults"
fail_from="$(sed -n 's/^fail_from=//p' "$f" 2>/dev/null)"; kill_at="$(sed -n 's/^kill_at=//p' "$f" 2>/dev/null)"; kill_when="$(sed -n 's/^kill_when=//p' "$f" 2>/dev/null)"
fail_match="$(sed -n 's/^fail_match=//p' "$f" 2>/dev/null)"
vanish() { echo "$n" > "$FAKE_STATE/mac.killed"; kill -9 -- "-$(cat "$FAKE_STATE/mac.pid")" 2>/dev/null; kill -9 0; }
if [ -n "$fail_from" ] && [ "$n" -ge "$fail_from" ]; then cat > /dev/null; echo "ssh: connection lost" >&2; exit 255; fi
if [ "$kill_at" = "$n" ] && [ "$kill_when" = before ]; then vanish; fi
in="$(mktemp)"; cat > "$in"
if [ -n "$fail_match" ] && grep -q -e "$fail_match" "$in"; then rm -f "$in"; echo "ssh: connection lost" >&2; exit 255; fi
${DASH} -c "$cmd" < "$in"; rc=$?
rm -f "$in"
if [ "$kill_at" = "$n" ]; then vanish; fi
exit $rc
`;

function sh(cwd: string, command: string, args: string[], env: Record<string, string> = {}) {
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

interface E2E {
  box: Box;
  repo: string;
  conf: string;
  stageDeploy: string;
  revs: string[];
  env: Record<string, string>;
}
let cache = "";
const all: E2E[] = [];

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
function destroy(e: E2E) {
  const pid = join(e.box.fake, "mac.pid");
  if (existsSync(pid)) {
    try {
      process.kill(-Number(readFileSync(pid, "utf8")), "SIGKILL");
    } catch {}
  }
  destroyBox(e.box);
}

async function setup(opts: { rehearsal?: boolean; track?: boolean } = {}): Promise<E2E> {
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
  if (statusNow(e) !== OLD_BUILD) throw new Error("the synthetic production does not answer");
  writeFileSync(join(box.fake, "docker.log"), "");
  for (const rev of revs) staged(e, rev);
  return e;
}
function statusNow(e: E2E): string {
  const r = spawnSync("node", [join(pkg, "scripts/stage-smoke.mjs"), "build"], {
    encoding: "utf8",
    env: { ...process.env, STAGE_URL: `https://localhost:${e.box.port}`, STAGE_KEYS_DIR: join(e.box.root, "prodkeys"), STAGE_STATUS_ID: "observer", NODE_EXTRA_CA_CERTS: join(e.box.root, "prodkeys/ca.crt"), STAGE_TIMEOUT_MS: "3000" },
  });
  return r.status === 0 ? (JSON.parse(r.stdout).build as string) : "";
}
/** A synthetic staged release of <rev>, the image the engine "loaded" for it, and this Mac's receipt. */
function staged(e: E2E, rev: string, receipt = true) {
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
const yes = (what: string, n = 1) => `Yes, put ${what} live (synthetic approval ${"again ".repeat(n)})`;
const script = (e: E2E) => join(e.repo, "packages/fleet-runner/scripts/fleet-promote.sh");
function promote(e: E2E, args: string[], extra: Record<string, string> = {}) {
  return sh(e.repo, "bash", [script(e), ...args], { ...e.env, ...extra });
}
/** Start the Mac side in a group of its own, so the whole of it can be killed. */
function promoteAsync(e: E2E, args: string[], extra: Record<string, string> = {}) {
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
const ops = (e: E2E) => (existsSync(e.box.runs) ? readdirSync(e.box.runs).sort() : []);
const lastOp = (e: E2E) => ops(e).pop() as string;
const macLog = (e: E2E) => {
  const dir = join(dirname(e.conf), "logs");
  // Only the logs: a Mac that was killed leaves its logger's FIFO there, and reading a FIFO never returns.
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".log"))
        .map((f) => readFileSync(join(dir, f), "utf8"))
        .join("\n")
    : "";
};
const sshCmds = (e: E2E) => (existsSync(join(e.box.fake, "ssh-cmds.log")) ? readFileSync(join(e.box.fake, "ssh-cmds.log"), "utf8") : "");
const sshCount = (e: E2E) => Number(existsSync(join(e.box.fake, "ssh.count")) ? readFileSync(join(e.box.fake, "ssh.count"), "utf8") : "0");
const setSsh = (e: E2E, lines: string[]) => writeFileSync(join(e.box.fake, "ssh-faults"), `${lines.join("\n")}\n`);
/** The revision the tests promote: the sandbox repo's HEAD, staged in setup. */
const headRev = (e: E2E) => e.revs[e.revs.length - 1] as string;

describe("fleet-promote.sh refuses before anything changes", () => {
  it("without the owner's yes, with a yes that does not name the revision, or that names another commit; a dated sentence is fine", async () => {
    const e = await setup();
    const head = headRev(e);
    const [a] = e.revs as [string];
    const none = promote(e, [head]);
    expect(none.status).toBe(3);
    expect(none.out).toContain("needs the owner's yes");
    expect(promote(e, [head, "--owner-approved", "   "]).status).toBe(3);
    const vague = promote(e, [head, "--owner-approved", "Yes, go ahead"]);
    expect(vague.out).toContain("must name the revision it approves");
    const other = promote(e, [head, "--owner-approved", `Yes, promote ${a.slice(0, 7)}`]);
    expect(other.out).toMatch(/the approval names [0-9a-f]{7}, which is [0-9a-f]{12}, not/);
    // A branch named like a short commit ID must not redirect the promote.
    sh(e.repo, "git", ["branch", a.slice(0, 7), head]);
    const redirected = promote(e, [a.slice(0, 7), "--owner-approved", `Yes, promote ${a.slice(0, 7)}`]);
    expect(redirected.out).toMatch(/does not start with it|unknown commit|must be a commit ID|refname .* is ambiguous/);
    expect(redirected.status).not.toBe(0);
    for (const r of [none, vague, other, redirected]) expect(r.out).not.toContain("PASS production runs");
    expect(ops(e)).toEqual([]);
    expect(dockerLog(e.box)).toEqual([]);
    // A hex-looking word that names no commit (a date) is ignored: this approval passes the gate
    // and the run is refused later only because the checkout is not clean.
    writeFileSync(join(e.repo, "untracked.txt"), "x");
    const dated = promote(e, [head, "--owner-approved", `Yes, promote ${head.slice(0, 9)} on 20261125, feedback welcome`]);
    expect(dated.out).toContain("this checkout has uncommitted changes");
  });

  it("a revision that is not staged, has no receipt on this Mac, or whose server release is not the one this Mac verified", async () => {
    const e = await setup();
    const head = headRev(e);
    writeFileSync(join(e.stageDeploy, "stage-state"), `last_passed=${head}\nstaged_ok=\n`);
    expect(promote(e, [head, "--owner-approved", yes(head)]).out).toContain("is not staged");
    staged(e, head, false);
    rmSync(join(dirname(e.conf), "receipts", `${head}.receipt`));
    expect(promote(e, [head, "--owner-approved", yes(head)]).out).toContain("this Mac has no receipt");
    staged(e, head);
    writeFileSync(join(e.stageDeploy, "releases", head, "release.json"), "{}\n");
    expect(promote(e, [head, "--owner-approved", yes(head)]).out).toContain("is not the one this Mac verified");
    expect(ops(e)).toEqual([]);
    expect(reality(e.box).running.map((c) => c.name)).toEqual([HAND_NAME]);
  });

  it("a Compose file that drops the hardening: refused by the allowlist on this Mac, before the decider is started", async () => {
    const e = await setup();
    const f = join(e.repo, "packages/fleet-runner/deploy/compose.production.yaml");
    writeFileSync(f, readFileSync(f, "utf8").replace("read_only: true", "read_only: false\n    privileged: true"));
    sh(e.repo, "git", ["commit", "-q", "-am", "a weaker compose file"], GIT_ID);
    sh(e.repo, "git", ["push", "-q", "origin", "main"]);
    const head = sh(e.repo, "git", ["rev-parse", "HEAD"]).out.trim();
    staged(e, head);
    const r = promote(e, [head, "--owner-approved", yes(head)]);
    expect(r.out).toContain("is not production's allowlisted shape; nothing was changed");
    expect(r.status).toBe(1);
    expect(journal(e.box, lastOp(e))).toEqual([]);
    expect(reality(e.box).running.map((c) => c.name)).toEqual([HAND_NAME]);
    // The decider of that run was never started: its folder holds no plan and no journal.
    expect(existsSync(join(opDir(e.box, lastOp(e)), "plan"))).toBe(false);
  });

  it("an impossible bound is refused here, with the decider's own arithmetic, before a plan is uploaded", async () => {
    const e = await setup();
    const head = headRev(e);
    const r = promote(e, [head, "--owner-approved", yes(head)], { FLEET_B_EVIDENCE: "20" });
    expect(r.out).toContain("REFUSED b_evidence must be at least 60 seconds");
    expect(r.out).toContain("the bounds are not possible; nothing was changed");
    expect(existsSync(join(opDir(e.box, lastOp(e)), "plan"))).toBe(false);
  });
});

describe("fleet-promote.sh end to end", () => {
  it("promotes: prints the bounds before the yes is spent, sends go and evidence, prints PASS only from the decider's record; then a second promote and a revert", async () => {
    const e = await setup();
    const head = headRev(e);
    const r = promote(e, [head, "--owner-approved", yes(head)]);
    const op = lastOp(e);
    expect(r.out).toContain(`PASS production runs ${head.slice(0, 7)} (was the hand-started container (build ${OLD_BUILD.slice(0, 12)})), by the decider's record promote-records/promote-${op}.txt:`);
    expect(r.status).toBe(0);
    expect(statusNow(e)).toBe(head);
    // The table and the worst case come before the decider is started, so before the yes is spent.
    expect(r.out.indexOf("worst case, production offline or on an unconfirmed build:")).toBeGreaterThan(-1);
    expect(r.out.indexOf("worst case, production offline")).toBeLessThan(r.out.indexOf("the owner's yes is spent"));
    expect(r.out).toContain("10  this Mac waits for the decider's first journal line");
    expect(r.out).toContain("this Mac: the signed status answers ready, build");
    expect(r.out).toContain("this Mac: the same TLS certificate");
    expect(r.out).toContain("COMMITTED on the server");
    expect(field(e.box, op, "done", "outcome")).toBe("pass");
    // Nothing private in what the Mac printed or logged: no folder, no address, no port, no ssh name.
    for (const text of [r.out, macLog(e)]) for (const secret of [e.box.root, tmpdir(), "127.0.0.1", "synthetic-server", String(e.box.port), "localhost"]) expect(text).not.toContain(secret);
    expect(macLog(e)).toContain("PASS production runs");
    // This Mac's receipt of what it checked for this run.
    const receipt = readFileSync(join(dirname(e.conf), "receipts", `promote-${op}.receipt`), "utf8");
    expect(receipt).toContain(`resolved_sha256=${field(e.box, op, "verified", "cfg")}`);
    expect(receipt).toContain(`prev_build=${OLD_BUILD}`);
    // Every argument that crossed to the server was one plain line; scripts went on stdin.
    expect(sshCmds(e)).not.toContain("$'");
    for (const cmd of sshCmds(e).split("\n=====\n")) expect(cmd.trim().split("\n").length).toBeLessThanOrEqual(1);

    // A later promote: Compose to Compose, checked against this Mac's receipt of the run before.
    writeFileSync(join(e.repo, "third.txt"), "third");
    sh(e.repo, "git", ["add", "-A"]);
    sh(e.repo, "git", ["commit", "-q", "-m", "third"], GIT_ID);
    sh(e.repo, "git", ["push", "-q", "origin", "main"]);
    const next = sh(e.repo, "git", ["rev-parse", "HEAD"]).out.trim();
    staged(e, next);
    const again = promote(e, [next, "--owner-approved", yes(head)]);
    expect(again.out).toMatch(/the approval names [0-9a-f]+, which is [0-9a-f]{12}, not/);
    const second = promote(e, [next, "--owner-approved", yes(next)]);
    expect(second.out).toContain(`PASS production runs ${next.slice(0, 7)} (was ${head.slice(0, 7)} (run ${op}))`);
    expect(statusNow(e)).toBe(next);
    const op2 = lastOp(e);

    // status, read-only, from this Mac.
    const st = promote(e, ["status", op2]);
    expect(st.out).toContain("outcome: PASSED");
    expect(st.out).toContain("not a statement about what production runs now");

    // A revert: its own yes, naming the run whole.
    const vague = promote(e, ["revert", op2, "--owner-approved", "Yes, revert it"]);
    expect(vague.out).toContain(`must name the run it reverts (${op2})`);
    const rv = promote(e, ["revert", op2, "--owner-approved", `Yes, revert ${op2} (synthetic)`]);
    expect(rv.out).toMatch(/jobs: production holds \d+ now, the snapshot of run .* holds 3/);
    expect(rv.out).toContain("REVERTED by the decider");
    expect(rv.out).toContain(`CHECKED from this Mac: the signed status answers ready, build ${head.slice(0, 12)}, as before`);
    expect(rv.status).toBe(0);
    expect(statusNow(e)).toBe(head);
    expect(field(e.box, op2, "done", "outcome")).toBe("pass");
  });

  it("PASS needs the decider's record, read: a journal that says 'done pass' is not enough on its own", async () => {
    const e = await setup();
    const head = headRev(e);
    // The record cannot be read back (the connection fails for exactly that call).
    setSsh(e, ['fail_match=promote-records/promote-$2.txt']);
    const r = promote(e, [head, "--owner-approved", yes(head)]);
    const op = lastOp(e);
    expect(field(e.box, op, "done", "outcome")).toBe("pass");
    expect(r.out).not.toContain("PASS production runs");
    expect(r.out).toContain("FAIL the journal says the pass is done, but its record could not be read: not reported as PASS.");
    expect(r.status).toBe(1);
    setSsh(e, []);
    expect(promote(e, ["status", op]).out).toContain("outcome: PASSED");
  });

  it("without this Mac's receipt of the run production is on, a later promote is refused", async () => {
    const e = await setup();
    const head = headRev(e);
    expect(promote(e, [head, "--owner-approved", yes(head)]).status).toBe(0);
    const op = lastOp(e);
    rmSync(join(dirname(e.conf), "receipts", `promote-${op}.receipt`));
    writeFileSync(join(e.repo, "third.txt"), "third");
    sh(e.repo, "git", ["add", "-A"]);
    sh(e.repo, "git", ["commit", "-q", "-m", "third"], GIT_ID);
    sh(e.repo, "git", ["push", "-q", "origin", "main"]);
    const next = sh(e.repo, "git", ["rev-parse", "HEAD"]).out.trim();
    staged(e, next);
    const r = promote(e, [next, "--owner-approved", yes(next)]);
    expect(r.out).toContain(`this Mac has no receipt of run ${op}`);
    expect(statusNow(e)).toBe(head);
  });

  it("a new revision that answers as another build, or with another certificate: the decider undoes; the Mac prints UNDONE and its own check, never PASS", async () => {
    for (const fault of ["FAKE_BAD_BUILD_FOR", "FAKE_OTHER_CERT_FOR"]) {
      const e = await setup();
      const head = headRev(e);
      const service = JSON.parse(readFileSync(join(e.box.fake, "service.json"), "utf8"));
      service.env[fault] = imageId(head);
      writeFileSync(join(e.box.fake, "service.json"), JSON.stringify(service));
      const r = promote(e, [head, "--owner-approved", yes(head)]);
      const op = lastOp(e);
      expect(r.status, fault).toBe(1);
      expect(r.out, fault).not.toContain("PASS production runs");
      expect(r.out, fault).toContain("UNDONE by the decider (record promote-records/undo-");
      expect(r.out, fault).toContain(`CHECKED from this Mac: the signed status answers ready, build ${OLD_BUILD.slice(0, 12)}, as before`);
      expect(r.out, fault).toContain(`${head.slice(0, 7)} was NOT promoted.`);
      expect(field(e.box, op, "undoing", "reason"), fault).toBe(fault === "FAKE_BAD_BUILD_FOR" ? "client-reported-failure" : "certificate-changed");
      expect(statusNow(e), fault).toBe(OLD_BUILD);
      expect(jobsIn(join(e.box.prodRoot, "state/fleet.sqlite")), fault).toBe(3);
      expect(records(e.box), fault).toEqual([`undo-${op}.txt`]);
    }
  });

  it("the rehearsal's forced failure needs a throwaway production, and ends in the undo", async () => {
    const real = await setup();
    const h1 = headRev(real);
    expect(promote(real, [h1, "--owner-approved", yes(h1)], { FLEET_PROMOTE_FAULT: "health" }).out).toContain("FLEET_PROMOTE_FAULT needs --rehearsal");
    expect(promote(real, [h1, "--owner-approved", yes(h1), "--rehearsal"], { FLEET_PROMOTE_FAULT: "health" }).out).toContain("--rehearsal is only for a throwaway production");
    expect(ops(real)).toEqual([]);
    const e = await setup({ rehearsal: true });
    const head = headRev(e);
    const r = promote(e, [head, "--owner-approved", yes(head), "--rehearsal"], { FLEET_PROMOTE_FAULT: "health" });
    expect(r.out).toContain("REHEARSAL: this Mac's evidence will be made to fail (health)");
    expect(r.out).toContain("UNDONE by the decider");
    expect(field(e.box, lastOp(e), "undoing", "reason")).toBe("wrong-build");
    expect(statusNow(e)).toBe(OLD_BUILD);
  });

  it("an approval used once is refused the second time, by the decider's own check, before anything changes", async () => {
    const e = await setup({ rehearsal: true });
    const head = headRev(e);
    const words = yes(head);
    const first = promote(e, [head, "--owner-approved", words, "--rehearsal"], { FLEET_PROMOTE_FAULT: "health" });
    expect(first.out).toContain("UNDONE by the decider");
    const before = dockerLog(e.box).filter((l) => /^(stop|start|rm|compose .* up)/.test(l)).length;
    const second = promote(e, [head, "--owner-approved", words.toUpperCase().replace(head.toUpperCase(), head), "--rehearsal"]);
    expect(second.out).toContain("REFUSED this approval was already used: each yes covers one operation");
    expect(second.out).toContain("the decider's checks refuse this promote; nothing was changed");
    expect(dockerLog(e.box).filter((l) => /^(stop|start|rm|compose .* up)/.test(l)).length).toBe(before);
    expect(journal(e.box, lastOp(e))).toEqual([]);
  });

  it("the lock is held by someone else: the Mac says a holder exists (the decider, or a step), that nothing was changed, and gives no advice to remove anything", async () => {
    const e = await setup();
    const head = headRev(e);
    const holder = spawn(DASH, ["-c", `exec 9< "$1"; perl "$2" lock 9 || exit 1; exec sleep 60`, "sh", e.box.ctl, GUARD], { stdio: "ignore" });
    while (lockIsFree(e.box)) await sleep(50);
    const r = promote(e, [head, "--owner-approved", yes(head)]);
    holder.kill("SIGKILL");
    expect(r.status).toBe(1);
    expect(r.out).toContain("REFUSED another promote, recover or revert holds the lock: its decider, or a step it started that is still running. Nothing was changed.");
    expect(r.out).toMatch(/holding it: process \d+ sleep/);
    expect(r.out).toContain("REFUSED the decider did not begin: nothing was changed in production by this run.");
    // From the refusal on, nothing tells anyone to remove or delete anything (the table of bounds,
    // printed earlier, names the undo's own removal of the new revision).
    expect(r.out.slice(r.out.indexOf("REFUSED another promote"))).not.toMatch(/\b(remove|delete)\b/i);
    expect(r.out).not.toMatch(/holding it: process \d+ (sed|perl|sh|dash)\b/);
    expect(r.out).not.toContain("PASS production runs");
    expect(journal(e.box, lastOp(e))).toEqual([]);
    expect(statusNow(e)).toBe(OLD_BUILD);
  });

  it("Ctrl-C after the start is a request, not a decision: 'interruption requested; outcome pending', then the outcome as the decider recorded it", async () => {
    const e = await setup();
    const head = headRev(e);
    const m = promoteAsync(e, [head, "--owner-approved", yes(head)]);
    while (!m.out().includes("the previous production is stopped") && m.status() === null) await sleep(50);
    process.kill(-m.pid, "SIGINT");
    await m.done;
    const out = m.out();
    const op = lastOp(e);
    expect(out).toContain("interruption requested; outcome pending");
    expect(out).not.toMatch(/told the server to undo/i);
    expect(out).not.toContain("PASS production runs");
    expect(out).toContain("UNDONE by the decider");
    expect(field(e.box, op, "undoing", "reason")).toBe("client-reported-failure");
    expect(m.status()).toBe(1);
    expect(statusNow(e)).toBe(OLD_BUILD);
  });
});

describe("fleet-promote.sh when the Mac goes away", () => {
  it("the Mac cannot reach the server any more: it says what it last read, never PASS, never anything about a lock; the decider undoes alone", async () => {
    const e = await setup();
    const head = headRev(e);
    const m = promoteAsync(e, [head, "--owner-approved", yes(head)], { FLEET_MAC_WAIT_SECS: "25" });
    while (!m.out().includes("the previous production is stopped") && m.status() === null) await sleep(50);
    setSsh(e, ["fail_from=1"]);
    await m.done;
    const out = m.out();
    const op = lastOp(e);
    expect(m.status()).toBe(1);
    expect(out).toContain("this Mac cannot reach the server; it keeps trying (the decider does not need this Mac to decide)");
    expect(out).toContain("UNKNOWN this Mac did not read the outcome. This is NOT a pass.");
    expect(out).toMatch(/Last read from the server: "\w[\w-]*" at \d{4}-/);
    expect(out).toContain("This Mac's evidence was not delivered. Without it the decider undoes by itself when its window closes (an estimate:");
    expect(out).toContain(`sh promote-runs/${op}/decider.sh recover ${op}`);
    expect(out).toContain(`scripts/fleet-promote.sh status ${op}`);
    expect(out).not.toContain("PASS production runs");
    expect(out).not.toMatch(/\block\b/i);
    for (const secret of [e.box.root, "synthetic-server"]) expect(out).not.toContain(secret);
    // The decider, alone: no evidence in its window, so it undoes. No second decider was needed.
    for (let i = 0; i < 900 && field(e.box, op, "done", "outcome") === ""; i++) await sleep(100);
    expect(field(e.box, op, "undoing", "reason")).toBe("no-evidence");
    expect(field(e.box, op, "done", "outcome")).toBe("undone");
    expect(statusNow(e)).toBe(OLD_BUILD);
    setSsh(e, []);
    expect(promote(e, ["status", op]).out).toContain("outcome: undone");
  });

  it("the whole Mac side killed at EVERY call it makes to the server, before and after the call: never a PASS without the decider's record, and the server is never left to a second decider", async () => {
    // How many calls a passing promote makes.
    const ref = await setup();
    const refHead = headRev(ref);
    const refStart = sshCount(ref);
    expect(promote(ref, [refHead, "--owner-approved", yes(refHead)]).status).toBe(0);
    const calls = sshCount(ref) - refStart;
    expect(calls).toBeGreaterThan(15);
    const points: [number, string][] = [];
    for (let n = 1; n <= calls; n++) for (const when of ["before", "after"]) points.push([n, when]);
    const failures: string[] = [];
    const seen = new Set<string>();
    const queue = points.slice();
    await Promise.all(
      Array.from({ length: 5 }, async () => {
        for (let p = queue.shift(); p !== undefined; p = queue.shift()) {
          const [n, when] = p;
          const e = await setup({ track: false });
          try {
            const head = headRev(e);
            setSsh(e, [`kill_at=${sshCount(e) + n}`, `kill_when=${when}`]);
            const m = promoteAsync(e, [head, "--owner-approved", yes(head)]);
            await m.done;
            setSsh(e, []);
            const bad: string[] = [];
            if (!existsSync(join(e.box.fake, "mac.killed"))) bad.push("the Mac was not killed at that call");
            const op = lastOp(e);
            const log = `${m.out()}\n${macLog(e)}`;
            // Whatever the Mac printed before it died: a PASS needs the decider's finished record.
            if (log.includes("PASS production runs") && !(op && field(e.box, op, "done", "outcome") === "pass")) bad.push("PASS was printed without the decider's done line");
            // The decider goes on alone. Without a go it changes nothing; with one, it decides.
            if (op && states(e.box, op).length > 0) {
              const st = states(e.box, op);
              const sentEvidence = existsSync(join(opDir(e.box, op), "evidence"));
              if (st.includes("go") || existsSync(join(opDir(e.box, op), "go"))) {
                if (sentEvidence) {
                  for (let i = 0; i < 300 && field(e.box, op, "done", "outcome") === ""; i++) await sleep(100);
                  const outcome = field(e.box, op, "done", "outcome");
                  seen.add(`evidence:${outcome}`);
                  if (outcome !== "pass") bad.push(`evidence was delivered, but the outcome is ${outcome || "none"}`);
                  else if (statusNow(e) !== head) bad.push("pass, but production does not answer as the new revision");
                } else {
                  // No evidence will come: it is waiting to undo. It must not have committed.
                  await sleep(1500);
                  seen.add("no-evidence");
                  if (states(e.box, op).includes("committed")) bad.push("committed without evidence");
                }
              } else {
                for (let i = 0; i < 200 && field(e.box, op, "done", "outcome") === ""; i++) await sleep(100);
                seen.add(`no-go:${field(e.box, op, "done", "outcome")}`);
                if (field(e.box, op, "done", "outcome") !== "unchanged") bad.push("no go was sent, but the decider did not end unchanged");
                if (statusNow(e) !== OLD_BUILD) bad.push("no go was sent, but production changed");
              }
            } else {
              seen.add("never-began");
              if (statusNow(e) !== OLD_BUILD) bad.push("the decider never began, but production changed");
            }
            if (bad.length) failures.push(`call ${n} ${when}: ${bad.join("; ")}\n${m.out().slice(-400)}`);
          } finally {
            destroy(e);
          }
        }
      }),
    );
    expect(failures).toEqual([]);
    expect([...seen].sort()).toEqual(["evidence:pass", "never-began", "no-evidence", "no-go:unchanged"]);
    destroy(ref);
    all.splice(all.indexOf(ref), 1);
  });

  it("the Mac killed before its evidence: the decider undoes by itself when its window closes, and says why", async () => {
    const e = await setup();
    const head = headRev(e);
    const m = promoteAsync(e, [head, "--owner-approved", yes(head)]);
    while (!m.out().includes("the new revision runs") && m.status() === null) await sleep(50);
    process.kill(-m.pid, "SIGKILL");
    try {
      process.kill(m.pid, "SIGKILL");
    } catch {}
    spawnSync("pkill", ["-9", "-f", script(e)]);
    await m.done;
    const op = lastOp(e);
    for (let i = 0; i < 900 && field(e.box, op, "done", "outcome") === ""; i++) await sleep(100);
    expect(field(e.box, op, "done", "outcome")).toBe("undone");
    expect(["no-evidence", "client-reported-failure"]).toContain(field(e.box, op, "undoing", "reason"));
    expect(statusNow(e)).toBe(OLD_BUILD);
    expect(record(e.box, `undo-${op}.txt`)).toContain("production put back to the hand-started container");
    expect(containers(e.box).filter((c) => c.project === PROJECT)).toEqual([]);
    expect(alive(m.pid)).toBe(false);
    void setFaults;
  });
});
