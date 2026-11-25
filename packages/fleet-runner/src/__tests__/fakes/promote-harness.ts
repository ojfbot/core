// The sandbox the promote tests run in. EVERYTHING HERE IS SYNTHETIC: folders, revisions, image IDs,
// keys and jobs are made by the test and mean nothing outside it. The decider (POSIX sh) is run by
// dash, on macOS and on Linux alike, against the fake engine in fake-docker.mjs.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type * as SQLite from "node:sqlite";
import { fileURLToPath } from "node:url";

// Vite 5 does not recognize the node:sqlite builtin. Load it through Node.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof SQLite;
export const pkg = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const repoRoot = resolve(pkg, "../..");
export const DECIDER = join(pkg, "scripts/fleet-promote-decider.sh");
export const GUARD = join(pkg, "scripts/fleet-promote-guard.pl");
export const FAKE_DOCKER = join(pkg, "src/__tests__/fakes/fake-docker.mjs");
export const DASH = "/bin/dash";
export const KEY_IDS = ["extra", "observer", "owner", "worker-a", "worker-b"];
export const PROJECT = "fleet-prod";
export const HAND_NAME = "fleet-hand-started";
export const TLS = "AA:BB:CC:DD";
export const OLD_BUILD = "0d".repeat(20);

export const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
export const imageId = (rev: string) => `sha256:${sha(`image ${rev}`)}`;
export const revOf = (n: number) => sha(`revision ${n}`).slice(0, 40);
export const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
export const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export interface Box {
  root: string;
  bin: string;
  fake: string;
  ctl: string;
  runs: string;
  prodRoot: string;
  port: number;
  env: Record<string, string>;
  ops: number;
}
export interface Container {
  id: string;
  name: string;
  image: string;
  project?: string;
  status: string;
  pid: number;
  policy: string;
  env: string[];
  helper?: boolean;
}

/** Small bounds, so a test that waits for one waits seconds. (The defaults have a test of their own.) */
export const FAST_BOUNDS: Record<string, number> = {
  b_first: 10,
  // Not a wait any test sits through (the Mac's go comes at once); long enough that a busy
  // machine running many sandboxes at once never makes it late.
  b_go: 30,
  b_stop: 40,
  b_copy: 10,
  b_integrity: 10,
  b_start: 10,
  b_health: 12,
  b_exec: 10,
  b_evidence: 60,
  b_undo_start: 10,
  b_undo_health: 12,
  b_settle: 1,
};

