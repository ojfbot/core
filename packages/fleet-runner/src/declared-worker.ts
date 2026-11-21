import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createReadStream,
  linkSync,
  lstatSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import { FleetHttpError, type FleetClient, fleetClient } from "./client.js";
import {
  decideClaim,
  kindUnavailable,
  readPowerSource,
  realHostFacts,
  type ClaimDecision,
  type HostFacts,
  type PowerSource,
} from "./claim-policy.js";
import { INPUT_HASH, putInput, readInput } from "./inputs.js";
import { JobError, type Claim, type JobHandler, type JobOutput } from "./jobs.js";
import { runWorker } from "./worker.js";
import type { DeclaredCommand, PinnedFile, WorkerSettings } from "./worker-settings.js";
import { runPresence } from "./presence.js";
import { releaseInfo } from "./version.js";
import { acquireLock, lockHeld, type Lock } from "./worker-lock.js";
import { observationOf } from "./worker-presence.js";

/** The installed command receives one JSON envelope on stdin and returns only JobOutput on stdout. */
export function commandHandler(declared: DeclaredCommand, inputDir?: string): JobHandler {
  return (job, context) =>
    new Promise<JobOutput>((resolve, reject) => {
      if (context.signal.aborted) {
        reject(new JobError("interrupted", true));
        return;
      }
      const [program, ...args] = declared.command;
      const child = spawn(program, args, {
        shell: false,
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "ignore"],
        env: {
          PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
          ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
          ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
        },
      });
      let output = "";
      let failure: string | undefined;
      let stopping: Promise<void> | undefined;
      const groupAlive = () => {
        if (!child.pid) return false;
        try {
          process.kill(process.platform === "win32" ? child.pid : -child.pid, 0);
          return true;
        } catch (error) {
          return !(error && typeof error === "object" && "code" in error && error.code === "ESRCH");
        }
      };
      const kill = (signal: NodeJS.Signals) => {
        try {
          if (child.pid && process.platform !== "win32") process.kill(-child.pid, signal);
          else child.kill(signal);
        } catch {
          /* An already exited command needs no further signal. */
        }
      };
      const stop = (code: string) => {
        failure ??= code;
        if (stopping) return;
        kill("SIGTERM");
        stopping = (async () => {
          const termDeadline = performance.now() + 5_000;
          while (groupAlive() && performance.now() < termDeadline) await delay(20);
          if (!groupAlive()) return;
          kill("SIGKILL");
          const reapDeadline = performance.now() + 500;
          while (groupAlive() && performance.now() < reapDeadline) await delay(10);
          if (groupAlive()) failure = "command-cleanup-failed";
        })();
      };
      const abort = () => stop("interrupted");
      const timer = setTimeout(() => stop("command-timeout"), declared.timeoutMs);
      const cleanup = async () => {
        clearTimeout(timer);
        context.signal.removeEventListener("abort", abort);
        await stopping;
      };
      context.signal.addEventListener("abort", abort, { once: true });
      child.stdin.on("error", () => {});
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        if (Buffer.byteLength(output) + Buffer.byteLength(chunk) > 4_096)
          stop("invalid-command-output");
        else output += chunk;
      });
      child.once("error", async () => {
        await cleanup();
        reject(new JobError("command-start-failed", false));
      });
      child.once("close", async (code) => {
        await cleanup();
        if (failure || code !== 0) {
          reject(new JobError(failure ?? "command-failed", false));
          return;
        }
        try {
          const result: unknown = JSON.parse(output);
          if (
            !result ||
            typeof result !== "object" ||
            !("file" in result) ||
            !("sha256" in result) ||
            result.file !== `${job.key}.${job.fence}.jsonl` ||
            typeof result.sha256 !== "string" ||
            !/^[a-f0-9]{64}$/.test(result.sha256)
          )
            throw Error("invalid-command-output");
          const info = lstatSync(join(context.outDir, result.file));
          if (!info.isFile() || info.isSymbolicLink()) throw Error("invalid-command-output");
          resolve({ file: result.file, sha256: result.sha256 });
        } catch {
          reject(new JobError("invalid-command-output", false));
        }
      });
      child.stdin.end(
        `${JSON.stringify({ job, outDir: context.outDir, ...(inputDir ? { inputDir } : {}) })}\n`,
      );
      if (context.signal.aborted) abort();
    });
}

