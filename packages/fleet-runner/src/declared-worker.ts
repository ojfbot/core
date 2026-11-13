import { spawn } from "node:child_process";
import { mkdirSync, lstatSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { FleetClient } from "./client.js";
import { fleetClient } from "./client.js";
import { JobError, type JobHandler, type JobOutput } from "./jobs.js";
import { runWorker } from "./worker.js";
import type { DeclaredCommand, WorkerSettings } from "./worker-settings.js";
import { releaseInfo } from "./version.js";

/** The installed command receives one JSON envelope on stdin and returns only JobOutput on stdout. */
export function commandHandler(declared: DeclaredCommand): JobHandler {
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
      let killTimer: ReturnType<typeof setTimeout> | undefined;
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
        kill("SIGTERM");
        killTimer ??= setTimeout(() => kill("SIGKILL"), 5_000);
      };
      const abort = () => stop("interrupted");
      const timer = setTimeout(() => stop("command-timeout"), declared.timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        if (killTimer) clearTimeout(killTimer);
        context.signal.removeEventListener("abort", abort);
      };
      context.signal.addEventListener("abort", abort, { once: true });
      child.stdin.on("error", () => {});
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        if (Buffer.byteLength(output) + Buffer.byteLength(chunk) > 4_096)
          stop("invalid-command-output");
        else output += chunk;
      });
      child.once("error", () => {
        cleanup();
        reject(new JobError("command-start-failed", false));
      });
      child.once("close", (code) => {
        cleanup();
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
      child.stdin.end(`${JSON.stringify({ job, outDir: context.outDir })}\n`);
      if (context.signal.aborted) abort();
    });
}

/** One claim at a time, with the declared capabilities for that particular kind. */
export function declaredClient(client: FleetClient, settings: WorkerSettings): FleetClient {
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
        if (!allowed.includes(kind)) continue;
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
  const status = (state: string) => {
    const temp = `${settings.statusFile}.${process.pid}.tmp`;
    writeFileSync(
      temp,
      `${JSON.stringify({
        schemaVersion: 1,
        version: releaseInfo.version,
        worker: settings.worker,
        kinds: Object.keys(settings.kinds),
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
    const handle = commandHandler(declared);
    handlers[kind] = async (job, context) => {
      status("working");
      return handle(job, context);
    };
  }
  status("starting");
  try {
    await runWorker(declaredClient(client, settings), {
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