export function makeBox(opts: { rehearsal?: boolean; policy?: string; jobs?: number; port?: number; seed?: (stateDb: string) => void } = {}): Box {
  if (!existsSync(DASH)) throw new Error("the promote tests need dash at /bin/dash (macOS and Ubuntu both have it)");
  const root = mkdtempSync(join(tmpdir(), "fleet-promote-"));
  const box: Box = {
    root,
    bin: join(root, "bin"),
    fake: join(root, "fake"),
    ctl: join(root, "server/control"),
    runs: join(root, "server/control/promote-runs"),
    prodRoot: join(root, "server/service-root"),
    port: opts.port ?? 18787,
    env: {},
    ops: 0,
  };
  for (const d of [box.bin, box.fake, box.runs, ...["state", "output", "inputs", "public-keys", "tls"].map((d) => join(box.prodRoot, d))])
    mkdirSync(d, { recursive: true });
  writeFileSync(join(box.ctl, ".fleet-runner-production"), "");
  if (opts.rehearsal) writeFileSync(join(box.ctl, ".fleet-runner-promote-rehearsal"), "");
  if (opts.seed) opts.seed(join(box.prodRoot, "state/fleet.sqlite"));
  else {
    const db = new DatabaseSync(join(box.prodRoot, "state/fleet.sqlite"));
    db.exec("CREATE TABLE jobs (name TEXT); PRAGMA user_version = 7;");
    for (let i = 0; i < (opts.jobs ?? 3); i++) db.exec("INSERT INTO jobs (name) VALUES ('synthetic job')");
    db.close();
  }
  for (const id of KEY_IDS) writeFileSync(join(box.prodRoot, "public-keys", `${id}.pub`), `synthetic public key of ${id}\n`);
  writeFileSync(join(box.bin, "docker"), `#!/bin/sh\nexec node "${FAKE_DOCKER}" "$@"\n`);
  writeFileSync(join(box.bin, "sync"), `#!/bin/sh\necho "sync $*" >> "$FAKE_STATE/sync.log"\n`);
  // perl, with faults at the guard's persistence calls (append, publish, sync-path). perl-faults
  // holds "<call> <n> <mode>" lines: the n-th such call fails, tears, or the decider is killed
  // around it. And one for the Mac side: interrupt-at-clock holds a number N, and the N-th time the
  // Mac reads its clock, an interrupt (as Ctrl-C sends it, to the Mac's whole process group)
  // arrives at that very moment, so that read is lost. Everything else goes straight to the real perl.
  const realPerl = spawnSync("sh", ["-c", "command -v perl"], { encoding: "utf8" }).stdout.trim();
  writeFileSync(
    join(box.bin, "perl"),
    `#!/bin/sh
case "$*" in
  *CLOCK_MONOTONIC*)
    f="$FAKE_STATE/interrupt-at-clock"
    if [ -f "$f" ]; then
      c="$FAKE_STATE/clock-count"
      n=$(( $(cat "$c" 2>/dev/null || echo 0) + 1 ))
      echo "$n" > "$c"
      if [ "$n" = "$(cat "$f")" ]; then
        echo "$n" > "$FAKE_STATE/interrupt-at-clock.hit"
        ${realPerl} -e 'kill "INT", -$ARGV[0]' "$(cat "$FAKE_STATE/mac.pid")"
        sleep 2
        exit 130
      fi
    fi ;;
esac
case "\${2:-}" in
  append | publish | sync-path)
    f="$FAKE_STATE/perl-faults"
    if [ -f "$f" ]; then
      c="$FAKE_STATE/perl-count-$2"
      n=$(( $(cat "$c" 2>/dev/null || echo 0) + 1 ))
      echo "$n" > "$c"
      mode="$(sed -n "s/^$2 $n //p" "$f" | head -n 1)"
      [ -z "$mode" ] || echo "$2 $n $mode" >> "$FAKE_STATE/perl-faults.hit"
      case "$mode" in
        fail) exit 1 ;;
        torn) if [ "$2" = append ]; then printf '%s' "$4" | cut -c1-14 | tr -d '\\n' >> "$3"; fi; exit 1 ;;
        wrote-failed) ${realPerl} "$@" > /dev/null; exit 1 ;;
        kill-before) kill -9 "$(cat "$FAKE_STATE/decider.pid")"; exit 1 ;;
        kill-after) ${realPerl} "$@"; kill -9 "$(cat "$FAKE_STATE/decider.pid")"; exit 0 ;;
      esac
    fi ;;
esac
exec ${realPerl} "$@"
`,
  );
  chmodSync(join(box.bin, "docker"), 0o755);
  chmodSync(join(box.bin, "sync"), 0o755);
  chmodSync(join(box.bin, "perl"), 0o755);
  box.env = {
    ...(process.env as Record<string, string>),
    PATH: `${box.bin}:${process.env.PATH}`,
    FAKE_STATE: box.fake,
    FAKE_BIN: box.bin,
    FAKE_REPO_ROOT: repoRoot,
  };
  // The hand-started production of today: one container, by name, not under any Compose project.
  const oldImage = `sha256:${"0".repeat(63)}1`;
  writeFileSync(join(box.fake, "images.json"), JSON.stringify({ [oldImage]: { id: oldImage, env: ["PATH=/usr/local/bin:/usr/bin", "NODE_ENV=production"] } }));
  mkdirSync(join(box.fake, "containers"), { recursive: true });
  const r = box.prodRoot;
  const hand = {
    id: "c".repeat(64),
    name: HAND_NAME,
    image: oldImage,
    status: "exited",
    pid: 0,
    policy: opts.policy ?? "unless-stopped",
    marks: false,
    env: [
      "FLEET_WORKERS=worker-a,worker-b",
      "FLEET_OBSERVERS=observer",
      `FLEET_BUILD_REF=${OLD_BUILD}`,
      "FLEET_INPUT_DIR=/var/lib/fleet-runner/inputs",
      "FLEET_TLS_CERT=/run/fleet-runner/tls/server.crt",
      "FLEET_TLS_KEY=/run/fleet-runner/tls/server.key",
      "FLEET_PORT=8787",
      "PATH=/usr/local/bin:/usr/bin",
      "NODE_ENV=production",
    ],
    mounts: [
      { source: `${r}/state`, target: "/var/lib/fleet-runner/state", rw: true },
      { source: `${r}/output`, target: "/var/lib/fleet-runner/output", rw: true },
      { source: `${r}/inputs`, target: "/var/lib/fleet-runner/inputs", rw: true },
      { source: `${r}/public-keys`, target: "/run/fleet-runner/public-keys", rw: false },
      { source: `${r}/tls`, target: "/run/fleet-runner/tls", rw: false },
    ],
    ports: [{ ip: "127.0.0.1", port: String(box.port) }],
    network: "bridge",
  };
  writeFileSync(join(box.fake, "containers", `${hand.id}.json`), JSON.stringify(hand));
  docker(box, ["start", HAND_NAME]);
  writeFileSync(join(box.fake, "docker.log"), "");
  return box;
}

