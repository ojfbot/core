#!/usr/bin/env node
// A fake container engine for the promote tests. EVERYTHING HERE IS SYNTHETIC.
//
// It is two things, as the real one is: a CLIENT (this file run as `docker ..`) and an ENGINE whose
// work goes on without the client. Every request that changes something is handed to a detached
// worker (this file run with --apply), which applies it; the client only waits for the answer. So a
// client that is killed leaves its accepted request running, exactly the property a real engine
// has and a fake that does everything in the client would hide.
//
// State, under $FAKE_STATE:
//   containers/<id>.json   one container: id, name, image, project, status, pid, policy, env, ..
//   images.json            { "<name:tag or id>": { id, env: [..] } }
//   docker.log             one line per client call: "<n> <args>"
//   faults.json            what should go wrong (see fault()), read at every call
//   started/<project>.json the exact bytes the last `compose up` of that project was given
//   hung                   written by a client that is now blocking for good: "<n> <pid>"
//   sync.log               one line per sync a helper ran (written by the fake `sync` command)
// A container "runs" as a real process (so stop, kill and "is it running" are real). What a
// container of a NEW image does when it starts is in start(): it marks the state folder it mounts.
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const S = process.env.FAKE_STATE;
if (!S) {
  console.error("fake docker: FAKE_STATE is not set");
  process.exit(125);
}
const SELF = fileURLToPath(import.meta.url);
const CONTAINERS = join(S, "containers");
mkdirSync(CONTAINERS, { recursive: true });
mkdirSync(join(S, "started"), { recursive: true });
mkdirSync(join(S, "jobs"), { recursive: true });

const readJson = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};
const writeJson = (file, value) => {
  writeFileSync(`${file}.tmp-${process.pid}`, JSON.stringify(value, null, 2));
  renameSync(`${file}.tmp-${process.pid}`, file);
};
const sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
// A process ID is only "this sandbox's process" while the process that has it names this sandbox on
// its command line: the tests start so many processes that a number is soon given to another one,
// and a stale number must never be signalled or taken for a running container.
const commandLine = (pid) => {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ");
  } catch {
    return spawnSync("ps", ["-ww", "-o", "args=", "-p", String(pid)], { encoding: "utf8" }).stdout || "";
  }
};
const alive = (pid) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  return commandLine(pid).includes(S);
};
const containers = () =>
  readdirSync(CONTAINERS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(join(CONTAINERS, f), null))
    .filter(Boolean);
const save = (c) => writeJson(join(CONTAINERS, `${c.id}.json`), c);
const find = (ref) => containers().find((c) => c.id === ref || c.name === ref || (ref.length >= 12 && c.id.startsWith(ref)));
const running = (c) => c.status === "running" && alive(c.pid);
const images = () => readJson(join(S, "images.json"), {});
const imageOf = (ref) => {
  const all = images();
  if (all[ref]) return all[ref];
  return Object.values(all).find((i) => i.id === ref);
};
const faults = () => readJson(join(S, "faults.json"), {});

// ---- The engine's side: applying a request. Runs in a detached worker. --------------------------

