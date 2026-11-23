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
// Jobs, steps, environment variables and step order are read from
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
  symlinkSync,
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
  OPT_IN_JOBS,
  QUICK_JOBS,
  assertRemovable,
  buildNativeEnv,
  checkPlan,
  checkoutDestination,
  describeHostMismatch,
  expectedLocalSkip,
  githubOnlyReason,
  loadWorkflows,
  isLocalReusable,
  resolveLocalReusable,
  outOfScope,
  pathFilterMatches,
  redactText,
  requestedNode,
  runnerFor,
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

/** Jobs run in the runner container on a clean clone of HEAD, on Linux hosts too (a host is not the job's runs-on image); --quick and --native run on this machine. */
const useRunner = () => !options.native && !options.quick;

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

/** Delete a folder verify made, or a package's git-ignored dist; refuses the repository and anything else (assertRemovable). */
function remove(target) {
  rmSync(assertRemovable(target, { repoRoot, stateRoot }), { recursive: true, force: true });
}
remove(logDir);
mkdirSync(scratch, { recursive: true });
mkdirSync(logDir, { recursive: true });

/**
 * Text as it is safe to print, log and paste into a public pull request: the home folder, the
 * repository root and the user temp folder are replaced (redactText). Every line verify prints or
 * writes to a log goes through it, including the output of the steps themselves.
 */
const redact = (text) =>
  redactText(text, {
    repoRoot,
    home: homedir(),
    tmp: process.env.TMPDIR ?? tmpdir(),
    extra: [[`/home/runner/work/${runId}`, "<runner>"]],
  });
const shown = redact;
const shownLogs = `${shown(stateRoot)}/logs`;

const started = Date.now();
const warnings = [];
const notes = [];
const results = [];
let currentChild = null;
let interrupted = null;
const startedContainers = new Set();
let containersBefore = new Set();
const ownedImageTags = new Set(); // tags this run saw absent before its release job started: the only ones it may remove

const out = (text = "") => process.stdout.write(`${redact(text)}\n`);
const appendLog = (file, text) => appendFileSync(file, redact(text));
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

/** This machine's PATH without the entries pnpm adds to a script it runs (CI has none of them). */
const cleanPath = (process.env.PATH ?? "")
  .split(delimiter)
  .filter((entry) => !entry.endsWith("/node_modules/.bin") && !entry.includes("/node_modules/.pnpm/"))
  .join(delimiter);
const nativeHome = join(stateRoot, "home");
const nativeTmp = join(stateRoot, "tmp");
// Fresh every run: nothing a previous branch left in HOME or TMPDIR (a cache, a config file) carries over.
remove(nativeHome);
remove(nativeTmp);
mkdirSync(nativeHome, { recursive: true });
mkdirSync(nativeTmp, { recursive: true });

/**
 * What a job run on this machine (not in the runner) can see: an allowlist (buildNativeEnv), never
 * this shell's own environment, so no API key, cloud credential or agent socket reaches the pull
 * request's code. `docker` is the extra a job that builds images gets: the engine's address and
 * the CLI plugins, because the scratch HOME has neither.
 */
