#!/usr/bin/env node
// pnpm verify: run, on this machine, what GitHub runs on a core pull request (ojfbot/core#650).
//
//   pnpm verify                 every job of every workflow that runs on pull_request, in file order
//   pnpm verify --quick         the build and unit tests only (ci/build-test), on your working tree
//   pnpm verify --job <name>    one job or one workflow (repeatable), whatever its path filter says;
//                               --list shows the names
//   pnpm verify --native        run on this machine and working tree instead of the Linux runner
//   pnpm verify --verbose       also stream every step's output
//   pnpm verify --check         check that this script and the workflows still agree, run nothing; a
//                               job, step, service or action-input key it does not understand (such
//                               as `shell:` or `needs:`) is reported by name, never skipped
//
// Jobs, steps, environment variables, service containers and step order are read from
// .github/workflows/*.yml, so they cannot drift. What a laptop cannot take from the workflow files
// (the GitHub actions that install Node and pnpm) is stood in for below; what only GitHub can do
// (secrets, the GitHub API, external actions) is reported SKIPPED with the reason, never passed.
// Each job prints PASS, FAIL, SKIPPED or INCOMPLETE (a step skipped by its own `if:`); the summary at
// the end is meant to be pasted into the pull request. Containers started here are removed when it
// ends, including on failure and Ctrl-C.
//
// Ported from LocalHelp's scripts/verify.mjs (LocalHelp issues #74 and #85).
import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_NODE,
  EVENT,
  FIX_HINTS,
  GITHUB_ONLY,
  GitHubOnly,
  JOB_NEEDS,
  QUICK_JOBS,
  checkPlan,
  expectedLocalSkip,
  githubOnlyReason,
  loadWorkflows,
  outOfScope,
  pathFilterMatches,
  requestedNode,
  stepCondition,
  substitute,
} from "./lib/verify-ci.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
// CORE_VERIFY_WORKFLOWS points the drift test at a folder of doctored workflow files.
const workflowDir = process.env.CORE_VERIFY_WORKFLOWS ?? join(repoRoot, ".github/workflows");

// ---------------------------------------------------------------------------------------------
// Arguments

const args = process.argv.slice(2);
const options = { quick: false, native: false, jobs: [], verbose: false, check: false, list: false };
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--quick") options.quick = true;
  else if (arg === "--verbose") options.verbose = true;
  else if (arg === "--native") options.native = true;
  else if (arg === "--check") options.check = true;
  else if (arg === "--list") options.list = true;
  else if (arg === "--job") options.jobs.push(args[(i += 1)] ?? "");
  else if (arg.startsWith("--job=")) options.jobs.push(arg.slice(6));
  else usage(arg === "--help" || arg === "-h" ? 0 : 2, arg === "--help" || arg === "-h" ? "" : `unknown option ${arg}`);
}

function usage(code, message) {
  if (message) console.error(`verify: ${message}`);
  console.error("usage: pnpm verify [--quick | --job <name>... | --list | --check] [--native] [--verbose]");
  process.exit(code);
}

/** Off Linux, jobs run in the runner container on a clean clone of HEAD; --quick and --native run on this machine. */
const useRunner = () => process.platform !== "linux" && !options.native && !options.quick;

const workflows = loadWorkflows(workflowDir);
const inScope = workflows.filter((workflow) => workflow.pullRequest);
const allJobs = inScope.flatMap((workflow) => workflow.jobs.map((job) => ({ ...job, workflow })));
const jobKeys = allJobs.map((job) => job.key);

if (options.list) {
  console.log(JSON.stringify(jobKeys));
  process.exit(0);
}
if (options.check) {
  const problems = checkPlan(workflows);
  for (const problem of problems) console.error(`verify: ${problem}`);
  if (problems.length === 0) {
    console.log(`verify: the workflows and verify agree on ${jobKeys.length} jobs in ${inScope.length} workflows that run on pull_request`);
    const others = outOfScope(workflows);
    if (others.length > 0) console.log(`verify: not run on pull_request, so not checked: ${others.join("; ")}`);
  }
  process.exit(problems.length === 0 ? 0 : 1);
}
const drift = checkPlan(workflows);
if (drift.length > 0) {
  for (const problem of drift) console.error(`verify: ${problem}`);
  console.error("verify: the workflows and scripts/verify.mjs disagree; fix that first (see the lines above).");
  process.exit(1);
}

/** A `--job` value names a whole workflow (`ci`), one job (`ci/build-test`) or a job id used once (`release-image`). */
function resolveJobName(name) {
  const exact = allJobs.filter((job) => job.key === name || job.workflow.stem === name || job.workflow.file === name);
  if (exact.length > 0) return exact;
  return allJobs.filter((job) => job.id === name);
}
const forced = new Set();
for (const name of options.jobs) {
  const matches = resolveJobName(name);
  if (matches.length === 0) usage(2, `no CI job "${name}"; the jobs are: ${jobKeys.join(", ")}`);
  for (const job of matches) forced.add(job.key);
}
if (options.quick && options.jobs.length > 0) usage(2, "--quick and --job cannot be combined");
const selected = options.quick
  ? allJobs.filter((job) => QUICK_JOBS.includes(job.key))
  : options.jobs.length > 0
    ? allJobs.filter((job) => forced.has(job.key))
    : allJobs;