// A container process with nothing inherited from whoever asked for it (the engine starts real
// containers, never the client): no extra descriptors, a session of its own.
function spawnDetached(argv, env) {
  const child = spawn(
    "perl",
    ["-e", "use POSIX; POSIX::close($_) for 3 .. 255; exec { $ARGV[0] } @ARGV; exit 127", ...argv],
    { detached: true, stdio: "ignore", env: { ...process.env, ...env } },
  );
  child.unref();
  return child.pid;
}
function start(c) {
  if (running(c)) return;
  const cfg = faults();
  const service = readJson(join(S, "service.json"), null);
  const stateMount = (c.mounts || []).find((m) => m.target === "/var/lib/fleet-runner/state");
  // What a build does to the state folder when it starts: the new one "migrates" it.
  if (stateMount && c.marks !== false && existsSync(stateMount.source)) {
    appendFileSync(join(stateMount.source, "started-by"), `${c.image}\n`);
    const add = cfg.addJobs?.[c.image] ?? 0;
    const drop = cfg.dropJobs?.[c.image] ?? 0;
    if (add || drop) {
      const js = `const { DatabaseSync } = require("node:sqlite"); const db = new DatabaseSync(process.argv[1]);
        for (let i = 0; i < ${add}; i++) db.exec("INSERT INTO jobs (name) VALUES ('accepted by the new build')");
        for (let i = 0; i < ${drop}; i++) db.exec("DELETE FROM jobs WHERE rowid = (SELECT min(rowid) FROM jobs)");
        db.close();`;
      spawnSync("node", ["-e", js, join(stateMount.source, "fleet.sqlite")]);
    }
  }
  const root = stateMount ? dirname(stateMount.source) : "";
  c.pid = service
    ? spawnDetached([...service.argv, S], { ...service.env, FAKE_ROOT: root, FAKE_BUILD: (c.env.find((e) => e.startsWith("FLEET_BUILD_REF=")) || "=").split("=")[1], FAKE_IMAGE: c.image })
    : // A "container" that does nothing, and never outlives its sandbox: it ends when the test removes the folders.
      spawnDetached(["sh", "-c", 'while [ -d "$0" ]; do sleep 1; done', S], {});
  c.status = "running";
  c.startedAt = Date.now();
  save(c);
}
function stop(c) {
  if (c.pid && alive(c.pid)) {
    try {
      process.kill(c.pid, "SIGTERM");
    } catch {}
    for (let i = 0; i < 50 && alive(c.pid); i++) sleepMs(100);
    if (alive(c.pid)) {
      try {
        process.kill(c.pid, "SIGKILL");
      } catch {}
      for (let i = 0; i < 20 && alive(c.pid); i++) sleepMs(100);
    }
  }
  const now = find(c.id);
  if (!now) return;
  now.status = now.status === "created" ? "created" : "exited";
  now.pid = 0;
  save(now);
}
function remove(c) {
  stop(c);
  if (c.helperPid && alive(c.helperPid)) {
    try {
      process.kill(-c.helperPid, "SIGKILL");
    } catch {}
    try {
      process.kill(c.helperPid, "SIGKILL");
    } catch {}
  }
  rmSync(join(CONTAINERS, `${c.id}.json`), { force: true });
}

const sorted = (v) =>
  Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v;

function composeUp(job) {
  const bytes = Buffer.from(job.bytes, "base64");
  writeFileSync(join(S, "started", `${job.project}.json`), bytes);
  let cfg;
  try {
    cfg = JSON.parse(bytes.toString("utf8"));
  } catch {
    return { status: 1, err: "compose: the config is not valid" };
  }
  const s = cfg.services?.["fleet-runner"];
  if (!s) return { status: 1, err: "compose: no fleet-runner service" };
  const image = imageOf(s.image);
  if (!image) return { status: 1, err: "compose: the image is not here and --pull never was given" };
  const hash = createHash("sha256").update(bytes).digest("hex");
  const mine = containers().filter((c) => c.project === job.project);
  const same = mine.find((c) => c.configHash === hash);
  for (const c of mine) if (c !== same) remove(c);
  if (same) {
    start(same);
    return { status: 0 };
  }
  const c = {
    id: createHash("sha256").update(randomBytes(16)).digest("hex"),
    name: `${job.project}-fleet-runner-1`,
    image: image.id,
    project: job.project,
    status: "created",
    pid: 0,
    policy: s.restart || "no",
    env: [...Object.entries(s.environment || {}).map(([k, v]) => `${k}=${v}`), ...(image.env || [])],
    mounts: (s.volumes || []).map((v) => ({ source: v.source, target: v.target, rw: !v.read_only })),
    ports: (s.ports || []).map((p) => ({ ip: p.host_ip, port: String(p.published) })),
    network: `${job.project}_default`,
    privileged: Boolean(s.privileged),
    configHash: hash,
  };
  save(c);
  if (job.createOnly) return { status: 0 };
  start(c);
  return { status: 0 };
}