const dockerEndpoint = () => run("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]).stdout.trim();
function nativeEnvironment({ docker: needsDocker } = {}) {
  const { env, dropped } = buildNativeEnv(process.env, { home: nativeHome, tmp: nativeTmp, path: cleanPath });
  if (needsDocker) {
    const config = join(stateRoot, "docker-config");
    mkdirSync(config, { recursive: true });
    const plugins = join(homedir(), ".docker", "cli-plugins");
    if (existsSync(plugins) && !existsSync(join(config, "cli-plugins"))) symlinkSync(plugins, join(config, "cli-plugins"));
    env.DOCKER_CONFIG = config;
    env.DOCKER_HOST = process.env.DOCKER_HOST ?? dockerEndpoint();
    env.BUILDX_CONFIG = join(stateRoot, `buildx-${runId}`);
  }
  if (!useRunner() && !notes.some((note) => note.startsWith("jobs on this machine"))) {
    notes.push(`jobs on this machine get a minimal environment (${dropped} variables of your shell are not passed on; HOME and TMPDIR are scratch folders)`);
  }
  return env;
}
/** The docker client's own environment, for the commands verify runs itself; never given to a step. */
const hostEnv = process.env;

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

// Facts the locally run reusable workflows need (adr:deterministic-fleet-versioning): the commits
// since origin/main, the branch, and the pull request title when `gh` knows one. A job-level
// `uses:` of one of this repository's reusable workflows is replaced by the steps verify maps it
// to (LOCAL_REUSABLE), in place, so it runs like any other job and is never SKIPPED as GitHub-only.
function reusableFacts() {
  const base = git("merge-base", "HEAD", "origin/main");
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  const found = run("gh", ["pr", "view", "--json", "title", "--jq", ".title"], { timeout: 20_000 });
  const title = found.status === 0 && found.stdout.trim() !== "" ? found.stdout.trim() : null;
  const titleSkip = title !== null ? null : found.error ? "the gh CLI is not available here" : "gh found no pull request for this branch";
  if (title === null) warn(`pull request title: SKIPPED (${titleSkip}); the commits are still linted, the title is checked on GitHub`);
  return { base, head, branch, title, titleSkip };
}
const needsFacts = (job) => job.uses && isLocalReusable(job.uses);
if (selected.some(needsFacts)) {
  const facts = reusableFacts();
  for (const job of allJobs) if (needsFacts(job)) Object.assign(job, resolveLocalReusable(job, workflows, facts));
}

// ---------------------------------------------------------------------------------------------
// Docker: preflight, labels, cleanup

function dockerState() {
  const info = run("docker", ["info", "--format", "{{.ServerVersion}}|{{.OSType}}|{{.Architecture}}"], { timeout: 20_000 });
  if (info.error || info.status !== 0) return { ok: false };
  const [version, os, arch] = info.stdout.trim().split("|");
  // Older Docker CLIs exit 0 with an empty server section when the daemon is unreachable.
  if (!version) return { ok: false };
  return { ok: true, version, os, arch };
}
let docker = null;
const dockerNeeded = useRunner() || selected.some((job) => JOB_NEEDS[job.key].includes("docker"));
if (dockerNeeded) {
  docker = dockerState();
  if (docker.ok) {
    containersBefore = new Set(run("docker", ["ps", "-aq"]).stdout.split("\n").filter(Boolean));
  }
}

let cleaned = false;
/** Builders this run made natively live in its own BUILDX_CONFIG (instances/<name>); in the runner, in the container's. */
const nativeBuildxConfig = () => join(stateRoot, `buildx-${runId}`);
function removeNativeBuilders() {
  const env = { ...hostEnv, BUILDX_CONFIG: nativeBuildxConfig() };
  for (const name of safeReaddir(join(nativeBuildxConfig(), "instances"))) {
    run("docker", ["buildx", "rm", "--force", name], { env, stdio: "ignore" });
  }
  remove(nativeBuildxConfig());
}
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  if (docker?.ok) {
    // Only what this run started: containers carrying its label, builders in its own buildx store
    // (a concurrent run's builders, or yours, are never touched), and the image the release job
    // tagged for this HEAD when it did not exist before.
    const doomed = run("docker", ["ps", "-aq", "--filter", `label=core.verify=${runId}`]).stdout.split("\n").filter(Boolean);
    if (existsSync(nativeBuildxConfig())) removeNativeBuilders();
    if (doomed.length > 0) run("docker", ["rm", "-f", "-v", ...doomed], { stdio: "ignore" });
    for (const tag of ownedImageTags) run("docker", ["rmi", "-f", tag], { stdio: "ignore" });
  }
  for (const name of safeReaddir(stateRoot)) {
    if (name.startsWith("runner-temp-")) remove(join(stateRoot, name));
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
    // Whole lines only, so a path split across two chunks is still redacted; the log gets the same text.
    const pending = new Map();
    const emit = (stream, text, final = false) => {
      const buffered = (pending.get(stream) ?? "") + text;
      const cut = final ? buffered.length : buffered.lastIndexOf("\n") + 1;
      pending.set(stream, buffered.slice(cut));
      if (cut === 0) return;
      const safe = redact(buffered.slice(0, cut));
      log.write(safe);
      if (options.verbose) process.stdout.write(safe);
    };
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk) => emit(stream, chunk.toString("utf8")));
    }
    child.on("close", (code, signal) => {
      currentChild = null;
      for (const stream of [child.stdout, child.stderr]) emit(stream, "", true);
      log.end(() => resolveRun({ code: code ?? (signal ? 128 : 1), signal }));
    });
    child.on("error", (error) => {
      currentChild = null;
      log.write(redact(`verify: could not start the step: ${error.message}\n`));
      log.end(() => resolveRun({ code: 127 }));
    });
  });
}