function fileHash(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("error", reject)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * True only when every pinned file is a regular file that only its owner can write and still has
 * exactly its recorded bytes. Run it as late as possible: it says nothing about later moments.
 */
export async function pinsHold(pins: readonly PinnedFile[]): Promise<boolean> {
  for (const pin of pins) {
    try {
      const info = lstatSync(pin.path);
      if (!info.isFile() || info.isSymbolicLink() || info.mode & 0o022) return false;
      if ((await fileHash(pin.path)) !== pin.sha256) return false;
    } catch {
      return false;
    }
  }
  return true;
}

const ours = (info: { uid: number }) =>
  process.getuid === undefined || info.uid === process.getuid();

/** A real directory that this user owns and nobody else can write, created if it is missing. */
function privateDirectory(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const info = lstatSync(dir);
  if (!info.isDirectory() || info.isSymbolicLink() || info.mode & 0o022 || !ours(info))
    throw new JobError("unsafe-input-dir", false);
}

/**
 * Check that a job's staged inputs are still exactly its own: regular files this user owns, with
 * the bytes their names promise, and nothing else in the folder.
 */
export function verifyJobInputs(jobDir: string, inputs: readonly string[]): void {
  try {
    const info = lstatSync(jobDir);
    if (!info.isDirectory() || info.isSymbolicLink() || info.mode & 0o022 || !ours(info))
      throw new Error("unsafe");
    for (const hash of new Set(inputs)) {
      if (!ours(lstatSync(join(jobDir, hash)))) throw new Error("unsafe");
      readInput(jobDir, hash);
    }
  } catch {
    throw new JobError("input-unavailable", true);
  }
}

/**
 * Fetch every input of a held job. Verified bytes live once, by hash, under `<dir>/blobs`; the job
 * gets its own folder `<dir>/jobs/<key>.<fence>` holding links to exactly its inputs, and returns
 * that path. The handler sees only its own job's inputs. Cached bytes are trusted only after they
 * are read without following links and hash correctly again. Errors are codes only.
 */
export async function stageInputs(
  client: Pick<FleetClient, "downloadInput">,
  job: Pick<Claim, "key" | "fence" | "inputs">,
  dir: string,
  signal: AbortSignal,
): Promise<string> {
  if (!job.inputs.every((hash) => INPUT_HASH.test(hash)))
    throw new JobError("invalid-input", false);
  const blobs = join(dir, "blobs");
  privateDirectory(dir);
  privateDirectory(blobs);
  const jobDir = join(dir, "jobs", `${job.key}.${job.fence}`);
  privateDirectory(join(dir, "jobs"));
  rmSync(jobDir, { recursive: true, force: true });
  privateDirectory(jobDir);
  try {
    for (const hash of new Set(job.inputs)) {
      let cached = false;
      try {
        if (!ours(lstatSync(join(blobs, hash)))) throw new Error("not ours");
        readInput(blobs, hash);
        cached = true;
      } catch {
        // A bad, foreign, linked or partial cache entry is replaced, never trusted.
        rmSync(join(blobs, hash), { recursive: true, force: true });
      }
      if (!cached) {
        let bytes: Buffer;
        try {
          bytes = await client.downloadInput(job, hash, signal);
        } catch (error) {
          if (signal.aborted) throw new JobError("interrupted", true);
          if (error instanceof FleetHttpError && !error.retryable)
            throw new JobError("input-refused", false);
          // Transport failure, truncation or a hash mismatch: another attempt may succeed.
          throw new JobError("input-unavailable", true);
        }
        try {
          putInput(blobs, hash, bytes);
        } catch {
          throw new JobError("input-unavailable", true);
        }
      }
      try {
        linkSync(join(blobs, hash), join(jobDir, hash));
      } catch {
        throw new JobError("input-unavailable", true);
      }
    }
  } catch (error) {
    rmSync(jobDir, { recursive: true, force: true });
    throw error;
  }
  return jobDir;
}

/** One holder per shared resource on this host. The slot is taken before a claim and kept until the attempt ends. */
export interface ResourceSlots {
  acquire(resource: string): boolean;
  release(resource: string): void;
  releaseAll(): void;
  /** True while another process holds the slot. */
  busy(resource: string): boolean;
}

export function resourceSlots(dir: string): ResourceSlots {
  const mine = new Map<string, Lock>();
  const file = (resource: string) => join(dir, `${resource}.slot`);
  return {
    acquire(resource) {
      if (mine.has(resource)) return true;
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      const lock = acquireLock(file(resource));
      if (!lock) return false;
      mine.set(resource, lock);
      return true;
    },
    release(resource) {
      mine.get(resource)?.release();
      mine.delete(resource);
    },
    releaseAll() {
      for (const lock of mine.values()) lock.release();
      mine.clear();
    },
    busy: (resource) => !mine.has(resource) && lockHeld(file(resource)),
  };
}

/** One claim at a time, with the declared capabilities for that particular kind. */
export function declaredClient(
  client: FleetClient,
  settings: WorkerSettings,
  unavailable: { has(kind: string): boolean } = new Set<string>(),
  /** Asked immediately before each claim request; false skips that kind. */
  beforeClaim?: (kind: string) => Promise<boolean>,
  slots?: ResourceSlots,
): FleetClient {
  const entries = Object.entries(settings.kinds);
  let cursor = 0;
  return {
    ...client,
    claim: async (_caps, allowed) => {
      slots?.releaseAll(); // Attempts run one at a time, so the previous holder is finished.
      for (let offset = 0; offset < entries.length; offset += 1) {
        const index = (cursor + offset) % entries.length;
        const entry = entries[index];
        if (!entry) continue;
        const [kind, command] = entry;
        if (!allowed.includes(kind) || unavailable.has(kind)) continue;
        // Power, time window and GPU are looked at again right now. They can still change before the
        // server sees the request: that gap cannot be closed without the server, so it is only narrowed.
        if (beforeClaim && !(await beforeClaim(kind))) continue;
        if (command.resource && slots && !slots.acquire(command.resource)) continue;
        let claim: Awaited<ReturnType<FleetClient["claim"]>> | undefined;
        try {
          claim = await client.claim(command.capabilities, [kind]);
        } finally {
          if (!claim && command.resource) slots?.release(command.resource);
        }
        if (claim) {
          cursor = (index + 1) % entries.length;
          return claim;
        }
      }
      return null;
    },
  };
}

/** Local facts the claim rules read. Real by default; tests substitute simulated power and time. */
export interface WorkerEnvironment {
  power: () => Promise<PowerSource>;
  now: () => number;
  host: HostFacts;
}

export async function runDeclaredWorker(
  settings: WorkerSettings,
  signal: AbortSignal,
  environment: Partial<WorkerEnvironment> = {},
): Promise<void> {
  const env: WorkerEnvironment = {
    power: environment.power ?? readPowerSource,
    now: environment.now ?? Date.now,
    host: environment.host ?? realHostFacts(settings.policy),
  };
  // A second client for the same worker identity would claim alongside this one. Refuse it before
  // anything else happens: no status write, no claim, no input fetch.
  const identity = acquireLock(`${settings.tokenFile}.lock`);
  if (!identity) throw Error("duplicate-client");
  try {
    await runLocked(settings, signal, env);
  } finally {
    identity.release();
  }
}

async function runLocked(
  settings: WorkerSettings,
  signal: AbortSignal,
  env: WorkerEnvironment,
): Promise<void> {
  mkdirSync(settings.outDir, { recursive: true, mode: 0o700 });
  mkdirSync(dirname(settings.statusFile), { recursive: true, mode: 0o700 });
  const slots = resourceSlots(
    settings.resourceDir ?? join(dirname(settings.statusFile), "resources"),
  );
  // A kind whose pinned files changed is not offered again until the worker restarts.
  const withdrawn = new Set<string>();
  // Kinds this host cannot run right now, recomputed before every claim.
  const held = new Map<string, string>();
  const unavailable = { has: (kind: string) => withdrawn.has(kind) || held.has(kind) };
  let claiming: ClaimDecision = { allowed: true, reason: "ok" };
  let power: PowerSource = "unknown";
  let current = "starting";
  let errorCode: string | undefined;
  const evaluate = async () => {
    held.clear();
    claiming = { allowed: true, reason: "ok" }; // Re-decided from scratch on every poll.
    for (const [kind, declared] of Object.entries(settings.kinds)) {
      const reason = kindUnavailable(declared.requires ?? {}, declared.resource, env.host);
      if (reason) held.set(kind, reason);
      else if (declared.resource && slots.busy(declared.resource)) held.set(kind, "resource-busy");
    }
    if (!settings.policy) return;
    try {
      power = await env.power();
      claiming = decideClaim(settings.policy, power, env.now());
    } catch {
      claiming = { allowed: false, reason: "policy-error" };
    }
  };
  const status = (state: string) => {
    current = state;
    const temp = `${settings.statusFile}.${process.pid}.tmp`;
    const reasons: Record<string, string> = Object.create(null);
    for (const kind of Object.keys(settings.kinds)) {
      const reason = withdrawn.has(kind) ? "handler-pin-mismatch" : held.get(kind);
      if (reason) reasons[kind] = reason;
    }
    writeFileSync(
      temp,
      `${JSON.stringify({
        schemaVersion: 1,
        version: releaseInfo.version,
        worker: settings.worker,
        kinds: Object.keys(settings.kinds).filter((kind) => !unavailable.has(kind)),
        unavailable: reasons,
        claiming,
        state,
        updatedAt: new Date().toISOString(),
      })}\n`,
      { mode: 0o600 },
    );
    renameSync(temp, settings.statusFile);
  };
  const client = fleetClient(
    settings.endpoint,
    settings.worker,
    settings.tokenFile,
    settings.generation,
  );
  const handlers: Record<string, JobHandler> = Object.create(null);
  for (const [kind, declared] of Object.entries(settings.kinds)) {
    if (!(await pinsHold(declared.pins ?? []))) withdrawn.add(kind);
    handlers[kind] = async (job, context) => {
      let jobDir: string | undefined;
      try {
        // Stage first and check last, so nothing slow happens between the check and the start.
        if (settings.inputDir)
          jobDir = await stageInputs(client, job, settings.inputDir, context.signal);
        if (!(await pinsHold(declared.pins ?? []))) {
          withdrawn.add(kind);
          throw new JobError("handler-pin-mismatch", true);
        }
        if (jobDir) verifyJobInputs(jobDir, job.inputs);
        status("working");
        return await commandHandler(declared, jobDir)(job, context);
      } finally {
        if (jobDir) rmSync(jobDir, { recursive: true, force: true });
      }
    };
  }
  await evaluate();
  status("starting");
  // Presence is independent of job authority: it only says what this worker is doing and why.
  const presence = runPresence(
    client,
    () => {
      const reasons: Record<string, string> = Object.create(null);
      for (const kind of Object.keys(settings.kinds)) {
        const reason = withdrawn.has(kind) ? "handler-pin-mismatch" : held.get(kind);
        if (reason) reasons[kind] = reason;
      }
      return observationOf({
        state: current,
        claiming,
        power,
        kinds: Object.keys(settings.kinds).filter((kind) => !unavailable.has(kind)),
        unavailable: reasons,
        ...(errorCode ? { errorCode } : {}),
      });
    },
    signal,
    settings.presenceMs,
  );
  try {
    await runWorker(
      declaredClient(
        client,
        settings,
        unavailable,
        async (kind) => {
          await evaluate();
          return claiming.allowed && !unavailable.has(kind);
        },
        slots,
      ),
      {
        caps: [],
        handlers,
        outDir: settings.outDir,
        signal,
        pollMs: settings.pollMs,
        canClaim: async () => {
          await evaluate();
          if (!claiming.allowed) return false;
          if ((await client.workerControl(signal)).paused) {
            claiming = { allowed: false, reason: "service-paused" };
            return false;
          }
          return true;
        },
        onEvent: (event) => {
          slots.releaseAll(); // An attempt just ended; free the resource before waiting.
          if (event.type === "request-error") errorCode = event.code;
          status(event.type);
        },
      },
    );
  } finally {
    slots.releaseAll();
    status("stopped");
    await presence;
  }
}