// ---------------------------------------------------------------------------------------------
// Where things live. Everything verify creates is under one folder outside the repository.

const runId = randomBytes(4).toString("hex");
const stateRoot = join(
  process.env.CORE_VERIFY_DIR ?? join(process.env.TMPDIR ?? tmpdir(), "core-verify"),
  createHash("sha256").update(repoRoot).digest("hex").slice(0, 10),
);
const scratch = join(stateRoot, "scratch");
const logDir = join(stateRoot, "logs");
rmSync(logDir, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
mkdirSync(logDir, { recursive: true });

/** A path as it is safe to print, and to paste into a public pull request: no home folder, no user temp folder. */
function shown(path) {
  let text = String(path);
  const tmp = process.env.TMPDIR ?? tmpdir();
  for (const [prefix, label] of [[tmp.replace(/\/$/, ""), "$TMPDIR"], [homedir(), "~"]]) {
    if (prefix && text.startsWith(prefix)) text = label + text.slice(prefix.length);
  }
  return text;
}
const shownLogs = `${shown(stateRoot)}/logs`;

const started = Date.now();
const warnings = [];
const notes = [];
const results = [];
let currentChild = null;
let interrupted = null;
const startedContainers = new Set();
let containersBefore = new Set();
let imagesBefore = new Set();

const out = (text = "") => process.stdout.write(`${text}\n`);
const seconds = (ms) => {
  const total = Math.round(ms / 1000);
  return total >= 60 ? `${Math.floor(total / 60)}m${String(total % 60).padStart(2, "0")}s` : `${total}s`;
};
const run = (command, argv, extra = {}) =>
  spawnSync(command, argv, { encoding: "utf8", cwd: repoRoot, ...extra });
const warn = (text) => {
  if (!warnings.includes(text)) warnings.push(text);
};

// ---------------------------------------------------------------------------------------------
// Environment: what a fresh CI runner would see

/** The shell's own settings that CI would not have: pnpm's, and the ones the fleet's tools read. */
function cleanEnvironment() {
  const env = { ...process.env };
  const dropped = [];
  for (const key of Object.keys(env)) {
    const pnpmLeak = /^(npm_|PNPM_)/.test(key) || key === "INIT_CWD";
    const ours = /^(FLEET_|CODEX_|CLAUDE|ANTHROPIC_|DOLT_|HELPDESK_|GH_|GITHUB_)/.test(key) && key !== "CORE_VERIFY_DIR";
    if (pnpmLeak || ours) {
      if (ours) dropped.push(key);
      delete env[key];
    }
  }
  env.PATH = (env.PATH ?? "")
    .split(delimiter)
    .filter((entry) => !entry.endsWith("/node_modules/.bin") && !entry.includes("/node_modules/.pnpm/"))
    .join(delimiter);
  env.CI = "true";
  env.GITHUB_ACTIONS = "true";
  env.NO_COLOR = "1"; // logs are files, not a terminal
  delete env.FORCE_COLOR;
  if (dropped.length > 0 && !useRunner()) {
    notes.push(`ignored ${dropped.length} variable(s) from your shell that CI does not have (${[...new Set(dropped.map((key) => key.split("_")[0]))].join("_*, ")}_*)`);
  }
  return env;
}
const baseEnv = cleanEnvironment();

function git(...argv) {
  const result = run("git", argv);
  return result.status === 0 ? result.stdout.trim() : null;
}
const head = git("rev-parse", "HEAD");
const dirty = (git("status", "--porcelain") ?? "") !== "";

/**
 * The files a pull request from this branch changes (against main, plus uncommitted work), for
 * `on.pull_request.paths`; null when main is not known, which runs every path-filtered job. CI
 * tests the merge of the branch into main, so a branch behind main is warned about.
 */
function pullRequestFiles() {
  run("git", ["fetch", "--quiet", "origin", "main"], { timeout: 30_000 });
  const base = git("merge-base", "HEAD", "origin/main");
  if (!base) return null;
  const behind = Number(git("rev-list", "--count", "HEAD..origin/main") ?? 0);
  if (behind > 0) warn(`HEAD is ${behind} commit(s) behind origin/main; CI tests the merge into main, so rebase to match`);
  const committed = (git("diff", "--name-only", `${base}..HEAD`) ?? "").split("\n");
  const uncommitted = (git("status", "--porcelain") ?? "").split("\n").map((line) => line.slice(3).replace(/^.* -> /, ""));
  return [...new Set([...committed, ...uncommitted].filter(Boolean))];
}
const changed = options.quick || options.jobs.length > 0 ? null : pullRequestFiles();

// ---------------------------------------------------------------------------------------------
// Docker: preflight, labels, cleanup

function dockerState() {
  const info = run("docker", ["info", "--format", "{{.ServerVersion}}|{{.OSType}}|{{.Architecture}}"], { timeout: 20_000 });
  if (info.error || info.status !== 0) return { ok: false };
  const [version, os, arch] = info.stdout.trim().split("|");
  return { ok: true, version, os, arch };
}
let docker = null;
const dockerNeeded = useRunner() || selected.some((job) => JOB_NEEDS[job.key].includes("docker"));
if (dockerNeeded) {
  docker = dockerState();
  if (docker.ok) {
    containersBefore = new Set(run("docker", ["ps", "-aq"]).stdout.split("\n").filter(Boolean));
    imagesBefore = new Set(run("docker", ["images", "-q", "fleet-runner"]).stdout.split("\n").filter(Boolean));
  }
}

let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  if (docker?.ok) {
    const doomed = new Set();
    for (const id of run("docker", ["ps", "-aq", "--filter", `label=core.verify=${runId}`]).stdout.split("\n").filter(Boolean)) doomed.add(id);
    // BuildKit builder containers made by release-image.sh normally go with the script's own trap;
    // after a kill they are still here.
    for (const id of run("docker", ["ps", "-aq", "--filter", "name=buildx_buildkit_fleet-runner-release-"]).stdout.split("\n").filter(Boolean)) {
      if (!containersBefore.has(id)) doomed.add(id);
    }
    if (doomed.size > 0) run("docker", ["rm", "-f", "-v", ...doomed], { stdio: "ignore" });
    const builders = run("docker", ["buildx", "ls"]).stdout.match(/fleet-runner-release-\d+-\d+/g) ?? [];
    for (const builder of new Set(builders)) run("docker", ["buildx", "rm", "--force", builder], { stdio: "ignore" });
    // The release job loads fleet-runner:<commit> into the engine.
    for (const id of run("docker", ["images", "-q", "fleet-runner"]).stdout.split("\n").filter(Boolean)) {
      if (!imagesBefore.has(id)) run("docker", ["rmi", "-f", id], { stdio: "ignore" });
    }
  }
  for (const name of safeReaddir(stateRoot)) {
    if (name.startsWith("runner-temp-")) rmSync(join(stateRoot, name), { recursive: true, force: true });
  }
}
const safeReaddir = (dir) => {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
};