export function docker(box: Box, args: string[]) {
  const r = spawnSync("docker", args, { env: box.env, encoding: "utf8" });
  return { status: r.status, out: r.stdout, err: r.stderr };
}
export const containers = (box: Box): Container[] =>
  readdirSync(join(box.fake, "containers"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(box.fake, "containers", f), "utf8")) as Container);
export const runningContainers = (box: Box) => containers(box).filter((c) => c.status === "running" && alive(c.pid));
export const dockerLog = (box: Box) => (existsSync(join(box.fake, "docker.log")) ? readFileSync(join(box.fake, "docker.log"), "utf8").split("\n").filter(Boolean) : []);
export const setFaults = (box: Box, faults: Record<string, unknown>) => {
  for (const f of readdirSync(box.fake)) if (f.startsWith("fault-") || f === "hung") rmSync(join(box.fake, f), { force: true });
  writeFileSync(join(box.fake, "faults.json"), JSON.stringify(faults));
};
/** Faults at the n-th journal append, record publish or flush: see the fake perl in makeBox. */
export const setPerlFaults = (box: Box, lines: string[]) => {
  for (const f of readdirSync(box.fake)) if (f.startsWith("perl-")) rmSync(join(box.fake, f), { force: true });
  if (lines.length) writeFileSync(join(box.fake, "perl-faults"), `${lines.join("\n")}\n`);
};
export const perlCount = (box: Box, call: string) => {
  const f = join(box.fake, `perl-count-${call}`);
  return existsSync(f) ? Number(readFileSync(f, "utf8")) : 0;
};
export const addImage = (box: Box, rev: string) => {
  const file = join(box.fake, "images.json");
  const all = JSON.parse(readFileSync(file, "utf8"));
  const entry = { id: imageId(rev), env: ["PATH=/usr/local/bin:/usr/bin", "NODE_ENV=production"] };
  all[entry.id] = entry;
  all[`fleet-runner:${rev}`] = entry;
  writeFileSync(file, JSON.stringify(all));
  return entry.id;
};
export const dropImageName = (box: Box, name: string) => {
  const file = join(box.fake, "images.json");
  const all = JSON.parse(readFileSync(file, "utf8"));
  delete all[name];
  writeFileSync(file, JSON.stringify(all));
};
export const jobsIn = (file: string) => {
  const db = new DatabaseSync(file, { readOnly: true });
  const n = (db.prepare("SELECT count(*) AS n FROM jobs").get() as { n: number }).n;
  db.close();
  return n;
};

export const opDir = (box: Box, op: string) => join(box.runs, op);
export const journal = (box: Box, op: string) => {
  const f = join(opDir(box, op), "journal");
  return existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean) : [];
};
export const states = (box: Box, op: string) => journal(box, op).map((l) => l.split(" ")[1]);
export const field = (box: Box, op: string, state: string, key: string) => {
  const line = journal(box, op)
    .filter((l) => l.split(" ")[1] === state)
    .pop();
  return line ? (new RegExp(` ${key}=(\\S*)`).exec(line)?.[1] ?? "") : "";
};
export const record = (box: Box, name: string) => {
  const f = join(box.ctl, "promote-records", name);
  return existsSync(f) ? readFileSync(f, "utf8") : "";
};
/** The journal's complete lines only: a last line without its line break was never written. */
export const completeLines = (box: Box, op: string) => {
  const f = join(opDir(box, op), "journal");
  if (!existsSync(f)) return [];
  const text = readFileSync(f, "utf8");
  const lines = text.split("\n");
  lines.pop();
  return lines;
};
export const records = (box: Box) => (existsSync(join(box.ctl, "promote-records")) ? readdirSync(join(box.ctl, "promote-records")) : []);