// docker run: a helper container. Its mounts are mapped onto the host paths and its sh or node
// command runs here, as the engine would run it: it goes on when the client is gone, until it ends
// or the container is removed.
function helperRun(job) {
  const mounts = job.mounts.slice().sort((x, y) => y.target.length - x.target.length);
  const map = (text) => {
    for (const m of mounts) {
      text = text.split(`${m.target}/`).join(`${m.source}/`).split(`${m.target} `).join(`${m.source} `).split(`${m.target}"`).join(`${m.source}"`);
      if (text === m.target) text = m.source;
    }
    return text;
  };
  const cfg = faults();
  const env = { ...process.env, PATH: `${process.env.FAKE_BIN}:${process.env.PATH}` };
  // Two things a real server does that mapping paths would hide (the rehearsal found both):
  // the service root is not the service account's to pass through, so only root gets anywhere
  // when the whole root is mounted; and SQLite cannot open a write-ahead-mode database from a
  // folder it may not write to, however read-only the open itself is.
  const root = job.user === "0:0" || job.user === "0";
  if (!root && job.mounts.some((m) => m.target === "/srv")) return { status: 1, err: "permission denied: the service root is not this account's to pass through\n" };
  if (job.entry === "node" && job.args[1]?.includes("DatabaseSync") && job.mounts.some((m) => !m.rw))
    return { status: 1, err: "Error: attempt to write a readonly database\n" };
  const isCopy = job.entry === "sh" && job.args[1]?.includes("cp -a");
  if (isCopy && cfg.slowCopyMs) sleepMs(cfg.slowCopyMs);
  let r;
  if (job.entry === "sh" && job.args[0] === "-c") r = spawnSync("sh", ["-c", map(job.args[1]), ...job.args.slice(2).map(map)], { env, encoding: "utf8" });
  else if (job.entry === "node" && job.args[0] === "-e") r = spawnSync("node", ["-e", map(job.args[1]), ...job.args.slice(2).map(map)], { env, encoding: "utf8" });
  else return { status: 125, err: "fake docker run: unknown command" };
  if (isCopy && cfg.corruptSnapshot && r.status === 0) {
    const root = mounts.find((m) => m.target === "/srv")?.source;
    const part = readdirSync(root).find((f) => f.endsWith(".part"));
    if (part) writeFileSync(join(root, part, "fleet.sqlite"), "not a database");
  }
  return { status: r.status ?? 1, out: r.stdout, err: r.stderr };
}

function apply(job) {
  switch (job.kind) {
    case "stop":
      for (const ref of job.refs) {
        const c = find(ref);
        if (c) stop(c);
      }
      return { status: 0, out: `${job.refs.join("\n")}\n` };
    case "start": {
      const c = find(job.ref);
      if (!c) return { status: 1, err: "No such container" };
      start(c);
      return { status: 0, out: `${job.ref}\n` };
    }
    case "rm":
      for (const ref of job.refs) {
        const c = find(ref);
        if (c) remove(c);
      }
      return { status: 0, out: `${job.refs.join("\n")}\n` };
    case "up":
      return composeUp(job);
    case "run": {
      const r = helperRun(job);
      rmSync(join(CONTAINERS, `${job.id}.json`), { force: true });
      return r;
    }
    default:
      return { status: 125, err: "fake engine: unknown job" };
  }
}

if (process.argv[2] === "--apply") {
  const file = process.argv[3];
  const job = readJson(file, null);
  if (job.kind === "run") {
    // The helper container exists from here on: removing it ends this work, late or not.
    const c = find(job.id);
    if (c) {
      c.helperPid = process.pid;
      save(c);
    }
  }
  if (job.delayMs) sleepMs(job.delayMs);
  if (job.kind === "run" && !find(job.id)) process.exit(0);
  const result = apply(job);
  writeJson(`${file}.done`, result);
  process.exit(0);
}