function killChild(signal) {
  if (!currentChild?.pid) return;
  try {
    process.kill(-currentChild.pid, signal);
  } catch {
    // already gone
  }
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    if (interrupted) return;
    interrupted = signal;
    out(`\nverify: ${signal}; stopping the running step and removing containers...`);
    killChild("SIGTERM");
    setTimeout(() => killChild("SIGKILL"), 8_000).unref();
  });
}
process.on("exit", cleanup);

// ---------------------------------------------------------------------------------------------
// Running one step

function runCommand(command, argv, { env, cwd, logFile }) {
  return new Promise((resolveRun) => {
    const log = createWriteStream(logFile, { flags: "a" });
    const child = spawn(command, argv, {
      cwd,
      env,
      detached: true, // its own process group, so an interrupt can stop everything under it
      stdio: ["ignore", "pipe", "pipe"],
    });
    currentChild = child;
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk) => {
        log.write(chunk);
        if (options.verbose) process.stdout.write(chunk);
      });
    }
    child.on("close", (code, signal) => {
      currentChild = null;
      log.end(() => resolveRun({ code: code ?? (signal ? 128 : 1), signal }));
    });
    child.on("error", (error) => {
      currentChild = null;
      log.write(`verify: could not start the step: ${error.message}\n`);
      log.end(() => resolveRun({ code: 127 }));
    });
  });
}