/** Run the decider under dash, to its end. */
export function decider(box: Box, op: string, mode: string, extra: string[] = [], env: Record<string, string> = {}) {
  const r = spawnSync(DASH, [join(opDir(box, op), "decider.sh"), mode, op, ...extra], {
    cwd: box.ctl,
    env: { ...box.env, ...env },
    encoding: "utf8",
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

/**
 * The same, without blocking this process: the sweeps run many sandboxes at once, and a recover
 * that takes seconds must not keep the others' "Mac" from answering in time.
 */
export function deciderAsync(box: Box, op: string, mode: string, extra: string[] = [], env: Record<string, string> = {}) {
  return new Promise<{ status: number | null; out: string }>((ok) => {
    const child = spawn(DASH, [join(opDir(box, op), "decider.sh"), mode, op, ...extra], {
      cwd: box.ctl,
      env: { ...box.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.once("close", (code, signal) => ok({ status: signal ? 128 : code, out }));
  });
}

export interface PlanOptions {
  mode?: "promote" | "revert";
  rev?: string;
  target?: string;
  kind?: "container" | "compose";
  prevOp?: string;
  prevCfg?: string;
  approval?: string;
  bounds?: Record<string, number>;
  rehearsal?: boolean;
  /** Lines to replace or add, key=value, after everything else. */
  override?: Record<string, string>;
  /** Do not resolve a config (for plans that must be refused before that). */
  skipPrepare?: boolean;
  /** Leave every bound out of the plan, so the decider's own defaults apply. */
  defaults?: boolean;
}
let opCounter = 0;
/** What the Mac does before the start: the run folder, the decider and guard, the config, the plan. */
export function newOp(box: Box, o: PlanOptions = {}): string {
  opCounter += 1;
  box.ops += 1;
  const op = `20260101T0000${String(box.ops).padStart(2, "0")}Z-${process.pid}${opCounter}`;
  const dir = opDir(box, op);
  mkdirSync(dir);
  copyFileSync(DECIDER, join(dir, "decider.sh"));
  copyFileSync(GUARD, join(dir, "guard.pl"));
  const mode = o.mode ?? "promote";
  const approval = o.approval ?? `Yes, ${mode} ${o.rev ?? o.target} (synthetic approval ${op})`;
  const lines: Record<string, string> = {
    format: "1",
    op,
    mode,
    project: PROJECT,
    root: box.prodRoot,
    lan: "127.0.0.1",
    port: String(box.port),
    approval_sha256: sha(approval.toLowerCase().replace(/\s+/g, " ").trim()),
    approval,
    rehearsal: o.rehearsal ? "yes" : "no",
  };
  if (mode === "promote") {
    const rev = o.rev ?? revOf(1);
    const kind = o.kind ?? "container";
    addImage(box, rev);
    Object.assign(lines, {
      revision: rev,
      kind,
      container: HAND_NAME,
      new_image: imageId(rev),
      uidgid: "1000:1000",
      prev_op: o.prevOp ?? "-",
      prev_resolved_sha256: o.prevCfg ?? "-",
      key_ids: KEY_IDS.join(","),
      tls_before: TLS,
      resolved_sha256: "0".repeat(64),
    });
    if (!o.skipPrepare) {
      copyFileSync(join(pkg, "deploy/compose.production.yaml"), join(dir, "compose.yaml"));
      const r = spawnSync(DASH, [join(dir, "decider.sh"), "prepare", op, kind, PROJECT, rev, box.prodRoot, String(box.port), "127.0.0.1", HAND_NAME], {
        cwd: box.ctl,
        env: box.env,
        encoding: "utf8",
      });
      if (r.status !== 0) throw new Error(`prepare failed: ${r.stdout}${r.stderr}`);
      // The fake's owner is whoever runs the test; the plan carries the account the config names.
      const uidgid = /^uidgid=(.*)$/m.exec(r.stdout)?.[1] ?? "";
      lines.uidgid = uidgid;
      copyFileSync(join(dir, "resolved.candidate.json"), join(dir, "resolved.json"));
      lines.resolved_sha256 = sha(readFileSync(join(dir, "resolved.json")));
    }
  } else {
    lines.target = o.target ?? "";
  }
  if (!o.defaults) for (const [k, v] of Object.entries({ ...FAST_BOUNDS, ...(o.bounds ?? {}) })) lines[k] = String(v);
  Object.assign(lines, o.override ?? {});
  writeFileSync(join(dir, "plan"), `${Object.entries(lines).map(([k, v]) => `${k}=${v}`).join("\n")}\n`);
  return op;
}
export const planSha = (box: Box, op: string) => sha(readFileSync(join(opDir(box, op), "plan")));
export function putFile(box: Box, op: string, name: string, lines: Record<string, string>) {
  const f = join(opDir(box, op), name);
  writeFileSync(`${f}.part`, `${Object.entries(lines).map(([k, v]) => `${k}=${v}`).join("\n")}\n`);
  renameSync(`${f}.part`, f);
}

export interface MacPlay {
  /** Send the go when "begun" appears (default true). */
  go?: boolean;
  /** What evidence to send when "server-checked" appears. "none": none at all. */
  evidence?: "ok" | "none" | "wrong-build" | "tls-changed" | "interrupted" | "no-nonce" | "other-run" | "other-plan";
  /** Called once per poll; return true to stop playing the Mac (it "vanishes"). */
  vanish?: (states: string[]) => boolean;
}
export interface Run {
  status: number | null;
  out: string;
  pid: number;
}
/** Start `run` as the Mac's start does (detached), and play the Mac's part: the go, the evidence. */
export async function run(box: Box, op: string, play: MacPlay = {}, env: Record<string, string> = {}): Promise<Run> {
  const started = startDecider(box, op, "run", env);
  await playMac(box, op, play, () => !alive(started.pid));
  await started.done;
  return { status: started.status(), out: readOut(box, op), pid: started.pid };
}
export const readOut = (box: Box, op: string) => {
  const f = join(opDir(box, op), "decider.out");
  return existsSync(f) ? readFileSync(f, "utf8") : "";
};
export function startDecider(box: Box, op: string, mode: string, env: Record<string, string> = {}) {
  const dir = opDir(box, op);
  // A group of its own, as the Mac's start gives it; the pid is the decider's own.
  const child = spawn(DASH, ["-c", `exec ${DASH} "$0/decider.sh" "$1" "$2" >> "$0/decider.out" 2>&1 < /dev/null`, dir, mode, op], {
    cwd: box.ctl,
    env: { ...box.env, ...env },
    detached: true,
    stdio: "ignore",
  });
  writeFileSync(join(box.fake, "decider.pid"), String(child.pid));
  let status: number | null = null;
  const done = new Promise<void>((ok) =>
    child.once("exit", (code, signal) => {
      status = signal ? 128 : code;
      ok();
    }),
  );
  return { pid: child.pid as number, done, status: () => status };
}
export async function playMac(box: Box, op: string, play: MacPlay, ended: () => boolean) {
  let sentGo = false;
  let sentEvidence = false;
  for (;;) {
    const st = states(box, op);
    if (play.vanish?.(st)) return;
    if (!sentGo && st.includes("begun") && play.go !== false) {
      putFile(box, op, "go", { nonce: field(box, op, "begun", "go") });
      sentGo = true;
    }
    if (!sentEvidence && st.includes("server-checked")) {
      sentEvidence = true;
      const e = play.evidence ?? "ok";
      if (e !== "none") {
        const rev = field(box, op, "begun", "rev");
        putFile(box, op, "evidence", {
          op: e === "other-run" ? "another-run" : op,
          revision: rev,
          plan: e === "other-plan" ? "0".repeat(64) : planSha(box, op),
          nonce: e === "no-nonce" ? "0".repeat(32) : field(box, op, "server-checked", "nonce"),
          build: e === "wrong-build" ? "f".repeat(40) : rev,
          tls: e === "tls-changed" ? "EE:FF" : TLS,
          client: e === "interrupted" ? "interrupted" : "ok",
        });
      }
    }
    if (ended()) return;
    await sleep(40);
  }
}

/** Kill every process the sandbox may have left, and remove it. */
export function destroyBox(box: Box) {
  const holders = spawnSync("perl", [GUARD, "holders", box.ctl], { encoding: "utf8" }).stdout || "";
  killAndRemove(box, holders);
}
/** The same, without blocking this process while the holders are looked up (for the sweeps). */
export async function destroyBoxAsync(box: Box) {
  const holders = await new Promise<string>((ok) => {
    const child = spawn("perl", [GUARD, "holders", box.ctl], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.once("close", () => ok(out));
    child.once("error", () => ok(""));
  });
  killAndRemove(box, holders);
}
/** A process's command line, or "" when there is no such process. */
export const commandLine = (pid: number) => (pid > 1 ? spawnSync("ps", ["-ww", "-o", "args=", "-p", String(pid)], { encoding: "utf8" }).stdout.trim() : "");
/**
 * Kill a process (or its whole group) ONLY if it is still the one meant: its command line must name
 * <mark>, a path of the sandbox it belongs to. These tests start so many processes that a number
 * written down a moment ago is soon given to another process, of another sandbox perhaps; a number
 * alone is never signalled.
 */
export function killIfStill(pid: number, mark: string, group = false) {
  if (!(pid > 1) || !commandLine(pid).includes(mark)) return;
  try {
    process.kill(group ? -pid : pid, "SIGKILL");
  } catch {}
}
/** The step groups recorded in a run's groups file that are still running: checked by the guard itself, by start time. */
export function liveGroups(groupsFile: string): number[] {
  if (!existsSync(groupsFile)) return [];
  const out = spawnSync("perl", [GUARD, "groups-alive", groupsFile], { encoding: "utf8" }).stdout || "";
  return [...out.matchAll(/^group (\d+) /gm)].map((m) => Number(m[1]));
}
function killAndRemove(box: Box, holders: string) {
  // Fake containers and helper workers: their command lines name this sandbox's engine folder.
  for (const c of containers(box)) {
    killIfStill(c.pid, box.fake);
    killIfStill((c as unknown as { helperPid?: number }).helperPid ?? 0, box.fake, true);
  }
  // Anything still holding the control folder: a decider, a bound, a hung fake client.
  for (const row of holders.split("\n")) {
    const pid = Number(row.split(" ")[0]);
    if (pid > 1) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {}
    }
  }
  // Steps of this sandbox's runs that are still running (never a recorded number that is someone else's now).
  for (const op of existsSync(box.runs) ? readdirSync(box.runs) : []) {
    for (const pgid of liveGroups(join(box.runs, op, "groups"))) {
      try {
        process.kill(-pgid, "SIGKILL");
      } catch {}
    }
  }
  try {
    rmSync(box.root, { recursive: true, force: true });
  } catch (err) {
    // Something wrote into the sandbox while it was being removed. Never retried or forced: say
    // what is left and which processes are still about, so the writer is found.
    throw new Error(`${String(err)}\n${stillThere(box)}`);
  }
}
/** What is left in a sandbox and which processes still have to do with it (by command line, or by working folder on Linux). */
export function stillThere(box: Box): string {
  const left = spawnSync("find", [box.root, "-mindepth", "1"], { encoding: "utf8" }).stdout.trim().split("\n").filter(Boolean);
  const procs: string[] = [];
  for (const row of spawnSync("ps", ["-eo", "pid=,ppid=,pgid=,etime=,args="], { encoding: "utf8" }).stdout.split("\n")) {
    const pid = Number(row.trim().split(/\s+/)[0]);
    if (!pid || pid === process.pid) continue;
    let cwd = "";
    try {
      cwd = readlinkSync(`/proc/${pid}/cwd`);
    } catch {}
    if (row.includes(box.root) || cwd.startsWith(box.root)) procs.push(`${row.trim().slice(0, 300)}${cwd ? ` [cwd ${cwd}]` : ""}`);
  }
  return `left in the sandbox (${left.length}): ${left.slice(0, 40).join(", ") || "nothing"}\nprocesses of the sandbox still running (${procs.length}):\n${procs.join("\n") || "none"}`;
}

/** What production is, as the fake engine and the folders have it. */
export function reality(box: Box) {
  const up = runningContainers(box).filter((c) => !c.helper);
  // A container that an interrupted call created late and nobody started is a stray, counted apart.
  const project = containers(box).filter((c) => c.project === PROJECT && c.status !== "created");
  const strays = containers(box).filter((c) => c.project === PROJECT && c.status === "created");
  const stateFiles = readdirSync(box.prodRoot);
  const startedBy = existsSync(join(box.prodRoot, "state/started-by"))
    ? readFileSync(join(box.prodRoot, "state/started-by"), "utf8").split("\n").filter(Boolean)
    : [];
  return {
    running: up.map((c) => ({ name: c.name, image: c.image, id: c.id })),
    projectContainers: project.length,
    strays: strays.length,
    helpers: containers(box).filter((c) => c.helper).length,
    stateFolders: stateFiles.filter((f) => f.startsWith("state")).sort(),
    stateStartedBy: startedBy,
    jobs: existsSync(join(box.prodRoot, "state/fleet.sqlite")) ? jobsIn(join(box.prodRoot, "state/fleet.sqlite")) : -1,
  };
}
export const lockIsFree = (box: Box) =>
  spawnSync(DASH, ["-c", `exec 9< "$1"; perl "$2" lock 9`, "sh", box.ctl, GUARD], { env: box.env }).status === 0;
