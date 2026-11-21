import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, lstatSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import { FleetHttpError, type FleetClient, fleetClient } from "./client.js";
import { INPUT_HASH, putInput, readInput } from "./inputs.js";
import { JobError, type Claim, type JobHandler, type JobOutput } from "./jobs.js";
import { runWorker } from "./worker.js";
import type { DeclaredCommand, PinnedFile, WorkerSettings } from "./worker-settings.js";
import { releaseInfo } from "./version.js";

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

/** True only when every pinned file still has exactly its recorded bytes. */
export async function pinsHold(pins: readonly PinnedFile[]): Promise<boolean> {
  for (const pin of pins) {
    try {
      const info = lstatSync(pin.path);
      if (!info.isFile() || info.isSymbolicLink()) return false;
      if ((await fileHash(pin.path)) !== pin.sha256) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Fetch every input of a held job into the local staging directory under its hash.
 * Cached bytes are trusted only after they hash correctly again. Errors are codes only.
 */
export async function stageInputs(
  client: Pick<FleetClient, "downloadInput">,
  job: Pick<Claim, "key" | "fence" | "inputs">,
  dir: string,
  signal: AbortSignal,
): Promise<void> {
  if (!job.inputs.every((hash) => INPUT_HASH.test(hash)))
    throw new JobError("invalid-input", false);
  for (const hash of job.inputs) {
    try {
      readInput(dir, hash);
      continue;
    } catch {
      rmSync(join(dir, hash), { force: true }); // A bad or partial cache entry is replaced, never trusted.
    }
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
      putInput(dir, hash, bytes);
    } catch {
      throw new JobError("input-unavailable", true);
    }
  }
}

/** One claim at a time, with the declared capabilities for that particular kind. */
export function declaredClient(
  client: FleetClient,
  settings: WorkerSettings,
  unavailable: ReadonlySet<string> = new Set(),
): FleetClient {
  const entries = Object.entries(settings.kinds);
  let cursor = 0;
  return {
    ...client,
    claim: async (_caps, allowed) => {
      for (let offset = 0; offset < entries.length; offset += 1) {
        const index = (cursor + offset) % entries.length;
        const entry = entries[index];
        if (!entry) continue;
        const [kind, command] = entry;
        if (!allowed.includes(kind) || unavailable.has(kind)) continue;
        const claim = await client.claim(command.capabilities, [kind]);
        if (claim) {
          cursor = (index + 1) % entries.length;
          return claim;
        }
      }
      return null;
    },
  };
}

export async function runDeclaredWorker(
  settings: WorkerSettings,
  signal: AbortSignal,
): Promise<void> {
  mkdirSync(settings.outDir, { recursive: true, mode: 0o700 });
  mkdirSync(dirname(settings.statusFile), { recursive: true, mode: 0o700 });
  // A kind whose pinned files changed is not offered again until the worker restarts.
  const unavailable = new Set<string>();
  const status = (state: string) => {
    const temp = `${settings.statusFile}.${process.pid}.tmp`;
    writeFileSync(
      temp,
      `${JSON.stringify({
        schemaVersion: 1,
        version: releaseInfo.version,
        worker: settings.worker,
        kinds: Object.keys(settings.kinds).filter((kind) => !unavailable.has(kind)),
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
    if (!(await pinsHold(declared.pins ?? []))) unavailable.add(kind);
    const handle = commandHandler(declared, settings.inputDir);
    handlers[kind] = async (job, context) => {
      if (!(await pinsHold(declared.pins ?? []))) {
        unavailable.add(kind);
        throw new JobError("handler-pin-mismatch", true);
      }
      if (settings.inputDir) await stageInputs(client, job, settings.inputDir, context.signal);
      status("working");
      return handle(job, context);
    };
  }
  status("starting");
  try {
    await runWorker(declaredClient(client, settings, unavailable), {
      caps: [],
      handlers,
      outDir: settings.outDir,
      signal,
      pollMs: settings.pollMs,
      canClaim: async () => !(await client.workerControl(signal)).paused,
      onEvent: (event) => status(event.type),
    });
  } finally {
    status("stopped");
  }
}