function tail(file, lines = 40) {
  try {
    return readFileSync(file, "utf8").replace(/\x1b\[[0-9;]*m/g, "").trimEnd().split("\n").slice(-lines).join("\n");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------------------------
// Standing in for the GitHub actions

function sameMajorMinor(a, b) {
  return a.split(".").slice(0, 2).join(".") === b.split(".").slice(0, 2).join(".");
}

/** The Python a workflow asks for: python3.x on PATH, then uv's, then whatever python3 is (with a warning). */
function findPython(wanted) {
  const candidates = [`python${wanted}`];
  const uv = run("uv", ["python", "find", wanted]);
  if (uv.status === 0 && uv.stdout.trim()) candidates.push(uv.stdout.trim());
  candidates.push("python3");
  for (const candidate of candidates) {
    const version = run(candidate, ["-c", "import sys; print('.'.join(map(str, sys.version_info[:3])))"]);
    if (version.status === 0) return { command: candidate, version: version.stdout.trim() };
  }
  return null;
}

const actions = {
  "actions/checkout": (step, job, state) => {
    const ref = step.with?.ref;
    const path = step.with?.path;
    if (!ref && state.runner) return { note: "a clean clone of HEAD in the runner" };
    if (!ref) {
      // The pull request's own code is this working tree.
      return { note: "this working tree stands in for the checkout" };
    }
    const destination = state.runner ? `${state.runner.ws}/${path ?? "."}` : join(repoRoot, path ?? ".");
    if (!state.runner) {
      rmSync(destination, { recursive: true, force: true });
      mkdirSync(destination, { recursive: true });
    }
    if (run("git", ["cat-file", "-e", `${ref}^{commit}`]).status !== 0) {
      const fetched = run("git", ["fetch", "--quiet", "origin", ref]);
      if (fetched.status !== 0) {
        return { fail: `commit ${ref} is not in this clone and could not be fetched: ${fetched.stderr.trim()}`, hint: "Run `git fetch origin` and retry." };
      }
    }
    const sparse = String(step.with?.["sparse-checkout"] ?? "").split(/\s+/).filter(Boolean);
    const archive = run("git", ["archive", "--format=tar", ref, ...(sparse.length > 0 ? ["--", ...sparse] : [])], { encoding: "buffer", maxBuffer: 1 << 28 });
    if (archive.status !== 0) return { fail: `git archive ${ref} failed: ${archive.stderr}` };
    const extract = state.runner
      ? spawnSync("docker", ["exec", "-i", state.runner.name, "sh", "-c", `mkdir -p ${destination} && tar -x -C ${destination}`], { input: archive.stdout })
      : spawnSync("tar", ["-x", "-C", destination], { input: archive.stdout });
    if (extract.status !== 0) return { fail: "could not unpack the reference checkout" };
    return { note: `${ref.slice(0, 7)} unpacked into ${state.runner ? "the runner" : shown(destination)}` };
  },
  "pnpm/action-setup": (step, job, state) => {
    if (state.runner) {
      const have = run("docker", ["exec", state.runner.name, "pnpm", "--version"]).stdout.trim();
      return { note: `pnpm ${have} in the runner` };
    }
    const wanted = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).packageManager?.split("@")[1];
    const have = run("pnpm", ["--version"], { env: baseEnv }).stdout.trim();
    if (wanted && have !== wanted) warn(`pnpm ${have} here, CI uses ${wanted} (package.json packageManager)`);
    return { note: `pnpm ${have}` };
  },
  "actions/setup-node": (step, job, state) => {
    if (state.runner) {
      const have = run("docker", ["exec", state.runner.name, "node", "--version"]).stdout.trim();
      return { note: `node ${have} in the runner` };
    }
    const wanted = requestedNode(step, repoRoot) ?? "";
    // Prefer the exact version from a version manager over whichever Node started verify.
    const managers = [
      join(process.env.FNM_DIR ?? join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "fnm"), "node-versions", `v${wanted}`, "installation", "bin"),
      join(process.env.NVM_DIR ?? join(homedir(), ".nvm"), "versions", "node", `v${wanted}`, "bin"),
    ];
    const managed = wanted ? managers.find((dir) => existsSync(join(dir, "node"))) : undefined;
    if (managed) state.path = [managed, ...state.path];
    const have = run("node", ["--version"], { env: { ...baseEnv, PATH: state.path.join(delimiter) } }).stdout.trim().replace(/^v/, "");
    const matches = wanted && (have === wanted || have.startsWith(`${wanted}.`));
    if (wanted && !matches) warn(`Node ${have} here, CI uses ${wanted}; install ${wanted} (for example \`fnm install ${wanted}\`) or drop --native to match`);
    return { note: `node ${have}${managed ? " (version manager copy)" : ""}` };
  },
  "actions/setup-python": (step, job, state) => {
    const wanted = String(step.with?.["python-version"]);
    if (state.runner) {
      const venv = `${state.runner.base}/venv-${job.id}`;
      const made = run("docker", ["exec", state.runner.name, `python${wanted}`, "-m", "venv", venv]);
      if (made.status !== 0) return { fail: `the runner has no usable python${wanted}: ${made.stderr.trim()}`, hint: "Rebuild the runner image: `docker rmi` the core-verify-runner image and re-run." };
      state.runnerPath = `${venv}/bin:${state.runnerPath}`;
      const version = run("docker", ["exec", state.runner.name, `${venv}/bin/python`, "--version"]).stdout.trim();
      return { note: `${version} in a fresh environment (the runner's)` };
    }
    const found = findPython(wanted);
    if (!found) return { fail: "no Python found", hint: `Install Python ${wanted}: \`uv python install ${wanted}\`.` };
    if (!sameMajorMinor(found.version, wanted)) {
      warn(`Python ${found.version} here, CI uses ${wanted}; install it with \`uv python install ${wanted}\` to match`);
    }
    // A fresh virtual environment per job, as CI's runner starts clean; `python` points into it.
    const venv = join(scratch, `venv-${job.id}`);
    const made = run(found.command, ["-m", "venv", "--clear", venv]);
    if (made.status !== 0) return { fail: `could not create a Python environment: ${made.stderr.trim()}` };
    state.path = [join(venv, "bin"), ...state.path];
    return { note: `python ${found.version} in a fresh environment` };
  },
  "actions/upload-artifact": () => ({ note: "nothing to upload from a local run" }),
};

// ---------------------------------------------------------------------------------------------
// Service containers (`services:`); core's workflows have none today, so this is the path a new one takes

function splitOptions(text) {
  const parts = [];
  for (const match of String(text ?? "").matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) parts.push(match[1] ?? match[2] ?? match[3]);
  return parts;
}

async function startServices(job, ctx, jobLog) {
  for (const [name, service] of Object.entries(job.services)) {
    const container = `core-verify-${runId}-${job.id}-${name}`;
    const argv = ["run", "-d", "--name", container, "--label", `core.verify=${runId}`];
    for (const [key, value] of Object.entries(service.env ?? {})) argv.push("-e", `${key}=${substitute(String(value), ctx)}`);
    // GitHub publishes on every interface; here only on loopback, so a throwaway password is not
    // offered to the network.
    for (const port of service.ports ?? []) argv.push("-p", `127.0.0.1:${port}`);
    argv.push(...splitOptions(service.options), service.image);
    appendFileSync(jobLog, `$ docker ${argv.join(" ")}\n`);
    const result = run("docker", argv);
    appendFileSync(jobLog, `${result.stdout}${result.stderr}`);
    if (result.status !== 0) {
      const portBusy = /port is already allocated|address already in use/i.test(result.stderr);
      return {
        fail: `could not start the ${name} service container (${service.image}): ${result.stderr.trim().split("\n").pop()}`,
        hint: portBusy ? "Something on this machine is already using the port; stop it and re-run." : "Check that Docker has network access to pull the image.",
      };
    }
    startedContainers.add(container);
    const deadline = Date.now() + 120_000;
    for (;;) {
      const health = run("docker", ["inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}", container]).stdout.trim();
      if (health === "healthy" || health === "none") break;
      if (health === "unhealthy" || Date.now() > deadline || interrupted) {
        appendFileSync(jobLog, run("docker", ["logs", "--tail", "40", container]).stdout);
        return { fail: `the ${name} service container did not become healthy (${health})`, hint: "Read the log; try `docker ps -a` and remove stale containers." };
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// The Linux runner container (see scripts/verify-runner/Dockerfile)

/** The Node a job's runner gets: its first setup-node step's version, else the default. */
function nodeFor(job) {
  const step = job.steps.find((s) => s.uses && String(s.uses).startsWith("actions/setup-node"));
  return (step && requestedNode(step, repoRoot)) || DEFAULT_NODE;
}

function runnerImage(node, jobLog) {
  const dir = join(repoRoot, "scripts", "verify-runner");
  const pnpm = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).packageManager.split("@")[1];
  const tag = `core-verify-runner:${createHash("sha256").update(readFileSync(join(dir, "Dockerfile"))).update(`${node} ${pnpm}`).digest("hex").slice(0, 12)}`;
  if (run("docker", ["image", "inspect", tag]).status === 0) return { tag };
  out(`    .. building the Linux runner image for Node ${node} (first time for this version only)`);
  const built = run("docker", ["build", "--build-arg", `NODE_VERSION=${node}`, "--build-arg", `PNPM_VERSION=${pnpm}`, "--tag", tag, dir]);
  appendFileSync(jobLog, `${built.stdout}${built.stderr}`);
  if (built.status !== 0) return { fail: `could not build the runner image: ${built.stderr.trim().split("\n").pop()}`, hint: "Check Docker's network access and that the Node version exists as a node image, then re-run." };
  return { tag };
}

/** Start the runner and put a clean clone of HEAD in it, like actions/checkout. */
function startRunner(job, jobLog) {
  const image = runnerImage(nodeFor(job), jobLog);
  if (image.fail) return image;
  const name = `core-verify-${runId}-${job.id}-runner`;
  const base = `/home/runner/work/${runId}`;
  // The Docker socket is given only to a job that builds images, and then it can do what Docker can do.
  const socket = JOB_NEEDS[job.key].includes("docker")
    ? ["--group-add", "0", "-v", "/var/run/docker.sock:/var/run/docker.sock"]
    : [];
  const started = run("docker", ["run", "-d", "--name", name, "--label", `core.verify=${runId}`, ...socket,
    "-v", "core-verify-pnpm-store:/home/runner/.local/share/pnpm", image.tag]);
  appendFileSync(jobLog, `${started.stdout}${started.stderr}`);
  if (started.status !== 0) return { fail: `could not start the runner: ${started.stderr.trim().split("\n").pop()}`, hint: "Check `docker ps -a`." };
  startedContainers.add(name);
  const exec = (user, ...argv) => run("docker", ["exec", "-u", user, name, ...argv]);
  exec("0", "chown", "runner:runner", "/home/runner/.local/share/pnpm");
  exec("0", "install", "-d", "-o", "runner", "-g", "runner", base, `${base}/temp`, `${base}/tmp`);
  const bundle = run("git", ["bundle", "create", "-", "HEAD"], { encoding: "buffer", maxBuffer: 1 << 30 });
  if (bundle.status !== 0) return { fail: `git bundle failed: ${bundle.stderr}`, hint: "Commit your work first." };
  const copied = spawnSync("docker", ["exec", "-i", name, "sh", "-c", `cat > ${base}/head.bundle`], { input: bundle.stdout, maxBuffer: 1 << 20 });
  const cloned = copied.status === 0 && exec("1001", "sh", "-c", `git clone -q ${base}/head.bundle ${base}/ws && git -C ${base}/ws checkout -q --detach ${head}`);
  if (!cloned || cloned.status !== 0) return { fail: `could not clone HEAD into the runner: ${cloned?.stderr ?? ""}`, hint: "Commit your work first." };
  return { name, base, ws: `${base}/ws`, temp: `${base}/temp`, tmp: `${base}/tmp` };
}

function stopRunner(runner) {
  if (!runner?.name) return;
  run("docker", ["rm", "-f", "-v", runner.name], { stdio: "ignore" });
  startedContainers.delete(runner.name);
}

// ---------------------------------------------------------------------------------------------
// Running one job

function preflight(job) {
  const needs = useRunner() ? [...new Set([...JOB_NEEDS[job.key], "docker", "git-head"])] : JOB_NEEDS[job.key];
  for (const need of needs) {
    if (need === "docker" && !docker?.ok) {
      return { reason: "Docker not running", fix: "start Docker Desktop, wait until it says running, then re-run", kind: "environment" };
    }
    if (need === "buildx" && run("docker", ["buildx", "version"]).status !== 0) {
      return { reason: "Docker Buildx is missing", fix: "update Docker Desktop (it ships Buildx)", kind: "environment" };
    }
    if (need === "git-head" && !head) {
      return { reason: "this folder has no git commit to build from", fix: "commit your work, then re-run", kind: "environment" };
    }
  }
  return null;
}

/** Why GitHub, or this machine, would not run the job at all (a skip that is not a missing check), or null. */
function notRunReason(job, ctx) {
  const only = githubOnlyReason(job, ctx);
  if (only) return { kind: "github-only", detail: `needs GitHub, ${only.short}`, fix: `cannot be checked here: ${only.full}`, summary: `needs GitHub, ${only.short}; not checked locally` };
  if (job.if !== undefined && !forced.has(job.key)) {
    let runs = true;
    try {
      runs = stepCondition(job.if, { succeeded: true });
    } catch (error) {
      return { kind: "fail", detail: error.message, fix: "" };
    }
    if (!runs) return { kind: "condition", detail: "its if: is false on a pull request", fix: `GitHub skips it too (${String(job.if).trim()})` };
  }
  // GitHub starts a path-filtered workflow only when the pull request touches one of its paths.
  // `--quick` and `--job` run what was asked for whatever the filter says.
  const filtered = job.workflow.paths !== null || job.workflow.pathsIgnore !== null;
  if (filtered && changed && !forced.has(job.key) && !options.quick && !pathFilterMatches(job.workflow, changed)) {
    return { kind: "not-triggered", detail: "path filter", fix: `this pull request changes none of the paths that start ${job.workflow.file}, so GitHub does not run it (\`--job ${job.key}\` runs it anyway)` };
  }
  return null;
}

async function runJob(job) {
  const result = { id: job.key, name: job.name, status: "PASS", kind: "", detail: "", fix: "", took: 0, steps: [] };
  const begin = Date.now();
  const sha = head ?? "0".repeat(40);
  const baseCtx = { workspace: repoRoot, runnerTemp: join(stateRoot, `runner-temp-${job.id}`), sha, runId, stepOutputs: {} };
  const skip = notRunReason(job, baseCtx);
  if (skip?.kind === "fail") return { ...result, status: "FAIL", detail: skip.detail, took: Date.now() - begin };
  if (skip) return { ...result, status: "SKIPPED", kind: skip.kind, detail: skip.detail, fix: skip.fix, summary: skip.summary };
  const need = preflight(job);
  if (need) return { ...result, status: "SKIPPED", kind: need.kind, detail: need.reason, fix: need.fix };
  const jobLog = join(logDir, `${job.workflow.stem}-${job.id}.log`);
  writeFileSync(jobLog, "");
  let runner = null;
  let runnerTemp = baseCtx.runnerTemp;
  let jobWorkspace = repoRoot;
  try {
    if (useRunner()) {
      out("    .. starting the Linux runner container and cloning HEAD into it");
      runner = startRunner(job, jobLog);
      if (runner.fail) return { ...result, status: "FAIL", detail: runner.fail, fix: runner.hint, took: Date.now() - begin };
      runnerTemp = runner.temp;
      jobWorkspace = runner.ws;
    } else {
      rmSync(runnerTemp, { recursive: true, force: true });
      mkdirSync(runnerTemp, { recursive: true });
      // A fresh checkout has no build output; neither does the job here.
      for (const pkg of safeReaddir(join(repoRoot, "packages"))) {
        rmSync(join(repoRoot, "packages", pkg, "dist"), { recursive: true, force: true });
      }
    }

    const state = { path: (baseEnv.PATH ?? "").split(delimiter), runner, runnerPath: runner ? run("docker", ["exec", runner.name, "printenv", "PATH"]).stdout.trim() : "" };
    const summaryFile = runner ? `${runnerTemp}/step-summary` : join(runnerTemp, "step-summary");
    const github = { GITHUB_SHA: sha, GITHUB_REF: EVENT.ref, GITHUB_EVENT_NAME: EVENT.name, GITHUB_RUN_ID: runId, GITHUB_STEP_SUMMARY: summaryFile };
    const jobEnv = runner
      ? { CI: "true", GITHUB_ACTIONS: "true", HOME: "/home/runner", NO_COLOR: "1", TMPDIR: runner.tmp, RUNNER_TEMP: runnerTemp, GITHUB_WORKSPACE: jobWorkspace, ...github }
      : { ...baseEnv, RUNNER_TEMP: runnerTemp, GITHUB_WORKSPACE: jobWorkspace, ...github };
    const ctx = {
      workspace: jobWorkspace,
      runnerTemp,
      sha,
      runId,
      stepOutputs: {},
      knownSteps: new Set(job.steps.filter((step) => step.id).map((step) => step.id)),
    };
    const declared = { ...job.workflow.env, ...job.env };
    for (const [key, value] of Object.entries(declared)) jobEnv[key] = substitute(String(value), ctx);

    const failed = await startServices(job, ctx, jobLog);
    if (failed) return { ...result, status: "FAIL", detail: failed.fail, fix: failed.hint, took: Date.now() - begin };

    let succeeded = true;
    const incomplete = [];
    for (const step of job.steps) {
      if (interrupted) break;
      const label = step.name ?? (step.uses ? `uses ${step.uses}` : String(step.run).trim().split("\n")[0]);
      let runIt;
      try {
        runIt = stepCondition(step.if, { succeeded });
      } catch (error) {
        succeeded = false;
        result.status = "FAIL";
        result.detail ||= `step "${label}": ${error.message}`;
        continue;
      }
      if (!runIt) {
        // A step skipped by its own condition is a check that did not run, unless GitHub skips it
        // too on a pull request (EXPECTED_LOCAL_SKIPS, with a reason).
        const expected = step.if === undefined ? null : expectedLocalSkip(job.key, step);
        if (step.if === undefined) out(`    -  ${label} (skipped: an earlier step failed)`);
        else if (expected) out(`    -  ${label} (skipped, as on GitHub: ${expected})`);
        else {
          incomplete.push(`step ${step.index + 1} "${label}" was skipped by its condition (${step.if}), so it was not checked`);
          out(`    !  ${label} (NOT RUN: its if: condition is false for a pull request, so this check did not happen)`);
        }
        continue;
      }
      const stepStart = Date.now();
      let outcome;
      try {
        if (step.uses) {
          const action = actions[String(step.uses).split("@")[0]];
          const resolved = { ...step, with: Object.fromEntries(Object.entries(step.with ?? {}).map(([k, v]) => [k, substitute(String(v), ctx)])) };
          outcome = action(resolved, job, state) ?? {};
        } else {
          const stepEnv = { ...jobEnv };
          stepEnv.PATH = runner ? state.runnerPath : state.path.join(delimiter);
          for (const [key, value] of Object.entries(step.env ?? {})) stepEnv[key] = substitute(String(value), ctx);
          const outputFile = runner ? `${runnerTemp}/output-${step.index}` : join(runnerTemp, `output-${step.index}`);
          if (runner) run("docker", ["exec", runner.name, "touch", outputFile, summaryFile]);
          else {
            writeFileSync(outputFile, "");
            if (!existsSync(summaryFile)) writeFileSync(summaryFile, "");
          }
          stepEnv.GITHUB_OUTPUT = outputFile;
          const script = substitute(step.run, ctx);
          appendFileSync(jobLog, `\n=== ${label}\n$ ${script.trim()}\n`);
          let ran;
          if (runner) {
            const cwd = step["working-directory"] ? `${jobWorkspace}/${step["working-directory"]}` : jobWorkspace;
            const flags = Object.entries(stepEnv).flatMap(([key, value]) => ["-e", `${key}=${value}`]);
            ran = await runCommand("docker", ["exec", "-w", cwd, ...flags, runner.name, "bash", "-e", "-c", script], { env: baseEnv, cwd: repoRoot, logFile: jobLog });
          } else {
            const cwd = step["working-directory"] ? join(repoRoot, step["working-directory"]) : repoRoot;
            ran = await runCommand("bash", ["-e", "-c", script], { env: stepEnv, cwd, logFile: jobLog });
          }
          if (step.id) {
            const text = runner ? run("docker", ["exec", runner.name, "cat", outputFile]).stdout : readFileSync(outputFile, "utf8");
            ctx.stepOutputs[step.id] = Object.fromEntries(
              text.split("\n").filter((line) => line.includes("=")).map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
            );
          }
          outcome = ran.code === 0 ? {} : { fail: ran.signal ? `stopped by ${ran.signal}` : `exit code ${ran.code}`, script };
        }
      } catch (error) {
        if (error instanceof GitHubOnly) {
          result.status = "SKIPPED";
          result.kind = "github-only";
          result.detail = "needs GitHub";
          result.fix = `cannot be checked here: ${error.message}`;
          result.summary = `needs GitHub, ${error.message.split(" (")[0]}; not checked locally`;
          return result;
        }
        outcome = { fail: error.message };
      }
      const took = seconds(Date.now() - stepStart);
      if (outcome.fail && step["continue-on-error"] === true) {
        // GitHub records the step as failed but carries on, and the job stays green.
        out(`    ~  ${label} (${took}): ${outcome.fail}, but the step has continue-on-error, so GitHub continues`);
        warn(`step "${label}" of ${job.key} failed (${outcome.fail}); continue-on-error lets the job pass on GitHub too`);
      } else if (outcome.fail) {
        succeeded = false;
        result.status = "FAIL";
        const hint = outcome.hint ?? FIX_HINTS.find(([pattern]) => pattern.test(`${outcome.script ?? ""} ${step.run ?? ""}`))?.[1] ?? "";
        result.detail ||= `step "${label}": ${outcome.fail}`;
        result.fix ||= hint;
        out(`    X  ${label} (${took}): ${outcome.fail}`);
        const lines = tail(jobLog);
        if (lines && !options.verbose) out(lines.split("\n").map((line) => `         | ${line}`).join("\n"));
      } else {
        out(`    ok ${label} (${took})${outcome.note ? `: ${outcome.note}` : ""}`);
      }
    }
    if (interrupted) return { ...result, status: "FAIL", detail: `interrupted (${interrupted})`, took: Date.now() - begin };
    result.took = Date.now() - begin;
    result.log = jobLog;
    if (job.timeoutMinutes !== undefined && result.took > Number(job.timeoutMinutes) * 60_000) {
      warn(`${job.key} took ${seconds(result.took)}, over its ${job.timeoutMinutes}-minute cap on GitHub (a local run on emulated hardware is slower, so this is a prompt to look, not a failure)`);
    }
    if (result.status === "PASS" && incomplete.length > 0) {
      result.status = "INCOMPLETE";
      result.detail = incomplete.join("; ");
      result.fix = "Take the condition off the step, or add it to EXPECTED_LOCAL_SKIPS in scripts/lib/verify-ci.mjs with a reason.";
    }
    return result;
  } finally {
    stopRunner(runner);
    for (const container of startedContainers) {
      run("docker", ["rm", "-f", "-v", container], { stdio: "ignore" });
      startedContainers.delete(container);
    }
    if (!runner) rmSync(runnerTemp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------------------------
// Main

function platformNotes() {
  if (docker?.ok && docker.arch !== "x86_64" && selected.some((job) => job.key === "fleet-runner-release/release-image")) {
    notes.push(`Docker here is ${docker.arch}; the release image job builds linux/amd64 under emulation, so it runs slower than on GitHub`);
  }
  if (useRunner()) {
    notes.push("jobs run in a Linux container (scripts/verify-runner, Ubuntu 24.04) on a clean clone of HEAD, like GitHub's fresh runner; your working tree and shell are not used");
  } else if (process.platform !== "linux") {
    notes.push("ran natively on macOS and on your working tree (--quick or --native), not in GitHub's Linux environment");
  }
  notes.push(`jobs ran as a pull request would (github.event_name is ${EVENT.name}); pushes to main and workflow_dispatch runs are not simulated`);
  const others = outOfScope(workflows);
  if (others.length > 0) notes.push(`not run on pull_request, so not part of verify: ${others.join("; ")}`);
}

async function main() {
  out(`verify: ${options.quick ? "--quick (the build and unit tests)" : options.jobs.length ? `jobs ${selected.map((j) => j.key).join(", ")}` : `all ${selected.length} jobs of the ${inScope.length} workflows that run on pull_request`}; logs in ${shownLogs}`);
  out(`verify: HEAD ${head?.slice(0, 7) ?? "none"}${dirty ? ", with uncommitted changes (CI sees only what you push; a runner job tests HEAD only)" : ", clean"}`);
  platformNotes();
  for (const job of selected) {
    out(`\n== ${job.key}: ${job.name}`);
    const result = await runJob(job);
    results.push(result);
    out(`   ${result.status} ${job.key}${result.detail ? `: ${result.detail}` : ""}${result.fix ? `\n          ${result.status === "SKIPPED" ? "why" : "fix"}: ${result.fix}` : ""}`);
    if (interrupted) break;
  }
}

await main();
cleanup();

const total = Date.now() - started;
const failed = results.filter((r) => r.status === "FAIL");
const incompleteJobs = results.filter((r) => r.status === "INCOMPLETE");
// Cannot be checked here by design, or GitHub would not run them either: stated, but not a gap to close.
const byDesign = results.filter((r) => r.status === "SKIPPED" && ["github-only", "not-triggered", "condition"].includes(r.kind));
// Skipped only because this machine is not ready (Docker is off): a check that could run and did not.
const missed = results.filter((r) => r.status === "SKIPPED" && !["github-only", "not-triggered", "condition"].includes(r.kind));
const notRun = allJobs.filter((job) => !selected.includes(job));
const width = Math.max(...results.map((r) => r.id.length), 8);
out("");
out(`verify summary - ${new Date().toISOString().slice(0, 19)}Z, HEAD ${head?.slice(0, 7) ?? "none"} ${dirty ? "(uncommitted changes)" : "(clean)"}, ${seconds(total)} wall clock`);
for (const r of results) {
  const text =
    r.status === "SKIPPED" || r.status === "INCOMPLETE"
      ? (r.summary ?? `${r.detail}: ${r.fix}`)
      : r.status === "FAIL"
        ? r.detail
        : seconds(r.took);
  out(`${r.status.padEnd(10)} ${r.id.padEnd(width)}  ${text}`);
}
if (notRun.length > 0 && !interrupted) out(`not run (${options.quick ? "--quick" : "--job"}): ${notRun.map((j) => j.key).join(", ")}`);
for (const text of [...warnings.map((w) => `WARNING ${w}`), ...notes.map((n) => `note: ${n}`)]) out(text);
if (interrupted) {
  out("verify: interrupted; containers and scratch folders were removed");
  process.exit(130);
}
if (failed.length > 0) {
  out(`verify: ${failed.length} job(s) FAILED; logs are in ${shownLogs}`);
  process.exit(1);
}
if (incompleteJobs.length > 0 || missed.length > 0) {
  out(`verify: ${incompleteJobs.length + missed.length} job(s) INCOMPLETE or SKIPPED because this machine was not ready, so not everything was checked; fix the reason above and run again`);
  process.exit(2);
}
const partial = options.quick || options.jobs.length > 0;
const designNote = byDesign.length > 0 ? `; ${byDesign.length} job(s) are SKIPPED by design (${byDesign.map((r) => r.id).join(", ")}) and are only checked by GitHub or not triggered by this pull request` : "";
out(partial ? `verify: the selected jobs pass (this was not the full set)${designNote}` : `verify: every job that can run here passes${designNote}`);