function tail(file, lines = 40) {
  try {
    return redact(readFileSync(file, "utf8")).replace(/\x1b\[[0-9;]*m/g, "").trimEnd().split("\n").slice(-lines).join("\n");
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
    // Another ref is only ever unpacked into the runner container's own workspace. On this machine
    // it would be this repository, which verify never overwrites (checkoutDestination refuses).
    let destination;
    try {
      destination = checkoutDestination({ base: state.runner?.ws ?? repoRoot, path, native: !state.runner });
    } catch (error) {
      return { fail: error.message, hint: "Run without --native / --quick so the job gets the Linux runner." };
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
    const extract = spawnSync("docker", ["exec", "-i", state.runner.name, "sh", "-c", 'mkdir -p "$1" && tar -x -C "$1"', "sh", destination], { input: archive.stdout });
    if (extract.status !== 0) return { fail: "could not unpack the reference checkout" };
    return { note: `${ref.slice(0, 7)} unpacked into the runner` };
  },
  "pnpm/action-setup": (step, job, state) => {
    if (state.runner) {
      const have = run("docker", ["exec", state.runner.name, "pnpm", "--version"]).stdout.trim();
      return { note: `pnpm ${have} in the runner` };
    }
    const wanted = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).packageManager?.split("@")[1];
    const have = run("pnpm", ["--version"], { env: { ...nativeEnvironment(), PATH: state.path.join(delimiter) } }).stdout.trim();
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
    const have = run("node", ["--version"], { env: { ...nativeEnvironment(), PATH: state.path.join(delimiter) } }).stdout.trim().replace(/^v/, "");
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
  // Uploading is GitHub-only: the step is reported as not run, and never counts as a check that passed.
  "actions/upload-artifact": () => ({ notRun: "uploading an artifact is GitHub-only; nothing is uploaded from a local run" }),
};

// ---------------------------------------------------------------------------------------------
// The Linux runner container (see scripts/verify-runner/Dockerfile)

/** The Node a job's runner gets: its first setup-node step's version, else the default. */
function nodeFor(job) {
  const step = job.steps.find((s) => s.uses && String(s.uses).startsWith("actions/setup-node"));
  return (step && requestedNode(step, repoRoot)) || DEFAULT_NODE;
}

function runnerImage(node, ubuntu, jobLog) {
  const dir = join(repoRoot, "scripts", "verify-runner");
  const pnpm = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).packageManager.split("@")[1];
  const tag = `core-verify-runner:${createHash("sha256").update(readFileSync(join(dir, "Dockerfile"))).update(`${node} ${pnpm} ${ubuntu}`).digest("hex").slice(0, 12)}`;
  if (run("docker", ["image", "inspect", tag]).status === 0) return { tag };
  out(`    .. building the Linux runner image for Ubuntu ${ubuntu} and Node ${node} (first time for this pair only)`);
  const built = run("docker", ["build", "--build-arg", `UBUNTU_VERSION=${ubuntu}`, "--build-arg", `NODE_VERSION=${node}`, "--build-arg", `PNPM_VERSION=${pnpm}`, "--tag", tag, dir]);
  appendLog(jobLog, `${built.stdout}${built.stderr}`);
  if (built.status !== 0) return { fail: `could not build the runner image: ${built.stderr.trim().split("\n").pop()}`, hint: "Check Docker's network access and that the Node version exists as a node image, then re-run." };
  return { tag };
}

/** Start the runner and put a clean clone of HEAD in it, like actions/checkout. */
function startRunner(job, jobLog) {
  const image = runnerImage(nodeFor(job), runnerFor(job).ubuntu, jobLog);
  if (image.fail) return image;
  const name = `core-verify-${runId}-${job.id}-runner`;
  const base = `/home/runner/work/${runId}`;
  // --init: process-group tests need a PID 1 that reaps exited children, as GitHub's runner has.
  // The Docker socket is given only to a job that builds images, and then it can do what Docker can do.
  const socket = JOB_NEEDS[job.key].includes("docker")
    ? ["--group-add", "0", "-v", "/var/run/docker.sock:/var/run/docker.sock"]
    : [];
  const started = run("docker", ["run", "-d", "--init", "--name", name, "--label", `core.verify=${runId}`, ...socket,
    "-v", "core-verify-pnpm-store:/home/runner/.local/share/pnpm", image.tag]);
  appendLog(jobLog, `${started.stdout}${started.stderr}`);
  if (started.status !== 0) return { fail: `could not start the runner: ${started.stderr.trim().split("\n").pop()}`, hint: "Check `docker ps -a`." };
  startedContainers.add(name);
  const exec = (user, ...argv) => run("docker", ["exec", "-u", user, name, ...argv]);
  exec("0", "chown", "runner:runner", "/home/runner/.local/share/pnpm");
  exec("0", "install", "-d", "-o", "runner", "-g", "runner", base, `${base}/temp`, `${base}/tmp`, `${base}/buildx`);
  const bundle = run("git", ["bundle", "create", "-", "HEAD"], { encoding: "buffer", maxBuffer: 1 << 30 });
  if (bundle.status !== 0) return { fail: `git bundle failed: ${bundle.stderr}`, hint: "Commit your work first." };
  const copied = spawnSync("docker", ["exec", "-i", name, "sh", "-c", `cat > ${base}/head.bundle`], { input: bundle.stdout, maxBuffer: 1 << 20 });
  const cloned = copied.status === 0 && exec("1001", "sh", "-c", `git clone -q ${base}/head.bundle ${base}/ws && git -C ${base}/ws checkout -q --detach ${head}`);
  if (!cloned || cloned.status !== 0) return { fail: `could not clone HEAD into the runner: ${cloned?.stderr ?? ""}`, hint: "Commit your work first." };
  return { name, base, ws: `${base}/ws`, temp: `${base}/temp`, tmp: `${base}/tmp`, buildx: `${base}/buildx` };
}

function stopRunner(runner) {
  if (!runner?.name) return;
  // Builders the job made are in the container's own buildx store, so only this run's are listed.
  // Anything the job's scripts still run is stopped first (they would otherwise make one more).
  run("docker", ["exec", "-u", "0", runner.name, "sh", "-c",
    'for p in $(pgrep -x "bash|docker|node|pnpm|python3|buildx"); do kill -KILL "$p" 2>/dev/null; done; sleep 1; ' +
    `for b in $(ls "${runner.buildx}/instances" 2>/dev/null); do BUILDX_CONFIG="${runner.buildx}" docker buildx rm --force "$b" >/dev/null 2>&1; done`], { stdio: "ignore" });
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
  const target = runnerFor(job);
  if (target?.otherOs) {
    return { kind: "other-os", detail: `needs ${target.otherOs}`, fix: `this job runs on ${target.otherOs}, and verify can only stand in for Linux`, summary: `needs ${target.otherOs}; verify only stands in for Linux, so it is not checked locally` };
  }
  const only = githubOnlyReason(job, ctx);
  if (only) return { kind: "github-only", detail: `needs GitHub, ${only.short}`, fix: `cannot be checked here: ${only.full}`, summary: `needs GitHub, ${only.short}; not checked locally` };
  if (job.if !== undefined && !forced.has(job.key)) {
    let runs = true;
    try {
      runs = stepCondition(job.if, { succeeded: true });
    } catch (error) {
      return { kind: "fail", detail: error.message, fix: "" };
    }
    if (!runs) return { kind: "condition", detail: "its if: is false on a pull request", fix: `GitHub skips it too (${String(job.if).trim()})`, summary: "its if: is false on a pull request, so GitHub skips it too" };
  }
  // GitHub starts a path-filtered workflow only when the pull request touches one of its paths.
  // `--quick` and `--job` run what was asked for whatever the filter says.
  const filtered = job.workflow.paths !== null || job.workflow.pathsIgnore !== null;
  if (filtered && changed && !forced.has(job.key) && !options.quick && !pathFilterMatches(job.workflow, changed)) {
    return { kind: "not-triggered", detail: "path filter", fix: `this pull request changes none of the paths that start ${job.workflow.file}, so GitHub does not run it (\`--job ${job.key}\` runs it anyway)`, summary: "not triggered: this PR changes none of its paths, so GitHub does not run it either" };
  }
  // A job that needs this machine's Docker engine runs only when asked for by name, and the pull
  // request that triggers it must then run it before it is marked ready: that is a gap, not a pass.
  if (job.key in OPT_IN_JOBS && !forced.has(job.key)) {
    return {
      kind: "opt-in",
      detail: "opt-in: not run by default",
      fix: `run \`pnpm verify --job ${job.key}\` before marking the PR ready; it ${OPT_IN_JOBS[job.key]}`,
      summary: `opt-in, NOT RUN: this PR triggers it on GitHub; run \`pnpm verify --job ${job.key}\` (it uses this machine's Docker engine)`,
    };
  }
  return null;
}

/** The host as describeHostMismatch needs it: platform, Linux release (from /etc/os-release) and python3. */
function hostFacts() {
  const facts = { platform: process.platform, osId: "", osVersion: "", python: "" };
  if (process.platform === "linux") {
    try {
      const release = readFileSync("/etc/os-release", "utf8");
      const field = (name) => new RegExp(`^${name}="?([^"\\n]*)"?$`, "m").exec(release)?.[1] ?? "";
      facts.osId = field("ID");
      facts.osVersion = field("VERSION_ID");
    } catch {
      // unknown release: reported as a mismatch
    }
  }
  facts.python = run("python3", ["--version"]).stdout.trim().replace(/^Python /, "");
  return facts;
}

/** When a job runs on this machine, say how it differs from the image its `runs-on` names (the OS and release, and Python). */
function noteHostMismatch(job) {
  const target = runnerFor(job);
  const message = target?.ubuntu ? describeHostMismatch({ label: target.label, ubuntu: target.ubuntu }, hostFacts()) : null;
  if (message) warn(`${job.key} ran natively: ${message}`);
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
  if (job.key in OPT_IN_JOBS) {
    out(`    !! WARNING: ${job.key} runs with this machine's Docker engine: a branch's changes to its scripts could start containers that mount your folders.`);
    out("    !! Run it only on a branch whose changes you have read.");
    warn(`${job.key} ran with this machine's Docker engine (opt-in); read the branch's changes to its build scripts before trusting that run`);
  }
  if (job.key === "fleet-runner-release/release-image" && head && docker?.ok) {
    // The job loads fleet-runner:<HEAD> into the engine. Only a tag this run found absent before
    // the job started is removed afterwards: a release build of another process is never touched.
    const tag = `fleet-runner:${head}`;
    if (run("docker", ["image", "inspect", tag]).status !== 0) ownedImageTags.add(tag);
  }
  const jobLog = join(logDir, `${job.workflow.stem}-${job.id}.log`);
  writeFileSync(jobLog, "");
  let runner = null;
  let runnerTemp = baseCtx.runnerTemp;
  let jobWorkspace = repoRoot;
  try {
    if (useRunner()) {
      const target = runnerFor(job);
      out(`    .. starting the Linux runner (Ubuntu ${target.ubuntu}, the image for runs-on: ${target.label}) and cloning HEAD into it`);
      runner = startRunner(job, jobLog);
      if (runner.fail) return { ...result, status: "FAIL", detail: runner.fail, fix: runner.hint, took: Date.now() - begin };
      runnerTemp = runner.temp;
      jobWorkspace = runner.ws;
    } else {
      noteHostMismatch(job);
      remove(runnerTemp);
      mkdirSync(runnerTemp, { recursive: true });
      // A fresh checkout has no build output; neither does the job here.
      for (const pkg of safeReaddir(join(repoRoot, "packages"))) {
        remove(join(repoRoot, "packages", pkg, "dist"));
      }
    }

    const state = { path: cleanPath.split(delimiter), runner, runnerPath: runner ? run("docker", ["exec", runner.name, "printenv", "PATH"]).stdout.trim() : "" };
    const summaryFile = runner ? `${runnerTemp}/step-summary` : join(runnerTemp, "step-summary");
    const github = { GITHUB_SHA: sha, GITHUB_REF: EVENT.ref, GITHUB_EVENT_NAME: EVENT.name, GITHUB_RUN_ID: runId, GITHUB_STEP_SUMMARY: summaryFile };
    const jobEnv = runner
      ? { CI: "true", GITHUB_ACTIONS: "true", HOME: "/home/runner", NO_COLOR: "1", TMPDIR: runner.tmp, RUNNER_TEMP: runnerTemp, GITHUB_WORKSPACE: jobWorkspace, BUILDX_CONFIG: runner.buildx, ...github }
      : { ...nativeEnvironment({ docker: JOB_NEEDS[job.key].includes("docker") }), RUNNER_TEMP: runnerTemp, GITHUB_WORKSPACE: jobWorkspace, ...github };
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

    let succeeded = true;
    const incomplete = [];
    let checksRun = 0; // `run:` steps that ran and passed: setup actions and skipped steps are not checks
    const notRun = []; // steps that did not run because only GitHub can do them
    const allowed = []; // failed steps whose `continue-on-error: true` lets GitHub carry on
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
          appendLog(jobLog, `\n=== ${label}\n$ ${script.trim()}\n`);
          let ran;
          if (runner) {
            const cwd = step["working-directory"] ? `${jobWorkspace}/${step["working-directory"]}` : jobWorkspace;
            const flags = Object.entries(stepEnv).flatMap(([key, value]) => ["-e", `${key}=${value}`]);
            ran = await runCommand("docker", ["exec", "-w", cwd, ...flags, runner.name, "bash", "-e", "-c", script], { env: hostEnv, cwd: repoRoot, logFile: jobLog });
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
        // GitHub records the step as failed but carries on, and the job stays green. Here the job
        // is reported as passing with an allowed failure, never as a plain PASS.
        out(`    ~  ${label} (${took}): ${outcome.fail}, but the step has continue-on-error, so GitHub continues`);
        allowed.push(`step ${step.index + 1} "${label}" (${outcome.fail})`);
        warn(`${job.key}: step "${label}" FAILED (${outcome.fail}); continue-on-error lets the job pass on GitHub too`);
      } else if (outcome.notRun) {
        out(`    -  ${label} (SKIPPED, GitHub-only: ${outcome.notRun})`);
        notRun.push(`step ${step.index + 1} "${label}"`);
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
        if (!step.uses) checksRun += 1;
        out(`    ok ${label} (${took})${outcome.note ? `: ${outcome.note}` : ""}`);
      }
    }
    if (interrupted) return { ...result, status: "FAIL", detail: `interrupted (${interrupted})`, took: Date.now() - begin };
    result.took = Date.now() - begin;
    result.log = jobLog;
    if (job.timeoutMinutes !== undefined && result.took > Number(job.timeoutMinutes) * 60_000) {
      warn(`${job.key} took ${seconds(result.took)}, over its ${job.timeoutMinutes}-minute cap on GitHub (a local run on emulated hardware is slower, so this is a prompt to look, not a failure)`);
    }
    result.allowed = allowed;
    result.notRun = notRun;
    if (result.status === "PASS" && checksRun === 0 && !incomplete.length) {
      // Nothing but setup steps ran, so there is nothing that passed.
      result.status = "INCOMPLETE";
      result.detail = `no check ran: ${notRun.length > 0 ? `${notRun.join(", ")} cannot run here` : "every step was a setup step or was skipped"}`;
      result.fix = "Run the job's checks, or take the job out of the pull request's workflows.";
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
    if (!runner) remove(runnerTemp);
  }
}

// ---------------------------------------------------------------------------------------------
// Main

function platformNotes() {
  if (docker?.ok && docker.arch !== "x86_64" && selected.some((job) => job.key === "fleet-runner-release/release-image" && forced.has(job.key))) {
    notes.push(`Docker here is ${docker.arch}; the release image job builds linux/amd64 under emulation, so it runs slower than on GitHub`);
  }
  if (useRunner()) {
    const images = [...new Set(selected.map((job) => runnerFor(job)).filter((t) => t?.ubuntu).map((t) => `Ubuntu ${t.ubuntu} for runs-on: ${t.label}`))];
    notes.push(`jobs run in a Linux container built for their runs-on label (${images.join("; ") || "none selected"}) on a clean clone of HEAD, like GitHub's fresh runner; it has the tools core's jobs use, not GitHub's full runner image; your working tree and shell are not used`);
  } else {
    notes.push("ran natively on this machine and your working tree (--quick or --native), not in GitHub's Linux environment; see the WARNING lines for how this machine differs from each job's runs-on image");
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
    let result;
    try {
      result = await runJob(job);
    } catch (error) {
      // One job's crash must not abort the others or hide the summary; the message is redacted like all output.
      result = error instanceof GitHubOnly
        ? { id: job.key, name: job.name, status: "SKIPPED", kind: "github-only", detail: "needs GitHub", fix: `cannot be checked here: ${error.message}`, summary: `needs GitHub, ${error.message.split(" (")[0]}; not checked locally`, took: 0 }
        : { id: job.key, name: job.name, status: "FAIL", kind: "", detail: `verify itself failed on this job: ${error.message}`, fix: "This is a bug in scripts/verify.mjs or a workflow construct it does not handle; fix that first.", took: 0 };
    }
    results.push(result);
    out(`   ${result.status === "PASS" && result.allowed?.length > 0 ? "PASS (allowed failure)" : result.status} ${job.key}${result.detail ? `: ${result.detail}` : ""}${result.fix ? `\n          ${result.status === "SKIPPED" ? "why" : "fix"}: ${result.fix}` : ""}`);
    if (interrupted) break;
  }
}

await main();
cleanup();

const total = Date.now() - started;
const failed = results.filter((r) => r.status === "FAIL");
const incompleteJobs = results.filter((r) => r.status === "INCOMPLETE");
// Cannot be checked here by design, or GitHub would not run them either: stated, but not a gap to close.
const byDesign = results.filter((r) => r.status === "SKIPPED" && ["github-only", "other-os", "not-triggered", "condition"].includes(r.kind));
// Skipped only because this machine is not ready (Docker is off): a check that could run and did not.
const missed = results.filter((r) => r.status === "SKIPPED" && !["github-only", "other-os", "not-triggered", "condition"].includes(r.kind));
const notRun = allJobs.filter((job) => !selected.includes(job));
const width = Math.max(...results.map((r) => r.id.length), 8);
out("");
out(`verify summary - ${new Date().toISOString().slice(0, 19)}Z, HEAD ${head?.slice(0, 7) ?? "none"} ${dirty ? "(uncommitted changes)" : "(clean)"}, ${seconds(total)} wall clock`);
const labelOf = (r) => (r.status === "PASS" && r.allowed?.length > 0 ? "PASS (allowed failure)" : r.status);
const labelWidth = Math.max(10, ...results.map((r) => labelOf(r).length));
for (const r of results) {
  const text =
    r.status === "SKIPPED" || r.status === "INCOMPLETE"
      ? (r.summary ?? `${r.detail}: ${r.fix}`)
      : r.status === "FAIL"
        ? r.detail
        : seconds(r.took);
  const extra = r.status === "PASS" ? [...(r.allowed?.length ? [`allowed to fail on GitHub too: ${r.allowed.join("; ")}`] : []), ...(r.notRun?.length ? [`${r.notRun.join(", ")} not run: GitHub-only`] : [])] : [];
  out(`${labelOf(r).padEnd(labelWidth)} ${r.id.padEnd(width)}  ${text}${extra.length ? `  [${extra.join("; ")}]` : ""}`);
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
  out(`verify: ${incompleteJobs.length + missed.length} job(s) INCOMPLETE, or SKIPPED because this machine was not ready or the job is opt-in (${[...incompleteJobs, ...missed].map((r) => r.id).join(", ")}), so not everything was checked; fix the reason above and run again`);
  process.exit(2);
}
const partial = options.quick || options.jobs.length > 0;
const only = byDesign.filter((r) => r.kind === "github-only" || r.kind === "other-os").map((r) => r.id);
const untriggered = byDesign.filter((r) => r.kind !== "github-only" && r.kind !== "other-os").map((r) => r.id);
const allowedJobs = results.filter((r) => r.status === "PASS" && r.allowed?.length > 0).map((r) => r.id);
const designNote = [
  only.length > 0 ? `${only.length} job(s) need GitHub and were not checked here (${only.join(", ")})` : "",
  untriggered.length > 0 ? `${untriggered.length} job(s) are not triggered by this pull request (${untriggered.join(", ")})` : "",
  allowedJobs.length > 0 ? `${allowedJobs.length} job(s) PASS only because GitHub allows a failed step (${allowedJobs.join(", ")})` : "",
]
  .filter(Boolean)
  .map((text) => `; ${text}`)
  .join("");
out(partial ? `verify: the selected jobs pass (this was not the full set)${designNote}` : `verify: every job that can run here passes${designNote}`);