// ---- The client's side. ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
appendFileSync(join(S, "docker.log"), `${argv.join(" ").replace(/\s+/g, " ").slice(0, 3000)}\n`);
// A client the test's fake perl marked, for one bounded step by its label: it never answers and
// does not end when asked to (TERM), only when killed.
if (process.env.FAKE_DOCKER_HANG === "deaf") {
  process.on("SIGTERM", () => {});
  for (;;) sleepMs(1000);
}
const callNo = readFileSync(join(S, "docker.log"), "utf8").split("\n").length - 1;
const line = argv.join(" ");

// faults.json: { hang: {at|match, when: "before"|"after"}, late: {at|match, ms}, fail: {at|match, status},
//                slow: {at|match, ms}, createOnly: {at|match} } and the per-image knobs start() reads.
function fault(name) {
  const f = faults()[name];
  if (!f) return null;
  if (f.at !== undefined && f.at !== callNo) return null;
  if (f.match !== undefined && !line.includes(f.match)) return null;
  if (f.skip !== undefined) {
    // "the n-th matching call": count them in a file.
    const file = join(S, `fault-${name}.count`);
    const seen = Number(readJson(file, 0)) + 1;
    writeJson(file, seen);
    if (seen !== f.skip + 1) return null;
  }
  return f;
}
function hangForever() {
  // "deaf": a client that does not end when asked to (TERM), only when killed: it costs the
  // caller its bound AND the whole ending of a step that ran into it.
  if (faults().hang?.deaf) process.on("SIGTERM", () => {});
  writeFileSync(join(S, "hung"), `${callNo} ${process.pid}\n`);
  for (;;) sleepMs(1000);
}
// Hand a request to the engine and wait for its answer.
function submit(job) {
  const hang = fault("hang");
  const late = fault("late");
  const fail = fault("fail");
  const slow = fault("slow");
  if (fault("createOnly")) job.createOnly = true;
  if (fail) process.exit(fail.status ?? 1);
  if (hang && hang.when !== "after") hangForever();
  if (late) {
    job.delayMs = late.ms;
    // Compose is a client: "up" is a create call and then a start call. With the client gone, the
    // one call that may still land is the create; nothing is left to send the start.
    if (job.kind === "up") job.createOnly = true;
  }
  if (slow) sleepMs(slow.ms);
  const file = join(S, "jobs", `${callNo}-${process.pid}.json`);
  writeJson(file, job);
  const worker = spawn("perl", ["-e", "use POSIX; POSIX::close($_) for 3 .. 255; exec { $ARGV[0] } @ARGV; exit 127", process.execPath, SELF, "--apply", file], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  worker.unref();
  if (late) hangForever();
  while (!existsSync(`${file}.done`)) sleepMs(20);
  const result = readJson(`${file}.done`, { status: 125 });
  if (hang) hangForever();
  if (result.out) process.stdout.write(result.out);
  if (result.err) process.stderr.write(result.err);
  process.exit(result.status);
}
// A query changes nothing; it only answers (or hangs, or fails).
function answer(text, status = 0) {
  const hang = fault("hang");
  const fail = fault("fail");
  const slow = fault("slow");
  if (fail) process.exit(fail.status ?? 1);
  if (hang) hangForever();
  if (slow) sleepMs(slow.ms);
  if (text) process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
  process.exit(status);
}
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const noSuch = () => {
  process.stderr.write("Error: No such object\n");
  const fail = fault("fail");
  process.exit(fail?.status ?? 1);
};

function render(format, c) {
  const run = running(c);
  const health = faults().health?.[c.image] ?? "healthy";
  const known = {
    "{{.Id}} {{.Image}} {{.State.Running}} {{.State.Status}} policy={{.HostConfig.RestartPolicy.Name}}": `${c.id} ${c.image} ${run} ${run ? "running" : c.status === "running" ? "exited" : c.status} policy=${c.policy}`,
    "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}": run ? health : "unhealthy",
    "{{json .HostConfig.PortBindings}}": JSON.stringify({ "8787/tcp": (c.ports || []).map((p) => ({ HostIp: p.ip, HostPort: p.port })) }),
    "{{range .Mounts}}{{.Type}} {{.Source}} {{.Destination}} {{.RW}}{{println}}{{end}}": `${(c.mounts || []).map((m) => `bind ${m.source} ${m.target} ${m.rw}`).join("\n")}\n`,
    "{{.HostConfig.Privileged}} {{len .HostConfig.CapAdd}} {{len .HostConfig.Devices}} {{.HostConfig.NetworkMode}} {{.HostConfig.AutoRemove}}": `${Boolean(c.privileged)} 0 0 ${c.network || "bridge"} ${Boolean(c.autoRemove)}`,
    "{{range .Config.Env}}{{println .}}{{end}}": `${(c.env || []).join("\n")}\n`,
  };
  if (!(format in known)) {
    process.stderr.write(`fake docker inspect: unknown format ${format}\n`);
    process.exit(125);
  }
  return known[format];
}

const cmd = argv[0];
if (cmd === "image" && argv[1] === "load") {
  // What a real load does with a release archive: the image is there, under its name and its ID.
  // The synthetic archive's release.json, beside it, says which.
  const rel = readJson(join(dirname(flag("--input")), "release.json"), null);
  if (!rel) {
    process.stderr.write("fake docker image load: no release.json beside the archive\n");
    process.exit(1);
  }
  const all = images();
  const entry = { id: rel.image_id, env: ["PATH=/usr/local/bin:/usr/bin", "NODE_ENV=production"] };
  all[rel.image_id] = entry;
  all[rel.tag] = entry;
  writeJson(join(S, "images.json"), all);
  answer(`Loaded image: ${rel.tag}`);
} else if (cmd === "image" && argv[1] === "inspect") {
  const format = flag("--format");
  const img = imageOf(argv[argv.length - 1]);
  if (!img) noSuch();
  if (format === "{{.Id}}") answer(img.id);
  if (format === "{{.Os}}/{{.Architecture}}") answer("linux/amd64");
  if (format === "{{.Config.User}}") answer("node");
  if (format === "{{range .Config.Env}}{{println .}}{{end}}") answer(`${(img.env || []).join("\n")}\n`);
  process.stderr.write(`fake docker image inspect: unknown format ${format}\n`);
  process.exit(125);
} else if (cmd === "inspect") {
  const c = find(argv[argv.length - 1]);
  if (!c) noSuch();
  answer(render(flag("--format"), c));
} else if (cmd === "ps") {
  const all = argv.includes("-aq") || argv.includes("-a");
  const filter = flag("--filter") || "";
  let list = containers();
  if (filter.startsWith("label=com.docker.compose.project=")) list = list.filter((c) => c.project === filter.split("=")[2]);
  else if (filter.startsWith("name=")) {
    const re = new RegExp(filter.slice(5));
    list = list.filter((c) => re.test(`/${c.name}`));
  }
  if (!all) list = list.filter(running);
  answer(list.map((c) => c.id).join("\n"));
} else if (cmd === "stop") {
  submit({ kind: "stop", refs: argv.slice(1).filter((a, i, l) => a !== "-t" && l[i - 1] !== "-t") });
} else if (cmd === "start") {
  if (!find(argv[1])) noSuch();
  submit({ kind: "start", ref: argv[1] });
} else if (cmd === "rm") {
  submit({ kind: "rm", refs: argv.slice(1).filter((a) => a !== "-f") });
} else if (cmd === "exec") {
  const c = find(argv[1]);
  if (!c || !running(c)) noSuch();
  const rest = argv.slice(2);
  const mounts = (c.mounts || []).slice().sort((x, y) => y.target.length - x.target.length);
  const map = (text) => {
    for (const m of mounts) text = text.split(`${m.target}/`).join(`${m.source}/`).split(`${m.target} `).join(`${m.source} `);
    for (const m of mounts) if (text === m.target) text = m.source;
    return text;
  };
  const hang = fault("hang");
  const fail = fault("fail");
  if (fail) process.exit(fail.status ?? 1);
  if (hang) hangForever();
  let r;
  if (rest[0] === "sh" && rest[1] === "-c") r = spawnSync("sh", ["-c", map(rest[2])], { stdio: "inherit" });
  else if (rest[0] === "node" && rest[1] === "-e") r = spawnSync("node", ["-e", rest[2], ...rest.slice(3).map(map)], { stdio: "inherit" });
  else process.exit(125);
  process.exit(r.status ?? 1);
} else if (cmd === "run") {
  const args = argv.slice(1);
  const mounts = [];
  let entry = "";
  let name = "";
  let user = "";
  let i = 0;
  for (; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--rm") continue;
    if (["--network", "--platform"].includes(a)) {
      i += 1;
      continue;
    }
    if (a === "--user") {
      user = args[++i];
      continue;
    }
    if (a === "--name") {
      name = args[++i];
      continue;
    }
    if (a === "--entrypoint") {
      entry = args[++i];
      continue;
    }
    if (a === "-v") {
      const [source, target, mode] = args[++i].split(":");
      mounts.push({ source, target, rw: mode !== "ro" });
      continue;
    }
    break;
  }
  const image = imageOf(args[i]);
  if (!image) {
    process.stderr.write("Unable to find image locally\n");
    process.exit(125);
  }
  // load-release.sh's probe that the image does not run as root.
  if (entry === "node" && args[i + 1] === "-p") answer("1000");
  if (name && find(name)) {
    process.stderr.write("Conflict. The container name is already in use\n");
    process.exit(125);
  }
  const id = createHash("sha256").update(randomBytes(16)).digest("hex");
  save({ id, name: name || `helper-${id.slice(0, 8)}`, image: image.id, status: "running", pid: 0, helper: true, policy: "no", env: [], mounts: [] });
  appendFileSync(join(S, "helpers.log"), `${name} ${image.id} ${entry} ${mounts.map((m) => (m.rw ? "rw" : "ro")).join(",")}\n`);
  submit({ kind: "run", id, entry, user, mounts, args: args.slice(i + 1) });
} else if (cmd === "compose") {
  const args = argv.slice(1);
  let project = "";
  let envFile = "";
  let file = "";
  while (args.length && args[0].startsWith("-")) {
    const a = args.shift();
    if (a === "-p") project = args.shift();
    else if (a === "--env-file") envFile = args.shift();
    else if (a === "-f") file = args.shift();
  }
  const sub = args.shift();
  if (sub === "config") {
    const { createRequire } = await import("node:module");
    const YAML = createRequire(`${process.env.FAKE_REPO_ROOT}/package.json`)("yaml");
    const env = {};
    for (const row of readFileSync(envFile, "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(row);
      if (m) env[m[1]] = m[2];
    }
    let missing = false;
    const text = readFileSync(file, "utf8").replace(/\$\{([A-Z0-9_]+)(?::([?-])([^}]*))?\}/g, (_, k, op, arg) => {
      if (env[k] !== undefined && env[k] !== "") return env[k];
      if (op === "-") return arg;
      if (op === "?") missing = true;
      return "";
    });
    if (missing) {
      process.stderr.write("required variable is missing\n");
      process.exit(1);
    }
    const doc = YAML.parse(text);
    const out = { name: project || doc.name, networks: { default: { name: `${project || doc.name}_default`, ipam: {} } }, services: {} };
    for (const [name, s] of Object.entries(doc.services)) {
      const t = { command: null, entrypoint: null, networks: { default: null }, ...s };
      t.ports = (s.ports || []).map((p) => {
        const [ip, pub, target] = String(p).split(":");
        return { mode: "ingress", host_ip: ip, target: Number(target), published: pub, protocol: "tcp" };
      });
      t.volumes = (s.volumes || []).map((v) => {
        const [source, target, mode] = String(v).split(":");
        return { type: "bind", source, target, ...(mode === "ro" ? { read_only: true } : {}), bind: {} };
      });
      out.services[name] = t;
    }
    answer(JSON.stringify(sorted(out), null, 2));
  } else if (sub === "up") {
    const bytes = readFileSync(file === "-" ? 0 : file);
    submit({ kind: "up", project, bytes: bytes.toString("base64") });
  } else {
    process.exit(125);
  }
} else {
  process.stderr.write(`fake docker: unknown command ${cmd}\n`);
  process.exit(125);
}
